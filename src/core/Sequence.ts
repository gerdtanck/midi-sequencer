import type { Note, LoopMarkers, SequenceChangeListener } from './types';
import {
  STEPS_PER_BAR,
  DEFAULT_BARS,
  DEFAULT_NOTE_VELOCITY,
  DEFAULT_NOTE_DURATION,
} from '@/config/GridConfig';

/**
 * Manages a step sequence with sparse note storage
 *
 * Uses Map<step, Note[]> for memory efficiency - most steps in a sequence
 * are empty, so sparse storage avoids wasting memory on unused array slots.
 *
 * Emits change events when notes or loop markers are modified.
 */
export class Sequence {
  /** Sparse storage: only populated steps exist in the map */
  private notes: Map<number, Note[]> = new Map();

  /** Loop boundaries (default: 0-64 for 4 bars) */
  private loopMarkers: LoopMarkers = { start: 0, end: DEFAULT_BARS * STEPS_PER_BAR };

  /** MIDI output channel (0-15) */
  private midiChannel: number = 0;

  /** Change listeners - notified when sequence data changes */
  private changeListeners: Set<SequenceChangeListener> = new Set();

  /**
   * Register a listener for sequence changes
   */
  onChange(listener: SequenceChangeListener): void {
    this.changeListeners.add(listener);
  }

  /**
   * Unregister a change listener
   */
  offChange(listener: SequenceChangeListener): void {
    this.changeListeners.delete(listener);
  }

  /**
   * Notify all change listeners
   */
  private notifyChange(): void {
    this.changeListeners.forEach((listener) => listener());
  }

  /**
   * Manually trigger change notification
   * Used by controller when modifying note properties directly (e.g., duration during drag)
   */
  triggerChange(): void {
    this.notifyChange();
  }

  /**
   * Toggle a note at a specific step and pitch
   * - If note exists: remove it
   * - If note absent: add it with given velocity and duration
   *
   * @param step Step index
   * @param pitch MIDI note number (0-127)
   * @param velocity Optional velocity (default: 100)
   * @param duration Optional duration multiplier (default: 0.8 = 80% of step for slight staccato)
   * @returns true if note was added, false if removed
   */
  toggleNote(
    step: number,
    pitch: number,
    velocity: number = DEFAULT_NOTE_VELOCITY,
    duration: number = DEFAULT_NOTE_DURATION
  ): boolean {
    const notesAtStep = this.notes.get(step) || [];

    // Check if note already exists at this pitch
    const existingIndex = notesAtStep.findIndex((n) => n.pitch === pitch);

    if (existingIndex !== -1) {
      // Note exists - remove it
      notesAtStep.splice(existingIndex, 1);

      // Clean up empty step
      if (notesAtStep.length === 0) {
        this.notes.delete(step);
      } else {
        this.notes.set(step, notesAtStep);
      }

      this.notifyChange();
      return false; // Note was removed
    } else {
      // Note doesn't exist - add it
      const newNote: Note = {
        pitch,
        velocity,
        duration,
        originalPitch: pitch,
      };
      notesAtStep.push(newNote);
      this.notes.set(step, notesAtStep);

      this.notifyChange();
      return true; // Note was added
    }
  }

  /**
   * Add a note at a specific step and pitch (without toggle)
   */
  addNote(step: number, pitch: number, velocity: number = DEFAULT_NOTE_VELOCITY, duration: number = DEFAULT_NOTE_DURATION): void {
    const notesAtStep = this.notes.get(step) || [];

    // Check if note already exists
    const existingIndex = notesAtStep.findIndex((n) => n.pitch === pitch);
    if (existingIndex !== -1) {
      return; // Note already exists
    }

    const newNote: Note = {
      pitch,
      velocity,
      duration,
      originalPitch: pitch,
    };
    notesAtStep.push(newNote);
    this.notes.set(step, notesAtStep);
    this.notifyChange();
  }

  /**
   * Remove a note at a specific step and pitch
   */
  removeNote(step: number, pitch: number): boolean {
    const notesAtStep = this.notes.get(step);
    if (!notesAtStep) return false;

    const existingIndex = notesAtStep.findIndex((n) => n.pitch === pitch);
    if (existingIndex === -1) return false;

    notesAtStep.splice(existingIndex, 1);

    if (notesAtStep.length === 0) {
      this.notes.delete(step);
    } else {
      this.notes.set(step, notesAtStep);
    }

    this.notifyChange();
    return true;
  }

