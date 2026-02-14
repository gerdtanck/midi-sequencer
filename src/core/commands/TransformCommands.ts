import type { Command } from './Command';
import type { Sequence } from '../Sequence';
import type { SelectionManager } from '../SelectionManager';
import type { ScaleManager } from '../ScaleManager';
import type { Note } from '../types';
import { snapToSubstep } from '@/utils';

/**
 * Target scope for transform operations
 */
export type TransformTarget = 'all' | 'selected' | 'loop';

/**
 * Rhythmic figure definition
 */
export interface RhythmicFigure {
  name: string;
  stepDurations: number[]; // Absolute step durations per note (sum = one figure cycle)
  velocityAccents?: number[]; // Velocity multipliers (optional)
  flexible?: boolean; // Can adapt to any note count
}

/**
 * Available rhythmic figures
 *
 * Each figure defines absolute step durations per note. The sum of stepDurations
 * equals one complete figure cycle (e.g., 4 steps = 1 beat, 8 steps = 2 beats).
 * Notes are placed tightly, with each group immediately following the previous one.
 *
 * Grid: 16 steps/bar, 4 steps/beat, 6 substeps/step
 */
export const FIGURES: Record<string, RhythmicFigure> = {
  // === 1-beat figures (4 steps per cycle) ===
  straight: {
    name: 'Straight',
    stepDurations: [2, 2], // Two 1/8 notes = 1 beat
    velocityAccents: [1.0, 1.0],
  },
  swing: {
    name: 'Swing',
    stepDurations: [8 / 3, 4 / 3], // 2:1 swing ratio within 1 beat (~2.667 + ~1.333)
    velocityAccents: [1.0, 0.8],
  },
  scotchSnap: {
    name: 'Scotch Snap',
    stepDurations: [1, 3], // 1/16 + dotted 1/8 = 1 beat
    velocityAccents: [0.8, 1.0],
  },
  gallop: {
    name: 'Gallop',
    stepDurations: [2, 1, 1], // 1/8 + 1/16 + 1/16 = 1 beat
    velocityAccents: [1.0, 0.8, 0.8],
  },
  reverseGallop: {
    name: 'Reverse Gallop',
    stepDurations: [1, 1, 2], // 1/16 + 1/16 + 1/8 = 1 beat
    velocityAccents: [0.8, 0.8, 1.0],
  },
  triplet: {
    name: 'Triplet',
    stepDurations: [4 / 3, 4 / 3, 4 / 3], // 3 equal notes in 1 beat (~1.333 each)
    velocityAccents: [1.0, 0.85, 0.85],
  },
  paradiddle: {
    name: 'Paradiddle',
    stepDurations: [1, 1, 1, 1], // 4 x 1/16 = 1 beat, character from accents (RLRR)
    velocityAccents: [1.0, 0.7, 0.7, 1.0],
  },
  cascade: {
    name: 'Cascade',
    stepDurations: [10 / 6, 7 / 6, 5 / 6, 2 / 6], // Accelerating, 4 notes in 1 beat
    velocityAccents: [1.0, 0.9, 0.8, 0.7],
    flexible: true,
  },
  ricochet: {
    name: 'Ricochet',
    stepDurations: [2 / 6, 5 / 6, 7 / 6, 10 / 6], // Decelerating, 4 notes in 1 beat
    velocityAccents: [0.7, 0.8, 0.9, 1.0],
    flexible: true,
  },
  flourish: {
    name: 'Flourish',
    stepDurations: [2 / 3, 2 / 3, 2 / 3, 2 / 3, 2 / 3, 2 / 3], // 6 sextuplets in 1 beat
    velocityAccents: [0.7, 0.75, 0.8, 0.85, 0.9, 1.0],
  },
  stutter: {
    name: 'Stutter',
    stepDurations: [2 / 3, 2 / 3, 2 / 3, 2], // 3 rapid + 1 held = 1 beat
    velocityAccents: [0.9, 0.85, 0.8, 1.0],
    flexible: true,
  },
  // === 2-beat figures (8 steps per cycle) ===
  tresillo: {
    name: 'Tresillo',
    stepDurations: [3, 3, 2], // Classic 3+3+2 pattern = 2 beats
    velocityAccents: [1.0, 1.0, 1.0],
  },
  habanera: {
    name: 'Habanera',
    stepDurations: [3, 1, 2, 2], // Dotted-1/8 + 1/16 + 1/8 + 1/8 = 2 beats
    velocityAccents: [1.0, 0.8, 1.0, 0.8],
  },
  fanfare: {
    name: 'Fanfare',
    stepDurations: [4, 1, 1, 1, 1], // Long opening + 4 short = 2 beats
    velocityAccents: [0.9, 0.7, 0.7, 0.7, 1.0],
  },
};

/**
 * Chord definition
 */
export interface ChordDefinition {
  name: string;
  intervals: number[]; // semitone intervals from root
}

/**
 * Available chord types
 */
