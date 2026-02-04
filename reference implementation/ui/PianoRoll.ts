import { NOTE_NAMES, type ScaleDefinition } from '../music/Scale';

/**
 * Visual piano roll component
 *
 * Displays a 2-octave piano keyboard (24 keys) vertically on the left side of the grid.
 * Highlights in-scale notes based on current scale and root note selection.
 * Clicking a key plays the note for auditioning.
 */
export class PianoRoll {
  private container: HTMLElement;
  private baseMidiNote: number;
  private numKeys: number;
  private keyHeight: number;
  private gridGap: number;
  private zoomLevel: number = 1.0;

  /** Callback when a key is clicked (to play note) */
  private onKeyClick: ((midiNote: number) => void) | null = null;

  /** DOM elements */
  private keys: Map<number, HTMLElement> = new Map();
  private pianoContainer: HTMLElement | null = null;

  /**
   * Create piano roll
   * @param container Container element
   * @param baseMidiNote Starting MIDI note (e.g., 60 for C4)
   * @param numKeys Number of keys (24 for 2 octaves)
   * @param keyHeight Height of each key in pixels
   * @param gridGap Gap between keys in pixels
   */
  constructor(
    container: HTMLElement,
    baseMidiNote: number,
    numKeys: number,
    keyHeight: number,
    gridGap: number
  ) {
    this.container = container;
    this.baseMidiNote = baseMidiNote;
    this.numKeys = numKeys;
    this.keyHeight = keyHeight;
    this.gridGap = gridGap;
  }

  /**
   * Set callback for key clicks
   * @param callback Function to call when key is clicked
   */
  setOnKeyClick(callback: (midiNote: number) => void): void {
    this.onKeyClick = callback;
  }

  /**
   * Update scale and root note (no visual highlighting on piano)
   * @param rootNote Root note (0-11, where 0=C)
   * @param scale Scale definition
   */
  setScale(_rootNote: number, _scale: ScaleDefinition): void {
    // No visual highlighting on piano keys - parameters intentionally unused
  }

  /**
   * Update piano roll scale to match zoom level
   *
   * Scales key heights and gaps so they align with grid rows at any zoom level.
   * Call this whenever the grid zoom changes.
   *
   * @param zoom New zoom level (0.5× to 4×)
   */
  updateScale(zoom: number): void {
    this.zoomLevel = zoom;

    // Calculate scaled dimensions
    const scaledHeight = this.keyHeight * zoom;
    const scaledGap = this.gridGap * zoom;

    // Update piano container gap
    if (this.pianoContainer) {
      this.pianoContainer.style.gap = `${scaledGap}px`;
    }

    // Update all piano keys
    this.keys.forEach(key => {
      key.style.height = `${scaledHeight}px`;
    });
  }

  /**
   * Render the piano roll
   */
  render(): void {
    this.container.innerHTML = '';
    this.keys.clear();

    // Create piano container
    const pianoContainer = document.createElement('div');
    pianoContainer.className = 'piano-roll';
    this.pianoContainer = pianoContainer; // Store reference for updateScale

    // Render keys from top to bottom (highest to lowest pitch)
    for (let i = this.numKeys - 1; i >= 0; i--) {
      const midiNote = this.baseMidiNote + i;
      const key = this.createKey(midiNote);
      this.keys.set(midiNote, key);
      pianoContainer.appendChild(key);
    }

    this.container.appendChild(pianoContainer);

    // Apply initial zoom scale
    this.updateScale(this.zoomLevel);
  }

  /**
   * Create a piano key element
   * @param midiNote MIDI note number
   * @returns Key element
   */
  private createKey(midiNote: number): HTMLElement {
    const key = document.createElement('button');
    key.className = 'piano-key';
    key.type = 'button';
    key.style.height = `${this.keyHeight}px`;

    // Determine if black or white key
    const pitchClass = midiNote % 12;
    const isBlackKey = [1, 3, 6, 8, 10].includes(pitchClass); // C#, D#, F#, G#, A#

    if (isBlackKey) {
      key.classList.add('piano-key-black');
    } else {
      key.classList.add('piano-key-white');
    }

    // Add note name label
    const label = document.createElement('span');
    label.className = 'piano-key-label';
    label.textContent = NOTE_NAMES[pitchClass];
    key.appendChild(label);

    // Click handler
    key.addEventListener('click', () => this.handleKeyClick(midiNote));

    // Store MIDI note in dataset
    key.dataset.midiNote = midiNote.toString();

    return key;
  }

  /**
   * Handle key click - plays note for auditioning
   * @param midiNote MIDI note that was clicked
   */
  private handleKeyClick(midiNote: number): void {
    if (this.onKeyClick) {
      this.onKeyClick(midiNote);
    }
  }

  /**
   * Clean up
   */
  destroy(): void {
    this.container.innerHTML = '';
    this.keys.clear();
  }
}
