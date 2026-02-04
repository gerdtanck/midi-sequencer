import type { Sequence } from '../../sequencer/Sequence';
import { CanvasHitTester } from './CanvasHitTester';
import { STEPS } from '../../config/GridConfig';

/**
 * Canvas interaction controller
 * Handles click/drag interactions on Canvas grid
 * Adapted from NoteInteractionController for Canvas coordinate system
 *
 * COORDINATE FLOW:
 * 1. Mouse/touch event → clientX/clientY (screen space)
 * 2. Convert to Canvas-relative coordinates (subtract Canvas position)
 * 3. CanvasHitTester.screenToGrid() → step/pitch (grid space)
 * 4. Convert pitch to MIDI note (baseMidiNote + pitch)
 * 5. Sequence operations use MIDI notes
 *
 * INTERACTION PATTERNS:
 * - Click on empty cell → toggle note on
 * - Click on note → toggle note off (if < 5px movement)
 * - Drag note body → move note to new position
 * - Drag note handle → adjust note duration
 */
export class CanvasInteractionController {
  private sequence: Sequence;
  private hitTester: CanvasHitTester;
  private baseMidiNote: number;
  private canvas: HTMLCanvasElement;
  private scrollContainer: HTMLElement;

  /** Cell dimensions for calculations */
  private cellWidth: number;
  private cellHeight: number;
  private gridGap: number;

  /** Drag threshold (pixels) - same as NoteInteractionController */
  private readonly dragThreshold: number = 5;

  /** Duration handle width (must match renderer) */
  private readonly handleWidth: number = 8;

  /** Click tracking */
  private clickStartX: number = 0;
  private clickStartY: number = 0;
  private clickStartTime: number = 0;

  /** Position drag state */
  private isPotentialClick: boolean = false;
  private clickedOnNote: boolean = false; // Track if we clicked on a note vs empty cell
  private isDraggingPosition: boolean = false;
  private dragPositionStep: number | null = null;
  private dragPositionPitch: number | null = null;
  private dragPositionCurrentStep: number | null = null;
  private dragPositionCurrentPitch: number | null = null;
  private draggedNoteDuration: number = 0;

  /** Track last rendered position for visual feedback during drag */
  private lastDragRenderedStep: number | null = null;
  private lastDragRenderedPitch: number | null = null;

  /** Duration drag state */
  private isDraggingDuration: boolean = false;
  private dragDurationStep: number | null = null;
  private dragDurationPitch: number | null = null;
  private dragStartX: number = 0;
  private dragStartDuration: number = 0;

  /** Pan/viewport drag state */
  private isPanning: boolean = false;
  private panStartX: number = 0;
  private panStartY: number = 0;
  private panStartScrollX: number = 0;
  private panStartScrollY: number = 0;

  /** Pinch zoom state (mobile) */
  private touchStartDistance: number | null = null;
  private touchStartZoom: number = 1.0;
  private touchMidpoint: { x: number; y: number } | null = null;

  /** Zoom callbacks (optional, for mobile pinch zoom) */
  private getZoom: () => number;
  private applyZoomWithAnchor: (zoom: number, anchorX: number, anchorY: number) => void;

  constructor(config: {
    sequence: Sequence;
    hitTester: CanvasHitTester;
    baseMidiNote: number;
    canvas: HTMLCanvasElement;
    scrollContainer: HTMLElement;
    cellWidth: number;
    cellHeight: number;
    gridGap: number;
    getZoom?: () => number;
    applyZoomWithAnchor?: (zoom: number, anchorX: number, anchorY: number) => void;
  }) {
    this.sequence = config.sequence;
    this.hitTester = config.hitTester;
    this.baseMidiNote = config.baseMidiNote;
    this.canvas = config.canvas;
    this.scrollContainer = config.scrollContainer;
    this.cellWidth = config.cellWidth;
    this.cellHeight = config.cellHeight;
    this.gridGap = config.gridGap;
    this.getZoom = config.getZoom || (() => 1.0);
    this.applyZoomWithAnchor = config.applyZoomWithAnchor || (() => {});
  }

  /**
   * Get scroll container for zoom anchoring
   *
   * Zoom controls need access to scroll position for anchor point calculations.
   * The scroll container is used to determine the viewport center when calculating
   * zoom anchor points (zoom towards mouse position or viewport center).
   *
   * @returns The scroll container element
   */
  getScrollContainer(): HTMLElement {
    return this.scrollContainer;
  }

