/**
 * Grid configuration constants
 *
 * Single source of truth for grid dimensions and styling.
 */

// Grid dimensions
export const STEPS_PER_BAR = 16;
export const STEPS_PER_QUARTER = 4;
export const SEMITONES_PER_OCTAVE = 12;

// Default grid size
export const DEFAULT_BARS = 4;
export const DEFAULT_OCTAVES = 3;

// Grid limits
export const MIN_BARS = 1;
export const MAX_BARS = 128;
export const MIN_OCTAVES = 1;
export const MAX_OCTAVES = 10;

// MIDI range (for note mapping)
export const BASE_MIDI = 36; // C2 - starting MIDI note
export const MAX_MIDI = BASE_MIDI + (MAX_OCTAVES * SEMITONES_PER_OCTAVE) - 1;

// Line width scale factor (CSS width of 1 = 0.02 world units)
export const LINE_WIDTH_SCALE = 0.02;

/**
 * Grid configuration interface
 */
export interface GridConfig {
  minBars: number;
  maxBars: number;
  defaultBars: number;
  minOctaves: number;
  maxOctaves: number;
  defaultOctaves: number;
  stepsPerBar: number;
  stepsPerQuarter: number;
  semitonesPerOctave: number;
}

/**
 * Default grid configuration
 */
export const DEFAULT_GRID_CONFIG: GridConfig = {
  minBars: MIN_BARS,
  maxBars: MAX_BARS,
  defaultBars: DEFAULT_BARS,
  minOctaves: MIN_OCTAVES,
  maxOctaves: MAX_OCTAVES,
  defaultOctaves: DEFAULT_OCTAVES,
  stepsPerBar: STEPS_PER_BAR,
  stepsPerQuarter: STEPS_PER_QUARTER,
  semitonesPerOctave: SEMITONES_PER_OCTAVE,
};

/**
 * Line styles interface
 */
export interface LineStyle {
  color: string;
  width: number;
}

/**
 * Grid line styles
 */
export interface GridLineStyles {
  barLine: LineStyle;
  quarterLine: LineStyle;
  stepLine: LineStyle;
  octaveLine: LineStyle;
  semitoneLine: LineStyle;
}

/**
 * Load line styles from CSS custom properties
 */
export function loadLineStyles(): GridLineStyles {
  const root = document.documentElement;
  const style = getComputedStyle(root);

  return {
    barLine: {
      color: style.getPropertyValue('--bar-line-color').trim() || '#e0e0e0',
      width: parseFloat(style.getPropertyValue('--bar-line-width')) || 3,
    },
    quarterLine: {
      color: style.getPropertyValue('--quarter-line-color').trim() || '#6a6a8a',
      width: parseFloat(style.getPropertyValue('--quarter-line-width')) || 2,
    },
    stepLine: {
      color: style.getPropertyValue('--step-line-color').trim() || '#3a3a4e',
      width: parseFloat(style.getPropertyValue('--step-line-width')) || 1,
    },
    octaveLine: {
      color: style.getPropertyValue('--octave-line-color').trim() || '#7a7a9a',
      width: parseFloat(style.getPropertyValue('--octave-line-width')) || 2,
    },
    semitoneLine: {
      color: style.getPropertyValue('--semitone-line-color').trim() || '#2e2e3e',
      width: parseFloat(style.getPropertyValue('--semitone-line-width')) || 1,
    },
  };
}

/**
 * Camera state for overlay synchronization
 */
export interface CameraState {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
