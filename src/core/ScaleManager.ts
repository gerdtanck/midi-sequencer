import { Scale, SCALES } from './Scale';

export type ScaleChangeListener = () => void;

/**
 * ScaleManager - Manages the active scale and provides scale-aware operations
 *
 * The scale system is always active. Chromatic scale acts as "no constraint"
 * since it includes all 12 semitones.
 */
export class ScaleManager {
  private _root: number = 0; // 0-11 (C=0, C#=1, etc.)
  private _scale: Scale = SCALES.chromatic;
  private _snapEnabled: boolean = false;

  private changeListeners: Set<ScaleChangeListener> = new Set();

  /**
   * Get current root note (0-11)
   */
  get root(): number {
    return this._root;
  }

  /**
   * Set root note (0-11)
   */
  set root(value: number) {
    const newRoot = ((value % 12) + 12) % 12; // Normalize to 0-11
    if (newRoot !== this._root) {
      this._root = newRoot;
      this.notifyChange();
    }
  }

  /**
   * Get current scale
   */
  get scale(): Scale {
    return this._scale;
  }

  /**
   * Set current scale
   */
  set scale(value: Scale) {
    if (value !== this._scale) {
      this._scale = value;
      this.notifyChange();
    }
  }

  /**
   * Get snap-to-scale enabled state
   */
  get snapEnabled(): boolean {
    return this._snapEnabled;
  }

  /**
   * Set snap-to-scale enabled state
   */
  set snapEnabled(value: boolean) {
    if (value !== this._snapEnabled) {
      this._snapEnabled = value;
      this.notifyChange();
    }
  }

  /**
   * Check if a MIDI pitch is in the current scale
   */
  isInScale(pitch: number): boolean {
    const pitchClass = ((pitch % 12) + 12) % 12;
    const interval = ((pitchClass - this._root) % 12 + 12) % 12;
    return this._scale.intervals.includes(interval);
  }

  /**
   * Get all scale pitches within a MIDI range
   */
  getScalePitches(minPitch: number, maxPitch: number): number[] {
    const pitches: number[] = [];
    for (let pitch = minPitch; pitch <= maxPitch; pitch++) {
      if (this.isInScale(pitch)) {
        pitches.push(pitch);
      }
    }
    return pitches;
  }

  /**
   * Get all pitches in the scale for a specific octave
   * @param octave MIDI octave (e.g., 3 for C3-B3)
   */
  getScaleNotesInOctave(octave: number): number[] {
    const basePitch = octave * 12;
    return this._scale.intervals.map(interval => basePitch + ((this._root + interval) % 12));
  }

  /**
   * Snap a pitch to the nearest scale note
   * Returns the original pitch if already in scale
   */
  snapToScale(pitch: number): number {
    if (this.isInScale(pitch)) {
      return pitch;
    }

    // Find nearest scale pitch
    let nearestBelow = pitch;
    let nearestAbove = pitch;

    while (nearestBelow >= 0 && !this.isInScale(nearestBelow)) {
      nearestBelow--;
    }

    while (nearestAbove <= 127 && !this.isInScale(nearestAbove)) {
      nearestAbove++;
    }

    // Return the closest one
    if (nearestBelow < 0) return nearestAbove;
    if (nearestAbove > 127) return nearestBelow;

    const distBelow = pitch - nearestBelow;
    const distAbove = nearestAbove - pitch;

    return distBelow <= distAbove ? nearestBelow : nearestAbove;
  }

  /**
   * Transpose a pitch by a number of scale degrees
   *
   * For in-scale notes: moves by scale degrees
   * For out-of-scale notes: snaps to scale first, then transposes
   *
   * @param pitch MIDI pitch to transpose
   * @param degrees Number of scale degrees to move (positive = up, negative = down)
   * @returns New pitch after transposition
   */
  transpose(pitch: number, degrees: number): number {
    if (degrees === 0) return pitch;

    // Snap to scale first if out of scale
    const snappedPitch = this.snapToScale(pitch);

    // Build ordered list of scale pitches across full MIDI range
    const scalePitches = this.getScalePitches(0, 127);

    // Find current position in scale
    const currentIndex = scalePitches.indexOf(snappedPitch);
    if (currentIndex === -1) {
      // Shouldn't happen after snap, but fallback
      return pitch;
    }

    // Calculate new index
    const newIndex = currentIndex + degrees;

    // Clamp to valid range
    if (newIndex < 0) return scalePitches[0];
    if (newIndex >= scalePitches.length) return scalePitches[scalePitches.length - 1];

    return scalePitches[newIndex];
  }

  /**
   * Get the scale degree of a pitch (0-based index into scale)
   * Returns -1 if pitch is not in scale
   */
  getScaleDegree(pitch: number): number {
    if (!this.isInScale(pitch)) return -1;

    const pitchClass = ((pitch % 12) + 12) % 12;
    const interval = ((pitchClass - this._root) % 12 + 12) % 12;
    return this._scale.intervals.indexOf(interval);
  }

  /**
   * Check if chromatic (all notes allowed)
   */
  isChromatic(): boolean {
    return this._scale.intervals.length === 12;
  }

  /**
   * Register a change listener
   */
  onChange(listener: ScaleChangeListener): void {
    this.changeListeners.add(listener);
  }

  /**
   * Unregister a change listener
   */
  offChange(listener: ScaleChangeListener): void {
    this.changeListeners.delete(listener);
  }

  private notifyChange(): void {
    this.changeListeners.forEach(listener => listener());
  }
}
