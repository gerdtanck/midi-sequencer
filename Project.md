# Web MIDI Sequencer

## What This Is

A web-based MIDI step sequencer with a Three.js-powered note grid. It runs in modern browsers on both desktop and mobile devices, sending MIDI to external hardware synthesizers via WebMIDI. The sequencer provides a tactile, visual interface for creating and manipulating musical patterns.

## Core Value

A responsive, zoomable piano roll that works equally well with mouse, keyboard, and touch input. Notes are edited visually and played back through external MIDI hardware, making it a bridge between software composition and hardware synthesis.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Application                              │
├─────────────────────────────────────────────────────────────────┤
│  UI Layer                                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ NoteGrid     │  │ Transport    │  │ Device Picker        │  │
│  │ (Three.js)   │  │ Controls     │  │                      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  Core Layer                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Sequence     │  │ Playback     │  │ MIDI Manager         │  │
│  │ (Note Data)  │  │ Engine       │  │ (WebMIDI)            │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  Scheduling Layer                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Lookahead Scheduler (compensates for JS timing drift)    │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Technology Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Grid Rendering | Three.js (WebGL) | Smooth zoom/pan, high performance |
| Grid Interaction | Custom controllers | Hit testing, note editing |
| Audio Timing | Lookahead Scheduler | Compensates for GC pauses, background tabs |
| MIDI | WebMIDI API | Browser-native MIDI support |
| Build | Vite | Fast development, ES modules |
| Language | TypeScript | Type safety, better tooling |

## Requirements

### v1.0 - Core Sequencer

**Grid & Visualization**
- [ ] Three.js note grid with configurable bars (1-32) and octaves (2-5)
- [ ] Piano keys overlay (fixed position, synced with grid scroll)
- [ ] Bar indicators overlay (fixed position, synced with grid scroll)
- [ ] Smooth pan via drag (mouse and touch)
- [ ] Smooth zoom via mousewheel and pinch gesture
- [ ] Playback position indicator (vertical line moving through grid)

**Note Editing**
- [ ] Click/tap to toggle notes on grid
- [ ] Notes display as horizontal bars on grid
- [ ] Note duration editing (drag right edge to extend/shorten)
- [ ] Note audition on click (play note through MIDI when placed)

**Playback**
- [ ] Start/stop transport controls
- [ ] BPM control (40-240 range)
- [ ] Loop playback (sequence repeats continuously)
- [ ] Lookahead scheduling for accurate timing

**MIDI**
- [ ] WebMIDI device enumeration
- [ ] Device selection dropdown
- [ ] Note output to selected device
- [ ] Panic button (all notes off)

### v1.1 - Enhanced Editing

- [ ] Multi-note selection (shift+click, drag rectangle)
- [ ] Copy/paste selected notes
- [ ] Note velocity editing (visual indicator + adjustment)
- [ ] Undo/redo for note operations

### v1.2 - Transformations

- [ ] Nudge (shift notes left/right with wrap)
- [ ] Transpose (shift notes up/down)
- [ ] Reverse (mirror note positions)
- [ ] Randomize pitch (within scale constraints)
- [ ] Randomize timing
- [ ] Randomize velocity
- [ ] Clear all notes

### v1.3 - Scale System

- [ ] Scale selector (chromatic, major, minor, pentatonic, blues, modes)
- [ ] Root note selector (C through B)
- [ ] Scale overlay visualization (highlight in-scale rows)
- [ ] Snap-to-scale option for note placement
- [ ] Quantize existing notes to scale

### v1.4 - Multiple Sequences

- [ ] 4 sequence tabs
- [ ] Independent MIDI channel per sequence
- [ ] Independent loop markers per sequence
- [ ] All sequences play simultaneously
- [ ] Sequence copy/swap operations

### Future Considerations (Out of Scope for v1.x)

- Save/load sequences (localStorage or file export)
- MIDI file import/export
- MIDI clock sync (receive external tempo)
- Audio playback (internal synth)
- Recording from external MIDI input
- Chord mode / pattern generators

## Milestone Roadmap

### Milestone 1: Project Foundation
**Goal:** Unified codebase with build system and basic structure

- Phase 1.1: Project Setup
  - Initialize Vite + TypeScript project
  - Configure ESLint, Prettier
  - Set up folder structure (src/ui, src/core, src/midi, src/scheduler)
  - Import Three.js notegrid components

- Phase 1.2: Core Integration
  - Port Sequence class from reference implementation
  - Port basic type definitions
  - Create application entry point
  - Verify grid renders with new build system

### Milestone 2: Note Interaction
**Goal:** Users can add and remove notes on the grid

- Phase 2.1: Hit Testing
  - Implement grid coordinate calculation from mouse/touch events
  - Handle Three.js world coordinate conversion
  - Create NoteInteractionController class

