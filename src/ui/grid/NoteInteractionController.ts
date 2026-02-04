import * as THREE from 'three';
import {
  GridConfig,
  CLICK_THRESHOLD_PX,
  DOUBLE_TAP_THRESHOLD_MS,
  LONG_PRESS_DURATION_MS,
  HANDLE_ZONE_WIDTH,
  MIN_NOTE_DURATION,
  MAX_NOTE_DURATION,
  SELECTION_RECT_COLOR,
  SELECTION_RECT_OPACITY,
  SELECTION_RECT_Z_POSITION,
} from '@/config/GridConfig';
import type { NoteRenderer } from './NoteRenderer';
import type { SelectionManager } from '@/core/SelectionManager';
import {
  screenToWorld,
  worldToGridCell,
  getPointerPosition,
  isTouchDevice,
  type GridCell,
} from '@/utils';

// Re-export GridCell for consumers
export type { GridCell };

/**
 * Callback types
 */
export type NoteToggleCallback = (cell: GridCell) => void;
export type NoteResizeCallback = (step: number, pitch: number, newDuration: number) => void;
export type NoteMoveCallback = (
  notes: Array<{ step: number; pitch: number }>,
  deltaStep: number,
  deltaPitch: number
) => void;
export type NotePasteCallback = (targetStep: number, targetPitch: number) => void;

/**
 * Interaction modes
 */
type InteractionMode =
  | 'none'
  | 'pan' // Grid panning (handled by GridControls)
  | 'resize' // Resizing a note
  | 'drag' // Dragging note(s)
  | 'select-rect'; // Selection rectangle

/**
 * NoteInteractionController - Handles all note interactions
 *
 * PC:
 * - Click note: delete
 * - Shift+click note: toggle selection
 * - Click empty: deselect all
 * - Drag on note: move note(s)
 * - Drag on empty: selection rectangle
 * - Right-click empty: paste
 * - Drag handle: resize
 *
 * Mobile:
 * - Tap note: delete
 * - Double-tap note: toggle selection
 * - Double-tap empty: deselect all
 * - Drag on note: move note(s)
 * - Long-press note: resize mode
 * - Long-press empty (no selection): selection rectangle
 * - Long-press empty (with selection): paste
 */
export class NoteInteractionController {
  private camera: THREE.OrthographicCamera;
  private domElement: HTMLElement;
  private config: GridConfig;

  // Grid dimensions
  private gridWidth = 0;
  private gridHeight = 0;

  // Device type
  private isMobile: boolean;

  // Current interaction mode
  private mode: InteractionMode = 'none';

  // Pointer state
  private pointerDown = false;
  private pointerStartX = 0;
  private pointerStartY = 0;
  private pointerMoved = false;
  private shiftKey = false;
  private pointerButton = 0; // 0=left, 2=right

  // Resize state
  private resizeNote: { step: number; pitch: number; startDuration: number } | null = null;
  private resizeStartWorldX = 0;

  // Drag state
  private dragNotes: Array<{ step: number; pitch: number }> = [];
  private dragStartWorldX = 0;
  private dragStartWorldY = 0;

  // Selection rectangle state
  private selectRectStart: { x: number; y: number } | null = null;
  private selectRectMesh: THREE.Mesh | null = null;
  private scene: THREE.Scene | null = null;
  private selectRectWasUsed = false; // Tracks if right-drag was used for selection

  // Long-press state (mobile)
  private longPressTimer: number | null = null;
  private longPressTriggered = false;

  // Double-tap detection (mobile)
  private lastTapTime = 0;
  private lastTapPos: { x: number; y: number } | null = null;

  // Pending tap action (mobile) - delays single tap to detect double-tap
  private pendingTapTimer: number | null = null;
  private pendingTapAction: (() => void) | null = null;

  // References
  private noteRenderer: NoteRenderer | null = null;
  private selectionManager: SelectionManager | null = null;

  // Callbacks
  private onNoteToggle: NoteToggleCallback | null = null;
  private onNoteResize: NoteResizeCallback | null = null;
  private onNoteMove: NoteMoveCallback | null = null;
  private onNotePaste: NotePasteCallback | null = null;
  private onRenderRequest: (() => void) | null = null;
  private onCancelPan: (() => void) | null = null;

