import * as THREE from 'three';
import { GridConfig, CameraState, DEFAULT_GRID_CONFIG, DEFAULT_NOTE_VELOCITY, DEFAULT_NOTE_DURATION } from '@/config/GridConfig';
import { GridLines } from './GridLines';
import { GridControls } from './GridControls';
import { NoteRenderer } from './NoteRenderer';
import { NoteInteractionController, GridCell } from './NoteInteractionController';
import { PlaybackIndicator } from './PlaybackIndicator';
import { HtmlLoopMarkers } from '../overlays/HtmlLoopMarkers';
import { PianoKeys } from '../overlays/PianoKeys';
import { BarIndicators } from '../overlays/BarIndicators';
import { Sequence } from '@/core/Sequence';
import { SelectionManager } from '@/core/SelectionManager';
import { ScaleManager } from '@/core/ScaleManager';
import { InputManager } from '../input';
import {
  CommandHistory,
  AddNoteCommand,
  RemoveNoteCommand,
  MoveNotesCommand,
  ResizeNoteCommand,
  PasteNotesCommand,
  ChangeVelocityCommand,
} from '@/core/commands';

/**
 * NoteGrid - Main grid class for the MIDI sequencer note grid
 *
 * Manages the Three.js scene, camera, renderer, and coordinates
 * the GridLines and GridControls components.
 */
export class NoteGrid {
  private container: HTMLElement;
  private config: GridConfig;

  // Current grid dimensions
  private barCount: number;
  private octaveCount: number;

  // Three.js components
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private renderer: THREE.WebGLRenderer;

  // Grid components
  private gridLines: GridLines;
  private gridControls: GridControls;
  private noteRenderer: NoteRenderer | null = null;
  private noteInteraction: NoteInteractionController | null = null;
  private playbackIndicator: PlaybackIndicator;
  private loopMarkers: HtmlLoopMarkers | null = null;
  private pianoKeys: PianoKeys | null = null;
  private barIndicators: BarIndicators | null = null;

  // Sequence reference
  private sequence: Sequence | null = null;

  // Selection manager
  private selectionManager: SelectionManager | null = null;

  // Scale manager
  private scaleManager: ScaleManager | null = null;

  // Command history for undo/redo
  private commandHistory: CommandHistory = new CommandHistory();

  // Note audition callback (for playing notes on create/paste)
  private onNoteAudition: ((pitches: number[]) => void) | null = null;

  // Input manager for unified event handling
  private inputManager: InputManager;

  // Animation frame ID for cleanup
  private animationFrameId: number | null = null;

  // Render flag - only render when needed
  private needsRender = true;

  constructor(container: HTMLElement, options: Partial<GridConfig> = {}) {
    this.container = container;
    this.config = { ...DEFAULT_GRID_CONFIG, ...options };

    this.barCount = this.config.defaultBars;
    this.octaveCount = this.config.defaultOctaves;

    // Initialize Three.js components
    this.scene = this.createScene();
    this.camera = this.createCamera();
    this.renderer = this.createRenderer();

    // Initialize input manager for unified event handling
    // Note: Individual handlers will be registered in Phases 4-5
    this.inputManager = new InputManager(this.renderer.domElement, this.camera);

    // Initialize grid components
    this.gridLines = new GridLines(this.scene, this.config);
    this.gridLines.createGridLines(this.barCount, this.octaveCount);

    this.gridControls = new GridControls(
      this.camera,
      this.renderer.domElement,
      this.config,
      () => this.forceRender(),
      (cameraState) => this.onCameraChange(cameraState)
    );
    this.gridControls.setGridDimensions(this.barCount, this.octaveCount);

    // Register GridControls as input handler (pan/zoom)
    this.inputManager.register(this.gridControls);

    // Initialize playback indicator
    this.playbackIndicator = new PlaybackIndicator(this.scene, this.config);

    // Set up resize handler
    this.onResize = this.onResize.bind(this);
    window.addEventListener('resize', this.onResize);

    // Initial render
    this.updateCameraBounds();
    this.render();
  }

