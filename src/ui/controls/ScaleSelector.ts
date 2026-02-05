import { ScaleManager } from '@/core/ScaleManager';
import { SCALES, ROOT_NOTES } from '@/core/Scale';

/**
 * ScaleSelector - UI component for scale selection
 *
 * Provides:
 * - Root note dropdown (C through B)
 * - Scale type dropdown (Chromatic, Major, Minor, etc.)
 * - Snap-to-scale toggle
 */
export class ScaleSelector {
  private container: HTMLElement;
  private scaleManager: ScaleManager;

  // UI elements
  private rootSelect: HTMLSelectElement | null = null;
  private scaleSelect: HTMLSelectElement | null = null;
  private snapToggle: HTMLInputElement | null = null;

  constructor(container: HTMLElement, scaleManager: ScaleManager) {
    this.container = container;
    this.scaleManager = scaleManager;
  }

  /**
   * Render the scale selector controls
   */
  render(): void {
    this.container.innerHTML = '';

    // Scale section
    const scaleSection = document.createElement('div');
    scaleSection.className = 'control-group';

    // Controls row
    const controlsRow = document.createElement('div');
    controlsRow.className = 'scale-controls';

    // Root note select
    this.rootSelect = document.createElement('select');
    this.rootSelect.className = 'root-select';
    this.rootSelect.title = 'Root Note';

    ROOT_NOTES.forEach((note, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = note;
      this.rootSelect!.appendChild(option);
    });

    this.rootSelect.value = String(this.scaleManager.root);
    this.rootSelect.addEventListener('change', () => this.onRootChange());
    controlsRow.appendChild(this.rootSelect);

    // Scale type select
    this.scaleSelect = document.createElement('select');
    this.scaleSelect.className = 'scale-select';
    this.scaleSelect.title = 'Scale Type';

    Object.entries(SCALES).forEach(([key, scale]) => {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = scale.name;
      this.scaleSelect!.appendChild(option);
    });

    // Find current scale key
    const currentScaleKey = Object.entries(SCALES).find(
      ([_, s]) => s === this.scaleManager.scale
    )?.[0] ?? 'chromatic';
    this.scaleSelect.value = currentScaleKey;
    this.scaleSelect.addEventListener('change', () => this.onScaleChange());
    controlsRow.appendChild(this.scaleSelect);

    scaleSection.appendChild(controlsRow);

    // Snap toggle row
    const snapRow = document.createElement('div');
    snapRow.className = 'snap-row';

    const snapLabel = document.createElement('label');
    snapLabel.className = 'snap-label';

    this.snapToggle = document.createElement('input');
    this.snapToggle.type = 'checkbox';
    this.snapToggle.className = 'snap-toggle';
    this.snapToggle.checked = this.scaleManager.snapEnabled;
    this.snapToggle.addEventListener('change', () => this.onSnapChange());

    const snapText = document.createElement('span');
    snapText.textContent = 'Snap to scale';

    snapLabel.appendChild(this.snapToggle);
    snapLabel.appendChild(snapText);
    snapRow.appendChild(snapLabel);

    scaleSection.appendChild(snapRow);

    this.container.appendChild(scaleSection);

    // Update UI when scale manager changes
    this.scaleManager.onChange(() => this.syncFromManager());
  }

  /**
   * Handle root note change
   */
  private onRootChange(): void {
    if (this.rootSelect) {
      this.scaleManager.root = parseInt(this.rootSelect.value, 10);
    }
  }

  /**
   * Handle scale type change
   */
  private onScaleChange(): void {
    if (this.scaleSelect) {
      const scaleKey = this.scaleSelect.value;
      const scale = SCALES[scaleKey];
      if (scale) {
        this.scaleManager.scale = scale;
      }
    }
  }

  /**
   * Handle snap toggle change
   */
  private onSnapChange(): void {
    if (this.snapToggle) {
      this.scaleManager.snapEnabled = this.snapToggle.checked;
    }
  }

  /**
   * Sync UI from scale manager state
   */
  private syncFromManager(): void {
    if (this.rootSelect) {
      this.rootSelect.value = String(this.scaleManager.root);
    }

    if (this.scaleSelect) {
      const currentScaleKey = Object.entries(SCALES).find(
        ([_, s]) => s === this.scaleManager.scale
      )?.[0] ?? 'chromatic';
      this.scaleSelect.value = currentScaleKey;
    }

    if (this.snapToggle) {
      this.snapToggle.checked = this.scaleManager.snapEnabled;
    }
  }

  /**
   * Clean up
   */
  dispose(): void {
    this.container.innerHTML = '';
  }
}
