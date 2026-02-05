import './ui/styles.css';
import { NoteGrid } from './ui/grid';
import { PlaybackEngine, SequenceManager } from './core';
import { ScaleManager } from './core/ScaleManager';
import { MidiManager } from './midi';
import { LookaheadScheduler } from './scheduler';
import { TransportControls, ScaleSelector, TransformControls } from './ui/controls';
import { KeyboardShortcuts } from './ui/KeyboardShortcuts';
import { BASE_MIDI } from './config/GridConfig';

/**
 * Global application state
 */
let noteGrid: NoteGrid | null = null;
let sequenceManager: SequenceManager | null = null;
let scaleManager: ScaleManager | null = null;
let midiManager: MidiManager | null = null;
let scheduler: LookaheadScheduler | null = null;
let playbackEngine: PlaybackEngine | null = null;
let transportControls: TransportControls | null = null;
let scaleSelector: ScaleSelector | null = null;
let transformControls: TransformControls | null = null;
let keyboardShortcuts: KeyboardShortcuts | null = null;

/**
 * Initialize the application
 */
function initApp(): void {
  console.log('MIDI Sequencer initializing...');

  // Get container elements
  const gridContainer = document.getElementById('note-grid-container');
  const pianoKeysContainer = document.getElementById('piano-keys-container');
  const barIndicatorsContainer = document.getElementById('bar-indicators-container');
  const transportContainer = document.getElementById('transport-controls');
  const scaleSelectorContainer = document.getElementById('scale-selector');
  const barInput = document.getElementById('bar-count') as HTMLInputElement | null;
  const octaveInput = document.getElementById('octave-count') as HTMLInputElement | null;

  if (!gridContainer) {
    console.error('Failed to find #note-grid-container');
    return;
  }

  // Create core components
  sequenceManager = new SequenceManager();
  scaleManager = new ScaleManager();
  midiManager = new MidiManager();
  scheduler = new LookaheadScheduler();

  // Create playback engine with all 4 sequences
  playbackEngine = new PlaybackEngine(
    sequenceManager.getAllSequences(),
    midiManager,
    scheduler
  );

  // Create the note grid
  noteGrid = new NoteGrid(gridContainer);

  // Initialize note interaction with the active sequence
  noteGrid.initNoteInteraction(sequenceManager.getActiveSequence());

  // Wire scale manager to grid (for scale highlighting)
  noteGrid.setScaleManager(scaleManager);

  // Initialize overlays if containers exist
  if (pianoKeysContainer) {
    noteGrid.initPianoKeys(pianoKeysContainer);

    // Wire piano keys to MIDI output for note audition
    noteGrid.setPianoKeyCallbacks(
      (semitone: number) => {
        // Note On with default velocity 100 on active sequence's channel
        const channel = sequenceManager?.getActiveSequence().getMidiChannel() ?? 0;
        midiManager?.sendNoteOn(channel, BASE_MIDI + semitone, 100);
      },
      (semitone: number) => {
        // Note Off on active sequence's channel
        const channel = sequenceManager?.getActiveSequence().getMidiChannel() ?? 0;
        midiManager?.sendNoteOff(channel, BASE_MIDI + semitone);
      }
    );
  }

  if (barIndicatorsContainer) {
    noteGrid.initBarIndicators(barIndicatorsContainer);
  }

  // Wire note audition (drag, create, paste)
  let auditioningPitches: number[] = [];
  let auditionStopTimer: number | null = null;
  const AUDITION_DURATION_MS = 150; // Auto-stop after this duration

  noteGrid.setNoteAuditionCallback((pitches: number[]) => {
    // Clear any pending auto-stop
    if (auditionStopTimer !== null) {
      clearTimeout(auditionStopTimer);
      auditionStopTimer = null;
    }

    // Get active sequence's channel
    const channel = sequenceManager?.getActiveSequence().getMidiChannel() ?? 0;

    // Stop previously auditioned notes
    for (const pitch of auditioningPitches) {
      midiManager?.sendNoteOff(channel, pitch);
    }

    // Play new notes (pitches already include BASE_MIDI from sequence)
    for (const pitch of pitches) {
      midiManager?.sendNoteOn(channel, pitch, 100);
    }
    auditioningPitches = pitches;

    // Auto-stop notes after duration (for create/paste; drag sends empty array to stop)
    if (pitches.length > 0) {
      auditionStopTimer = window.setTimeout(() => {
        const ch = sequenceManager?.getActiveSequence().getMidiChannel() ?? 0;
        for (const pitch of auditioningPitches) {
          midiManager?.sendNoteOff(ch, pitch);
        }
        auditioningPitches = [];
        auditionStopTimer = null;
      }, AUDITION_DURATION_MS);
    }
  });

  // Initialize transport controls
  if (transportContainer) {
    transportControls = new TransportControls(transportContainer, playbackEngine, midiManager);
    transportControls.setSequenceManager(sequenceManager);
    transportControls.setNoteGrid(noteGrid);

    // Handle sequence selection
    transportControls.setSequenceSelectCallback((index: number) => {
      if (!sequenceManager || !noteGrid || !playbackEngine) return;

      // Update sequence manager
      sequenceManager.setActiveSequence(index);

      // Update playback engine active sequence (for position reporting)
      playbackEngine.setActiveSequence(index);

      // Switch note grid to new sequence
      noteGrid.setSequence(sequenceManager.getActiveSequence());
    });

    transportControls.render();
  }

  // Initialize scale selector
  if (scaleSelectorContainer && scaleManager) {
    scaleSelector = new ScaleSelector(scaleSelectorContainer, scaleManager);
    scaleSelector.render();
  }

  // Initialize transform controls
  const transformContainer = document.getElementById('transform-controls');
  if (transformContainer && noteGrid) {
    transformControls = new TransformControls(transformContainer, noteGrid);
    transformControls.render();
  }

  // Initialize keyboard shortcuts
  keyboardShortcuts = new KeyboardShortcuts(playbackEngine, midiManager);
  keyboardShortcuts.setPlaybackStateCallback((isPlaying: boolean) => {
    transportControls?.updatePlayButton(isPlaying);
  });
  keyboardShortcuts.setNoteGrid(noteGrid);
  if (transformControls) {
    keyboardShortcuts.setTransformControls(transformControls);
  }

  // Wire playback position to grid indicator
  playbackEngine.setPositionCallback((step: number) => {
    noteGrid?.setPlaybackPosition(step);
  });

  // Set up grid controls
  setupGridControls(barInput, octaveInput);

  // Expose to window for debugging
  Object.assign(window, {
    noteGrid,
    sequenceManager,
    scaleManager,
    midiManager,
    scheduler,
    playbackEngine,
    keyboardShortcuts,
    transformControls,
  });

  console.log('MIDI Sequencer initialized');
  console.log(`Grid: ${noteGrid.getBarCount()} bars × ${noteGrid.getOctaveCount()} octaves`);
  console.log('Multi-sequence support: 4 sequences available');
}

