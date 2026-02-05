import { Sequence } from './Sequence';

/**
 * Callback for active sequence changes
 */
export type ActiveSequenceChangeListener = (index: number) => void;

/**
 * SequenceManager - Central manager for 4 independent sequences
 *
 * - Creates and holds 4 Sequence instances
 * - Sets default MIDI channels: Seq 1 → Ch 0, Seq 2 → Ch 1, etc.
 * - Tracks which sequence is "active" (displayed in UI)
 * - Emits change events when active sequence changes
 */
export class SequenceManager {
  private sequences: Sequence[];
  private activeIndex: number = 0;
  private changeListeners: Set<ActiveSequenceChangeListener> = new Set();

  constructor() {
    // Create 4 sequences with default MIDI channels
    this.sequences = [];
    for (let i = 0; i < 4; i++) {
      const seq = new Sequence();
      seq.setMidiChannel(i); // Ch 0-3
      this.sequences.push(seq);
    }
  }

  /**
   * Get the currently active sequence (displayed in UI)
   */
  getActiveSequence(): Sequence {
    return this.sequences[this.activeIndex];
  }

  /**
   * Get the active sequence index (0-3)
   */
  getActiveIndex(): number {
    return this.activeIndex;
  }

  /**
   * Set the active sequence by index
   * @param index 0-3
   */
  setActiveSequence(index: number): void {
    if (index < 0 || index >= 4) {
      console.warn(`Invalid sequence index: ${index}. Must be 0-3`);
      return;
    }

    if (index !== this.activeIndex) {
      this.activeIndex = index;
      this.notifyChange();
    }
  }

  /**
   * Get all 4 sequences
   */
  getAllSequences(): Sequence[] {
    return this.sequences;
  }

  /**
   * Get a specific sequence by index
   * @param index 0-3
   */
  getSequence(index: number): Sequence | undefined {
    return this.sequences[index];
  }

  /**
   * Register a listener for active sequence changes
   */
  onActiveChange(listener: ActiveSequenceChangeListener): void {
    this.changeListeners.add(listener);
  }

  /**
   * Unregister an active sequence change listener
   */
  offActiveChange(listener: ActiveSequenceChangeListener): void {
    this.changeListeners.delete(listener);
  }

  /**
   * Notify listeners of active sequence change
   */
  private notifyChange(): void {
    this.changeListeners.forEach((listener) => listener(this.activeIndex));
  }
}
