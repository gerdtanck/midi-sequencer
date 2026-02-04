# MIDI Sequencer Refactoring Plan

## Overview

This plan addresses technical debt identified in the codebase review. Each phase is self-contained, testable, and builds toward a cleaner architecture.

**Guiding Principles:**
- Each phase produces working code
- No feature regressions between phases
- Test manually after each phase before proceeding
- Keep commits atomic and reversible

---

## Phase 1: Extract Shared Utilities

**Goal:** Remove code duplication by extracting common utilities.

**Files to Create:**
- `src/utils/CoordinateUtils.ts` - Screen/world/grid coordinate conversions
- `src/utils/PlatformUtils.ts` - Device detection (mobile, touch support)
- `src/utils/index.ts` - Barrel export

**Files to Modify:**
- `src/ui/grid/GridControls.ts` - Use CoordinateUtils
- `src/ui/grid/NoteInteractionController.ts` - Use CoordinateUtils, PlatformUtils
- `src/ui/grid/NoteRenderer.ts` - Use PlatformUtils

**Deliverables:**
1. `CoordinateUtils` with:
   - `screenToWorld(camera, domElement, screenX, screenY)`
   - `worldToGridCell(worldX, worldY, baseNote)`
   - `gridCellToWorld(step, pitch, baseNote)`

2. `PlatformUtils` with:
   - `isTouchDevice()`
   - `isMobile()` (optional, for future use)

**Verification:**
- All existing interactions work identically
- No TypeScript errors
- Console shows no errors during pan, zoom, note operations

**Estimated Scope:** ~150 lines new, ~50 lines removed

---

## Phase 2: Consolidate Configuration Constants

**Goal:** Move all magic numbers to centralized configuration.

**Files to Modify:**
- `src/config/GridConfig.ts` - Add interaction constants

**Files to Update:**
- `src/ui/grid/NoteInteractionController.ts` - Import from config
- `src/ui/grid/NoteRenderer.ts` - Import from config

**New Constants to Add:**
```typescript
// Interaction thresholds
export const CLICK_THRESHOLD_PX = 5;
export const DOUBLE_TAP_THRESHOLD_MS = 300;
export const LONG_PRESS_DURATION_MS = 400;

// Note editing
export const HANDLE_ZONE_WIDTH = 0.33;
export const MIN_NOTE_DURATION = 0.1;
export const MAX_NOTE_DURATION = 8.0;
export const DEFAULT_NOTE_DURATION = 0.8;
export const DEFAULT_NOTE_VELOCITY = 100;

// Visual
export const NOTE_COLOR = 0xe94560;
export const NOTE_SELECTED_COLOR = 0x4a9eff;
export const NOTE_Z_POSITION = 0.5;
```

**Verification:**
- Change a constant, verify behavior changes accordingly
- All interactions work as before

**Estimated Scope:** ~30 lines new, ~20 lines modified

---

## Phase 3: Extract Input Event Manager

**Goal:** Create unified input handling layer that routes events to appropriate handlers.

**Files to Create:**
- `src/ui/input/InputManager.ts` - Central event dispatcher
- `src/ui/input/InputEvent.ts` - Normalized input event type
- `src/ui/input/index.ts` - Barrel export

**Design:**
```typescript
interface NormalizedPointerEvent {
  type: 'down' | 'move' | 'up';
  screenX: number;
  screenY: number;
  worldX: number;
  worldY: number;
  button: number;          // 0=left, 2=right
  shiftKey: boolean;
  isTouchEvent: boolean;
  touchCount: number;
  timestamp: number;
}

interface InputHandler {
  priority: number;        // Lower = higher priority
  onPointerDown(e: NormalizedPointerEvent): boolean;  // Return true to claim
  onPointerMove(e: NormalizedPointerEvent): void;
  onPointerUp(e: NormalizedPointerEvent): void;
  onWheel?(e: WheelEvent): boolean;
  onContextMenu?(e: MouseEvent): boolean;
}

class InputManager {
  private handlers: InputHandler[] = [];
  private activeHandler: InputHandler | null = null;

  register(handler: InputHandler): void;
  unregister(handler: InputHandler): void;
}
```

**Files to Modify:**
- `src/ui/grid/NoteGrid.ts` - Create InputManager, pass to components

**Verification:**
- Events still reach GridControls and NoteInteractionController
- No double-handling of events
- Pan, zoom, note interactions all work

**Estimated Scope:** ~200 lines new

---

## Phase 4: Refactor GridControls as InputHandler

**Goal:** Convert GridControls to implement InputHandler interface.

**Files to Modify:**
- `src/ui/grid/GridControls.ts` - Implement InputHandler, remove direct event attachment

**Changes:**
1. Implement `InputHandler` interface
2. Remove `attachEvents()` / `detachEvents()`
3. Convert mouse/touch handlers to use `NormalizedPointerEvent`
4. Set priority lower than note interactions (pan is fallback)

**Verification:**
- Pan with mouse drag works
- Zoom with scroll wheel works
- Pinch-to-zoom on mobile works
- Camera bounds still enforced

**Estimated Scope:** ~100 lines modified

---

## Phase 5: Split NoteInteractionController into Handlers

**Goal:** Break monolithic controller into focused handler classes.