  /**
   * Initialize note interaction with a Sequence
   * This enables clicking to add/remove notes on the grid
   */
  initNoteInteraction(sequence: Sequence): void {
    this.sequence = sequence;

    // Create selection manager
    this.selectionManager = new SelectionManager();

    // Create note renderer (visualizes notes from sequence)
    this.noteRenderer = new NoteRenderer(this.scene, sequence, this.config);

    // Connect selection manager to note renderer for color updates
    this.noteRenderer.setSelectionManager(this.selectionManager);

    // Create note interaction controller (handles click-to-toggle, resize, drag, selection)
    this.noteInteraction = new NoteInteractionController(
      this.camera,
      this.renderer.domElement,
      this.config
    );
    this.noteInteraction.setGridDimensions(this.barCount, this.octaveCount);

    // Connect note renderer for hit testing
    this.noteInteraction.setNoteRenderer(this.noteRenderer);

    // Connect selection manager to interaction controller
    this.noteInteraction.setSelectionManager(this.selectionManager);

    // Connect scale manager if already set
    if (this.scaleManager) {
      this.noteInteraction.setScaleManager(this.scaleManager);
    }

    // Connect scene for selection rectangle rendering
    this.noteInteraction.setScene(this.scene);

    // Wire up note toggle callback
    this.noteInteraction.setNoteToggleCallback((cell: GridCell) => {
      this.onNoteToggle(cell);
    });

    // Wire up note resize callback
    this.noteInteraction.setNoteResizeCallback((step, pitch, newDuration) => {
      this.onNoteResize(step, pitch, newDuration);
    });

    // Wire up note move callback
    this.noteInteraction.setNoteMoveCallback((notes, deltaStep, deltaPitch) => {
      this.onNoteMove(notes, deltaStep, deltaPitch);
    });

    // Wire up note paste callback
    this.noteInteraction.setNotePasteCallback((targetStep, targetPitch) => {
      this.onNotePaste(targetStep, targetPitch);
    });

    // Wire up velocity callback
    this.noteInteraction.setNoteVelocityCallback((notes, deltaVelocity) => {
      this.onNoteVelocity(notes, deltaVelocity);
    });

    // Wire up render callback for live resize preview
    this.noteInteraction.setRenderCallback(() => {
      this.forceRender();
    });

    // Wire up cancel pan callback (for mobile long-press)
    this.noteInteraction.setCancelPanCallback(() => {
      this.gridControls.cancelPan();
    });

    // Subscribe to sequence changes for re-rendering
    sequence.onChange(() => {
      this.forceRender();
    });

    // Create loop markers (HTML-based, synced with camera)
    this.loopMarkers = new HtmlLoopMarkers(
      this.container,
      this.config,
      sequence
    );
    this.loopMarkers.updateTransform(this.getCameraState());
  }

  /**
   * Handle note toggle from click/tap
   */
  private onNoteToggle(cell: GridCell): void {
    if (!this.sequence) return;

    // When snap is enabled, reject input on out-of-scale rows
    if (this.scaleManager?.snapEnabled && !this.scaleManager.isChromatic()) {
      if (!this.scaleManager.isInScale(cell.pitch)) {
        // Out-of-scale row - ignore input
        return;
      }
    }

    const existingNote = this.sequence.getNoteAt(cell.step, cell.pitch);

    if (existingNote) {
      // Remove existing note
      const command = new RemoveNoteCommand(this.sequence, cell.step, cell.pitch, existingNote);
      this.commandHistory.execute(command);

      // Also remove from selection
      if (this.selectionManager) {
        this.selectionManager.deselect(cell.step, cell.pitch);
      }
    } else {
      // Add new note
      const command = new AddNoteCommand(
        this.sequence,
        cell.step,
        cell.pitch,
        DEFAULT_NOTE_VELOCITY,
        DEFAULT_NOTE_DURATION,
        cell.pitch  // originalPitch same as pitch (user clicked on valid scale row)
      );
      this.commandHistory.execute(command);

      // Audition the new note
      this.onNoteAudition?.([cell.pitch]);
    }

    this.forceRender();
  }

  /**
   * Handle note resize from drag
   */
  private onNoteResize(step: number, pitch: number, newDuration: number): void {
    if (!this.sequence) return;

    const note = this.sequence.getNoteAt(step, pitch);
    if (!note) return;

    const command = new ResizeNoteCommand(this.sequence, step, pitch, note.duration, newDuration);
    this.commandHistory.execute(command);
    this.forceRender();
  }

