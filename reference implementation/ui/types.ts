import { MAX_PITCH, MAX_STEP } from '../config/GridConfig';

/**
 * UI-specific types and view models
 */

/**
 * View model for rendering a note bar
 * Separates visual representation from data model
 */
export interface NoteBarViewModel {
  /** Grid step position (0 to MAX_STEP) */
  step: number;

  /** Grid pitch (0 to MAX_PITCH) */
  pitch: number;

  /** MIDI note number (BASE_MIDI to MAX_MIDI) */
  midiNote: number;

  /** Duration multiplier (e.g., 0.8, 1.5, 2.0) */
  duration: number;

  /** Visual position: left offset in pixels */
  left: number;

  /** Visual position: top offset in pixels */
  top: number;

  /** Visual size: width in pixels */
  width: number;

  /** Visual size: height in pixels */
  height: number;
}

/**
 * Grid coordinate utilities
 */
export class GridCoordinates {
  constructor(
    public readonly cellWidth: number,
    public readonly cellHeight: number,
    public readonly gridGap: number
  ) {}

  /**
   * Calculate left position for a step
   * @param step Step index (0-15)
   * @returns Left position in pixels
   */
  stepToLeft(step: number): number {
    return step * (this.cellWidth + this.gridGap);
  }

  /**
   * Calculate top position for a pitch
   * @param pitch Grid pitch (0 to MAX_PITCH, where MAX_PITCH is highest)
   * @returns Top position in pixels
   */
  pitchToTop(pitch: number): number {
    const visualRow = MAX_PITCH - pitch; // Invert: pitch MAX_PITCH = row 0 (top)
    return visualRow * (this.cellHeight + this.gridGap);
  }

  /**
   * Calculate width for a duration
   * @param duration Duration multiplier
   * @returns Width in pixels
   */
  durationToWidth(duration: number): number {
    return duration * (this.cellWidth + this.gridGap) - this.gridGap;
  }

  /**
   * Convert mouse position to grid coordinates
   * @param clientX Mouse X position
   * @param clientY Mouse Y position
   * @param containerRect Container bounding rectangle
   * @param padding Container padding
   * @returns Grid coordinates {step, pitch}
   */
  clientToGrid(
    clientX: number,
    clientY: number,
    containerRect: DOMRect,
    padding: number = 8
  ): { step: number; pitch: number } {
    const relativeX = clientX - containerRect.left - padding;
    const relativeY = clientY - containerRect.top - padding;

    const step = Math.floor(relativeX / (this.cellWidth + this.gridGap));
    const visualRow = Math.floor(relativeY / (this.cellHeight + this.gridGap));
    const pitch = MAX_PITCH - visualRow; // Invert for pitch

    // Clamp to valid range
    return {
      step: Math.max(0, Math.min(MAX_STEP, step)),
      pitch: Math.max(0, Math.min(MAX_PITCH, pitch))
    };
  }
}
