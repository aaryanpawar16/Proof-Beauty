"use client";

import type { FaceDetector } from "@mediapipe/tasks-vision";

/**
 * Client-side capture quality gate. Bad photos are rejected here, before any credit is spent.
 * Face detection + pose via MediaPipe BlazeFace; blur via variance of the Laplacian; lighting via a
 * brightness histogram. Thresholds follow YouCam's guidance for skin-analysis photos
 * (even light, frontal face, sharp, short side ≥ 480 px).
 */

export type Status = "ok" | "warn" | "fail" | "pending";

export interface QualityCheck {
  id: "face" | "size" | "sharp" | "light" | "pose" | "res";
  label: string;
  status: Status;
  value: string;
  tip: string;
}

export interface QualityReport {
  checks: QualityCheck[];
  pass: boolean;
  /** normalised face box, for the on-screen overlay */
  box?: { x: number; y: number; w: number; h: number };
  detectorReady: boolean;
}

let detectorPromise: Promise<FaceDetector | null> | null = null;

/**
 * MediaPipe's WASM runtime writes harmless "INFO: Created TensorFlow Lite XNNPACK delegate…" lines to
 * console.error, which Next's dev overlay reports as an error. Drop just those INFO lines.
 */
let consoleFiltered = false;
function silenceMediapipeInfo() {
  if (consoleFiltered) return;
  consoleFiltered = true;
  const orig = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].startsWith("INFO:")) return;
    orig.apply(console, args);
  };
}

export function loadDetector(): Promise<FaceDetector | null> {
  if (!detectorPromise) {
    silenceMediapipeInfo();
    detectorPromise = (async () => {
      try {
        const { FilesetResolver, FaceDetector } = await import("@mediapipe/tasks-vision");
        const fileset = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
        return await FaceDetector.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: "/mediapipe/blaze_face_short_range.tflite" },
          runningMode: "IMAGE",
          minDetectionConfidence: 0.55,
        });
      } catch (e) {
        console.warn("Face detector unavailable; the server-side check still applies.", e);
        return null;
      }
    })();
  }
  return detectorPromise;
}

const W = 320;
let scratch: HTMLCanvasElement | null = null;

function sizeOf(src: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement) {
  if (src instanceof HTMLVideoElement) return { w: src.videoWidth, h: src.videoHeight };
  if (src instanceof HTMLImageElement) return { w: src.naturalWidth, h: src.naturalHeight };
  return { w: src.width, h: src.height };
}

/**
 * YouCam rejects photos where the face is small in the frame (error_src_face_too_small). Rather than make
 * the user re-frame, crop around the detected face (3:4) before upload.
 *
 * Calibrated against the real API: with the detector's face box at 47% of the image width skin-analysis
 * said "face too small"; at 56% it passed. So aim for ~62% and only skip the crop above ~58%.
 */
export async function cropToFace(blob: Blob, box: { x: number; y: number; w: number; h: number }): Promise<Blob> {
  if (box.w >= 0.58) return blob; // already large enough
  const bmp = await createImageBitmap(blob);
  const W = bmp.width, H = bmp.height;
  const fw = box.w * W, fh = box.h * H;
  const cx = (box.x + box.w / 2) * W, cy = (box.y + box.h / 2) * H;

  let ch = Math.max((fw / 0.62) * (4 / 3), fh / 0.7);
  let cw = ch * (3 / 4);
  const s = Math.min(1, W / cw, H / ch); // can't crop larger than the photo
  cw *= s;
  ch *= s;
  const x = Math.max(0, Math.min(W - cw, cx - cw / 2));
  const y = Math.max(0, Math.min(H - ch, cy - ch / 2));

  // keep output between 600 and 2048 px on the long side
  const scale = Math.min(1, 2048 / Math.max(cw, ch)) * Math.max(1, 600 / Math.min(cw, ch));
  const c = document.createElement("canvas");
  c.width = Math.round(cw * scale);
  c.height = Math.round(ch * scale);
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, x, y, cw, ch, 0, 0, c.width, c.height);
  bmp.close();
  return await new Promise<Blob>((res) => c.toBlob((b) => res(b ?? blob), "image/jpeg", 0.93));
}

export function laplacianVariance(gray: Float32Array, w: number, h: number): number {
  let sum = 0, sumSq = 0, n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const v = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w];
      sum += v;
      sumSq += v * v;
      n++;
    }
  }
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

