"use client";

import { ImageOff, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

/** One in-memory copy per photo, shared by every component that shows it. Cleared on delete / start over. */
const cache = new Map<string, Promise<string>>();

function loadPhoto(src: string, force: boolean): Promise<string> {
  if (force) cache.delete(src);
  let p = cache.get(src);
  if (!p) {
    p = fetch(src, { cache: "no-store" }).then(async (r) => {
      if (!r.ok) throw new Error(String(r.status));
      return URL.createObjectURL(await r.blob());
    });
    p.catch(() => cache.delete(src)); // a failure must not be cached, so "Try again" really retries
    cache.set(src, p);
  }
  return p;
}

/**
 * Warm the cache for a set of photos so the results screen opens with every image already there.
 * Never blocks longer than `timeoutMs`, and never rejects: a missing photo just falls back to the placeholder.
 */
export function preloadPhotos(urls: string[], timeoutMs = 6000): Promise<void> {
  const all = Promise.allSettled([...new Set(urls)].map((u) => loadPhoto(u, false))).then(() => undefined);
  return Promise.race([all, new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))]);
}

/** Drop every cached photo from browser memory (called on "Delete my photos" and "Start over"). */
export function clearSessionImages() {
  cache.forEach((p) => p.then((u) => URL.revokeObjectURL(u)).catch(() => {}));
  cache.clear();
}

/**
 * Shows a session photo robustly.
 *
 * Session photos are served with `no-store` (privacy), so a plain <img> has to re-download whenever the browser
 * evicts it, and shows a broken-image icon if the dev server restarted or the photo expired. Here the image is
 * fetched once into memory (an object URL) so it survives that, and a real failure gets a clear placeholder with
 * a retry instead of a broken icon.
 */
export function SessionImage({
  src,
  alt,
  className,
  fill = false,
  draggable,
}: {
  src: string;
  alt: string;
  className?: string;
  /** the image is absolutely positioned over its parent (so the placeholder must be too) */
  fill?: boolean;
  draggable?: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setUrl(null);
    setFailed(false);
    loadPhoto(src, attempt > 0)
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [src, attempt]);

  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={alt} className={className} draggable={draggable} />;
  }

  const box = fill ? "absolute inset-0" : "h-full w-full";
  if (failed) {
    return (
      <div className={`${box} grid place-items-center bg-panel-2 p-4 text-center`} role="img" aria-label={`${alt}: not available`}>
        <div>
          <ImageOff className="mx-auto h-6 w-6 text-fog" />
          <p className="mt-2 text-xs leading-relaxed text-fog">Photo not available. It may have expired (photos are deleted after an hour) or the server restarted.</p>
          <button onPointerDown={(e) => e.stopPropagation()} onClick={() => setAttempt((n) => n + 1)} className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1.5 text-xs text-mist transition-colors hover:bg-white/[0.06]">
            <RotateCcw className="h-3 w-3" /> Try again
          </button>
        </div>
      </div>
    );
  }
  return <div className={`${box} animate-pulse bg-white/[0.04]`} aria-hidden />;
}
