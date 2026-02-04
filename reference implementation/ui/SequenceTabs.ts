import type { Sequence } from '../sequencer/Sequence';

/**
 * UI component for sequence tab navigation
 *
 * Displays 4 tabs representing the 4 parallel sequences,
 * showing sequence number and MIDI channel for each.
 */
export class SequenceTabs {
  private container: HTMLElement;
  private sequences: Sequence[];
  private currentIndex: number = 0;
  private callback: (index: number) => void;
  private tabsContainer: HTMLElement | null = null;
  private tabButtons: HTMLButtonElement[] = [];

  /**
   * @param container Parent element to render tabs into
   * @param sequences Array of 4 Sequence instances
   * @param onTabChange Callback fired when user clicks a tab
   */
  constructor(container: HTMLElement, sequences: Sequence[], onTabChange: (index: number) => void) {
    this.container = container;
    this.sequences = sequences;
    this.callback = onTabChange;
  }

  /**
   * Render the tab navigation
   */
  render(): void {
    // Create tabs container
    this.tabsContainer = document.createElement('div');
    this.tabsContainer.className = 'sequence-tabs';

    // Clear previous buttons
    this.tabButtons = [];

    // Create tab for each sequence
    this.sequences.forEach((sequence, index) => {
      const button = this.createTab(sequence, index);
      this.tabButtons.push(button);
      this.tabsContainer!.appendChild(button);
    });

    // Replace container contents
    this.container.innerHTML = '';
    this.container.appendChild(this.tabsContainer);
  }

  /**
   * Create a single tab button
   * @param sequence Sequence instance for this tab
   * @param index Tab index (0-3)
   * @returns Button element configured for this tab
   */
  private createTab(sequence: Sequence, index: number): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'tab-button';
    button.type = 'button';

    // Mark active tab
    if (index === this.currentIndex) {
      button.classList.add('active');
    }

    // Format: "1 (Ch 1)" - user-facing numbers are 1-based
    const sequenceNumber = index + 1;
    const midiChannel = sequence.getMidiChannel() + 1; // Display as 1-16
    button.textContent = `${sequenceNumber} (Ch ${midiChannel})`;

    // Attach click handler
    button.addEventListener('click', () => this.handleTabClick(index));

    return button;
  }

  /**
   * Handle tab click
   * @param index Tab index that was clicked
   */
  private handleTabClick(index: number): void {
    // Update current index
    this.currentIndex = index;

    // Re-render to update active state
    this.render();

    // Fire callback
    this.callback(index);
  }

  /**
   * Programmatically set active tab
   * @param index Tab index to activate (0-3)
   */
  setActiveTab(index: number): void {
    if (index < 0 || index >= this.sequences.length) {
      console.warn(`Invalid tab index: ${index}`);
      return;
    }

    this.currentIndex = index;
    this.render();
  }

  /**
   * Get current active tab index
   * @returns Current tab index (0-3)
   */
  getActiveTab(): number {
    return this.currentIndex;
  }

  /**
   * Update tab labels (e.g., after MIDI channel changes)
   */
  updateLabels(): void {
    this.tabButtons.forEach((button, index) => {
      const sequence = this.sequences[index];
      const sequenceNumber = index + 1;
      const midiChannel = sequence.getMidiChannel() + 1;
      button.textContent = `${sequenceNumber} (Ch ${midiChannel})`;
    });
  }

  /**
   * Clean up event listeners and DOM elements
   */
  destroy(): void {
    if (this.tabsContainer) {
      this.tabsContainer.remove();
    }
    this.tabButtons = [];
    this.tabsContainer = null;
  }
}
