import type { NormalizedPointerEvent, InputHandler } from '../InputEvent';
import type { NoteRenderer } from '@/ui/grid/NoteRenderer';
import type { SelectionManager } from '@/core/SelectionManager';
import { worldToGridCell, type GridCell } from '@/utils';
import { CLICK_THRESHOLD_PX, DOUBLE_TAP_THRESHOLD_MS } from '@/config/GridConfig';

/**
 * Callback when a note is toggled (add/remove)
 */
export type NoteToggleCallback = (cell: GridCell) => void;

/**
 * NoteClickHandler - Handles click/tap interactions for adding/removing notes
 *
 * PC:
 * - Left-click on note: delete note
 * - Shift+click on note: toggle selection
 * - Left-click on empty (no selection): add note
 * - Left-click on empty (with selection): deselect all
 * - Right-click on empty (with selection): paste
 *
 * Mobile:
 * - Tap on note: delete note (delayed for double-tap detection)
 * - Double-tap on note: toggle selection
 * - Tap on empty (no selection): add note
 * - Tap on empty (with selection): deselect all
 *
 * Priority: 50 (lower priority - handles clicks that aren't claimed by others)
 */
export class NoteClickHandler implements InputHandler {
  readonly priority = 50;
  readonly name = 'NoteClickHandler';

  private noteRenderer: NoteRenderer | null = null;
  private selectionManager: SelectionManager | null = null;
  private onNoteToggle: NoteToggleCallback | null = null;
  private onRenderRequest: (() => void) | null = null;

  // Grid dimensions for bounds checking
  private gridWidth = 0;
  private gridHeight = 0;

  // Click state
  private isClicking = false;
  private hasMoved = false;
  private startScreenX = 0;
  private startScreenY = 0;
  private clickWorldX = 0;
  private clickWorldY = 0;
  private shiftKey = false;

  // Double-tap detection (mobile)
  private lastTapTime = 0;
  private lastTapWorldX = 0;
  private lastTapWorldY = 0;

  // Pending tap (mobile - delayed single tap for double-tap detection)
  private pendingTapTimer: number | null = null;
  private pendingTapAction: (() => void) | null = null;

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
   * Set callback for note toggle
   */
  setNoteToggleCallback(callback: NoteToggleCallback): void {
    this.onNoteToggle = callback;
  }

  /**
   * Set callback to request a render
   */
  setRenderCallback(callback: () => void): void {
    this.onRenderRequest = callback;
  }

  /**
   * Set grid dimensions
   */
  setGridDimensions(width: number, height: number): void {
    this.gridWidth = width;
    this.gridHeight = height;
  }

  /**
   * Handle pointer down
   * Claims left-click on empty space or notes (for click handling)
   */
  onPointerDown(e: NormalizedPointerEvent): boolean {
    // Store click info
    this.clickWorldX = e.worldX;
    this.clickWorldY = e.worldY;
    this.startScreenX = e.screenX;
    this.startScreenY = e.screenY;
    this.shiftKey = e.shiftKey;
    this.hasMoved = false;

    // Check if on a note
    const noteAtPos = this.noteRenderer?.getNoteAtWorld(e.worldX, e.worldY, 0);

    if (e.isTouchEvent) {
      // Mobile: check for double-tap on note
      const now = Date.now();
      const isDoubleTap =
        now - this.lastTapTime < DOUBLE_TAP_THRESHOLD_MS &&
        Math.abs(e.worldX - this.lastTapWorldX) < 1 &&
        Math.abs(e.worldY - this.lastTapWorldY) < 1;

      this.lastTapTime = now;
      this.lastTapWorldX = e.worldX;
      this.lastTapWorldY = e.worldY;

      if (isDoubleTap && noteAtPos) {
        // Double-tap on note - toggle selection immediately
        this.clearPendingTap();
        this.selectionManager?.toggle(noteAtPos.step, noteAtPos.pitch);
        this.onRenderRequest?.();
        return false; // Don't claim, handled
      }

      // Claim for potential single-tap handling
      this.isClicking = true;
      return true;
    } else {
      // PC: Only claim left-click (right-click for paste handled in onContextMenu)
      if (e.button === 0) {
        this.isClicking = true;
        return true;
      }
    }

    return false;
  }

