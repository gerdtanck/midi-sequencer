/**
 * Active note information
 */
interface ActiveNote {
  channel: number;
  note: number;
  timestamp: number;
}

/**
 * Tracks currently active MIDI notes to enable panic functionality
 */
export class NoteTracker {
  private _activeNotes: Map<string, ActiveNote> = new Map();

  /**
   * Record a note on event
   * @param channel MIDI channel (0-15)
   * @param note MIDI note number (0-127)
   */
  noteOn(channel: number, note: number): void {
    const key = this.makeKey(channel, note);
    this._activeNotes.set(key, {
      channel,
      note,
      timestamp: performance.now()
    });
  }

  /**
   * Record a note off event
   * @param channel MIDI channel (0-15)
   * @param note MIDI note number (0-127)
   */
  noteOff(channel: number, note: number): void {
    const key = this.makeKey(channel, note);
    this._activeNotes.delete(key);
  }

  /**
   * Get all currently active notes
   * @returns Array of active notes
   */
  getActiveNotes(): ActiveNote[] {
    return Array.from(this._activeNotes.values());
  }

  /**
   * Clear all active notes
   */
  clear(): void {
    this._activeNotes.clear();
  }

  /**
   * Get number of active notes
   */
  get count(): number {
    return this._activeNotes.size;
  }

  /**
   * Generate unique key for channel-note pair
   */
  private makeKey(channel: number, note: number): string {
    return `${channel}-${note}`;
  }
}
