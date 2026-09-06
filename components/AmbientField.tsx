"use client";

import { useEffect, useRef } from "react";

/**
 * The site's background field — a fixed, non-interactive layer that sits
 * behind every page's <main>. Rendered once from app/layout.tsx.
 *
 * Why a component and not just CSS: the cursor-tracked bloom needs pointer
 * position, and .bg-dopamine is applied to five different <main> elements, so
 * a pseudo-element would have to be duplicated and each one would only know
 * about its own page. One fixed layer in the layout owns the whole field.
 *
 * Everything except the cursor bloom is pure CSS (see app/globals.css), so
 * with JavaScript disabled, on touch devices, and during hydration the field
 * still renders complete — the cursor layer only ever *adds* to it.
 */
export function AmbientField() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // No cursor, no cursor-tracking. Touch devices get the static composition,
    // which is designed to stand on its own — and this also keeps a
    // full-viewport gradient repaint off phone GPUs entirely.
    if (!window.matchMedia("(pointer: fine)").matches) return;

    const el = ref.current;
    if (!el) return;

    let frame = 0;
    let x = 0;
    let y = 0;

    function apply() {
      frame = 0;
      const node = ref.current;
      if (!node) return;
      // Percentages rather than px so the gradient position survives a resize
      // between pointer events without a listener on resize.
      node.style.setProperty("--mx", `${(x / window.innerWidth) * 100}%`);
      node.style.setProperty("--my", `${(y / window.innerHeight) * 100}%`);
      node.style.setProperty("--m-opacity", "1");
    }

    function onMove(e: PointerEvent) {
      x = e.clientX;
      y = e.clientY;
      // Coalesce to one write per frame. pointermove fires far faster than the
      // compositor can paint a viewport-sized radial gradient.
      if (!frame) frame = requestAnimationFrame(apply);
    }

    function onLeave() {
      ref.current?.style.setProperty("--m-opacity", "0");
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div className="ambient" aria-hidden="true" ref={ref}>
      <div className="ambient__wash" />
      <div className="ambient__cursor" />
      <div className="ambient__grain" />
      <div className="ambient__vignette" />
    </div>
  );
}
