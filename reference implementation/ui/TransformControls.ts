/**
 * Transform controls component
 *
 * Provides buttons for sequence transformation operations:
 * - Nudge (shift forward/backward)
 * - Transpose (pitch up/down)
 * - Reverse
 * - Randomize (pitch, timing, velocity)
 * - Swap pitches
 * - Apply rhythm pattern
 */
export class TransformControls {
  private container: HTMLElement;

  /** Callbacks for transformation operations */
  private onNudgeLeft: (() => void) | null = null;
  private onNudgeRight: (() => void) | null = null;
  private onTransposeUp: (() => void) | null = null;
  private onTransposeDown: (() => void) | null = null;
  private onReverse: (() => void) | null = null;
  private onRandomizePitch: (() => void) | null = null;
  private onRandomizeLength: (() => void) | null = null;
  private onRandomizeTiming: (() => void) | null = null;
  private onRandomizeVelocity: (() => void) | null = null;
  private onClear: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /**
   * Set callbacks for transform operations
   */
  setCallbacks(callbacks: {
    onNudgeLeft?: () => void;
    onNudgeRight?: () => void;
    onTransposeUp?: () => void;
    onTransposeDown?: () => void;
    onReverse?: () => void;
    onRandomizePitch?: () => void;
    onRandomizeLength?: () => void;
    onRandomizeTiming?: () => void;
    onRandomizeVelocity?: () => void;
    onClear?: () => void;
  }): void {
    this.onNudgeLeft = callbacks.onNudgeLeft || null;
    this.onNudgeRight = callbacks.onNudgeRight || null;
    this.onTransposeUp = callbacks.onTransposeUp || null;
    this.onTransposeDown = callbacks.onTransposeDown || null;
    this.onReverse = callbacks.onReverse || null;
    this.onRandomizePitch = callbacks.onRandomizePitch || null;
    this.onRandomizeLength = callbacks.onRandomizeLength || null;
    this.onRandomizeTiming = callbacks.onRandomizeTiming || null;
    this.onRandomizeVelocity = callbacks.onRandomizeVelocity || null;
    this.onClear = callbacks.onClear || null;
  }

  /**
   * Render the transform controls
   */
  render(): void {
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'transform-controls';

    // Clear button (leftmost)
    const clearBtn = this.createButton('Clear', () => this.onClear?.());
    controlsContainer.appendChild(clearBtn);

    // Nudge group
    const nudgeGroup = this.createGroup('Nudge', [
      { label: '←', action: () => this.onNudgeLeft?.() },
      { label: '→', action: () => this.onNudgeRight?.() }
    ]);
    controlsContainer.appendChild(nudgeGroup);

    // Transpose group
    const transposeGroup = this.createGroup('Transpose', [
      { label: '↓', action: () => this.onTransposeDown?.() },
      { label: '↑', action: () => this.onTransposeUp?.() }
    ]);
    controlsContainer.appendChild(transposeGroup);

    // Reverse button
    const reverseBtn = this.createButton('↔ Reverse', () => this.onReverse?.());
    controlsContainer.appendChild(reverseBtn);

    // Randomize group
    const randomizeGroup = this.createGroup('Randomize', [
      { label: 'Pitch', action: () => this.onRandomizePitch?.() },
      { label: 'Length', action: () => this.onRandomizeLength?.() },
      { label: 'Pos', action: () => this.onRandomizeTiming?.() },
      { label: 'Vel', action: () => this.onRandomizeVelocity?.() }
    ]);
    controlsContainer.appendChild(randomizeGroup);

    this.container.appendChild(controlsContainer);
  }

  /**
   * Create a labeled group of buttons
   */
  private createGroup(label: string, buttons: { label: string; action: () => void }[]): HTMLElement {
    const group = document.createElement('div');
    group.className = 'transform-group';

    const labelElement = document.createElement('span');
    labelElement.className = 'transform-label';
    labelElement.textContent = label + ':';
    group.appendChild(labelElement);

    buttons.forEach(btn => {
      const button = this.createButton(btn.label, btn.action);
      group.appendChild(button);
    });

    return group;
  }

  /**
   * Create a transform button
   */
  private createButton(label: string, action: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'transform-button';
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', action);
    return button;
  }

  /**
   * Clean up
   */
  destroy(): void {
    this.container.innerHTML = '';
  }
}
