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

  constructor(
    sequence: Sequence,
    step: number,
    pitch: number,
    velocity: number,
    duration: number,
    originalPitch?: number
  ) {
    this.sequence = sequence;
    this.step = step;
    this.pitch = pitch;
    this.velocity = velocity;
    this.duration = duration;
    this.originalPitch = originalPitch ?? pitch; // Default to pitch if not specified
    this.description = `Add note at step ${step}`;
  }

  execute(): void {
    this.sequence.addNote(this.step, this.pitch, this.velocity, this.duration, this.originalPitch);
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

  constructor(sequence: Sequence, step: number, pitch: number, note: Note) {
    this.sequence = sequence;
    this.step = step;
    this.pitch = pitch;
    this.velocity = note.velocity;
    this.duration = note.duration;
    this.description = `Remove note at step ${step}`;
  }

  execute(): void {
    this.sequence.removeNote(this.step, this.pitch);
  }

  undo(): void {
    this.sequence.addNote(this.step, this.pitch, this.velocity, this.duration);
  }
}
