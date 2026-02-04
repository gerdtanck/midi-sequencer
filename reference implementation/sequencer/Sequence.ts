import type { Note, LoopMarkers } from './types';
import { quantizeToScale, isNoteInScale, type ScaleDefinition } from '../music/Scale';
import { STEPS, MAX_STEP, BASE_MIDI, MAX_MIDI } from '../config/GridConfig';

/**
 * Manages a step sequence with sparse note storage
 *
 * Uses Map<step, Note[]> for memory efficiency - most steps in a sequence
 * are empty, so sparse storage avoids wasting memory on unused array slots.
 *
 * Supports 128-step grid: sparse Map has no fixed size limit, keys can be 0-127.
 *
 * Emits change events when notes or loop markers are modified.
 */
export class Sequence {
  /** Sparse storage: only populated steps exist in the map */
  private notes: Map<number, Note[]> = new Map();

  /** Loop boundaries (default: 0-16 for one bar loop) */
  private loopMarkers: LoopMarkers = { start: 0, end: 16 };

  /** MIDI output channel (0-15) */
  private midiChannel: number = 0;

  /** Change listeners - notified when sequence data changes */
  private changeListeners: Set<() => void> = new Set();

  /**
   * Register a listener for sequence changes
   * @param listener Function to call when sequence changes
   */
  onChange(listener: () => void): void {
    this.changeListeners.add(listener);
  }

  /**
   * Unregister a change listener
   * @param listener Function to remove
   */
  offChange(listener: () => void): void {
    this.changeListeners.delete(listener);
  }

