import type { PlaybackEngine } from '@/core/PlaybackEngine';
import type { MidiManager } from '@/midi/MidiManager';
import type { SequenceManager } from '@/core/SequenceManager';
import type { NoteGrid } from '../grid/NoteGrid';

/**
 * Callback for sequence selection changes
 */
export type SequenceSelectCallback = (index: number) => void;

/**
 * TransportControls - UI component for playback control
 *
 * Provides:
 * - Sequence selector (1-4 buttons)
 * - Play/Stop button
 * - BPM control
 * - MIDI channel selector
 * - MIDI device picker
 * - Panic button
 * - Undo/Redo buttons
 */
export class TransportControls {
  private container: HTMLElement;
  private playbackEngine: PlaybackEngine;
  private midiManager: MidiManager;
  private sequenceManager: SequenceManager | null = null;
  private noteGrid: NoteGrid | null = null;

  // Callbacks
  private onSequenceSelect: SequenceSelectCallback | null = null;

  // UI elements
  private sequenceButtons: HTMLButtonElement[] = [];
  private muteButtons: HTMLButtonElement[] = [];
  private playButton: HTMLButtonElement | null = null;
  private bpmInput: HTMLInputElement | null = null;
  private channelSelect: HTMLSelectElement | null = null;
  private deviceSelect: HTMLSelectElement | null = null;
  private panicButton: HTMLButtonElement | null = null;
  private statusText: HTMLElement | null = null;
  private enableMidiButton: HTMLButtonElement | null = null;
  private undoButton: HTMLButtonElement | null = null;
  private redoButton: HTMLButtonElement | null = null;
  private fullscreenButton: HTMLButtonElement | null = null;
  private lockBarsBtn: HTMLButtonElement | null = null;
  private lockOctavesBtn: HTMLButtonElement | null = null;
  private ccToggleBtn: HTMLButtonElement | null = null;
  private ccSelectBtn: HTMLButtonElement | null = null;

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
   * Set the sequence manager for multi-sequence support
   */
  setSequenceManager(sequenceManager: SequenceManager): void {
    this.sequenceManager = sequenceManager;
  }

