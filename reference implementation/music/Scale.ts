/**
 * Musical scale definitions and utilities
 */

/**
 * Scale definition with name and intervals
 */
export interface ScaleDefinition {
  name: string;
  intervals: number[]; // Semitone intervals from root (e.g., [0, 2, 4, 5, 7, 9, 11] for major)
}

/**
 * Common musical scales
 */
export const SCALES: Record<string, ScaleDefinition> = {
  chromatic: {
    name: 'Chromatic',
    intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
  },
  major: {
    name: 'Major',
    intervals: [0, 2, 4, 5, 7, 9, 11]
  },
  minor: {
    name: 'Natural Minor',
    intervals: [0, 2, 3, 5, 7, 8, 10]
  },
  harmonicMinor: {
    name: 'Harmonic Minor',
    intervals: [0, 2, 3, 5, 7, 8, 11]
  },
  melodicMinor: {
    name: 'Melodic Minor',
    intervals: [0, 2, 3, 5, 7, 9, 11]
  },
  dorian: {
    name: 'Dorian',
    intervals: [0, 2, 3, 5, 7, 9, 10]
  },
  phrygian: {
    name: 'Phrygian',
    intervals: [0, 1, 3, 5, 7, 8, 10]
  },
  lydian: {
    name: 'Lydian',
    intervals: [0, 2, 4, 6, 7, 9, 11]
  },
  mixolydian: {
    name: 'Mixolydian',
    intervals: [0, 2, 4, 5, 7, 9, 10]
  },
  pentatonicMajor: {
    name: 'Pentatonic Major',
    intervals: [0, 2, 4, 7, 9]
  },
  pentatonicMinor: {
    name: 'Pentatonic Minor',
    intervals: [0, 3, 5, 7, 10]
  },
  blues: {
    name: 'Blues',
    intervals: [0, 3, 5, 6, 7, 10]
  },
  wholeTone: {
    name: 'Whole Tone',
    intervals: [0, 2, 4, 6, 8, 10]
  },
  diminished: {
    name: 'Diminished',
    intervals: [0, 2, 3, 5, 6, 8, 9, 11]
  }
};

/**
 * Note names (12 chromatic notes)
 */
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Get note name from MIDI number
 * @param midiNote MIDI note number (0-127)
 * @returns Note name with octave (e.g., "C4", "A#5")
 */
export function getMidiNoteName(midiNote: number): string {
  const octave = Math.floor(midiNote / 12) - 1;
  const noteIndex = midiNote % 12;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

/**
 * Check if a MIDI note is in the given scale
 * @param midiNote MIDI note number
 * @param rootNote Root note (0-11, where 0=C, 1=C#, etc.)
 * @param scale Scale definition
 * @returns true if note is in scale
 */
export function isNoteInScale(midiNote: number, rootNote: number, scale: ScaleDefinition): boolean {
  // Get note's pitch class (0-11)
  const pitchClass = midiNote % 12;

  // Calculate interval from root
  const interval = (pitchClass - rootNote + 12) % 12;

  // Check if interval is in scale
  return scale.intervals.includes(interval);
}

/**
 * Get all scale note keys
 * @returns Array of scale keys for dropdown
 */
export function getScaleKeys(): string[] {
  return Object.keys(SCALES);
}

/**
 * Get scale definition by key
 * @param key Scale key (e.g., 'major', 'minor')
 * @returns Scale definition
 */
export function getScale(key: string): ScaleDefinition {
  return SCALES[key] || SCALES.chromatic;
}

/**
 * Get all notes in a scale within a range
 * @param rootNote Root note (0-11)
 * @param scale Scale definition
 * @param minMidi Minimum MIDI note
 * @param maxMidi Maximum MIDI note
 * @returns Array of MIDI notes in scale within range
 */
export function getScaleNotesInRange(
  rootNote: number,
  scale: ScaleDefinition,
  minMidi: number,
  maxMidi: number
): number[] {
  const notes: number[] = [];

  for (let midi = minMidi; midi <= maxMidi; midi++) {
    if (isNoteInScale(midi, rootNote, scale)) {
      notes.push(midi);
    }
  }

  return notes;
}

/**
 * Find nearest in-scale MIDI note
 * @param midiNote MIDI note to quantize
 * @param rootNote Root note (0-11)
 * @param scale Scale definition
 * @returns Nearest in-scale MIDI note (prefers lower pitch on ties)
 */
export function quantizeToScale(
  midiNote: number,
  rootNote: number,
  scale: ScaleDefinition
): number {
  // If already in scale, return as-is
  if (isNoteInScale(midiNote, rootNote, scale)) {
    return midiNote;
  }

  // Search up and down simultaneously
  let distanceUp = 1;
  let distanceDown = 1;
  let foundUp: number | null = null;
  let foundDown: number | null = null;

  // Search within reasonable range (2 octaves up/down should be enough)
  const maxDistance = 24;

  while (distanceUp <= maxDistance || distanceDown <= maxDistance) {
    // Check below
    if (distanceDown <= maxDistance && foundDown === null) {
      const candidate = midiNote - distanceDown;
      if (candidate >= 0 && isNoteInScale(candidate, rootNote, scale)) {
        foundDown = candidate;
      } else {
        distanceDown++;
      }
    }

    // Check above
    if (distanceUp <= maxDistance && foundUp === null) {
      const candidate = midiNote + distanceUp;
      if (candidate <= 127 && isNoteInScale(candidate, rootNote, scale)) {
        foundUp = candidate;
      } else {
        distanceUp++;
      }
    }

    // Both found - compare distances
    if (foundDown !== null && foundUp !== null) {
      const distToDown = midiNote - foundDown;
      const distToUp = foundUp - midiNote;

      // If equal distance, prefer lower pitch
      if (distToDown <= distToUp) {
        return foundDown;
      } else {
        return foundUp;
      }
    }

    // Only one found
    if (foundDown !== null && foundUp === null) {
      return foundDown;
    }
    if (foundUp !== null && foundDown === null) {
      return foundUp;
    }
  }

  // Fallback (should never reach here for valid scales)
  console.warn(`Could not quantize MIDI note ${midiNote} to scale`);
  return midiNote;
}
