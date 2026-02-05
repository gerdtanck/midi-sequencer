import type { Sequence } from './Sequence';
import type { MidiManager } from '@/midi/MidiManager';
import type { LookaheadScheduler } from '@/scheduler/LookaheadScheduler';
import { MidiClockGenerator } from '@/scheduler/MidiClockGenerator';
import { SUBSTEPS_PER_STEP } from '@/config/GridConfig';
import { snapToSubstep } from '@/utils';

/**
 * Callback for playback position updates
 */
export type PlaybackPositionCallback = (step: number) => void;

/**
 * Per-sequence playback state
 */
interface SequenceState {
  currentStep: number;
  nextStepTime: number;
}

/**
 * PlaybackEngine - Drives sequence playback with precise timing
 *
 * Supports multiple sequences playing simultaneously, each with:
 * - Independent loop markers
 * - Independent MIDI channel
 * - Shared BPM (tempo is global)
 */
export class PlaybackEngine {
  private sequences: Sequence[];
  private midiManager: MidiManager;
  private scheduler: LookaheadScheduler;
  private clockGenerator: MidiClockGenerator;

  // Active sequence for UI display
  private activeIndex = 0;

  // Per-sequence playback state
  private states: SequenceState[];

  // Global playback state
  private _isPlaying = false;
  private _bpm = 120;

  // Position update callback (reports active sequence position)
  private onPositionChange: PlaybackPositionCallback | null = null;

  constructor(sequences: Sequence[], midiManager: MidiManager, scheduler: LookaheadScheduler) {
    this.sequences = sequences;
    this.midiManager = midiManager;
    this.scheduler = scheduler;
    this.clockGenerator = new MidiClockGenerator(scheduler, midiManager);
    this.clockGenerator.setBPM(this._bpm);

    // Initialize per-sequence state
    this.states = sequences.map(() => ({ currentStep: 0, nextStepTime: 0 }));
  }

  /**
   * Set which sequence is "active" (for UI position reporting)
   */
  setActiveSequence(index: number): void {
    if (index >= 0 && index < this.sequences.length) {
      this.activeIndex = index;
    }
  }

  /**
   * Get active sequence index
   */
  getActiveIndex(): number {
    return this.activeIndex;
  }

  /**
   * Set callback for playback position changes
   */
  setPositionCallback(callback: PlaybackPositionCallback): void {
    this.onPositionChange = callback;
  }

  /**
   * Start playback
   */
  start(): void {
    if (this._isPlaying) {
      console.warn('PlaybackEngine already playing');
      return;
    }

    this._isPlaying = true;

    // Initialize all sequence states to their loop starts
    const now = performance.now();
    for (let i = 0; i < this.sequences.length; i++) {
      const markers = this.sequences[i].getLoopMarkers();
      this.states[i].currentStep = markers.start;
      this.states[i].nextStepTime = now;
    }

    // Start scheduler if not already running
    if (!this.scheduler.isRunning) {
      this.scheduler.start();
    }

    // Start MIDI clock
    this.clockGenerator.start();

    // Begin playback loop
    this.scheduleNextStep();

    console.log(`PlaybackEngine started at ${this._bpm} BPM`);
  }

  /**
   * Stop playback
   */
  stop(): void {
    if (!this._isPlaying) {
      return;
    }

    this._isPlaying = false;

    // Stop MIDI clock
    this.clockGenerator.stop();

    // Clear scheduled events
    this.scheduler.clearEvents();

    // Silence all notes
    this.midiManager.panic();

    // Notify position change (reset indicator)
    if (this.onPositionChange) {
      this.onPositionChange(-1); // -1 indicates stopped
    }

    console.log('PlaybackEngine stopped');
  }

  /**
   * Set tempo (global for all sequences)
   */
  setBPM(bpm: number): void {
    if (bpm <= 0 || bpm > 300) {
      console.warn(`Invalid BPM: ${bpm}. Must be 1-300`);
      return;
    }

    this._bpm = bpm;
    this.clockGenerator.setBPM(bpm);
    console.log(`PlaybackEngine BPM set to ${bpm}`);
  }