/**
 * Set up grid dimension controls
 */
function setupGridControls(
  barInput: HTMLInputElement | null,
  octaveInput: HTMLInputElement | null
): void {
  if (!noteGrid || !sequenceManager) return;

  if (barInput) {
    barInput.value = String(noteGrid.getBarCount());

    barInput.addEventListener('input', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value, 10);
      if (!isNaN(value) && noteGrid && sequenceManager) {
        noteGrid.setBarCount(value);
        // Update ALL sequences' loop markers to match grid size
        const newEnd = noteGrid.getBarCount() * 16; // 16 steps per bar
        for (const seq of sequenceManager.getAllSequences()) {
          seq.setLoopMarkers({ start: 0, end: newEnd });
        }
        // Refresh loop markers display after updating sequence values
        noteGrid.refreshLoopMarkers();
        (e.target as HTMLInputElement).value = String(noteGrid.getBarCount());
      }
    });

    barInput.addEventListener('blur', (e) => {
      if (noteGrid) {
        (e.target as HTMLInputElement).value = String(noteGrid.getBarCount());
      }
    });
  }

  if (octaveInput) {
    octaveInput.value = String(noteGrid.getOctaveCount());

    octaveInput.addEventListener('input', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value, 10);
      if (!isNaN(value) && noteGrid) {
        noteGrid.setOctaveCount(value);
        (e.target as HTMLInputElement).value = String(noteGrid.getOctaveCount());
      }
    });

    octaveInput.addEventListener('blur', (e) => {
      if (noteGrid) {
        (e.target as HTMLInputElement).value = String(noteGrid.getOctaveCount());
      }
    });
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
