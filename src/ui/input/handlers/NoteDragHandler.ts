import type { NormalizedPointerEvent, InputHandler } from '../InputEvent';
import type { NoteRenderer } from '@/ui/grid/NoteRenderer';
import type { SelectionManager } from '@/core/SelectionManager';
import { CLICK_THRESHOLD_PX, HANDLE_ZONE_WIDTH } from '@/config/GridConfig';

/**
 * Callback when notes are moved
 */
export type NoteMoveCallback = (
  notes: Array<{ step: number; pitch: number }>,
  deltaStep: number,
  deltaPitch: number
) => void;

/**
 * NoteDragHandler - Handles dragging notes to move them
 *
 * PC/Mobile: Drag on a note (not handle) to move it
 * If note is selected, moves all selected notes
 * If not selected, moves just that note
 *
 * Priority: 20 (after resize handler)
 */
export class NoteDragHandler implements InputHandler {
  readonly priority = 20;
  readonly name = 'NoteDragHandler';

  private noteRenderer: NoteRenderer | null = null;
  private selectionManager: SelectionManager | null = null;
  private onNoteMove: NoteMoveCallback | null = null;
  private onCancelPan: (() => void) | null = null;

  // Drag state
  private isDragging = false;
  private hasMoved = false;
  private dragNotes: Array<{ step: number; pitch: number }> = [];
  private dragStartWorldX = 0;
  private dragStartWorldY = 0;
  private startScreenX = 0;
  private startScreenY = 0;

  // Clicked note (for non-drag click handling)
  private clickedNote: { step: number; pitch: number } | null = null;

  /**
   * Set the note renderer for hit testing
   */
  setNoteRenderer(renderer: NoteRenderer): void {
    this.noteRenderer = renderer;
  }

  /**
   * Set the selection manager
   */
  setSelectionManager(manager: SelectionManager): void {
    this.selectionManager = manager;
  }

  /**
   * Set callback for when notes are moved
   */
  setNoteMoveCallback(callback: NoteMoveCallback): void {
    this.onNoteMove = callback;
  }

  /**
   * Set callback to cancel pan (for mobile)
   */
  setCancelPanCallback(callback: () => void): void {
    this.onCancelPan = callback;
  }

  /**
   * Check if currently dragging
   */
  getIsDragging(): boolean {
    return this.isDragging;
  }

  /**
   * Check if pointer has moved during drag
   */
  getHasMoved(): boolean {
    return this.hasMoved;
  }

  /**
   * Get the clicked note (if any, for click handling by other handlers)
   */
  getClickedNote(): { step: number; pitch: number } | null {
    return this.clickedNote;
  }

  /**
   * Handle pointer down
   * Claims if clicking on a note (not on resize handle)
   */
  onPointerDown(e: NormalizedPointerEvent): boolean {
    if (!this.noteRenderer) return false;

    // Use handle zone for PC to avoid conflicting with resize
    const handleZone = e.isTouchEvent ? 0 : HANDLE_ZONE_WIDTH;
    const noteAtPos = this.noteRenderer.getNoteAtWorld(e.worldX, e.worldY, handleZone);

    if (!noteAtPos) return false;

    // Don't claim if this is a resize handle (PC only)
    if (!e.isTouchEvent && noteAtPos.isNearHandle) return false;

    this.isDragging = true;
    this.hasMoved = false;
    this.dragStartWorldX = e.worldX;
    this.dragStartWorldY = e.worldY;
    this.startScreenX = e.screenX;
    this.startScreenY = e.screenY;
    this.clickedNote = { step: noteAtPos.step, pitch: noteAtPos.pitch };

    // Determine which notes to drag
    if (this.selectionManager?.isSelected(noteAtPos.step, noteAtPos.pitch)) {
      // Note is selected - drag all selected notes
      this.dragNotes = this.selectionManager.getSelectedNotes();
    } else if (e.shiftKey) {
      // Shift+click - will toggle selection, don't set drag notes
      this.dragNotes = [];
    } else {
      // Single note (not selected)
      this.dragNotes = [{ step: noteAtPos.step, pitch: noteAtPos.pitch }];
    }

    return true;
  }

  /**
   * Handle pointer move during drag
   */
  onPointerMove(e: NormalizedPointerEvent): void {
    if (!this.isDragging) return;

    // Check if moved past threshold
    const dx = e.screenX - this.startScreenX;
    const dy = e.screenY - this.startScreenY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > CLICK_THRESHOLD_PX) {
      this.hasMoved = true;

      // Cancel pan on mobile when dragging notes
      if (e.isTouchEvent) {
        this.onCancelPan?.();
      }
    }
  }

  /**
   * Handle pointer up - complete drag or handle click
   */
  onPointerUp(e: NormalizedPointerEvent): void {
    if (!this.isDragging) {
      this.reset();
      return;
    }

    if (this.hasMoved && this.dragNotes.length > 0) {
      // Complete the drag
      const deltaX = e.worldX - this.dragStartWorldX;
      const deltaY = e.worldY - this.dragStartWorldY;
      const deltaPitch = Math.round(deltaY);

      if (this.onNoteMove && (Math.abs(deltaX) > 0.01 || deltaPitch !== 0)) {
        this.onNoteMove(this.dragNotes, deltaX, deltaPitch);
      }
    }
    // If not moved, the click will be handled by click handlers

    this.reset();
  }

  /**
   * Reset handler state
   */
  private reset(): void {
    this.isDragging = false;
    this.hasMoved = false;
    this.dragNotes = [];
    this.clickedNote = null;
  }

  /**
   * Cancel any active drag
   */
  cancel(): void {
    this.reset();
  }
}