  /**
   * Handle pointer move - track if user moved (not a click)
   */
  onPointerMove(e: NormalizedPointerEvent): void {
    if (!this.isClicking) return;

    const dx = e.screenX - this.startScreenX;
    const dy = e.screenY - this.startScreenY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > CLICK_THRESHOLD_PX) {
      this.hasMoved = true;
    }
  }

  /**
   * Handle pointer up - complete click if not moved
   */
  onPointerUp(e: NormalizedPointerEvent): void {
    if (!this.isClicking || this.hasMoved) {
      this.reset();
      return;
    }

    const noteAtPos = this.noteRenderer?.getNoteAtWorld(e.worldX, e.worldY, 0) ?? null;

    if (e.isTouchEvent) {
      this.handleMobileTap(noteAtPos);
    } else {
      this.handlePCClick(noteAtPos);
    }

    this.reset();
  }

  /**
   * Handle PC click
   */
  private handlePCClick(
    noteAtPos: { step: number; pitch: number; duration: number; isNearHandle: boolean } | null
  ): void {
    if (noteAtPos) {
      if (this.shiftKey) {
        // Shift+click - toggle selection
        this.selectionManager?.toggle(noteAtPos.step, noteAtPos.pitch);
        this.onRenderRequest?.();
      } else {
        // Click on note - delete it
        if (this.onNoteToggle) {
          this.onNoteToggle({ step: noteAtPos.step, pitch: noteAtPos.pitch });
        }
      }
    } else {
      // Click on empty
      if (this.selectionManager?.hasSelection) {
        // Deselect all
        this.selectionManager.clear();
        this.onRenderRequest?.();
      } else {
        // Add note
        const cell = worldToGridCell(this.clickWorldX, this.clickWorldY, this.gridWidth, this.gridHeight);
        if (cell && this.onNoteToggle) {
          this.onNoteToggle(cell);
        }
      }
    }
  }

  /**
   * Handle mobile tap (with double-tap delay)
   */
  private handleMobileTap(
    noteAtPos: { step: number; pitch: number; duration: number; isNearHandle: boolean } | null
  ): void {
    if (noteAtPos) {
      // Tap on note - schedule delete (can be cancelled by double-tap)
      const step = noteAtPos.step;
      const pitch = noteAtPos.pitch;
      this.schedulePendingTap(() => {
        if (this.onNoteToggle) {
          this.onNoteToggle({ step, pitch });
        }
      });
    } else {
      // Tap on empty
      if (this.selectionManager?.hasSelection) {
        // Deselect all
        this.selectionManager.clear();
        this.onRenderRequest?.();
      } else {
        // Add note
        const cell = worldToGridCell(this.clickWorldX, this.clickWorldY, this.gridWidth, this.gridHeight);
        if (cell && this.onNoteToggle) {
          this.onNoteToggle(cell);
        }
      }
    }
  }

  /**
   * Handle context menu (right-click)
   * Note: Paste is handled in NoteInteractionController for now
   */
  onContextMenu(_e: MouseEvent): boolean {
    // Context menu paste requires coordination with selection rect handler
    // to prevent paste after selection rect drag. Handled at higher level.
    return false;
  }

  /**
   * Schedule a pending tap action (for double-tap detection)
   */
  private schedulePendingTap(action: () => void): void {
    this.clearPendingTap();
    this.pendingTapAction = action;
    this.pendingTapTimer = window.setTimeout(() => {
      if (this.pendingTapAction) {
        this.pendingTapAction();
        this.pendingTapAction = null;
      }
      this.pendingTapTimer = null;
    }, DOUBLE_TAP_THRESHOLD_MS);
  }

  /**
   * Clear any pending tap action
   */
  private clearPendingTap(): void {
    if (this.pendingTapTimer !== null) {
      clearTimeout(this.pendingTapTimer);
      this.pendingTapTimer = null;
      this.pendingTapAction = null;
    }
  }

  /**
   * Reset handler state
   */
  private reset(): void {
    this.isClicking = false;
    this.hasMoved = false;
  }

  /**
   * Cancel click handling
   */
  cancel(): void {
    this.clearPendingTap();
    this.reset();
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.clearPendingTap();
  }
}
