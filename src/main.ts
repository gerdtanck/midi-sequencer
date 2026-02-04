import './ui/styles.css';
import { NoteGrid } from './ui/grid';
import { Sequence, PlaybackEngine } from './core';
import { MidiManager } from './midi';
import { LookaheadScheduler } from './scheduler';
import { TransportControls } from './ui/controls';
import { KeyboardShortcuts } from './ui/KeyboardShortcuts';
import { BASE_MIDI } from './config/GridConfig';

/**
 * Global application state
 */
let noteGrid: NoteGrid | null = null;
let sequence: Sequence | null = null;
let midiManager: MidiManager | null = null;
let scheduler: LookaheadScheduler | null = null;
let playbackEngine: PlaybackEngine | null = null;
let transportControls: TransportControls | null = null;
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
  const barInput = document.getElementById('bar-count') as HTMLInputElement | null;
  const octaveInput = document.getElementById('octave-count') as HTMLInputElement | null;

  if (!gridContainer) {
    console.error('Failed to find #note-grid-container');
    return;
  }

  // Create core components
  sequence = new Sequence();
  midiManager = new MidiManager();
  scheduler = new LookaheadScheduler();
  playbackEngine = new PlaybackEngine(sequence, midiManager, scheduler);

  // Create the note grid
  noteGrid = new NoteGrid(gridContainer);

  // Initialize note interaction (click to add/remove notes)
  noteGrid.initNoteInteraction(sequence);

  // Initialize overlays if containers exist
  if (pianoKeysContainer) {
    noteGrid.initPianoKeys(pianoKeysContainer);

    // Wire piano keys to MIDI output for note audition
    noteGrid.setPianoKeyCallbacks(
      (semitone: number) => {
        // Note On with default velocity 100 on channel 0
        // Add BASE_MIDI to convert grid row to actual MIDI note
        midiManager?.sendNoteOn(0, BASE_MIDI + semitone, 100);
      },
      (semitone: number) => {
        // Note Off on channel 0
        midiManager?.sendNoteOff(0, BASE_MIDI + semitone);
      }
    );
  }

  if (barIndicatorsContainer) {
    noteGrid.initBarIndicators(barIndicatorsContainer);
  }

  // Initialize transport controls
  if (transportContainer) {
    transportControls = new TransportControls(transportContainer, playbackEngine, midiManager);
    transportControls.setNoteGrid(noteGrid);
    transportControls.render();
  }

  // Initialize keyboard shortcuts
  keyboardShortcuts = new KeyboardShortcuts(playbackEngine, midiManager);
  keyboardShortcuts.setPlaybackStateCallback((isPlaying: boolean) => {
    transportControls?.updatePlayButton(isPlaying);
  });
  keyboardShortcuts.setNoteGrid(noteGrid);

  // Wire playback position to grid indicator
  playbackEngine.setPositionCallback((step: number) => {
    noteGrid?.setPlaybackPosition(step);
  });

  // Set up grid controls
  setupGridControls(barInput, octaveInput);

  // Expose to window for debugging
  Object.assign(window, {
    noteGrid,
    sequence,
    midiManager,
    scheduler,
    playbackEngine,
    keyboardShortcuts,
  });

  console.log('MIDI Sequencer initialized');
  console.log(`Grid: ${noteGrid.getBarCount()} bars × ${noteGrid.getOctaveCount()} octaves`);
}

/**
 * Set up grid dimension controls
 */
function setupGridControls(
  barInput: HTMLInputElement | null,
  octaveInput: HTMLInputElement | null
): void {
  if (!noteGrid || !sequence) return;

  if (barInput) {
    barInput.value = String(noteGrid.getBarCount());

    barInput.addEventListener('input', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value, 10);
      if (!isNaN(value) && noteGrid && sequence) {
        noteGrid.setBarCount(value);
        // Update sequence loop markers to match grid size
        const newEnd = noteGrid.getBarCount() * 16; // 16 steps per bar
        sequence.setLoopMarkers({ start: 0, end: newEnd });
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
