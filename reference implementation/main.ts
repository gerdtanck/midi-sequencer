import { MidiManager } from './midi/MidiManager';
import { DevicePicker } from './ui/DevicePicker';
import { PanicButton } from './ui/PanicButton';
import { SequenceManager } from './sequencer/SequenceManager';
import { validateGridConfig, GRID_CONFIG } from './config/GridConfig';

/**
 * Inject CSS variables from grid configuration
 * Ensures TypeScript config is the single source of truth
 */
function injectCSSVariables(): void {
  const root = document.documentElement;
  const cssVars = GRID_CONFIG.toCSSVariables();

  Object.entries(cssVars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });

  console.log('✓ CSS variables injected from GridConfig');
}

/**
 * Application entry point
 */
function initApp() {
  console.log('MIDI Sequencer initializing...');

  // Validate grid configuration early
  validateGridConfig();

  // Inject CSS variables from config (TypeScript as single source of truth)
  injectCSSVariables();

  // Get container elements
  const devicePickerContainer = document.getElementById('device-picker');
  const panicButtonContainer = document.getElementById('panic-button');

  if (!devicePickerContainer) {
    console.error('Failed to find #device-picker container');
    return;
  }

  if (!panicButtonContainer) {
    console.error('Failed to find #panic-button container');
    return;
  }

  // Create MidiManager instance
  const midiManager = new MidiManager();

  // Create callback to initialize sequencer after MIDI is enabled
  const onMidiEnabled = () => {
    // Get scheduler from MidiManager
    const scheduler = midiManager.getScheduler();

    // Create and initialize SequenceManager
    const sequenceManager = new SequenceManager(midiManager, scheduler);
    sequenceManager.init();

    // Expose to window for testing
    (window as any).sequenceManager = sequenceManager;

    console.log('SequenceManager initialized');
  };

  // Create and mount DevicePicker (will call onMidiEnabled after user enables MIDI)
  const devicePicker = new DevicePicker(midiManager, devicePickerContainer, onMidiEnabled);
  devicePicker.render();

  // Create and mount PanicButton
  const panicButton = new PanicButton(midiManager, panicButtonContainer);
  panicButton.render();

  // Expose midiManager to window for testing
  (window as any).midiManager = midiManager;

  console.log('MIDI Sequencer initialized successfully');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
