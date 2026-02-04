import type { Sequence } from './Sequence';
import type { MidiManager } from '../midi/MidiManager';
import type { LookaheadScheduler } from '../scheduler/LookaheadScheduler';
import type { MidiClockGenerator } from '../scheduler/MidiClockGenerator';

/**
 * Drives synchronized playback across all 4 sequences with independent loop lengths
 *
 * Each sequence can have different loop boundaries, creating polyrhythmic patterns.
 * Uses lookahead scheduling to compensate for JavaScript timing drift.
 */
export class PlaybackEngine {
  private sequences: Sequence[];
  private midiManager: MidiManager;
  private scheduler: LookaheadScheduler;
  private clockGen: MidiClockGenerator;

  /** Current playback state */
  private isPlaying: boolean = false;

  /** Current tempo in beats per minute */
  private bpm: number = 120;

  /** Current step position for each sequence (4 sequences) */
  private currentSteps: number[] = [0, 0, 0, 0];

  /** Next step time in milliseconds (from performance.now()) */
  private nextStepTime: number = 0;

  /**
   * Create a playback engine
   * @param sequences Array of 4 sequences to play
   * @param midiManager MidiManager for note output
   * @param scheduler LookaheadScheduler for precise timing
   * @param clockGen MidiClockGenerator for MIDI clock sync
   */
  constructor(
    sequences: Sequence[],
    midiManager: MidiManager,
    scheduler: LookaheadScheduler,
    clockGen: MidiClockGenerator
  ) {
    if (sequences.length !== 4) {
      throw new Error(`PlaybackEngine requires exactly 4 sequences, got ${sequences.length}`);
    }

    this.sequences = sequences;
    this.midiManager = midiManager;
    this.scheduler = scheduler;
    this.clockGen = clockGen;
  }

  /**
   * Start playback of all sequences
   * Resets all sequences to their loop start positions
   */
  start(): void {
    if (this.isPlaying) {
      console.warn('PlaybackEngine already playing');
      return;
    }

    this.isPlaying = true;

    // Reset all sequences to their loop start positions
    for (let i = 0; i < this.sequences.length; i++) {
      const markers = this.sequences[i].getLoopMarkers();
      this.currentSteps[i] = markers.start;
    }

    // Initialize timing
    this.nextStepTime = performance.now();

    // Start MIDI clock
    this.clockGen.start();

    // Begin playback loop
    this.scheduleNextStep();

    console.log(`PlaybackEngine started at ${this.bpm} BPM`);
  }

  /**
   * Stop playback
   * Sends MIDI panic to silence all notes
   */
  stop(): void {
    if (!this.isPlaying) {
      console.warn('PlaybackEngine not playing');
      return;
    }

    this.isPlaying = false;

    // Stop MIDI clock
    this.clockGen.stop();

    // Emergency silence - prevent stuck notes
    this.midiManager.panic();

    console.log('PlaybackEngine stopped');
  }

  /**
   * Set the tempo
   * @param bpm Beats per minute (typical range: 40-240)
   */
  setBPM(bpm: number): void {
    if (bpm <= 0) {
      console.warn(`Invalid BPM: ${bpm}. Must be > 0`);
      return;
    }

    this.bpm = bpm;
    this.clockGen.setBPM(bpm);
    console.log(`PlaybackEngine BPM set to ${bpm}`);
  }

  /**
   * Get current tempo
   * @returns Beats per minute
   */
  getBPM(): number {
    return this.bpm;
  }

  /**
   * Get current step positions for all sequences
   * Used by UI for playback indicator visualization
   * @returns Array of current step indices (one per sequence)
   */
  getCurrentSteps(): number[] {
    return [...this.currentSteps]; // Return copy to prevent external mutation
  }

  /**
   * Check if playback is active
   * @returns true if playing
   */
  get playing(): boolean {
    return this.isPlaying;
  }

  /**
   * Schedule the next step for all sequences
   * Uses lookahead scheduling to compensate for JavaScript timing drift
   *
   * CRITICAL: Each sequence advances independently based on its own loop boundaries,
   * enabling polyrhythmic patterns (e.g., sequence 1 loops every 16 steps while
   * sequence 2 loops every 32 steps).
   */
  private scheduleNextStep(): void {
    if (!this.isPlaying) {
      return;
    }

    // Schedule notes for each sequence at current step
    for (let i = 0; i < this.sequences.length; i++) {
      const sequence = this.sequences[i];
      const currentStep = this.currentSteps[i];

      // Get all notes at this step
      const notes = sequence.getNotesAt(currentStep);

      // Schedule each note for MIDI output
      for (const note of notes) {
        const channel = sequence.getMidiChannel();
        // Duration: use note duration as-is (steps are already 16th notes)
        const durationMs = this.stepDurationMs() * note.duration;

        this.midiManager.scheduleNote(
          channel,
          note.pitch,
          note.velocity,
          this.nextStepTime,
          durationMs
        );
      }

      // Advance to next step (with loop wrapping)
      this.currentSteps[i] = sequence.getNextStep(currentStep);
    }

    // Calculate next step time
    this.nextStepTime += this.stepDurationMs();

    // Schedule next tick with 100ms lookahead
    // Lookahead compensates for GC pauses and background tab throttling
    const scheduleTime = this.nextStepTime - 100;
    this.scheduler.scheduleEvent(() => this.scheduleNextStep(), scheduleTime);
  }

  /**
   * Calculate duration of one step in milliseconds
   * 16 steps per 4 beats = 4 steps per beat (each step is a 16th note)
   * @returns Step duration in milliseconds
   */
  private stepDurationMs(): number {
    const msPerBeat = (60 / this.bpm) * 1000;
    return msPerBeat / 4; // 4 steps per beat (16 steps per 4 beats)
  }
}
