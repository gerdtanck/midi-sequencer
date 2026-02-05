import type { LookaheadScheduler } from './LookaheadScheduler';
import type { MidiManager } from '@/midi/MidiManager';

/**
 * Generates MIDI clock messages at 24 PPQ (pulses per quarter note)
 *
 * MIDI clock is the standard timing protocol used by hardware synthesizers,
 * drum machines, and DAWs for synchronization. The MIDI specification defines
 * 24 clock pulses per quarter note (24 PPQ).
 *
 * Uses chaining pattern: each clock schedules the next one, allowing BPM
 * changes to take effect immediately without restarting the clock.
 */
export class MidiClockGenerator {
  private scheduler: LookaheadScheduler;
  private midiManager: MidiManager;
  private bpm: number = 120;
  private isRunning: boolean = false;
  private nextClockTime: number = 0;

  constructor(scheduler: LookaheadScheduler, midiManager: MidiManager) {
    this.scheduler = scheduler;
    this.midiManager = midiManager;
  }

  /**
   * Start the MIDI clock
   * Sends MIDI Start message and begins clock pulse generation
   */
  start(): void {
    if (this.isRunning) {
      console.warn('MIDI Clock already running');
      return;
    }

    this.isRunning = true;
    this.nextClockTime = performance.now();

    // Send MIDI Start message
    this.midiManager.sendStart(this.nextClockTime);

    // Begin clock pulse chain
    this.scheduleNextClock();

    console.log(`MIDI Clock started at ${this.bpm} BPM (24 PPQ)`);
  }

  /**
   * Stop the MIDI clock
   * Sends MIDI Stop message and halts clock pulse generation
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    // Send MIDI Stop message
    this.midiManager.sendStop();

    console.log('MIDI Clock stopped');
  }

  /**
   * Set the tempo
   * Takes effect on the next clock pulse (no restart needed)
   */
  setBPM(bpm: number): void {
    if (bpm <= 0) {
      console.warn(`Invalid BPM: ${bpm}. Must be > 0`);
      return;
    }

    this.bpm = bpm;
  }

  /**
   * Get current tempo
   */
  getBPM(): number {
    return this.bpm;
  }

  /**
   * Check if clock is running
   */
  get running(): boolean {
    return this.isRunning;
  }

  /**
   * Schedule the next clock pulse (chaining pattern)
   */
  private scheduleNextClock(): void {
    if (!this.isRunning) {
      return;
    }

    // Calculate timing for next clock pulse
    // MIDI spec: 24 clock pulses per quarter note
    const msPerQuarter = (60 / this.bpm) * 1000;
    const msPerClock = msPerQuarter / 24;

    // Capture current clock time in closure (before incrementing)
    const clockTime = this.nextClockTime;

    // Schedule the clock event
    this.scheduler.scheduleEvent(() => {
      // Send MIDI Clock message (0xF8) with correct timestamp
      this.midiManager.sendClock(clockTime);

      // Chain: schedule the next clock
      this.scheduleNextClock();
    }, clockTime);

    // Update next clock time for subsequent scheduling
    this.nextClockTime += msPerClock;
  }
}