  /**
   * Set callback for sequence selection changes
   */
  setSequenceSelectCallback(callback: SequenceSelectCallback): void {
    this.onSequenceSelect = callback;
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

    // Sequence selector section (4 buttons)
    const sequenceSection = document.createElement('div');
    sequenceSection.className = 'control-group';

    const sequenceRow = document.createElement('div');
    sequenceRow.className = 'sequence-selector';

    this.sequenceButtons = [];
    for (let i = 0; i < 4; i++) {
      const btn = document.createElement('button');
      btn.className = 'sequence-btn' + (i === 0 ? ' active' : '');
      btn.textContent = String(i + 1);
      btn.title = `Sequence ${i + 1}`;
      btn.addEventListener('click', () => this.handleSequenceSelect(i));
      sequenceRow.appendChild(btn);
      this.sequenceButtons.push(btn);
    }

    sequenceSection.appendChild(sequenceRow);

    // Mute buttons row (below sequence selector)
    const muteRow = document.createElement('div');
    muteRow.className = 'sequence-mute-row';

    this.muteButtons = [];
    for (let i = 0; i < 4; i++) {
      const btn = document.createElement('button');
      btn.className = 'mute-btn';
      btn.textContent = 'M';
      btn.title = `Mute Sequence ${i + 1}`;
      btn.addEventListener('click', () => this.handleMuteToggle(i));
      muteRow.appendChild(btn);
      this.muteButtons.push(btn);
    }

    sequenceSection.appendChild(muteRow);
    this.container.appendChild(sequenceSection);

    // MIDI Status/Device section
    const midiSection = document.createElement('div');
    midiSection.className = 'control-group';
    midiSection.id = 'midi-section';

    // Enable MIDI button (shown first, hidden after MIDI is enabled)
    this.enableMidiButton = document.createElement('button');
    this.enableMidiButton.className = 'transport-btn enable-midi';
    this.enableMidiButton.textContent = 'Enable MIDI';
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

    const transportRow = document.createElement('div');
    transportRow.className = 'transport-controls';

    this.playButton = document.createElement('button');
    this.playButton.className = 'transport-btn';
    this.playButton.textContent = 'Play';
    this.playButton.addEventListener('click', () => this.onPlayClick());
    transportRow.appendChild(this.playButton);

    this.panicButton = document.createElement('button');
    this.panicButton.className = 'transport-btn panic';
    this.panicButton.textContent = 'Stop All';
    this.panicButton.addEventListener('click', () => this.onPanicClick());
    transportRow.appendChild(this.panicButton);

    transportSection.appendChild(transportRow);
    this.container.appendChild(transportSection);

    // BPM section
    const bpmSection = document.createElement('div');
    bpmSection.className = 'control-group';

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
    bpmHint.textContent = 'BPM';
    bpmRow.appendChild(bpmHint);

    bpmSection.appendChild(bpmRow);
    this.container.appendChild(bpmSection);

    // MIDI Channel 

    const channelRow = document.createElement('div');
    channelRow.className = 'channel-control';

    this.channelSelect = document.createElement('select');
    this.channelSelect.className = 'channel-select';
    for (let i = 1; i <= 16; i++) {
      const opt = document.createElement('option');
      opt.value = String(i - 1); // 0-based internally
      opt.textContent = String(i); // 1-based display
      this.channelSelect.appendChild(opt);
    }
    this.channelSelect.addEventListener('change', () => this.onChannelChange());
    channelRow.appendChild(this.channelSelect);

    const channelHint = document.createElement('span');
    channelHint.className = 'control-hint';
    channelHint.textContent = 'Ch';
    channelRow.appendChild(channelHint);

    bpmRow.appendChild(channelRow);

    // Update channel select to show active sequence's channel
    this.updateChannelSelect();

    // Edit section (Undo/Redo)
    const editSection = document.createElement('div');
    editSection.className = 'control-group';

    const editRow = document.createElement('div');
    editRow.className = 'transport-controls';

    this.undoButton = document.createElement('button');
    this.undoButton.className = 'transport-btn undo';
    this.undoButton.textContent = 'Undo';
    this.undoButton.title = 'Undo (Ctrl+Z)';
    this.undoButton.disabled = true;
    this.undoButton.addEventListener('click', () => this.onUndoClick());
    editRow.appendChild(this.undoButton);

    this.redoButton = document.createElement('button');
    this.redoButton.className = 'transport-btn redo';
    this.redoButton.textContent = 'Redo';
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

      this.fullscreenButton = document.createElement('button');
      this.fullscreenButton.className = 'transport-btn fullscreen';
      this.fullscreenButton.textContent = 'Fullscreen';
      this.fullscreenButton.addEventListener('click', () => this.onFullscreenClick());
      fullscreenSection.appendChild(this.fullscreenButton);

      this.container.appendChild(fullscreenSection);

      // Listen for fullscreen changes
      document.addEventListener('fullscreenchange', () => this.updateFullscreenButton());
      document.addEventListener('webkitfullscreenchange', () => this.updateFullscreenButton());
    }

    // View lock section
    const lockSection = document.createElement('div');
    lockSection.className = 'control-group';

    const lockRow = document.createElement('div');
    lockRow.className = 'transport-controls';

    this.lockBarsBtn = document.createElement('button');
    this.lockBarsBtn.className = 'transport-btn lock-btn';
    this.lockBarsBtn.textContent = 'Lock Bars';
    this.lockBarsBtn.title = 'Lock horizontal zoom/pan';
    this.lockBarsBtn.addEventListener('click', () => this.toggleLock('x'));
    lockRow.appendChild(this.lockBarsBtn);

