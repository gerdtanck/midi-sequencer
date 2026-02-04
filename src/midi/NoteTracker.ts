import type { ActiveNote } from './types';

/**
 * Tracks currently active MIDI notes to enable panic functionality
 *
 * Prevents stuck notes by maintaining a record of all notes that have
 * been turned on but not yet turned off.
 */
export class NoteTracker {
  private activeNotes: Map<string, ActiveNote> = new Map();

  /**
   * Record a note on event
   */
  noteOn(channel: number, note: number): void {
    const key = this.makeKey(channel, note);
    this.activeNotes.set(key, {
      channel,
      note,
      timestamp: performance.now(),
    });
  }

  /**
   * Record a note off event
   */
  noteOff(channel: number, note: number): void {
    const key = this.makeKey(channel, note);
    this.activeNotes.delete(key);
  }

  /**
   * Get all currently active notes
   */
  getActiveNotes(): ActiveNote[] {
    return Array.from(this.activeNotes.values());
  }

  /**
   * Clear all active notes
   */
  clear(): void {
    this.activeNotes.clear();
  }

  /**
   * Get number of active notes
   */
  get count(): number {
    return this.activeNotes.size;
  }

  /**
   * Generate unique key for channel-note pair
   */
  private makeKey(channel: number, note: number): string {
    return `${channel}-${note}`;
  }
}
