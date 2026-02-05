import * as THREE from 'three';
import { GridConfig, GridLineStyles, LineStyle, loadLineStyles, LINE_WIDTH_SCALE, BASE_MIDI } from '@/config/GridConfig';
import type { ScaleManager } from '@/core/ScaleManager';

// Black key semitone positions within each octave (C#, D#, F#, G#, A#)
const BLACK_KEY_SEMITONES = [1, 3, 6, 8, 10];

// Row background colors
const WHITE_KEY_COLOR = 0x1a1a2e; // Slightly lighter than background
const BLACK_KEY_COLOR = 0x12121f; // Darker for black keys

// Scale highlight colors (in-scale rows get a subtle tint)
const WHITE_KEY_IN_SCALE_COLOR = 0x1e1e38; // Slightly brighter/warmer
const BLACK_KEY_IN_SCALE_COLOR = 0x161628; // Slightly brighter
const WHITE_KEY_OUT_SCALE_COLOR = 0x141420; // Dimmed
const BLACK_KEY_OUT_SCALE_COLOR = 0x0e0e18; // More dimmed

/**
 * GridLines - Handles rendering of grid lines for the note grid
 *
 * Renders five types of lines as quads (rectangles) for proper thickness:
 * - Vertical: bar lines, quarter lines, step lines
 * - Horizontal: octave lines, semitone lines
 * Also renders row backgrounds to distinguish white/black piano keys.
 */
export class GridLines {
  private scene: THREE.Scene;
  private config: GridConfig;
  private gridGroup: THREE.Group;
  private meshes: THREE.Mesh[] = [];
  private styles: GridLineStyles;

  // Scale manager reference for scale highlighting
  private scaleManager: ScaleManager | null = null;

  // Separate tracking for row background meshes (for scale updates)
  private rowBackgroundMeshes: THREE.Mesh[] = [];

  // Current dimensions (needed for scale updates)
  private currentBarCount = 0;
  private currentOctaveCount = 0;

  // Bound listener for cleanup
  private boundOnScaleChange: (() => void) | null = null;

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
   * Set the scale manager for scale-aware row highlighting
   */
  setScaleManager(scaleManager: ScaleManager): void {
    // Remove old listener
    if (this.scaleManager && this.boundOnScaleChange) {
      this.scaleManager.offChange(this.boundOnScaleChange);
    }

    this.scaleManager = scaleManager;

    // Listen for scale changes
    this.boundOnScaleChange = () => this.updateRowBackgrounds();
    this.scaleManager.onChange(this.boundOnScaleChange);

    // Update immediately if grid exists
    if (this.currentBarCount > 0 && this.currentOctaveCount > 0) {
      this.updateRowBackgrounds();
    }
  }