  /**
   * Handle velocity change from Ctrl+drag or mobile long-press+drag
   */
  private onNoteVelocity(
    notes: Array<{ step: number; pitch: number; oldVelocity: number }>,
    deltaVelocity: number
  ): void {
    if (!this.sequence) return;

    const command = new ChangeVelocityCommand(this.sequence, notes, deltaVelocity);
    this.commandHistory.execute(command);
    this.forceRender();
  }

  /**
   * Handle note move from drag
   */
  private onNoteMove(
    notes: Array<{ step: number; pitch: number }>,
    deltaStep: number,
    deltaPitch: number
  ): void {
    if (!this.sequence) return;

    const command = new MoveNotesCommand(
      this.sequence,
      this.selectionManager,
      notes,
      deltaStep,
      deltaPitch,
      this.scaleManager
    );
    this.commandHistory.execute(command);
    this.forceRender();
  }

  /**
   * Handle note paste from context menu or long-press
   */
  private onNotePaste(targetStep: number, targetPitch: number): void {
    if (!this.sequence || !this.selectionManager) return;

    const selectedNotes = this.selectionManager.getSelectedNotes();
    if (selectedNotes.length === 0) return;

    const command = new PasteNotesCommand(
      this.sequence,
      this.selectionManager,
      selectedNotes,
      targetStep,
      targetPitch
    );
    this.commandHistory.execute(command);
    this.forceRender();

    // Audition the pasted notes
    if (this.onNoteAudition) {
      // Calculate new pitches (same logic as Sequence.copyNotes)
      let minStep = Infinity;
      let minPitch = Infinity;
      for (const { step, pitch } of selectedNotes) {
        if (step < minStep || (step === minStep && pitch < minPitch)) {
          minStep = step;
          minPitch = pitch;
        }
      }
      const deltaPitch = targetPitch - minPitch;
      const newPitches = selectedNotes.map(n => n.pitch + deltaPitch);
      this.onNoteAudition(newPitches);
    }
  }

  /**
   * Initialize piano keys overlay
   */
  initPianoKeys(container: HTMLElement): void {
    this.pianoKeys = new PianoKeys(container, this.config, this.octaveCount);
    this.syncOverlayComponents();
  }

  /**
   * Set callbacks for piano key press/release (for note audition)
   */
  setPianoKeyCallbacks(
    onKeyPress?: (semitone: number) => void,
    onKeyRelease?: (semitone: number) => void
  ): void {
    if (this.pianoKeys) {
      this.pianoKeys.setCallbacks(onKeyPress, onKeyRelease);
    }
  }

  /**
   * Set callback for note audition during drag and note creation
   * Called with array of pitches when notes cross pitch boundaries or are created
   * Called with empty array when drag ends (to stop audition)
   */
  setNoteAuditionCallback(callback: (pitches: number[]) => void): void {
    this.onNoteAudition = callback;
    if (this.noteInteraction) {
      this.noteInteraction.setNoteAuditionCallback(callback);
    }
  }

  /**
   * Initialize bar indicators overlay
   */
  initBarIndicators(container: HTMLElement): void {
    this.barIndicators = new BarIndicators(container, this.config, this.barCount);
    this.syncOverlayComponents();
  }

  /**
   * Set the scale manager for scale-aware features
   */
  setScaleManager(scaleManager: ScaleManager): void {
    this.scaleManager = scaleManager;

    // Wire scale manager to grid lines for row highlighting
    this.gridLines.setScaleManager(scaleManager);

    // Wire scale manager to note interaction for scale-aware drag preview
    if (this.noteInteraction) {
      this.noteInteraction.setScaleManager(scaleManager);
    }

    // When scale changes, recompute note positions from their original pitches
    scaleManager.onChange(() => {
      this.applyScaleToNotes();
      this.forceRender();
    });
  }

