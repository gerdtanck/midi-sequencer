import type { Sequence } from './Sequence';

export interface RecordingResult {
  notes: Array<{ step: number; pitch: number; velocity: number; duration: number }>;
  ccEvents: Array<{ step: number; pitch: number; controller: number; value: number }>;
}

/**
 * Central recording coordinator.
 * Manages record arm state, captures incoming MIDI, and converts to sequence events.
 * Overdub-only: recording requires playback to be running.
 */
export class RecordingManager {
  private sequence: Sequence | null = null;
  private armed = false;
  private recording = false;
  private recordedNotes: Array<{ step: number; pitch: number; velocity: number; duration: number }> = [];
  private recordedCC: Array<{ step: number; pitch: number; controller: number; value: number }> = [];
  private activeInputNotes: Map<number, { step: number; velocity: number }> = new Map();
  private ccRowMap: Map<number, number> = new Map();
  private nextCCRow = 0;

  private getCurrentStep: (() => number) | null = null;
  private getScreenCenterPitch: (() => number) | null = null;
  private isPlaybackRunning: (() => boolean) | null = null;
  private midiThruCallback: ((message: number[]) => void) | null = null;
  private onStateChange: (() => void) | null = null;

  setSequence(seq: Sequence): void {
    this.sequence = seq;
  }

  setStepProvider(fn: () => number): void {
    this.getCurrentStep = fn;
  }

  setScreenCenterProvider(fn: () => number): void {
    this.getScreenCenterPitch = fn;
  }

  setPlaybackStateProvider(fn: () => boolean): void {
    this.isPlaybackRunning = fn;
  }

  setMidiThruCallback(fn: (msg: number[]) => void): void {
    this.midiThruCallback = fn;
  }

  setStateChangeCallback(fn: () => void): void {
    this.onStateChange = fn;
  }

  arm(): void {
    this.armed = true;
    // If playback is already running, start recording immediately
    if (this.isPlaybackRunning?.()) {
      this.startRecording();
    }
    this.onStateChange?.();
  }

  disarm(): void {
    this.armed = false;
    if (this.recording) {
      this.stopRecording();
    }
    this.onStateChange?.();
  }

  isArmed(): boolean {
    return this.armed;
  }

  isRecording(): boolean {
    return this.recording;
  }

  startRecording(): void {
    if (!this.armed || !this.sequence) return;
    this.recording = true;
    this.recordedNotes = [];
    this.recordedCC = [];
    this.activeInputNotes.clear();
    this.ccRowMap.clear();

    // Scan existing sequence to find note range and existing CC row assignments
    const allNotes = this.sequence.getAllNotes();
    let lowestNotePitch = Infinity;
    let lowestOccupiedRow = Infinity;

    for (const { notes } of allNotes) {
      for (const note of notes) {
        if (note.cc) {
          // Pre-populate ccRowMap from existing CC events
          const existing = this.ccRowMap.get(note.cc.controller);
          if (existing === undefined) {
            this.ccRowMap.set(note.cc.controller, note.pitch);
          }
          if (note.pitch < lowestOccupiedRow) {
            lowestOccupiedRow = note.pitch;
          }
        } else {
          if (note.pitch < lowestNotePitch) {
            lowestNotePitch = note.pitch;
          }
        }
      }
    }

    // nextCCRow = one below the lowest occupied row (note or CC)
    const lowestAnything = Math.min(lowestNotePitch, lowestOccupiedRow);
    if (lowestAnything !== Infinity) {
      this.nextCCRow = lowestAnything - 1;
    } else {
      this.nextCCRow = (this.getScreenCenterPitch?.() ?? 60) - 1;
    }

    this.onStateChange?.();
  }

  stopRecording(): RecordingResult {
    // Close any notes still held
    if (this.sequence && this.getCurrentStep) {
      for (const [pitch, info] of this.activeInputNotes) {
        const duration = 1;
        this.sequence.updateNote(info.step, pitch, { duration });
        this.recordedNotes.push({ step: info.step, pitch, velocity: info.velocity, duration });
      }
    }
    this.activeInputNotes.clear();

    this.recording = false;
    this.onStateChange?.();

    return {
      notes: [...this.recordedNotes],
      ccEvents: [...this.recordedCC],
    };
  }

  handleMidiMessage(message: number[]): void {
    if (message.length < 2) return;

    const statusByte = message[0];
    const type = statusByte & 0xf0;

    // MIDI thru: echo to output if armed (even if not yet recording)
    if (this.armed && this.midiThruCallback) {
      this.midiThruCallback(message);
    }

    if (!this.recording || !this.sequence || !this.getCurrentStep) return;

    const currentStep = this.getCurrentStep();

    if (type === 0x90 && message.length >= 3) {
      // Note On
      const pitch = message[1];
      const velocity = message[2];

      if (velocity > 0) {
        // Note On: add to sequence immediately for visual feedback
        this.activeInputNotes.set(pitch, { step: currentStep, velocity });
        this.sequence.addNote(currentStep, pitch, velocity, 1);
      } else {
        // Note On with velocity 0 = Note Off
        this.handleNoteOff(pitch, currentStep);
      }
    } else if (type === 0x80 && message.length >= 3) {
      // Note Off
      const pitch = message[1];
      this.handleNoteOff(pitch, currentStep);
    } else if (type === 0xb0 && message.length >= 3) {
      // CC
      const controller = message[1];
      const value = message[2];

      // Resolve row for this controller
      let row = this.ccRowMap.get(controller);
      if (row === undefined) {
        row = this.nextCCRow;
        this.ccRowMap.set(controller, row);
        this.nextCCRow--;
      }

      // Add CC event to sequence immediately for visual feedback
      this.sequence.addNote(currentStep, row, value, 1, undefined, { controller, value });
      this.recordedCC.push({ step: currentStep, pitch: row, controller, value });
    }
  }

  private handleNoteOff(pitch: number, currentStep: number): void {
    const info = this.activeInputNotes.get(pitch);
    if (!info || !this.sequence) return;

    // Calculate duration (minimum 1 step)
    let duration = currentStep - info.step;
    if (duration < 1) duration = 1;

    // Update note duration in sequence
    this.sequence.updateNote(info.step, pitch, { duration });

    this.recordedNotes.push({ step: info.step, pitch, velocity: info.velocity, duration });
    this.activeInputNotes.delete(pitch);
  }
}
