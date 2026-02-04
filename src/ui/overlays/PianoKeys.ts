import { GridConfig, CameraState } from '@/config/GridConfig';

/**
 * Note names for labeling keys
 */
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Semitone indices that are black keys (sharps/flats)
 */
const BLACK_KEY_INDICES = [1, 3, 6, 8, 10]; // C#, D#, F#, G#, A#

/**
 * PianoKeys - Displays piano keys column that syncs with the note grid
 *
 * The piano keys scroll vertically with the grid but remain fixed horizontally.
 * Keys zoom in/out with the grid to maintain alignment.
 */
export class PianoKeys {
  private container: HTMLElement;
  private config: GridConfig;
  private octaveCount: number;
  private innerContainer: HTMLElement;
  private keyElements: HTMLElement[] = [];

  // Callback for key press (for note audition)
  private onKeyPress?: (semitone: number) => void;
  private onKeyRelease?: (semitone: number) => void;

  constructor(container: HTMLElement, config: GridConfig, octaveCount: number) {
    this.container = container;
    this.config = config;
    this.octaveCount = octaveCount;

    this.innerContainer = document.createElement('div');
    this.innerContainer.className = 'piano-keys-inner';
    this.container.appendChild(this.innerContainer);

    this.buildKeys();
  }

  /**
   * Set callbacks for key press events
   */
  setCallbacks(onKeyPress?: (semitone: number) => void, onKeyRelease?: (semitone: number) => void): void {
    this.onKeyPress = onKeyPress;
    this.onKeyRelease = onKeyRelease;
  }

  /**
   * Gets the note label for a semitone index
   */
  private getNoteLabel(semitone: number): string {
    const octave = Math.floor(semitone / 12);
    const noteIndex = semitone % 12;
    return `${NOTE_NAMES[noteIndex]}${octave}`;
  }

  /**
   * Checks if a semitone is a black key
   */
  private isBlackKey(semitone: number): boolean {
    const noteIndex = semitone % 12;
    return BLACK_KEY_INDICES.includes(noteIndex);
  }

  /**
   * Builds the piano key elements
   */
  private buildKeys(): void {
    this.clearKeys();

    const totalSemitones = this.octaveCount * this.config.semitonesPerOctave;

    for (let i = 0; i < totalSemitones; i++) {
      const keyElement = document.createElement('div');
      const isBlack = this.isBlackKey(i);
      keyElement.className = `piano-key ${isBlack ? 'black' : 'white'}`;
      keyElement.dataset.semitone = String(i);

      const labelSpan = document.createElement('span');
      labelSpan.className = 'piano-key-label';
      labelSpan.textContent = this.getNoteLabel(i);
      keyElement.appendChild(labelSpan);

      // Attach event listeners
      const semitone = i;
      keyElement.addEventListener('mouseenter', () => {
        keyElement.classList.add('highlight');
      });
      keyElement.addEventListener('mouseleave', () => {
        keyElement.classList.remove('highlight');
        keyElement.classList.remove('active');
        // Send note off on mouse leave if active
        this.onKeyRelease?.(semitone);
      });
      keyElement.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        keyElement.classList.add('active');
        this.onKeyPress?.(semitone);
      });
      keyElement.addEventListener('mouseup', (e) => {
        if (e.button !== 0) return;
        keyElement.classList.remove('active');
        this.onKeyRelease?.(semitone);
      });

      // Touch support
      keyElement.addEventListener('touchstart', (e) => {
        e.preventDefault();
        keyElement.classList.add('active');
        this.onKeyPress?.(semitone);
      }, { passive: false });
      keyElement.addEventListener('touchend', (e) => {
        e.preventDefault();
        keyElement.classList.remove('active');
        this.onKeyRelease?.(semitone);
      });
      keyElement.addEventListener('touchcancel', () => {
        keyElement.classList.remove('active');
        this.onKeyRelease?.(semitone);
      });

      this.innerContainer.appendChild(keyElement);
      this.keyElements.push(keyElement);
    }
  }

  /**
   * Clears all key elements
   */
  private clearKeys(): void {
    this.innerContainer.innerHTML = '';
    this.keyElements = [];
  }

  /**
   * Sets the number of octaves and rebuilds keys
   */
  setOctaveCount(count: number): void {
    if (count !== this.octaveCount) {
      this.octaveCount = count;
      this.buildKeys();
    }
  }

  /**
   * Updates the position and size of keys to sync with camera state
   */
  updateTransform(cameraState: CameraState): void {
    const containerHeight = this.container.clientHeight;
    if (containerHeight === 0) return;

    const viewBottom = cameraState.bottom;
    const viewTop = cameraState.top;
    const viewHeight = viewTop - viewBottom;

    if (viewHeight <= 0) return;

    const pixelsPerSemitone = containerHeight / viewHeight;

    for (const keyElement of this.keyElements) {
      const semitone = parseInt(keyElement.dataset.semitone!, 10);

      const keyBottomWorld = semitone;
      const keyTopWorld = semitone + 1;

      const keyTopScreen = (viewTop - keyTopWorld) * pixelsPerSemitone;
      const keyBottomScreen = (viewTop - keyBottomWorld) * pixelsPerSemitone;
      const keyHeightPixels = keyBottomScreen - keyTopScreen;

      keyElement.style.top = `${keyTopScreen}px`;
      keyElement.style.height = `${keyHeightPixels}px`;

      if (keyBottomScreen < 0 || keyTopScreen > containerHeight) {
        keyElement.style.display = 'none';
      } else {
        keyElement.style.display = 'flex';
      }
    }
  }

  /**
   * Disposes of resources
   */
  dispose(): void {
    this.clearKeys();
    if (this.innerContainer.parentNode) {
      this.innerContainer.parentNode.removeChild(this.innerContainer);
    }
  }
}
