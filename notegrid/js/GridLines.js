/**
 * GridLines - Handles rendering of grid lines for the note grid
 *
 * Renders five types of lines as quads (rectangles) for proper thickness:
 * - Vertical: bar lines, quarter lines, step lines
 * - Horizontal: octave lines, semitone lines
 */
class GridLines {
  /**
   * Creates a new GridLines instance
   * @param {THREE.Scene} scene - The Three.js scene to add lines to
   * @param {Object} config - Grid configuration
   */
  constructor(scene, config) {
    this.scene = scene;
    this.config = config;

    // Scale factor to convert CSS line widths to world units
    // CSS width of 1 = 0.02 world units (2% of a grid cell)
    this.lineWidthScale = 0.02;

    // Group to hold all grid lines
    this.gridGroup = new THREE.Group();
    this.gridGroup.name = 'gridLines';
    this.scene.add(this.gridGroup);

    // Store meshes for disposal
    this.meshes = [];

    // Get CSS custom properties for styling
    this.loadStyles();
  }

  /**
   * Loads line styles from CSS custom properties
   */
  loadStyles() {
    const root = document.documentElement;
    const style = getComputedStyle(root);

    this.styles = {
      barLine: {
        color: style.getPropertyValue('--bar-line-color').trim() || '#e0e0e0',
        width: parseFloat(style.getPropertyValue('--bar-line-width')) || 3
      },
      quarterLine: {
        color: style.getPropertyValue('--quarter-line-color').trim() || '#6a6a8a',
        width: parseFloat(style.getPropertyValue('--quarter-line-width')) || 2
      },
      stepLine: {
        color: style.getPropertyValue('--step-line-color').trim() || '#3a3a4e',
        width: parseFloat(style.getPropertyValue('--step-line-width')) || 1
      },
      octaveLine: {
        color: style.getPropertyValue('--octave-line-color').trim() || '#7a7a9a',
        width: parseFloat(style.getPropertyValue('--octave-line-width')) || 2
      },
      semitoneLine: {
        color: style.getPropertyValue('--semitone-line-color').trim() || '#2e2e3e',
        width: parseFloat(style.getPropertyValue('--semitone-line-width')) || 1
      }
    };
  }

  /**
   * Creates all grid lines based on current bar and octave count
   * @param {number} barCount - Number of bars
   * @param {number} octaveCount - Number of octaves
   */
  createGridLines(barCount, octaveCount) {
    // Clear existing lines
    this.clearLines();

    const totalSteps = barCount * this.config.stepsPerBar;
    const totalSemitones = octaveCount * this.config.semitonesPerOctave;

    // Create vertical lines (time divisions) - rendered back to front for proper z-ordering
    this.createVerticalLines(totalSteps, totalSemitones);

    // Create horizontal lines (pitch divisions)
    this.createHorizontalLines(totalSteps, totalSemitones);
  }

  /**
   * Creates vertical lines (step, quarter, bar lines)
   * @param {number} totalSteps - Total number of steps
   * @param {number} totalSemitones - Total number of semitones (grid height)
   */
  createVerticalLines(totalSteps, totalSemitones) {
    // Collect line positions by type
    const stepPositions = [];
    const quarterPositions = [];
    const barPositions = [];

    for (let step = 0; step <= totalSteps; step++) {
      if (step % this.config.stepsPerBar === 0) {
        barPositions.push(step);
      } else if (step % this.config.stepsPerQuarter === 0) {
        quarterPositions.push(step);
      } else {
        stepPositions.push(step);
      }
    }

    // Create quads in order: step (back), quarter (middle), bar (front)
    this.createQuadSet(stepPositions, totalSemitones, true, this.styles.stepLine, 0);
    this.createQuadSet(quarterPositions, totalSemitones, true, this.styles.quarterLine, 0.1);
    this.createQuadSet(barPositions, totalSemitones, true, this.styles.barLine, 0.2);
  }

  /**
   * Creates horizontal lines (semitone, octave lines)
   * @param {number} totalSteps - Total number of steps (grid width)
   * @param {number} totalSemitones - Total number of semitones
   */
  createHorizontalLines(totalSteps, totalSemitones) {
    // Collect line positions by type
    const semitonePositions = [];
    const octavePositions = [];

    for (let semitone = 0; semitone <= totalSemitones; semitone++) {
      if (semitone % this.config.semitonesPerOctave === 0) {
        octavePositions.push(semitone);
      } else {
        semitonePositions.push(semitone);
      }
    }

    // Create quads in order: semitone (back), octave (front)
    this.createQuadSet(semitonePositions, totalSteps, false, this.styles.semitoneLine, 0.05);
    this.createQuadSet(octavePositions, totalSteps, false, this.styles.octaveLine, 0.15);
  }

