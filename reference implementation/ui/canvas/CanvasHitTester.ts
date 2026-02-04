/**
 * Coordinate transformation for Canvas hit testing
 *
 * Handles conversion between:
 * - Screen space (CSS pixels from mouse/touch events)
 * - Grid space (step/pitch coordinates)
 *
 * COORDINATE SPACES:
 * - Screen: CSS pixels, origin at top-left of Canvas
 * - Grid: Step (0-127) and Pitch (0-59), where pitch 0 = bottom row (lowest note)
 *
 * IMPORTANT: Works in CSS pixels, not Canvas backing store pixels.
 * Mouse events provide clientX/clientY in CSS pixels, which matches
 * our cell dimensions from GridConfig.
 */

/**
 * Canvas hit tester for coordinate transforms
 */
export class CanvasHitTester {
  private zoomLevel: number = 1.0;

  constructor(
    private cellWidth: number,
    private cellHeight: number,
    private gridGap: number,
    private totalSteps: number,
    private totalRows: number
  ) {}

  /**
   * Update zoom level for coordinate calculations
   * Call this whenever zoom changes to keep hit testing accurate
   *
   * @param zoom New zoom level (e.g., 1.0 = 100%, 2.0 = 200%, 0.5 = 50%)
   */
  setZoom(zoom: number): void {
    this.zoomLevel = zoom;
  }

  /**
   * Get current zoom level
   *
   * @returns Current zoom level
   */
  getZoom(): number {
    return this.zoomLevel;
  }

  /**
   * Convert screen coordinates to grid coordinates
   *
   * Accounts for zoom by dividing screen coords to get base coords.
   * Canvas CSS size is scaled by zoom, so screen coordinates are in zoomed space.
   *
   * Accounts for:
   * - Zoom level (divides screen coords first)
   * - Cell dimensions with gaps
   * - Pitch inversion (screen top = high pitch, grid top = high pitch index)
   * - Gap detection (returns null if click lands in gap)
   *
   * @param screenX X coordinate in CSS pixels (relative to Canvas origin)
   * @param screenY Y coordinate in CSS pixels (relative to Canvas origin)
   * @returns Grid coordinates {step, pitch} or null if outside grid/in gap
   *
   * @example
   * const hit = hitTester.screenToGrid(100, 200);
   * if (hit) {
   *   console.log(`Clicked step ${hit.step}, pitch ${hit.pitch}`);
   * }
   */
  screenToGrid(screenX: number, screenY: number): { step: number; pitch: number } | null {
    // Canvas CSS size is scaled by zoom, so screen coordinates are in zoomed space
    // Divide by zoom to get base coordinates first
    const baseX = screenX / this.zoomLevel;
    const baseY = screenY / this.zoomLevel;

    // Now convert base coordinates to grid using base cell dimensions
    const cellPlusGap = this.cellWidth + this.gridGap;
    const stepExact = baseX / cellPlusGap;
    const step = Math.floor(stepExact);

    // Check if click landed in horizontal gap (between columns)
    const xInCell = baseX - step * cellPlusGap;
    if (xInCell >= this.cellWidth) {
      return null; // Click in gap
    }

    // Calculate which cell row (visual row) was clicked
    const rowPlusGap = this.cellHeight + this.gridGap;
    const rowExact = baseY / rowPlusGap;
    const visualRow = Math.floor(rowExact);

    // Check if click landed in vertical gap (between rows)
    const yInCell = baseY - visualRow * rowPlusGap;
    if (yInCell >= this.cellHeight) {
      return null; // Click in gap
    }

    // Convert visual row to pitch (invert Y axis)
    // Visual row 0 (top) = highest pitch (totalRows - 1)
    // Visual row N (bottom) = lowest pitch (0)
    const pitch = this.totalRows - 1 - visualRow;

    // Validate bounds
    if (!this.isValidGridPosition(step, pitch)) {
      return null;
    }

    return { step, pitch };
  }

  /**
   * Convert grid coordinates to screen pixel position
   *
   * Returns base coordinates (renderer applies zoom transform).
   * The top-left corner of the cell in CSS pixels at 1× zoom.
   * Accounts for cell dimensions and gaps.
   *
   * @param step Step index (0 to totalSteps-1)
   * @param pitch Pitch index (0 to totalRows-1, where 0 = bottom row)
   * @returns Base coordinates {x, y} in CSS pixels (no zoom scaling)
   *
   * @example
   * const pos = hitTester.gridToScreen(4, 10);
   * ctx.fillRect(pos.x, pos.y, cellWidth, cellHeight);
   */
  gridToScreen(step: number, pitch: number): { x: number; y: number } {
    // Calculate X position (simple multiplication)
    const x = step * (this.cellWidth + this.gridGap);

    // Convert pitch to visual row (invert Y axis)
    // Pitch 0 (bottom) = visual row (totalRows - 1)
    // Pitch N (top) = visual row (totalRows - 1 - N)
    const visualRow = this.totalRows - 1 - pitch;

    // Calculate Y position
    const y = visualRow * (this.cellHeight + this.gridGap);

    return { x, y };
  }

  /**
   * Check if grid coordinates are within valid bounds
   *
   * @param step Step index to validate
   * @param pitch Pitch index to validate
   * @returns True if coordinates are valid
   */
  isValidGridPosition(step: number, pitch: number): boolean {
    return step >= 0 && step < this.totalSteps && pitch >= 0 && pitch < this.totalRows;
  }

  /**
   * Get cell dimensions (for rendering)
   *
   * @returns Object with cell dimensions
   */
  getCellDimensions(): { width: number; height: number; gap: number } {
    return {
      width: this.cellWidth,
      height: this.cellHeight,
      gap: this.gridGap,
    };
  }

  /**
   * Calculate total grid dimensions in pixels
   *
   * Returns base dimensions (no zoom scaling).
   * Caller should multiply by zoom level if needed.
   *
   * @returns Total width and height in CSS pixels at 1× zoom
   */
  getTotalDimensions(): { width: number; height: number } {
    const width = this.totalSteps * this.cellWidth + (this.totalSteps - 1) * this.gridGap;
    const height = this.totalRows * this.cellHeight + (this.totalRows - 1) * this.gridGap;
    return { width, height };
  }
}
