import { WebMidi, Output, Input } from 'webmidi';
import type { MidiDevice, DeviceEventCallback } from './types';
import { NoteTracker } from './NoteTracker';

/**
 * Manages MIDI device connections and communication
 *
 * Uses the webmidi library for cross-browser WebMIDI support.
 * Tracks active notes for panic functionality (stuck note prevention).
 */
export class MidiManager {
  private _enabled = false;
  private _outputs: Map<string, Output> = new Map();
  private _selectedDevice: Output | null = null;
  private _inputs: Map<string, Input> = new Map();
  private _selectedInput: Input | null = null;
  private onMidiInputCallback: ((message: number[]) => void) | null = null;
  private noteTracker: NoteTracker;

  // Event callbacks
  private deviceConnectedCallbacks: DeviceEventCallback[] = [];
  private deviceDisconnectedCallbacks: DeviceEventCallback[] = [];

  constructor() {
    this.noteTracker = new NoteTracker();
  }

  /**
   * Initialize WebMIDI and request access
   */
  async init(): Promise<boolean> {
    try {
      await WebMidi.enable();
      this._enabled = true;

      this.refreshOutputs();
      this.refreshInputs();

      // Set up device connection listeners
      WebMidi.addListener('connected', (event) => {
        if (event.port.type === 'output') {
          this.refreshOutputs();
          const device = this.portToDevice(event.port, 'output');
          this.deviceConnectedCallbacks.forEach((cb) => cb(device));
        } else if (event.port.type === 'input') {
          this.refreshInputs();
          const device = this.portToDevice(event.port, 'input');
          this.deviceConnectedCallbacks.forEach((cb) => cb(device));
        }
      });

      WebMidi.addListener('disconnected', (event) => {
        if (event.port.type === 'output') {
          this.refreshOutputs();
          const device = this.portToDevice(event.port, 'output');
          this.deviceDisconnectedCallbacks.forEach((cb) => cb(device));

          // Clear selection if disconnected device was selected
          if (this._selectedDevice?.id === event.port.id) {
            this._selectedDevice = null;
          }
        } else if (event.port.type === 'input') {
          this.refreshInputs();
          const device = this.portToDevice(event.port, 'input');
          this.deviceDisconnectedCallbacks.forEach((cb) => cb(device));

          // Clear selection if disconnected input was selected
          if (this._selectedInput?.id === event.port.id) {
            this.stopListening();
            this._selectedInput = null;
          }
        }
      });

      console.log('WebMIDI enabled successfully');
      console.log(`Found ${this._outputs.size} MIDI output(s), ${this._inputs.size} input(s)`);

      return true;
    } catch (error) {
      console.error('Failed to enable WebMIDI:', error);
      this._enabled = false;
      return false;
    }
  }

  /**
   * Refresh internal outputs map
   */
  private refreshOutputs(): void {
    this._outputs.clear();
    for (const output of WebMidi.outputs) {
      this._outputs.set(output.id, output);
    }
  }

  /**
   * Convert webmidi port to MidiDevice
   */
  private portToDevice(port: { id: string; name: string; manufacturer: string; state: string }, type: 'input' | 'output'): MidiDevice {
    return {
      id: port.id,
      name: port.name,
      manufacturer: port.manufacturer || 'Unknown',
      state: port.state as 'connected' | 'disconnected',
      type,
    };
  }

  /**
   * Get all available MIDI output devices
   */
  getDevices(): MidiDevice[] {
    if (!this._enabled) {
      return [];
    }

    this.refreshOutputs();

    return Array.from(this._outputs.values()).map((output) => ({
      id: output.id,
      name: output.name,
      manufacturer: output.manufacturer || 'Unknown',
      state: output.state as 'connected' | 'disconnected',
      type: 'output' as const,
    }));
  }

  /**
   * Register callback for device connection events
   */
  onDeviceConnected(callback: DeviceEventCallback): void {
    this.deviceConnectedCallbacks.push(callback);
  }

