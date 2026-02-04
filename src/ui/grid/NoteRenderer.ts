import * as THREE from 'three';
import { Sequence } from '@/core/Sequence';
import { SelectionManager } from '@/core/SelectionManager';
import {
  GridConfig,
  BASE_MIDI,
  NOTE_COLOR,
  NOTE_SELECTED_COLOR,
  HANDLE_COLOR,
  NOTE_Z_POSITION,
  HANDLE_Z_POSITION,
} from '@/config/GridConfig';
import { isTouchDevice } from '@/utils';

/**
 * Note mesh user data for identification
 */
interface NoteMeshData {
  step: number;
  pitch: number;
  duration: number;
}

/**
 * NoteRenderer - Manages note visualization in the Three.js scene
 *
 * Subscribes to Sequence changes and automatically updates note meshes.
 * Each note is rendered as a colored rectangle in the grid.
 */
export class NoteRenderer {
  private scene: THREE.Scene;
  private sequence: Sequence;
  private _config: GridConfig; // Stored for future use (e.g., grid dimension changes)

  // Device detection
  private isMobile: boolean;

  // Selection manager reference
  private selectionManager: SelectionManager | null = null;

  // Note rendering settings (using config constants)
  private noteColor = NOTE_COLOR;
  private noteSelectedColor = NOTE_SELECTED_COLOR;
  private handleColor = HANDLE_COLOR;
  private noteZPosition = NOTE_Z_POSITION;
  private handleZPosition = HANDLE_Z_POSITION;

  // Note mesh storage
  private noteMeshes: Map<string, THREE.Mesh> = new Map();
  private handleMeshes: Map<string, THREE.Mesh> = new Map();
  private noteGroup: THREE.Group;

  // Shared geometry and material for performance
  private noteGeometry: THREE.PlaneGeometry;
  private noteMaterial: THREE.MeshBasicMaterial;
  private handleGeometry: THREE.PlaneGeometry;
  private handleMaterial: THREE.MeshBasicMaterial;

  // Change listener reference for cleanup
  private boundOnSequenceChange: () => void;

  constructor(scene: THREE.Scene, sequence: Sequence, config: GridConfig) {
    this.scene = scene;
    this.sequence = sequence;
    this._config = config;
    this.isMobile = isTouchDevice();

    // Create group for notes
    this.noteGroup = new THREE.Group();
    this.noteGroup.name = 'notes';
    this.scene.add(this.noteGroup);

    // Create shared geometry (1x1 unit, will be scaled per note)
    this.noteGeometry = new THREE.PlaneGeometry(1, 1);

    // Create shared material
    this.noteMaterial = new THREE.MeshBasicMaterial({
      color: this.noteColor,
      side: THREE.DoubleSide,
    });

    // Create handle geometry and material
    this.handleGeometry = new THREE.PlaneGeometry(1, 1);
    this.handleMaterial = new THREE.MeshBasicMaterial({
      color: this.handleColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
    });

    // Subscribe to sequence changes
    this.boundOnSequenceChange = this.onSequenceChange.bind(this);
    this.sequence.onChange(this.boundOnSequenceChange);

    // Initial render
    this.renderAllNotes();
  }

  /**
   * Generate a unique key for a note at step/pitch
   */
  private getNoteKey(step: number, pitch: number): string {
    return `${step}:${pitch}`;
  }

  /**
   * Create a mesh for a note
   */
  private createNoteMesh(step: number, pitch: number, duration: number): THREE.Mesh {
    // Clone material so we can modify individual notes later if needed
    const material = this.noteMaterial.clone();

    // Set color based on selection state
    const isSelected = this.selectionManager?.isSelected(step, pitch) ?? false;
    material.color.setHex(isSelected ? this.noteSelectedColor : this.noteColor);

    const mesh = new THREE.Mesh(this.noteGeometry, material);

    // Convert pitch to grid Y (semitone offset from base)
    const semitone = pitch - BASE_MIDI;

    // Calculate note dimensions
    // Width: based on duration (1.0 = full step width)
    // Height: slightly less than 1 to show grid lines
    const noteWidth = duration * 0.95;
    const noteHeight = 0.85;

    // Position: center of the cell + offset for duration
    const x = step + noteWidth / 2 + 0.025;
    const y = semitone + 0.5;

    mesh.position.set(x, y, this.noteZPosition);
    mesh.scale.set(noteWidth, noteHeight, 1);

    // Store identification data including duration
    mesh.userData = { step, pitch, duration } as NoteMeshData;

    return mesh;
  }

