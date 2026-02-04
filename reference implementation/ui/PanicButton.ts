import type { MidiManager } from '../midi/MidiManager';

/**
 * Emergency panic button UI component
 */
export class PanicButton {
  private container: HTMLElement;
  private midiManager: MidiManager;
  private buttonElement: HTMLButtonElement | null = null;

  constructor(midiManager: MidiManager, container: HTMLElement) {
    this.midiManager = midiManager;
    this.container = container;
  }

  /**
   * Render the panic button
   */
  render(): void {
    this.container.innerHTML = '';

    // Create panic button
    const button = document.createElement('button');
    button.className = 'panic-button';
    button.textContent = 'PANIC';
    button.title = 'Stop all MIDI output immediately';

    // Add click handler
    button.addEventListener('click', () => {
      this.handleClick();
    });

    this.buttonElement = button;
    this.container.appendChild(button);
  }

  /**
   * Handle panic button click
   */
  private handleClick(): void {
    if (!this.buttonElement) return;

    // Execute panic
    this.midiManager.panic();

    // Visual feedback: flash animation
    this.buttonElement.classList.add('panic-button--flash');
    setTimeout(() => {
      this.buttonElement?.classList.remove('panic-button--flash');
    }, 200);
  }
}
