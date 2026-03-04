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
  /** If present, this is a CC automation event instead of a note */
  cc?: { controller: number; value: number };
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
 * Callback for sequence change notifications
 */
export type SequenceChangeListener = () => void;
