import { isNoteInScale, type ScaleDefinition } from '../music/Scale';

/**
 * Scale overlay component
 *
 * Renders translucent horizontal bars over out-of-scale rows using CSS positioning.
 * Compatible with both DOM grid and Canvas grid implementations.
 *
 * Positioning strategy:
 * - Uses position: absolute with calculated top offset
 * - Top position = visualRow × (rowHeight + rowGap)
 * - Spans full container width (no hardcoded grid assumptions)
 * - Bars block pointer events, preventing interaction with disabled rows
 */
export class ScaleOverlay {
  private container: HTMLElement;
  private baseMidiNote: number;
  private rowHeight: number;
  private rowGap: number;
  private numRows: number;
  private zoomLevel: number = 1.0;

  /** Current scale settings */
  private rootNote: number = 0;
  private scale: ScaleDefinition | null = null;

  /** Overlay bars (one per row) */
  private overlayElement: HTMLElement | null = null;
  private bars: Map<number, HTMLElement> = new Map();

  /**
   * Create scale overlay
   * @param container Parent container element
   * @param baseMidiNote Base MIDI note (e.g., 60 for C4)
   * @param numRows Number of rows (12 for one octave)
   * @param rowHeight Height of each row in pixels
   * @param rowGap Gap between rows in pixels
   */
  constructor(
    container: HTMLElement,
    baseMidiNote: number,
    numRows: number,
    rowHeight: number,
    rowGap: number
  ) {
    this.container = container;
    this.baseMidiNote = baseMidiNote;
    this.numRows = numRows;
    this.rowHeight = rowHeight;
    this.rowGap = rowGap;
  }

  /**
   * Set scale for filtering
   * @param rootNote Root note (0-11)
   * @param scale Scale definition
   */
  setScale(rootNote: number, scale: ScaleDefinition): void {
    this.rootNote = rootNote;
    this.scale = scale;
    this.update();
  }

  /**
   * Update scale overlay to match zoom level
   *
   * Scales bar heights and positions so they align with grid rows at any zoom level.
   * Call this whenever the grid zoom changes.
   *
   * @param zoom New zoom level (0.5× to 4×)
   */
  updateScale(zoom: number): void {
    this.zoomLevel = zoom;

    // Calculate scaled dimensions
    const scaledHeight = this.rowHeight * zoom;
    const scaledGap = this.rowGap * zoom;

    // Update all bars
    this.bars.forEach((bar, pitch) => {
      const visualRow = (this.numRows - 1) - pitch;
      const top = visualRow * (scaledHeight + scaledGap);

      bar.style.top = `${top}px`;
      bar.style.height = `${scaledHeight}px`;
    });
  }

  /**
   * Render the overlay
   */
  render(): void {
    // Create overlay container
    this.overlayElement = document.createElement('div');
    this.overlayElement.className = 'scale-overlay';

    // Create bars for each row (from top to bottom, highest to lowest pitch)
    for (let pitch = this.numRows - 1; pitch >= 0; pitch--) {
      const bar = this.createBar(pitch);
      this.bars.set(pitch, bar);
      this.overlayElement.appendChild(bar);
    }

    this.container.appendChild(this.overlayElement);

    // Apply initial zoom scale
    this.updateScale(this.zoomLevel);

    this.update();
  }

  /**
   * Create a horizontal bar for a specific pitch row
   * @param pitch Pitch offset (0-11 for one octave, 0-23 for two octaves, etc.)
   * @returns Bar element
   */
  private createBar(pitch: number): HTMLElement {
    const bar = document.createElement('div');
    bar.className = 'scale-overlay-bar';
    bar.dataset.pitch = pitch.toString();

    // Calculate position (visual row is inverted)
    const visualRow = (this.numRows - 1) - pitch;
    const top = visualRow * (this.rowHeight + this.rowGap);

    bar.style.position = 'absolute';
    bar.style.left = '0';
    bar.style.width = '100%';
    bar.style.top = `${top}px`;
    bar.style.height = `${this.rowHeight}px`;

    return bar;
  }

  /**
   * Update bar visibility based on current scale
   */
  private update(): void {
    if (!this.scale) {
      // No scale set - hide all bars
      this.bars.forEach(bar => {
        bar.classList.remove('visible');
      });
      return;
    }

    // Show bars for out-of-scale rows, hide for in-scale rows
    this.bars.forEach((bar, pitch) => {
      const midiNote = this.baseMidiNote + pitch;
      const inScale = isNoteInScale(midiNote, this.rootNote, this.scale!);

      if (inScale) {
        bar.classList.remove('visible');
      } else {
        bar.classList.add('visible');
      }
    });
  }

  /**
   * Clean up
   */
  destroy(): void {
    if (this.overlayElement) {
      this.overlayElement.remove();
    }
    this.bars.clear();
    this.overlayElement = null;
  }
}
