import { WebMidi, Output } from 'webmidi';
import type { MidiDevice, DeviceEventCallback } from './types';
import { LookaheadScheduler } from '../scheduler/LookaheadScheduler';
import { NoteTracker } from './NoteTracker';

/**
 * Manages MIDI device connections and communication
 */
export class MidiManager {
  private _enabled: boolean = false;
  private _outputs: Map<string, Output> = new Map();
  private _selectedDevice: Output | null = null;
  private scheduler: LookaheadScheduler;
  private noteTracker: NoteTracker;

  constructor() {
    this.scheduler = new LookaheadScheduler();
    this.noteTracker = new NoteTracker();
  }

  /**
   * Initialize WebMIDI and request access
   * @returns true if enabled successfully, false otherwise
   */
  async init(): Promise<boolean> {
    try {
      await WebMidi.enable();
      this._enabled = true;

      // Populate outputs map
      this._refreshOutputs();

      // Start scheduler
      this.scheduler.start();

      console.log('WebMIDI enabled successfully');
      console.log(`Found ${this._outputs.size} MIDI output(s)`);

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
  private _refreshOutputs(): void {
    this._outputs.clear();
    for (const output of WebMidi.outputs) {
      this._outputs.set(output.id, output);
    }
  }

  /**
   * Get all available MIDI output devices
   * @returns Array of MidiDevice objects
   */
  getDevices(): MidiDevice[] {
    if (!this._enabled) {
      return [];
    }

    this._refreshOutputs();

    return Array.from(this._outputs.values()).map(output => ({
      id: output.id,
      name: output.name,
      manufacturer: output.manufacturer || 'Unknown',
      state: output.state as 'connected' | 'disconnected'
    }));
  }

  /**
   * Register callback for device connection events
   * @param callback Function to call when device connects
   */
  onDeviceConnected(callback: DeviceEventCallback): void {
    WebMidi.addListener('connected', (event) => {
      if (event.port.type === 'output') {
        const device: MidiDevice = {
          id: event.port.id,
          name: event.port.name,
          manufacturer: event.port.manufacturer || 'Unknown',
          state: 'connected'
        };
        this._refreshOutputs();
        callback(device);
      }
    });
  }

  /**
   * Register callback for device disconnection events
   * @param callback Function to call when device disconnects
   */
  onDeviceDisconnected(callback: DeviceEventCallback): void {
    WebMidi.addListener('disconnected', (event) => {
      if (event.port.type === 'output') {
        const device: MidiDevice = {
          id: event.port.id,
          name: event.port.name,
          manufacturer: event.port.manufacturer || 'Unknown',
          state: 'disconnected'
        };
        this._refreshOutputs();
        callback(device);
      }
    });
  }

  /**
   * Select a MIDI output device
   * @param deviceId Device ID to select
   * @returns true if device was selected, false if not found
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
   * @returns Selected MidiDevice or null if none selected
   */
  getSelectedDevice(): MidiDevice | null {
    if (!this._selectedDevice) {
      return null;
    }

    return {
      id: this._selectedDevice.id,
      name: this._selectedDevice.name,
      manufacturer: this._selectedDevice.manufacturer || 'Unknown',
      state: this._selectedDevice.state as 'connected' | 'disconnected'
    };
  }

  /**
   * Check if MIDI is enabled
   */
  get isEnabled(): boolean {
    return this._enabled;
  }

  /**
   * Send MIDI Note On message
   * @param channel MIDI channel (0-15)
   * @param note MIDI note number (0-127)
   * @param velocity Note velocity (0-127)
   * @param timestamp Optional high-resolution timestamp (from performance.now())
   */
  sendNoteOn(channel: number, note: number, velocity: number, timestamp?: number): void {
    if (!this._selectedDevice) {
      console.warn('No MIDI device selected');
      return;
    }

    const message = [0x90 + channel, note, velocity];
    const time = timestamp ?? performance.now();

    this._selectedDevice.send(message, { time });
    this.noteTracker.noteOn(channel, note);
  }

  /**
   * Send MIDI Note Off message
   * @param channel MIDI channel (0-15)
   * @param note MIDI note number (0-127)
   * @param timestamp Optional high-resolution timestamp (from performance.now())
   */
  sendNoteOff(channel: number, note: number, timestamp?: number): void {
    if (!this._selectedDevice) {
      console.warn('No MIDI device selected');
      return;
    }

    const message = [0x80 + channel, note, 0];
    const time = timestamp ?? performance.now();

    this._selectedDevice.send(message, { time });
    this.noteTracker.noteOff(channel, note);
  }

  /**
   * Play a MIDI note immediately for auditioning
   * @param note MIDI note number (0-127)
   * @param velocity Note velocity (0-127)
   * @param duration Note duration in seconds
   * @param channel MIDI channel (0-15), defaults to 0
   */
  playNote(note: number, velocity: number, duration: number, channel: number = 0): void {
    if (!this._selectedDevice) {
      console.warn('No MIDI device selected');
      return;
    }

    const now = performance.now();
    const durationMs = duration * 1000;

    // Send Note On immediately
    this.sendNoteOn(channel, note, velocity, now);

    // Schedule Note Off
    setTimeout(() => {
      this.sendNoteOff(channel, note);
    }, durationMs);
  }

  /**
   * Schedule a MIDI note with precise timing
   * @param channel MIDI channel (0-15)
   * @param note MIDI note number (0-127)
   * @param velocity Note velocity (0-127)
   * @param startTime Absolute start time (from performance.now())
   * @param duration Note duration in milliseconds
   */
  scheduleNote(channel: number, note: number, velocity: number, startTime: number, duration: number): void {
    // Schedule Note On
    this.scheduler.scheduleEvent(
      () => this.sendNoteOn(channel, note, velocity, startTime),
      startTime
    );

    // Schedule Note Off
    const endTime = startTime + duration;
    this.scheduler.scheduleEvent(
      () => this.sendNoteOff(channel, note, endTime),
      endTime
    );

    // Safeguard: auto-panic if note doesn't turn off (stuck note prevention)
    const safeguardDelay = duration + 1000; // Duration + 1 second grace period
    const safeguardTimeout = setTimeout(() => {
      // Check if note is still active
      const activeNotes = this.noteTracker.getActiveNotes();
      const isStuck = activeNotes.some(n => n.channel === channel && n.note === note);
      if (isStuck) {
        console.warn(`Stuck note detected: channel ${channel}, note ${note}. Executing panic.`);
        this.panic();
      }
    }, safeguardDelay);

    // Clear timeout when note off executes (wrapped in the scheduled event)
    this.scheduler.scheduleEvent(
      () => clearTimeout(safeguardTimeout),
      endTime + 10 // Clear slightly after note off
    );
  }

  /**
   * Emergency stop: silence all MIDI output immediately
   * Sends explicit Note Off for tracked notes + CC 123 (All Notes Off) + CC 120 (All Sound Off)
   */
  panic(): void {
    if (!this._selectedDevice) {
      console.warn('No MIDI device selected, panic skipped');
      return;
    }

    console.log('PANIC: Stopping all MIDI output');

    // Step 1: Send explicit Note Off for all tracked active notes
    const activeNotes = this.noteTracker.getActiveNotes();
    for (const note of activeNotes) {
      this.sendNoteOff(note.channel, note.note);
    }
    console.log(`PANIC: Sent Note Off for ${activeNotes.length} active notes`);

    // Step 2: Send All Notes Off (CC 123) on all 16 channels
    for (let channel = 0; channel < 16; channel++) {
      const message = [0xB0 + channel, 123, 0];
      this._selectedDevice.send(message);
    }
    console.log('PANIC: Sent All Notes Off (CC 123) on all channels');

    // Step 3: Send All Sound Off (CC 120) on all 16 channels
    for (let channel = 0; channel < 16; channel++) {
      const message = [0xB0 + channel, 120, 0];
      this._selectedDevice.send(message);
    }
    console.log('PANIC: Sent All Sound Off (CC 120) on all channels');

    // Clear note tracker
    this.noteTracker.clear();
    console.log('PANIC: Cleared note tracker');
  }

  /**
   * Send MIDI Clock message (0xF8)
   * Used for tempo synchronization at 24 PPQ (pulses per quarter note)
   * @param timestamp Optional high-resolution timestamp (from performance.now())
   */
  sendClock(timestamp?: number): void {
    if (!this._selectedDevice) {
      console.warn('No MIDI device selected');
      return;
    }

    const message = [0xF8]; // MIDI Clock
    const time = timestamp ?? performance.now();
    this._selectedDevice.send(message, { time });
  }

  /**
   * Send MIDI Start message (0xFA)
   * Starts playback from the beginning
   * @param timestamp Optional high-resolution timestamp (from performance.now())
   */
  sendStart(timestamp?: number): void {
    if (!this._selectedDevice) {
      console.warn('No MIDI device selected');
      return;
    }

    const message = [0xFA]; // MIDI Start
    const time = timestamp ?? performance.now();
    this._selectedDevice.send(message, { time });
    console.log('MIDI Start sent');
  }

  /**
   * Send MIDI Stop message (0xFC)
   * Stops playback
   * @param timestamp Optional high-resolution timestamp (from performance.now())
   */
  sendStop(timestamp?: number): void {
    if (!this._selectedDevice) {
      console.warn('No MIDI device selected');
      return;
    }

    const message = [0xFC]; // MIDI Stop
    const time = timestamp ?? performance.now();
    this._selectedDevice.send(message, { time });
    console.log('MIDI Stop sent');
  }

  /**
   * Get the lookahead scheduler instance
   * @returns LookaheadScheduler instance
   */
  getScheduler(): LookaheadScheduler {
    return this.scheduler;
  }
}
