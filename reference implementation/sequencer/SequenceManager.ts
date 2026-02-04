import type { MidiManager } from '../midi/MidiManager';
import type { LookaheadScheduler } from '../scheduler/LookaheadScheduler';
import { Sequence } from './Sequence';
import { PlaybackEngine } from './PlaybackEngine';
import { MidiClockGenerator } from '../scheduler/MidiClockGenerator';
import { SequenceTabs } from '../ui/SequenceTabs';
import { CanvasSequenceGrid } from '../ui/canvas/CanvasSequenceGrid';
import { LoopMarkerControls } from '../ui/LoopMarkerControls';
import { TransportControls } from '../ui/TransportControls';
import { PlaybackIndicator } from '../ui/PlaybackIndicator';
import { PianoRoll } from '../ui/PianoRoll';
import { BarIndicator } from '../ui/BarIndicator';
import { ScaleSelector } from '../ui/ScaleSelector';
import { ScaleOverlay } from '../ui/ScaleOverlay';
import { TransformControls } from '../ui/TransformControls';
import { getScale, type ScaleDefinition } from '../music/Scale';
import { ROWS, BASE_MIDI, CELL_WIDTH, CELL_HEIGHT, GRID_GAP } from '../config/GridConfig';

/**
 * Coordinates all 4 sequences and UI components
 *
 * Central manager that wires together the sequencer engine,
 * UI components, and handles cross-component communication.
 */
export class SequenceManager {
  private midiManager: MidiManager;
  private scheduler: LookaheadScheduler;

  /** Core sequencer components */
  private sequences: Sequence[] = [];
  private playbackEngine: PlaybackEngine | null = null;
  private clockGen: MidiClockGenerator | null = null;

  /** UI components */
  private sequenceTabs: SequenceTabs | null = null;
  private canvasGrids: CanvasSequenceGrid[] = [];
  private loopMarkerControls: LoopMarkerControls | null = null;
  private transportControls: TransportControls | null = null;
  private playbackIndicator: PlaybackIndicator | null = null;
  private pianoRoll: PianoRoll | null = null;
  private barIndicator: BarIndicator | null = null;
  private scaleSelector: ScaleSelector | null = null;
  private scaleOverlay: ScaleOverlay | null = null;
  private transformControls: TransformControls | null = null;

  /** Current state */
  private currentSequenceIndex: number = 0;

  /** Musical state (global across all sequences) */
  private currentRoot: number = 0; // C
  private currentScale: ScaleDefinition = getScale('major');

  /** Grid configuration */
  private readonly GRID_STEP_WIDTH = CELL_WIDTH; // Match CSS grid-template-columns

  /**
   * Create sequence manager
   * @param midiManager MidiManager for MIDI output
   * @param scheduler LookaheadScheduler for timing
   */
  constructor(midiManager: MidiManager, scheduler: LookaheadScheduler) {
    this.midiManager = midiManager;
    this.scheduler = scheduler;
  }