  /**
   * Handle Canvas click/touch start
   */
  handlePointerDown(e: MouseEvent | TouchEvent): void {
    const target = e.target as HTMLElement;

    // Check for two-finger touch (pinch gesture)
    if (e instanceof TouchEvent && e.touches.length === 2) {
      // Two-finger touch = potential pinch zoom
      this.touchStartDistance = this.getTouchDistance(e.touches[0], e.touches[1]);
      this.touchStartZoom = this.getZoom();
      this.touchMidpoint = this.getTouchMidpoint(e.touches[0], e.touches[1]);

      // Prevent default to stop browser pinch-zoom
      e.preventDefault();
      return; // Don't process as regular pointer down
    }

    // Ignore events from interactive UI elements (loop markers, etc.)
    // These elements use stopPropagation, but check as safety measure
    if (target?.classList.contains('loop-marker')) {
      return;
    }

    const { clientX, clientY } = this.getEventCoordinates(e);

    // Store click start position and time
    this.clickStartX = clientX;
    this.clickStartY = clientY;
    this.clickStartTime = Date.now();

    // Reset drag render tracking for new interaction
    this.lastDragRenderedStep = null;
    this.lastDragRenderedPitch = null;

    // Convert to Canvas-relative coordinates
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;

    // Convert to grid coordinates
    const gridPos = this.hitTester.screenToGrid(canvasX, canvasY);
    if (!gridPos) {
      return; // Click in gap or outside grid
    }

    // Check if clicking on existing note (for drag) vs empty cell (for toggle)
    // Must check if click lands on ANY part of a note's duration, not just its start step
    const midiNote = this.baseMidiNote + gridPos.pitch;
    let existingNote = null;
    let existingNoteStartStep = gridPos.step;

    // Check current step and previous steps (notes can extend into current step)
    for (let checkStep = gridPos.step; checkStep >= Math.max(0, gridPos.step - 16); checkStep--) {
      const notesAtStep = this.sequence.getNotesAt(checkStep);
      const note = notesAtStep.find(n => n.pitch === midiNote);
      if (note && checkStep + note.duration > gridPos.step) {
        // Note extends into clicked step
        existingNote = note;
        existingNoteStartStep = checkStep;
        break;
      }
    }

    if (!existingNote) {
      // Empty cell - could be click (toggle note) or pan (scroll viewport)
      this.isPotentialClick = true;
      this.clickedOnNote = false; // Clicked on empty cell
      this.dragPositionStep = gridPos.step;
      this.dragPositionPitch = gridPos.pitch;

      // Prepare for potential pan
      this.panStartX = clientX;
      this.panStartY = clientY;
      this.panStartScrollX = this.scrollContainer.scrollLeft;
      this.panStartScrollY = this.scrollContainer.scrollTop;
    } else {
      // Has note - check if clicking handle vs body
      this.clickedOnNote = true; // Clicked on a note
      // Use the note's actual start step, not the clicked step
      if (this.isClickOnHandle(canvasX, existingNoteStartStep, existingNote.duration)) {
        // Start duration drag
        this.isDraggingDuration = true;
        this.dragDurationStep = existingNoteStartStep;  // Drag the note from its start step
        this.dragDurationPitch = gridPos.pitch;
        this.dragStartX = clientX;
        this.dragStartDuration = existingNote.duration;
      } else {
        // Start position drag (or click to delete)
        this.isPotentialClick = true;
        this.isDraggingPosition = false; // Will become true if threshold exceeded
        this.dragPositionStep = existingNoteStartStep;  // Drag the note from its start step
        this.dragPositionPitch = gridPos.pitch;
        this.dragPositionCurrentStep = existingNoteStartStep;
        this.dragPositionCurrentPitch = gridPos.pitch;
        this.draggedNoteDuration = existingNote.duration;
      }
    }
  }

