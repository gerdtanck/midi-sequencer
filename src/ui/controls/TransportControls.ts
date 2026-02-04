import type { PlaybackEngine } from '@/core/PlaybackEngine';
import type { MidiManager } from '@/midi/MidiManager';
import type { NoteGrid } from '../grid/NoteGrid';

/**
 * TransportControls - UI component for playback control
 *
 * Provides:
 * - Play/Stop button
 * - BPM control
 * - MIDI device picker
 * - Panic button
 * - Undo/Redo buttons
 */
export class TransportControls {
  private container: HTMLElement;
  private playbackEngine: PlaybackEngine;
  private midiManager: MidiManager;
  private noteGrid: NoteGrid | null = null;

  // UI elements
  private playButton: HTMLButtonElement | null = null;
  private bpmInput: HTMLInputElement | null = null;
  private deviceSelect: HTMLSelectElement | null = null;
  private panicButton: HTMLButtonElement | null = null;
  private statusText: HTMLElement | null = null;
  private enableMidiButton: HTMLButtonElement | null = null;
  private undoButton: HTMLButtonElement | null = null;
  private redoButton: HTMLButtonElement | null = null;
  private fullscreenButton: HTMLButtonElement | null = null;

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
   * Set the note grid for undo/redo functionality
   */
  setNoteGrid(noteGrid: NoteGrid): void {
    this.noteGrid = noteGrid;

    // Listen to command history changes to update button states
    noteGrid.getCommandHistory().onChange(() => {
      this.updateUndoRedoButtons();
    });
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

    // Edit section (Undo/Redo)
    const editSection = document.createElement('div');
    editSection.className = 'control-group';

    const editLabel = document.createElement('label');
    editLabel.textContent = 'Edit';
    editSection.appendChild(editLabel);

    const editRow = document.createElement('div');
    editRow.className = 'transport-controls';

    this.undoButton = document.createElement('button');
    this.undoButton.className = 'transport-btn undo';
    this.undoButton.textContent = '↩ Undo';
    this.undoButton.title = 'Undo (Ctrl+Z)';
    this.undoButton.disabled = true;
    this.undoButton.addEventListener('click', () => this.onUndoClick());
    editRow.appendChild(this.undoButton);

    this.redoButton = document.createElement('button');
    this.redoButton.className = 'transport-btn redo';
    this.redoButton.textContent = '↪ Redo';
    this.redoButton.title = 'Redo (Ctrl+Y)';
    this.redoButton.disabled = true;
    this.redoButton.addEventListener('click', () => this.onRedoClick());
    editRow.appendChild(this.redoButton);

    editSection.appendChild(editRow);
    this.container.appendChild(editSection);

    // Fullscreen button (show only if supported)
    if (this.isFullscreenSupported()) {
      const fullscreenSection = document.createElement('div');
      fullscreenSection.className = 'control-group';

      const fullscreenLabel = document.createElement('label');
      fullscreenLabel.textContent = 'View';
      fullscreenSection.appendChild(fullscreenLabel);

      this.fullscreenButton = document.createElement('button');
      this.fullscreenButton.className = 'transport-btn fullscreen';
      this.fullscreenButton.textContent = '⛶ Fullscreen';
      this.fullscreenButton.addEventListener('click', () => this.onFullscreenClick());
      fullscreenSection.appendChild(this.fullscreenButton);

      const fullscreenHint = document.createElement('div');
      fullscreenHint.className = 'control-hint';
      fullscreenHint.textContent = 'Or add to home screen for best experience';
      fullscreenSection.appendChild(fullscreenHint);

      this.container.appendChild(fullscreenSection);

      // Listen for fullscreen changes
      document.addEventListener('fullscreenchange', () => this.updateFullscreenButton());
      document.addEventListener('webkitfullscreenchange', () => this.updateFullscreenButton());
    }

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
   * Handle undo button click
   */
  private onUndoClick(): void {
    this.noteGrid?.undo();
  }

  /**
   * Handle redo button click
   */
  private onRedoClick(): void {
    this.noteGrid?.redo();
  }

  /**
   * Update undo/redo button states based on command history
   */
  private updateUndoRedoButtons(): void {
    if (!this.noteGrid) return;

    const canUndo = this.noteGrid.canUndo();
    const canRedo = this.noteGrid.canRedo();

    if (this.undoButton) {
      this.undoButton.disabled = !canUndo;
    }
    if (this.redoButton) {
      this.redoButton.disabled = !canRedo;
    }
  }

  /**
   * Check if fullscreen API is supported
   */
  private isFullscreenSupported(): boolean {
    return !!(
      document.documentElement.requestFullscreen ||
      (document.documentElement as any).webkitRequestFullscreen
    );
  }

  /**
   * Check if currently in fullscreen
   */
  private isFullscreen(): boolean {
    return !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
  }

  /**
   * Handle fullscreen button click
   */
  private onFullscreenClick(): void {
    if (this.isFullscreen()) {
      // Exit fullscreen
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
    } else {
      // Enter fullscreen
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        elem.requestFullscreen();
      } else if ((elem as any).webkitRequestFullscreen) {
        (elem as any).webkitRequestFullscreen();
      }
    }
  }

  /**
   * Update fullscreen button text based on state
   */
  private updateFullscreenButton(): void {
    if (!this.fullscreenButton) return;

    if (this.isFullscreen()) {
      this.fullscreenButton.textContent = '⛶ Exit Fullscreen';
    } else {
      this.fullscreenButton.textContent = '⛶ Fullscreen';
    }
  }

  /**
   * Clean up
   */
  dispose(): void {
    this.container.innerHTML = '';
  }
}