  // Bound event handlers
  private boundOnPointerDown: (e: MouseEvent | TouchEvent) => void;
  private boundOnPointerMove: (e: MouseEvent | TouchEvent) => void;
  private boundOnPointerUp: (e: MouseEvent | TouchEvent) => void;
  private boundOnContextMenu: (e: MouseEvent) => void;

  constructor(
    camera: THREE.OrthographicCamera,
    domElement: HTMLElement,
    config: GridConfig
  ) {
    this.camera = camera;
    this.domElement = domElement;
    this.config = config;
    this.isMobile = isTouchDevice();

    this.boundOnPointerDown = this.onPointerDown.bind(this);
    this.boundOnPointerMove = this.onPointerMove.bind(this);
    this.boundOnPointerUp = this.onPointerUp.bind(this);
    this.boundOnContextMenu = this.onContextMenu.bind(this);

    this.attachEvents();
  }

  // ============ Setup Methods ============

  setNoteRenderer(renderer: NoteRenderer): void {
    this.noteRenderer = renderer;
  }

  setSelectionManager(manager: SelectionManager): void {
    this.selectionManager = manager;
  }

  setScene(scene: THREE.Scene): void {
    this.scene = scene;
  }

  setNoteToggleCallback(callback: NoteToggleCallback): void {
    this.onNoteToggle = callback;
  }

  setNoteResizeCallback(callback: NoteResizeCallback): void {
    this.onNoteResize = callback;
  }

  setNoteMoveCallback(callback: NoteMoveCallback): void {
    this.onNoteMove = callback;
  }

  setNotePasteCallback(callback: NotePasteCallback): void {
    this.onNotePaste = callback;
  }

  setRenderCallback(callback: () => void): void {
    this.onRenderRequest = callback;
  }

  setCancelPanCallback(callback: () => void): void {
    this.onCancelPan = callback;
  }

  setGridDimensions(barCount: number, octaveCount: number): void {
    this.gridWidth = barCount * this.config.stepsPerBar;
    this.gridHeight = octaveCount * this.config.semitonesPerOctave;
  }

  // ============ Coordinate Conversion ============

  private toWorld(screenX: number, screenY: number): { x: number; y: number } {
    return screenToWorld(this.camera, this.domElement, screenX, screenY);
  }

  toGridCell(screenX: number, screenY: number): GridCell | null {
    const world = this.toWorld(screenX, screenY);
    return worldToGridCell(world.x, world.y, this.gridWidth, this.gridHeight);
  }

  // ============ Event Handling ============

  private attachEvents(): void {
    this.domElement.addEventListener('mousedown', this.boundOnPointerDown, { capture: true });
    this.domElement.addEventListener('touchstart', this.boundOnPointerDown, {
      capture: true,
      passive: false,
    });

    document.addEventListener('mousemove', this.boundOnPointerMove);
    document.addEventListener('mouseup', this.boundOnPointerUp);
    document.addEventListener('touchmove', this.boundOnPointerMove, { passive: false });
    document.addEventListener('touchend', this.boundOnPointerUp);

    // Right-click for paste (PC)
    this.domElement.addEventListener('contextmenu', this.boundOnContextMenu);
  }

  private detachEvents(): void {
    this.domElement.removeEventListener('mousedown', this.boundOnPointerDown, { capture: true });
    this.domElement.removeEventListener('touchstart', this.boundOnPointerDown, { capture: true });

    document.removeEventListener('mousemove', this.boundOnPointerMove);
    document.removeEventListener('mouseup', this.boundOnPointerUp);
    document.removeEventListener('touchmove', this.boundOnPointerMove);
    document.removeEventListener('touchend', this.boundOnPointerUp);

    this.domElement.removeEventListener('contextmenu', this.boundOnContextMenu);
  }

  // ============ Context Menu (Right-click paste) ============

  private onContextMenu(e: MouseEvent): void {
    e.preventDefault();

    // If right-click was used for selection rectangle (dragged), don't paste
    if (this.selectRectWasUsed) return;

    // Only paste if there's a selection
    if (!this.selectionManager?.hasSelection) return;

    const world = this.toWorld(e.clientX, e.clientY);
    const noteAtPos = this.noteRenderer?.getNoteAtWorld(world.x, world.y, 0);

    // Only paste on empty grid
    if (!noteAtPos) {
      const cell = this.toGridCell(e.clientX, e.clientY);
      if (cell && this.onNotePaste) {
        this.onNotePaste(cell.step, cell.pitch);
      }
    }
  }