  /**
   * Handle pointer move (either pan, position drag, or duration drag)
   */
  handlePointerMove(e: MouseEvent | TouchEvent): void {
    // Check for two-finger touch move (pinch gesture)
    if (e instanceof TouchEvent && e.touches.length === 2 && this.touchStartDistance !== null) {
      e.preventDefault(); // Prevent browser pinch-zoom

      const currentDistance = this.getTouchDistance(e.touches[0], e.touches[1]);
      const scale = currentDistance / this.touchStartDistance;
      const newZoom = this.touchStartZoom * scale;

      // Update midpoint (can drift during pinch)
      this.touchMidpoint = this.getTouchMidpoint(e.touches[0], e.touches[1]);

      // Apply zoom anchored to pinch midpoint
      if (this.touchMidpoint) {
        this.applyZoomWithAnchor(newZoom, this.touchMidpoint.x, this.touchMidpoint.y);
      }

      return; // Don't process as regular pointer move
    }

    // Duration dragging
    if (this.isDraggingDuration) {
      this.handleDurationDragMove(e);
      return;
    }

    // Panning
    if (this.isPanning) {
      this.handlePanMove(e);
      return;
    }

    // Position dragging or panning (with threshold)
    if (this.dragPositionStep !== null && this.dragPositionPitch !== null) {
      e.preventDefault();

      const { clientX, clientY } = this.getEventCoordinates(e);
      const deltaX = clientX - this.clickStartX;
      const deltaY = clientY - this.clickStartY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // Check if we've exceeded 5px drag threshold
      if (this.isPotentialClick && distance > this.dragThreshold) {
        this.isPotentialClick = false;

        // Decide: pan (empty cell) or drag note (clicked on note)
        if (this.clickedOnNote) {
          this.isDraggingPosition = true;
        } else {
          this.isPanning = true;
        }
      }

      if (this.isDraggingPosition) {
        this.handlePositionDragMove(e);
      } else if (this.isPanning) {
        this.handlePanMove(e);
      }
    }
  }

  /**
   * Handle pointer up (commit drag changes or handle clicks)
   */
  handlePointerUp(e: MouseEvent | TouchEvent): void {
    // Reset pinch state
    if (this.touchStartDistance !== null) {
      this.touchStartDistance = null;
      this.touchStartZoom = 1.0;
      this.touchMidpoint = null;
      // Don't return - continue processing pointer up
    }

    // Store drag type before resetting flags
    const wasPositionDrag = this.isDraggingPosition;
    const wasDurationDrag = this.isDraggingDuration;
    const wasPanning = this.isPanning;
    const wasClick = this.isPotentialClick;

    // Store position values before reset
    const posStep = this.dragPositionStep;
    const posPitch = this.dragPositionPitch;

    // Reset drag state
    this.isDraggingDuration = false;
    this.isDraggingPosition = false;
    this.isPotentialClick = false;
    this.isPanning = false;
    this.clickedOnNote = false;
    this.dragDurationStep = null;
    this.dragDurationPitch = null;
    this.dragPositionStep = null;
    this.dragPositionPitch = null;
    this.dragPositionCurrentStep = null;
    this.dragPositionCurrentPitch = null;
    this.lastDragRenderedStep = null;
    this.lastDragRenderedPitch = null;

    // Handle based on interaction type
    if (wasClick && posStep !== null && posPitch !== null) {
      // This was a click, not a drag - toggle the note
      const midiNote = this.baseMidiNote + posPitch;
      this.sequence.toggleNote(posStep, midiNote);
    } else if (wasPositionDrag) {
      // Note was already moved during drag - just trigger final change event
      this.sequence.triggerChange();
    } else if (wasDurationDrag) {
      // Duration was changed during drag - trigger change event
      this.sequence.triggerChange();
    } else if (wasPanning) {
      // Panning complete - no action needed (scroll already applied)
    }
  }

  /**
   * Handle position drag movement
   * Provides real-time visual feedback by actually moving the note during drag
   */
  private handlePositionDragMove(e: MouseEvent | TouchEvent): void {
    if (!this.isDraggingPosition || this.dragPositionStep === null || this.dragPositionPitch === null) {
      return;
    }

    const { clientX, clientY } = this.getEventCoordinates(e);

    // Convert to Canvas-relative coordinates
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;

    // Convert to grid coordinates
    const gridPos = this.hitTester.screenToGrid(canvasX, canvasY);
    if (!gridPos) return;

    // Check if position actually changed (avoid redundant updates)
    if (this.lastDragRenderedStep === gridPos.step && this.lastDragRenderedPitch === gridPos.pitch) {
      return;
    }

    const oldMidiNote = this.baseMidiNote + this.dragPositionPitch;
    const newMidiNote = this.baseMidiNote + gridPos.pitch;

    // On first move, remove from original position
    if (this.lastDragRenderedStep === null) {
      this.sequence.toggleNote(this.dragPositionStep, oldMidiNote);
    } else {
      // Remove from last rendered position
      const lastMidiNote = this.baseMidiNote + this.lastDragRenderedPitch!;
      this.sequence.toggleNote(this.lastDragRenderedStep, lastMidiNote);
    }

    // Check if note exists at target and remove it first
    const targetNotes = this.sequence.getNotesAt(gridPos.step);
    const targetNoteExists = targetNotes.some(n => n.pitch === newMidiNote);
    if (targetNoteExists) {
      this.sequence.toggleNote(gridPos.step, newMidiNote);
    }

    // Add to new position with preserved duration
    this.sequence.toggleNote(gridPos.step, newMidiNote, 100, this.draggedNoteDuration);

    // Update tracking (observer pattern triggers Canvas redraw automatically)
    this.lastDragRenderedStep = gridPos.step;
    this.lastDragRenderedPitch = gridPos.pitch;
    this.dragPositionCurrentStep = gridPos.step;
    this.dragPositionCurrentPitch = gridPos.pitch;
  }

