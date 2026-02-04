import * as THREE from 'three';
import { GridConfig, CameraState, DEFAULT_GRID_CONFIG } from '@/config/GridConfig';
import { GridLines } from './GridLines';
import { GridControls } from './GridControls';
import { NoteRenderer } from './NoteRenderer';
import { NoteInteractionController, GridCell } from './NoteInteractionController';
import { PlaybackIndicator } from './PlaybackIndicator';
import { PianoKeys } from '../overlays/PianoKeys';
import { BarIndicators } from '../overlays/BarIndicators';
import { Sequence } from '@/core/Sequence';
import { SelectionManager } from '@/core/SelectionManager';
import { InputManager } from '../input';

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
  private pianoKeys: PianoKeys | null = null;
  private barIndicators: BarIndicators | null = null;

  // Sequence reference
  private sequence: Sequence | null = null;

  // Selection manager
  private selectionManager: SelectionManager | null = null;

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
  }

  /**
   * Handle note toggle from click/tap
   */
  private onNoteToggle(cell: GridCell): void {
    if (!this.sequence) return;

    const added = this.sequence.toggleNote(cell.step, cell.pitch);

    // If note was removed, also remove from selection
    if (!added && this.selectionManager) {
      this.selectionManager.deselect(cell.step, cell.pitch);
    }

    console.log(`Note ${added ? 'added' : 'removed'} at step ${cell.step}, pitch ${cell.pitch}`);
    this.forceRender();
  }

  /**
   * Handle note resize from drag
   */
  private onNoteResize(step: number, pitch: number, newDuration: number): void {
    if (!this.sequence) return;

    this.sequence.updateNote(step, pitch, { duration: newDuration });
    console.log(`Note resized at step ${step}, pitch ${pitch}, duration ${newDuration.toFixed(2)}`);
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
    if (!this.sequence || !this.selectionManager) return;

    // Move notes in the sequence
    const moved = this.sequence.moveNotes(notes, deltaStep, deltaPitch);

    // Update selection to track moved notes
    for (const { oldStep, oldPitch, newStep, newPitch } of moved) {
      this.selectionManager.moveNote(oldStep, oldPitch, newStep, newPitch);
    }

    console.log(`Moved ${moved.length} note(s) by delta (${deltaStep.toFixed(2)}, ${deltaPitch})`);
    this.forceRender();
  }

  /**
   * Handle note paste from context menu or long-press
   */
  private onNotePaste(targetStep: number, targetPitch: number): void {
    if (!this.sequence || !this.selectionManager) return;

    const selectedNotes = this.selectionManager.getSelectedNotes();
    if (selectedNotes.length === 0) return;

    // Copy notes to the target position
    const created = this.sequence.copyNotes(selectedNotes, targetStep, targetPitch);

    // Update selection to the newly pasted notes
    if (created.length > 0) {
      this.selectionManager.setSelection(created);
    }

    console.log(`Pasted ${created.length} note(s) at step ${targetStep}, pitch ${targetPitch}`);
    this.forceRender();
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
   * Initialize bar indicators overlay
   */
  initBarIndicators(container: HTMLElement): void {
    this.barIndicators = new BarIndicators(container, this.config, this.barCount);
    this.syncOverlayComponents();
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