  /**
   * Initialize all sequences and UI components
   * Call this after MidiManager.init() succeeds
   */
  init(): void {
    // Create 4 sequences with default MIDI channels 0-3
    for (let i = 0; i < 4; i++) {
      const sequence = new Sequence();
      sequence.setMidiChannel(i);
      this.sequences.push(sequence);
    }

    // Create MIDI clock generator
    this.clockGen = new MidiClockGenerator(this.scheduler, this.midiManager);

    // Create playback engine
    this.playbackEngine = new PlaybackEngine(
      this.sequences,
      this.midiManager,
      this.scheduler,
      this.clockGen
    );

    // Get UI container elements
    const tabsContainer = document.getElementById('sequence-tabs');
    const gridContainer = document.getElementById('sequence-grid');
    const gridParentContainer = document.getElementById('sequence-grid-container');
    const transportContainer = document.getElementById('transport-controls');
    const transformContainer = document.getElementById('transform-controls');
    const pianoContainer = document.getElementById('piano-roll-container');
    const scaleSelectorContainer = document.getElementById('scale-selector');
    const scaleOverlayContainer = document.getElementById('scale-overlay-container');

    if (!tabsContainer || !gridContainer || !gridParentContainer || !transportContainer || !transformContainer || !pianoContainer || !scaleSelectorContainer || !scaleOverlayContainer) {
      console.error('Failed to find required UI containers');
      return;
    }

    // Create piano roll (60 keys = 5 octaves, starting from base note)
    this.pianoRoll = new PianoRoll(
      pianoContainer,
      BASE_MIDI, // Base MIDI note from config
      ROWS, // 5 octaves (60 keys) - matches grid height
      CELL_HEIGHT, // Key height matches grid cell height
      GRID_GAP // Gap between keys matches grid gap
    );
    this.pianoRoll.setOnKeyClick((midiNote) => this.playNote(midiNote));
    this.pianoRoll.render();

    // Create bar indicator (sticky at top of grid)
    const barIndicatorContainer = document.createElement('div');
    barIndicatorContainer.className = 'bar-indicator-container';
    const gridWithPiano = document.getElementById('grid-with-piano');
    if (gridWithPiano && gridWithPiano.firstChild) {
      gridWithPiano.insertBefore(barIndicatorContainer, gridWithPiano.firstChild);
    } else if (gridWithPiano) {
      gridWithPiano.appendChild(barIndicatorContainer);
    }

    this.barIndicator = new BarIndicator(
      barIndicatorContainer,
      CELL_WIDTH,
      GRID_GAP
    );

    // Create scale selector
    this.scaleSelector = new ScaleSelector(scaleSelectorContainer);
    this.scaleSelector.setOnChange((root, scale) => this.handleScaleChange(root, scale));
    this.scaleSelector.render();

    // Create and render UI components
    this.sequenceTabs = new SequenceTabs(
      tabsContainer,
      this.sequences,
      (index) => this.handleTabChange(index)
    );
    this.sequenceTabs.render();

    // Create Canvas grid (pass parent container for event delegation to catch scale bar events)
    // Pass zoom change callback to update fixed UI elements
    const canvasGrid = new CanvasSequenceGrid(
      gridContainer,
      this.sequences[this.currentSequenceIndex],
      gridParentContainer,
      (zoom) => this.handleZoomChange(zoom)
    );
    this.canvasGrids.push(canvasGrid);
    canvasGrid.render();

    // Create scale overlay (covers both piano roll and grid)
    this.scaleOverlay = new ScaleOverlay(
      scaleOverlayContainer,
      BASE_MIDI, // Base MIDI note from config
      ROWS, // Number of rows to match grid height
      CELL_HEIGHT, // Row height from config
      GRID_GAP   // Row gap from config
    );
    this.scaleOverlay.render();
    this.scaleOverlay.setScale(this.currentRoot, this.currentScale);

    this.loopMarkerControls = new LoopMarkerControls(
      gridParentContainer,
      this.sequences[this.currentSequenceIndex],
      this.GRID_STEP_WIDTH
    );

    this.playbackIndicator = new PlaybackIndicator(
      gridParentContainer,
      this.playbackEngine,
      this.GRID_STEP_WIDTH,
      GRID_GAP
    );

    this.transportControls = new TransportControls(
      transportContainer,
      this.playbackEngine,
      {
        onPlay: () => {
          if (this.playbackIndicator) {
            this.playbackIndicator.start(this.currentSequenceIndex);
          }
        },
        onStop: () => {
          if (this.playbackIndicator) {
            this.playbackIndicator.stop();
          }
        }
      }
    );
    this.transportControls.render();

    // Create transform controls
    this.transformControls = new TransformControls(transformContainer);
    this.transformControls.setCallbacks({
      onNudgeLeft: () => this.handleNudgeLeft(),
      onNudgeRight: () => this.handleNudgeRight(),
      onTransposeUp: () => this.handleTransposeUp(),
      onTransposeDown: () => this.handleTransposeDown(),
      onReverse: () => this.handleReverse(),
      onRandomizePitch: () => this.handleRandomizePitch(),
      onRandomizeLength: () => this.handleRandomizeLength(),
      onRandomizeTiming: () => this.handleRandomizeTiming(),
      onRandomizeVelocity: () => this.handleRandomizeVelocity(),
      onClear: () => this.handleClear()
    });
    this.transformControls.render();

    console.log('SequenceManager initialized with 4 sequences');
    console.log(`Initial scale: ${this.currentScale.name}, root: ${this.currentRoot}`);
  }

  /**
   * Play a MIDI note for auditioning (from piano roll)
   * @param midiNote MIDI note to play
   */
  private playNote(midiNote: number): void {
    // Play note for a short duration (200ms)
    this.midiManager.playNote(midiNote, 100, 0.2);
  }

  /**
   * Handle zoom change from active Canvas grid
   *
   * Updates fixed UI elements (piano roll, bar indicator, scale overlay) to match active grid zoom.
   * Call this whenever active grid's zoom changes.
   *
   * @param zoom New zoom level from active grid
   */
  private handleZoomChange(zoom: number): void {
    if (this.pianoRoll) {
      this.pianoRoll.updateScale(zoom);
    }
    if (this.barIndicator) {
      this.barIndicator.updateScale(zoom);
    }
    if (this.scaleOverlay) {
      this.scaleOverlay.updateScale(zoom);
    }
    if (this.loopMarkerControls) {
      this.loopMarkerControls.updateScale(zoom);
    }
    if (this.playbackIndicator) {
      this.playbackIndicator.updateScale(zoom);
    }
  }

