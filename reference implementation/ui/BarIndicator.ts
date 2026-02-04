import { TOTAL_STEPS } from '../config/GridConfig';

/**
 * Bar indicator showing bar numbers (1-8) above grid
 *
 * Displays bar numbers aligned with 16-step bars in the grid.
 * Position: sticky top, scrolls horizontally with grid but stays fixed at top.
 * Scales with zoom to maintain alignment.
 *
 * Layout:
 * ```
 * [ 1      |  2      |  3      |  4      |  5      |  6      |  7      |  8      ]
 * ```
 *
 * Each bar spans 16 steps (1 bar in 4/4 time at 16th note resolution).
 * Full grid: 128 steps = 8 bars.
 */
export class BarIndicator {
  private container: HTMLElement;
  private barNumbers: HTMLElement[] = [];
  private cellWidth: number;
  private gridGap: number;
  private zoomLevel: number = 1.0;

  /** Steps per bar (16 steps = 1 bar in 4/4 time) */
  private readonly stepsPerBar: number = 16;

  /** Number of bars in full grid (128 steps / 16 = 8 bars) */
  private readonly totalBars: number;

  /**
   * Create bar indicator
   * @param container Container element (should have position: sticky in CSS)
   * @param cellWidth Base cell width in pixels (from GridConfig)
   * @param gridGap Gap between cells in pixels (from GridConfig)
   */
  constructor(
    container: HTMLElement,
    cellWidth: number,
    gridGap: number
  ) {
    this.container = container;
    this.cellWidth = cellWidth;
    this.gridGap = gridGap;
    this.totalBars = TOTAL_STEPS / this.stepsPerBar;

    this.render();
  }

  /**
   * Render bar number labels
   *
   * Creates labels for bars 1-8, positioned at 16-step intervals.
   * Initial positions are at 1× zoom; updateScale() will adjust for zoom.
   */
  private render(): void {
    // Clear existing content
    this.container.innerHTML = '';
    this.barNumbers = [];

    // Create bar number labels (1-8)
    for (let bar = 0; bar < this.totalBars; bar++) {
      const barNum = bar + 1; // 1-indexed for display
      const label = document.createElement('div');
      label.className = 'bar-number';
      label.textContent = barNum.toString();

      // Position at start of each bar (bar * 16 steps)
      const step = bar * this.stepsPerBar;
      const left = step * (this.cellWidth + this.gridGap);
      label.style.left = `${left}px`;

      // Width spans 16 steps
      const width = this.stepsPerBar * (this.cellWidth + this.gridGap);
      label.style.width = `${width}px`;

      this.container.appendChild(label);
      this.barNumbers.push(label);
    }

    // Apply initial scale (1× zoom by default)
    this.updateScale(this.zoomLevel);
  }

  /**
   * Update bar indicator scale to match zoom level
   *
   * Scales bar widths and positions so they align with 16-step bars at any zoom level.
   * Call this whenever the grid zoom changes.
   *
   * @param zoom New zoom level (0.5× to 4×)
   */
  updateScale(zoom: number): void {
    this.zoomLevel = zoom;

    // Calculate scaled dimensions
    const scaledCellWidth = this.cellWidth * zoom;
    const scaledGap = this.gridGap * zoom;

    // Update all bar number labels
    this.barNumbers.forEach((label, index) => {
      const step = index * this.stepsPerBar;
      const left = step * (scaledCellWidth + scaledGap);
      const width = this.stepsPerBar * (scaledCellWidth + scaledGap);

      label.style.left = `${left}px`;
      label.style.width = `${width}px`;
    });
  }

  /**
   * Clean up
   * Removes all bar number labels from DOM.
   */
  destroy(): void {
    this.container.innerHTML = '';
    this.barNumbers = [];
  }
}
