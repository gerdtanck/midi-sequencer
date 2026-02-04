import type { MidiManager } from '../midi/MidiManager';

/**
 * UI component for MIDI device selection
 */
export class DevicePicker {
  private midiManager: MidiManager;
  private container: HTMLElement;
  private enableButton: HTMLButtonElement | null = null;
  private deviceSelect: HTMLSelectElement | null = null;
  private statusIndicator: HTMLElement | null = null;
  private permissionSection: HTMLElement | null = null;
  private deviceSection: HTMLElement | null = null;
  private errorMessage: HTMLElement | null = null;
  private onEnabledCallback?: () => void;

  constructor(midiManager: MidiManager, container: HTMLElement, onEnabled?: () => void) {
    this.midiManager = midiManager;
    this.container = container;
    this.onEnabledCallback = onEnabled;
  }

  /**
   * Render the device picker UI
   */
  render(): void {
    this.container.innerHTML = `
      <div class="device-picker">
        <div class="permission-section">
          <h2>MIDI Device Connection</h2>
          <p class="permission-explanation">
            This app needs access to your MIDI devices to send notes and control messages.
            Click the button below to grant permission.
          </p>
          <button class="enable-midi-button" type="button">Enable MIDI</button>
          <div class="error-message" style="display: none;"></div>
        </div>

        <div class="device-section" style="display: none;">
          <div class="status-row">
            <label for="midi-device-select">MIDI Output:</label>
            <span class="status-indicator status-disconnected">●</span>
          </div>
          <select id="midi-device-select" class="device-select">
            <option value="">No device selected</option>
          </select>
        </div>
      </div>
    `;

    // Get references to DOM elements
    this.permissionSection = this.container.querySelector('.permission-section');
    this.deviceSection = this.container.querySelector('.device-section');
    this.enableButton = this.container.querySelector('.enable-midi-button');
    this.deviceSelect = this.container.querySelector('.device-select');
    this.statusIndicator = this.container.querySelector('.status-indicator');
    this.errorMessage = this.container.querySelector('.error-message');

    // Attach event listeners
    this.enableButton?.addEventListener('click', () => this.handleEnable());
    this.deviceSelect?.addEventListener('change', () => this.handleDeviceChange());

    // Subscribe to device events
    this.midiManager.onDeviceConnected(() => this.refreshDevices());
    this.midiManager.onDeviceDisconnected(() => this.refreshDevices());
  }

  /**
   * Handle MIDI enable button click
   */
  private async handleEnable(): Promise<void> {
    if (!this.enableButton || !this.permissionSection || !this.deviceSection || !this.errorMessage) {
      return;
    }

    this.enableButton.disabled = true;
    this.enableButton.textContent = 'Enabling...';
    this.errorMessage.style.display = 'none';

    const success = await this.midiManager.init();

    if (success) {
      // Hide permission section, show device section
      this.permissionSection.style.display = 'none';
      this.deviceSection.style.display = 'block';

      // Populate devices
      this.refreshDevices();

      // Fire enabled callback
      if (this.onEnabledCallback) {
        this.onEnabledCallback();
      }
    } else {
      // Show error message
      this.errorMessage.textContent = 'Failed to enable MIDI. Please check browser permissions and try again.';
      this.errorMessage.style.display = 'block';
      this.enableButton.disabled = false;
      this.enableButton.textContent = 'Enable MIDI';
    }
  }

  /**
   * Refresh device list in dropdown
   */
  private refreshDevices(): void {
    if (!this.deviceSelect || !this.statusIndicator) {
      return;
    }

    const devices = this.midiManager.getDevices();

    // Clear and repopulate options
    this.deviceSelect.innerHTML = '<option value="">Select a device...</option>';

    devices.forEach(device => {
      const option = document.createElement('option');
      option.value = device.id;
      option.textContent = `${device.name} (${device.manufacturer})`;
      this.deviceSelect!.appendChild(option);
    });

    // Update status based on device availability
    const selectedDevice = this.midiManager.getSelectedDevice();
    if (selectedDevice && selectedDevice.state === 'connected') {
      this.statusIndicator.className = 'status-indicator status-connected';
      this.deviceSelect.value = selectedDevice.id;
    } else {
      this.statusIndicator.className = 'status-indicator status-disconnected';
    }

    console.log(`Refreshed device list: ${devices.length} device(s) available`);
  }

  /**
   * Handle device selection change
   */
  private handleDeviceChange(): void {
    if (!this.deviceSelect || !this.statusIndicator) {
      return;
    }

    const deviceId = this.deviceSelect.value;

    if (deviceId) {
      const success = this.midiManager.selectDevice(deviceId);
      if (success) {
        this.statusIndicator.className = 'status-indicator status-connected';
      }
    } else {
      this.statusIndicator.className = 'status-indicator status-disconnected';
    }
  }
}
