/**
 * Represents a MIDI note event in the sequencer
 */
export interface Note {
  /** MIDI note number (0-127) */
  pitch: number;
  /** Velocity (0-127, where 0 = note off) */
  velocity: number;
  /** Duration as multiplier of step length (e.g., 1.0 = full step, 0.8 = 80% of step) */
  duration: number;
  /** Original pitch where note was placed (used for scale quantization) */
  originalPitch?: number;
}

/**
 * Defines loop boundaries for the sequence
 */
export interface LoopMarkers {
  /** Start step (inclusive) */
  start: number;
  /** End step (exclusive) - playhead wraps to start when reaching this step */
  end: number;
}

/**
 * MIDI channel range (0-15)
 */
export type MidiChannel = number & { __brand: 'MidiChannel' };

/**
 * Validate and create a MIDI channel value
 * @param channel Channel number (0-15)
 * @returns Typed MIDI channel
 * @throws Error if channel is out of range
 */
export function createMidiChannel(channel: number): MidiChannel {
  if (channel < 0 || channel > 15) {
    throw new Error(`MIDI channel must be 0-15, got ${channel}`);
  }
  return channel as MidiChannel;
}
