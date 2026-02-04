/**
 * Canvas setup utilities for high-DPI display support
 *
 * High-DPI displays (Retina, 4K, etc.) have higher pixel density than standard displays.
 * Without proper scaling, Canvas elements appear blurry on these displays.
 *
 * The devicePixelRatio tells us how many physical pixels correspond to one CSS pixel.
 * We need to:
 * 1. Scale the Canvas backing store (canvas.width/height) by devicePixelRatio
 * 2. Keep the CSS size (style.width/height) at the original logical size
 * 3. Apply ctx.scale() to make drawing operations work in CSS pixels
 *
 * This ensures crisp rendering on all displays while maintaining consistent coordinate system.
 */

/**
 * Configure Canvas for high-DPI displays
 *
 * This function:
 * - Reads the current CSS size from the Canvas element
 * - Scales the Canvas backing store by devicePixelRatio
 * - Applies context scaling so drawing operations work in CSS pixels
 *
 * @param canvas Canvas element to configure
 * @returns Configured 2D rendering context
 *
 * @example
 * const canvas = document.querySelector('canvas');
 * const ctx = setupCanvasForHDPI(canvas);
 * // Now draw in CSS pixel coordinates
 * ctx.fillRect(0, 0, 100, 100); // 100 CSS pixels, scaled internally
 */
export function setupCanvasForHDPI(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const dpr = window.devicePixelRatio || 1;

  // Get CSS size from style properties (already set by caller)
  // Don't use getBoundingClientRect() as it may return different size due to layout constraints
  const cssWidth = parseInt(canvas.style.width) || canvas.width;
  const cssHeight = parseInt(canvas.style.height) || canvas.height;

  // Set actual pixel dimensions (scaled for DPI)
  // This is the backing store size - more pixels = sharper rendering
  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;

  const ctx = canvas.getContext('2d')!;

  // Scale context so drawing operations work in CSS pixels
  // Without this, we'd have to multiply all coordinates by dpr
  ctx.scale(dpr, dpr);

  return ctx;
}

/**
 * Reset and reconfigure Canvas after resize
 *
 * When the Canvas element resizes (window resize, container resize),
 * the backing store is cleared. This function:
 * - Clears any existing content
 * - Re-runs high-DPI setup with new dimensions
 *
 * @param canvas Canvas element to reset
 * @returns Reconfigured 2D rendering context
 *
 * @example
 * window.addEventListener('resize', () => {
 *   const canvas = document.querySelector('canvas');
 *   const ctx = resetCanvasForResize(canvas);
 *   redrawEverything(ctx);
 * });
 */
export function resetCanvasForResize(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  // Clear existing content (backing store is reset during dimension change anyway)
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Re-run setup with new dimensions
  return setupCanvasForHDPI(canvas);
}