export const CHORDS: Record<string, ChordDefinition> = {
  // --- Common ---
  major:        { name: 'Major',         intervals: [0, 4, 7] },
  minor:        { name: 'Minor',         intervals: [0, 3, 7] },
  dom7:         { name: '7th',           intervals: [0, 4, 7, 10] },
  maj7:         { name: 'Maj7',          intervals: [0, 4, 7, 11] },
  min7:         { name: 'Min7',          intervals: [0, 3, 7, 10] },
  sus2:         { name: 'Sus2',          intervals: [0, 2, 7] },
  sus4:         { name: 'Sus4',          intervals: [0, 5, 7] },
  dim:          { name: 'Dim',           intervals: [0, 3, 6] },
  aug:          { name: 'Aug',           intervals: [0, 4, 8] },
  power:        { name: 'Power (5th)',   intervals: [0, 7] },
  // --- Extended / Uncommon ---
  min7b5:       { name: 'Min7b5',        intervals: [0, 3, 6, 10] },
  dim7:         { name: 'Dim7',          intervals: [0, 3, 6, 9] },
  aug7:         { name: 'Aug7',          intervals: [0, 4, 8, 10] },
  dom9:         { name: '9th',           intervals: [0, 4, 7, 10, 14] },
  maj9:         { name: 'Maj9',          intervals: [0, 4, 7, 11, 14] },
  min9:         { name: 'Min9',          intervals: [0, 3, 7, 10, 14] },
  add9:         { name: 'Add9',          intervals: [0, 4, 7, 14] },
  dom11:        { name: '11th',          intervals: [0, 4, 7, 10, 14, 17] },
  dom13:        { name: '13th',          intervals: [0, 4, 7, 10, 14, 17, 21] },
  min11:        { name: 'Min11',         intervals: [0, 3, 7, 10, 14, 17] },
  maj7sharp11:  { name: 'Maj7#11',       intervals: [0, 4, 7, 11, 18] },
  dom7sharp9:   { name: '7#9 (Hendrix)', intervals: [0, 4, 7, 10, 15] },
};

/**
 * Helper to resolve which notes to operate on based on target
 */
export function resolveTargetNotes(
  sequence: Sequence,
  selectionManager: SelectionManager | null,
  target: TransformTarget
): Array<{ step: number; pitch: number; note: Note }> {
  const allNotes = sequence.getAllNotes();
  const result: Array<{ step: number; pitch: number; note: Note }> = [];

  if (target === 'selected') {
    if (!selectionManager) return [];
    const selected = selectionManager.getSelectedNotes();
    for (const { step, pitch } of selected) {
      const note = sequence.getNoteAt(step, pitch);
      if (note) {
        result.push({ step, pitch, note });
      }
    }
  } else if (target === 'loop') {
    const { start, end } = sequence.getLoopMarkers();
    for (const { step, notes } of allNotes) {
      if (step >= start && step < end) {
        for (const note of notes) {
          result.push({ step, pitch: note.pitch, note });
        }
      }
    }
  } else {
    // 'all'
    for (const { step, notes } of allNotes) {
      for (const note of notes) {
        result.push({ step, pitch: note.pitch, note });
      }
    }
  }

  return result;
}

/**
 * NudgeNotesCommand - Shift notes left/right by step delta
 * When target=Loop, wraps at loop boundaries
 */
export class NudgeNotesCommand implements Command {
  readonly description: string;

  private sequence: Sequence;
  private selectionManager: SelectionManager | null;
  private target: TransformTarget;
  private deltaStep: number;

  private movedNotes: Array<{
    oldStep: number;
    pitch: number;
    velocity: number;
    duration: number;
    originalPitch: number;
    newStep: number;
  }> = [];

  constructor(
    sequence: Sequence,
    selectionManager: SelectionManager | null,
    target: TransformTarget,
    deltaStep: number
  ) {
    this.sequence = sequence;
    this.selectionManager = selectionManager;
    this.target = target;
    this.deltaStep = deltaStep;

    const direction = deltaStep > 0 ? 'right' : 'left';
    this.description = `Nudge ${target} notes ${direction}`;
  }

  execute(): void {
    const targetNotes = resolveTargetNotes(this.sequence, this.selectionManager, this.target);
    if (targetNotes.length === 0) return;

    this.movedNotes = [];
    const { start: loopStart, end: loopEnd } = this.sequence.getLoopMarkers();
    const loopLength = loopEnd - loopStart;

    // Calculate all new positions first
    for (const { step, pitch, note } of targetNotes) {
      let newStep = step + this.deltaStep;

      if (this.target === 'loop') {
        // Wrap at loop boundaries
        while (newStep < loopStart) newStep += loopLength;
        while (newStep >= loopEnd) newStep -= loopLength;
      } else if (this.target === 'all') {
        // Wrap at sequence bounds (0 to loopEnd)
        while (newStep < 0) newStep += loopEnd;
        while (newStep >= loopEnd) newStep -= loopEnd;
      }
      // For 'selected', clamp at boundaries
      if (this.target === 'selected') {
        newStep = Math.max(0, Math.min(loopEnd - 1, newStep));
      }

      this.movedNotes.push({
        oldStep: step,
        pitch,
        velocity: note.velocity,
        duration: note.duration,
        originalPitch: note.originalPitch ?? pitch,
        newStep,
      });
    }

    // Remove all affected notes first
    for (const { oldStep, pitch } of this.movedNotes) {
      this.sequence.removeNote(oldStep, pitch);
    }

    // Add notes at new positions
    for (const moved of this.movedNotes) {
      this.sequence.addNote(
        moved.newStep,
        moved.pitch,
        moved.velocity,
        moved.duration,
        moved.originalPitch
      );

      // Update selection
      if (this.selectionManager?.isSelected(moved.oldStep, moved.pitch)) {
        this.selectionManager.moveNote(moved.oldStep, moved.pitch, moved.newStep, moved.pitch);
      }
    }
  }

  undo(): void {
    // Remove notes from new positions
    for (const { newStep, pitch } of this.movedNotes) {
      this.sequence.removeNote(newStep, pitch);
    }

    // Restore notes at original positions
    for (const moved of this.movedNotes) {
      this.sequence.addNote(
        moved.oldStep,
        moved.pitch,
        moved.velocity,
        moved.duration,
        moved.originalPitch
      );

      // Update selection back
      if (this.selectionManager?.isSelected(moved.newStep, moved.pitch)) {
        this.selectionManager.moveNote(moved.newStep, moved.pitch, moved.oldStep, moved.pitch);
      }
    }
  }
}

/**
 * TransposeNotesCommand - Shift notes up/down by semitones
 */
export class TransposeNotesCommand implements Command {
  readonly description: string;

