import * as THREE from 'three';
import { GridConfig, GridLineStyles, LineStyle, loadLineStyles, LINE_WIDTH_SCALE } from '@/config/GridConfig';

/**
 * GridLines - Handles rendering of grid lines for the note grid
 *
 * Renders five types of lines as quads (rectangles) for proper thickness:
 * - Vertical: bar lines, quarter lines, step lines
 * - Horizontal: octave lines, semitone lines
 */
export class GridLines {
  private scene: THREE.Scene;
  private config: GridConfig;
  private gridGroup: THREE.Group;
  private meshes: THREE.Mesh[] = [];
  private styles: GridLineStyles;

  constructor(scene: THREE.Scene, config: GridConfig) {
    this.scene = scene;
    this.config = config;

    // Group to hold all grid lines
    this.gridGroup = new THREE.Group();
    this.gridGroup.name = 'gridLines';
    this.scene.add(this.gridGroup);

    // Load styles from CSS
    this.styles = loadLineStyles();
  }

  /**
   * Creates all grid lines based on current bar and octave count
   */
  createGridLines(barCount: number, octaveCount: number): void {
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
   */
  private createVerticalLines(totalSteps: number, totalSemitones: number): void {
    const stepPositions: number[] = [];
    const quarterPositions: number[] = [];
    const barPositions: number[] = [];

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
   */
  private createHorizontalLines(totalSteps: number, totalSemitones: number): void {
    const semitonePositions: number[] = [];
    const octavePositions: number[] = [];

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
   */
  private createQuadSet(
    positions: number[],
    length: number,
    isVertical: boolean,
    style: LineStyle,
    zOffset: number
  ): void {
    if (positions.length === 0) return;

    const halfWidth = (style.width * LINE_WIDTH_SCALE) / 2;
    const numQuads = positions.length;

    // Each quad has 4 vertices, 6 indices (2 triangles)
    const vertices = new Float32Array(numQuads * 4 * 3);
    const indices = new Uint32Array(numQuads * 6);

    for (let i = 0; i < numQuads; i++) {
      const pos = positions[i];
      const vertexOffset = i * 12;
      const indexOffset = i * 6;
      const vertexIndex = i * 4;

      if (isVertical) {
        // Vertical quad: thin rectangle along Y axis
        vertices[vertexOffset + 0] = pos - halfWidth;
        vertices[vertexOffset + 1] = 0;
        vertices[vertexOffset + 2] = zOffset;

        vertices[vertexOffset + 3] = pos + halfWidth;
        vertices[vertexOffset + 4] = 0;
        vertices[vertexOffset + 5] = zOffset;

        vertices[vertexOffset + 6] = pos + halfWidth;
        vertices[vertexOffset + 7] = length;
        vertices[vertexOffset + 8] = zOffset;

        vertices[vertexOffset + 9] = pos - halfWidth;
        vertices[vertexOffset + 10] = length;
        vertices[vertexOffset + 11] = zOffset;
      } else {
        // Horizontal quad: thin rectangle along X axis
        vertices[vertexOffset + 0] = 0;
        vertices[vertexOffset + 1] = pos - halfWidth;
        vertices[vertexOffset + 2] = zOffset;

        vertices[vertexOffset + 3] = length;
        vertices[vertexOffset + 4] = pos - halfWidth;
        vertices[vertexOffset + 5] = zOffset;

        vertices[vertexOffset + 6] = length;
        vertices[vertexOffset + 7] = pos + halfWidth;
        vertices[vertexOffset + 8] = zOffset;

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
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geometry, material);
    this.gridGroup.add(mesh);
    this.meshes.push(mesh);
  }

  /**
   * Clears all existing grid lines
   */
  private clearLines(): void {
    for (const mesh of this.meshes) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      this.gridGroup.remove(mesh);
    }
    this.meshes = [];
  }

  /**
   * Updates the grid lines when dimensions change
   */
  update(barCount: number, octaveCount: number): void {
    this.createGridLines(barCount, octaveCount);
  }

  /**
   * Disposes of all resources
   */
  dispose(): void {
    this.clearLines();
    this.scene.remove(this.gridGroup);
  }
}
