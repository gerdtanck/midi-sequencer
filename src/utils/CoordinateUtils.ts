import * as THREE from 'three';
import { BASE_MIDI } from '@/config/GridConfig';

/**
 * Coordinate conversion utilities
 *
 * Centralizes all screen/world/grid coordinate conversions
 * to avoid duplication across components.
 */

/**
 * Grid cell coordinates
 */
export interface GridCell {
  step: number;
  pitch: number; // MIDI note number
}

/**
 * World coordinates (Three.js scene space)
 */
export interface WorldCoords {
  x: number;
  y: number;
}

/**
 * Convert screen coordinates to world coordinates
 *
 * @param camera - Orthographic camera
 * @param domElement - DOM element for bounds calculation
 * @param screenX - Screen X position (clientX)
 * @param screenY - Screen Y position (clientY)
 * @returns World coordinates
 */
export function screenToWorld(
  camera: THREE.OrthographicCamera,
  domElement: HTMLElement,
  screenX: number,
  screenY: number
): WorldCoords {
  const rect = domElement.getBoundingClientRect();

  // Convert to normalized device coordinates (-1 to +1)
  const ndcX = ((screenX - rect.left) / rect.width) * 2 - 1;
  const ndcY = -((screenY - rect.top) / rect.height) * 2 + 1;

  // Convert NDC to world coordinates using camera bounds
  const worldX =
    (ndcX * (camera.right - camera.left)) / 2 +
    (camera.right + camera.left) / 2;
  const worldY =
    (ndcY * (camera.top - camera.bottom)) / 2 +
    (camera.top + camera.bottom) / 2;

  return { x: worldX, y: worldY };
}

/**
 * Convert world coordinates to grid cell
 *
 * @param worldX - World X coordinate
 * @param worldY - World Y coordinate
 * @param gridWidth - Total grid width in steps
 * @param gridHeight - Total grid height in semitones
 * @returns Grid cell or null if outside grid bounds
 */
export function worldToGridCell(
  worldX: number,
  worldY: number,
  gridWidth: number,
  gridHeight: number
): GridCell | null {
  const step = Math.floor(worldX);
  const semitone = Math.floor(worldY);

  // Check bounds
  if (step < 0 || step >= gridWidth || semitone < 0 || semitone >= gridHeight) {
    return null;
  }

  const pitch = BASE_MIDI + semitone;
  return { step, pitch };
}

/**
 * Convert screen coordinates directly to grid cell
 *
 * Convenience function combining screenToWorld and worldToGridCell.
 *
 * @param camera - Orthographic camera
 * @param domElement - DOM element for bounds calculation
 * @param screenX - Screen X position (clientX)
 * @param screenY - Screen Y position (clientY)
 * @param gridWidth - Total grid width in steps
 * @param gridHeight - Total grid height in semitones
 * @returns Grid cell or null if outside grid bounds
 */
export function screenToGridCell(
  camera: THREE.OrthographicCamera,
  domElement: HTMLElement,
  screenX: number,
  screenY: number,
  gridWidth: number,
  gridHeight: number
): GridCell | null {
  const world = screenToWorld(camera, domElement, screenX, screenY);
  return worldToGridCell(world.x, world.y, gridWidth, gridHeight);
}

/**
 * Convert grid cell to world coordinates (center of cell)
 *
 * @param step - Grid step
 * @param pitch - MIDI note number
 * @returns World coordinates at center of cell
 */
export function gridCellToWorld(step: number, pitch: number): WorldCoords {
  const semitone = pitch - BASE_MIDI;
  return {
    x: step + 0.5,
    y: semitone + 0.5,
  };
}

/**
 * Convert MIDI pitch to semitone offset from BASE_MIDI
 */
export function pitchToSemitone(pitch: number): number {
  return pitch - BASE_MIDI;
}

/**
 * Convert semitone offset to MIDI pitch
 */
export function semitoneToPitch(semitone: number): number {
  return BASE_MIDI + semitone;
}

/**
 * Get pointer position from mouse or touch event
 */
export function getPointerPosition(e: MouseEvent | TouchEvent): { x: number; y: number } {
  if ('touches' in e) {
    if (e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    if (e.changedTouches && e.changedTouches.length > 0) {
      return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    }
    return { x: 0, y: 0 };
  }
  return { x: e.clientX, y: e.clientY };
}
