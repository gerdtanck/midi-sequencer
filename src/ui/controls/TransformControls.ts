import type { NoteGrid } from '../grid/NoteGrid';
import {
  TransformTarget,
  NudgeNotesCommand,
  TransposeNotesCommand,
  ReverseNotesCommand,
  RandomizeCommand,
  RandomizeProperty,
  QuantizeCommand,
  ClearSequenceCommand,
} from '@/core/commands/TransformCommands';

/**
 * TransformControls - UI component for note transformation operations
 *
 * Provides:
 * - Target dropdown (All / Selected / Loop)
 * - Nudge left/right buttons
 * - Transpose up/down buttons
 * - Reverse button
 * - Randomize dropdown (Velocity / Timing / Pitch)
 * - Clear button
 */
export class TransformControls {
  private container: HTMLElement;
  private noteGrid: NoteGrid;

  // UI elements
  private targetSelect: HTMLSelectElement | null = null;
  private nudgeLeftBtn: HTMLButtonElement | null = null;
  private nudgeRightBtn: HTMLButtonElement | null = null;
  private transposeUpBtn: HTMLButtonElement | null = null;
  private transposeDownBtn: HTMLButtonElement | null = null;
  private reverseBtn: HTMLButtonElement | null = null;
  private quantizeBtn: HTMLButtonElement | null = null;
  private randomizeSelect: HTMLSelectElement | null = null;
  private randomizeBtn: HTMLButtonElement | null = null;
  private clearBtn: HTMLButtonElement | null = null;

  constructor(container: HTMLElement, noteGrid: NoteGrid) {
    this.container = container;
    this.noteGrid = noteGrid;
  }

  /**
   * Render the transform controls
   */
  render(): void {
    this.container.innerHTML = '';

    // Main section
    const section = document.createElement('div');
    section.className = 'control-group';

    // Header
    const label = document.createElement('label');
    label.textContent = 'Transform';
    section.appendChild(label);

    // Target row
    const targetRow = document.createElement('div');
    targetRow.className = 'transform-target-row';

    const targetLabel = document.createElement('span');
    targetLabel.className = 'transform-label';
    targetLabel.textContent = 'Target:';
    targetRow.appendChild(targetLabel);

    this.targetSelect = document.createElement('select');
    this.targetSelect.className = 'transform-select';
    this.targetSelect.title = 'Target Scope';

    const targets: Array<{ value: TransformTarget; label: string }> = [
      { value: 'all', label: 'All' },
      { value: 'selected', label: 'Selected' },
      { value: 'loop', label: 'Loop' },
    ];

    for (const { value, label } of targets) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      this.targetSelect.appendChild(option);
    }

    // Update button states when target changes
    this.targetSelect.addEventListener('change', () => this.updateButtonStates());

    targetRow.appendChild(this.targetSelect);
    section.appendChild(targetRow);

    // Nudge row
    const nudgeRow = document.createElement('div');
    nudgeRow.className = 'transform-btn-row';

    this.nudgeLeftBtn = this.createButton('←', 'Nudge left', () => this.nudge(-1));
    this.nudgeRightBtn = this.createButton('→', 'Nudge right', () => this.nudge(1));

    const nudgeGroup = document.createElement('div');
    nudgeGroup.className = 'transform-btn-group';
    nudgeGroup.appendChild(this.nudgeLeftBtn);
    const nudgeLabel = document.createElement('span');
    nudgeLabel.className = 'transform-btn-label';
    nudgeLabel.textContent = 'Nudge';
    nudgeGroup.appendChild(nudgeLabel);
    nudgeGroup.appendChild(this.nudgeRightBtn);
    nudgeRow.appendChild(nudgeGroup);

    // Transpose group
    this.transposeDownBtn = this.createButton('↓', 'Transpose down', () => this.transpose(-1));
    this.transposeUpBtn = this.createButton('↑', 'Transpose up', () => this.transpose(1));

    const transposeGroup = document.createElement('div');
    transposeGroup.className = 'transform-btn-group';
    transposeGroup.appendChild(this.transposeDownBtn);
    const transposeLabel = document.createElement('span');
    transposeLabel.className = 'transform-btn-label';
    transposeLabel.textContent = 'Transpose';
    transposeGroup.appendChild(transposeLabel);
    transposeGroup.appendChild(this.transposeUpBtn);
    nudgeRow.appendChild(transposeGroup);

    section.appendChild(nudgeRow);

    // Reverse and Randomize row
    const actionRow = document.createElement('div');
    actionRow.className = 'transform-btn-row';

    this.reverseBtn = this.createButton('⇄', 'Reverse', () => this.reverse());
    this.reverseBtn.className = 'transform-btn transform-btn-wide';
    const reverseText = document.createElement('span');
    reverseText.textContent = ' Reverse';
    this.reverseBtn.appendChild(reverseText);
    actionRow.appendChild(this.reverseBtn);