  private sequence: Sequence;
  private selectionManager: SelectionManager | null;
  private scaleManager: ScaleManager | null;
  private target: TransformTarget;
  private deltaPitch: number;

  private movedNotes: Array<{
    step: number;
    oldPitch: number;
    newPitch: number;
    velocity: number;
    duration: number;
    oldOriginalPitch: number;
    newOriginalPitch: number;
  }> = [];

  constructor(
    sequence: Sequence,
    selectionManager: SelectionManager | null,
    target: TransformTarget,
    deltaPitch: number,
    scaleManager?: ScaleManager | null
  ) {
    this.sequence = sequence;
    this.selectionManager = selectionManager;
    this.target = target;
    this.deltaPitch = deltaPitch;
    this.scaleManager = scaleManager ?? null;

    const direction = deltaPitch > 0 ? 'up' : 'down';
    this.description = `Transpose ${target} notes ${direction}`;
  }

  execute(): void {
    const targetNotes = resolveTargetNotes(this.sequence, this.selectionManager, this.target);
    if (targetNotes.length === 0) return;

    this.movedNotes = [];

    // Calculate all new pitches first
    for (const { step, pitch, note } of targetNotes) {
      const oldOriginalPitch = note.originalPitch ?? pitch;
      const newOriginalPitch = oldOriginalPitch + this.deltaPitch;

      let newPitch: number;
      if (this.scaleManager?.snapEnabled && !this.scaleManager.isChromatic()) {
        newPitch = this.scaleManager.snapToScale(newOriginalPitch);
      } else {
        newPitch = newOriginalPitch;
      }

      // Clamp to MIDI range
      newPitch = Math.max(0, Math.min(127, newPitch));

      this.movedNotes.push({
        step,
        oldPitch: pitch,
        newPitch,
        velocity: note.velocity,
        duration: note.duration,
        oldOriginalPitch,
        newOriginalPitch: Math.max(0, Math.min(127, newOriginalPitch)),
      });
    }

    // Remove all affected notes first
    for (const { step, oldPitch } of this.movedNotes) {
      this.sequence.removeNote(step, oldPitch);
    }

    // Add notes at new pitches
    for (const moved of this.movedNotes) {
      this.sequence.addNote(
        moved.step,
        moved.newPitch,
        moved.velocity,
        moved.duration,
        moved.newOriginalPitch
      );

      // Update selection
      if (this.selectionManager?.isSelected(moved.step, moved.oldPitch)) {
        this.selectionManager.moveNote(moved.step, moved.oldPitch, moved.step, moved.newPitch);
      }
    }
  }

  undo(): void {
    // Remove notes from new pitches
    for (const { step, newPitch } of this.movedNotes) {
      this.sequence.removeNote(step, newPitch);
    }

    // Restore notes at original pitches
    for (const moved of this.movedNotes) {
      this.sequence.addNote(
        moved.step,
        moved.oldPitch,
        moved.velocity,
        moved.duration,
        moved.oldOriginalPitch
      );

      // Update selection back
      if (this.selectionManager?.isSelected(moved.step, moved.newPitch)) {
        this.selectionManager.moveNote(moved.step, moved.newPitch, moved.step, moved.oldPitch);
      }
    }
  }
}

/**
 * ReverseNotesCommand - Mirror note positions in time
 */
export class ReverseNotesCommand implements Command {
  readonly description: string;

  private sequence: Sequence;
  private selectionManager: SelectionManager | null;
  private target: TransformTarget;

  private movedNotes: Array<{
    oldStep: number;
    newStep: number;
    pitch: number;
    velocity: number;
    duration: number;
    originalPitch: number;
  }> = [];

  constructor(
    sequence: Sequence,
    selectionManager: SelectionManager | null,
    target: TransformTarget
  ) {
    this.sequence = sequence;
    this.selectionManager = selectionManager;
    this.target = target;
    this.description = `Reverse ${target} notes`;
  }

  execute(): void {
    const targetNotes = resolveTargetNotes(this.sequence, this.selectionManager, this.target);
    if (targetNotes.length === 0) return;

    this.movedNotes = [];

    // Find the center point for mirroring
    let minStep: number, maxStep: number;

    if (this.target === 'loop') {
      const { start, end } = this.sequence.getLoopMarkers();
      minStep = start;
      maxStep = end;
    } else {
      // For 'all' or 'selected', use bounding box of affected notes
      minStep = Infinity;
      maxStep = -Infinity;
      for (const { step, note } of targetNotes) {
        minStep = Math.min(minStep, step);
        maxStep = Math.max(maxStep, step + note.duration);
      }
    }

    // Calculate mirrored positions
    for (const { step, pitch, note } of targetNotes) {
      // Mirror around center: newStep = maxStep - (step - minStep) - duration
      // Simplified: newStep = maxStep + minStep - step - duration
      const newStep = maxStep + minStep - step - note.duration;

      this.movedNotes.push({
        oldStep: step,
        newStep: Math.max(0, newStep),
        pitch,
        velocity: note.velocity,
        duration: note.duration,
        originalPitch: note.originalPitch ?? pitch,
      });
    }

    // Remove all affected notes first
    for (const { oldStep, pitch } of this.movedNotes) {
      this.sequence.removeNote(oldStep, pitch);
    }

    // Add notes at mirrored positions
    for (const moved of this.movedNotes) {
      this.sequence.addNote(
        moved.newStep,
        moved.pitch,
        moved.velocity,
        moved.duration,
        moved.originalPitch
      );

      // Update selection
      if (this.selectionManager?.isSelected(moved.oldStep, moved.pitch)) {
        this.selectionManager.moveNote(moved.oldStep, moved.pitch, moved.newStep, moved.pitch);
      }
    }
  }

