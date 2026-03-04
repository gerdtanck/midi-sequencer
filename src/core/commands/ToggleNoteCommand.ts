import type { Command } from './Command';
import type { Sequence } from '../Sequence';
import type { Note } from '../types';

/**
 * Command to add a note at a specific position
 */
export class AddNoteCommand implements Command {
  readonly description: string;

  private sequence: Sequence;
  private step: number;
  private pitch: number;
  private velocity: number;
  private duration: number;
  private originalPitch: number;
  private cc?: { controller: number; value: number };

  constructor(
    sequence: Sequence,
    step: number,
    pitch: number,
    velocity: number,
    duration: number,
    originalPitch?: number,
    cc?: { controller: number; value: number }
  ) {
    this.sequence = sequence;
    this.step = step;
    this.pitch = pitch;
    this.velocity = velocity;
    this.duration = duration;
    this.originalPitch = originalPitch ?? pitch; // Default to pitch if not specified
    this.cc = cc;
    this.description = cc
      ? `Add CC ${cc.controller} at step ${step}`
      : `Add note at step ${step}`;
  }

  execute(): void {
    this.sequence.addNote(this.step, this.pitch, this.velocity, this.duration, this.originalPitch, this.cc);
  }

  undo(): void {
    this.sequence.removeNote(this.step, this.pitch);
  }
}

/**
 * Command to remove a note at a specific position
 */
export class RemoveNoteCommand implements Command {
  readonly description: string;

  private sequence: Sequence;
  private step: number;
  private pitch: number;
  private velocity: number;
  private duration: number;
  private originalPitch: number;
  private cc?: { controller: number; value: number };

  constructor(sequence: Sequence, step: number, pitch: number, note: Note) {
    this.sequence = sequence;
    this.step = step;
    this.pitch = pitch;
    this.velocity = note.velocity;
    this.duration = note.duration;
    this.originalPitch = note.originalPitch ?? pitch;
    this.cc = note.cc ? { ...note.cc } : undefined;
    this.description = note.cc
      ? `Remove CC ${note.cc.controller} at step ${step}`
      : `Remove note at step ${step}`;
  }

  execute(): void {
    this.sequence.removeNote(this.step, this.pitch);
  }

  undo(): void {
    this.sequence.addNote(this.step, this.pitch, this.velocity, this.duration, this.originalPitch, this.cc);
  }
}
