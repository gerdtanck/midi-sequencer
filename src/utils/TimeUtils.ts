import { SUBSTEPS_PER_STEP } from '@/config/GridConfig';

/**
 * Snap a step position to the nearest substep
 *
 * With SUBSTEPS_PER_STEP = 6, valid positions are:
 * 0, 1/6, 2/6, 3/6, 4/6, 5/6, 1, 7/6, ...
 * (0, 0.167, 0.333, 0.5, 0.667, 0.833, 1, ...)
 *
 * @param step The step position to snap
 * @param substeps Number of substeps per step (default: SUBSTEPS_PER_STEP)
 * @returns The snapped step position
 */
export function snapToSubstep(step: number, substeps: number = SUBSTEPS_PER_STEP): number {
  return Math.round(step * substeps) / substeps;
}

/**
 * Convert a step position to a substep index
 * Useful for Map keys to avoid floating point comparison issues
 *
 * @param step The step position
 * @param substeps Number of substeps per step
 * @returns Integer substep index
 */
export function stepToSubstepIndex(step: number, substeps: number = SUBSTEPS_PER_STEP): number {
  return Math.round(step * substeps);
}

/**
 * Convert a substep index back to a step position
 *
 * @param substepIndex The substep index
 * @param substeps Number of substeps per step
 * @returns Step position
 */
export function substepIndexToStep(substepIndex: number, substeps: number = SUBSTEPS_PER_STEP): number {
  return substepIndex / substeps;
}