  /**
   * Apply current scale to all notes based on their original pitches
   * Called when scale or snap setting changes
   */
  private applyScaleToNotes(): void {
    if (!this.sequence || !this.scaleManager) return;

    const allNotes = this.sequence.getAllNotes();

    for (const { step, notes } of allNotes) {
      for (const note of notes) {
        const originalPitch = note.originalPitch ?? note.pitch;
        let targetPitch: number;

        if (this.scaleManager.snapEnabled && !this.scaleManager.isChromatic()) {
          // Snap to scale from original pitch
          targetPitch = this.scaleManager.snapToScale(originalPitch);
        } else {
          // Return to original pitch
          targetPitch = originalPitch;
        }

        // Update pitch if different
        if (targetPitch !== note.pitch) {
          // Update selection if the note was selected
          if (this.selectionManager?.isSelected(step, note.pitch)) {
            this.selectionManager.deselect(step, note.pitch);
            this.selectionManager.select(step, targetPitch);
          }

          // Move the note to its new pitch
          this.sequence.moveNote(step, note.pitch, step, targetPitch);

          // Preserve the original pitch reference
          const movedNote = this.sequence.getNoteAt(step, targetPitch);
          if (movedNote) {
            movedNote.originalPitch = originalPitch;
          }
        }
      }
    }
  }

  /**
   * Get the scale manager
   */
  getScaleManager(): ScaleManager | null {
    return this.scaleManager;
  }

  private createScene(): THREE.Scene {
    const scene = new THREE.Scene();

    const style = getComputedStyle(document.documentElement);
    const bgColor = style.getPropertyValue('--grid-background').trim() || '#1a1a2e';
    scene.background = new THREE.Color(bgColor);

    return scene;
  }

  private createCamera(): THREE.OrthographicCamera {
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    return camera;
  }

