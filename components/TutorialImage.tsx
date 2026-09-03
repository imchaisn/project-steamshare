"use client";

import { useEffect, useRef, useState } from "react";

interface TutorialImageProps {
  /** Path under /public, e.g. "/tutorial/steam-login-screen.png" */
  src: string;
  /** Filename shown in the placeholder, e.g. "steam-login-screen.png" */
  filename: string;
  /** Caption shown under the image and inside the placeholder box */
  caption: string;
}

/**
 * Renders a real screenshot the instant a matching file exists at `src`
 * under public/tutorial/ — no code change needed to "activate" it.
 * Until then, shows a clearly-labeled placeholder (never a broken-image
 * icon, never a fabricated fake screenshot).
 */
export function TutorialImage({ src, filename, caption }: TutorialImageProps) {
  const [status, setStatus] = useState<"loading" | "ok" | "missing">("loading");
  const imgRef = useRef<HTMLImageElement>(null);

  // This page is server-rendered, so the <img> tag (with its real src)
  // exists in the HTML before React hydrates. A small local image often
  // finishes loading natively before React attaches the onLoad listener —
  // that load event fires and is silently missed, leaving the placeholder
  // stuck forever even though the image genuinely loaded. Checking
  // `.complete` on mount catches exactly that race.
  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete) {
      setStatus(img.naturalWidth > 0 ? "ok" : "missing");
    }
  }, []);

  return (
    <figure className="space-y-1.5">
      <div className="relative aspect-video w-full overflow-hidden rounded border border-dashed border-line-dim bg-surface-1">
        {status !== "ok" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 border border-dashed border-line-dim bg-surface-1 p-4 text-center">
            <span className="text-xs text-ink-dim">{caption}</span>
            <code className="rounded bg-surface-2 px-2 py-0.5 text-[11px] text-ink-dim">
              {filename}
            </code>
            <span className="text-[10px] uppercase tracking-wide text-ink-dim/60">
              screenshot pending
            </span>
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element -- intentional
            plain <img>: onLoad/onError feature-detects a public/ file that
            may be added post-deploy, which next/image's build-time
            optimizer can't do. */}
        <img
          ref={imgRef}
          src={src}
          alt={caption}
          className={`h-full w-full object-contain transition-opacity duration-200 ${
            status === "ok" ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => setStatus("ok")}
          onError={() => setStatus("missing")}
        />
      </div>
      <figcaption className="text-xs text-ink-dim">{caption}</figcaption>
    </figure>
  );
}
