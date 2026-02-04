import * as THREE from 'three';
import { GridConfig } from '@/config/GridConfig';

/**
 * PlaybackIndicator - Visual indicator showing current playback position
 *
 * Renders a vertical line in the Three.js scene that moves with the playhead.
 */
export class PlaybackIndicator {
  private scene: THREE.Scene;
  private _config: GridConfig; // Stored for future use
  private mesh: THREE.Mesh | null = null;
  private currentStep = -1;

  // Indicator appearance
  private indicatorColor = 0x00ff88;
  private indicatorWidth = 0.1;
  private indicatorZPosition = 1.0; // In front of notes

  constructor(scene: THREE.Scene, config: GridConfig) {
    this.scene = scene;
    this._config = config;
    this.createMesh();
  }

  /**
   * Get config
   */
  getConfig(): GridConfig {
    return this._config;
  }

  /**
   * Create the indicator mesh
   */
  private createMesh(): void {
    // Create a tall, thin rectangle
    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({
      color: this.indicatorColor,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.visible = false;
    this.scene.add(this.mesh);
  }

  /**
   * Update indicator position
   * @param step Current playback step (-1 to hide)
   * @param gridHeight Total grid height in semitones
   */
  setPosition(step: number, gridHeight: number): void {
    if (!this.mesh) return;

    this.currentStep = step;

    if (step < 0) {
      // Hide indicator when not playing
      this.mesh.visible = false;
      return;
    }

    // Show and position indicator
    this.mesh.visible = true;

    // Position at the left edge of the current step
    const x = step + this.indicatorWidth / 2;
    const y = gridHeight / 2;

    this.mesh.position.set(x, y, this.indicatorZPosition);
    this.mesh.scale.set(this.indicatorWidth, gridHeight, 1);
  }

  /**
   * Get current step
   */
  getStep(): number {
    return this.currentStep;
  }

  /**
   * Set indicator color
   */
  setColor(color: number): void {
    this.indicatorColor = color;
    if (this.mesh) {
      (this.mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
    }
  }

  /**
   * Hide the indicator
   */
  hide(): void {
    if (this.mesh) {
      this.mesh.visible = false;
    }
    this.currentStep = -1;
  }

  /**
   * Check if indicator is visible
   */
  get isVisible(): boolean {
    return this.mesh?.visible ?? false;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      (this.mesh.material as THREE.Material).dispose();
      this.scene.remove(this.mesh);
      this.mesh = null;
    }
  }
}
