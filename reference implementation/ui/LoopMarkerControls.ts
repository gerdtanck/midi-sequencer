import type { Sequence } from '../sequencer/Sequence';
import { MAX_STEP, GRID_GAP, ROWS, CELL_HEIGHT } from '../config/GridConfig';

/**
 * Draggable loop marker controls with visual highlight
 *
 * Provides interactive start/end markers that can be dragged to set loop boundaries.
 * Displays a visual highlight showing the active loop region.
 */
export class LoopMarkerControls {
  private container: HTMLElement;
  private sequence: Sequence;
  private gridStepWidth: number;
  private gridGap: number = GRID_GAP; // From GridConfig
  private zoomLevel: number = 1.0;

  /** Drag state tracking */
  private isDragging: boolean = false;
  private dragTarget: 'start' | 'end' | null = null;
  private dragStartStep: number | null = null; // Initial step value when drag started

  /** DOM elements */
  private highlightElement: HTMLDivElement | null = null;
  private startMarkerElement: HTMLDivElement | null = null;
  private endMarkerElement: HTMLDivElement | null = null;

  /** Event handlers (stored for cleanup) */
  private boundHandleMove: (e: MouseEvent | TouchEvent) => void;
  private boundHandleUp: () => void;
  private boundHandleSequenceChange: () => void;

  /**
   * Create loop marker controls
   * @param container Parent element to render markers into
   * @param sequence Sequence to control
   * @param gridStepWidth Width of one step in pixels
   */
  constructor(container: HTMLElement, sequence: Sequence, gridStepWidth: number) {
    this.container = container;
    this.sequence = sequence;
    this.gridStepWidth = gridStepWidth;

    // Bind event handlers for cleanup
    this.boundHandleMove = this.handleMove.bind(this);
    this.boundHandleUp = this.handleUp.bind(this);
    this.boundHandleSequenceChange = this.handleSequenceChange.bind(this);

    // Subscribe to sequence changes for automatic re-rendering
    this.sequence.onChange(this.boundHandleSequenceChange);

    this.render();
  }

  /**
   * Update zoom level and re-render markers
   * Call this when canvas zoom changes to keep markers aligned with grid
   * @param zoom New zoom level (e.g., 1.0 = 100%, 2.0 = 200%)
   */
  updateScale(zoom: number): void {
    this.zoomLevel = zoom;
    this.render();
  }

  /**
   * Handle sequence data changes
   * Automatically re-renders markers when loop boundaries change
   */
  private handleSequenceChange(): void {
    // Only re-render if not currently dragging (to avoid interfering with drag)
    if (!this.isDragging) {
      this.render();
    }
  }

  /**
   * Render loop markers and highlight
   * Updates visual state to match current sequence loop boundaries
   */
  render(): void {
    // Clear existing elements
    if (this.highlightElement) {
      this.highlightElement.remove();
    }
    if (this.startMarkerElement) {
      this.startMarkerElement.remove();
    }
    if (this.endMarkerElement) {
      this.endMarkerElement.remove();
    }

    const { start, end } = this.sequence.getLoopMarkers();

    // Calculate positions accounting for grid gap AND zoom
    const startPos = start * (this.gridStepWidth + this.gridGap) * this.zoomLevel;
    // End marker goes at the RIGHT edge of the end step
    const endPos = (end + 1) * (this.gridStepWidth + this.gridGap) * this.zoomLevel;
    const width = endPos - startPos;

    // Calculate full grid height (all rows with gaps) scaled by zoom
    const fullHeight = ROWS * (CELL_HEIGHT + GRID_GAP) * this.zoomLevel;

    // Create loop highlight
    this.highlightElement = document.createElement('div');
    this.highlightElement.className = 'loop-highlight';
    this.highlightElement.style.left = `${startPos}px`;
    this.highlightElement.style.width = `${width}px`;
    this.highlightElement.style.height = `${fullHeight}px`;
    this.container.appendChild(this.highlightElement);

    // Create start marker
    this.startMarkerElement = document.createElement('div');
    this.startMarkerElement.className = 'loop-marker loop-marker-start';
    this.startMarkerElement.style.left = `${startPos}px`;
    this.startMarkerElement.style.height = `${fullHeight}px`;
    this.startMarkerElement.dataset.type = 'start';
    this.startMarkerElement.addEventListener('mousedown', (e) => this.handleDown(e, 'start'));
    this.startMarkerElement.addEventListener('touchstart', (e) => this.handleDown(e, 'start'));
    this.container.appendChild(this.startMarkerElement);

    // Create end marker
    this.endMarkerElement = document.createElement('div');
    this.endMarkerElement.className = 'loop-marker loop-marker-end';
    this.endMarkerElement.style.left = `${endPos}px`;
    this.endMarkerElement.style.height = `${fullHeight}px`;
    this.endMarkerElement.dataset.type = 'end';
    this.endMarkerElement.addEventListener('mousedown', (e) => this.handleDown(e, 'end'));
    this.endMarkerElement.addEventListener('touchstart', (e) => this.handleDown(e, 'end'));
    this.container.appendChild(this.endMarkerElement);
  }

