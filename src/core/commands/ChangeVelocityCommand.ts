import type { Command } from './Command';
import type { Sequence } from '../Sequence';
import { MIN_VELOCITY, MAX_VELOCITY } from '@/config/GridConfig';

/**
 * Command to change velocity of one or more notes
 * Uses delta-based adjustment for multi-note editing
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
      this.sequence.updateNote(step, pitch, { velocity: newVelocity });
    }
  }

  undo(): void {
    for (const { step, pitch, oldVelocity } of this.notes) {
      this.sequence.updateNote(step, pitch, { velocity: oldVelocity });
    }
  }
}
