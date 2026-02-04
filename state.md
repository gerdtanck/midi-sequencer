# MIDI Step Sequencer - Project State

## Project Overview

A browser-based MIDI step sequencer built with TypeScript, Three.js, and Web MIDI API. Features a piano roll interface for composing MIDI sequences that can be sent to external MIDI devices or software.

**Repository**: https://github.com/gerdtanck/midi-sequencer

## Technology Stack

- **Frontend**: TypeScript, Vite
- **Rendering**: Three.js (WebGL-based grid and note visualization)
- **MIDI**: Web MIDI API via custom MidiManager
- **Styling**: CSS custom properties for theming

## Current Features

### Core Functionality
- **Step Sequencer Grid**: Piano roll with configurable bars (1-128) and octaves (1-10)
- **Note Editing**: Click to add/remove notes, drag to move, resize via handle (PC) or long-press (mobile)
- **Selection System**: Shift+click (PC) or double-tap (mobile) to select, right-drag for selection rectangle
- **Copy/Paste**: Right-click (PC) or long-press (mobile) to paste selected notes
- **Undo/Redo**: Command pattern implementation with Ctrl+Z/Y and UI buttons
- **Playback**: Lookahead scheduler for precise timing, MIDI clock generation

### Substep Resolution
- Notes can be positioned at 1/6 substep resolution (supports triplets)
- PlaybackEngine ticks at substep resolution for accurate triggering
- `snapToSubstep()` utility for position quantization

### Visual Features
- **Piano Key Backgrounds**: White/black key rows distinguished by color
- **Piano Keys Overlay**: Interactive sidebar showing note names, synced with grid scroll
- **Bar Indicators**: Top bar showing measure numbers
- **Playback Indicator**: Green vertical line showing current position
- **Loop Markers**: Orange vertical lines (draggable) marking loop region

### Note Audition
- Notes play when created (click on empty grid)
- Notes play when pasted
- Notes play during drag when crossing pitch boundaries
- Auto-stop after 150ms for create/paste

### Mobile Support
- PWA manifest for fullscreen experience
- Touch-optimized interactions (tap, double-tap, long-press, pinch-zoom)
- Fullscreen button in transport controls

### Input System
- Unified InputManager for event handling
- NoteInteractionController for note-specific interactions
- GridControls for pan/zoom

## Architecture

### Key Files

```
src/
├── config/
│   └── GridConfig.ts          # Constants, grid configuration
├── core/
│   ├── Sequence.ts            # Note storage (sparse Map), loop markers
│   ├── PlaybackEngine.ts      # Playback with substep resolution
│   ├── SelectionManager.ts    # Multi-note selection
│   ├── commands/              # Undo/redo command pattern
│   │   ├── Command.ts         # Interface + CommandHistory
│   │   ├── ToggleNoteCommand.ts
│   │   ├── MoveNotesCommand.ts
│   │   ├── ResizeNoteCommand.ts
│   │   └── PasteNotesCommand.ts
│   └── types.ts               # Note, LoopMarkers interfaces
├── midi/
│   └── MidiManager.ts         # Web MIDI API wrapper
├── scheduler/
│   ├── LookaheadScheduler.ts  # Precise event scheduling
│   └── MidiClockGenerator.ts  # MIDI clock output
├── ui/
│   ├── grid/
│   │   ├── NoteGrid.ts        # Main grid orchestrator
│   │   ├── GridLines.ts       # Grid rendering + row backgrounds
│   │   ├── GridControls.ts    # Pan/zoom handling
│   │   ├── NoteRenderer.ts    # Note mesh management
│   │   ├── NoteInteractionController.ts  # Click/drag/resize
│   │   ├── PlaybackIndicator.ts
│   │   └── LoopMarkersOverlay.ts  # Draggable loop region
│   ├── overlays/
│   │   ├── PianoKeys.ts       # Piano keyboard sidebar
│   │   └── BarIndicators.ts   # Measure numbers
│   ├── controls/
│   │   └── TransportControls.ts  # Play/stop, BPM, undo/redo, fullscreen
│   └── input/
│       └── InputManager.ts    # Unified event handling
├── utils/
│   ├── CoordinateUtils.ts     # Screen/world/grid conversions
│   ├── TimeUtils.ts           # Substep snapping
│   └── PlatformUtils.ts       # Device detection
└── main.ts                    # App initialization
```

### Key Patterns

- **Sparse Storage**: Notes stored in `Map<step, Note[]>` for memory efficiency
- **Command Pattern**: All note modifications go through CommandHistory for undo/redo
- **Callback-based Communication**: Components communicate via callbacks (e.g., `onNoteToggle`, `onNoteAudition`)
- **Change Listeners**: Sequence emits changes, NoteRenderer subscribes for auto-update

## Known Issues

### Loop Marker Mobile Bug (Unresolved)
**Symptom**: After dragging a loop marker to a new position on mobile, the next tap on the grid causes the moved marker to shift one additional step in the same direction it was previously moved.

**Observations**:
- Not immediately after the drag - happens on the NEXT interaction
- Consistently moves in the direction of the previous drag
- Only happens on mobile (touch events)

**Attempted Fixes (all reverted)**:
1. Ignoring synthetic events within 100ms of drag end - didn't help
2. Requiring minimum movement threshold before position updates - didn't help

**Suspected Causes to Investigate**:
- Some state being retained from previous drag
- Event listener ordering/priority issues
- Touch event peculiarities on mobile browsers
- Possible interaction between LoopMarkersOverlay and other touch handlers

## Configuration

### Grid Constants (GridConfig.ts)
- `STEPS_PER_BAR`: 16
- `SUBSTEPS_PER_STEP`: 6 (for triplet support)
- `BASE_MIDI`: 36 (C2)
- `DEFAULT_BARS`: 4
- `DEFAULT_OCTAVES`: 3

### Colors
- Note: `0xe94560` (red/pink)
- Selected: `0x4a9eff` (blue)
- Playhead: `0x00ff88` (green)
- Loop Markers: `0xffa500` (orange)
- White Key Row: `0x1a1a2e`
- Black Key Row: `0x12121f`

## Development Commands

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run preview  # Preview production build
```

## Next Steps / Ideas

1. **Fix loop marker mobile bug** - needs deeper investigation
2. **Save/Load sequences** - localStorage or file export
3. **Multiple sequences/tracks** - currently single sequence
4. **Velocity editing** - visual representation and editing
5. **Swing/groove** - timing adjustments
6. **MIDI input** - record from external devices
7. **Pattern chaining** - arrange multiple patterns

## Session Date
February 5, 2026