  /**
   * Handle marker drag start
   * @param e Mouse or touch event
   * @param target Which marker was grabbed ('start' or 'end')
   */
  private handleDown(e: MouseEvent | TouchEvent, target: 'start' | 'end'): void {
    e.preventDefault();
    e.stopPropagation(); // Prevent canvas pan/drag from triggering
    this.isDragging = true;
    this.dragTarget = target;

    // Calculate initial step from actual mouse position to avoid snap
    // (End marker is positioned at right edge, so mouse might be at end+1)
    const rect = this.container.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const relativeX = clientX - rect.left;
    this.dragStartStep = Math.round(relativeX / ((this.gridStepWidth + this.gridGap) * this.zoomLevel));

    // Add document-level listeners for drag
    document.addEventListener('mousemove', this.boundHandleMove);
    document.addEventListener('touchmove', this.boundHandleMove);
    document.addEventListener('mouseup', this.boundHandleUp);
    document.addEventListener('touchend', this.boundHandleUp);
  }

  /**
   * Handle marker drag move
   * @param e Mouse or touch event
   */
  private handleMove(e: MouseEvent | TouchEvent): void {
    if (!this.isDragging || !this.dragTarget) {
      return;
    }

    e.preventDefault();

    // Get container bounds for coordinate conversion
    const rect = this.container.getBoundingClientRect();

    // Extract clientX from mouse or touch event
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;

    // Calculate step from position, accounting for grid gap and zoom
    const relativeX = clientX - rect.left;
    const step = Math.round(relativeX / ((this.gridStepWidth + this.gridGap) * this.zoomLevel));

    // Only update if step changed from initial value (prevents snap on mousedown)
    if (step !== this.dragStartStep) {
      this.updateMarker(step);
    }
  }

  /**
   * Handle marker drag end
   */
  private handleUp(): void {
    this.isDragging = false;
    this.dragTarget = null;
    this.dragStartStep = null;

    // Remove document-level listeners
    document.removeEventListener('mousemove', this.boundHandleMove);
    document.removeEventListener('touchmove', this.boundHandleMove);
    document.removeEventListener('mouseup', this.boundHandleUp);
    document.removeEventListener('touchend', this.boundHandleUp);
  }

  /**
   * Update marker position based on drag
   * @param step Target step index (will be clamped to valid range)
   */
  private updateMarker(step: number): void {
    // Clamp step to valid range (0-MAX_STEP from config)
    const clampedStep = Math.max(0, Math.min(MAX_STEP, step));

    const currentMarkers = this.sequence.getLoopMarkers();

    if (this.dragTarget === 'start') {
      // Ensure start <= end
      const newStart = Math.min(clampedStep, currentMarkers.end);
      this.sequence.setLoopMarkers({
        start: newStart,
        end: currentMarkers.end
      });
    } else if (this.dragTarget === 'end') {
      // Ensure end >= start
      const newEnd = Math.max(clampedStep, currentMarkers.start);
      this.sequence.setLoopMarkers({
        start: currentMarkers.start,
        end: newEnd
      });
    }

    // Note: setLoopMarkers triggers onChange, which will call render()
    // But we suppress it during drag, so render manually after drag ends
    if (this.isDragging) {
      this.render(); // Immediate visual feedback during drag
    }
  }

  /**
   * Clean up event listeners and DOM elements
   * Call this when removing the controls
   */
  destroy(): void {
    // Remove event listeners
    this.handleUp(); // Cleanup any active drag

    // Unsubscribe from sequence changes
    this.sequence.offChange(this.boundHandleSequenceChange);

    // Remove DOM elements
    if (this.highlightElement) {
      this.highlightElement.remove();
    }
    if (this.startMarkerElement) {
      this.startMarkerElement.remove();
    }
    if (this.endMarkerElement) {
      this.endMarkerElement.remove();
    }
  }
}
