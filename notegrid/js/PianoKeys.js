/**
 * PianoKeys - Displays piano keys column that syncs with the note grid
 *
 * The piano keys scroll vertically with the grid but remain fixed horizontally.
 * Keys zoom in/out with the grid to maintain alignment.
 */
class PianoKeys {
  /**
   * Note names for labeling keys
   * @type {string[]}
   */
  static NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  /**
   * Semitone indices that are black keys (sharps/flats)
   * @type {number[]}
   */
  static BLACK_KEY_INDICES = [1, 3, 6, 8, 10]; // C#, D#, F#, G#, A#

  /**
   * Creates a new PianoKeys instance
   * @param {HTMLElement} container - The container element for the piano keys
   * @param {Object} config - Grid configuration
   * @param {number} octaveCount - Initial number of octaves
   */
  constructor(container, config, octaveCount) {
    this.container = container;
    this.config = config;
    this.octaveCount = octaveCount;

    // Create inner container for keys
    this.innerContainer = document.createElement('div');
    this.innerContainer.className = 'piano-keys-inner';
    this.container.appendChild(this.innerContainer);

    // Store key elements
    this.keyElements = [];

    // Build initial keys
    this.buildKeys();
  }

  /**
   * Gets the note label for a semitone index
   * @param {number} semitone - The semitone index (0 = C0, 12 = C1, etc.)
   * @returns {string} The note label (e.g., "C0", "F#1")
   */
  getNoteLabel(semitone) {
    const octave = Math.floor(semitone / 12);
    const noteIndex = semitone % 12;
    return `${PianoKeys.NOTE_NAMES[noteIndex]}${octave}`;
  }

  /**
   * Checks if a semitone is a black key
   * @param {number} semitone - The semitone index
   * @returns {boolean} True if the semitone is a black key
   */
  isBlackKey(semitone) {
    const noteIndex = semitone % 12;
    return PianoKeys.BLACK_KEY_INDICES.includes(noteIndex);
  }

  /**
   * Builds the piano key elements
   */
  buildKeys() {
    // Clear existing keys
    this.clearKeys();

    const totalSemitones = this.octaveCount * this.config.semitonesPerOctave;

    for (let i = 0; i < totalSemitones; i++) {
      const keyElement = document.createElement('div');
      const isBlack = this.isBlackKey(i);
      keyElement.className = `piano-key ${isBlack ? 'black' : 'white'}`;
      keyElement.dataset.semitone = i;

      // Create label span
      const labelSpan = document.createElement('span');
      labelSpan.className = 'piano-key-label';
      labelSpan.textContent = this.getNoteLabel(i);
      keyElement.appendChild(labelSpan);

      // Attach event listeners with proper this binding
      const semitone = i;
      keyElement.addEventListener('mouseenter', () => {
        keyElement.classList.add('highlight');
        console.log(`Piano key hover: ${this.getNoteLabel(semitone)}`);
      });
      keyElement.addEventListener('mouseleave', () => {
        keyElement.classList.remove('highlight');
        keyElement.classList.remove('active');
      });
      keyElement.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        keyElement.classList.add('active');
        console.log(`Key down: ${this.getNoteLabel(semitone)}`);
      });
      keyElement.addEventListener('mouseup', (e) => {
        if (e.button !== 0) return;
        keyElement.classList.remove('active');
        console.log(`Key up: ${this.getNoteLabel(semitone)}`);
      });

      this.innerContainer.appendChild(keyElement);
      this.keyElements.push(keyElement);
    }
  }

  /**
   * Clears all key elements
   */
  clearKeys() {
    this.innerContainer.innerHTML = '';
    this.keyElements = [];
  }

  /**
   * Sets the number of octaves and rebuilds keys
   * @param {number} count - Number of octaves
   */
  setOctaveCount(count) {
    if (count !== this.octaveCount) {
      this.octaveCount = count;
      this.buildKeys();
    }
  }

  /**
   * Updates the position and size of keys to sync with camera state
   * @param {Object} cameraState - Camera bounds {left, right, top, bottom}
   */
  updateTransform(cameraState) {
    const containerHeight = this.container.clientHeight;
    if (containerHeight === 0) return;

    const viewBottom = cameraState.bottom;
    const viewTop = cameraState.top;
    const viewHeight = viewTop - viewBottom;

    if (viewHeight <= 0) return;

    // Calculate pixels per semitone
    const pixelsPerSemitone = containerHeight / viewHeight;

    // Update each key's position and size
    for (const keyElement of this.keyElements) {
      const semitone = parseInt(keyElement.dataset.semitone, 10);

      // Calculate pixel position from top of container
      // semitone 0 is at y=0 in world coords (bottom)
      // In screen coords, higher y values are at the top
      const keyBottomWorld = semitone;
      const keyTopWorld = semitone + 1;

      // Convert to screen pixels (from top of container)
      const keyTopScreen = (viewTop - keyTopWorld) * pixelsPerSemitone;
      const keyBottomScreen = (viewTop - keyBottomWorld) * pixelsPerSemitone;
      const keyHeightPixels = keyBottomScreen - keyTopScreen;

      keyElement.style.top = `${keyTopScreen}px`;
      keyElement.style.height = `${keyHeightPixels}px`;

      // Hide keys that are outside the visible area
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
  dispose() {
    this.clearKeys();
    if (this.innerContainer && this.innerContainer.parentNode) {
      this.innerContainer.parentNode.removeChild(this.innerContainer);
    }
  }
}
