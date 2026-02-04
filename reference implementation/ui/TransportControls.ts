import type { PlaybackEngine } from '../sequencer/PlaybackEngine';

/**
 * Transport controls for playback control and tempo adjustment
 *
 * Provides Play/Stop button and BPM controls with tap (±1) and hold (±5) behavior.
 * Positioned at bottom for optimal mobile thumb reach.
 */
export class TransportControls {
  private container: HTMLElement;
  private playbackEngine: PlaybackEngine;
  private isPlaying: boolean = false;
  private holdInterval: number | null = null;
  private transportElement: HTMLElement | null = null;

  /** Event handlers (stored for cleanup) */
  private boundStopHold: () => void;

  /** Callbacks for play/stop events */
  private onPlayCallback?: () => void;
  private onStopCallback?: () => void;

  /**
   * Create transport controls
   * @param container Parent element to render controls into
   * @param playbackEngine PlaybackEngine instance to control
   * @param callbacks Optional callbacks for play/stop events
   */
  constructor(
    container: HTMLElement,
    playbackEngine: PlaybackEngine,
    callbacks?: { onPlay?: () => void; onStop?: () => void }
  ) {
    this.container = container;
    this.playbackEngine = playbackEngine;
    this.onPlayCallback = callbacks?.onPlay;
    this.onStopCallback = callbacks?.onStop;

    // Bind event handlers for cleanup
    this.boundStopHold = this.stopHold.bind(this);
  }

  /**
   * Render transport controls
   * Creates Play/Stop button and BPM adjustment controls
   */
  render(): void {
    // Create transport container
    this.transportElement = document.createElement('div');
    this.transportElement.className = 'transport-controls';

    // Create Play/Stop button
    const playButton = document.createElement('button');
    playButton.type = 'button';
    playButton.className = 'transport-button' + (this.isPlaying ? ' stop' : ' play');
    playButton.textContent = this.isPlaying ? 'Stop' : 'Play';
    playButton.addEventListener('click', () => this.handlePlayToggle());

    // Create BPM controls group
    const bpmControls = document.createElement('div');
    bpmControls.className = 'bpm-controls';

    // BPM label
    const bpmLabel = document.createElement('label');
    bpmLabel.textContent = 'BPM';
    bpmLabel.style.fontSize = '14px';
    bpmLabel.style.fontWeight = 'bold';
    bpmLabel.style.color = '#aaa';

    // BPM minus button
    const minusButton = document.createElement('button');
    minusButton.type = 'button';
    minusButton.className = 'bpm-button';
    minusButton.textContent = '−';
    minusButton.addEventListener('click', () => this.changeBPM(-1));
    minusButton.addEventListener('mousedown', () => this.startHold(-5));
    minusButton.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.startHold(-5);
    });
    minusButton.addEventListener('mouseup', this.boundStopHold);
    minusButton.addEventListener('mouseleave', this.boundStopHold);
    minusButton.addEventListener('touchend', this.boundStopHold);
    minusButton.addEventListener('touchcancel', this.boundStopHold);

    // BPM display
    const bpmDisplay = document.createElement('div');
    bpmDisplay.className = 'bpm-display';
    bpmDisplay.textContent = this.playbackEngine.getBPM().toString();

    // BPM plus button
    const plusButton = document.createElement('button');
    plusButton.type = 'button';
    plusButton.className = 'bpm-button';
    plusButton.textContent = '+';
    plusButton.addEventListener('click', () => this.changeBPM(1));
    plusButton.addEventListener('mousedown', () => this.startHold(5));
    plusButton.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.startHold(5);
    });
    plusButton.addEventListener('mouseup', this.boundStopHold);
    plusButton.addEventListener('mouseleave', this.boundStopHold);
    plusButton.addEventListener('touchend', this.boundStopHold);
    plusButton.addEventListener('touchcancel', this.boundStopHold);

    // Assemble BPM controls
    bpmControls.appendChild(bpmLabel);
    bpmControls.appendChild(minusButton);
    bpmControls.appendChild(bpmDisplay);
    bpmControls.appendChild(plusButton);

    // Assemble transport
    this.transportElement.appendChild(playButton);
    this.transportElement.appendChild(bpmControls);

    // Replace container contents
    this.container.innerHTML = '';
    this.container.appendChild(this.transportElement);
  }

  /**
   * Handle Play/Stop toggle
   */
  private handlePlayToggle(): void {
    if (this.isPlaying) {
      this.playbackEngine.stop();
      this.isPlaying = false;

      // Fire stop callback
      if (this.onStopCallback) {
        this.onStopCallback();
      }
    } else {
      this.playbackEngine.start();
      this.isPlaying = true;

      // Fire play callback
      if (this.onPlayCallback) {
        this.onPlayCallback();
      }
    }

    // Re-render to update button state
    this.render();
  }

  /**
   * Change BPM by delta amount
   * @param delta Amount to change (positive or negative)
   */
  private changeBPM(delta: number): void {
    const current = this.playbackEngine.getBPM();
    const newBPM = Math.max(40, Math.min(240, current + delta));
    this.playbackEngine.setBPM(newBPM);

    // Re-render to update display
    this.render();
  }

  /**
   * Start hold interval for rapid BPM adjustment
   * @param delta Amount to change per interval
   */
  private startHold(delta: number): void {
    // Clear any existing hold interval
    this.stopHold();

    // Start interval for rapid changes
    this.holdInterval = window.setInterval(() => {
      this.changeBPM(delta);
    }, 200);
  }

  /**
   * Stop hold interval
   */
  private stopHold(): void {
    if (this.holdInterval !== null) {
      clearInterval(this.holdInterval);
      this.holdInterval = null;
    }
  }

  /**
   * Clean up event listeners and DOM elements
   */
  destroy(): void {
    this.stopHold();

    if (this.transportElement) {
      this.transportElement.remove();
    }

    this.transportElement = null;
  }
}