  /**
   * Notify all change listeners
   * Called internally when sequence data is modified
   */
  private notifyChange(): void {
    this.changeListeners.forEach(listener => listener());
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
  toggleNote(step: number, pitch: number, velocity: number = 100, duration: number = 0.8): boolean {
    const notesAtStep = this.notes.get(step) || [];

    // Check if note already exists at this pitch
    const existingIndex = notesAtStep.findIndex(n => n.pitch === pitch);

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
        originalPitch: pitch // Remember where it was originally placed
      };
      notesAtStep.push(newNote);
      this.notes.set(step, notesAtStep);

      this.notifyChange();
      return true; // Note was added
    }
  }

  /**
   * Get all notes at a specific step
   * @param step Step index
   * @returns Array of notes (empty if step has no notes)
   */
  getNotesAt(step: number): Note[] {
    return this.notes.get(step) || [];
  }

  /**
   * Calculate next step with loop wrapping
   * @param currentStep Current step index
   * @returns Next step (wraps to loop start if at/past loop end)
   */
  getNextStep(currentStep: number): number {
    if (currentStep >= this.loopMarkers.end) {
      return this.loopMarkers.start;
    }
    return currentStep + 1;
  }

  /**
   * Get current loop markers
   * @returns Loop boundaries
   */
  getLoopMarkers(): LoopMarkers {
    return { ...this.loopMarkers }; // Return copy to prevent external mutation
  }

  /**
   * Set loop boundaries
   * @param markers New loop markers
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
   * @returns Channel number (0-15)
   */
  getMidiChannel(): number {
    return this.midiChannel;
  }

  /**
   * Set MIDI output channel
   * @param channel Channel number (0-15)
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
   * @returns Count of all notes across all steps
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
   * @returns Array of step indices that contain notes
   */
  getPopulatedSteps(): number[] {
    return Array.from(this.notes.keys()).sort((a, b) => a - b);
  }

  /**
   * Quantize all notes to the nearest in-scale pitches
   * Always quantizes from originalPitch to preserve intent across scale changes
   * @param rootNote Root note (0-11)
   * @param scale Scale definition
   */
  quantizeNotesToScale(rootNote: number, scale: ScaleDefinition): void {
    let quantizedCount = 0;

    // Iterate through all steps that have notes
    this.notes.forEach((notesAtStep, step) => {
      // Create new array for quantized notes
      const quantizedNotes: Note[] = [];

      notesAtStep.forEach(note => {
        // Ensure originalPitch exists (for backward compatibility with existing notes)
        const originalPitch = note.originalPitch ?? note.pitch;

        // Always quantize from original pitch (not current pitch)
        const quantizedPitch = quantizeToScale(originalPitch, rootNote, scale);

        if (quantizedPitch !== note.pitch) {
          quantizedCount++;
          console.log(`Quantized note: original=${originalPitch}, current=${note.pitch} -> ${quantizedPitch} at step ${step}`);
        }

        // Check if quantized pitch already exists at this step
        const existingNote = quantizedNotes.find(n => n.pitch === quantizedPitch);

        if (existingNote) {
          // Note already exists at this pitch - keep the existing one
          // (Could alternatively merge properties, but keeping first is simpler)
          console.log(`Skipping duplicate at pitch ${quantizedPitch}, step ${step}`);
        } else {
          // Add note with new pitch but preserve originalPitch, velocity, and duration
          quantizedNotes.push({
            pitch: quantizedPitch,
            velocity: note.velocity,
            duration: note.duration,
            originalPitch: originalPitch // Always preserve original placement
          });
        }
      });

      // Update step with quantized notes
      if (quantizedNotes.length > 0) {
        this.notes.set(step, quantizedNotes);
      } else {
        this.notes.delete(step);
      }
    });

    if (quantizedCount > 0) {
      console.log(`Quantized ${quantizedCount} notes to scale`);
      this.notifyChange();
    }
  }

  // ==================== TRANSFORMATION OPERATIONS ====================

  /**
   * Nudge all notes forward (right) by one step
   * Notes wrap around the full grid (0-MAX_STEP)
   */
  nudgeRight(): void {
    const newNotes = new Map<number, Note[]>();

    this.notes.forEach((notesAtStep, step) => {
      const newStep = (step + 1) % STEPS;
      newNotes.set(newStep, [...notesAtStep]);
    });

    this.notes = newNotes;
    this.notifyChange();
    console.log('Nudged sequence right');
  }

  /**
   * Nudge all notes backward (left) by one step
   * Notes wrap around the full grid (0-MAX_STEP)
   */
  nudgeLeft(): void {
    const newNotes = new Map<number, Note[]>();

    this.notes.forEach((notesAtStep, step) => {
      const newStep = (step - 1 + STEPS) % STEPS;
      newNotes.set(newStep, [...notesAtStep]);
    });

    this.notes = newNotes;
    this.notifyChange();
    console.log('Nudged sequence left');
  }

  /**
   * Transpose all notes up by one semitone
   * Works on originalPitch and quantizes to scale (like scale changes)
   * @param rootNote Root note (0-11)
   * @param scale Scale definition
   */
  transposeUp(rootNote: number, scale: ScaleDefinition): void {
    let transposedCount = 0;

    this.notes.forEach((notesAtStep) => {
      notesAtStep.forEach(note => {
        // Get original pitch (for backward compatibility)
        const originalPitch = note.originalPitch ?? note.pitch;

        if (originalPitch < 127) {
          // Transpose the original pitch (chromatic, unquantized)
          const transposedOriginal = originalPitch + 1;

          // Quantize to scale for display/playback
          const quantizedPitch = quantizeToScale(transposedOriginal, rootNote, scale);

          // CRITICAL: Store unquantized transposed value as originalPitch
          // This allows notes to "jump over" out-of-scale rows on repeated transposes
          // pitch = quantized (what you see/hear)
          // originalPitch = unquantized chromatic position (for next transpose)
          note.pitch = quantizedPitch;
          note.originalPitch = transposedOriginal; // Store unquantized!
          transposedCount++;
        }
      });
    });

    if (transposedCount > 0) {
      this.notifyChange();
      console.log(`Transposed ${transposedCount} notes up`);
    }
  }

  /**
   * Transpose all notes down by one semitone
   * Works on originalPitch and quantizes to scale (like scale changes)
   * @param rootNote Root note (0-11)
   * @param scale Scale definition
   */
  transposeDown(rootNote: number, scale: ScaleDefinition): void {
    let transposedCount = 0;

    this.notes.forEach((notesAtStep) => {
      notesAtStep.forEach(note => {
        // Get original pitch (for backward compatibility)
        const originalPitch = note.originalPitch ?? note.pitch;

        if (originalPitch > 0) {
          // Transpose the original pitch (chromatic, unquantized)
          const transposedOriginal = originalPitch - 1;

          // Quantize to scale for display/playback
          const quantizedPitch = quantizeToScale(transposedOriginal, rootNote, scale);

          // CRITICAL: Store unquantized transposed value as originalPitch
          // This allows notes to "jump over" out-of-scale rows on repeated transposes
          // pitch = quantized (what you see/hear)
          // originalPitch = unquantized chromatic position (for next transpose)
          note.pitch = quantizedPitch;
          note.originalPitch = transposedOriginal; // Store unquantized!
          transposedCount++;
        }
      });
    });

    if (transposedCount > 0) {
      this.notifyChange();
      console.log(`Transposed ${transposedCount} notes down`);
    }
  }

  /**
   * Reverse the sequence
   * Mirrors note positions around the center
   */
  reverse(): void {
    const newNotes = new Map<number, Note[]>();
    const maxStep = this.loopMarkers.end;

    this.notes.forEach((notesAtStep, step) => {
      const reversedStep = maxStep - step;
      newNotes.set(reversedStep, [...notesAtStep]);
    });

    this.notes = newNotes;
    this.notifyChange();
    console.log('Reversed sequence');
  }

  /**
   * Randomize pitch of all notes within the current scale
   * @param rootNote Root note (0-11)
   * @param scale Scale definition
   */
  randomizePitch(rootNote: number, scale: ScaleDefinition): void {
    // Get all available in-scale pitches in the grid range (BASE_MIDI to MAX_MIDI)
    const availablePitches: number[] = [];
    for (let midi = BASE_MIDI; midi <= MAX_MIDI; midi++) {
      if (isNoteInScale(midi, rootNote, scale)) {
        availablePitches.push(midi);
      }
    }

    if (availablePitches.length === 0) {
      console.warn('No available pitches in scale');
      return;
    }

    let randomizedCount = 0;

    this.notes.forEach((notesAtStep) => {
      notesAtStep.forEach(note => {
        const randomPitch = availablePitches[Math.floor(Math.random() * availablePitches.length)];
        note.pitch = randomPitch;
        note.originalPitch = randomPitch;
        randomizedCount++;
      });
    });

    if (randomizedCount > 0) {
      this.notifyChange();
      console.log(`Randomized ${randomizedCount} note pitches`);
    }
  }

  /**
   * Randomize timing by shifting notes to random steps
   * Preserves note properties (pitch, velocity, duration)
   */
  randomizeTiming(): void {
    const allNotes: Note[] = [];

    // Collect all notes
    this.notes.forEach((notesAtStep) => {
      allNotes.push(...notesAtStep);
    });

    if (allNotes.length === 0) {
      return;
    }

    // Clear current notes
    this.notes.clear();

    // Distribute notes to random steps
    const maxStep = this.loopMarkers.end;
    allNotes.forEach(note => {
      const randomStep = Math.floor(Math.random() * (maxStep + 1));
      const notesAtStep = this.notes.get(randomStep) || [];
      notesAtStep.push({ ...note });
      this.notes.set(randomStep, notesAtStep);
    });

    this.notifyChange();
    console.log(`Randomized timing for ${allNotes.length} notes`);
  }

  /**
   * Randomize note lengths (durations)
   * Uses range 0.25 to 2.0 (quarter to double length)
   */
  randomizeLength(): void {
    let randomizedCount = 0;

    this.notes.forEach((notesAtStep) => {
      notesAtStep.forEach(note => {
        // Random duration between 0.25 and 2.0
        // This gives variety from very short (staccato) to long (sustained)
        note.duration = 0.25 + Math.random() * 1.75;
        randomizedCount++;
      });
    });

    if (randomizedCount > 0) {
      this.notifyChange();
      console.log(`Randomized ${randomizedCount} note lengths`);
    }
  }

  /**
   * Randomize velocity of all notes
   * Uses range 60-120 for musical variation
   */
  randomizeVelocity(): void {
    let randomizedCount = 0;

    this.notes.forEach((notesAtStep) => {
      notesAtStep.forEach(note => {
        // Random velocity between 60 and 120 (musical range)
        note.velocity = 60 + Math.floor(Math.random() * 61);
        randomizedCount++;
      });
    });

    if (randomizedCount > 0) {
      this.notifyChange();
      console.log(`Randomized ${randomizedCount} note velocities`);
    }
  }
}
