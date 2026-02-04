/**
 * MIDI Device representation
 */
export interface MidiDevice {
  id: string;
  name: string;
  manufacturer: string;
  state: 'connected' | 'disconnected';
}

/**
 * MIDI connection state
 */
export type MidiConnectionState = 'disabled' | 'enabled' | 'error';

/**
 * Callback for device connection events
 */
export type DeviceEventCallback = (device: MidiDevice) => void;
