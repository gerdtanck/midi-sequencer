import type { PlaybackEngine } from '../sequencer/PlaybackEngine';
import { ROWS, CELL_HEIGHT, GRID_GAP } from '../config/GridConfig';

/**
 * Visual playback position indicator
 *
 * Shows vertical playhead line using CSS positioning.
 * Compatible with Canvas grid (step highlighting handled by Canvas renderer).
 *
 * Uses requestAnimationFrame for smooth animation that respects browser frame rate.
 */
export class PlaybackIndicator {
  private container: HTMLElement;
  private playbackEngine: PlaybackEngine;
  private gridStepWidth: number;
  private gridGap: number;
  private currentSequenceIndex: number = 0;
  private animationFrameId: number | null = null;
  private zoomLevel: number = 1.0;

  /** DOM elements */
  private playheadElement: HTMLDivElement | null = null;

  /**
   * Create playback indicator
   * @param container Parent element to render indicator into (must have position: relative)
   * @param playbackEngine PlaybackEngine to track
   * @param gridStepWidth Width of one step in pixels (for positioning)
   * @param gridGap Gap between grid cells in pixels
   */
  constructor(container: HTMLElement, playbackEngine: PlaybackEngine, gridStepWidth: number, gridGap: number) {
    this.container = container;
    this.playbackEngine = playbackEngine;
    this.gridStepWidth = gridStepWidth;
    this.gridGap = gridGap;
  }

  /**
   * Start playback indicator animation
   * @param sequenceIndex Index of sequence to track (0-3)
   */
  start(sequenceIndex: number): void {
    this.currentSequenceIndex = sequenceIndex;

    // Create playhead element if it doesn't exist
    if (!this.playheadElement) {
      this.playheadElement = document.createElement('div');
      this.playheadElement.className = 'playhead';

      // Set initial dimensions based on current zoom
      const scaledWidth = this.gridStepWidth * this.zoomLevel;
      const scaledHeight = ROWS * (CELL_HEIGHT + GRID_GAP) * this.zoomLevel;

      this.playheadElement.style.width = `${scaledWidth}px`;
      this.playheadElement.style.height = `${scaledHeight}px`;

      this.container.appendChild(this.playheadElement);
    }

    // Start animation loop
    this.updatePosition();
  }

  /**
   * Stop playback indicator animation
   * Removes visual indicator from display
   */
  stop(): void {
    // Cancel animation frame
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Remove playhead element
    if (this.playheadElement) {
      this.playheadElement.remove();
      this.playheadElement = null;
    }

    // Clear step highlights
    this.clearStepHighlights();
  }

  /**
   * Update which sequence is being tracked
   * @param index Sequence index (0-3)
   */
  setSequence(index: number): void {
    this.currentSequenceIndex = index;
  }

  /**
   * Update zoom level and playhead dimensions
   * Call this when canvas zoom changes to keep playhead aligned with grid
   * @param zoom New zoom level (e.g., 1.0 = 100%, 2.0 = 200%)
   */
  updateScale(zoom: number): void {
    this.zoomLevel = zoom;

    // Update playhead dimensions to match zoomed grid
    if (this.playheadElement) {
      const scaledWidth = this.gridStepWidth * zoom;
      const scaledHeight = ROWS * (CELL_HEIGHT + GRID_GAP) * zoom;

      this.playheadElement.style.width = `${scaledWidth}px`;
      this.playheadElement.style.height = `${scaledHeight}px`;
    }
  }

  /**
   * Update playhead position
   * Called via requestAnimationFrame for smooth animation
   */
  private updatePosition(): void {
    // Only update if engine is playing
    if (!this.playbackEngine.playing) {
      return;
    }

    // Get current step for tracked sequence
    const currentSteps = this.playbackEngine.getCurrentSteps();
    const step = currentSteps[this.currentSequenceIndex];

    // Update playhead position (accounting for grid gap and zoom)
    if (this.playheadElement) {
      const leftPos = step * (this.gridStepWidth + this.gridGap) * this.zoomLevel;
      this.playheadElement.style.left = `${leftPos}px`;
    }

    // Highlight current step cells
    this.highlightStep(step);

    // Schedule next frame
    this.animationFrameId = requestAnimationFrame(() => this.updatePosition());
  }

  /**
   * Highlight the current step in the grid
   * @param step Step index to highlight
   */
  private highlightStep(step: number): void {
    // Step highlighting disabled for Canvas grid
    // Canvas renderer will handle step highlighting by drawing on Canvas layer
    // DOM-based highlighting (querySelectorAll + classList) only works with DOM grid cells
  }

  /**
   * Clear all step highlights
   */
  private clearStepHighlights(): void {
    // Step highlighting disabled for Canvas grid
    // Canvas renderer will handle step highlighting by drawing on Canvas layer
  }

  /**
   * Clean up event listeners and DOM elements
   */
  destroy(): void {
    this.stop();
  }
}
