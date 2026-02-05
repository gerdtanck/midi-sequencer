import type { Command } from './Command';
import type { Sequence } from '../Sequence';
import type { SelectionManager } from '../SelectionManager';
import type { ScaleManager } from '../ScaleManager';

/**
 * Command to move one or more notes by a delta
 * When snap-to-scale is enabled, notes are snapped after moving
 */
export class MoveNotesCommand implements Command {
  readonly description: string;

  private sequence: Sequence;
  private selectionManager: SelectionManager | null;
  private scaleManager: ScaleManager | null;
  private notes: Array<{ step: number; pitch: number }>;
  private deltaStep: number;
  private deltaPitch: number;

  // Store complete state for accurate undo
  private movedNotes: Array<{
    oldStep: number;
    oldPitch: number;
    oldOriginalPitch: number;
    newStep: number;
    newPitch: number;
    newOriginalPitch: number;
  }> = [];

  constructor(
    sequence: Sequence,
    selectionManager: SelectionManager | null,
    notes: Array<{ step: number; pitch: number }>,
    deltaStep: number,
    deltaPitch: number,
    scaleManager?: ScaleManager | null
  ) {
    this.sequence = sequence;
    this.selectionManager = selectionManager;
    this.scaleManager = scaleManager ?? null;
    this.notes = [...notes];
    this.deltaStep = deltaStep;
    this.deltaPitch = deltaPitch;

    const count = notes.length;
    this.description = count === 1 ? 'Move note' : `Move ${count} notes`;
  }

  execute(): void {
    this.movedNotes = [];

    for (const { step, pitch } of this.notes) {
      const note = this.sequence.getNoteAt(step, pitch);
      if (!note) continue;

      const oldOriginalPitch = note.originalPitch ?? pitch;

      // Update original pitch by delta (user's new intention)
      const newOriginalPitch = oldOriginalPitch + this.deltaPitch;

      // Calculate actual pitch (snapped if enabled)
      let newPitch: number;
      if (this.scaleManager?.snapEnabled && !this.scaleManager.isChromatic()) {
        newPitch = this.scaleManager.snapToScale(newOriginalPitch);
      } else {
        newPitch = newOriginalPitch;
      }

      const newStep = step + this.deltaStep;

      // Store state for undo
      this.movedNotes.push({
        oldStep: step,
        oldPitch: pitch,
        oldOriginalPitch,
        newStep,
        newPitch,
        newOriginalPitch,
      });
    }

    // Perform the actual moves
    for (const moved of this.movedNotes) {
      // Remove from old position
      const note = this.sequence.getNoteAt(moved.oldStep, moved.oldPitch);
      if (!note) continue;

      this.sequence.removeNote(moved.oldStep, moved.oldPitch);

      // Add at new position with updated originalPitch
      this.sequence.addNote(
        moved.newStep,
        moved.newPitch,
        note.velocity,
        note.duration,
        moved.newOriginalPitch
      );

      // Update selection
      if (this.selectionManager) {
        this.selectionManager.moveNote(moved.oldStep, moved.oldPitch, moved.newStep, moved.newPitch);
      }
    }
  }

  undo(): void {
    // Restore notes to their original positions
    for (const moved of this.movedNotes) {
      const note = this.sequence.getNoteAt(moved.newStep, moved.newPitch);
      if (!note) continue;

      this.sequence.removeNote(moved.newStep, moved.newPitch);

      // Restore at old position with old originalPitch
      this.sequence.addNote(
        moved.oldStep,
        moved.oldPitch,
        note.velocity,
        note.duration,
        moved.oldOriginalPitch
      );

      // Update selection back
      if (this.selectionManager) {
        this.selectionManager.moveNote(moved.newStep, moved.newPitch, moved.oldStep, moved.oldPitch);
      }
    }
  }
}
