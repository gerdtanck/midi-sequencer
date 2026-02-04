/**
 * Grid configuration constants
 *
 * Single source of truth for grid dimensions and styling.
 */

// Grid dimensions
export const STEPS_PER_BAR = 16;
export const STEPS_PER_QUARTER = 4;
export const SEMITONES_PER_OCTAVE = 12;

// Substep resolution (6 = supports triplets and standard divisions)
export const SUBSTEPS_PER_STEP = 6;

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

// ============ Interaction Thresholds ============

// Mouse/touch thresholds
export const CLICK_THRESHOLD_PX = 5;           // Max movement to count as click (not drag)
export const DOUBLE_TAP_THRESHOLD_MS = 300;    // Max time between taps for double-tap
export const LONG_PRESS_DURATION_MS = 400;     // Hold duration to trigger long-press

// Note resize handle
export const HANDLE_ZONE_WIDTH = 0.33;         // Width of resize handle hit zone (world units)

// ============ Note Properties ============

// Duration limits
export const MIN_NOTE_DURATION = 0.1;          // Minimum note duration (fraction of step)
export const MAX_NOTE_DURATION = 8.0;          // Maximum note duration (steps)
export const DEFAULT_NOTE_DURATION = 0.8;      // Default duration for new notes

// Velocity
export const DEFAULT_NOTE_VELOCITY = 100;      // Default velocity (0-127)

// ============ Visual Constants ============

// Note colors (hex)
export const NOTE_COLOR = 0xe94560;            // Default note color (red/pink)
export const NOTE_SELECTED_COLOR = 0x4a9eff;   // Selected note color (blue)
export const HANDLE_COLOR = 0xffffff;          // Resize handle color (white)

// Z-positions (layering order)
export const NOTE_Z_POSITION = 0.5;            // Notes in front of grid lines
export const HANDLE_Z_POSITION = 0.6;          // Handles in front of notes
export const SELECTION_RECT_Z_POSITION = 2.0;  // Selection rectangle on top

// Selection rectangle
export const SELECTION_RECT_COLOR = 0x4a9eff;  // Selection rectangle color
export const SELECTION_RECT_OPACITY = 0.3;     // Selection rectangle transparency

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