  /**
   * Creates all grid lines based on current bar and octave count
   */
  createGridLines(barCount: number, octaveCount: number): void {
    this.clearLines();

    // Store dimensions for scale updates
    this.currentBarCount = barCount;
    this.currentOctaveCount = octaveCount;

    const totalSteps = barCount * this.config.stepsPerBar;
    const totalSemitones = octaveCount * this.config.semitonesPerOctave;

    // Create row backgrounds first (behind everything)
    this.createRowBackgrounds(totalSteps, totalSemitones);

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
   * Creates row background quads to distinguish white/black piano keys
   * Also applies scale highlighting when a scale manager is set
   */
  private createRowBackgrounds(totalSteps: number, totalSemitones: number): void {
    // Clear existing row background meshes
    this.clearRowBackgrounds();

    // Group rows by type and scale membership
    const whiteKeyInScale: number[] = [];
    const whiteKeyOutScale: number[] = [];
    const blackKeyInScale: number[] = [];
    const blackKeyOutScale: number[] = [];

    for (let semitone = 0; semitone < totalSemitones; semitone++) {
      const semitoneInOctave = semitone % this.config.semitonesPerOctave;
      const isBlackKey = BLACK_KEY_SEMITONES.includes(semitoneInOctave);

      // Convert grid row to MIDI pitch for scale checking
      const midiPitch = BASE_MIDI + semitone;
      const inScale = this.scaleManager?.isInScale(midiPitch) ?? true; // Default to in-scale if no manager

      if (isBlackKey) {
        if (inScale) {
          blackKeyInScale.push(semitone);
        } else {
          blackKeyOutScale.push(semitone);
        }
      } else {
        if (inScale) {
          whiteKeyInScale.push(semitone);
        } else {
          whiteKeyOutScale.push(semitone);
        }
      }
    }

    // Create background quads behind everything (z = -0.1)
    // Use scale-aware colors when scale manager is set, otherwise default colors
    if (this.scaleManager && !this.scaleManager.isChromatic()) {
      this.createRowQuads(whiteKeyInScale, totalSteps, WHITE_KEY_IN_SCALE_COLOR, -0.1, true);
      this.createRowQuads(whiteKeyOutScale, totalSteps, WHITE_KEY_OUT_SCALE_COLOR, -0.1, true);
      this.createRowQuads(blackKeyInScale, totalSteps, BLACK_KEY_IN_SCALE_COLOR, -0.1, true);
      this.createRowQuads(blackKeyOutScale, totalSteps, BLACK_KEY_OUT_SCALE_COLOR, -0.1, true);
    } else {
      // No scale or chromatic - use default colors
      this.createRowQuads([...whiteKeyInScale, ...whiteKeyOutScale], totalSteps, WHITE_KEY_COLOR, -0.1, true);
      this.createRowQuads([...blackKeyInScale, ...blackKeyOutScale], totalSteps, BLACK_KEY_COLOR, -0.1, true);
    }
  }

  /**
   * Updates row backgrounds when scale changes (without rebuilding entire grid)
   */
  private updateRowBackgrounds(): void {
    if (this.currentBarCount === 0 || this.currentOctaveCount === 0) return;

    const totalSteps = this.currentBarCount * this.config.stepsPerBar;
    const totalSemitones = this.currentOctaveCount * this.config.semitonesPerOctave;

    this.createRowBackgrounds(totalSteps, totalSemitones);
  }

  /**
   * Clears row background meshes only (for scale updates)
   */
  private clearRowBackgrounds(): void {
    for (const mesh of this.rowBackgroundMeshes) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      this.gridGroup.remove(mesh);

      // Also remove from main meshes array
      const index = this.meshes.indexOf(mesh);
      if (index !== -1) {
        this.meshes.splice(index, 1);
      }
    }
    this.rowBackgroundMeshes = [];
  }

  /**
   * Creates a set of row background quads
   */
  private createRowQuads(
    rows: number[],
    width: number,
    color: number,
    zPosition: number,
    isRowBackground: boolean = false
  ): void {
    if (rows.length === 0) return;

    const numQuads = rows.length;
    const vertices = new Float32Array(numQuads * 4 * 3);
    const indices = new Uint32Array(numQuads * 6);

    for (let i = 0; i < numQuads; i++) {
      const row = rows[i];
      const vertexOffset = i * 12;
      const indexOffset = i * 6;
      const vertexIndex = i * 4;

      // Full-width quad for the row (y from row to row+1)
      vertices[vertexOffset + 0] = 0;
      vertices[vertexOffset + 1] = row;
      vertices[vertexOffset + 2] = zPosition;

      vertices[vertexOffset + 3] = width;
      vertices[vertexOffset + 4] = row;
      vertices[vertexOffset + 5] = zPosition;

      vertices[vertexOffset + 6] = width;
      vertices[vertexOffset + 7] = row + 1;
      vertices[vertexOffset + 8] = zPosition;

      vertices[vertexOffset + 9] = 0;
      vertices[vertexOffset + 10] = row + 1;
      vertices[vertexOffset + 11] = zPosition;

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
      color: color,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geometry, material);
    this.gridGroup.add(mesh);
    this.meshes.push(mesh);

    // Track row backgrounds separately for efficient scale updates
    if (isRowBackground) {
      this.rowBackgroundMeshes.push(mesh);
    }
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
    this.rowBackgroundMeshes = [];
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
    // Remove scale manager listener
    if (this.scaleManager && this.boundOnScaleChange) {
      this.scaleManager.offChange(this.boundOnScaleChange);
    }

    this.clearLines();
    this.scene.remove(this.gridGroup);
  }
}