    this.quantizeBtn = this.createButton('⊞', 'Quantize', () => this.quantize());
    this.quantizeBtn.className = 'transform-btn transform-btn-wide';
    const quantizeText = document.createElement('span');
    quantizeText.textContent = ' Quantize';
    this.quantizeBtn.appendChild(quantizeText);
    actionRow.appendChild(this.quantizeBtn);

    // Randomize with dropdown
    const randomizeGroup = document.createElement('div');
    randomizeGroup.className = 'transform-randomize-group';

    this.randomizeSelect = document.createElement('select');
    this.randomizeSelect.className = 'transform-randomize-select';
    this.randomizeSelect.title = 'Randomize Property';

    const randomizeOptions: Array<{ value: RandomizeProperty; label: string }> = [
      { value: 'velocity', label: 'Velocity' },
      { value: 'timing', label: 'Timing' },
      { value: 'step', label: 'Step' },
      { value: 'pitch', label: 'Pitch' },
      { value: 'permute', label: 'Permute' },
    ];

    for (const { value, label } of randomizeOptions) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      this.randomizeSelect.appendChild(option);
    }

    this.randomizeBtn = this.createButton('🎲', 'Randomize', () => this.randomize());
    this.randomizeBtn.className = 'transform-btn';

    randomizeGroup.appendChild(this.randomizeSelect);
    randomizeGroup.appendChild(this.randomizeBtn);
    actionRow.appendChild(randomizeGroup);

    section.appendChild(actionRow);

    // Clear row
    const clearRow = document.createElement('div');
    clearRow.className = 'transform-btn-row';

    this.clearBtn = this.createButton('🗑', 'Clear notes', () => this.clear());
    this.clearBtn.className = 'transform-btn transform-btn-danger transform-btn-full';
    const clearText = document.createElement('span');
    clearText.textContent = ' Clear';
    this.clearBtn.appendChild(clearText);
    clearRow.appendChild(this.clearBtn);

    section.appendChild(clearRow);

    this.container.appendChild(section);

    // Add styles
    this.addStyles();

    // Subscribe to selection changes to update button states
    const selectionManager = this.noteGrid.getSelectionManager();
    if (selectionManager) {
      selectionManager.onChange(() => this.updateButtonStates());
    }

    // Subscribe to sequence changes to update button states when notes are added/removed
    const sequence = this.noteGrid.getSequence();
    if (sequence) {
      sequence.onChange(() => this.updateButtonStates());
    }

    // Initial button state update
    this.updateButtonStates();
  }

  /**
   * Create a transform button
   */
  private createButton(
    icon: string,
    title: string,
    onClick: () => void
  ): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'transform-btn';
    btn.textContent = icon;
    btn.title = title;
    btn.addEventListener('click', onClick);
    return btn;
  }

  /**
   * Get current target scope
   */
  private getTarget(): TransformTarget {
    return (this.targetSelect?.value as TransformTarget) || 'all';
  }

  /**
   * Update button states based on selection and notes
   */
  private updateButtonStates(): void {
    const sequence = this.noteGrid.getSequence();
    const selectionManager = this.noteGrid.getSelectionManager();
    const target = this.getTarget();

    const hasNotes = sequence && sequence.getNoteCount() > 0;
    const hasSelection = selectionManager && selectionManager.hasSelection;

    // Disable buttons when target is 'selected' but nothing is selected
    const isTargetValid = target !== 'selected' || hasSelection;

    const buttons = [
      this.nudgeLeftBtn,
      this.nudgeRightBtn,
      this.transposeUpBtn,
      this.transposeDownBtn,
      this.reverseBtn,
      this.quantizeBtn,
      this.randomizeBtn,
    ];

    for (const btn of buttons) {
      if (btn) {
        btn.disabled = !hasNotes || !isTargetValid;
      }
    }

    // Clear button is always enabled if there are notes in the target scope
    if (this.clearBtn) {
      this.clearBtn.disabled = !hasNotes || !isTargetValid;
    }
  }

  /**
   * Nudge notes left or right
   */
  nudge(deltaStep: number): void {
    const sequence = this.noteGrid.getSequence();
    const selectionManager = this.noteGrid.getSelectionManager();
    if (!sequence) return;

    const command = new NudgeNotesCommand(
      sequence,
      selectionManager,
      this.getTarget(),
      deltaStep
    );

    this.noteGrid.getCommandHistory().execute(command);
    this.noteGrid.forceRender();
  }

  /**
   * Transpose notes up or down
   */
  transpose(deltaPitch: number): void {
    const sequence = this.noteGrid.getSequence();
    const selectionManager = this.noteGrid.getSelectionManager();
    const scaleManager = this.noteGrid.getScaleManager();
    if (!sequence) return;

    const command = new TransposeNotesCommand(
      sequence,
      selectionManager,
      this.getTarget(),
      deltaPitch,
      scaleManager
    );

    this.noteGrid.getCommandHistory().execute(command);
    this.noteGrid.forceRender();
  }

  /**
   * Reverse notes
   */
  private reverse(): void {
    const sequence = this.noteGrid.getSequence();
    const selectionManager = this.noteGrid.getSelectionManager();
    if (!sequence) return;

    const command = new ReverseNotesCommand(
      sequence,
      selectionManager,
      this.getTarget()
    );

    this.noteGrid.getCommandHistory().execute(command);
    this.noteGrid.forceRender();
  }

  /**
   * Quantize notes to grid positions
   */
  private quantize(): void {
    const sequence = this.noteGrid.getSequence();
    const selectionManager = this.noteGrid.getSelectionManager();
    if (!sequence) return;

    const command = new QuantizeCommand(
      sequence,
      selectionManager,
      this.getTarget()
    );

    this.noteGrid.getCommandHistory().execute(command);
    this.noteGrid.forceRender();
  }

  /**
   * Randomize notes
   */
  private randomize(): void {
    const sequence = this.noteGrid.getSequence();
    const selectionManager = this.noteGrid.getSelectionManager();
    const scaleManager = this.noteGrid.getScaleManager();
    if (!sequence) return;

    const property = (this.randomizeSelect?.value as RandomizeProperty) || 'velocity';

    const command = new RandomizeCommand(
      sequence,
      selectionManager,
      this.getTarget(),
      property,
      scaleManager
    );

    this.noteGrid.getCommandHistory().execute(command);
    this.noteGrid.forceRender();
  }

  /**
   * Clear notes
   */
  private clear(): void {
    const sequence = this.noteGrid.getSequence();
    const selectionManager = this.noteGrid.getSelectionManager();
    if (!sequence) return;

    const command = new ClearSequenceCommand(
      sequence,
      selectionManager,
      this.getTarget()
    );

    this.noteGrid.getCommandHistory().execute(command);
    this.noteGrid.forceRender();
  }

  /**
   * Add component-specific styles
   */
  private addStyles(): void {
    // Only add styles once
    if (document.getElementById('transform-controls-styles')) return;

    const style = document.createElement('style');
    style.id = 'transform-controls-styles';
    style.textContent = `
      .transform-target-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }

      .transform-label {
        font-size: 0.8rem;
        color: var(--control-text);
      }

      .transform-select {
        flex: 1;
        padding: 6px 8px;
        font-size: 0.85rem;
        background-color: var(--grid-background);
        border: 1px solid var(--control-border);
        border-radius: 4px;
        color: var(--control-text);
        cursor: pointer;
        outline: none;
      }

      .transform-select:focus {
        border-color: var(--control-accent);
      }

      .transform-select option {
        background-color: var(--grid-background);
        color: var(--control-text);
      }

      .transform-btn-row {
        display: flex;
        gap: 8px;
        margin-bottom: 8px;
      }

      .transform-btn-group {
        display: flex;
        align-items: center;
        gap: 4px;
        flex: 1;
      }

      .transform-btn-label {
        font-size: 0.75rem;
        color: var(--control-text);
        white-space: nowrap;
      }

      .transform-btn {
        padding: 6px 10px;
        font-size: 0.9rem;
        background-color: var(--grid-background);
        border: 1px solid var(--control-border);
        border-radius: 4px;
        color: var(--control-text);
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .transform-btn:hover:not(:disabled) {
        background-color: var(--control-border);
      }

      .transform-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .transform-btn-wide {
        flex: 1;
      }

      .transform-btn-full {
        width: 100%;
      }

      .transform-btn-danger {
        background-color: rgba(255, 68, 68, 0.2);
        border-color: #ff4444;
      }

      .transform-btn-danger:hover:not(:disabled) {
        background-color: rgba(255, 68, 68, 0.4);
      }

      .transform-randomize-group {
        display: flex;
        gap: 4px;
        flex: 1;
      }

      .transform-randomize-select {
        flex: 1;
        padding: 6px 8px;
        font-size: 0.8rem;
        background-color: var(--grid-background);
        border: 1px solid var(--control-border);
        border-radius: 4px;
        color: var(--control-text);
        cursor: pointer;
        outline: none;
      }

      .transform-randomize-select:focus {
        border-color: var(--control-accent);
      }

      .transform-randomize-select option {
        background-color: var(--grid-background);
        color: var(--control-text);
      }

      /* Responsive adjustments */
      @media (max-width: 600px) {
        .transform-btn-row {
          flex-wrap: wrap;
        }

        .transform-btn-group {
          min-width: 45%;
        }

        .transform-randomize-group {
          min-width: 100%;
        }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Clean up
   */
  dispose(): void {
    this.container.innerHTML = '';
  }
}
