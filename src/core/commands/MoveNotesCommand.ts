import type { Command } from './Command';
import type { Sequence } from '../Sequence';
import type { SelectionManager } from '../SelectionManager';

/**
 * Command to move one or more notes by a delta
 */
export class MoveNotesCommand implements Command {
  readonly description: string;

  private sequence: Sequence;
  private selectionManager: SelectionManager | null;
  private notes: Array<{ step: number; pitch: number }>;
  private deltaStep: number;
  private deltaPitch: number;

  // Store the actual moved result for accurate undo
  private movedNotes: Array<{
    oldStep: number;
    oldPitch: number;
    newStep: number;
    newPitch: number;
  }> = [];

  constructor(
    sequence: Sequence,
    selectionManager: SelectionManager | null,
    notes: Array<{ step: number; pitch: number }>,
    deltaStep: number,
    deltaPitch: number
  ) {
    this.sequence = sequence;
    this.selectionManager = selectionManager;
    this.notes = [...notes];
    this.deltaStep = deltaStep;
    this.deltaPitch = deltaPitch;

    const count = notes.length;
    this.description = count === 1 ? 'Move note' : `Move ${count} notes`;
  }

  execute(): void {
    // Move notes and capture the result
    this.movedNotes = this.sequence.moveNotes(this.notes, this.deltaStep, this.deltaPitch);

    // Update selection to track moved notes
    if (this.selectionManager) {
      for (const { oldStep, oldPitch, newStep, newPitch } of this.movedNotes) {
        this.selectionManager.moveNote(oldStep, oldPitch, newStep, newPitch);
      }
    }
  }

  undo(): void {
    // Move notes back (reverse the deltas)
    const notesToMoveBack = this.movedNotes.map(({ newStep, newPitch }) => ({
      step: newStep,
      pitch: newPitch,
    }));

    const movedBack = this.sequence.moveNotes(notesToMoveBack, -this.deltaStep, -this.deltaPitch);

    // Update selection to track moved notes back
    if (this.selectionManager) {
      for (const { oldStep, oldPitch, newStep, newPitch } of movedBack) {
        this.selectionManager.moveNote(oldStep, oldPitch, newStep, newPitch);
      }
    }
  }
}