  /**
   * Creates a set of quads (rectangles) for lines with the same style
   * @param {number[]} positions - Array of positions (x for vertical, y for horizontal)
   * @param {number} length - The length of each line
   * @param {boolean} isVertical - True for vertical lines, false for horizontal
   * @param {Object} style - Style object with color and width
   * @param {number} zOffset - Z position offset for layering
   */
  createQuadSet(positions, length, isVertical, style, zOffset) {
    if (positions.length === 0) return;

    const halfWidth = (style.width * this.lineWidthScale) / 2;
    const numQuads = positions.length;

    // Each quad has 4 vertices, 6 indices (2 triangles)
    const vertices = new Float32Array(numQuads * 4 * 3); // 4 vertices × 3 components (x,y,z)
    const indices = new Uint32Array(numQuads * 6);       // 6 indices per quad

    for (let i = 0; i < numQuads; i++) {
      const pos = positions[i];
      const vertexOffset = i * 12; // 4 vertices × 3 components
      const indexOffset = i * 6;
      const vertexIndex = i * 4;

      if (isVertical) {
        // Vertical quad: thin rectangle along Y axis
        // Bottom-left
        vertices[vertexOffset + 0] = pos - halfWidth;
        vertices[vertexOffset + 1] = 0;
        vertices[vertexOffset + 2] = zOffset;
        // Bottom-right
        vertices[vertexOffset + 3] = pos + halfWidth;
        vertices[vertexOffset + 4] = 0;
        vertices[vertexOffset + 5] = zOffset;
        // Top-right
        vertices[vertexOffset + 6] = pos + halfWidth;
        vertices[vertexOffset + 7] = length;
        vertices[vertexOffset + 8] = zOffset;
        // Top-left
        vertices[vertexOffset + 9] = pos - halfWidth;
        vertices[vertexOffset + 10] = length;
        vertices[vertexOffset + 11] = zOffset;
      } else {
        // Horizontal quad: thin rectangle along X axis
        // Bottom-left
        vertices[vertexOffset + 0] = 0;
        vertices[vertexOffset + 1] = pos - halfWidth;
        vertices[vertexOffset + 2] = zOffset;
        // Bottom-right
        vertices[vertexOffset + 3] = length;
        vertices[vertexOffset + 4] = pos - halfWidth;
        vertices[vertexOffset + 5] = zOffset;
        // Top-right
        vertices[vertexOffset + 6] = length;
        vertices[vertexOffset + 7] = pos + halfWidth;
        vertices[vertexOffset + 8] = zOffset;
        // Top-left
        vertices[vertexOffset + 9] = 0;
        vertices[vertexOffset + 10] = pos + halfWidth;
        vertices[vertexOffset + 11] = zOffset;
      }

      // Two triangles: (0,1,2) and (0,2,3)
      indices[indexOffset + 0] = vertexIndex + 0;
      indices[indexOffset + 1] = vertexIndex + 1;
      indices[indexOffset + 2] = vertexIndex + 2;
      indices[indexOffset + 3] = vertexIndex + 0;
      indices[indexOffset + 4] = vertexIndex + 2;
      indices[indexOffset + 5] = vertexIndex + 3;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));

    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(style.color),
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geometry, material);
    this.gridGroup.add(mesh);
    this.meshes.push(mesh);
  }

  /**
   * Clears all existing grid lines
   */
  clearLines() {
    for (const mesh of this.meshes) {
      mesh.geometry.dispose();
      mesh.material.dispose();
      this.gridGroup.remove(mesh);
    }
    this.meshes = [];
  }

  /**
   * Updates the grid lines when dimensions change
   * @param {number} barCount - New bar count
   * @param {number} octaveCount - New octave count
   */
  update(barCount, octaveCount) {
    this.createGridLines(barCount, octaveCount);
  }

  /**
   * Disposes of all resources
   */
  dispose() {
    this.clearLines();
    this.scene.remove(this.gridGroup);
  }
}
