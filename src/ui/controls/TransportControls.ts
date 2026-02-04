import type { PlaybackEngine } from '@/core/PlaybackEngine';
import type { MidiManager } from '@/midi/MidiManager';

/**
 * TransportControls - UI component for playback control
 *
 * Provides:
 * - Play/Stop button
 * - BPM control
 * - MIDI device picker
 * - Panic button
 */
export class TransportControls {
  private container: HTMLElement;
  private playbackEngine: PlaybackEngine;
  private midiManager: MidiManager;

  // UI elements
  private playButton: HTMLButtonElement | null = null;
  private bpmInput: HTMLInputElement | null = null;
  private deviceSelect: HTMLSelectElement | null = null;
  private panicButton: HTMLButtonElement | null = null;
  private statusText: HTMLElement | null = null;
  private enableMidiButton: HTMLButtonElement | null = null;

  constructor(
    container: HTMLElement,
    playbackEngine: PlaybackEngine,
    midiManager: MidiManager
  ) {
    this.container = container;
    this.playbackEngine = playbackEngine;
    this.midiManager = midiManager;
  }

  /**
   * Render the transport controls
   */
  render(): void {
    this.container.innerHTML = '';

    // MIDI Status/Device section
    const midiSection = document.createElement('div');
    midiSection.className = 'control-group';
    midiSection.id = 'midi-section';

    const midiLabel = document.createElement('label');
    midiLabel.textContent = 'MIDI Output';
    midiSection.appendChild(midiLabel);

    // Enable MIDI button (shown first, hidden after MIDI is enabled)
    this.enableMidiButton = document.createElement('button');
    this.enableMidiButton.className = 'transport-btn enable-midi';
    this.enableMidiButton.textContent = '🎹 Enable MIDI';
    this.enableMidiButton.addEventListener('click', () => this.onEnableMidiClick());
    midiSection.appendChild(this.enableMidiButton);

    // Device select (hidden until MIDI is enabled)
    this.deviceSelect = document.createElement('select');
    this.deviceSelect.className = 'device-select';
    this.deviceSelect.style.display = 'none';
    this.deviceSelect.addEventListener('change', () => this.onDeviceChange());
    midiSection.appendChild(this.deviceSelect);

    this.statusText = document.createElement('div');
    this.statusText.className = 'control-hint';
    this.statusText.textContent = 'Click button to request MIDI access';
    midiSection.appendChild(this.statusText);

    this.container.appendChild(midiSection);

    // Transport section
    const transportSection = document.createElement('div');
    transportSection.className = 'control-group';

    const transportLabel = document.createElement('label');
    transportLabel.textContent = 'Transport';
    transportSection.appendChild(transportLabel);

    const transportRow = document.createElement('div');
    transportRow.className = 'transport-controls';

    this.playButton = document.createElement('button');
    this.playButton.className = 'transport-btn';
    this.playButton.textContent = '▶ Play';
    this.playButton.addEventListener('click', () => this.onPlayClick());
    transportRow.appendChild(this.playButton);

    this.panicButton = document.createElement('button');
    this.panicButton.className = 'transport-btn panic';
    this.panicButton.textContent = '⬛ Stop All';
    this.panicButton.addEventListener('click', () => this.onPanicClick());
    transportRow.appendChild(this.panicButton);

    transportSection.appendChild(transportRow);
    this.container.appendChild(transportSection);

    // BPM section
    const bpmSection = document.createElement('div');
    bpmSection.className = 'control-group';

    const bpmLabel = document.createElement('label');
    bpmLabel.htmlFor = 'bpm-input';
    bpmLabel.textContent = 'BPM';
    bpmSection.appendChild(bpmLabel);

    const bpmRow = document.createElement('div');
    bpmRow.className = 'bpm-control';

    this.bpmInput = document.createElement('input');
    this.bpmInput.type = 'number';
    this.bpmInput.id = 'bpm-input';
    this.bpmInput.min = '40';
    this.bpmInput.max = '240';
    this.bpmInput.value = String(this.playbackEngine.getBPM());
    this.bpmInput.addEventListener('change', () => this.onBpmChange());
    bpmRow.appendChild(this.bpmInput);

    const bpmHint = document.createElement('span');
    bpmHint.className = 'control-hint';
    bpmHint.textContent = '(40-240)';
    bpmRow.appendChild(bpmHint);

    bpmSection.appendChild(bpmRow);
    this.container.appendChild(bpmSection);

    // Disable playback controls until MIDI is enabled
    this.setControlsEnabled(false);
  }

