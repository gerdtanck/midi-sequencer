# MIDI Sequencer - Project Summary

## Overview

A browser-based MIDI step sequencer built with TypeScript and Three.js. The application provides a piano roll interface for creating and editing MIDI sequences with real-time playback to external MIDI devices.

**Repository:** https://github.com/gerdtanck/midi-sequencer
**Version:** 0.0.1

---

## Technology Stack

### Core Technologies
| Technology | Version | Purpose |
|------------|---------|---------|
| TypeScript | 5.3.3 | Type-safe development |
| Three.js | 0.162.0 | WebGL-based grid rendering |
| WebMidi.js | 3.1.0 | Cross-browser MIDI API |
| Vite | 5.2.0 | Build tool and dev server |

### Development Tools
- **ESLint** - Code linting with TypeScript support
- **Prettier** - Code formatting
- **TypeScript Compiler** - Type checking and transpilation

---

## Architecture

### Directory Structure

```
src/
├── config/           # Configuration constants
│   └── GridConfig.ts # Grid dimensions, colors, thresholds
├── core/             # Core domain logic
│   ├── commands/     # Command pattern (undo/redo)
│   ├── Sequence.ts   # Note storage and manipulation
│   ├── SequenceManager.ts # Multi-sequence management
│   ├── PlaybackEngine.ts  # Timing and scheduling
│   ├── SelectionManager.ts # Note selection state
│   ├── Scale.ts      # Scale definitions
│   └── ScaleManager.ts # Scale state and quantization
├── midi/             # MIDI I/O layer
│   ├── MidiManager.ts # Device management, note sending
│   └── NoteTracker.ts # Active note tracking for panic
├── scheduler/        # Timing infrastructure
│   ├── LookaheadScheduler.ts # Lookahead event scheduling
│   └── MidiClockGenerator.ts # MIDI clock (24 PPQ)
├── ui/               # User interface
│   ├── controls/     # Toolbar components
│   ├── grid/         # Three.js grid components
│   ├── overlays/     # HTML overlay components
│   ├── input/        # Input event handling
│   └── KeyboardShortcuts.ts # Global hotkeys
├── utils/            # Utility functions
└── main.ts           # Application entry point
```

### Design Patterns

#### Command Pattern
All note operations use the Command pattern for undo/redo:
- `AddNoteCommand` / `RemoveNoteCommand`
- `MoveNotesCommand` / `ResizeNoteCommand`
- `PasteNotesCommand` / `ChangeVelocityCommand`
- Transform commands: `NudgeNotesCommand`, `TransposeNotesCommand`, `ReverseNotesCommand`, `RandomizeCommand`, `QuantizeCommand`, `ClearSequenceCommand`, `SetLengthCommand`

#### Observer Pattern
Components communicate via change listeners:
- `Sequence.onChange()` - Notifies when notes change
- `SequenceManager.onActiveChange()` - Notifies when active sequence changes
- `ScaleManager.onChange()` - Notifies when scale changes
- `CommandHistory.onChange()` - Notifies for undo/redo state

#### Sparse Storage
Notes use `Map<step, Note[]>` for memory efficiency - only populated steps consume memory.

---

## Features

### Multi-Sequence Support
- **4 independent sequences** playing simultaneously
- Each sequence has its own:
  - MIDI channel (1-16, defaults to channels 1-4)
  - Loop markers (start/end positions)
  - Note data
- **Global settings** shared across sequences:
  - BPM/tempo
  - Grid dimensions (bars, octaves)
- UI buttons (1-4) switch between sequences for editing

### Note Grid
- **Three.js WebGL rendering** for smooth pan/zoom
- **Configurable dimensions:**
  - 1-128 bars (default: 4)
  - 1-10 octaves (default: 3)
  - 16 steps per bar (16th notes)
- **Sub-step resolution:** 6 substeps per step (supports triplets)
- **Visual hierarchy:**
  - Bar lines (thick)
  - Quarter note lines (medium)
  - Step lines (thin)
  - Octave lines (horizontal, thick)
  - Semitone lines (horizontal, thin)

### Note Editing
- **Click** to add/remove notes
- **Drag** to move notes (supports sub-step positioning)
- **Drag right edge** to resize note duration
- **Ctrl+drag** (or long-press on mobile) to adjust velocity
- **Box selection** for multi-note operations
- **Copy/paste** selected notes

