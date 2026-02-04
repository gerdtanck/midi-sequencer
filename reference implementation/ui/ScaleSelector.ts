import { SCALES, NOTE_NAMES, getScale, type ScaleDefinition } from '../music/Scale';

/**
 * Scale and root note selector component
 *
 * Provides dropdowns for selecting musical scale and root note.
 * Renders in the transport controls bar.
 */
export class ScaleSelector {
  private container: HTMLElement;
  private rootSelect: HTMLSelectElement | null = null;
  private scaleSelect: HTMLSelectElement | null = null;

  /** Current selections */
  private currentRoot: number = 0; // C
  private currentScaleKey: string = 'major';

  /** Callback when selection changes */
  private onChange: ((root: number, scale: ScaleDefinition) => void) | null = null;

  /**
   * Create scale selector
   * @param container Container element
   */
  constructor(container: HTMLElement) {
    this.container = container;
  }

  /**
   * Set callback for selection changes
   * @param callback Function to call when root or scale changes
   */
  setOnChange(callback: (root: number, scale: ScaleDefinition) => void): void {
    this.onChange = callback;
  }

  /**
   * Get current root note
   * @returns Root note (0-11)
   */
  getRoot(): number {
    return this.currentRoot;
  }

  /**
   * Get current scale
   * @returns Scale definition
   */
  getScale(): ScaleDefinition {
    return getScale(this.currentScaleKey);
  }

  /**
   * Render the selectors
   */
  render(): void {
    // Create container div
    const selectorContainer = document.createElement('div');
    selectorContainer.className = 'scale-selector';

    // Root note selector
    const rootLabel = document.createElement('label');
    rootLabel.textContent = 'Root:';
    rootLabel.className = 'scale-selector-label';

    this.rootSelect = document.createElement('select');
    this.rootSelect.className = 'scale-selector-dropdown';
    this.rootSelect.title = 'Select root note';

    // Populate root note options
    NOTE_NAMES.forEach((name, index) => {
      const option = document.createElement('option');
      option.value = index.toString();
      option.textContent = name;
      if (index === this.currentRoot) {
        option.selected = true;
      }
      this.rootSelect!.appendChild(option);
    });

    this.rootSelect.addEventListener('change', () => this.handleRootChange());

    // Scale selector
    const scaleLabel = document.createElement('label');
    scaleLabel.textContent = 'Scale:';
    scaleLabel.className = 'scale-selector-label';

    this.scaleSelect = document.createElement('select');
    this.scaleSelect.className = 'scale-selector-dropdown';
    this.scaleSelect.title = 'Select musical scale';

    // Populate scale options
    Object.entries(SCALES).forEach(([key, scale]) => {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = scale.name;
      if (key === this.currentScaleKey) {
        option.selected = true;
      }
      this.scaleSelect!.appendChild(option);
    });

    this.scaleSelect.addEventListener('change', () => this.handleScaleChange());

    // Assemble
    selectorContainer.appendChild(rootLabel);
    selectorContainer.appendChild(this.rootSelect);
    selectorContainer.appendChild(scaleLabel);
    selectorContainer.appendChild(this.scaleSelect);

    this.container.appendChild(selectorContainer);
  }

  /**
   * Handle root note change
   */
  private handleRootChange(): void {
    if (!this.rootSelect) return;

    this.currentRoot = parseInt(this.rootSelect.value, 10);
    this.notifyChange();
  }

  /**
   * Handle scale change
   */
  private handleScaleChange(): void {
    if (!this.scaleSelect) return;

    this.currentScaleKey = this.scaleSelect.value;
    this.notifyChange();
  }

  /**
   * Notify change callback
   */
  private notifyChange(): void {
    if (this.onChange) {
      this.onChange(this.currentRoot, this.getScale());
    }
  }

  /**
   * Clean up
   */
  destroy(): void {
    if (this.rootSelect) {
      this.rootSelect.remove();
    }
    if (this.scaleSelect) {
      this.scaleSelect.remove();
    }
  }
}