  // ============ Pointer Down ============

  private onPointerDown(e: MouseEvent | TouchEvent): void {
    // For mouse: allow left (0) and right (2) buttons
    if ('button' in e && e.button !== 0 && e.button !== 2) return;
    if ('touches' in e && e.touches.length !== 1) return;

    const pos = getPointerPosition(e);
    const world = this.toWorld(pos.x, pos.y);

    this.pointerDown = true;
    this.pointerStartX = pos.x;
    this.pointerStartY = pos.y;
    this.pointerMoved = false;
    this.shiftKey = 'shiftKey' in e && e.shiftKey;
    this.pointerButton = 'button' in e ? e.button : 0;
    this.mode = 'none';
    this.selectRectWasUsed = false;

    this.clearLongPressTimer();
    this.longPressTriggered = false;

    const noteAtPos = this.noteRenderer?.getNoteAtWorld(
      world.x,
      world.y,
      this.isMobile ? 0 : HANDLE_ZONE_WIDTH
    ) ?? null;

    if (this.isMobile) {
      this.handleMobilePointerDown(e, pos, world, noteAtPos);
    } else {
      this.handlePCPointerDown(e, world, noteAtPos);
    }
  }

  private handlePCPointerDown(
    e: MouseEvent | TouchEvent,
    world: { x: number; y: number },
    noteAtPos: { step: number; pitch: number; duration: number; isNearHandle: boolean } | null
  ): void {
    if (noteAtPos) {
      if (noteAtPos.isNearHandle) {
        // Start resize
        this.mode = 'resize';
        this.resizeNote = {
          step: noteAtPos.step,
          pitch: noteAtPos.pitch,
          startDuration: noteAtPos.duration,
        };
        this.resizeStartWorldX = world.x;
        e.stopPropagation();
        this.domElement.style.cursor = 'ew-resize';
      } else {
        // Prepare for potential drag
        this.mode = 'drag';
        this.dragStartWorldX = world.x;
        this.dragStartWorldY = world.y;

        // If note is selected, drag all selected
        // If not selected and no shift, we'll handle on pointer up (delete)
        if (this.selectionManager?.isSelected(noteAtPos.step, noteAtPos.pitch)) {
          this.dragNotes = this.selectionManager.getSelectedNotes();
        } else if (this.shiftKey) {
          // Shift+click will toggle selection on pointer up
          this.dragNotes = [];
        } else {
          // Will delete on pointer up if not moved
          this.dragNotes = [{ step: noteAtPos.step, pitch: noteAtPos.pitch }];
        }
        e.stopPropagation();
      }
    } else {
      // Empty grid
      if (this.pointerButton === 2) {
        // Right-click on empty - prepare for selection rectangle
        this.mode = 'select-rect';
        this.selectRectStart = world;
        e.stopPropagation();
      }
      // Left-click on empty: don't claim, let GridControls handle pan
    }
  }

  private handleMobilePointerDown(
    _e: MouseEvent | TouchEvent,
    pos: { x: number; y: number },
    world: { x: number; y: number },
    noteAtPos: { step: number; pitch: number; duration: number; isNearHandle: boolean } | null
  ): void {
    // Check for double-tap
    const now = Date.now();
    const isDoubleTap =
      now - this.lastTapTime < DOUBLE_TAP_THRESHOLD_MS &&
      this.lastTapPos &&
      Math.abs(pos.x - this.lastTapPos.x) < 30 &&
      Math.abs(pos.y - this.lastTapPos.y) < 30;

    this.lastTapTime = now;
    this.lastTapPos = pos;

    if (isDoubleTap && noteAtPos) {
      // Cancel any pending single-tap action
      this.clearPendingTap();

      // Double-tap on note - toggle selection
      this.selectionManager?.toggle(noteAtPos.step, noteAtPos.pitch);
      this.onRenderRequest?.();
      this.pointerDown = false;
      return;
    }

    if (noteAtPos) {
      // Start drag or prepare for long-press resize
      this.mode = 'drag';
      this.dragStartWorldX = world.x;
      this.dragStartWorldY = world.y;

      if (this.selectionManager?.isSelected(noteAtPos.step, noteAtPos.pitch)) {
        this.dragNotes = this.selectionManager.getSelectedNotes();
      } else {
        this.dragNotes = [{ step: noteAtPos.step, pitch: noteAtPos.pitch }];
      }

      // Start long-press timer for resize
      this.longPressTimer = window.setTimeout(() => {
        this.handleLongPressOnNote(noteAtPos);
      }, LONG_PRESS_DURATION_MS);
    } else {
      // Empty grid
      if (this.selectionManager?.hasSelection) {
        // Long-press will paste
        this.longPressTimer = window.setTimeout(() => {
          this.handleLongPressPaste(world);
        }, LONG_PRESS_DURATION_MS);
      } else {
        // Long-press will start selection rectangle
        this.longPressTimer = window.setTimeout(() => {
          this.handleLongPressSelectionRect(world);
        }, LONG_PRESS_DURATION_MS);
      }
    }
  }

