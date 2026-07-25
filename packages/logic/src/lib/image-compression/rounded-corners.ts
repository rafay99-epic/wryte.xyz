/**
 * Masks a canvas to a rounded rectangle in-place. Returns the same canvas
 * with transparent pixels outside the corner radius.
 *
 * Uses `Path2D.roundRect()` when available (Safari ≥16, Chrome ≥99,
 * Firefox ≥113) and falls back to a quadratic-curve approximation for older
 * targets, mirroring ImageComposer's original implementation. Caller is
 * responsible for forcing PNG output downstream to preserve transparency.
 */
export function applyRoundedCornerMask(
  canvas: OffscreenCanvas,
  radius: number,
): OffscreenCanvas {
  if (radius <= 0) return canvas;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const w = canvas.width;
  const h = canvas.height;
  // Clamp so the radius can't exceed half of the shorter side.
  const r = Math.min(radius, Math.floor(Math.min(w, h) / 2));

  // `putImageData` ignores clip paths, so stash the current pixels onto a
  // temp canvas, clear the destination, set up the clip, then `drawImage`
  // back through it.
  const tmp = new OffscreenCanvas(w, h);
  const tmpCtx = tmp.getContext("2d");
  if (!tmpCtx) return canvas;
  tmpCtx.drawImage(canvas, 0, 0);

  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(0, 0, w, h, r);
  } else {
    ctx.moveTo(r, 0);
    ctx.lineTo(w - r, 0);
    ctx.quadraticCurveTo(w, 0, w, r);
    ctx.lineTo(w, h - r);
    ctx.quadraticCurveTo(w, h, w - r, h);
    ctx.lineTo(r, h);
    ctx.quadraticCurveTo(0, h, 0, h - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
  }
  ctx.clip();
  ctx.drawImage(tmp, 0, 0);
  ctx.restore();
  return canvas;
}
