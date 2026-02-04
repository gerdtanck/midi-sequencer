/**
 * Central configuration for grid dimensions and musical parameters
 *
 * SINGLE SOURCE OF TRUTH for all grid-related values.
 * Changing values here updates the entire application.
 *
 * Usage:
 * ```typescript
 * import { ROWS, STEPS, MAX_PITCH, BASE_MIDI } from '../config/GridConfig';
 *
 * for (let pitch = MAX_PITCH; pitch >= 0; pitch--) {
 *   for (let step = 0; step < STEPS; step++) {
 *     // ...
 *   }
 * }
 * ```
 */

/**
 * Grid configuration object
 * All grid dimensions and musical parameters in one place
 */
export const GRID_CONFIG = {
  // ==================== GRID DIMENSIONS ====================

  /** Number of visible pitch rows in the grid (5 octaves = 60 semitones) */
  rows: 60,

  /** Number of time steps (columns) in the grid (full sequencer) */
  steps: 128,

  /** Total steps in full grid (for Canvas viewport) */
  totalSteps: 128,

  /** Total rows in full grid (5 octaves: C0-C4 = 60 semitones) */
  totalRows: 60,

  // ==================== MUSICAL PARAMETERS ====================

  /** Base MIDI note (C4 = middle C = MIDI note 60) */
  baseMidiNote: 60,

  // ==================== VISUAL DIMENSIONS ====================

  /** Width of each grid cell in pixels - MOBILE OPTIMIZED */
  cellWidth: 32,

  /** Height of each grid cell in pixels - MOBILE OPTIMIZED */
  cellHeight: 32,

  /** Gap between grid cells in pixels */
  gridGap: 1,

  // ==================== ZOOM CONFIGURATION ====================

  /** Minimum zoom level (50% - overview) */
  minZoom: 0.5,

  /** Maximum zoom level (400% - detail) */
  maxZoom: 4.0,

  /** Default zoom level (100% - 1:1) */
  defaultZoom: 1.0,

  // ==================== DERIVED VALUES ====================
  // Auto-calculated from above values - do not set manually

  /** Maximum pitch index (rows - 1) */
  get maxPitch(): number {
    return this.rows - 1;
  },

  /** Maximum step index (steps - 1) */
  get maxStep(): number {
    return this.steps - 1;
  },

  /** Maximum total step index (totalSteps - 1) */
  get maxTotalStep(): number {
    return this.totalSteps - 1;
  },

  /** Maximum total pitch index (totalRows - 1) */
  get maxTotalPitch(): number {
    return this.totalRows - 1;
  },

  /** Maximum MIDI note value (baseMidiNote + maxPitch) */
  get maxMidiNote(): number {
    return this.baseMidiNote + this.maxPitch;
  },

  /** Total grid width in pixels (including gaps) */
  get totalWidth(): number {
    return this.steps * this.cellWidth + (this.steps - 1) * this.gridGap;
  },

  /** Total grid height in pixels (including gaps) */
  get totalHeight(): number {
    return this.rows * this.cellHeight + (this.rows - 1) * this.gridGap;
  },

  // ==================== CSS VARIABLES ====================

  /**
   * Generate CSS custom properties from config
   * Use this to inject values into CSS at runtime
   */
  toCSSVariables(): Record<string, string> {
    return {
      '--grid-rows': this.rows.toString(),
      '--grid-steps': this.steps.toString(),
      '--cell-width': `${this.cellWidth}px`,
      '--cell-height': `${this.cellHeight}px`,
      '--grid-gap': `${this.gridGap}px`,
    };
  },
} as const;

// ==================== EXPORTED CONSTANTS ====================
// Import these for cleaner code

/** Number of rows in grid */
export const ROWS = GRID_CONFIG.rows;

/** Number of steps/columns in grid */
export const STEPS = GRID_CONFIG.steps;

/** Maximum pitch index (0-based, so ROWS - 1) */
export const MAX_PITCH = GRID_CONFIG.maxPitch;

/** Maximum step index (0-based, so STEPS - 1) */
export const MAX_STEP = GRID_CONFIG.maxStep;