  undo(): void {
    // Remove notes from mirrored positions
    for (const { newStep, pitch } of this.movedNotes) {
      this.sequence.removeNote(newStep, pitch);
    }

    // Restore notes at original positions
    for (const moved of this.movedNotes) {
      this.sequence.addNote(
        moved.oldStep,
        moved.pitch,
        moved.velocity,
        moved.duration,
        moved.originalPitch
      );

      // Update selection back
      if (this.selectionManager?.isSelected(moved.newStep, moved.pitch)) {
        this.selectionManager.moveNote(moved.newStep, moved.pitch, moved.oldStep, moved.pitch);
      }
    }
  }
}

/**
 * Randomize property type
 */
export type RandomizeProperty = 'velocity' | 'timing' | 'pitch' | 'permute' | 'step' | 'length';

/**
 * RandomizeCommand - Randomize velocity, timing, or pitch
 */
export class RandomizeCommand implements Command {
  readonly description: string;

  private sequence: Sequence;
  private selectionManager: SelectionManager | null;
  private scaleManager: ScaleManager | null;
  private target: TransformTarget;
  private property: RandomizeProperty;

  private originalNotes: Array<{
    step: number;
    pitch: number;
    velocity: number;
    duration: number;
    originalPitch: number;
    newStep?: number;
    newPitch?: number;
    newVelocity?: number;
    newDuration?: number;
    newOriginalPitch?: number; // For permute: the originalPitch that moves with the pitch
  }> = [];

  constructor(
    sequence: Sequence,
    selectionManager: SelectionManager | null,
    target: TransformTarget,
    property: RandomizeProperty,
    scaleManager?: ScaleManager | null
  ) {
    this.sequence = sequence;
    this.selectionManager = selectionManager;
    this.target = target;
    this.property = property;
    this.scaleManager = scaleManager ?? null;
    this.description = `Randomize ${property}`;
  }

  execute(): void {
    const targetNotes = resolveTargetNotes(this.sequence, this.selectionManager, this.target);
    if (targetNotes.length === 0) return;

    this.originalNotes = [];

    // For pitch randomization, find the center of all notes first
    let centerPitch = 60; // default middle C
    if (this.property === 'pitch' && targetNotes.length > 0) {
      let minNotePitch = Infinity;
      let maxNotePitch = -Infinity;
      for (const { pitch } of targetNotes) {
        minNotePitch = Math.min(minNotePitch, pitch);
        maxNotePitch = Math.max(maxNotePitch, pitch);
      }
      centerPitch = Math.round((minNotePitch + maxNotePitch) / 2);
    }

    // For step randomization, determine the valid step range
    let stepRangeMin = 0;
    let stepRangeMax = 64; // default
    if (this.property === 'step') {
      if (this.target === 'loop' || this.target === 'all') {
        const { start, end } = this.sequence.getLoopMarkers();
        stepRangeMin = start;
        stepRangeMax = end;
      } else if (this.target === 'selected' && targetNotes.length > 0) {
        // Use the span of selected notes
        stepRangeMin = Infinity;
        stepRangeMax = -Infinity;
        for (const { step } of targetNotes) {
          stepRangeMin = Math.min(stepRangeMin, Math.floor(step));
          stepRangeMax = Math.max(stepRangeMax, Math.floor(step) + 1);
        }
      }
    }

    // Track occupied pitches per step to prevent overlaps during pitch randomization
    const pitchOccupiedByStep = new Map<number, Set<number>>();

    // Store original values and calculate new values
    for (const { step, pitch, note } of targetNotes) {
      const entry: (typeof this.originalNotes)[0] = {
        step,
        pitch,
        velocity: note.velocity,
        duration: note.duration,
        originalPitch: note.originalPitch ?? pitch,
      };

      if (this.property === 'velocity') {
        // Random velocity 40-127
        entry.newVelocity = Math.floor(Math.random() * 88) + 40;
      } else if (this.property === 'timing') {
        // Random timing offset -0.25 to +0.25 steps, snapped to valid substep positions
        const offset = (Math.random() - 0.5) * 0.5;
        entry.newStep = snapToSubstep(Math.max(0, step + offset));
      } else if (this.property === 'pitch') {
        // Random pitch within ±1 octave of the center of all notes
        const minPitch = Math.max(0, centerPitch - 12);
        const maxPitch = Math.min(127, centerPitch + 12);

        // Track occupied pitches per step to prevent overlaps
        if (!pitchOccupiedByStep.has(step)) {
          pitchOccupiedByStep.set(step, new Set<number>());
        }
        const occupied = pitchOccupiedByStep.get(step)!;

        // Build candidate pitches (respecting scale, excluding occupied)
        const candidates: number[] = [];
        if (this.scaleManager && !this.scaleManager.isChromatic()) {
          for (let p = minPitch; p <= maxPitch; p++) {
            if (this.scaleManager.isInScale(p) && !occupied.has(p)) {
              candidates.push(p);
            }
          }
        } else {
          for (let p = minPitch; p <= maxPitch; p++) {
            if (!occupied.has(p)) {
              candidates.push(p);
            }
          }
        }

        if (candidates.length > 0) {
          entry.newPitch = candidates[Math.floor(Math.random() * candidates.length)];
        } else {
          entry.newPitch = pitch; // fallback: keep original if no room
        }
        occupied.add(entry.newPitch);
      } else if (this.property === 'length') {
        // Random duration from 1/64 (0.25 steps) to 1/1 (16 steps)
        // Use musically meaningful values: 0.25, 0.5, 1, 2, 4, 8, 16
        const durations = [0.25, 0.5, 1, 2, 4, 8, 16];
        entry.newDuration = durations[Math.floor(Math.random() * durations.length)];
      }
      // Note: 'step' randomization is handled separately below to avoid collisions

      this.originalNotes.push(entry);
    }

    // For step randomization, assign unique steps per pitch to avoid collisions
    if (this.property === 'step') {
      const rangeSize = stepRangeMax - stepRangeMin;
      if (rangeSize > 0) {
        // Group entries by pitch
        const byPitch = new Map<number, Array<(typeof this.originalNotes)[0]>>();
        for (const entry of this.originalNotes) {
          const group = byPitch.get(entry.pitch) || [];
          group.push(entry);
          byPitch.set(entry.pitch, group);
        }

        // For each pitch group, assign random unique steps
        for (const [, entries] of byPitch) {
          // Generate available steps (as many as needed, up to rangeSize)
          const availableSteps: number[] = [];
          for (let s = stepRangeMin; s < stepRangeMax; s++) {
            availableSteps.push(s);
          }

          // Shuffle available steps
          for (let i = availableSteps.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [availableSteps[i], availableSteps[j]] = [availableSteps[j], availableSteps[i]];
          }

          // Assign unique steps to each entry, preserving substep offset
          for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            const substepOffset = entry.step - Math.floor(entry.step);
            if (i < availableSteps.length) {
              entry.newStep = availableSteps[i] + substepOffset;
            } else {
              // More notes than available steps - keep original position
              entry.newStep = entry.step;
            }
          }
        }
      }
    }