    this.lockOctavesBtn = document.createElement('button');
    this.lockOctavesBtn.className = 'transport-btn lock-btn';
    this.lockOctavesBtn.textContent = 'Lock Keys';
    this.lockOctavesBtn.title = 'Lock vertical zoom/pan';
    this.lockOctavesBtn.addEventListener('click', () => this.toggleLock('y'));
    lockRow.appendChild(this.lockOctavesBtn);

    this.ccToggleBtn = document.createElement('button');
    this.ccToggleBtn.className = 'transport-btn lock-btn';
    this.ccToggleBtn.textContent = 'CC';
    this.ccToggleBtn.title = 'Toggle CC event input mode';
    this.ccToggleBtn.addEventListener('click', () => this.toggleCCMode());
    lockRow.appendChild(this.ccToggleBtn);

    this.ccSelectBtn = document.createElement('button');
    this.ccSelectBtn.className = 'transport-btn lock-btn';
    this.ccSelectBtn.textContent = '74';
    this.ccSelectBtn.title = 'Select CC controller number';
    this.ccSelectBtn.style.fontSize = '0.7rem';
    this.ccSelectBtn.addEventListener('click', () => this.showCCSelector());
    lockRow.appendChild(this.ccSelectBtn);

    lockSection.appendChild(lockRow);
    this.container.appendChild(lockSection);