  /**
   * Create a resize handle mesh for a note
   */
  private createHandleMesh(step: number, pitch: number, duration: number): THREE.Mesh {
    const material = this.handleMaterial.clone();
    const mesh = new THREE.Mesh(this.handleGeometry, material);

    const semitone = pitch - BASE_MIDI;

    // Handle dimensions: thin vertical bar at right edge
    const handleWidth = 0.08;
    const handleHeight = 0.85;
    const noteWidth = duration * 0.95;

    // Position at right edge of note
    const x = step + noteWidth + 0.025 - handleWidth / 2;
    const y = semitone + 0.5;

    mesh.position.set(x, y, this.handleZPosition);
    mesh.scale.set(handleWidth, handleHeight, 1);

    mesh.userData = { step, pitch, duration, isHandle: true };

    return mesh;
  }

  /**
   * Add a note mesh to the scene
   */
  private addNoteMesh(step: number, pitch: number, duration: number): void {
    const key = this.getNoteKey(step, pitch);

    // Remove existing mesh if any
    this.removeNoteMesh(step, pitch);

    // Create and add note mesh
    const mesh = this.createNoteMesh(step, pitch, duration);
    this.noteGroup.add(mesh);
    this.noteMeshes.set(key, mesh);

    // Create and add handle mesh (PC only - mobile uses long-press)
    if (!this.isMobile) {
      const handle = this.createHandleMesh(step, pitch, duration);
      this.noteGroup.add(handle);
      this.handleMeshes.set(key, handle);
    }
  }

  /**
   * Remove a note mesh from the scene
   */
  private removeNoteMesh(step: number, pitch: number): void {
    const key = this.getNoteKey(step, pitch);

    // Remove note mesh
    const mesh = this.noteMeshes.get(key);
    if (mesh) {
      this.noteGroup.remove(mesh);
      (mesh.material as THREE.Material).dispose();
      this.noteMeshes.delete(key);
    }

    // Remove handle mesh
    const handle = this.handleMeshes.get(key);
    if (handle) {
      this.noteGroup.remove(handle);
      (handle.material as THREE.Material).dispose();
      this.handleMeshes.delete(key);
    }
  }

  /**
   * Update a note mesh (e.g., when duration changes)
   * Public for duration editing feature
   */
  updateNoteMesh(step: number, pitch: number, duration: number): void {
    const key = this.getNoteKey(step, pitch);
    const mesh = this.noteMeshes.get(key);

    if (mesh) {
      const noteWidth = duration * 0.95;
      const x = step + noteWidth / 2 + 0.025;

      mesh.position.x = x;
      mesh.scale.x = noteWidth;
      mesh.userData.duration = duration;

      // Update handle position (PC only)
      if (!this.isMobile) {
        const handle = this.handleMeshes.get(key);
        if (handle) {
          const handleWidth = 0.08;
          handle.position.x = step + noteWidth + 0.025 - handleWidth / 2;
          handle.userData.duration = duration;
        }
      }
    } else {
      // Mesh doesn't exist, create it
      this.addNoteMesh(step, pitch, duration);
    }
  }

  /**
   * Clear all note meshes
   */
  private clearAllNotes(): void {
    // Clear note meshes
    for (const mesh of this.noteMeshes.values()) {
      this.noteGroup.remove(mesh);
      (mesh.material as THREE.Material).dispose();
    }
    this.noteMeshes.clear();

    // Clear handle meshes
    for (const handle of this.handleMeshes.values()) {
      this.noteGroup.remove(handle);
      (handle.material as THREE.Material).dispose();
    }
    this.handleMeshes.clear();
  }

  /**
   * Render all notes from the sequence
   */
  private renderAllNotes(): void {
    this.clearAllNotes();

    const allNotes = this.sequence.getAllNotes();
    for (const { step, notes } of allNotes) {
      for (const note of notes) {
        this.addNoteMesh(step, note.pitch, note.duration);
      }
    }
  }

  /**
   * Handle sequence change event
   * For simplicity, re-render all notes on any change.
   * Could be optimized to only update changed notes.
   */
  private onSequenceChange(): void {
    this.renderAllNotes();
  }