    // For permute, shuffle pitches across all entries (must be done after collecting all)
    if (this.property === 'permute') {
      // Collect all pitches and originalPitches
      const pitches = this.originalNotes.map(e => e.pitch);
      const originalPitches = this.originalNotes.map(e => e.originalPitch);

      // Fisher-Yates shuffle
      for (let i = pitches.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pitches[i], pitches[j]] = [pitches[j], pitches[i]];
        [originalPitches[i], originalPitches[j]] = [originalPitches[j], originalPitches[i]];
      }

      // Assign shuffled pitches to entries
      for (let i = 0; i < this.originalNotes.length; i++) {
        this.originalNotes[i].newPitch = pitches[i];
        this.originalNotes[i].newOriginalPitch = originalPitches[i];
      }
    }

    // Apply changes
    if (this.property === 'velocity') {
      for (const entry of this.originalNotes) {
        if (entry.newVelocity !== undefined) {
          this.sequence.updateNote(entry.step, entry.pitch, { velocity: entry.newVelocity });
        }
      }
    } else if (this.property === 'length') {
      for (const entry of this.originalNotes) {
        if (entry.newDuration !== undefined) {
          this.sequence.updateNote(entry.step, entry.pitch, { duration: entry.newDuration });
        }
      }
    } else if (this.property === 'timing' || this.property === 'step') {
      // Remove and re-add notes at new positions
      for (const entry of this.originalNotes) {
        this.sequence.removeNote(entry.step, entry.pitch);
      }
      for (const entry of this.originalNotes) {
        const newStep = entry.newStep ?? entry.step;
        this.sequence.addNote(
          newStep,
          entry.pitch,
          entry.velocity,
          entry.duration,
          entry.originalPitch
        );
        // Update selection
        if (this.selectionManager?.isSelected(entry.step, entry.pitch)) {
          this.selectionManager.moveNote(entry.step, entry.pitch, newStep, entry.pitch);
        }
      }
    } else if (this.property === 'pitch') {
      // Remove and re-add notes at new pitches
      for (const entry of this.originalNotes) {
        this.sequence.removeNote(entry.step, entry.pitch);
      }
      for (const entry of this.originalNotes) {
        const newPitch = entry.newPitch ?? entry.pitch;
        this.sequence.addNote(
          entry.step,
          newPitch,
          entry.velocity,
          entry.duration,
          newPitch // new originalPitch matches new pitch
        );
        // Update selection
        if (this.selectionManager?.isSelected(entry.step, entry.pitch)) {
          this.selectionManager.moveNote(entry.step, entry.pitch, entry.step, newPitch);
        }
      }
    } else if (this.property === 'permute') {
      // Remove and re-add notes with shuffled pitches (preserves originalPitch relationship)
      for (const entry of this.originalNotes) {
        this.sequence.removeNote(entry.step, entry.pitch);
      }
      for (const entry of this.originalNotes) {
        const newPitch = entry.newPitch ?? entry.pitch;
        const newOriginalPitch = entry.newOriginalPitch ?? entry.originalPitch;
        this.sequence.addNote(
          entry.step,
          newPitch,
          entry.velocity,
          entry.duration,
          newOriginalPitch
        );
        // Update selection
        if (this.selectionManager?.isSelected(entry.step, entry.pitch)) {
          this.selectionManager.moveNote(entry.step, entry.pitch, entry.step, newPitch);
        }
      }
    }
  }

  undo(): void {
    if (this.property === 'velocity') {
      for (const entry of this.originalNotes) {
        this.sequence.updateNote(entry.step, entry.pitch, { velocity: entry.velocity });
      }
    } else if (this.property === 'length') {
      for (const entry of this.originalNotes) {
        this.sequence.updateNote(entry.step, entry.pitch, { duration: entry.duration });
      }
    } else if (this.property === 'timing' || this.property === 'step') {
      // Remove from new positions
      for (const entry of this.originalNotes) {
        const newStep = entry.newStep ?? entry.step;
        this.sequence.removeNote(newStep, entry.pitch);
      }
      // Restore at original positions
      for (const entry of this.originalNotes) {
        this.sequence.addNote(
          entry.step,
          entry.pitch,
          entry.velocity,
          entry.duration,
          entry.originalPitch
        );
        // Update selection back
        const newStep = entry.newStep ?? entry.step;
        if (this.selectionManager?.isSelected(newStep, entry.pitch)) {
          this.selectionManager.moveNote(newStep, entry.pitch, entry.step, entry.pitch);
        }
      }
    } else if (this.property === 'pitch' || this.property === 'permute') {
      // Remove from new pitches
      for (const entry of this.originalNotes) {
        const newPitch = entry.newPitch ?? entry.pitch;
        this.sequence.removeNote(entry.step, newPitch);
      }
      // Restore at original pitches
      for (const entry of this.originalNotes) {
        this.sequence.addNote(
          entry.step,
          entry.pitch,
          entry.velocity,
          entry.duration,
          entry.originalPitch
        );
        // Update selection back
        const newPitch = entry.newPitch ?? entry.pitch;
        if (this.selectionManager?.isSelected(entry.step, newPitch)) {
          this.selectionManager.moveNote(entry.step, newPitch, entry.step, entry.pitch);
        }
      }
    }
  }
}

