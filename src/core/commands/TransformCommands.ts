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
  noteCount: number; // How many notes this figure groups
  timingPattern: number[]; // Relative timing (sums to 1.0)
  velocityAccents?: number[]; // Velocity multipliers (optional)
  flexible?: boolean; // Can apply to any note count
}

/**
 * Available rhythmic figures
 *
 * All timing patterns use fractions of 1/6 to align with the sequencer's
 * 6 substeps per step resolution (24 ticks per beat with 4 steps per beat).
 * Valid substep positions: 0, 1/6, 2/6, 3/6, 4/6, 5/6 (0, 0.167, 0.333, 0.5, 0.667, 0.833)
 */
export const FIGURES: Record<string, RhythmicFigure> = {
  // Basic Figures (2-3 notes)
  straight: {
    name: 'Straight',
    noteCount: 2,
    timingPattern: [3 / 6, 3 / 6], // 0.5, 0.5 - even split
    velocityAccents: [1.0, 1.0],
  },
  swing: {
    name: 'Swing',
    noteCount: 2,
    timingPattern: [4 / 6, 2 / 6], // 0.667, 0.333 - 2:1 swing ratio
    velocityAccents: [1.0, 0.8],
  },
  scotchSnap: {
    name: 'Scotch Snap',
    noteCount: 2,
    timingPattern: [1 / 6, 5 / 6], // 0.167, 0.833 - short pickup, long note
    velocityAccents: [0.8, 1.0],
  },
  gallop: {
    name: 'Gallop',
    noteCount: 3,
    timingPattern: [1 / 6, 2 / 6, 3 / 6], // 0.167, 0.333, 0.5 - short-short-long
    velocityAccents: [0.8, 0.8, 1.0],
  },
  reverseGallop: {
    name: 'Reverse Gallop',
    noteCount: 3,
    timingPattern: [3 / 6, 2 / 6, 1 / 6], // 0.5, 0.333, 0.167 - long-short-short
    velocityAccents: [1.0, 0.8, 0.8],
  },
  triplet: {
    name: 'Triplet',
    noteCount: 3,
    timingPattern: [2 / 6, 2 / 6, 2 / 6], // 0.333, 0.333, 0.333 - even triplet
    velocityAccents: [1.0, 0.85, 0.85],
  },
  // Compound Figures (4-6 notes)
  tresillo: {
    name: 'Tresillo',
    noteCount: 3,
    timingPattern: [2 / 6, 3 / 6, 1 / 6], // 0.333, 0.5, 0.167 - approximates 3+3+2
    velocityAccents: [1.0, 1.0, 1.0],
  },
  habanera: {
    name: 'Habanera',
    noteCount: 4,
    timingPattern: [2 / 6, 1 / 6, 2 / 6, 1 / 6], // 0.333, 0.167, 0.333, 0.167
    velocityAccents: [1.0, 0.8, 1.0, 0.8],
  },
  cascade: {
    name: 'Cascade',
    noteCount: 4,
    timingPattern: [2 / 6, 2 / 6, 1 / 6, 1 / 6], // Accelerating: positions at 0, 2/6, 4/6, 5/6
    velocityAccents: [1.0, 0.9, 0.8, 0.7],
    flexible: true,
  },
  ricochet: {
    name: 'Ricochet',
    noteCount: 4,
    timingPattern: [1 / 6, 1 / 6, 2 / 6, 2 / 6], // Decelerating: positions at 0, 1/6, 2/6, 4/6
    velocityAccents: [0.7, 0.8, 0.9, 1.0],
    flexible: true,
  },
  paradiddle: {
    name: 'Paradiddle',
    noteCount: 4,
    timingPattern: [2 / 6, 1 / 6, 2 / 6, 1 / 6], // Even but accented
    velocityAccents: [1.0, 0.8, 1.0, 0.8],
  },
  // Extended Figures (variable notes)
  fanfare: {
    name: 'Fanfare',
    noteCount: 5,
    timingPattern: [2 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6], // Long-short-short-short-end
    velocityAccents: [0.9, 0.7, 0.7, 0.7, 1.0],
  },
  flourish: {
    name: 'Flourish',
    noteCount: 6,
    timingPattern: [1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6], // Even sixths
    velocityAccents: [0.7, 0.75, 0.8, 0.85, 0.9, 1.0],
  },
  stutter: {
    name: 'Stutter',
    noteCount: 4,
    timingPattern: [1 / 6, 1 / 6, 1 / 6, 3 / 6], // Rapid repeated then long
    velocityAccents: [0.9, 0.85, 0.8, 1.0],
    flexible: true,
  },
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

        // Always respect the active scale (not just when snap is enabled)
        if (this.scaleManager && !this.scaleManager.isChromatic()) {
          // Get scale pitches within range
          const scalePitches: number[] = [];
          for (let p = minPitch; p <= maxPitch; p++) {
            if (this.scaleManager.isInScale(p)) {
              scalePitches.push(p);
            }
          }
          if (scalePitches.length > 0) {
            entry.newPitch = scalePitches[Math.floor(Math.random() * scalePitches.length)];
          } else {
            entry.newPitch = pitch;
          }
        } else {
          // Chromatic scale or no scale manager - use full range
          entry.newPitch = Math.floor(Math.random() * (maxPitch - minPitch + 1)) + minPitch;
        }
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
 * Helper to generate timing pattern for flexible figures
 * that can apply to any note count.
 *
 * Generated patterns will be snapped to the 6-substep grid via snapToSubstep,
 * but we use graduated weights to approximate the intended rhythmic effect.
 */
function generateFlexiblePattern(
  figure: RhythmicFigure,
  noteCount: number
): { timing: number[]; accents: number[] } {
  if (!figure.flexible || noteCount === figure.noteCount) {
    return {
      timing: figure.timingPattern,
      accents: figure.velocityAccents || figure.timingPattern.map(() => 1.0),
    };
  }

  // Generate pattern based on figure type
  const timing: number[] = [];
  const accents: number[] = [];

  if (figure.name === 'Cascade') {
    // Accelerating: each note gets progressively shorter
    // Weights: n, n-1, n-2, ... 1 (decreasing)
    let total = 0;
    const weights: number[] = [];
    for (let i = 0; i < noteCount; i++) {
      const weight = noteCount - i;
      weights.push(weight);
      total += weight;
    }
    for (let i = 0; i < noteCount; i++) {
      timing.push(weights[i] / total);
      accents.push(1.0 - i * (0.3 / Math.max(1, noteCount - 1)));
    }
  } else if (figure.name === 'Ricochet') {
    // Decelerating: each note gets progressively longer
    // Weights: 1, 2, 3, ... n (increasing)
    let total = 0;
    const weights: number[] = [];
    for (let i = 0; i < noteCount; i++) {
      const weight = i + 1;
      weights.push(weight);
      total += weight;
    }
    for (let i = 0; i < noteCount; i++) {
      timing.push(weights[i] / total);
      accents.push(0.7 + i * (0.3 / Math.max(1, noteCount - 1)));
    }
  } else if (figure.name === 'Stutter') {
    // Rapid repeated notes + final held note
    // Use 3/6 (0.5) for held portion, remaining split among rapid notes
    const rapidCount = noteCount - 1;
    const heldPortion = 3 / 6; // 0.5 - grid aligned
    const rapidPortion = 1.0 - heldPortion;

    for (let i = 0; i < rapidCount; i++) {
      timing.push(rapidPortion / rapidCount);
      accents.push(0.9 - i * (0.1 / Math.max(1, rapidCount - 1)));
    }
    timing.push(heldPortion);
    accents.push(1.0);
  } else {
    // Default: even spacing
    for (let i = 0; i < noteCount; i++) {
      timing.push(1.0 / noteCount);
      accents.push(1.0);
    }
  }

  return { timing, accents };
}

/**
 * ApplyFigureCommand - Apply rhythmic figure to redistribute note timing
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

    // Determine time span based on target scope (use fixed boundaries, not note positions)
    // This ensures the operation is idempotent - applying the same figure twice gives the same result
    let startStep: number;
    let endStep: number;

    if (this.target === 'loop' || this.target === 'all') {
      // Use loop markers as fixed boundaries
      const { start, end } = this.sequence.getLoopMarkers();
      startStep = start;
      endStep = end;
    } else {
      // 'selected': use bounding box of selected notes
      // This is the only case where we derive from note positions
      startStep = Math.min(...targetNotes.map(n => n.step));
      endStep = Math.max(...targetNotes.map(n => n.step)) + 1;
    }

    const totalSteps = endStep - startStep;

    // Group notes by figure's note count
    const groups: Array<typeof targetNotes> = [];
    const noteCount = this.figure.noteCount;

    for (let i = 0; i < targetNotes.length; i += noteCount) {
      groups.push(targetNotes.slice(i, i + noteCount));
    }

    // Calculate step allocation per group
    const stepsPerGroup = totalSteps / groups.length;

    // Apply timing pattern to each group
    let groupStartStep = startStep;
    for (const group of groups) {
      // Get timing pattern (may be generated for flexible figures)
      const { timing, accents } = this.figure.flexible
        ? generateFlexiblePattern(this.figure, group.length)
        : {
            timing: this.figure.timingPattern,
            accents:
              this.figure.velocityAccents ||
              this.figure.timingPattern.map(() => 1.0),
          };

      // If group has fewer notes than pattern, use even spacing for leftover
      const useEvenSpacing = group.length < noteCount && !this.figure.flexible;

      let cumulativeTime = 0;
      for (let i = 0; i < group.length; i++) {
        const { step, pitch, note } = group[i];

        let newStep: number;
        let velocityMultiplier: number;

        if (useEvenSpacing) {
          // Leftover group: even spacing
          newStep = groupStartStep + (stepsPerGroup * i) / group.length;
          velocityMultiplier = 1.0;
        } else {
          // Apply figure pattern
          newStep = groupStartStep + cumulativeTime * stepsPerGroup;
          velocityMultiplier = accents[i] ?? 1.0;
          cumulativeTime += timing[i] ?? 1.0 / group.length;
        }

        // Snap to valid substep position
        newStep = snapToSubstep(newStep);

        // Calculate new velocity with accent
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
          originalPitch: note.originalPitch ?? pitch,
        });
      }

      groupStartStep += stepsPerGroup;
    }

    // Remove all affected notes first
    for (const { oldStep, pitch } of this.originalNotes) {
      this.sequence.removeNote(oldStep, pitch);
    }

    // Add notes at new positions with new velocities
    for (const moved of this.originalNotes) {
      this.sequence.addNote(
        moved.newStep,
        moved.pitch,
        moved.newVelocity,
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
    for (const { newStep, pitch } of this.originalNotes) {
      this.sequence.removeNote(newStep, pitch);
    }

    // Restore notes at original positions with original velocities
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
