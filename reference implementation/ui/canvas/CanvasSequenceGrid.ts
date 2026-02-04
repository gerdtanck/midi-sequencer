import type { Sequence } from '../../sequencer/Sequence';
import { setupCanvasForHDPI } from './CanvasSetup';
import { CanvasRenderer } from './CanvasRenderer';
import { CanvasHitTester } from './CanvasHitTester';
import { CanvasInteractionController } from './CanvasInteractionController';
import { BASE_MIDI, TOTAL_STEPS, TOTAL_ROWS, ROWS, STEPS, CELL_WIDTH, CELL_HEIGHT, GRID_GAP, MIN_ZOOM, MAX_ZOOM, DEFAULT_ZOOM } from '../../config/GridConfig';
import type { NoteBarViewModel } from '../types';

/**
 * Canvas-based sequence grid with observer pattern integration
 *
 * Manages Canvas rendering of grid and notes with automatic updates
 * when the underlying Sequence data changes.
 *
 * OBSERVER PATTERN:
 * - Subscribes to Sequence.onChange() for automatic re-rendering
 * - Uses requestAnimationFrame batching for 60fps performance
 * - Dirty flag prevents redundant renders
 *
 * VIEWPORT:
 * - Initial viewport: 32 steps × 24 rows (temporary, will expand)
 * - Full grid: 128 steps × 60 rows (TOTAL_STEPS × TOTAL_ROWS)
 * - Coordinates via CanvasHitTester (handles Y-axis inversion)
 *
 * ZOOM ARCHITECTURE:
 * - Manages zoom state (0.5× to 4×, default 1×)
 * - Propagates zoom to renderer (ctx.setTransform) and hit tester (coordinate conversion)
 * - Scales Canvas CSS size (style.width/height) while keeping backing store constant
 * - Scroll container grows/shrinks naturally with Canvas size
 */
export class CanvasSequenceGrid {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private renderer: CanvasRenderer;
  private hitTester: CanvasHitTester;
  private sequence: Sequence;
  private interactionController: CanvasInteractionController;
  private container: HTMLElement;
  private scrollContainer: HTMLElement;

  /** Zoom level (0.5× to 4×) */
  private zoomLevel: number = DEFAULT_ZOOM;

  /** Dirty flag for requestAnimationFrame batching */
  private isDirty: boolean = false;
  private renderScheduled: boolean = false;

  /** Change listener for cleanup */
  private boundHandleSequenceChange: () => void;

  /** Event handlers (bound for cleanup) */
  private boundHandlePointerDown: (e: MouseEvent | TouchEvent) => void;
  private boundHandlePointerMove: (e: MouseEvent | TouchEvent) => void;
  private boundHandlePointerUp: (e: MouseEvent | TouchEvent) => void;
  private boundHandleWheel: (e: WheelEvent) => void;

  /** Callback for zoom changes (to update fixed UI elements) */
  private onZoomChange?: (zoom: number) => void;

  /** Viewport dimensions (matches current visible grid from GridConfig) */
  private readonly viewportSteps: number = STEPS;
  private readonly viewportRows: number = ROWS;

