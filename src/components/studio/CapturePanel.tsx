"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Camera, ImagePlus, RefreshCcw, ShieldCheck, Sun, User } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { analyzeFrame, cropToFace, loadDetector, type QualityReport } from "@/lib/quality";
import { EASE } from "../ui";
import { QualityHud } from "./QualityHud";

interface Props {
  onConfirm: (blob: Blob, previewUrl: string) => void;
  /** reused by Stage 2: no consent card, different CTA */
  compact?: boolean;
  cta?: string;
}

export function CapturePanel({ onConfirm, compact = false, cta = "Use this photo" }: Props) {
  const [consent, setConsent] = useState(compact);
  const [mode, setMode] = useState<"camera" | "upload">("camera");
  const [report, setReport] = useState<QualityReport | null>(null);
  const [still, setStill] = useState<{ url: string; blob: Blob } | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const detectorRef = useRef<Awaited<ReturnType<typeof loadDetector>>>(null);
  const [detectorReady, setDetectorReady] = useState(false);

  useEffect(() => {
    loadDetector().then((d) => {
      detectorRef.current = d;
      setDetectorReady(true);
    });
  }, []);

  /* live camera */
  useEffect(() => {
    if (!consent || mode !== "camera" || still) return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval>;
    let cancelled = false;
    setCamError(null);
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1600 } }, audio: false })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        const v = videoRef.current!;
        v.srcObject = s;
        v.play().catch(() => {});
        timer = setInterval(() => {
          if (v.readyState >= 2) setReport(analyzeFrame(v, detectorRef.current, "camera"));
        }, 280);
      })
      .catch(() => setCamError("Camera unavailable or blocked. Upload a photo instead."));
    return () => {
      cancelled = true;
      clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [consent, mode, still, detectorReady]);

  const snap = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0); // un-mirrored, as the camera sees it
    c.toBlob((b) => b && setStill({ blob: b, url: URL.createObjectURL(b) }), "image/jpeg", 0.92);
  }, []);

  const onFile = (f?: File) => {
    if (!f) return;
    setStill({ blob: f, url: URL.createObjectURL(f) });
  };

  /* re-score a still once it has rendered */
  const onStillLoaded = () => {
    if (imgRef.current) setReport(analyzeFrame(imgRef.current, detectorRef.current, mode));
  };

  const [confirming, setConfirming] = useState(false);
  const confirm = async () => {
    if (!still) return;
    setConfirming(true);
    try {
      // crop to the face so YouCam never sees a "face too small" photo
      const blob = report?.box ? await cropToFace(still.blob, report.box) : still.blob;
      onConfirm(blob, blob === still.blob ? still.url : URL.createObjectURL(blob));
    } finally {
      setConfirming(false);
    }
  };

  const retake = () => {
    if (still) URL.revokeObjectURL(still.url);
    setStill(null);
    setReport(null);
  };

  const pass = !!report?.pass;
  const showStill = !!still;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      {/* viewport */}
      <div className="relative">
        <div className="relative mx-auto aspect-[3/4] w-full max-w-md overflow-hidden rounded-[2rem] border border-line-strong bg-panel shadow-[0_30px_80px_-30px_rgb(0_0_0/0.9)]">
          <AnimatePresence mode="wait">
            {!consent ? (
              <motion.div key="consent" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 grid place-items-center p-8 text-center">
                <div>
                  <span className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl border border-line-strong bg-white/[0.04]"><ShieldCheck className="h-7 w-7 text-mint" /></span>
                  <h3 className="text-xl font-semibold text-white">Before we look at your face</h3>
                  <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-fog">Your photo is sent to our server and to YouCam for analysis, kept for under an hour, and deletable any time.</p>
                </div>
              </motion.div>
            ) : mode === "camera" && !showStill ? (
              <motion.video key="video" ref={videoRef} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} playsInline muted className="absolute inset-0 h-full w-full -scale-x-100 object-cover" />
            ) : showStill ? (
              // eslint-disable-next-line @next/next/no-img-element
              <motion.img key="still" ref={imgRef} src={still!.url} alt="Your photo" onLoad={onStillLoaded} initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease: EASE }} className={`absolute inset-0 h-full w-full object-cover ${mode === "camera" ? "-scale-x-100" : ""}`} />
            ) : (
              <motion.button key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }} className="absolute inset-0 grid place-items-center p-8 text-center transition-colors hover:bg-white/[0.03]">
                <div>
                  <span className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl border border-dashed border-line-strong"><ImagePlus className="h-7 w-7 text-rose" /></span>
                  <div className="font-semibold text-white">Drop a selfie or click to upload</div>
                  <div className="mt-1 text-sm text-fog">JPG or PNG · up to 12 MB</div>
                </div>
              </motion.button>
            )}
          </AnimatePresence>

          {camError && mode === "camera" && !showStill && (
            <div className="absolute inset-x-4 bottom-4 rounded-xl border border-amber/30 bg-amber/10 px-4 py-3 text-sm text-amber backdrop-blur">{camError}</div>
          )}

          {/* guide oval: live camera only. Uploads are auto-cropped to the face instead. */}
          {consent && mode === "camera" && (
            <svg viewBox="0 0 300 400" className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="none">
              <defs>
                <mask id="ovalMask"><rect width="300" height="400" fill="white" /><ellipse cx="150" cy="190" rx="98" ry="132" fill="black" /></mask>
              </defs>
              <rect width="300" height="400" fill="rgba(5,5,7,.55)" mask="url(#ovalMask)" />
              <motion.ellipse cx="150" cy="190" rx="98" ry="132" fill="none" strokeWidth="2.2" strokeDasharray={pass ? "0" : "7 7"} animate={{ stroke: pass ? "#4ff0bd" : "rgba(255,255,255,.55)" }} transition={{ duration: 0.4 }} />
            </svg>
          )}

          {/* scan line while live */}
          {consent && mode === "camera" && !showStill && (
            <motion.div className="pointer-events-none absolute inset-x-6 h-24 rounded-full bg-gradient-to-b from-transparent via-white/20 to-transparent blur-md" animate={{ top: ["8%", "78%", "8%"] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }} />
          )}

          {/* status pill */}
          {consent && (mode === "camera" || showStill) && (
            <div className="absolute inset-x-0 top-4 flex justify-center">
              <motion.span key={pass ? "ok" : "no"} initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className={`rounded-full border px-4 py-1.5 font-mono text-[0.68rem] uppercase tracking-[0.14em] backdrop-blur-xl ${pass ? "border-mint/40 bg-mint/15 text-mint" : "border-white/15 bg-black/40 text-white/80"}`}>
                {pass ? "Ready · looking good" : report?.checks.find((c) => c.status === "fail")?.tip ?? (mode === "camera" ? "Position your face in the oval" : "Checking your photo…")}
              </motion.span>
            </div>
          )}
        </div>

        {/* controls */}
        <div className="mx-auto mt-6 flex max-w-md items-center justify-between gap-3">
          {consent ? (
            <>
              <div className="glass flex rounded-full p-1">
                {([["camera", Camera, "Camera"], ["upload", ImagePlus, "Upload"]] as const).map(([m, Icon, label]) => (
                  <button key={m} onClick={() => { retake(); setMode(m); }} className="relative rounded-full px-4 py-2 text-sm">
                    {mode === m && <motion.span layoutId="modePill" className="absolute inset-0 rounded-full bg-white/10 ring-1 ring-white/15" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
                    <span className={`relative flex items-center gap-2 ${mode === m ? "text-white" : "text-fog"}`}><Icon className="h-4 w-4" />{label}</span>
                  </button>
                ))}
              </div>

              {mode === "camera" && !showStill ? (
                <motion.button onClick={snap} disabled={!pass} whileTap={{ scale: 0.92 }} aria-label="Take photo" className="relative grid h-[4.5rem] w-[4.5rem] place-items-center rounded-full border-2 border-white/30 transition-opacity disabled:opacity-40">
                  {pass && <motion.span className="absolute inset-0 rounded-full border-2 border-mint" animate={{ scale: [1, 1.25], opacity: [0.8, 0] }} transition={{ duration: 1.5, repeat: Infinity }} />}
                  <span className={`h-14 w-14 rounded-full transition-colors ${pass ? "bg-white" : "bg-white/40"}`} />
                </motion.button>
              ) : (
                <button onClick={retake} className="btn-ghost !px-4 !py-2.5 text-sm"><RefreshCcw className="h-4 w-4" />Retake</button>
              )}
            </>
          ) : null}
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      </div>

      {/* right column */}
      <div className="flex flex-col gap-5">
        {!compact && (
          <label className={`card flex cursor-pointer items-start gap-4 p-5 transition-colors ${consent ? "border-mint/30" : ""}`}>
            <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors ${consent ? "border-mint bg-mint text-ink" : "border-line-strong"}`}>
              {consent && <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
            </span>
            <input type="checkbox" className="sr-only" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span className="text-sm leading-relaxed text-fog">
              <span className="font-medium text-white">I consent to photo analysis.</span> My selfie is processed by YouCam&apos;s skin and makeup APIs, stored for under an hour, and I can delete it with one tap. Results are cosmetic estimates, not medical advice.
            </span>
          </label>
        )}

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-mono text-xs uppercase tracking-[0.18em] text-fog">Quality gate</h3>
            <span className="font-mono text-[0.65rem] text-fog/70">runs on your device</span>
          </div>
          {consent ? <QualityHud report={report} /> : <div className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-sm text-fog">Accept the consent above to start the camera.</div>}
        </div>

        <div className="card p-5">
          <h3 className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-fog">For the best read</h3>
          <ul className="space-y-2.5 text-sm text-fog">
            {[[Sun, "Face a window. Soft, even light, no harsh shadows."], [User, "Bare skin if you can, hair back, no glasses."], [Camera, "Look straight at the lens, neutral face, arm's length."]].map(([Icon, t], i) => {
              const I = Icon as typeof Sun;
              return <li key={i} className="flex gap-3"><I className="mt-0.5 h-4 w-4 shrink-0 text-rose" />{t as string}</li>;
            })}
          </ul>
        </div>

        <motion.button
          className="btn-primary group justify-center"
          disabled={!consent || !showStill || !pass || confirming}
          onClick={confirm}
          whileTap={{ scale: 0.98 }}
        >
          {cta}
          <ArrowRight className="h-4.5 w-4.5 transition-transform group-hover:translate-x-1" />
        </motion.button>
        {showStill && !pass && <p className="-mt-2 text-center text-xs text-amber">This photo didn&apos;t pass the gate. Fix the flagged items and retake. It saves credits.</p>}
      </div>
    </div>
  );
}
