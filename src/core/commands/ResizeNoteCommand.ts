import type { Command } from './Command';
import type { Sequence } from '../Sequence';

/**
 * Command to resize a note's duration
 */
export class ResizeNoteCommand implements Command {
  readonly description = 'Resize note';

  private sequence: Sequence;
  private step: number;
  private pitch: number;
  private oldDuration: number;
  private newDuration: number;

  constructor(
    sequence: Sequence,
    step: number,
    pitch: number,
    oldDuration: number,
    newDuration: number
  ) {
    this.sequence = sequence;
    this.step = step;
    this.pitch = pitch;
    this.oldDuration = oldDuration;
    this.newDuration = newDuration;
  }

  execute(): void {
    this.sequence.updateNote(this.step, this.pitch, { duration: this.newDuration });
  }

  undo(): void {
    this.sequence.updateNote(this.step, this.pitch, { duration: this.oldDuration });
  }
}