**Files to Create:**
- `src/ui/input/handlers/NoteClickHandler.ts` - Click to add/delete notes
- `src/ui/input/handlers/NoteResizeHandler.ts` - Drag handle to resize
- `src/ui/input/handlers/NoteDragHandler.ts` - Drag notes to move
- `src/ui/input/handlers/SelectionRectHandler.ts` - Rectangle selection
- `src/ui/input/handlers/SelectionClickHandler.ts` - Shift-click, double-tap selection

**Files to Modify/Remove:**
- `src/ui/grid/NoteInteractionController.ts` - Eventually remove or slim down

**Handler Priorities (lower = checked first):**
1. `NoteResizeHandler` (10) - Handle drag takes precedence
2. `NoteDragHandler` (20) - Dragging selected notes
3. `SelectionRectHandler` (30) - Drawing selection box
4. `SelectionClickHandler` (40) - Selection toggles
5. `NoteClickHandler` (50) - Add/remove notes
6. `GridControls` (100) - Pan/zoom fallback

**Approach:**
- Extract one handler at a time
- Keep NoteInteractionController as coordinator initially
- Test after each extraction
- Remove old code only after new handler verified

**Sub-phases:**
- 5a: Extract NoteResizeHandler
- 5b: Extract NoteDragHandler
- 5c: Extract SelectionRectHandler
- 5d: Extract NoteClickHandler + SelectionClickHandler
- 5e: Remove NoteInteractionController remnants

**Verification (after each sub-phase):**
- Specific interaction works correctly
- Other interactions unaffected
- PC and mobile both work

**Estimated Scope:** ~600 lines new, ~700 lines removed/refactored

---

## Phase 6: Add Command Pattern for Undo/Redo

**Goal:** Wrap note mutations in reversible commands.

**Files to Create:**
- `src/core/commands/Command.ts` - Command interface
- `src/core/commands/CommandHistory.ts` - Undo/redo stack
- `src/core/commands/ToggleNoteCommand.ts`
- `src/core/commands/MoveNotesCommand.ts`
- `src/core/commands/ResizeNoteCommand.ts`
- `src/core/commands/PasteNotesCommand.ts`
- `src/core/commands/index.ts`

**Design:**
```typescript
interface Command {
  execute(): void;
  undo(): void;
  description: string;  // For UI display
}

class CommandHistory {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxHistory = 100;

  execute(command: Command): void;
  undo(): Command | null;
  redo(): Command | null;
  canUndo(): boolean;
  canRedo(): boolean;
  clear(): void;
}
```

**Files to Modify:**
- `src/ui/grid/NoteGrid.ts` - Use CommandHistory for note operations
- `src/ui/KeyboardShortcuts.ts` - Add Ctrl+Z, Ctrl+Y bindings
- Input handlers - Execute commands instead of direct mutations

**Verification:**
- Add notes, Ctrl+Z removes them
- Move notes, Ctrl+Z moves them back
- Redo works after undo
- History clears on new action after undo

**Estimated Scope:** ~300 lines new, ~50 lines modified

---

## Phase 7: Clean Up NoteGrid (Optional)

**Goal:** Reduce NoteGrid responsibilities through composition.

**Approach:**
- Extract overlay management to `OverlayManager`
- Consider `GridScene` wrapper for Three.js setup
- NoteGrid becomes thin coordinator

**This phase is optional and depends on future feature needs.**

---

## Implementation Order Summary

| Phase | Name | Dependencies | Risk |
|-------|------|--------------|------|
| 1 | Extract Utilities | None | Low |
| 2 | Consolidate Config | None | Low |
| 3 | Input Manager | Phase 1 | Medium |
| 4 | GridControls Refactor | Phase 3 | Medium |
| 5 | Split Interaction Controller | Phases 3, 4 | High |
| 6 | Command Pattern | Phase 5 | Medium |
| 7 | NoteGrid Cleanup | Phase 5 | Low |

---

## Testing Checklist (Use After Each Phase)

### PC Interactions
- [ ] Click empty cell → adds note
- [ ] Click existing note → removes note
- [ ] Click empty with selection → deselects all
- [ ] Shift+click note → toggles selection
- [ ] Drag on empty → pan
- [ ] Drag selection rectangle → selects notes in area
- [ ] Drag on note → moves note(s)
- [ ] Drag resize handle → changes note duration
- [ ] Right-click with selection → pastes notes
- [ ] Scroll wheel → zoom at cursor
- [ ] Zoom respects grid bounds

### Mobile Interactions
- [ ] Tap empty cell → adds note
- [ ] Tap existing note → removes note (with delay for double-tap detection)
- [ ] Tap empty with selection → deselects all
- [ ] Double-tap note → toggles selection
- [ ] Single finger drag → pan
- [ ] Pinch → zoom
- [ ] Drag on note → moves note(s)
- [ ] Long-press note → resize mode
- [ ] Long-press empty (no selection) → selection rectangle
- [ ] Long-press empty (with selection) → paste

### Playback
- [ ] Play button starts playback
- [ ] Stop button stops playback
- [ ] Playback indicator moves correctly
- [ ] Notes trigger MIDI output
- [ ] Space bar toggles play/stop

### MIDI
- [ ] Enable MIDI button works
- [ ] Device selection works
- [ ] Piano keys send note on/off
- [ ] Panic button silences all

---

## Notes

- Commit after each phase with clear message
- If a phase introduces bugs, fix before proceeding
- Phases 1-2 are quick wins, do first
- Phase 5 is the biggest and most valuable refactor
- Phase 6 enables undo/redo feature request