  /**
   * Handle duration drag movement
   */
  private handleDurationDragMove(e: MouseEvent | TouchEvent): void {
    if (!this.isDraggingDuration || this.dragDurationStep === null || this.dragDurationPitch === null) {
      return;
    }

    e.preventDefault();

    const { clientX } = this.getEventCoordinates(e);
    const deltaX = clientX - this.dragStartX;

    // Convert delta to duration change
    // deltaX is in CSS pixels (scaled by zoom), need to convert to base pixels
    const zoom = this.hitTester.getZoom();
    const baseDeltaX = deltaX / zoom;
    const cellWidthWithGap = this.cellWidth + this.gridGap;
    const durationDelta = baseDeltaX / cellWidthWithGap;
    let newDuration = this.dragStartDuration + durationDelta;

    // Clamp to reasonable range (minimum 0.1 steps, maximum grid width)
    newDuration = Math.max(0.1, Math.min(STEPS, newDuration));

    // Update the note in the sequence
    const midiNote = this.baseMidiNote + this.dragDurationPitch;
    const notesAtStep = this.sequence.getNotesAt(this.dragDurationStep);
    const note = notesAtStep.find(n => n.pitch === midiNote);

    if (note) {
      note.duration = newDuration;
      // Trigger change event for real-time visual feedback
      this.sequence.triggerChange();
    }
  }

  /**
   * Handle pan/viewport drag movement
   */
  private handlePanMove(e: MouseEvent | TouchEvent): void {
    if (!this.isPanning) {
      return;
    }

    e.preventDefault();

    const { clientX, clientY } = this.getEventCoordinates(e);

    // Calculate deltas (inverted: dragging right scrolls left)
    const deltaX = this.panStartX - clientX;
    const deltaY = this.panStartY - clientY;

    // Apply scroll with boundaries
    this.scrollContainer.scrollLeft = this.panStartScrollX + deltaX;
    this.scrollContainer.scrollTop = this.panStartScrollY + deltaY;
  }

  /**
   * Check if click is on duration handle (right 8px of note)
   *
   * Accounts for zoom: canvasX is in CSS pixels (zoomed), so we need to
   * scale the base coordinates from gridToScreen by zoom level.
   */
  private isClickOnHandle(canvasX: number, step: number, duration: number): boolean {
    const zoom = this.hitTester.getZoom();

    // Get base coordinates from hitTester
    const cellPos = this.hitTester.gridToScreen(step, 0); // Y doesn't matter for X calc
    const noteWidth = duration * (this.cellWidth + this.gridGap);

    // Scale to CSS pixel space (accounting for zoom)
    const noteRight = (cellPos.x + noteWidth) * zoom;
    const handleLeft = noteRight - (this.handleWidth * zoom);


    return canvasX >= handleLeft && canvasX <= noteRight;
  }

  /**
   * Get coordinates from mouse or touch event
   */
  private getEventCoordinates(e: MouseEvent | TouchEvent): { clientX: number; clientY: number } {
    if (e instanceof MouseEvent) {
      return { clientX: e.clientX, clientY: e.clientY };
    } else {
      const touch = e.touches[0] || e.changedTouches[0];
      return { clientX: touch.clientX, clientY: touch.clientY };
    }
  }

  /**
   * Calculate distance between two touch points
   */
  private getTouchDistance(t1: Touch, t2: Touch): number {
    const dx = t2.clientX - t1.clientX;
    const dy = t2.clientY - t1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculate midpoint between two touch points (relative to scroll container)
   */
  private getTouchMidpoint(t1: Touch, t2: Touch): { x: number; y: number } {
    const rect = this.scrollContainer.getBoundingClientRect();
    const midX = (t1.clientX + t2.clientX) / 2;
    const midY = (t1.clientY + t2.clientY) / 2;

    // Return position relative to scroll container (for anchor point)
    return {
      x: midX - rect.left,
      y: midY - rect.top
    };
  }
}