  /**
   * Get all notes at a specific step
   */
  getNotesAt(step: number): Note[] {
    return this.notes.get(step) || [];
  }

  /**
   * Get a specific note at step and pitch
   */
  getNoteAt(step: number, pitch: number): Note | undefined {
    const notesAtStep = this.notes.get(step);
    if (!notesAtStep) return undefined;
    return notesAtStep.find((n) => n.pitch === pitch);
  }

  /**
   * Update a note's properties
   */
  updateNote(step: number, pitch: number, updates: Partial<Omit<Note, 'pitch'>>): boolean {
    const notesAtStep = this.notes.get(step);
    if (!notesAtStep) return false;

    const note = notesAtStep.find((n) => n.pitch === pitch);
    if (!note) return false;

    if (updates.velocity !== undefined) note.velocity = updates.velocity;
    if (updates.duration !== undefined) note.duration = updates.duration;

    this.notifyChange();
    return true;
  }

  /**
   * Move a note to a new position
   * @param oldStep Current step
   * @param oldPitch Current pitch
   * @param newStep Target step (can be fractional for free movement)
   * @param newPitch Target pitch
   * @returns true if note was moved
   */
  moveNote(
    oldStep: number,
    oldPitch: number,
    newStep: number,
    newPitch: number
  ): boolean {
    // Get note at old position
    const notesAtOldStep = this.notes.get(oldStep);
    if (!notesAtOldStep) return false;

    const noteIndex = notesAtOldStep.findIndex((n) => n.pitch === oldPitch);
    if (noteIndex === -1) return false;

    // Remove from old position
    const [note] = notesAtOldStep.splice(noteIndex, 1);
    if (notesAtOldStep.length === 0) {
      this.notes.delete(oldStep);
    }

    // Update pitch
    note.pitch = newPitch;

    // Add to new position
    const notesAtNewStep = this.notes.get(newStep) || [];
    // Remove any existing note at the target position
    const existingIndex = notesAtNewStep.findIndex((n) => n.pitch === newPitch);
    if (existingIndex !== -1) {
      notesAtNewStep.splice(existingIndex, 1);
    }
    notesAtNewStep.push(note);
    this.notes.set(newStep, notesAtNewStep);

    this.notifyChange();
    return true;
  }

  /**
   * Move multiple notes by a delta
   * Notes are moved relative to their current positions
   * @param notes Array of notes to move
   * @param deltaStep Step offset (can be fractional)
   * @param deltaPitch Pitch offset
   * @param silent If true, don't notify change (for batch operations)
   */
  moveNotes(
    notes: Array<{ step: number; pitch: number }>,
    deltaStep: number,
    deltaPitch: number,
    silent: boolean = false
  ): Array<{ oldStep: number; oldPitch: number; newStep: number; newPitch: number }> {
    const moved: Array<{
      oldStep: number;
      oldPitch: number;
      newStep: number;
      newPitch: number;
    }> = [];

    // First, collect all notes to move
    const notesToMove: Array<{ step: number; pitch: number; note: Note }> = [];
    for (const { step, pitch } of notes) {
      const notesAtStep = this.notes.get(step);
      if (!notesAtStep) continue;

      const noteIndex = notesAtStep.findIndex((n) => n.pitch === pitch);
      if (noteIndex === -1) continue;

      const [note] = notesAtStep.splice(noteIndex, 1);
      if (notesAtStep.length === 0) {
        this.notes.delete(step);
      }

      notesToMove.push({ step, pitch, note });
    }

    // Then, place them at new positions
    for (const { step: oldStep, pitch: oldPitch, note } of notesToMove) {
      const newStep = oldStep + deltaStep;
      const newPitch = oldPitch + deltaPitch;

      note.pitch = newPitch;

      const notesAtNewStep = this.notes.get(newStep) || [];
      // Remove any existing note at target
      const existingIndex = notesAtNewStep.findIndex((n) => n.pitch === newPitch);
      if (existingIndex !== -1) {
        notesAtNewStep.splice(existingIndex, 1);
      }
      notesAtNewStep.push(note);
      this.notes.set(newStep, notesAtNewStep);

      moved.push({ oldStep, oldPitch, newStep, newPitch });
    }

    if (!silent && moved.length > 0) {
      this.notifyChange();
    }

    return moved;
  }

