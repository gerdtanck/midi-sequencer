# MIDI Experimentation Sequencer

## What This Is

A web-based MIDI sequencer that runs on Android phones via browser, designed as an experimentation scratchpad for electronic music production. It connects via USB MIDI to a 1010music blackbox, providing sequence manipulation operations that the blackbox lacks. Ideas are iterated quickly on the phone, then recorded to the blackbox for further production.

## Core Value

Orthogonal sequence operations that combine to enable rapid musical experimentation — nudge, transpose, reverse, randomize, and transform sequences in ways the hardware sequencer cannot.

## Requirements

### Validated

- ✓ 4 parallel sequences on tabs, all starting/stopping together — v1.0
- ✓ 16-step grid per sequence with draggable start/end markers — v1.0 (adapted from 32-step for mobile)
- ✓ 15-row piano roll for note input (C4-D5, 2 octaves) — v1.0
- ✓ Adjustable BPM with ±10 controls — v1.0
- ✓ MIDI device selection via WebMIDI — v1.0
- ✓ MIDI channel assignment per sequence (0-3) — v1.0
- ✓ Lookahead scheduler with background tab handling — v1.0
- ✓ 3-layer panic button (Note Off + CC 123 + CC 120) — v1.0
- ✓ Scale system (8 scales: chromatic, major, minor, pentatonic, blues, dorian, phrygian, lydian, mixolydian) — v1.0
- ✓ Scale overlay visualization — v1.0
- ✓ Nudge operation (shift notes with 16-step wrapping) — v1.0
- ✓ Transpose operation (scale-aware with chromatic tracking) — v1.0
- ✓ Reverse operation — v1.0
- ✓ Change scale operation (quantizes to new scale) — v1.0
- ✓ Randomize pitch operation (within scale) — v1.0
- ✓ Randomize timing operation — v1.0
- ✓ Randomize velocity operation — v1.0
- ✓ Randomize length operation (note duration) — v1.0
- ✓ Clear operation (remove all notes) — v1.0
- ✓ Note duration editing (drag handles) — v1.0
- ✓ Note position dragging — v1.0
- ✓ Mobile deployment (Capacitor Android, APK build) — v1.0

## Current Milestone: v1.1 Grid Refactor

**Goal:** Refactor grid architecture to Canvas-based viewport with zoom/pan, enabling 128-step × 5-octave sequences

**Target features:**
- Canvas-based grid rendering with viewport culling (128 steps × 60 rows total)
- Zoom control via mousewheel (desktop) and pinch gesture (mobile)
- Pan control via drag on empty grid cells
- Fixed piano roll showing C0-C4 octave markers
- Fixed bar indicator showing bar numbers (1 | 2 | 3...)
- Initial viewport: 2 bars × 2 octaves (32 steps × 24 rows visible)

### Active

- [ ] Canvas-based grid rendering with 128 steps × 60 rows
- [ ] Viewport system with zoom and pan controls
- [ ] Fixed piano roll with octave markers (C0, C1, C2, C3, C4)
- [ ] Fixed bar indicator with bar numbers and separators
- [ ] Touch gesture handling (tap = toggle note, swipe = pan)
- [ ] Mousewheel zoom for desktop
- [ ] Refactor SequenceGrid to support viewport architecture
- [ ] Swap pitches operation (deferred from v1.0)
- [ ] Apply rhythmical patterns operation (deferred from v1.0)
- [ ] Physical Android device testing

### Out of Scope

- Saving/loading sequences — ephemeral by design
- Native Android app — web app using WebMIDI
- Audio playback — MIDI only, sounds come from external synths
- MIDI sync/clock receive — phone is always tempo master
- More than 4 sequences — keep it focused
- Range beyond 2 octaves — compact grid for small screen

## Context

- Target device: Android phone with small screen
- MIDI connection: USB dongle to 1010music blackbox
- Downstream gear: Synthesizers connected to blackbox MIDI thru
- WebMIDI already verified working with virtual keyboard test
- Blackbox is the "brain" of the setup — phone is the experimentation layer
- Workflow: experiment on phone → record to blackbox when satisfied

## Constraints

- **Platform**: Web app (browser-based) — required for WebMIDI on Android
- **Screen**: Small phone display — one sequence visible at a time via tabs
- **Technology**: WebMIDI API — already proven to work with target setup

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| WebMIDI over native app | Already verified working, simpler deployment, no app store | — Pending |
| 4 sequences max | Balance between capability and UI complexity on small screen | — Pending |
| No save/load | Pure experimentation tool, ideas graduate to blackbox | — Pending |
| Phone as tempo master | Simpler architecture, blackbox follows | — Pending |

---
*Last updated: 2026-01-26 after starting v1.1 milestone*
