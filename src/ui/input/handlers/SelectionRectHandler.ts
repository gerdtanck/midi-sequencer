import * as THREE from 'three';
import type { NormalizedPointerEvent, InputHandler } from '../InputEvent';
import type { NoteRenderer } from '@/ui/grid/NoteRenderer';
import type { SelectionManager } from '@/core/SelectionManager';
import {
  CLICK_THRESHOLD_PX,
  SELECTION_RECT_COLOR,
  SELECTION_RECT_OPACITY,
  SELECTION_RECT_Z_POSITION,
} from '@/config/GridConfig';

/**
 * SelectionRectHandler - Handles rectangle selection
 *
 * PC: Right-click drag on empty space to draw selection rectangle
 * Mobile: Long-press on empty space (no selection) starts selection rectangle
 *
 * Priority: 30 (after drag handler)
 */
export class SelectionRectHandler implements InputHandler {
  readonly priority = 30;
  readonly name = 'SelectionRectHandler';

  private scene: THREE.Scene | null = null;
  private noteRenderer: NoteRenderer | null = null;
  private selectionManager: SelectionManager | null = null;
  private onRenderRequest: (() => void) | null = null;
  private onCancelPan: (() => void) | null = null;

  // Selection rectangle state
  private isSelecting = false;
  private hasMoved = false;
  private startWorld: { x: number; y: number } | null = null;
  private startScreenX = 0;
  private startScreenY = 0;

  // Selection rectangle mesh
  private selectRectMesh: THREE.Mesh | null = null;

  // Mobile mode (triggered by long-press)
  private mobileSelectionMode = false;

  // Track if selection was actually used (for preventing paste on right-click)
  private wasUsed = false;

  /**
   * Set the scene for adding selection rectangle mesh
   */
  setScene(scene: THREE.Scene): void {
    this.scene = scene;
  }

  /**
   * Set the note renderer for finding notes in region
   */
  setNoteRenderer(renderer: NoteRenderer): void {
    this.noteRenderer = renderer;
  }

  /**
   * Set the selection manager
   */
  setSelectionManager(manager: SelectionManager): void {
    this.selectionManager = manager;
  }

  /**
   * Set callback to request a render
   */
  setRenderCallback(callback: () => void): void {
    this.onRenderRequest = callback;
  }

  /**
   * Set callback to cancel pan
   */
  setCancelPanCallback(callback: () => void): void {
    this.onCancelPan = callback;
  }

  /**
   * Enter mobile selection mode (called by long-press handler)
   */
  enterMobileSelectionMode(worldPos: { x: number; y: number }): void {
    this.mobileSelectionMode = true;
    this.isSelecting = true;
    this.hasMoved = false;
    this.startWorld = worldPos;
    this.createRectMesh();
  }

  /**
   * Check if selection rectangle was used (for paste prevention)
   */
  getWasUsed(): boolean {
    return this.wasUsed;
  }

  /**
   * Reset the wasUsed flag
   */
  resetWasUsed(): void {
    this.wasUsed = false;
  }

  /**
   * Handle pointer down
   * Claims if right-click on empty space (PC)
   */
  onPointerDown(e: NormalizedPointerEvent): boolean {
    // Mobile selection is triggered by long-press, not pointer down
    if (e.isTouchEvent) return false;

    // Only claim right-click
    if (e.button !== 2) return false;

    // Check if clicking on a note
    const noteAtPos = this.noteRenderer?.getNoteAtWorld(e.worldX, e.worldY, 0);
    if (noteAtPos) return false;

    // Claim for selection rectangle
    this.isSelecting = true;
    this.hasMoved = false;
    this.wasUsed = false;
    this.startWorld = { x: e.worldX, y: e.worldY };
    this.startScreenX = e.screenX;
    this.startScreenY = e.screenY;

    return true;
  }

  /**
   * Handle pointer move - update selection rectangle
   */
  onPointerMove(e: NormalizedPointerEvent): void {
    if (!this.isSelecting || !this.startWorld) return;

    // Check if moved past threshold
    const dx = e.screenX - this.startScreenX;
    const dy = e.screenY - this.startScreenY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > CLICK_THRESHOLD_PX || this.mobileSelectionMode) {
      this.hasMoved = true;
      this.onCancelPan?.();

      this.updateRectMesh(this.startWorld.x, this.startWorld.y, e.worldX, e.worldY);
      this.onRenderRequest?.();
    }
  }

  /**
   * Handle pointer up - complete selection
   */
  onPointerUp(e: NormalizedPointerEvent): void {
    if (!this.isSelecting) {
      this.reset();
      return;
    }

    if (this.hasMoved && this.startWorld && this.noteRenderer && this.selectionManager) {
      // Select notes in rectangle
      const minX = Math.min(this.startWorld.x, e.worldX);
      const maxX = Math.max(this.startWorld.x, e.worldX);
      const minY = Math.min(this.startWorld.y, e.worldY);
      const maxY = Math.max(this.startWorld.y, e.worldY);

      const notesInRect = this.noteRenderer.getNotesInRegion(minX, maxX, minY, maxY);

      if (notesInRect.length > 0) {
        this.selectionManager.setSelection(notesInRect);
      }

      this.wasUsed = true;
      this.onRenderRequest?.();
    }

    this.removeRectMesh();
    this.reset();
  }

  /**
   * Create the selection rectangle mesh
   */
  private createRectMesh(): void {
    if (this.selectRectMesh || !this.scene) return;

    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({
      color: SELECTION_RECT_COLOR,
      transparent: true,
      opacity: SELECTION_RECT_OPACITY,
      side: THREE.DoubleSide,
    });

    this.selectRectMesh = new THREE.Mesh(geometry, material);
    this.selectRectMesh.position.z = SELECTION_RECT_Z_POSITION;
    this.selectRectMesh.visible = false;
    this.scene.add(this.selectRectMesh);
  }

  /**
   * Update the selection rectangle mesh
   */
  private updateRectMesh(startX: number, startY: number, endX: number, endY: number): void {
    if (!this.selectRectMesh) {
      this.createRectMesh();
    }

    if (this.selectRectMesh) {
      const minX = Math.min(startX, endX);
      const maxX = Math.max(startX, endX);
      const minY = Math.min(startY, endY);
      const maxY = Math.max(startY, endY);

      const width = maxX - minX;
      const height = maxY - minY;

      this.selectRectMesh.position.x = minX + width / 2;
      this.selectRectMesh.position.y = minY + height / 2;
      this.selectRectMesh.scale.set(width, height, 1);
      this.selectRectMesh.visible = true;
    }
  }

  /**
   * Remove the selection rectangle mesh
   */
  private removeRectMesh(): void {
    if (this.selectRectMesh && this.scene) {
      this.scene.remove(this.selectRectMesh);
      this.selectRectMesh.geometry.dispose();
      (this.selectRectMesh.material as THREE.Material).dispose();
      this.selectRectMesh = null;
    }
  }

  /**
   * Reset handler state
   */
  private reset(): void {
    this.isSelecting = false;
    this.hasMoved = false;
    this.startWorld = null;
    this.mobileSelectionMode = false;
  }

  /**
   * Cancel selection and clean up
   */
  cancel(): void {
    this.removeRectMesh();
    this.reset();
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.removeRectMesh();
  }
}
