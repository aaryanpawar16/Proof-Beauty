import crypto from "node:crypto";
import sharp from "sharp";
import { rgbToLab, type LAB, rgbToHex } from "@/lib/color";

export const sha = (b: Buffer | string, len = 24) =>
  crypto.createHash("sha256").update(b).digest("hex").slice(0, len);

export interface Normalized {
  buf: Buffer;
  width: number;
  height: number;
  hash: string;
}

/** Fix EXIF rotation, cap the long side (API max is 4096), re-encode as JPEG. */
export async function normalizeUpload(input: Buffer): Promise<Normalized> {
  const img = sharp(input, { failOn: "none" }).rotate();
  const out = await img
    .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  return { buf: out.data, width: out.info.width, height: out.info.height, hash: sha(out.data) };
}

/**
 * Tighter crop for the "face too small" retry when the browser couldn't locate the face. Keeps `frac` of each
 * dimension, centred horizontally and biased up (faces sit in the upper-middle), then makes sure the short side
 * is at least 600 px.
 */
export async function centerCrop(buf: Buffer, frac: number): Promise<Normalized> {
  const meta = await sharp(buf).metadata();
  const W = meta.width ?? 1, H = meta.height ?? 1;
  const width = Math.max(8, Math.round(W * frac)), height = Math.max(8, Math.round(H * frac));
  const left = Math.round((W - width) / 2);
  const top = Math.max(0, Math.min(H - height, Math.round(H * 0.45 - height / 2)));
  const up = Math.max(1, 600 / Math.min(width, height));
  const out = await sharp(buf)
    .extract({ left, top, width, height })
    .resize({ width: Math.round(width * up), height: Math.round(height * up) })
    .jpeg({ quality: 92 })
    .toBuffer({ resolveWithObject: true });
  return { buf: out.data, width: out.info.width, height: out.info.height, hash: sha(out.data) };
}

/**
 * Local skin-tone sample. Same region and method for every image, so baseline-vs-render drift is
 * apples-to-apples. Samples a central cheek/forehead band, trims luminance outliers
 * (shadows, specular highlights, hair, lips) and averages the rest in LAB.
 */
export async function sampleFaceLab(buf: Buffer): Promise<{ lab: LAB; hex: string }> {
  const meta = await sharp(buf).metadata();
  const W = meta.width ?? 1, H = meta.height ?? 1;
  const left = Math.round(W * 0.34), top = Math.round(H * 0.3);
  const width = Math.max(8, Math.round(W * 0.32)), height = Math.max(8, Math.round(H * 0.3));
  const { data, info } = await sharp(buf)
    .extract({ left, top, width: Math.min(width, W - left), height: Math.min(height, H - top) })
    .resize(24, 24, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const px: { rgb: [number, number, number]; y: number }[] = [];
  for (let i = 0; i < info.width * info.height; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    px.push({ rgb: [r, g, b], y: 0.2126 * r + 0.7152 * g + 0.0722 * b });
  }
  px.sort((a, b) => a.y - b.y);
  const kept = px.slice(Math.floor(px.length * 0.15), Math.ceil(px.length * 0.85));
  const mean = [0, 1, 2].map((c) => kept.reduce((s, p) => s + p.rgb[c], 0) / kept.length) as [number, number, number];
  return { lab: rgbToLab(mean), hex: rgbToHex(mean) };
}

/**
 * A smaller copy of a render for showing in the browser. YouCam returns ~550 KB JPEGs (near q100) and a results
 * page shows five of them; analysis and tone sampling still use the original bytes, only the saved copy shrinks.
 */
export async function displayJpeg(buf: Buffer): Promise<Buffer> {
  return sharp(buf)
    .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

export async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

/** Demo-mode "render": softens and evens the central face region, scaled by total intensity. */
export async function mockRender(base: Buffer, strength: number, lift = 0): Promise<Buffer> {
  const meta = await sharp(base).metadata();
  const W = meta.width ?? 800, H = meta.height ?? 1000;
  const alpha = Math.min(0.85, 0.25 + strength * 0.75);
  const mask = Buffer.from(
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs><radialGradient id="g" cx="50%" cy="48%" r="40%">
        <stop offset="0%" stop-color="#fff" stop-opacity="${alpha}"/>
        <stop offset="70%" stop-color="#fff" stop-opacity="${alpha * 0.8}"/>
        <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
      </radialGradient></defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
    </svg>`,
  );
  const soft = await sharp(base)
    .blur(1 + strength * 3)
    .modulate({ brightness: 1.02 + strength * 0.05 + lift, saturation: 0.96 })
    .toBuffer();
  const maskedSoft = await sharp(soft)
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
  return sharp(base).composite([{ input: maskedSoft }]).jpeg({ quality: 90 }).toBuffer();
}