- Phase 2.2: Note Rendering
  - Add note meshes to Three.js scene
  - Create NoteRenderer class (manages note geometry)
  - Implement note add/remove visual updates

- Phase 2.3: Click-to-Toggle
  - Wire hit testing to Sequence.toggleNote()
  - Handle touch events (tap to toggle)
  - Implement note audition (preview sound on place)

### Milestone 3: MIDI Playback
**Goal:** Notes play through external MIDI hardware

- Phase 3.1: MIDI Infrastructure
  - Port MidiManager from reference implementation
  - Implement device enumeration and selection
  - Add panic button functionality

- Phase 3.2: Lookahead Scheduler
  - Port LookaheadScheduler from reference
  - Implement timing compensation for background tabs
  - Create scheduling tests

- Phase 3.3: Playback Engine
  - Port PlaybackEngine (simplified for single sequence)
  - Implement start/stop logic
  - Wire to MIDI output

- Phase 3.4: Transport UI
  - Create TransportControls component
  - BPM slider/input
  - Play/stop buttons
  - Playback position indicator on grid

### Milestone 4: Desktop + Mobile Polish
**Goal:** Smooth experience on both platforms

- Phase 4.1: Input Refinement
  - Test and fix mouse interactions (hover, click, drag)
  - Test and fix touch interactions (tap, pan, pinch)
  - Add keyboard shortcuts (space = play/stop, etc.)

- Phase 4.2: Responsive Layout
  - Adapt UI layout for different screen sizes
  - Test on phone, tablet, desktop viewports
  - Ensure piano keys and bar indicators scale properly

- Phase 4.3: Performance Optimization
  - Profile rendering performance
  - Optimize note mesh creation/destruction
  - Ensure 60fps on target devices

### Milestone 5: Note Duration Editing
**Goal:** Users can adjust note lengths

- Phase 5.1: Duration Visualization
  - Render notes with correct width based on duration
  - Add visual handle on note right edge

- Phase 5.2: Drag-to-Resize
  - Detect drag on note edge vs note body
  - Implement drag-to-resize logic
  - Clamp minimum/maximum duration

## File Structure (Target)

```
src/
├── main.ts                 # Application entry point
├── config/
│   └── GridConfig.ts       # Grid dimensions, colors, constants
├── core/
│   ├── Sequence.ts         # Note data storage and manipulation
│   ├── types.ts            # Core type definitions
│   └── PlaybackEngine.ts   # Drives sequence playback
├── midi/
│   ├── MidiManager.ts      # WebMIDI device management
│   ├── NoteTracker.ts      # Tracks active notes (for panic)
│   └── types.ts            # MIDI-specific types
├── scheduler/
│   ├── LookaheadScheduler.ts  # Precise timing with lookahead
│   └── types.ts
├── ui/
│   ├── grid/
│   │   ├── NoteGrid.ts        # Main Three.js grid (from notegrid/)
│   │   ├── GridLines.ts       # Grid line rendering
│   │   ├── GridControls.ts    # Pan/zoom handling
│   │   ├── NoteRenderer.ts    # Note mesh management
│   │   └── NoteInteraction.ts # Hit testing, note editing
│   ├── overlays/
│   │   ├── PianoKeys.ts       # Piano keyboard overlay
│   │   └── BarIndicators.ts   # Bar number overlay
│   ├── controls/
│   │   ├── TransportControls.ts  # Play/stop, BPM
│   │   ├── DevicePicker.ts       # MIDI device selection
│   │   └── PanicButton.ts        # Emergency stop
│   └── styles.css
├── index.html
└── vite.config.ts
```

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Three.js over Canvas 2D | Existing notegrid has smooth zoom/pan; WebGL enables future effects |
| TypeScript | Type safety, better IDE support, catches errors early |
| Single sequence for v1.0 | Reduce complexity, validate core loop before multi-sequence |
| Lookahead scheduler | Essential for reliable timing despite JS event loop |
| Vite build system | Fast HMR, native ES modules, simple configuration |
| No save/load in v1.x | Focus on real-time experimentation, avoid persistence complexity |

## Platform Support

| Platform | Browser | Status |
|----------|---------|--------|
| Desktop | Chrome, Firefox, Edge | Primary |
| Desktop | Safari | Secondary (WebMIDI via extension) |
| Android | Chrome | Primary |
| iOS | Safari | Limited (no WebMIDI, future Web Bluetooth MIDI) |

## Context

**Source Components:**
- `notegrid/` - Three.js grid with pan/zoom (visualization only)
- `reference implementation/` - Full TypeScript sequencer with Canvas grid

**Integration Strategy:**
1. Use Three.js grid as foundation for rendering
2. Port core logic (Sequence, MIDI, Scheduler) from reference implementation
3. Build new note interaction layer connecting grid to sequence
4. Adapt UI components as needed

---
*Created: 2026-02-04*
*Status: Planning*
