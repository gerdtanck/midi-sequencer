import type { Command } from './Command';
import type { Sequence } from '../Sequence';
import { MIN_VELOCITY, MAX_VELOCITY } from '@/config/GridConfig';

/**
 * Command to change velocity of one or more notes
 * Uses delta-based adjustment for multi-note editing
 * For CC events (notes with cc field), also updates cc.value to stay in sync
 */
export class ChangeVelocityCommand implements Command {
  readonly description = 'Change velocity';

  private sequence: Sequence;
  private notes: Array<{ step: number; pitch: number; oldVelocity: number }>;
  private deltaVelocity: number;

  constructor(
    sequence: Sequence,
    notes: Array<{ step: number; pitch: number; oldVelocity: number }>,
    deltaVelocity: number
  ) {
    this.sequence = sequence;
    this.notes = notes;
    this.deltaVelocity = deltaVelocity;
  }

  execute(): void {
    for (const { step, pitch, oldVelocity } of this.notes) {
      const newVelocity = Math.max(
        MIN_VELOCITY,
        Math.min(MAX_VELOCITY, oldVelocity + this.deltaVelocity)
      );
      // Update velocity (and sync cc.value for CC events)
      this.applyVelocity(step, pitch, newVelocity);
    }
  }

  undo(): void {
    for (const { step, pitch, oldVelocity } of this.notes) {
      this.applyVelocity(step, pitch, oldVelocity);
    }
  }

  private applyVelocity(step: number, pitch: number, velocity: number): void {
    // Pre-set cc.value before updateNote so the change notification is consistent
    const note = this.sequence.getNoteAt(step, pitch);
    if (note?.cc) {
      note.cc.value = velocity;
    }
    this.sequence.updateNote(step, pitch, { velocity });
  }
}
