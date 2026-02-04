/**
 * NoteGrid - Main grid class for the MIDI sequencer note grid
 *
 * Manages the Three.js scene, camera, renderer, and coordinates
 * the GridLines and GridControls components.
 */
class NoteGrid {
  /**
   * Creates a new NoteGrid instance
   * @param {HTMLElement} container - The container element for the grid
   * @param {Object} options - Optional configuration overrides
   */
  constructor(container, options = {}) {
    this.container = container;

    // Configuration with defaults
    this.config = {
      minBars: 1,
      maxBars: 128,
      defaultBars: 4,
      minOctaves: 1,
      maxOctaves: 10,
      defaultOctaves: 3,
      stepsPerBar: 16,
      stepsPerQuarter: 4,
      semitonesPerOctave: 12,
      ...options
    };

    // Current grid dimensions
    this.barCount = this.config.defaultBars;
    this.octaveCount = this.config.defaultOctaves;

    // Three.js components
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    // Grid components
    this.gridLines = null;
    this.gridControls = null;
    this.pianoKeys = null;
    this.barIndicators = null;

    // Animation frame ID for cleanup
    this.animationFrameId = null;

    // Render flag - only render when needed
    this.needsRender = true;

    // Initialize
    this.init();
  }

  /**
   * Initializes the Three.js scene and components
   */
  init() {
    this.createScene();
    this.createCamera();
    this.createRenderer();
    this.createGridLines();
    this.createControls();
    this.createPianoKeys();
    this.createBarIndicators();

    // Set up resize handler
    this.onResize = this.onResize.bind(this);
    window.addEventListener('resize', this.onResize);

    // Initial render
    this.updateCameraBounds();
    this.render();

    // Initial sync of piano keys and bar indicators
    this.syncOverlayComponents();
  }

  /**
   * Creates the Three.js scene
   */
  createScene() {
    this.scene = new THREE.Scene();

    // Get background color from CSS
    const style = getComputedStyle(document.documentElement);
    const bgColor = style.getPropertyValue('--grid-background').trim() || '#1a1a2e';
    this.scene.background = new THREE.Color(bgColor);
  }

  /**
   * Creates the orthographic camera
   */
  createCamera() {
    // Start with default bounds, will be updated in updateCameraBounds
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
    this.camera.position.set(0, 0, 10);
    this.camera.lookAt(0, 0, 0);
  }

  /**
   * Creates the WebGL renderer
   */
  createRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false
    });

    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.container.appendChild(this.renderer.domElement);
  }

  /**
   * Creates the grid lines component
   */
  createGridLines() {
    this.gridLines = new GridLines(this.scene, this.config);
    this.gridLines.createGridLines(this.barCount, this.octaveCount);
  }

  /**
   * Creates the grid controls component
   */
  createControls() {
    this.gridControls = new GridControls(
      this.camera,
      this.renderer.domElement,
      this.config,
      () => this.forceRender(),
      (cameraState) => this.onCameraChange(cameraState)
    );
    this.gridControls.setGridDimensions(this.barCount, this.octaveCount);
  }

  /**
   * Creates the piano keys component
   */
  createPianoKeys() {
    const pianoKeysContainer = document.getElementById('piano-keys-container');
    if (pianoKeysContainer) {
      this.pianoKeys = new PianoKeys(pianoKeysContainer, this.config, this.octaveCount);
    }
  }

  /**
   * Creates the bar indicators component
   */
  createBarIndicators() {
    const barIndicatorsContainer = document.getElementById('bar-indicators-container');
    if (barIndicatorsContainer) {
      this.barIndicators = new BarIndicators(barIndicatorsContainer, this.config, this.barCount);
    }
  }

  /**
   * Called when camera bounds change (pan/zoom)
   * @param {Object} cameraState - Camera bounds {left, right, top, bottom}
   */
  onCameraChange(cameraState) {
    this.syncOverlayComponents();
  }

  /**
   * Syncs piano keys and bar indicators with current camera state
   */
  syncOverlayComponents() {
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
   * @returns {Object} Camera bounds {left, right, top, bottom}
   */
  getCameraState() {
    return {
      left: this.camera.left,
      right: this.camera.right,
      top: this.camera.top,
      bottom: this.camera.bottom
    };
  }

  /**
   * Updates camera bounds to show the entire grid
   */
  updateCameraBounds() {
    const gridWidth = this.barCount * this.config.stepsPerBar;
    const gridHeight = this.octaveCount * this.config.semitonesPerOctave;

    // Get container aspect ratio
    const containerWidth = this.container.clientWidth;
    const containerHeight = this.container.clientHeight;
    const containerAspect = containerWidth / containerHeight;

    // Grid aspect ratio
    const gridAspect = gridWidth / gridHeight;

    // Add padding around the grid (5% on each side)
    const padding = 0.05;
    let viewWidth, viewHeight;

    if (containerAspect > gridAspect) {
      // Container is wider than grid - fit to height
      viewHeight = gridHeight * (1 + padding * 2);
      viewWidth = viewHeight * containerAspect;
    } else {
      // Container is taller than grid - fit to width
      viewWidth = gridWidth * (1 + padding * 2);
      viewHeight = viewWidth / containerAspect;
    }

    // Center the view on the grid
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
   * @param {number} count - Number of bars (clamped to valid range)
   */
  setBarCount(count) {
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
   * @param {number} count - Number of octaves (clamped to valid range)
   */
  setOctaveCount(count) {
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
  rebuildGrid() {
    this.gridLines.update(this.barCount, this.octaveCount);
    this.gridControls.setGridDimensions(this.barCount, this.octaveCount);

    // Update overlay components
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
   * @returns {number}
   */
  getBarCount() {
    return this.barCount;
  }

  /**
   * Gets the current octave count
   * @returns {number}
   */
  getOctaveCount() {
    return this.octaveCount;
  }

  /**
   * Handles window resize events
   */
  onResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.renderer.setSize(width, height);

    // Update grid controls aspect ratio
    if (this.gridControls) {
      this.gridControls.updateContainerAspect();
      // Reset pan state during resize
      this.gridControls.isPanning = false;
    }

    this.updateCameraBounds();
    this.render();

    // Sync overlay components after resize
    this.syncOverlayComponents();
  }

  /**
   * Renders the scene
   */
  render() {
    if (this.needsRender) {
      this.renderer.render(this.scene, this.camera);
      this.needsRender = false;
    }
  }

  /**
   * Starts the render loop (for continuous rendering if needed)
   */
  startRenderLoop() {
    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate);
      this.render();
    };
    animate();
  }

  /**
   * Stops the render loop
   */
  stopRenderLoop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Forces a re-render
   */
  forceRender() {
    this.needsRender = true;
    this.render();
  }

  /**
   * Disposes of all resources
   */
  dispose() {
    this.stopRenderLoop();
    window.removeEventListener('resize', this.onResize);

    if (this.gridLines) {
      this.gridLines.dispose();
    }

    if (this.gridControls) {
      this.gridControls.dispose();
    }

    if (this.pianoKeys) {
      this.pianoKeys.dispose();
    }

    if (this.barIndicators) {
      this.barIndicators.dispose();
    }

    if (this.renderer) {
      this.renderer.dispose();
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
