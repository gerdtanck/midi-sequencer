import type { Command } from './Command';
import type { Sequence } from '../Sequence';
import type { SelectionManager } from '../SelectionManager';

/**
 * Command to paste (copy) notes to a new location
 */
export class PasteNotesCommand implements Command {
  readonly description: string;

  private sequence: Sequence;
  private selectionManager: SelectionManager | null;
  private sourceNotes: Array<{ step: number; pitch: number }>;
  private targetStep: number;
  private targetPitch: number;

  // Store created notes for undo
  private createdNotes: Array<{ step: number; pitch: number }> = [];
  // Store original selection for undo
  private originalSelection: Array<{ step: number; pitch: number }> = [];

  constructor(
    sequence: Sequence,
    selectionManager: SelectionManager | null,
    sourceNotes: Array<{ step: number; pitch: number }>,
    targetStep: number,
    targetPitch: number
  ) {
    this.sequence = sequence;
    this.selectionManager = selectionManager;
    this.sourceNotes = [...sourceNotes];
    this.targetStep = targetStep;
    this.targetPitch = targetPitch;

    const count = sourceNotes.length;
    this.description = count === 1 ? 'Paste note' : `Paste ${count} notes`;
  }

  execute(): void {
    // Store original selection for undo
    if (this.selectionManager) {
      this.originalSelection = this.selectionManager.getSelectedNotes();
    }

    // Copy notes to target position
    this.createdNotes = this.sequence.copyNotes(
      this.sourceNotes,
      this.targetStep,
      this.targetPitch
    );

    // Update selection to the pasted notes
    if (this.selectionManager && this.createdNotes.length > 0) {
      this.selectionManager.setSelection(this.createdNotes);
    }
  }

  undo(): void {
    // Remove all created notes
    for (const { step, pitch } of this.createdNotes) {
      this.sequence.removeNote(step, pitch);
    }

    // Restore original selection
    if (this.selectionManager) {
      this.selectionManager.setSelection(this.originalSelection);
    }
  }
}