  /**
   * Handle scale or root note change
   * Update scale overlay and quantize existing notes
   * @param root Root note (0-11)
   * @param scale Scale definition
   */
  private handleScaleChange(root: number, scale: ScaleDefinition): void {
    this.currentRoot = root;
    this.currentScale = scale;

    // Update piano roll (no visual changes, just tracking)
    if (this.pianoRoll) {
      this.pianoRoll.setScale(root, scale);
    }

    // Update scale overlay (darkens out-of-scale rows)
    if (this.scaleOverlay) {
      this.scaleOverlay.setScale(root, scale);
    }

    // Quantize all existing notes in all sequences to the new scale
    console.log(`Quantizing all notes to ${scale.name} scale, root: ${root}`);
    this.sequences.forEach((sequence) => {
      sequence.quantizeNotesToScale(root, scale);
    });

    console.log(`Scale changed: ${scale.name}, root: ${root}`);
  }

  /**
   * Handle tab change event
   * Switch grid and loop markers to the selected sequence
   * @param index New sequence index (0-3)
   */
  private handleTabChange(index: number): void {
    this.currentSequenceIndex = index;

    // Get containers
    const gridContainer = document.getElementById('sequence-grid');
    const gridParentContainer = document.getElementById('sequence-grid-container');

    if (!gridContainer || !gridParentContainer) {
      console.error('Failed to find grid containers');
      return;
    }

    // Destroy old Canvas grid and loop markers
    if (this.canvasGrids.length > 0) {
      this.canvasGrids[0].destroy();
      this.canvasGrids = [];
    }
    if (this.loopMarkerControls) {
      this.loopMarkerControls.destroy();
    }

    // Create new Canvas grid for selected sequence (pass parent container for event delegation)
    // Pass zoom change callback to update fixed UI elements
    const canvasGrid = new CanvasSequenceGrid(
      gridContainer,
      this.sequences[index],
      gridParentContainer,
      (zoom: number) => this.handleZoomChange(zoom)
    );
    this.canvasGrids.push(canvasGrid);
    canvasGrid.render();

    // Create new loop markers for selected sequence
    this.loopMarkerControls = new LoopMarkerControls(
      gridParentContainer,
      this.sequences[index],
      this.GRID_STEP_WIDTH
    );

    // Update playback indicator to track new sequence
    if (this.playbackIndicator) {
      this.playbackIndicator.setSequence(index);
    }

    console.log(`Switched to sequence ${index + 1}`);
  }

  /**
   * Transform handlers - apply to currently selected sequence
   */
  private handleNudgeLeft(): void {
    this.sequences[this.currentSequenceIndex].nudgeLeft();
  }

  private handleNudgeRight(): void {
    this.sequences[this.currentSequenceIndex].nudgeRight();
  }

  private handleTransposeUp(): void {
    this.sequences[this.currentSequenceIndex].transposeUp(this.currentRoot, this.currentScale);
  }

  private handleTransposeDown(): void {
    this.sequences[this.currentSequenceIndex].transposeDown(this.currentRoot, this.currentScale);
  }

  private handleReverse(): void {
    this.sequences[this.currentSequenceIndex].reverse();
  }

  private handleRandomizePitch(): void {
    this.sequences[this.currentSequenceIndex].randomizePitch(this.currentRoot, this.currentScale);
  }

  private handleRandomizeLength(): void {
    this.sequences[this.currentSequenceIndex].randomizeLength();
  }

  private handleRandomizeTiming(): void {
    this.sequences[this.currentSequenceIndex].randomizeTiming();
  }

  private handleRandomizeVelocity(): void {
    this.sequences[this.currentSequenceIndex].randomizeVelocity();
  }

  private handleClear(): void {
    this.sequences[this.currentSequenceIndex].clear();
  }

  /**
   * Clean up all components
   * Call this when shutting down the application
   */
  destroy(): void {
    // Stop playback if running
    if (this.playbackEngine) {
      this.playbackEngine.stop();
    }

    // Destroy UI components
    if (this.sequenceTabs) {
      this.sequenceTabs.destroy();
    }
    // Clean up Canvas grids
    this.canvasGrids.forEach(grid => grid.destroy());
    this.canvasGrids = [];
    if (this.loopMarkerControls) {
      this.loopMarkerControls.destroy();
    }
    if (this.transportControls) {
      this.transportControls.destroy();
    }
    if (this.playbackIndicator) {
      this.playbackIndicator.destroy();
    }
    if (this.pianoRoll) {
      this.pianoRoll.destroy();
    }
    if (this.barIndicator) {
      this.barIndicator.destroy();
    }
    if (this.scaleSelector) {
      this.scaleSelector.destroy();
    }
    if (this.scaleOverlay) {
      this.scaleOverlay.destroy();
    }
    if (this.transformControls) {
      this.transformControls.destroy();
    }

    console.log('SequenceManager destroyed');
  }
}