  /**
   * Register callback for device disconnection events
   */
  onDeviceDisconnected(callback: DeviceEventCallback): void {
    this.deviceDisconnectedCallbacks.push(callback);
  }

  /**
   * Select a MIDI output device
   */
  selectDevice(deviceId: string): boolean {
    const output = this._outputs.get(deviceId);
    if (output) {
      this._selectedDevice = output;
      console.log(`Selected MIDI device: ${output.name}`);
      return true;
    }
    console.warn(`Device not found: ${deviceId}`);
    return false;
  }

  /**
   * Get currently selected device
   */
  getSelectedDevice(): MidiDevice | null {
    if (!this._selectedDevice) {
      return null;
    }

    return {
      id: this._selectedDevice.id,
      name: this._selectedDevice.name,
      manufacturer: this._selectedDevice.manufacturer || 'Unknown',
      state: this._selectedDevice.state as 'connected' | 'disconnected',
      type: 'output',
    };
  }

  /**
   * Refresh internal inputs map
   */
  private refreshInputs(): void {
    this._inputs.clear();
    for (const input of WebMidi.inputs) {
      this._inputs.set(input.id, input);
    }
  }

  /**
   * Get all available MIDI input devices
   */
  getInputDevices(): MidiDevice[] {
    if (!this._enabled) {
      return [];
    }

    this.refreshInputs();

    return Array.from(this._inputs.values()).map((input) => ({
      id: input.id,
      name: input.name,
      manufacturer: input.manufacturer || 'Unknown',
      state: input.state as 'connected' | 'disconnected',
      type: 'input' as const,
    }));
  }

  /**
   * Select a MIDI input device and start listening
   */
  selectInputDevice(deviceId: string): boolean {
    const input = this._inputs.get(deviceId);
    if (input) {
      this.stopListening();
      this._selectedInput = input;
      this.startListening();
      console.log(`Selected MIDI input: ${input.name}`);
      return true;
    }
    console.warn(`Input device not found: ${deviceId}`);
    return false;
  }

  /**
   * Get currently selected input device
   */
  getSelectedInputDevice(): MidiDevice | null {
    if (!this._selectedInput) {
      return null;
    }

    return {
      id: this._selectedInput.id,
      name: this._selectedInput.name,
      manufacturer: this._selectedInput.manufacturer || 'Unknown',
      state: this._selectedInput.state as 'connected' | 'disconnected',
      type: 'input',
    };
  }

  /**
   * Set callback for raw MIDI input messages
   */
  setMidiInputCallback(cb: (message: number[]) => void): void {
    this.onMidiInputCallback = cb;
  }

  /**
   * Start listening to selected input device
   */
  private startListening(): void {
    if (!this._selectedInput) return;

    this._selectedInput.addListener('midimessage', (e) => {
      if (this.onMidiInputCallback) {
        this.onMidiInputCallback(Array.from(e.message.data));
      }
    });
  }

  /**
   * Stop listening to selected input device
   */
  private stopListening(): void {
    if (!this._selectedInput) return;
    this._selectedInput.removeListener('midimessage');
  }

  /**
   * Send raw MIDI bytes to the selected output device (for MIDI thru)
   */
  sendRaw(message: number[]): void {
    if (!this._selectedDevice) return;
    this._selectedDevice.send(message);
  }

  /**
   * Check if MIDI is enabled
   */
  get isEnabled(): boolean {
    return this._enabled;
  }

  /**
   * Send MIDI Note On message
   */
  sendNoteOn(channel: number, note: number, velocity: number, timestamp?: number): void {
    if (!this._selectedDevice) {
      return;
    }

    const message = [0x90 + channel, note, velocity];
    const time = timestamp ?? performance.now();

    this._selectedDevice.send(message, { time });
    this.noteTracker.noteOn(channel, note);
  }

  /**
   * Send MIDI Note Off message
   */
  sendNoteOff(channel: number, note: number, timestamp?: number): void {
    if (!this._selectedDevice) {
      return;
    }

    const message = [0x80 + channel, note, 0];
    const time = timestamp ?? performance.now();

    this._selectedDevice.send(message, { time });
    this.noteTracker.noteOff(channel, note);
  }

