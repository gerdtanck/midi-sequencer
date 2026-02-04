import type { NormalizedPointerEvent, InputHandler } from '../InputEvent';
import type { NoteRenderer } from '@/ui/grid/NoteRenderer';
import {
  HANDLE_ZONE_WIDTH,
  MIN_NOTE_DURATION,
  MAX_NOTE_DURATION,
} from '@/config/GridConfig';

/**
 * Callback when note resize completes
 */
export type NoteResizeCallback = (step: number, pitch: number, newDuration: number) => void;

/**
 * NoteResizeHandler - Handles note duration resizing via drag
 *
 * PC: Drag the resize handle (right edge of note)
 * Mobile: Long-press on note triggers resize mode (handled externally, then drag here)
 *
 * Priority: 10 (highest among note handlers)
 */
export class NoteResizeHandler implements InputHandler {
  readonly priority = 10;
  readonly name = 'NoteResizeHandler';

  private noteRenderer: NoteRenderer | null = null;
  private onNoteResize: NoteResizeCallback | null = null;
  private onRenderRequest: (() => void) | null = null;

  // Resize state
  private isResizing = false;
  private resizeNote: { step: number; pitch: number; startDuration: number } | null = null;
  private resizeStartWorldX = 0;

  // Mobile resize mode (triggered externally by long-press)
  private mobileResizeMode = false;
  private mobileResizeNote: { step: number; pitch: number; duration: number } | null = null;

  /**
   * Set the note renderer for hit testing and visual updates
   */
  setNoteRenderer(renderer: NoteRenderer): void {
    this.noteRenderer = renderer;
  }

  /**
   * Set callback for when resize completes
   */
  setNoteResizeCallback(callback: NoteResizeCallback): void {
    this.onNoteResize = callback;
  }

  /**
   * Set callback to request a render
   */
  setRenderCallback(callback: () => void): void {
    this.onRenderRequest = callback;
  }

  /**
   * Enter mobile resize mode (called externally after long-press)
   */
  enterMobileResizeMode(note: { step: number; pitch: number; duration: number }): void {
    this.mobileResizeMode = true;
    this.mobileResizeNote = note;
  }

  /**
   * Check if in mobile resize mode
   */
  isInMobileResizeMode(): boolean {
    return this.mobileResizeMode;
  }

  /**
   * Handle pointer down
   * Claims interaction if clicking on a resize handle (PC) or in mobile resize mode
   */
  onPointerDown(e: NormalizedPointerEvent): boolean {
    if (!this.noteRenderer) return false;

    // Mobile resize mode takes precedence
    if (this.mobileResizeMode && this.mobileResizeNote) {
      this.isResizing = true;
      this.resizeNote = {
        step: this.mobileResizeNote.step,
        pitch: this.mobileResizeNote.pitch,
        startDuration: this.mobileResizeNote.duration,
      };
      this.resizeStartWorldX = this.mobileResizeNote.step + this.mobileResizeNote.duration;
      return true;
    }

    // PC: Check if clicking on resize handle
    if (!e.isTouchEvent) {
      const noteAtPos = this.noteRenderer.getNoteAtWorld(e.worldX, e.worldY, HANDLE_ZONE_WIDTH);

      if (noteAtPos?.isNearHandle) {
        this.isResizing = true;
        this.resizeNote = {
          step: noteAtPos.step,
          pitch: noteAtPos.pitch,
          startDuration: noteAtPos.duration,
        };
        this.resizeStartWorldX = e.worldX;
        return true;
      }
    }

    return false;
  }

  /**
   * Handle pointer move during resize
   */
  onPointerMove(e: NormalizedPointerEvent): void {
    if (!this.isResizing || !this.resizeNote || !this.noteRenderer) return;

    const deltaX = e.worldX - this.resizeStartWorldX;
    let newDuration = this.resizeNote.startDuration + deltaX;
    newDuration = Math.max(MIN_NOTE_DURATION, Math.min(MAX_NOTE_DURATION, newDuration));

    // Update visual
    this.noteRenderer.updateNoteMesh(this.resizeNote.step, this.resizeNote.pitch, newDuration);
    this.onRenderRequest?.();
  }

  /**
   * Handle pointer up - complete resize
   */
  onPointerUp(e: NormalizedPointerEvent): void {
    if (!this.isResizing || !this.resizeNote) {
      this.reset();
      return;
    }

    const deltaX = e.worldX - this.resizeStartWorldX;
    let newDuration = this.resizeNote.startDuration + deltaX;
    newDuration = Math.max(MIN_NOTE_DURATION, Math.min(MAX_NOTE_DURATION, newDuration));

    // Notify callback
    if (this.onNoteResize) {
      this.onNoteResize(this.resizeNote.step, this.resizeNote.pitch, newDuration);
    }

    this.reset();
  }

  /**
   * Reset handler state
   */
  private reset(): void {
    this.isResizing = false;
    this.resizeNote = null;
    this.resizeStartWorldX = 0;
    this.mobileResizeMode = false;
    this.mobileResizeNote = null;
  }

  /**
   * Cancel any active resize
   */
  cancel(): void {
    this.reset();
  }
}