    // Disable playback controls until MIDI is enabled
    this.setControlsEnabled(false);
  }

  /**
   * Handle sequence button click
   */
  private handleSequenceSelect(index: number): void {
    // Update button states
    for (let i = 0; i < this.sequenceButtons.length; i++) {
      if (i === index) {
        this.sequenceButtons[i].classList.add('active');
      } else {
        this.sequenceButtons[i].classList.remove('active');
      }
    }

    // Notify callback FIRST (this updates sequenceManager.activeIndex)
    if (this.onSequenceSelect) {
      this.onSequenceSelect(index);
    }

    // THEN update channel select to show this sequence's channel
    this.updateChannelSelect();
  }

  /**
   * Handle mute button click
   */
  private handleMuteToggle(index: number): void {
    const isMuted = this.playbackEngine.toggleMute(index);
    if (this.muteButtons[index]) {
      this.muteButtons[index].classList.toggle('muted', isMuted);
    }
  }

  /**
   * Update channel select to reflect active sequence's MIDI channel
   */
  private updateChannelSelect(): void {
    if (!this.channelSelect || !this.sequenceManager) return;

    const activeSeq = this.sequenceManager.getActiveSequence();
    this.channelSelect.value = String(activeSeq.getMidiChannel());
  }

  /**
   * Handle channel selection change
   */
  private onChannelChange(): void {
    if (!this.channelSelect || !this.sequenceManager) return;

    const channel = parseInt(this.channelSelect.value, 10);
    const activeSeq = this.sequenceManager.getActiveSequence();
    activeSeq.setMidiChannel(channel);
  }

  /**
   * Update active sequence button (called when sequence changes externally)
   */
  updateActiveSequence(index: number): void {
    for (let i = 0; i < this.sequenceButtons.length; i++) {
      if (i === index) {
        this.sequenceButtons[i].classList.add('active');
      } else {
        this.sequenceButtons[i].classList.remove('active');
      }
    }
    this.updateChannelSelect();
  }

  /**
   * Handle Enable MIDI button click
   */
  private async onEnableMidiClick(): Promise<void> {
    if (this.enableMidiButton) {
      this.enableMidiButton.textContent = 'Requesting...';
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

      this.updateDeviceList();
      if (this.statusText) {
        const devices = this.midiManager.getDevices();
        this.statusText.textContent =
          devices.length > 0 ? 'Select a MIDI device' : 'No MIDI devices found';
      }

      // Listen for device changes
      this.midiManager.onDeviceConnected(() => this.updateDeviceList());
      this.midiManager.onDeviceDisconnected(() => this.updateDeviceList());
    } else {
      // Show error, re-enable button
      if (this.enableMidiButton) {
        this.enableMidiButton.textContent = 'Enable MIDI';
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

  }

  /**
   * Handle device selection change
   */
  private onDeviceChange(): void {
    if (!this.deviceSelect) return;

    const deviceId = this.deviceSelect.value;
    if (deviceId) {
      this.midiManager.selectDevice(deviceId);

      // Hide MIDI section after device is selected
      const midiSection = document.getElementById('midi-section');
      if (midiSection) {
        midiSection.style.display = 'none';
      }

      // Enable playback controls
      this.setControlsEnabled(true);
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
      this.playButton.textContent = 'Stop';
      this.playButton.classList.add('play');
    } else {
      this.playButton.textContent = 'Play';
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
   * Toggle axis lock and update button state
   */
  private toggleLock(axis: 'x' | 'y'): void {
    const btn = axis === 'x' ? this.lockBarsBtn : this.lockOctavesBtn;
    if (!btn) return;

    const isActive = btn.classList.toggle('active');
    this.noteGrid?.setAxisLock(axis, isActive);
  }

  /**
   * Toggle CC input mode
   */
  private toggleCCMode(): void {
    if (!this.ccToggleBtn || !this.noteGrid) return;
    const isActive = this.ccToggleBtn.classList.toggle('active');
    this.noteGrid.setCCMode(isActive);
  }

  /**
   * Show CC controller number selector popup
   */
  private showCCSelector(): void {
    if (!this.noteGrid || !this.ccSelectBtn) return;

    // Remove existing popup
    const existing = document.querySelector('.cc-selector-popup');
    if (existing) { existing.remove(); return; }

    const COMMON_CCS = [
      { num: 1, name: 'Mod Wheel' },
      { num: 7, name: 'Volume' },
      { num: 10, name: 'Pan' },
      { num: 11, name: 'Expression' },
      { num: 64, name: 'Sustain' },
      { num: 71, name: 'Resonance' },
      { num: 74, name: 'Cutoff' },
      { num: 91, name: 'Reverb' },
      { num: 93, name: 'Chorus' },
    ];

    const popup = document.createElement('div');
    popup.className = 'cc-selector-popup';
    popup.style.cssText = `
      position: fixed; background: #1a1a2e; border: 1px solid #555;
      border-radius: 4px; padding: 6px; z-index: 1000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5); display: flex;
      flex-direction: column; gap: 2px; font-size: 0.8rem;
    `;

    const rect = this.ccSelectBtn.getBoundingClientRect();
    popup.style.left = `${rect.left}px`;
    popup.style.bottom = `${window.innerHeight - rect.top + 4}px`;

    for (const cc of COMMON_CCS) {
      const item = document.createElement('button');
      item.style.cssText = `
        background: transparent; border: none; color: #ccc; padding: 4px 8px;
        cursor: pointer; text-align: left; border-radius: 3px; white-space: nowrap;
      `;
      item.textContent = `${cc.num}: ${cc.name}`;
      item.addEventListener('mouseenter', () => { item.style.background = '#333'; });
      item.addEventListener('mouseleave', () => { item.style.background = 'transparent'; });
      item.addEventListener('click', () => {
        this.noteGrid?.setCCController(cc.num);
        if (this.ccSelectBtn) this.ccSelectBtn.textContent = String(cc.num);
        popup.remove();
      });
      popup.appendChild(item);
    }

    document.body.appendChild(popup);

    const closeHandler = (e: MouseEvent) => {
      if (!popup.contains(e.target as Node) && e.target !== this.ccSelectBtn) {
        popup.remove();
        document.removeEventListener('mousedown', closeHandler);
      }
    };
    requestAnimationFrame(() => document.addEventListener('mousedown', closeHandler));
  }

  /**
   * Update fullscreen button text based on state
   */
  private updateFullscreenButton(): void {
    if (!this.fullscreenButton) return;

    if (this.isFullscreen()) {
      this.fullscreenButton.textContent = 'Exit Fullscreen';
    } else {
      this.fullscreenButton.textContent = 'Fullscreen';
    }
  }

  /**
   * Clean up
   */
  dispose(): void {
    this.container.innerHTML = '';
  }
}
