import type { NoteBarViewModel } from '../types';

/**
 * Canvas rendering operations for grid and notes
 *
 * RENDERING STRATEGY:
 * Grid uses line-based approach instead of cell rectangles:
 * - 60 horizontal lines + 128 vertical lines = 188 draw calls
 * - vs 7,680 cell rectangles (128 steps × 60 rows)
 * - Variable line thickness provides visual hierarchy
 *   - Thick lines for octaves and bar boundaries
 *   - Thin lines for individual steps
 *
 * This approach is much more efficient and provides clearer visual structure.
 *
 * COORDINATE SYSTEM:
 * All operations work in CSS pixels (not Canvas backing store pixels).
 * CanvasSetup handles DPI scaling via ctx.scale(dpr, dpr), so we can
 * draw as if devicePixelRatio = 1.
 */

/**
 * Canvas renderer for grid and note visualization
 */
export class CanvasRenderer {
  private zoomLevel: number = 1.0;

  constructor(
    private ctx: CanvasRenderingContext2D,
    private _cellWidth: number,
    private _cellHeight: number,
    private _gridGap: number
  ) {}

  /**
   * Set zoom level for rendering
   * Applies transform matrix on next render call
   *
   * @param zoom New zoom level (e.g., 1.0 = 100%, 2.0 = 200%, 0.5 = 50%)
   */
  setZoom(zoom: number): void {
    this.zoomLevel = zoom;
  }

  /**
   * Clear entire Canvas
   *
   * Call this before each frame to start with clean slate.
   */
  clear(): void {
    const canvas = this.ctx.canvas;
    // clearRect needs CSS pixel dimensions (context is scaled by DPI)
    // canvas.width/height are backing store size (CSS * DPI), so divide by DPI
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = canvas.width / dpr;
    const cssHeight = canvas.height / dpr;

    // Reset transform before clearing (clearRect uses current transform)
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, cssWidth, cssHeight);
  }

  /**
   * Render grid lines (line-based approach)
   *
   * Draws 60 horizontal + 128 vertical lines = 188 lines total
   * Much more efficient than 7,680 cell rectangles.
   *
   * Line thickness hierarchy:
   * - Thick lines for octaves (every 12 rows) and bars (every 16 steps)
   * - Thin lines for individual steps/rows
   *
   * @param visibleSteps Number of steps visible in viewport
   * @param visibleRows Number of rows visible in viewport
   */
  renderGrid(visibleSteps: number, visibleRows: number): void {
    // Apply combined DPR and zoom transformation using setTransform (absolute, non-cumulative)
    // Matrix format: setTransform(scaleX, skewX, skewY, scaleY, translateX, translateY)
    // setTransform replaces any existing transform, so we must include DPR scaling
    const dpr = window.devicePixelRatio || 1;
    const scale = dpr * this.zoomLevel;
    this.ctx.setTransform(scale, 0, 0, scale, 0, 0);

    // Draw using BASE dimensions (transform handles scaling)
    const canvas = this.ctx.canvas;
    const gridWidth = visibleSteps * (this._cellWidth + this._gridGap);
    const gridHeight = visibleRows * (this._cellHeight + this._gridGap);

    // Horizontal lines (rows)
    for (let row = 0; row <= visibleRows; row++) {
      const y = row * (this._cellHeight + this._gridGap);

      // Determine line thickness based on musical significance
      let lineWidth: number;
      let strokeStyle: string;

      // Octave boundaries (every 12 semitones) - thick line
      if (row % 12 === 0) {
        lineWidth = 2;
        strokeStyle = 'rgba(255, 255, 255, 0.4)';
      }
      // Regular semitone lines - thin
      else {
        lineWidth = 1;
        strokeStyle = 'rgba(255, 255, 255, 0.15)';
      }

      this.ctx.strokeStyle = strokeStyle;
      this.ctx.lineWidth = lineWidth;
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(gridWidth, y);
      this.ctx.stroke();
    }

    // Vertical lines (steps)
    for (let step = 0; step <= visibleSteps; step++) {
      const x = step * (this._cellWidth + this._gridGap);

      // Determine line thickness based on musical significance
      let lineWidth: number;
      let strokeStyle: string;

      // Bar boundaries (every 16 steps) - thick line
      if (step % 16 === 0) {
        lineWidth = 2;
        strokeStyle = 'rgba(255, 255, 255, 0.4)';
      }
      // Beat boundaries (every 4 steps) - medium line
      else if (step % 4 === 0) {
        lineWidth = 1.5;
        strokeStyle = 'rgba(255, 255, 255, 0.25)';
      }
      // Regular step lines - thin
      else {
        lineWidth = 1;
        strokeStyle = 'rgba(255, 255, 255, 0.15)';
      }

      this.ctx.strokeStyle = strokeStyle;
      this.ctx.lineWidth = lineWidth;
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, gridHeight);
      this.ctx.stroke();
    }
  }

  /**
   * Render note bars
   *
   * Draws filled rectangles for each note in the sequence.
   * Position and size come from NoteBarViewModel (calculated elsewhere).
   *
   * Visual parity with DOM notes:
   * - Blue fill: rgba(100, 150, 255, 0.8)
   * - White border: rgba(255, 255, 255, 0.3)
   * - Duration handle: Darker blue, 8px wide on right edge
   *
   * @param notes Array of note view models to render
   */
  renderNotes(notes: NoteBarViewModel[]): void {
    // Apply combined DPR and zoom transformation (same as renderGrid)
    const dpr = window.devicePixelRatio || 1;
    const scale = dpr * this.zoomLevel;
    this.ctx.setTransform(scale, 0, 0, scale, 0, 0);

    const handleWidth = 8; // Base pixels, transform will scale

    notes.forEach(note => {
      // Note coordinates are BASE coords from hitTester.gridToScreen()
      // Draw directly with these coordinates (transform handles zoom)
      // Note bar background
      this.ctx.fillStyle = 'rgba(100, 150, 255, 0.8)'; // Blue, matching DOM notes
      this.ctx.fillRect(
        note.left,
        note.top,
        note.width,
        note.height
      );

      // Note bar border
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(
        note.left,
        note.top,
        note.width,
        note.height
      );

      // Duration handle (right edge, highly visible with grip pattern)
      // Background: Light gray/white for contrast
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      this.ctx.fillRect(
        note.left + note.width - handleWidth,
        note.top,
        handleWidth,
        note.height
      );

      // Grip pattern: Three vertical lines to indicate draggability
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      this.ctx.lineWidth = 1;
      const handleX = note.left + note.width - handleWidth;
      const gripSpacing = 2;
      for (let i = 0; i < 3; i++) {
        const x = handleX + 2 + i * gripSpacing;
        this.ctx.beginPath();
        this.ctx.moveTo(x, note.top + 2);
        this.ctx.lineTo(x, note.top + note.height - 2);
        this.ctx.stroke();
      }
    });
  }

  /**
   * Get rendering context for advanced operations
   *
   * Exposes the underlying context for rendering operations
   * not covered by this class (overlays, indicators, etc.)
   *
   * @returns 2D rendering context
   */
  getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }
}