/** Base MIDI note (C4 = 60) */
export const BASE_MIDI = GRID_CONFIG.baseMidiNote;

/** Maximum MIDI note (BASE_MIDI + MAX_PITCH) */
export const MAX_MIDI = GRID_CONFIG.maxMidiNote;

/** Cell width in pixels */
export const CELL_WIDTH = GRID_CONFIG.cellWidth;

/** Cell height in pixels */
export const CELL_HEIGHT = GRID_CONFIG.cellHeight;

/** Grid gap in pixels */
export const GRID_GAP = GRID_CONFIG.gridGap;

/** Total steps in full grid (Canvas viewport) */
export const TOTAL_STEPS = GRID_CONFIG.totalSteps;

/** Total rows in full grid (Canvas viewport) */
export const TOTAL_ROWS = GRID_CONFIG.totalRows;

/** Maximum total step index (0-based) */
export const MAX_TOTAL_STEP = GRID_CONFIG.maxTotalStep;

/** Maximum total pitch index (0-based) */
export const MAX_TOTAL_PITCH = GRID_CONFIG.maxTotalPitch;

/** Minimum zoom level */
export const MIN_ZOOM = GRID_CONFIG.minZoom;

/** Maximum zoom level */
export const MAX_ZOOM = GRID_CONFIG.maxZoom;

/** Default zoom level */
export const DEFAULT_ZOOM = GRID_CONFIG.defaultZoom;

// ==================== VALIDATION ====================

/**
 * Validate configuration at runtime
 * Call this during app initialization to catch invalid configs early
 */
export function validateGridConfig(): void {
  const errors: string[] = [];

  if (ROWS <= 0) errors.push('ROWS must be positive');
  if (STEPS <= 0) errors.push('STEPS must be positive');
  if (BASE_MIDI < 0 || BASE_MIDI > 127) errors.push('BASE_MIDI must be 0-127');
  if (CELL_WIDTH <= 0) errors.push('CELL_WIDTH must be positive');
  if (CELL_HEIGHT <= 0) errors.push('CELL_HEIGHT must be positive');
  if (GRID_GAP < 0) errors.push('GRID_GAP must be non-negative');

  // Zoom configuration validation
  if (MIN_ZOOM <= 0) errors.push('MIN_ZOOM must be positive');
  if (MAX_ZOOM <= MIN_ZOOM) errors.push('MAX_ZOOM must be greater than MIN_ZOOM');
  if (DEFAULT_ZOOM < MIN_ZOOM || DEFAULT_ZOOM > MAX_ZOOM) {
    errors.push(`DEFAULT_ZOOM (${DEFAULT_ZOOM}) must be between MIN_ZOOM (${MIN_ZOOM}) and MAX_ZOOM (${MAX_ZOOM})`);
  }

  // Verify derived values
  if (MAX_PITCH !== ROWS - 1) errors.push(`MAX_PITCH (${MAX_PITCH}) should equal ROWS - 1 (${ROWS - 1})`);
  if (MAX_STEP !== STEPS - 1) errors.push(`MAX_STEP (${MAX_STEP}) should equal STEPS - 1 (${STEPS - 1})`);
  if (MAX_MIDI !== BASE_MIDI + MAX_PITCH) {
    errors.push(`MAX_MIDI (${MAX_MIDI}) should equal BASE_MIDI + MAX_PITCH (${BASE_MIDI + MAX_PITCH})`);
  }

  if (errors.length > 0) {
    throw new Error(`Grid configuration validation failed:\n${errors.join('\n')}`);
  }

  console.log('✓ Grid configuration validated successfully');
  console.log(`  Grid: ${ROWS} rows × ${STEPS} steps`);
  console.log(`  MIDI: ${BASE_MIDI}-${MAX_MIDI} (${BASE_MIDI} + ${MAX_PITCH})`);
  console.log(`  Cells: ${CELL_WIDTH}×${CELL_HEIGHT}px, gap: ${GRID_GAP}px`);
  console.log(`  Zoom: ${MIN_ZOOM}× to ${MAX_ZOOM}× (default: ${DEFAULT_ZOOM}×)`);
}