/**
 * QuantizeCommand - Snap notes to grid positions (whole steps)
 */
export class QuantizeCommand implements Command {
  readonly description: string;

  private sequence: Sequence;
  private selectionManager: SelectionManager | null;
  private target: TransformTarget;

  private movedNotes: Array<{
    oldStep: number;
    newStep: number;
    pitch: number;
    velocity: number;
    duration: number;
    originalPitch: number;
  }> = [];

  constructor(
    sequence: Sequence,
    selectionManager: SelectionManager | null,
    target: TransformTarget
  ) {
    this.sequence = sequence;
    this.selectionManager = selectionManager;
    this.target = target;
    this.description = `Quantize ${target} notes`;
  }

  execute(): void {
    const targetNotes = resolveTargetNotes(this.sequence, this.selectionManager, this.target);
    if (targetNotes.length === 0) return;

    this.movedNotes = [];

    // Calculate quantized positions
    for (const { step, pitch, note } of targetNotes) {
      const newStep = Math.round(step); // Snap to nearest whole step

      // Only include notes that actually move
      if (newStep !== step) {
        this.movedNotes.push({
          oldStep: step,
          newStep,
          pitch,
          velocity: note.velocity,
          duration: note.duration,
          originalPitch: note.originalPitch ?? pitch,
        });
      }
    }

    if (this.movedNotes.length === 0) return;

    // Remove notes from old positions
    for (const { oldStep, pitch } of this.movedNotes) {
      this.sequence.removeNote(oldStep, pitch);
    }

    // Add notes at quantized positions
    for (const moved of this.movedNotes) {
      this.sequence.addNote(
        moved.newStep,
        moved.pitch,
        moved.velocity,
        moved.duration,
        moved.originalPitch
      );

      // Update selection
      if (this.selectionManager?.isSelected(moved.oldStep, moved.pitch)) {
        this.selectionManager.moveNote(moved.oldStep, moved.pitch, moved.newStep, moved.pitch);
      }
    }
  }

  undo(): void {
    if (this.movedNotes.length === 0) return;

    // Remove notes from quantized positions
    for (const { newStep, pitch } of this.movedNotes) {
      this.sequence.removeNote(newStep, pitch);
    }

    // Restore notes at original positions
    for (const moved of this.movedNotes) {
      this.sequence.addNote(
        moved.oldStep,
        moved.pitch,
        moved.velocity,
        moved.duration,
        moved.originalPitch
      );

      // Update selection back
      if (this.selectionManager?.isSelected(moved.newStep, moved.pitch)) {
        this.selectionManager.moveNote(moved.newStep, moved.pitch, moved.oldStep, moved.pitch);
      }
    }
  }
}

/**
 * ClearSequenceCommand - Clear notes based on target scope
 */
export class ClearSequenceCommand implements Command {
  readonly description: string;

  private sequence: Sequence;
  private selectionManager: SelectionManager | null;
  private target: TransformTarget;

  private clearedNotes: Array<{
    step: number;
    pitch: number;
    velocity: number;
    duration: number;
    originalPitch: number;
  }> = [];

  constructor(
    sequence: Sequence,
    selectionManager: SelectionManager | null,
    target: TransformTarget
  ) {
    this.sequence = sequence;
    this.selectionManager = selectionManager;
    this.target = target;
    this.description = `Clear ${target} notes`;
  }

  execute(): void {
    const targetNotes = resolveTargetNotes(this.sequence, this.selectionManager, this.target);
    if (targetNotes.length === 0) return;

    this.clearedNotes = [];

    // Store and remove notes
    for (const { step, pitch, note } of targetNotes) {
      this.clearedNotes.push({
        step,
        pitch,
        velocity: note.velocity,
        duration: note.duration,
        originalPitch: note.originalPitch ?? pitch,
      });

      this.sequence.removeNote(step, pitch);

      // Remove from selection
      if (this.selectionManager?.isSelected(step, pitch)) {
        this.selectionManager.deselect(step, pitch);
      }
    }
  }

  undo(): void {
    // Restore all cleared notes
    for (const note of this.clearedNotes) {
      this.sequence.addNote(
        note.step,
        note.pitch,
        note.velocity,
        note.duration,
        note.originalPitch
      );
    }
  }
}

/**
 * SetLengthCommand - Set all notes to a specific duration
 */
export class SetLengthCommand implements Command {
  readonly description: string;

  private sequence: Sequence;
  private selectionManager: SelectionManager | null;
  private target: TransformTarget;
  private newDuration: number;

  private originalNotes: Array<{
    step: number;
    pitch: number;
    oldDuration: number;
  }> = [];

  constructor(
    sequence: Sequence,
    selectionManager: SelectionManager | null,
    target: TransformTarget,
    duration: number
  ) {
    this.sequence = sequence;
    this.selectionManager = selectionManager;
    this.target = target;
    this.newDuration = duration;
    this.description = `Set ${target} notes length to ${duration}`;
  }

  execute(): void {
    const targetNotes = resolveTargetNotes(this.sequence, this.selectionManager, this.target);
    if (targetNotes.length === 0) return;

    this.originalNotes = [];

    for (const { step, pitch, note } of targetNotes) {
      this.originalNotes.push({
        step,
        pitch,
        oldDuration: note.duration,
      });

      this.sequence.updateNote(step, pitch, { duration: this.newDuration });
    }
  }

