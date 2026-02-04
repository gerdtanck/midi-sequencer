/**
 * SelectionManager - Manages note selection state
 *
 * Tracks which notes are currently selected and provides methods
 * to manipulate the selection.
 */
export class SelectionManager {
  private selectedNotes: Set<string> = new Set();
  private changeListeners: Set<() => void> = new Set();

  /**
   * Generate a unique key for a note
   */
  private getKey(step: number, pitch: number): string {
    return `${step}:${pitch}`;
  }

  /**
   * Parse a key back to step/pitch
   */
  private parseKey(key: string): { step: number; pitch: number } {
    const [step, pitch] = key.split(':').map(Number);
    return { step, pitch };
  }

  /**
   * Check if a note is selected
   */
  isSelected(step: number, pitch: number): boolean {
    return this.selectedNotes.has(this.getKey(step, pitch));
  }

  /**
   * Select a note
   */
  select(step: number, pitch: number): void {
    const key = this.getKey(step, pitch);
    if (!this.selectedNotes.has(key)) {
      this.selectedNotes.add(key);
      this.notifyChange();
    }
  }

  /**
   * Deselect a note
   */
  deselect(step: number, pitch: number): void {
    const key = this.getKey(step, pitch);
    if (this.selectedNotes.has(key)) {
      this.selectedNotes.delete(key);
      this.notifyChange();
    }
  }

  /**
   * Toggle selection of a note
   */
  toggle(step: number, pitch: number): void {
    if (this.isSelected(step, pitch)) {
      this.deselect(step, pitch);
    } else {
      this.select(step, pitch);
    }
  }

  /**
   * Clear all selections
   */
  clear(): void {
    if (this.selectedNotes.size > 0) {
      this.selectedNotes.clear();
      this.notifyChange();
    }
  }

  /**
   * Select multiple notes
   */
  selectMultiple(notes: Array<{ step: number; pitch: number }>): void {
    let changed = false;
    for (const note of notes) {
      const key = this.getKey(note.step, note.pitch);
      if (!this.selectedNotes.has(key)) {
        this.selectedNotes.add(key);
        changed = true;
      }
    }
    if (changed) {
      this.notifyChange();
    }
  }

  /**
   * Replace selection with new set
   */
  setSelection(notes: Array<{ step: number; pitch: number }>): void {
    this.selectedNotes.clear();
    for (const note of notes) {
      this.selectedNotes.add(this.getKey(note.step, note.pitch));
    }
    this.notifyChange();
  }

  /**
   * Get all selected notes
   */
  getSelectedNotes(): Array<{ step: number; pitch: number }> {
    return Array.from(this.selectedNotes).map((key) => this.parseKey(key));
  }

  /**
   * Get number of selected notes
   */
  get count(): number {
    return this.selectedNotes.size;
  }

  /**
   * Check if any notes are selected
   */
  get hasSelection(): boolean {
    return this.selectedNotes.size > 0;
  }

  /**
   * Update selection when a note moves
   */
  moveNote(
    oldStep: number,
    oldPitch: number,
    newStep: number,
    newPitch: number
  ): void {
    const oldKey = this.getKey(oldStep, oldPitch);
    if (this.selectedNotes.has(oldKey)) {
      this.selectedNotes.delete(oldKey);
      this.selectedNotes.add(this.getKey(newStep, newPitch));
      this.notifyChange();
    }
  }

  /**
   * Register a change listener
   */
  onChange(listener: () => void): void {
    this.changeListeners.add(listener);
  }

  /**
   * Unregister a change listener
   */
  offChange(listener: () => void): void {
    this.changeListeners.delete(listener);
  }

  /**
   * Notify all listeners of a change
   */
  private notifyChange(): void {
    this.changeListeners.forEach((listener) => listener());
  }
}
