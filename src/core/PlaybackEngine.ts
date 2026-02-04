import type { Sequence } from './Sequence';
import type { MidiManager } from '@/midi/MidiManager';
import type { LookaheadScheduler } from '@/scheduler/LookaheadScheduler';
import { MidiClockGenerator } from '@/scheduler/MidiClockGenerator';

/**
 * Callback for playback position updates
 */
export type PlaybackPositionCallback = (step: number) => void;

/**
 * PlaybackEngine - Drives sequence playback with precise timing
 *
 * Uses lookahead scheduling to compensate for JavaScript timing drift.
 * Supports single sequence playback with loop markers.
 */
export class PlaybackEngine {
  private sequence: Sequence;
  private midiManager: MidiManager;
  private scheduler: LookaheadScheduler;
  private clockGenerator: MidiClockGenerator;

  // Playback state
  private _isPlaying = false;
  private _bpm = 120;
  private currentStep = 0;
  private nextStepTime = 0;

  // Position update callback
  private onPositionChange: PlaybackPositionCallback | null = null;

  constructor(sequence: Sequence, midiManager: MidiManager, scheduler: LookaheadScheduler) {
    this.sequence = sequence;
    this.midiManager = midiManager;
    this.scheduler = scheduler;
    this.clockGenerator = new MidiClockGenerator(scheduler, midiManager);
    this.clockGenerator.setBPM(this._bpm);
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

    // Reset to loop start
    const markers = this.sequence.getLoopMarkers();
    this.currentStep = markers.start;

    // Initialize timing
    this.nextStepTime = performance.now();

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
   * Set tempo
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
   * Get current playback step
   */
  getCurrentStep(): number {
    return this.currentStep;
  }

  /**
   * Schedule the next step
   */
  private scheduleNextStep(): void {
    if (!this._isPlaying) {
      return;
    }

    // Get notes at current step
    const notes = this.sequence.getNotesAt(this.currentStep);
    const channel = this.sequence.getMidiChannel();

    // Schedule each note
    for (const note of notes) {
      const durationMs = this.stepDurationMs() * note.duration;

      // Schedule note on
      this.scheduler.scheduleEvent(() => {
        this.midiManager.sendNoteOn(channel, note.pitch, note.velocity);
      }, this.nextStepTime);

      // Schedule note off
      this.scheduler.scheduleEvent(() => {
        this.midiManager.sendNoteOff(channel, note.pitch);
      }, this.nextStepTime + durationMs);
    }

    // Notify position change
    const stepForCallback = this.currentStep;
    this.scheduler.scheduleEvent(() => {
      if (this.onPositionChange && this._isPlaying) {
        this.onPositionChange(stepForCallback);
      }
    }, this.nextStepTime);

    // Advance to next step
    this.currentStep = this.sequence.getNextStep(this.currentStep);

    // Calculate next step time
    this.nextStepTime += this.stepDurationMs();

    // Schedule next tick with 100ms lookahead
    const scheduleTime = this.nextStepTime - 100;
    this.scheduler.scheduleEvent(() => this.scheduleNextStep(), scheduleTime);
  }

  /**
   * Calculate duration of one step in milliseconds
   * 16 steps per 4 beats = 4 steps per beat (each step is a 16th note)
   */
  private stepDurationMs(): number {
    const msPerBeat = (60 / this._bpm) * 1000;
    return msPerBeat / 4; // 4 steps per beat
  }
}