  // ============ Long Press Handlers ============

  private handleLongPressOnNote(
    noteAtPos: { step: number; pitch: number; duration: number }
  ): void {
    if (this.pointerMoved) return;

    this.longPressTriggered = true;
    this.mode = 'resize';
    this.resizeNote = {
      step: noteAtPos.step,
      pitch: noteAtPos.pitch,
      startDuration: noteAtPos.duration,
    };
    this.resizeStartWorldX = noteAtPos.step + noteAtPos.duration;
    this.dragNotes = [];

    this.onCancelPan?.();

    if (navigator.vibrate) {
      navigator.vibrate(50);
    }

    this.domElement.style.cursor = 'ew-resize';
  }

  private handleLongPressPaste(_world: { x: number; y: number }): void {
    if (this.pointerMoved) return;

    this.longPressTriggered = true;

    const cell = this.toGridCell(this.pointerStartX, this.pointerStartY);
    if (cell && this.onNotePaste) {
      this.onNotePaste(cell.step, cell.pitch);
    }

    this.onCancelPan?.();

    if (navigator.vibrate) {
      navigator.vibrate(50);
    }

    this.pointerDown = false;
  }

  private handleLongPressSelectionRect(world: { x: number; y: number }): void {
    if (this.pointerMoved) return;

    this.longPressTriggered = true;
    this.mode = 'select-rect';
    this.selectRectStart = world;

    this.onCancelPan?.();

    if (navigator.vibrate) {
      navigator.vibrate(50);
    }

    this.createSelectRectMesh();
  }

  private clearLongPressTimer(): void {
    if (this.longPressTimer !== null) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  // ============ Pending Tap (Mobile double-tap detection) ============

  private clearPendingTap(): void {
    if (this.pendingTapTimer !== null) {
      clearTimeout(this.pendingTapTimer);
      this.pendingTapTimer = null;
      this.pendingTapAction = null;
    }
  }

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

  // ============ Selection Rectangle ============

  private createSelectRectMesh(): void {
    if (this.selectRectMesh || !this.scene) return;

    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({
      color: SELECTION_RECT_COLOR,
      transparent: true,
      opacity: SELECTION_RECT_OPACITY,
      side: THREE.DoubleSide,
    });

    this.selectRectMesh = new THREE.Mesh(geometry, material);
    this.selectRectMesh.position.z = SELECTION_RECT_Z_POSITION;
    this.scene.add(this.selectRectMesh);
  }

  private updateSelectRectMesh(startX: number, startY: number, endX: number, endY: number): void {
    if (!this.selectRectMesh) {
      this.createSelectRectMesh();
    }

    if (this.selectRectMesh) {
      const minX = Math.min(startX, endX);
      const maxX = Math.max(startX, endX);
      const minY = Math.min(startY, endY);
      const maxY = Math.max(startY, endY);

      const width = maxX - minX;
      const height = maxY - minY;

      this.selectRectMesh.position.x = minX + width / 2;
      this.selectRectMesh.position.y = minY + height / 2;
      this.selectRectMesh.scale.set(width, height, 1);
      this.selectRectMesh.visible = true;
    }
  }

  private removeSelectRectMesh(): void {
    if (this.selectRectMesh && this.scene) {
      this.scene.remove(this.selectRectMesh);
      this.selectRectMesh.geometry.dispose();
      (this.selectRectMesh.material as THREE.Material).dispose();
      this.selectRectMesh = null;
    }
  }

  // ============ Pointer Move ============

  private onPointerMove(e: MouseEvent | TouchEvent): void {
    if (!this.pointerDown) return;

    const pos = getPointerPosition(e);
    const dx = pos.x - this.pointerStartX;
    const dy = pos.y - this.pointerStartY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > CLICK_THRESHOLD_PX) {
      this.pointerMoved = true;
      if (!this.longPressTriggered) {
        this.clearLongPressTimer();
      }
    }

    const world = this.toWorld(pos.x, pos.y);

    switch (this.mode) {
      case 'resize':
        this.handleResizeMove(e, world);
        break;
      case 'drag':
        this.handleDragMove(e, world);
        break;
      case 'select-rect':
        this.handleSelectRectMove(e, world);
        break;
    }
  }

