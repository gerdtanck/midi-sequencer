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
 * Helper to resolve which notes to operate on based on target
 */
function resolveTargetNotes(
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
export type RandomizeProperty = 'velocity' | 'timing' | 'pitch' | 'permute' | 'step';

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
      } else if (this.property === 'step') {
        // Preserve substep offset, randomize whole step position
        const wholeStep = Math.floor(step);
        const substepOffset = step - wholeStep;

        // Random whole step within range
        const rangeSize = stepRangeMax - stepRangeMin;
        if (rangeSize > 0) {
          const newWholeStep = stepRangeMin + Math.floor(Math.random() * rangeSize);
          entry.newStep = newWholeStep + substepOffset;
        }
      }

      this.originalNotes.push(entry);
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