  undo(): void {
    for (const entry of this.originalNotes) {
      this.sequence.updateNote(entry.step, entry.pitch, { duration: entry.oldDuration });
    }
  }
}

/**
 * Helper to generate step durations for flexible figures
 * that can adapt to any note count.
 *
 * Returns absolute step durations that sum to the figure's cycle span,
 * preserving the figure's rhythmic character at the new note count.
 */
function generateFlexiblePattern(
  figure: RhythmicFigure,
  noteCount: number
): { durations: number[]; accents: number[] } {
  const span = figure.stepDurations.reduce((a, b) => a + b, 0);

  if (!figure.flexible || noteCount === figure.stepDurations.length) {
    return {
      durations: figure.stepDurations,
      accents: figure.velocityAccents || figure.stepDurations.map(() => 1.0),
    };
  }

  const durations: number[] = [];
  const accents: number[] = [];

  if (figure.name === 'Cascade') {
    // Accelerating: weights n, n-1, ..., 1 (decreasing durations)
    let total = 0;
    const weights: number[] = [];
    for (let i = 0; i < noteCount; i++) {
      const weight = noteCount - i;
      weights.push(weight);
      total += weight;
    }
    for (let i = 0; i < noteCount; i++) {
      durations.push((weights[i] / total) * span);
      accents.push(1.0 - i * (0.3 / Math.max(1, noteCount - 1)));
    }
  } else if (figure.name === 'Ricochet') {
    // Decelerating: weights 1, 2, ..., n (increasing durations)
    let total = 0;
    const weights: number[] = [];
    for (let i = 0; i < noteCount; i++) {
      const weight = i + 1;
      weights.push(weight);
      total += weight;
    }
    for (let i = 0; i < noteCount; i++) {
      durations.push((weights[i] / total) * span);
      accents.push(0.7 + i * (0.3 / Math.max(1, noteCount - 1)));
    }
  } else if (figure.name === 'Stutter') {
    // Rapid repeated notes + final held note
    const rapidCount = noteCount - 1;
    const heldDuration = span / 2;
    const rapidDuration = (span - heldDuration) / Math.max(1, rapidCount);
    for (let i = 0; i < rapidCount; i++) {
      durations.push(rapidDuration);
      accents.push(0.9 - i * (0.1 / Math.max(1, rapidCount - 1)));
    }
    durations.push(heldDuration);
    accents.push(1.0);
  } else {
    // Default: even spacing within the span
    for (let i = 0; i < noteCount; i++) {
      durations.push(span / noteCount);
      accents.push(1.0);
    }
  }

  return { durations, accents };
}

/**
 * ApplyFigureCommand - Apply rhythmic figure to redistribute note timing
 *
 * Notes are packed tightly from the start position. Each figure group occupies
 * exactly its cycle span (sum of stepDurations), and groups follow immediately
 * one after another. Note durations are set to match the figure's time slots.
 */
export class ApplyFigureCommand implements Command {
  readonly description: string;

  private sequence: Sequence;
  private selectionManager: SelectionManager | null;
  private target: TransformTarget;
  private figure: RhythmicFigure;
  private applyAccents: boolean;

  private originalNotes: Array<{
    oldStep: number;
    newStep: number;
    pitch: number;
    velocity: number;
    newVelocity: number;
    duration: number;
    newDuration: number;
    originalPitch: number;
  }> = [];

  constructor(
    sequence: Sequence,
    selectionManager: SelectionManager | null,
    target: TransformTarget,
    figure: RhythmicFigure,
    applyAccents: boolean = true
  ) {
    this.sequence = sequence;
    this.selectionManager = selectionManager;
    this.target = target;
    this.figure = figure;
    this.applyAccents = applyAccents;
    this.description = `Apply ${figure.name} figure to ${target} notes`;
  }

  execute(): void {
    const targetNotes = resolveTargetNotes(this.sequence, this.selectionManager, this.target);
    if (targetNotes.length === 0) return;

    // Sort by step, then by pitch
    targetNotes.sort((a, b) => {
      if (a.step !== b.step) return a.step - b.step;
      return a.pitch - b.pitch;
    });

    this.originalNotes = [];

    // Determine start position (pack tightly from here)
    let startStep: number;
    if (this.target === 'loop' || this.target === 'all') {
      const { start } = this.sequence.getLoopMarkers();
      startStep = start;
    } else {
      // 'selected': start from the first selected note
      startStep = targetNotes[0].step;
    }

    // Figure properties
    const noteCount = this.figure.stepDurations.length;
    const span = this.figure.stepDurations.reduce((a, b) => a + b, 0);

    // Group notes by figure's note count
    const groups: Array<typeof targetNotes> = [];
    for (let i = 0; i < targetNotes.length; i += noteCount) {
      groups.push(targetNotes.slice(i, i + noteCount));
    }

    // Place each group tightly, one after another
    let groupStart = startStep;
    for (const group of groups) {
      const isPartialGroup = group.length !== noteCount;

      // Get pattern for this group (flexible figures adapt to different note counts)
      const { durations, accents } = (this.figure.flexible && isPartialGroup)
        ? generateFlexiblePattern(this.figure, group.length)
        : {
            durations: this.figure.stepDurations.slice(0, group.length),
            accents: (this.figure.velocityAccents || this.figure.stepDurations.map(() => 1.0))
              .slice(0, group.length),
          };

      // Place notes using absolute step durations
      let cumulative = 0;
      for (let i = 0; i < group.length; i++) {
        const { step, pitch, note } = group[i];
        const dur = durations[i] ?? (span / noteCount);

        // Position: group start + cumulative offset, snapped to substep grid
        const newStep = snapToSubstep(groupStart + cumulative);

        // Duration: snap the end position and derive duration from the gap
        const nextPos = snapToSubstep(groupStart + cumulative + dur);
        const newDuration = nextPos - newStep;

        // Velocity accent
        const velocityMultiplier = accents[i] ?? 1.0;
        const newVelocity = this.applyAccents
          ? Math.min(127, Math.max(1, Math.round(note.velocity * velocityMultiplier)))
          : note.velocity;

        this.originalNotes.push({
          oldStep: step,
          newStep,
          pitch,
          velocity: note.velocity,
          newVelocity,
          duration: note.duration,
          newDuration,
          originalPitch: note.originalPitch ?? pitch,
        });

        cumulative += dur;
      }

      // Advance to next group: snap to substep grid for clean alignment
      groupStart = snapToSubstep(groupStart + cumulative);
    }

    // Remove all affected notes first
    for (const { oldStep, pitch } of this.originalNotes) {
      this.sequence.removeNote(oldStep, pitch);
    }

    // Add notes at new positions with new velocities and durations
    for (const moved of this.originalNotes) {
      this.sequence.addNote(
        moved.newStep,
        moved.pitch,
        moved.newVelocity,
        moved.newDuration,
        moved.originalPitch
      );

      // Update selection
      if (this.selectionManager?.isSelected(moved.oldStep, moved.pitch)) {
        this.selectionManager.moveNote(moved.oldStep, moved.pitch, moved.newStep, moved.pitch);
      }
    }
  }