  private handleResizeMove(e: MouseEvent | TouchEvent, world: { x: number; y: number }): void {
    if (!this.resizeNote) return;

    e.preventDefault();
    e.stopPropagation();

    const deltaX = world.x - this.resizeStartWorldX;
    let newDuration = this.resizeNote.startDuration + deltaX;
    newDuration = Math.max(
      MIN_NOTE_DURATION,
      Math.min(MAX_NOTE_DURATION, newDuration)
    );

    if (this.noteRenderer) {
      this.noteRenderer.updateNoteMesh(
        this.resizeNote.step,
        this.resizeNote.pitch,
        newDuration
      );
      this.onRenderRequest?.();
    }
  }

  private handleDragMove(e: MouseEvent | TouchEvent, world: { x: number; y: number }): void {
    if (this.dragNotes.length === 0 || !this.pointerMoved) return;

    e.preventDefault();
    e.stopPropagation();
    this.onCancelPan?.();

    // Calculate delta from drag start
    const deltaX = world.x - this.dragStartWorldX;
    const deltaY = world.y - this.dragStartWorldY;

    // Update note positions visually (doesn't change sequence data yet)
    if (this.noteRenderer) {
      this.noteRenderer.offsetNotes(this.dragNotes, deltaX, deltaY);
      this.onRenderRequest?.();
    }

    this.domElement.style.cursor = 'move';
  }

  private handleSelectRectMove(e: MouseEvent | TouchEvent, world: { x: number; y: number }): void {
    if (!this.selectRectStart) return;

    if (this.pointerMoved || this.longPressTriggered) {
      e.preventDefault();
      e.stopPropagation();
      this.onCancelPan?.();

      this.updateSelectRectMesh(
        this.selectRectStart.x,
        this.selectRectStart.y,
        world.x,
        world.y
      );
      this.onRenderRequest?.();
    }
  }

  // ============ Pointer Up ============

  private onPointerUp(e: MouseEvent | TouchEvent): void {
    if (!this.pointerDown) return;

    this.clearLongPressTimer();

    const pos = getPointerPosition(e);
    const world = this.toWorld(pos.x, pos.y);

    switch (this.mode) {
      case 'resize':
        this.handleResizeEnd(world);
        break;
      case 'drag':
        this.handleDragEnd(pos, world);
        break;
      case 'select-rect':
        this.handleSelectRectEnd(world);
        break;
      default:
        // No mode - might be a simple click
        this.handleSimpleClick(pos, world);
        break;
    }

    this.resetState();
  }

  private handleResizeEnd(world: { x: number; y: number }): void {
    if (!this.resizeNote) return;

    const deltaX = world.x - this.resizeStartWorldX;
    let newDuration = this.resizeNote.startDuration + deltaX;
    newDuration = Math.max(
      MIN_NOTE_DURATION,
      Math.min(MAX_NOTE_DURATION, newDuration)
    );

    if (this.onNoteResize) {
      this.onNoteResize(this.resizeNote.step, this.resizeNote.pitch, newDuration);
    }

    this.domElement.style.cursor = 'pointer';
  }