  /**
   * Copy notes to a new position
   * @param notes Notes to copy
   * @param targetStep Target step for the leftmost-bottommost note
   * @param targetPitch Target pitch for the leftmost-bottommost note
   * @returns The newly created notes
   */
  copyNotes(
    notes: Array<{ step: number; pitch: number }>,
    targetStep: number,
    targetPitch: number
  ): Array<{ step: number; pitch: number }> {
    if (notes.length === 0) return [];

    // Find leftmost-bottommost note (anchor point)
    let minStep = Infinity;
    let minPitch = Infinity;
    for (const { step, pitch } of notes) {
      if (step < minStep || (step === minStep && pitch < minPitch)) {
        minStep = step;
        minPitch = pitch;
      }
    }

    // Calculate offset
    const deltaStep = targetStep - minStep;
    const deltaPitch = targetPitch - minPitch;

    const created: Array<{ step: number; pitch: number }> = [];

    // Copy each note
    for (const { step, pitch } of notes) {
      const sourceNote = this.getNoteAt(step, pitch);
      if (!sourceNote) continue;

      const newStep = step + deltaStep;
      const newPitch = pitch + deltaPitch;

      // Add the copy
      const notesAtNewStep = this.notes.get(newStep) || [];
      // Remove any existing note at target
      const existingIndex = notesAtNewStep.findIndex((n) => n.pitch === newPitch);
      if (existingIndex !== -1) {
        notesAtNewStep.splice(existingIndex, 1);
      }
      notesAtNewStep.push({
        pitch: newPitch,
        velocity: sourceNote.velocity,
        duration: sourceNote.duration,
        originalPitch: newPitch,
      });
      this.notes.set(newStep, notesAtNewStep);

      created.push({ step: newStep, pitch: newPitch });
    }

    if (created.length > 0) {
      this.notifyChange();
    }

    return created;
  }

  /**
   * Get all notes in the sequence
   */
  getAllNotes(): { step: number; notes: Note[] }[] {
    const result: { step: number; notes: Note[] }[] = [];
    this.notes.forEach((notes, step) => {
      result.push({ step, notes: [...notes] });
    });
    return result.sort((a, b) => a.step - b.step);
  }

  /**
   * Calculate next step with loop wrapping
   */
  getNextStep(currentStep: number): number {
    const nextStep = currentStep + 1;
    if (nextStep >= this.loopMarkers.end) {
      return this.loopMarkers.start;
    }
    return nextStep;
  }

  /**
   * Get current loop markers
   */
  getLoopMarkers(): LoopMarkers {
    return { ...this.loopMarkers };
  }

  /**
   * Set loop boundaries
   */
  setLoopMarkers(markers: LoopMarkers): void {
    if (markers.start < 0 || markers.end <= markers.start) {
      throw new Error(`Invalid loop markers: start=${markers.start}, end=${markers.end}`);
    }
    this.loopMarkers = { ...markers };
    this.notifyChange();
  }

  /**
   * Get MIDI output channel
   */
  getMidiChannel(): number {
    return this.midiChannel;
  }

  /**
   * Set MIDI output channel
   */
  setMidiChannel(channel: number): void {
    if (channel < 0 || channel > 15) {
      throw new Error(`MIDI channel must be 0-15, got ${channel}`);
    }
    this.midiChannel = channel;
  }

  /**
   * Clear all notes from the sequence
   */
  clear(): void {
    this.notes.clear();
    this.notifyChange();
  }

  /**
   * Get total number of notes in the sequence
   */
  getNoteCount(): number {
    let count = 0;
    for (const notesAtStep of this.notes.values()) {
      count += notesAtStep.length;
    }
    return count;
  }

  /**
   * Get all populated steps (steps that have notes)
   */
  getPopulatedSteps(): number[] {
    return Array.from(this.notes.keys()).sort((a, b) => a - b);
  }

  /**
   * Check if a note exists at a specific step and pitch
   */
  hasNote(step: number, pitch: number): boolean {
    const notesAtStep = this.notes.get(step);
    if (!notesAtStep) return false;
    return notesAtStep.some((n) => n.pitch === pitch);
  }
}
