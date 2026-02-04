import type { LookaheadScheduler } from './LookaheadScheduler';
import type { MidiManager } from '../midi/MidiManager';

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

  /**
   * Create a MIDI clock generator
   * @param scheduler LookaheadScheduler instance for precise timing
   * @param midiManager MidiManager instance for sending MIDI messages
   */
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
      console.warn('MIDI Clock not running');
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
   * @param bpm Beats per minute (typical range: 40-240)
   */
  setBPM(bpm: number): void {
    if (bpm <= 0) {
      console.warn(`Invalid BPM: ${bpm}. Must be > 0`);
      return;
    }

    this.bpm = bpm;
    console.log(`MIDI Clock BPM set to ${bpm}`);
  }

  /**
   * Get current tempo
   * @returns Beats per minute
   */
  getBPM(): number {
    return this.bpm;
  }

  /**
   * Check if clock is running
   * @returns true if clock is active
   */
  get running(): boolean {
    return this.isRunning;
  }

  /**
   * Schedule the next clock pulse (chaining pattern)
   * Each clock pulse schedules the next one, creating a self-sustaining chain
   * that adapts to BPM changes immediately
   */
  private scheduleNextClock(): void {
    if (!this.isRunning) {
      return;
    }

    // Calculate timing for next clock pulse
    // MIDI spec: 24 clock pulses per quarter note
    const msPerQuarter = (60 / this.bpm) * 1000; // milliseconds per quarter note
    const msPerClock = msPerQuarter / 24; // milliseconds per clock pulse

    // Schedule the clock event
    this.scheduler.scheduleEvent(() => {
      // Send MIDI Clock message (0xF8)
      this.midiManager.sendClock(this.nextClockTime);

      // Chain: schedule the next clock
      this.scheduleNextClock();
    }, this.nextClockTime);

    // Update next clock time
    this.nextClockTime += msPerClock;
  }
}
