/**
 * Platform detection utilities
 *
 * Centralized device/platform detection to avoid duplication
 * across components.
 */

/**
 * Cached touch device detection result
 */
let _isTouchDevice: boolean | null = null;

/**
 * Detect if device supports touch input (mobile/tablet)
 * Result is cached after first call.
 */
export function isTouchDevice(): boolean {
  if (_isTouchDevice === null) {
    _isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }
  return _isTouchDevice;
}

/**
 * Detect if device is likely a mobile phone (not tablet)
 * Uses screen width heuristic.
 */
export function isMobilePhone(): boolean {
  return isTouchDevice() && window.innerWidth < 768;
}

/**
 * Detect if device is likely a tablet
 */
export function isTablet(): boolean {
  return isTouchDevice() && window.innerWidth >= 768;
}

/**
 * Check if the browser supports the Web MIDI API
 */
export function supportsWebMidi(): boolean {
  return 'requestMIDIAccess' in navigator;
}

/**
 * Reset cached values (useful for testing)
 */
export function resetPlatformCache(): void {
  _isTouchDevice = null;
}