  /**
   * Play a MIDI note immediately (for audition/preview)
   */
  playNote(note: number, velocity: number, durationMs: number, channel: number = 0): void {
    if (!this._selectedDevice) {
      return;
    }

    const now = performance.now();

    this.sendNoteOn(channel, note, velocity, now);

    setTimeout(() => {
      this.sendNoteOff(channel, note);
    }, durationMs);
  }

  /**
   * Send MIDI Control Change message
   */
  sendCC(channel: number, controller: number, value: number, timestamp?: number): void {
    if (!this._selectedDevice) {
      return;
    }

    const message = [0xb0 + channel, controller, value];
    const time = timestamp ?? performance.now();
    this._selectedDevice.send(message, { time });
  }

  /**
   * Emergency stop: silence all MIDI output immediately
   *
   * Three-layer panic:
   * 1. Send Note Off for all tracked active notes
   * 2. Send All Notes Off (CC 123) on all channels
   * 3. Send All Sound Off (CC 120) on all channels
   */
  panic(): void {
    if (!this._selectedDevice) {
      return;
    }

    console.log('PANIC: Stopping all MIDI output');

    // Step 1: Send Note Off for all tracked active notes
    const activeNotes = this.noteTracker.getActiveNotes();
    for (const note of activeNotes) {
      this.sendNoteOff(note.channel, note.note);
    }
    console.log(`PANIC: Sent Note Off for ${activeNotes.length} active notes`);

    // Step 2: Send All Notes Off (CC 123) on all 16 channels
    for (let channel = 0; channel < 16; channel++) {
      const message = [0xb0 + channel, 123, 0];
      this._selectedDevice.send(message);
    }

    // Step 3: Send All Sound Off (CC 120) on all 16 channels
    for (let channel = 0; channel < 16; channel++) {
      const message = [0xb0 + channel, 120, 0];
      this._selectedDevice.send(message);
    }

    // Clear note tracker
    this.noteTracker.clear();
    console.log('PANIC: Complete');
  }

  /**
   * Silence all notes on a single MIDI channel
   */
  panicChannel(channel: number): void {
    if (!this._selectedDevice) return;

    // Send Note Off for tracked active notes on this channel
    const activeNotes = this.noteTracker.getActiveNotes();
    for (const note of activeNotes) {
      if (note.channel === channel) {
        this.sendNoteOff(channel, note.note);
      }
    }

    // Send All Notes Off (CC 123) on this channel
    this._selectedDevice.send([0xb0 + channel, 123, 0]);
    // Send All Sound Off (CC 120) on this channel
    this._selectedDevice.send([0xb0 + channel, 120, 0]);
  }

  /**
   * Get number of currently active notes
   */
  getActiveNoteCount(): number {
    return this.noteTracker.count;
  }

  /**
   * Send MIDI Start message (0xFA)
   * Indicates the start of sequence playback
   */
  sendStart(timestamp?: number): void {
    if (!this._selectedDevice) {
      return;
    }

    const message = [0xfa]; // MIDI Start
    const time = timestamp ?? performance.now();

    this._selectedDevice.send(message, { time });
    console.log('MIDI Start sent');
  }

  /**
   * Send MIDI Stop message (0xFC)
   * Indicates the end of sequence playback
   */
  sendStop(timestamp?: number): void {
    if (!this._selectedDevice) {
      return;
    }

    const message = [0xfc]; // MIDI Stop
    const time = timestamp ?? performance.now();

    this._selectedDevice.send(message, { time });
    console.log('MIDI Stop sent');
  }

  /**
   * Send MIDI Clock message (0xF8)
   * Part of the MIDI clock signal at 24 PPQ
   */
  sendClock(timestamp?: number): void {
    if (!this._selectedDevice) {
      return;
    }

    const message = [0xf8]; // MIDI Clock
    const time = timestamp ?? performance.now();

    this._selectedDevice.send(message, { time });
  }
}
