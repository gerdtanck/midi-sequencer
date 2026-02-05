/**
 * Scale definitions for the sequencer
 *
 * Each scale is defined by its intervals from the root note.
 * Intervals are in semitones (0 = root, 2 = whole step, etc.)
 */

export interface Scale {
  name: string;
  intervals: number[];
}

/**
 * Available scales
 * Chromatic acts as "no scale" - all 12 semitones included
 */
export const SCALES: Record<string, Scale> = {
  chromatic: {
    name: 'Chromatic',
    intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  },
  major: {
    name: 'Major',
    intervals: [0, 2, 4, 5, 7, 9, 11],
  },
  minor: {
    name: 'Minor (Natural)',
    intervals: [0, 2, 3, 5, 7, 8, 10],
  },
  harmonicMinor: {
    name: 'Harmonic Minor',
    intervals: [0, 2, 3, 5, 7, 8, 11],
  },
  melodicMinor: {
    name: 'Melodic Minor',
    intervals: [0, 2, 3, 5, 7, 9, 11],
  },
  pentatonicMajor: {
    name: 'Pentatonic Major',
    intervals: [0, 2, 4, 7, 9],
  },
  pentatonicMinor: {
    name: 'Pentatonic Minor',
    intervals: [0, 3, 5, 7, 10],
  },
  blues: {
    name: 'Blues',
    intervals: [0, 3, 5, 6, 7, 10],
  },
  dorian: {
    name: 'Dorian',
    intervals: [0, 2, 3, 5, 7, 9, 10],
  },
  phrygian: {
    name: 'Phrygian',
    intervals: [0, 1, 3, 5, 7, 8, 10],
  },
  lydian: {
    name: 'Lydian',
    intervals: [0, 2, 4, 6, 7, 9, 11],
  },
  mixolydian: {
    name: 'Mixolydian',
    intervals: [0, 2, 4, 5, 7, 9, 10],
  },
  locrian: {
    name: 'Locrian',
    intervals: [0, 1, 3, 5, 6, 8, 10],
  },
};

/**
 * Root note names for display
 */
export const ROOT_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export type RootNote = (typeof ROOT_NOTES)[number];

/**
 * Get scale key from scale object
 */
export function getScaleKey(scale: Scale): string | undefined {
  return Object.entries(SCALES).find(([_, s]) => s === scale)?.[0];
}