  /**
   * Set the note color
   */
  setNoteColor(color: number): void {
    this.noteColor = color;
    this.noteMaterial.color.setHex(color);

    // Update existing notes
    for (const mesh of this.noteMeshes.values()) {
      (mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
    }
  }

  /**
   * Highlight a specific note (e.g., during playback)
   */
  highlightNote(step: number, pitch: number, highlight: boolean): void {
    const key = this.getNoteKey(step, pitch);
    const mesh = this.noteMeshes.get(key);

    if (mesh) {
      const color = highlight ? this.noteSelectedColor : this.noteColor;
      (mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
    }
  }

  /**
   * Get the note mesh at a specific position (for hit testing)
   */
  getNoteMeshAt(step: number, pitch: number): THREE.Mesh | undefined {
    const key = this.getNoteKey(step, pitch);
    return this.noteMeshes.get(key);
  }

  /**
   * Find a note at world coordinates
   * Returns note info if found, including whether the point is near the resize handle
   * @param handleZoneWidth Width of the handle detection zone (0 to disable handle detection)
   */
  getNoteAtWorld(worldX: number, worldY: number, handleZoneWidth: number = 0.33): {
    step: number;
    pitch: number;
    duration: number;
    isNearHandle: boolean;
  } | null {
    const semitone = Math.floor(worldY);
    const pitch = BASE_MIDI + semitone;

    // Check all notes at this pitch level
    for (const [_key, mesh] of this.noteMeshes) {
      const data = mesh.userData as NoteMeshData;
      if (data.pitch !== pitch) continue;

      const noteStart = data.step + 0.025;
      const noteWidth = data.duration * 0.95;
      const noteEnd = noteStart + noteWidth;

      // Check if worldX is within this note
      if (worldX >= noteStart && worldX <= noteEnd) {
        // Check if near the handle (right edge)
        const isNearHandle = handleZoneWidth > 0 && worldX >= noteEnd - handleZoneWidth;

        return {
          step: data.step,
          pitch: data.pitch,
          duration: data.duration,
          isNearHandle,
        };
      }
    }

    return null;
  }

  /**
   * Force a re-render of all notes
   */
  refresh(): void {
    this.renderAllNotes();
  }

  /**
   * Get the grid configuration
   */
  getConfig(): GridConfig {
    return this._config;
  }

  /**
   * Set the selection manager
   */
  setSelectionManager(manager: SelectionManager): void {
    this.selectionManager = manager;

    // Listen for selection changes to update colors
    manager.onChange(() => {
      this.updateSelectionColors();
    });
  }

  /**
   * Update note colors based on selection state
   */
  private updateSelectionColors(): void {
    for (const [_key, mesh] of this.noteMeshes) {
      const data = mesh.userData as NoteMeshData;
      const isSelected = this.selectionManager?.isSelected(data.step, data.pitch) ?? false;
      const color = isSelected ? this.noteSelectedColor : this.noteColor;
      (mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
    }
  }

  /**
   * Check if a note is selected
   */
  isNoteSelected(step: number, pitch: number): boolean {
    return this.selectionManager?.isSelected(step, pitch) ?? false;
  }

  /**
   * Temporarily offset notes visually during drag (doesn't modify sequence data)
   * @param notes Notes to offset
   * @param deltaStep Horizontal offset in steps
   * @param deltaPitch Vertical offset in semitones
   */
  offsetNotes(
    notes: Array<{ step: number; pitch: number }>,
    deltaStep: number,
    deltaPitch: number
  ): void {
    for (const { step, pitch } of notes) {
      const key = this.getNoteKey(step, pitch);
      const mesh = this.noteMeshes.get(key);
      if (!mesh) continue;

      const data = mesh.userData as NoteMeshData;
      const semitone = data.pitch - BASE_MIDI;

      // Calculate original position
      const noteWidth = data.duration * 0.95;
      const originalX = data.step + noteWidth / 2 + 0.025;
      const originalY = semitone + 0.5;

      // Apply offset
      mesh.position.x = originalX + deltaStep;
      mesh.position.y = originalY + deltaPitch;

      // Also offset handle (PC only)
      const handle = this.handleMeshes.get(key);
      if (handle) {
        const handleWidth = 0.08;
        const originalHandleX = data.step + noteWidth + 0.025 - handleWidth / 2;
        handle.position.x = originalHandleX + deltaStep;
        handle.position.y = originalY + deltaPitch;
      }
    }
  }

  /**
   * Reset all note positions to their original locations
   * Called after drag ends (whether committed or cancelled)
   */
  resetNoteOffsets(): void {
    this.renderAllNotes();
  }

  /**
   * Get all notes that intersect with a rectangular region
   * Used for selection rectangle
   */
  getNotesInRegion(
    minX: number,
    maxX: number,
    minY: number,
    maxY: number
  ): Array<{ step: number; pitch: number }> {
    const result: Array<{ step: number; pitch: number }> = [];

    for (const [_key, mesh] of this.noteMeshes) {
      const data = mesh.userData as NoteMeshData;
      const semitone = data.pitch - BASE_MIDI;

      // Note bounds
      const noteLeft = data.step + 0.025;
      const noteRight = noteLeft + data.duration * 0.95;
      const noteBottom = semitone;
      const noteTop = semitone + 1;

      // Check intersection
      if (
        noteRight >= minX &&
        noteLeft <= maxX &&
        noteTop >= minY &&
        noteBottom <= maxY
      ) {
        result.push({ step: data.step, pitch: data.pitch });
      }
    }

    return result;
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    // Unsubscribe from sequence
    this.sequence.offChange(this.boundOnSequenceChange);

    // Clear all meshes
    this.clearAllNotes();

    // Dispose shared resources
    this.noteGeometry.dispose();
    this.noteMaterial.dispose();
    this.handleGeometry.dispose();
    this.handleMaterial.dispose();

    // Remove group from scene
    this.scene.remove(this.noteGroup);
  }
}