  private handleDragEnd(_pos: { x: number; y: number }, world: { x: number; y: number }): void {
    if (this.pointerMoved && this.dragNotes.length > 0) {
      // Complete drag
      const deltaX = world.x - this.dragStartWorldX;
      const deltaY = world.y - this.dragStartWorldY;

      // Convert Y delta to pitch delta
      const deltaPitch = Math.round(deltaY);

      if (this.onNoteMove && (Math.abs(deltaX) > 0.01 || deltaPitch !== 0)) {
        this.onNoteMove(this.dragNotes, deltaX, deltaPitch);
      } else {
        // Move wasn't large enough - reset visual positions
        this.noteRenderer?.resetNoteOffsets();
        this.onRenderRequest?.();
      }

      this.domElement.style.cursor = 'pointer';
    } else if (!this.pointerMoved && !this.longPressTriggered) {
      // Was a click, not a drag
      if (this.isMobile) {
        // Mobile tap on note - schedule delete (may be cancelled by double-tap)
        const noteAtPos = this.noteRenderer?.getNoteAtWorld(world.x, world.y, 0);
        if (noteAtPos && this.onNoteToggle) {
          const step = noteAtPos.step;
          const pitch = noteAtPos.pitch;
          this.schedulePendingTap(() => {
            if (this.onNoteToggle) {
              this.onNoteToggle({ step, pitch });
            }
          });
        }
      } else {
        // PC click
        const noteAtPos = this.noteRenderer?.getNoteAtWorld(world.x, world.y, 0);
        if (noteAtPos) {
          if (this.shiftKey) {
            // Shift+click - toggle selection
            this.selectionManager?.toggle(noteAtPos.step, noteAtPos.pitch);
            this.onRenderRequest?.();
          } else {
            // Click - delete note
            if (this.onNoteToggle) {
              this.onNoteToggle({ step: noteAtPos.step, pitch: noteAtPos.pitch });
            }
          }
        } else {
          // Click on empty - deselect all
          this.selectionManager?.clear();
          this.onRenderRequest?.();
        }
      }
    }
  }

  private handleSelectRectEnd(world: { x: number; y: number }): void {
    if (this.selectRectStart && (this.pointerMoved || this.longPressTriggered)) {
      // Select notes in rectangle (dragged)
      const minX = Math.min(this.selectRectStart.x, world.x);
      const maxX = Math.max(this.selectRectStart.x, world.x);
      const minY = Math.min(this.selectRectStart.y, world.y);
      const maxY = Math.max(this.selectRectStart.y, world.y);

      const notesInRect = this.noteRenderer?.getNotesInRegion(minX, maxX, minY, maxY) ?? [];

      if (notesInRect.length > 0) {
        this.selectionManager?.setSelection(notesInRect);
      }

      // Mark that selection rect was used (prevents paste on contextmenu)
      this.selectRectWasUsed = true;

      this.onRenderRequest?.();
    } else if (!this.pointerMoved && !this.longPressTriggered) {
      // Click on empty without drag
      // For PC right-click: let contextmenu handle paste
      // For mobile long-press: handled separately
      if (!this.isMobile && this.pointerButton === 2) {
        // PC right-click without drag - contextmenu will handle paste
        // Do nothing here
      } else if (this.selectionManager?.hasSelection) {
        // Has selection - just deselect all
        this.selectionManager.clear();
        this.onRenderRequest?.();
      } else {
        // No selection - add note at click position
        const cell = this.toGridCell(this.pointerStartX, this.pointerStartY);
        if (cell && this.onNoteToggle) {
          this.onNoteToggle(cell);
        }
      }
    }

    this.removeSelectRectMesh();
  }

  private handleSimpleClick(pos: { x: number; y: number }, world: { x: number; y: number }): void {
    if (this.pointerMoved || this.longPressTriggered) return;

    const noteAtPos = this.noteRenderer?.getNoteAtWorld(world.x, world.y, 0);

    if (this.isMobile) {
      // Mobile: tap on empty adds note or deselects
      if (!noteAtPos) {
        if (this.selectionManager?.hasSelection) {
          this.selectionManager.clear();
          this.onRenderRequest?.();
        } else {
          const cell = this.toGridCell(pos.x, pos.y);
          if (cell && this.onNoteToggle) {
            this.onNoteToggle(cell);
          }
        }
      }
    } else {
      // PC: left-click on empty adds note or deselects
      if (!noteAtPos && this.pointerButton === 0) {
        if (this.selectionManager?.hasSelection) {
          this.selectionManager.clear();
          this.onRenderRequest?.();
        } else {
          const cell = this.toGridCell(pos.x, pos.y);
          if (cell && this.onNoteToggle) {
            this.onNoteToggle(cell);
          }
        }
      }
    }
  }

  private resetState(): void {
    this.pointerDown = false;
    this.pointerMoved = false;
    this.mode = 'none';
    this.resizeNote = null;
    this.dragNotes = [];
    this.selectRectStart = null;
    this.longPressTriggered = false;
  }

  // ============ Cleanup ============

  dispose(): void {
    this.detachEvents();
    this.removeSelectRectMesh();
    this.clearLongPressTimer();
    this.clearPendingTap();
  }
}