  undo(): void {
    // Remove notes from new positions
    for (const { newStep, pitch } of this.originalNotes) {
      this.sequence.removeNote(newStep, pitch);
    }

    // Restore notes at original positions with original velocities and durations
    for (const moved of this.originalNotes) {
      this.sequence.addNote(
        moved.oldStep,
        moved.pitch,
        moved.velocity,
        moved.duration,
        moved.originalPitch
      );

      // Update selection back
      if (this.selectionManager?.isSelected(moved.newStep, moved.pitch)) {
        this.selectionManager.moveNote(moved.newStep, moved.pitch, moved.oldStep, moved.pitch);
      }
    }
  }
}

/**
 * Find the nearest pitch that belongs to a set of pitch classes,
 * optionally excluding specific pitches (to avoid overlaps at the same step)
 */
function nearestChordPitch(
  pitch: number,
  chordPitchClasses: Set<number>,
  excludedPitches?: Set<number>
): number {
  const isAllowed = (p: number) =>
    chordPitchClasses.has(((p % 12) + 12) % 12) && (!excludedPitches || !excludedPitches.has(p));

  if (isAllowed(pitch)) return pitch;

  let below = pitch - 1, above = pitch + 1;
  while (below >= 0 || above <= 127) {
    if (below >= 0 && isAllowed(below)) return below;
    if (above <= 127 && isAllowed(above)) return above;
    below--;
    above++;
  }
  return pitch; // fallback
}

/**
 * ChordQuantizeCommand - Snap note pitches to the nearest chord tone
 */
export class ChordQuantizeCommand implements Command {
  readonly description: string;

  private sequence: Sequence;
  private selectionManager: SelectionManager | null;
  private target: TransformTarget;
  private chordIntervals: number[];
  private root: number;

  private movedNotes: Array<{
    step: number;
    oldPitch: number;
    newPitch: number;
    velocity: number;
    duration: number;
    originalPitch: number;
  }> = [];

  constructor(
    sequence: Sequence,
    selectionManager: SelectionManager | null,
    target: TransformTarget,
    chordIntervals: number[],
    root: number
  ) {
    this.sequence = sequence;
    this.selectionManager = selectionManager;
    this.target = target;
    this.chordIntervals = chordIntervals;
    this.root = root;
    this.description = `Chord quantize ${target} notes`;
  }

  execute(): void {
    const targetNotes = resolveTargetNotes(this.sequence, this.selectionManager, this.target);
    if (targetNotes.length === 0) return;

    // Build pitch class set from root + intervals
    const chordPitchClasses = new Set<number>();
    for (const interval of this.chordIntervals) {
      chordPitchClasses.add(((this.root + interval) % 12 + 12) % 12);
    }

    this.movedNotes = [];

    // Track occupied pitches per step to prevent overlaps
    const occupiedByStep = new Map<number, Set<number>>();

    for (const { step, pitch, note } of targetNotes) {
      let occupied = occupiedByStep.get(step);
      if (!occupied) {
        occupied = new Set<number>();
        occupiedByStep.set(step, occupied);
      }

      const newPitch = nearestChordPitch(pitch, chordPitchClasses, occupied);
      occupied.add(newPitch);

      this.movedNotes.push({
        step,
        oldPitch: pitch,
        newPitch,
        velocity: note.velocity,
        duration: note.duration,
        originalPitch: note.originalPitch ?? pitch,
      });
    }

    // Remove all affected notes first
    for (const { step, oldPitch } of this.movedNotes) {
      this.sequence.removeNote(step, oldPitch);
    }

    // Add notes at new pitches
    for (const moved of this.movedNotes) {
      this.sequence.addNote(
        moved.step,
        moved.newPitch,
        moved.velocity,
        moved.duration,
        moved.newPitch // originalPitch = new pitch (quantized)
      );

      // Update selection
      if (this.selectionManager?.isSelected(moved.step, moved.oldPitch)) {
        this.selectionManager.moveNote(moved.step, moved.oldPitch, moved.step, moved.newPitch);
      }
    }
  }

  undo(): void {
    // Remove notes from new pitches
    for (const { step, newPitch } of this.movedNotes) {
      this.sequence.removeNote(step, newPitch);
    }

    // Restore notes at original pitches
    for (const moved of this.movedNotes) {
      this.sequence.addNote(
        moved.step,
        moved.oldPitch,
        moved.velocity,
        moved.duration,
        moved.originalPitch
      );

      // Update selection back
      if (this.selectionManager?.isSelected(moved.step, moved.newPitch)) {
        this.selectionManager.moveNote(moved.step, moved.newPitch, moved.step, moved.oldPitch);
      }
    }
  }
}