export function analyzeFrame(
  src: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  detector: FaceDetector | null,
  /** "upload": no framing rules, we auto-crop to the face instead (see cropToFace) */
  source: "camera" | "upload" = "camera",
): QualityReport {
  const { w: sw, h: sh } = sizeOf(src);
  const checks: QualityCheck[] = [];
  if (!sw || !sh) return { checks: [], pass: false, detectorReady: !!detector };

  const h = Math.round((W * sh) / sw);
  scratch ??= document.createElement("canvas");
  scratch.width = W;
  scratch.height = h;
  const ctx = scratch.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0, W, h);
  const { data } = ctx.getImageData(0, 0, W, h);

  const gray = new Float32Array(W * h);
  let sum = 0, hi = 0, lo = 0;
  for (let i = 0; i < gray.length; i++) {
    const y = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    gray[i] = y;
    sum += y;
    if (y > 250) hi++;
    if (y < 12) lo++;
  }
  const mean = sum / gray.length;
  const hiPct = (hi / gray.length) * 100, loPct = (lo / gray.length) * 100;
  const sharp = laplacianVariance(gray, W, h);

  /* resolution */
  const shortSide = Math.min(sw, sh);
  checks.push({
    id: "res",
    label: "Resolution",
    status: shortSide >= 600 ? "ok" : shortSide >= 480 ? "warn" : "fail",
    value: `${sw}×${sh}`,
    tip: shortSide < 480 ? "The short side must be at least 480 px." : "Good resolution.",
  });

  /* face + pose */
  let box: QualityReport["box"];
  let detections: ReturnType<FaceDetector["detect"]>["detections"] | null = null;
  if (detector) {
    try {
      detections = detector.detect(scratch).detections;
    } catch (e) {
      console.warn("Face detection failed on this frame; falling back to the server-side check.", e);
    }
  }
  if (!detections) {
    checks.push({ id: "face", label: "Face", status: "warn", value: "detector offline", tip: "We'll verify the face on the server instead." });
  } else {
    const faces = detections;
    if (faces.length === 0 && source === "upload") {
      // The on-device detector is tuned for selfie-sized faces and can miss a small one. Don't block an
      // upload on that: send it as-is and let YouCam's own face check decide.
      checks.push({ id: "face", label: "Face", status: "warn", value: "not auto-detected", tip: "We couldn't auto-crop to your face, so we'll send the photo as it is." });
    } else if (faces.length === 0) {
      checks.push({ id: "face", label: "Face", status: "fail", value: "none found", tip: "Face the camera so your whole face is visible." });
      checks.push({ id: "size", label: "Distance", status: "pending", value: "·", tip: "" });
      checks.push({ id: "pose", label: "Head pose", status: "pending", value: "·", tip: "" });
    } else if (faces.length > 1) {
      checks.push({ id: "face", label: "Face", status: "fail", value: `${faces.length} faces`, tip: "Only one person in frame, please." });
    } else {
      const f = faces[0];
      const bb = f.boundingBox!;
      box = { x: bb.originX / W, y: bb.originY / h, w: bb.width / W, h: bb.height / h };
      const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
      const centred = Math.abs(cx - 0.5) < 0.17 && Math.abs(cy - 0.5) < 0.2;
      checks.push({ id: "face", label: "Face", status: centred ? "ok" : "warn", value: centred ? "1 face · centred" : "1 face · off-centre", tip: "Centre your face in the oval." });

      const fillFrac = box.w;
      if (source === "upload") {
        // Uploads aren't framed by the user. We crop to the face, so what matters is face pixels.
        const facePx = fillFrac * sw;
        checks.push({
          id: "size",
          label: "Face size",
          status: facePx >= 170 ? "ok" : facePx >= 120 ? "warn" : "fail",
          value: `${Math.round(facePx)}px wide · auto-cropped`,
          tip: "The face is small in this photo. Use a closer or higher-resolution one.",
        });
      } else {
        checks.push({
          id: "size",
          label: "Distance",
          status: fillFrac >= 0.3 && fillFrac <= 0.78 ? "ok" : fillFrac >= 0.22 && fillFrac < 0.9 ? "warn" : "fail",
          value: `${Math.round(fillFrac * 100)}% of frame`,
          tip: fillFrac < 0.3 ? "Move closer, your face is too small." : "Move back a little so your whole face fits.",
        });
      }

      // BlazeFace keypoints: right eye, left eye, nose tip, mouth, right ear, left ear (normalised)
      const k = f.keypoints;
      if (k && k.length >= 3) {
        const [re, le, nose] = k;
        const eyeDist = Math.hypot((le.x - re.x) * W, (le.y - re.y) * h) || 1;
        const midX = ((re.x + le.x) / 2) * W;
        const yawRatio = (nose.x * W - midX) / eyeDist;
        const yaw = Math.max(-45, Math.min(45, yawRatio * 55));
        const roll = (Math.atan2((le.y - re.y) * h, (le.x - re.x) * W) * 180) / Math.PI;
        const bad = Math.abs(yaw) > 18 || Math.abs(roll) > 12;
        const warn = Math.abs(yaw) > 10 || Math.abs(roll) > 7;
        checks.push({
          id: "pose",
          label: "Head pose",
          status: bad ? "fail" : warn ? "warn" : "ok",
          value: `yaw ${Math.round(Math.abs(yaw))}° · roll ${Math.round(Math.abs(roll))}°`,
          tip: Math.abs(yaw) > 10 ? "Look straight at the camera." : "Keep your head level.",
        });
      }
    }
  }

  /* sharpness */
  checks.push({
    id: "sharp",
    label: "Sharpness",
    status: sharp > 45 ? "ok" : sharp > 22 ? "warn" : "fail",
    value: `Laplacian var ${Math.round(sharp)}`,
    tip: sharp <= 45 ? "Hold still and wipe your lens." : "Nice and sharp.",
  });

  /* lighting */
  const lightBad = mean < 55 || mean > 215 || hiPct > 12 || loPct > 35;
  const lightWarn = mean < 80 || mean > 190 || hiPct > 5 || loPct > 20;
  checks.push({
    id: "light",
    label: "Lighting",
    status: lightBad ? "fail" : lightWarn ? "warn" : "ok",
    value: `mean ${Math.round(mean)} · ${hiPct.toFixed(0)}% clipped`,
    tip: mean < 80 ? "Too dark. Face a window." : mean > 190 || hiPct > 5 ? "Too bright or glare. Avoid direct light." : loPct > 20 ? "Harsh shadows. Use even, soft light." : "Even, soft light.",
  });

  // Uploads are the user's choice of photo: every check is advisory (tip still shown) except the hard API
  // limit on resolution. The server-side re-frame retry and YouCam's own checks handle the rest.
  if (source === "upload") {
    for (const c of checks) if (c.status === "fail" && c.id !== "res") c.status = "warn";
  }

  const order = ["face", "size", "pose", "sharp", "light", "res"];
  checks.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  const pass = checks.every((c) => c.status === "ok" || c.status === "warn") && !checks.some((c) => c.status === "pending");
  return { checks, pass, box, detectorReady: !!detector };
}
