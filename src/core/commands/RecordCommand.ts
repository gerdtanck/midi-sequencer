import type { Command } from './Command';
import type { Sequence } from '../Sequence';

/**
 * Undoable command for recorded MIDI data.
 * Events are added to the sequence in real-time during recording.
 * Push via pushWithoutExecute() since data is already in the sequence.
 * execute() re-adds for redo; undo() removes everything.
 */
export class RecordCommand implements Command {
  readonly description = 'Record MIDI';

  constructor(
    private sequence: Sequence,
    private recordedNotes: Array<{ step: number; pitch: number; velocity: number; duration: number }>,
    private recordedCC: Array<{ step: number; pitch: number; controller: number; value: number }>
  ) {}

  execute(): void {
    for (const n of this.recordedNotes) {
      this.sequence.addNote(n.step, n.pitch, n.velocity, n.duration);
    }
    for (const cc of this.recordedCC) {
      this.sequence.addNote(cc.step, cc.pitch, cc.value, 1, undefined, {
        controller: cc.controller,
        value: cc.value,
      });
    }
  }

  undo(): void {
    for (const n of this.recordedNotes) {
      this.sequence.removeNote(n.step, n.pitch);
    }
    for (const cc of this.recordedCC) {
      this.sequence.removeNote(cc.step, cc.pitch);
    }
  }
}