  /**
   * Handle Enable MIDI button click
   */
  private async onEnableMidiClick(): Promise<void> {
    if (this.enableMidiButton) {
      this.enableMidiButton.textContent = '⏳ Requesting...';
      this.enableMidiButton.disabled = true;
    }

    await this.initMidi();
  }

  /**
   * Enable/disable playback controls
   */
  private setControlsEnabled(enabled: boolean): void {
    if (this.playButton) {
      this.playButton.disabled = !enabled;
    }
    if (this.panicButton) {
      this.panicButton.disabled = !enabled;
    }
  }

  /**
   * Initialize MIDI access
   */
  private async initMidi(): Promise<void> {
    if (this.statusText) {
      this.statusText.textContent = 'Initializing MIDI...';
    }

    const success = await this.midiManager.init();

    if (success) {
      // Hide enable button, show device select
      if (this.enableMidiButton) {
        this.enableMidiButton.style.display = 'none';
      }
      if (this.deviceSelect) {
        this.deviceSelect.style.display = '';
      }

      // Enable playback controls
      this.setControlsEnabled(true);

      this.updateDeviceList();
      if (this.statusText) {
        const devices = this.midiManager.getDevices();
        this.statusText.textContent =
          devices.length > 0 ? `${devices.length} device(s) found` : 'No MIDI devices found';
      }

      // Listen for device changes
      this.midiManager.onDeviceConnected(() => this.updateDeviceList());
      this.midiManager.onDeviceDisconnected(() => this.updateDeviceList());
    } else {
      // Show error, re-enable button
      if (this.enableMidiButton) {
        this.enableMidiButton.textContent = '🎹 Enable MIDI';
        this.enableMidiButton.disabled = false;
      }
      if (this.statusText) {
        this.statusText.textContent = 'MIDI access denied or not available';
        this.statusText.style.color = '#ff6b6b';
      }
    }
  }

  /**
   * Update device dropdown
   */
  private updateDeviceList(): void {
    if (!this.deviceSelect) return;

    const devices = this.midiManager.getDevices();
    const selectedDevice = this.midiManager.getSelectedDevice();

    this.deviceSelect.innerHTML = '';

    // Add placeholder option
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = devices.length > 0 ? '-- Select Device --' : 'No devices available';
    placeholder.disabled = true;
    placeholder.selected = !selectedDevice;
    this.deviceSelect.appendChild(placeholder);

    // Add device options
    for (const device of devices) {
      const option = document.createElement('option');
      option.value = device.id;
      option.textContent = device.name;
      option.selected = selectedDevice?.id === device.id;
      this.deviceSelect.appendChild(option);
    }

    // Auto-select first device if none selected
    if (!selectedDevice && devices.length > 0) {
      this.midiManager.selectDevice(devices[0].id);
      this.deviceSelect.value = devices[0].id;
      if (this.statusText) {
        this.statusText.textContent = `Selected: ${devices[0].name}`;
      }
    }
  }

  /**
   * Handle device selection change
   */
  private onDeviceChange(): void {
    if (!this.deviceSelect) return;

    const deviceId = this.deviceSelect.value;
    if (deviceId) {
      this.midiManager.selectDevice(deviceId);
      const device = this.midiManager.getSelectedDevice();
      if (this.statusText && device) {
        this.statusText.textContent = `Selected: ${device.name}`;
      }
    }
  }

  /**
   * Handle play/stop button click
   */
  private onPlayClick(): void {
    if (this.playbackEngine.isPlaying) {
      this.playbackEngine.stop();
      this.updatePlayButton(false);
    } else {
      this.playbackEngine.start();
      this.updatePlayButton(true);
    }
  }

  /**
   * Update play button state
   */
  updatePlayButton(isPlaying: boolean): void {
    if (!this.playButton) return;

    if (isPlaying) {
      this.playButton.textContent = '⬛ Stop';
      this.playButton.classList.add('play');
    } else {
      this.playButton.textContent = '▶ Play';
      this.playButton.classList.remove('play');
    }
  }

  /**
   * Handle panic button click
   */
  private onPanicClick(): void {
    this.playbackEngine.stop();
    this.midiManager.panic();
    this.updatePlayButton(false);
  }

  /**
   * Handle BPM change
   */
  private onBpmChange(): void {
    if (!this.bpmInput) return;

    const bpm = parseInt(this.bpmInput.value, 10);
    if (!isNaN(bpm) && bpm >= 40 && bpm <= 240) {
      this.playbackEngine.setBPM(bpm);
    } else {
      // Reset to current value
      this.bpmInput.value = String(this.playbackEngine.getBPM());
    }
  }

  /**
   * Clean up
   */
  dispose(): void {
    this.container.innerHTML = '';
  }
}