  /**
   * Get current tempo
   */
  getBPM(): number {
    return this._bpm;
  }

  /**
   * Check if playback is active
   */
  get isPlaying(): boolean {
    return this._isPlaying;
  }

  /**
   * Get current playback step for active sequence
   */
  getCurrentStep(): number {
    return this.states[this.activeIndex].currentStep;
  }

  /**
   * Schedule the next substep for all sequences
   */
  private scheduleNextStep(): void {
    if (!this._isPlaying) {
      return;
    }

    // Find the earliest next step time across all sequences
    let earliestTime = Infinity;
    for (const state of this.states) {
      if (state.nextStepTime < earliestTime) {
        earliestTime = state.nextStepTime;
      }
    }

    // Process all sequences that are due at this time
    for (let i = 0; i < this.sequences.length; i++) {
      const state = this.states[i];
      if (Math.abs(state.nextStepTime - earliestTime) < 0.1) {
        this.scheduleSequenceStep(i);
      }
    }

    // Schedule next tick with 100ms lookahead
    const nextEarliestTime = Math.min(...this.states.map((s) => s.nextStepTime));
    const scheduleTime = nextEarliestTime - 100;
    this.scheduler.scheduleEvent(() => this.scheduleNextStep(), scheduleTime);
  }

  /**
   * Schedule notes for a single sequence at its current step
   */
  private scheduleSequenceStep(index: number): void {
    const seq = this.sequences[index];
    const state = this.states[index];

    // Snap current step to avoid floating point drift
    const snappedStep = snapToSubstep(state.currentStep);

    // Get notes at current substep position
    const notes = seq.getNotesAt(snappedStep);
    const channel = seq.getMidiChannel();

    // Schedule each note with precise timestamps
    const noteOnTime = state.nextStepTime;
    for (const note of notes) {
      // Duration is relative to full steps, convert to ms
      const durationMs = this.fullStepDurationMs() * note.duration;
      const noteOffTime = noteOnTime + durationMs;

      // Schedule note on with timestamp for precise timing
      this.scheduler.scheduleEvent(() => {
        this.midiManager.sendNoteOn(channel, note.pitch, note.velocity, noteOnTime);
      }, noteOnTime);

      // Schedule note off with timestamp for precise timing
      this.scheduler.scheduleEvent(() => {
        this.midiManager.sendNoteOff(channel, note.pitch, noteOffTime);
      }, noteOffTime);
    }

    // Notify position change for active sequence only (on full steps)
    if (index === this.activeIndex && Number.isInteger(snappedStep)) {
      const stepForCallback = snappedStep;
      this.scheduler.scheduleEvent(() => {
        if (this.onPositionChange && this._isPlaying) {
          this.onPositionChange(stepForCallback);
        }
      }, state.nextStepTime);
    }

    // Advance this sequence's position (respecting its loop markers)
    state.currentStep = this.getNextSubstep(seq, snappedStep);

    // Calculate next substep time for this sequence
    state.nextStepTime += this.substepDurationMs();
  }

  /**
   * Get the next substep for a sequence, handling loop boundaries
   */
  private getNextSubstep(sequence: Sequence, currentSubstep: number): number {
    const substepIncrement = 1 / SUBSTEPS_PER_STEP;
    const nextSubstep = snapToSubstep(currentSubstep + substepIncrement);

    const markers = sequence.getLoopMarkers();
    if (nextSubstep >= markers.end) {
      return markers.start;
    }
    return nextSubstep;
  }

  /**
   * Calculate duration of one full step in milliseconds
   * 16 steps per 4 beats = 4 steps per beat (each step is a 16th note)
   */
  private fullStepDurationMs(): number {
    const msPerBeat = (60 / this._bpm) * 1000;
    return msPerBeat / 4; // 4 steps per beat
  }

  /**
   * Calculate duration of one substep in milliseconds
   */
  private substepDurationMs(): number {
    return this.fullStepDurationMs() / SUBSTEPS_PER_STEP;
  }
}