  constructor(container: HTMLElement, sequence: Sequence, eventContainer?: HTMLElement, onZoomChange?: (zoom: number) => void) {
    // eventContainer = where to attach event listeners (should be parent that contains both canvas and scale overlay)
    // container = where to append canvas element
    this.container = eventContainer || container;
    this.sequence = sequence;
    this.onZoomChange = onZoomChange;

    // Create Canvas element
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'sequence-grid-canvas';

    // Set Canvas CSS size based on viewport
    const canvasWidth = this.viewportSteps * (CELL_WIDTH + GRID_GAP);
    const canvasHeight = this.viewportRows * (CELL_HEIGHT + GRID_GAP);
    this.canvas.style.width = `${canvasWidth}px`;
    this.canvas.style.height = `${canvasHeight}px`;

    // Append Canvas to container BEFORE setupCanvasForHDPI (getBoundingClientRect needs DOM)
    container.appendChild(this.canvas);

    // Initialize Canvas with high-DPI support
    this.ctx = setupCanvasForHDPI(this.canvas);

    // Create renderer
    this.renderer = new CanvasRenderer(this.ctx, CELL_WIDTH, CELL_HEIGHT, GRID_GAP);

    // Set initial zoom level on renderer
    this.renderer.setZoom(this.zoomLevel);

    // Create hit tester (uses viewport dimensions, not total grid)
    this.hitTester = new CanvasHitTester(
      CELL_WIDTH,
      CELL_HEIGHT,
      GRID_GAP,
      this.viewportSteps,  // 16 steps visible (not 128)
      this.viewportRows    // 15 rows visible (not 60)
    );

    // Set initial zoom level on hit tester
    this.hitTester.setZoom(this.zoomLevel);

    // Find scrollable container (parent with overflow)
    const scrollContainer = container.closest('#grid-with-piano') as HTMLElement || container;
    this.scrollContainer = scrollContainer; // Store as property for zoom anchoring

    // Create interaction controller
    this.interactionController = new CanvasInteractionController({
      sequence: this.sequence,
      hitTester: this.hitTester,
      baseMidiNote: BASE_MIDI,
      canvas: this.canvas,
      scrollContainer: scrollContainer,
      cellWidth: CELL_WIDTH,
      cellHeight: CELL_HEIGHT,
      gridGap: GRID_GAP,
      getZoom: () => this.getZoom(),
      applyZoomWithAnchor: (zoom, anchorX, anchorY) => this.applyZoomWithAnchor(zoom, anchorX, anchorY)
    });

    // Bind event handlers
    this.boundHandlePointerDown = this.interactionController.handlePointerDown.bind(this.interactionController);
    this.boundHandlePointerMove = this.interactionController.handlePointerMove.bind(this.interactionController);
    this.boundHandlePointerUp = this.interactionController.handlePointerUp.bind(this.interactionController);
    this.boundHandleWheel = this.handleWheel.bind(this);

    // Attach listeners to container to catch events from both Canvas and scale bars
    // This uses event delegation - events from canvas and scale bars bubble up to container
    this.container.addEventListener('mousedown', this.boundHandlePointerDown);
    this.container.addEventListener('touchstart', this.boundHandlePointerDown, { passive: false });
    this.container.addEventListener('wheel', this.boundHandleWheel, { passive: false });
    console.log('[CanvasSequenceGrid] Event listeners attached to container (delegation)');
    console.log('[CanvasSequenceGrid] Canvas style:', this.canvas.style.cssText);
    console.log('[CanvasSequenceGrid] Canvas dimensions:', this.canvas.width, 'x', this.canvas.height);
    console.log('[CanvasSequenceGrid] Canvas z-index:', window.getComputedStyle(this.canvas).zIndex);
    console.log('[CanvasSequenceGrid] Canvas pointer-events:', window.getComputedStyle(this.canvas).pointerEvents);

    // Attach global listeners (move/up events on document so drag works when pointer leaves Canvas)
    document.addEventListener('mousemove', this.boundHandlePointerMove);
    document.addEventListener('mouseup', this.boundHandlePointerUp);
    document.addEventListener('touchmove', this.boundHandlePointerMove, { passive: false });
    document.addEventListener('touchend', this.boundHandlePointerUp);

    // Bind and subscribe to sequence changes
    this.boundHandleSequenceChange = this.handleSequenceChange.bind(this);
    this.sequence.onChange(this.boundHandleSequenceChange);

    // Initial render
    this.render();
  }