### Scale System
- **13 built-in scales:**
  - Chromatic (all notes)
  - Major, Minor (Natural), Harmonic Minor, Melodic Minor
  - Pentatonic Major, Pentatonic Minor, Blues
  - Modes: Dorian, Phrygian, Lydian, Mixolydian, Locrian
- **Root note selection** (C through B)
- **Snap to scale** - Constrains notes to scale degrees
- **Visual highlighting** - Scale notes shown on grid

### Transform Operations
Operations can target: **All notes**, **Selected notes**, or **Loop region**

| Operation | Description |
|-----------|-------------|
| Nudge | Shift notes left/right by steps |
| Transpose | Shift notes up/down by semitones |
| Reverse | Mirror notes in time |
| Quantize | Snap notes to nearest step |
| Set Length | Set all notes to specific duration |
| Randomize | Randomize velocity, timing, pitch, step, length, or permute pitches |
| Clear | Delete notes |

### Playback Engine
- **Lookahead scheduling** compensates for JavaScript timing drift
- **MIDI clock output** at 24 PPQ (pulses per quarter note)
- **Per-sequence state:**
  - Independent loop boundaries
  - Independent playback position
- **Playback indicator** shows current position on grid

### MIDI Integration
- **WebMIDI API** via webmidi.js library
- **Device hot-plug** detection
- **Note tracking** for stuck note prevention
- **Panic function** - Three-layer all-notes-off:
  1. Note Off for tracked active notes
  2. CC 123 (All Notes Off) on all channels
  3. CC 120 (All Sound Off) on all channels
- **Transport messages:** Start (0xFA), Stop (0xFC), Clock (0xF8)

### Keyboard Shortcuts
| Key | Action |
|-----|--------|
| Space | Play/Stop |
| Escape | Stop |
| P | Panic (all notes off) |
| Ctrl+Z | Undo |
| Ctrl+Y / Ctrl+Shift+Z | Redo |
| Arrow Left/Right | Nudge selected notes |
| Arrow Up/Down | Transpose selected notes |

### Undo/Redo System
- **Unlimited history** for all note operations
- **Command-based** - Each operation is a reversible command
- **UI integration** - Buttons update enabled state

---

## Configuration

### Grid Constants (GridConfig.ts)

```typescript
// Grid dimensions
STEPS_PER_BAR = 16
STEPS_PER_QUARTER = 4
SEMITONES_PER_OCTAVE = 12
SUBSTEPS_PER_STEP = 6

// Defaults
DEFAULT_BARS = 4
DEFAULT_OCTAVES = 3
DEFAULT_NOTE_DURATION = 0.8
DEFAULT_NOTE_VELOCITY = 100

// MIDI
BASE_MIDI = 36  // C2

// Interaction thresholds
CLICK_THRESHOLD_PX = 5
LONG_PRESS_DURATION_MS = 400
```

### CSS Variables (styles.css)

```css
/* Grid colors */
--grid-background: #1a1a2e
--bar-line-color: #e0e0e0
--quarter-line-color: #6a6a8a
--step-line-color: #3a3a4e
--octave-line-color: #7a7a9a
--semitone-line-color: #2e2e3e

/* UI colors */
--control-background: #16213e
--control-text: #e0e0e0
--control-accent: #e94560

/* Note colors */
--note-color: #e94560
--note-selected-color: #ff6b8a
```

---

## Data Structures

### Note
```typescript
interface Note {
  pitch: number;        // MIDI note 0-127
  velocity: number;     // 0-127
  duration: number;     // Multiplier of step length
  originalPitch?: number; // For scale quantization
}
```

### Loop Markers
```typescript
interface LoopMarkers {
  start: number;  // Start step (inclusive)
  end: number;    // End step (exclusive)
}
```

### Sequence Storage
```typescript
// Sparse map: only steps with notes are stored
Map<step: number, notes: Note[]>
```

---

## Building and Running

### Development
```bash
npm install
npm run dev
```

### Production Build
```bash
npm run build
npm run preview
```

### Scripts
| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | TypeScript compile + Vite build |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run format` | Run Prettier |

---

## Browser Compatibility

Requires browsers with:
- **WebMIDI API** support (Chrome, Edge, Opera)
- **WebGL** support
- **ES2020** JavaScript features

Note: Firefox requires a WebMIDI polyfill or extension.

---

## Future Considerations

The architecture supports future enhancements such as:
- Sequence copy/swap operations
- MIDI input recording
- Pattern chaining
- Export to MIDI file
- Additional scales and modes
- Velocity/CC automation lanes