  private createRenderer(): THREE.WebGLRenderer {
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
    });

    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.container.appendChild(renderer.domElement);

    return renderer;
  }

  /**
   * Called when camera bounds change (pan/zoom)
   */
  private onCameraChange(_cameraState: CameraState): void {
    this.syncOverlayComponents();
  }

  /**
   * Syncs piano keys and bar indicators with current camera state
   */
  private syncOverlayComponents(): void {
    const cameraState = this.getCameraState();

    if (this.pianoKeys) {
      this.pianoKeys.updateTransform(cameraState);
    }

    if (this.barIndicators) {
      this.barIndicators.updateTransform(cameraState);
    }

    if (this.loopMarkers) {
      this.loopMarkers.updateTransform(cameraState);
    }
  }

  /**
   * Gets the current camera state
   */
  getCameraState(): CameraState {
    return {
      left: this.camera.left,
      right: this.camera.right,
      top: this.camera.top,
      bottom: this.camera.bottom,
    };
  }

  /**
   * Set playback position indicator
   * @param step Current step (-1 to hide)
   */
  setPlaybackPosition(step: number): void {
    const gridHeight = this.octaveCount * this.config.semitonesPerOctave;
    this.playbackIndicator.setPosition(step, gridHeight);
    this.forceRender();
  }

  /**
   * Updates camera bounds to show the entire grid
   */
  private updateCameraBounds(): void {
    const gridWidth = this.barCount * this.config.stepsPerBar;
    const gridHeight = this.octaveCount * this.config.semitonesPerOctave;

    const containerWidth = this.container.clientWidth;
    const containerHeight = this.container.clientHeight;
    const containerAspect = containerWidth / containerHeight;

    const gridAspect = gridWidth / gridHeight;

    const padding = 0.05;
    let viewWidth: number;
    let viewHeight: number;

    if (containerAspect > gridAspect) {
      viewHeight = gridHeight * (1 + padding * 2);
      viewWidth = viewHeight * containerAspect;
    } else {
      viewWidth = gridWidth * (1 + padding * 2);
      viewHeight = viewWidth / containerAspect;
    }

    const centerX = gridWidth / 2;
    const centerY = gridHeight / 2;

    this.camera.left = centerX - viewWidth / 2;
    this.camera.right = centerX + viewWidth / 2;
    this.camera.top = centerY + viewHeight / 2;
    this.camera.bottom = centerY - viewHeight / 2;

    this.camera.updateProjectionMatrix();
    this.needsRender = true;
  }

  /**
   * Sets the number of bars in the grid
   */
  setBarCount(count: number): void {
    const newCount = Math.max(
      this.config.minBars,
      Math.min(this.config.maxBars, Math.floor(count))
    );

    if (newCount !== this.barCount) {
      this.barCount = newCount;
      this.rebuildGrid();
    }
  }

  /**
   * Sets the number of octaves in the grid
   */
  setOctaveCount(count: number): void {
    const newCount = Math.max(
      this.config.minOctaves,
      Math.min(this.config.maxOctaves, Math.floor(count))
    );

    if (newCount !== this.octaveCount) {
      this.octaveCount = newCount;
      this.rebuildGrid();
    }
  }

  /**
   * Rebuilds the grid after dimension changes
   */
  private rebuildGrid(): void {
    this.gridLines.update(this.barCount, this.octaveCount);
    this.gridControls.setGridDimensions(this.barCount, this.octaveCount);

    if (this.noteInteraction) {
      this.noteInteraction.setGridDimensions(this.barCount, this.octaveCount);
    }

    if (this.pianoKeys) {
      this.pianoKeys.setOctaveCount(this.octaveCount);
    }
    if (this.barIndicators) {
      this.barIndicators.setBarCount(this.barCount);
    }

    if (this.loopMarkers) {
      this.loopMarkers.updateTransform(this.getCameraState());
    }

    this.updateCameraBounds();
    this.render();
    this.syncOverlayComponents();
  }

  /**
   * Gets the current bar count
   */
  getBarCount(): number {
    return this.barCount;
  }

  /**
   * Gets the current octave count
   */
  getOctaveCount(): number {
    return this.octaveCount;
  }

  /**
   * Handles window resize events
   */
  private onResize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.renderer.setSize(width, height);

    if (this.gridControls) {
      this.gridControls.updateContainerAspect();
      this.gridControls.isPanning = false;
    }

    this.updateCameraBounds();
    this.render();
    this.syncOverlayComponents();
  }

  /**
   * Renders the scene
   */
  render(): void {
    if (this.needsRender) {
      this.renderer.render(this.scene, this.camera);
      this.needsRender = false;
    }
  }

  /**
   * Starts the render loop (for continuous rendering if needed)
   */
  startRenderLoop(): void {
    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate);
      this.render();
    };
    animate();
  }

  /**
   * Stops the render loop
   */
  stopRenderLoop(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Forces a re-render
   */
  forceRender(): void {
    this.needsRender = true;
    this.render();
  }

  /**
   * Gets the Three.js scene (for adding note meshes later)
   */
  getScene(): THREE.Scene {
    return this.scene;
  }

  /**
   * Gets the grid configuration
   */
  getConfig(): GridConfig {
    return this.config;
  }

  // ============ Undo/Redo ============

  /**
   * Undo the last action
   * @returns true if an action was undone
   */
  undo(): boolean {
    const command = this.commandHistory.undo();
    if (command) {
      this.forceRender();
      return true;
    }
    return false;
  }

  /**
   * Redo the last undone action
   * @returns true if an action was redone
   */
  redo(): boolean {
    const command = this.commandHistory.redo();
    if (command) {
      this.forceRender();
      return true;
    }
    return false;
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.commandHistory.canUndo();
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.commandHistory.canRedo();
  }

  /**
   * Get the command history (for UI integration)
   */
  getCommandHistory(): CommandHistory {
    return this.commandHistory;
  }

  /**
   * Disposes of all resources
   */
  dispose(): void {
    this.stopRenderLoop();
    window.removeEventListener('resize', this.onResize);

    this.gridLines.dispose();
    this.gridControls.dispose();
    this.playbackIndicator.dispose();

    if (this.noteRenderer) {
      this.noteRenderer.dispose();
    }

    if (this.noteInteraction) {
      this.noteInteraction.dispose();
    }

    if (this.pianoKeys) {
      this.pianoKeys.dispose();
    }

    if (this.barIndicators) {
      this.barIndicators.dispose();
    }

    if (this.loopMarkers) {
      this.loopMarkers.dispose();
    }

    this.inputManager.dispose();
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }

  /**
   * Get the input manager for handler registration
   * Used by handlers to register themselves (Phases 4-5)
   */
  getInputManager(): InputManager {
    return this.inputManager;
  }
}