  /**
   * Set zoom level and update Canvas size
   *
   * Clamps zoom to valid range (MIN_ZOOM to MAX_ZOOM).
   * Updates Canvas CSS size, propagates zoom to renderer and hit tester, triggers re-render.
   *
   * @param zoom New zoom level (e.g., 1.0 = 100%, 2.0 = 200%, 0.5 = 50%)
   */
  setZoom(zoom: number): void {
    // Clamp to valid range
    const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));

    if (clampedZoom === this.zoomLevel) {
      return; // No change
    }


    // Update zoom state
    this.zoomLevel = clampedZoom;

    // Update Canvas CSS size (scales visual size, not backing store)
    this.updateCanvasSize();

    // Propagate zoom to renderer
    this.renderer.setZoom(this.zoomLevel);

    // Propagate zoom to hit tester
    this.hitTester.setZoom(this.zoomLevel);

    // Trigger re-render
    this.render();

    // Notify manager of zoom change (for fixed UI elements)
    if (this.onZoomChange) {
      this.onZoomChange(this.zoomLevel);
    }
  }

  /**
   * Get current zoom level
   *
   * @returns Current zoom level (1.0 = 100%)
   */
  getZoom(): number {
    return this.zoomLevel;
  }

  /**
   * Handle mousewheel zoom
   *
   * Gesture differentiation:
   * - Plain wheel (no modifiers) = zoom
   * - Shift+wheel = scroll (default behavior)
   * - Ctrl+wheel = browser zoom (default behavior - not intercepted)
   *
   * @param e WheelEvent from container
   */
  private handleWheel(e: WheelEvent): void {
    // Allow browser zoom with Ctrl+wheel (don't intercept)
    if (e.ctrlKey) {
      return;
    }

    // Allow scrolling with Shift+wheel (don't intercept)
    if (e.shiftKey) {
      return;
    }

    // Plain wheel with no modifiers = zoom
    // Prevent default scroll behavior
    e.preventDefault();

    // Normalize wheel delta (deltaY positive = scroll down = zoom out)
    // Typical values: ±100 for mouse wheel, ±1-3 for trackpad
    // Convert to zoom multiplier: deltaY -100 → zoom in 1.025×, deltaY +100 → zoom out 0.975×
    const delta = -e.deltaY;
    const zoomSensitivity = 0.0005; // 0.05% per deltaY unit (1/4 of original 0.002)
    const zoomDelta = 1 + (delta * zoomSensitivity);

    // Calculate new zoom level
    const newZoom = this.zoomLevel * zoomDelta;

    // Get anchor point (mouse position relative to scroll container)
    // IMPORTANT: Must use scrollContainer, not container, because we use scrollContainer.scrollLeft/scrollTop
    const rect = this.scrollContainer.getBoundingClientRect();
    const anchorX = e.clientX - rect.left;
    const anchorY = e.clientY - rect.top;


    // Apply zoom with anchoring
    this.applyZoomWithAnchor(newZoom, anchorX, anchorY);
  }

  /**
   * Apply zoom with anchor point (keeps cursor over same content)
   *
   * Anchor point math:
   * 1. Calculate cursor position in content space (before zoom)
   * 2. Apply new zoom level
   * 3. Adjust scroll position to keep same content under cursor
   *
   * Formula breakdown:
   * - Content position: contentPos = (viewportPos + scrollPos) / currentZoom
   * - New scroll position: newScrollPos = contentPos * newZoom - viewportPos
   *
   * @param newZoom Target zoom level (will be clamped)
   * @param anchorX Mouse X relative to container (viewport space)
   * @param anchorY Mouse Y relative to container (viewport space)
   */
  private applyZoomWithAnchor(newZoom: number, anchorX: number, anchorY: number): void {
    // Clamp zoom to valid range
    const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));

    if (clampedZoom === this.zoomLevel) {
      return; // No change (already at limit or same value)
    }

    // Calculate cursor position in content space (before zoom)
    // Content space = unscaled grid coordinates
    // Formula: contentPos = (viewportPos + scrollPos) / currentZoom
    const contentX = (anchorX + this.scrollContainer.scrollLeft) / this.zoomLevel;
    const contentY = (anchorY + this.scrollContainer.scrollTop) / this.zoomLevel;

    // Apply new zoom (updates Canvas size, renderer, hit tester)
    this.setZoom(clampedZoom);

    // Adjust scroll position to keep same content under cursor
    // Formula: newScrollPos = contentPos * newZoom - viewportPos
    const newScrollLeft = contentX * this.zoomLevel - anchorX;
    const newScrollTop = contentY * this.zoomLevel - anchorY;

    this.scrollContainer.scrollLeft = newScrollLeft;
    this.scrollContainer.scrollTop = newScrollTop;
  }

  /**
   * Update Canvas CSS size and backing store based on zoom level
   *
   * Canvas has two sizes:
   * - CSS size (style.width/height) - determines layout size, scales with zoom
   * - Backing store size (canvas.width/height) - pixel buffer, scales with zoom * DPR
   *
   * Transform in renderer applies zoom scaling within the backing store.
   */
  private updateCanvasSize(): void {
    // Calculate base dimensions (1× zoom)
    const baseWidth = this.viewportSteps * (CELL_WIDTH + GRID_GAP);
    const baseHeight = this.viewportRows * (CELL_HEIGHT + GRID_GAP);

    // Scale CSS size by zoom
    const scaledWidth = baseWidth * this.zoomLevel;
    const scaledHeight = baseHeight * this.zoomLevel;

    // Update Canvas CSS size
    this.canvas.style.width = `${scaledWidth}px`;
    this.canvas.style.height = `${scaledHeight}px`;

    // Update backing store to match CSS size * DPR
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = scaledWidth * dpr;
    this.canvas.height = scaledHeight * dpr;

    // Don't apply transforms here - renderer will apply combined DPR * zoom transform
    // using setTransform() which sets absolute transform each frame
  }

  /**
   * Handle sequence data changes (observer pattern)
   * Marks Canvas as dirty and schedules re-render
   */
  private handleSequenceChange(): void {
    this.isDirty = true;

    // Schedule render if not already scheduled
    if (!this.renderScheduled) {
      this.renderScheduled = true;
      requestAnimationFrame(() => {
        if (this.isDirty) {
          this.render();
          this.isDirty = false;
        }
        this.renderScheduled = false;
      });
    }
  }

  /**
   * Build note view models from sequence data
   * Converts Sequence notes to Canvas-renderable format
   */
  private buildNoteViewModels(): NoteBarViewModel[] {
    const notes: NoteBarViewModel[] = [];

    for (let step = 0; step < this.viewportSteps; step++) {
      const notesAtStep = this.sequence.getNotesAt(step);

      notesAtStep.forEach(note => {
        // Convert MIDI note to pitch index (relative to BASE_MIDI)
        const pitch = note.pitch - BASE_MIDI;

        // Skip notes outside viewport
        if (pitch < 0 || pitch >= this.viewportRows) return;

        // Convert grid coordinates to screen coordinates
        const pos = this.hitTester.gridToScreen(step, pitch);
        const noteWidth = note.duration * (CELL_WIDTH + GRID_GAP) - GRID_GAP;

        notes.push({
          step,
          pitch,
          midiNote: note.pitch,
          duration: note.duration,
          left: pos.x,
          top: pos.y,
          width: noteWidth,
          height: CELL_HEIGHT
        });
      });
    }

    return notes;
  }

  /**
   * Render grid and notes
   * Clears Canvas and redraws everything (simple, correct approach)
   */
  render(): void {
    // Clear Canvas
    this.renderer.clear();

    // Render grid lines
    this.renderer.renderGrid(this.viewportSteps, this.viewportRows);

    // Render notes
    const notes = this.buildNoteViewModels();
    this.renderer.renderNotes(notes);
  }

  /**
   * Clean up
   * Unsubscribe from sequence changes, remove event listeners, and remove Canvas element
   */
  destroy(): void {
    // Remove container listeners (event delegation)
    this.container.removeEventListener('mousedown', this.boundHandlePointerDown);
    this.container.removeEventListener('touchstart', this.boundHandlePointerDown);
    this.container.removeEventListener('wheel', this.boundHandleWheel);

    // Remove global listeners
    document.removeEventListener('mousemove', this.boundHandlePointerMove);
    document.removeEventListener('mouseup', this.boundHandlePointerUp);
    document.removeEventListener('touchmove', this.boundHandlePointerMove);
    document.removeEventListener('touchend', this.boundHandlePointerUp);

    // Unsubscribe from sequence
    this.sequence.offChange(this.boundHandleSequenceChange);

    // Remove Canvas element
    this.canvas.remove();
  }
}
