/**
 * BarIndicators - Displays bar indicator row that syncs with the note grid
 *
 * The bar indicators scroll horizontally with the grid but remain fixed vertically.
 * Indicators zoom in/out with the grid to maintain alignment.
 */
class BarIndicators {
  /**
   * Creates a new BarIndicators instance
   * @param {HTMLElement} container - The container element for the bar indicators
   * @param {Object} config - Grid configuration
   * @param {number} barCount - Initial number of bars
   */
  constructor(container, config, barCount) {
    this.container = container;
    this.config = config;
    this.barCount = barCount;

    // Create inner container
    this.innerContainer = document.createElement('div');
    this.innerContainer.className = 'bar-indicators-inner';
    this.container.appendChild(this.innerContainer);

    // Store indicator elements
    this.indicatorElements = [];

    // Build initial indicators
    this.buildIndicators();
  }

  /**
   * Gets the label for a bar
   * @param {number} barIndex - The bar index (0-based)
   * @returns {string} The bar label (e.g., "Bar 1", "Bar 2")
   */
  getBarLabel(barIndex) {
    return `Bar ${barIndex + 1}`;
  }

  /**
   * Builds the bar indicator elements
   */
  buildIndicators() {
    // Clear existing indicators
    this.clearIndicators();

    for (let i = 0; i < this.barCount; i++) {
      const indicatorElement = document.createElement('div');
      indicatorElement.className = 'bar-indicator';
      indicatorElement.dataset.bar = i;

      // Create label span
      const labelSpan = document.createElement('span');
      labelSpan.className = 'bar-indicator-label';
      labelSpan.textContent = this.getBarLabel(i);
      indicatorElement.appendChild(labelSpan);

      // Attach event listeners with proper this binding
      const barIndex = i;
      indicatorElement.addEventListener('mouseenter', () => {
        indicatorElement.classList.add('highlight');
        console.log(`Bar indicator hover: ${this.getBarLabel(barIndex)}`);
      });
      indicatorElement.addEventListener('mouseleave', () => {
        indicatorElement.classList.remove('highlight');
      });
      indicatorElement.addEventListener('click', (e) => {
        if (e.button !== 0) return;
        console.log(`Bar clicked: ${this.getBarLabel(barIndex)}`);
      });

      this.innerContainer.appendChild(indicatorElement);
      this.indicatorElements.push(indicatorElement);
    }
  }

  /**
   * Clears all indicator elements
   */
  clearIndicators() {
    this.innerContainer.innerHTML = '';
    this.indicatorElements = [];
  }

  /**
   * Sets the number of bars and rebuilds indicators
   * @param {number} count - Number of bars
   */
  setBarCount(count) {
    if (count !== this.barCount) {
      this.barCount = count;
      this.buildIndicators();
    }
  }

  /**
   * Updates the position and size of indicators to sync with camera state
   * @param {Object} cameraState - Camera bounds {left, right, top, bottom}
   */
  updateTransform(cameraState) {
    const containerWidth = this.container.clientWidth;
    if (containerWidth === 0) return;

    const viewLeft = cameraState.left;
    const viewRight = cameraState.right;
    const viewWidth = viewRight - viewLeft;

    if (viewWidth <= 0) return;

    const stepsPerBar = this.config.stepsPerBar;

    // Calculate pixels per step
    const pixelsPerStep = containerWidth / viewWidth;

    // Update each indicator's position and size
    for (const indicatorElement of this.indicatorElements) {
      const barIndex = parseInt(indicatorElement.dataset.bar, 10);

      // Calculate world coordinates for this bar
      const barLeftWorld = barIndex * stepsPerBar;
      const barRightWorld = (barIndex + 1) * stepsPerBar;

      // Convert to screen pixels (from left of container)
      const barLeftScreen = (barLeftWorld - viewLeft) * pixelsPerStep;
      const barRightScreen = (barRightWorld - viewLeft) * pixelsPerStep;
      const barWidthPixels = barRightScreen - barLeftScreen;

      indicatorElement.style.left = `${barLeftScreen}px`;
      indicatorElement.style.width = `${barWidthPixels}px`;

      // Hide indicators that are outside the visible area
      if (barRightScreen < 0 || barLeftScreen > containerWidth) {
        indicatorElement.style.display = 'none';
      } else {
        indicatorElement.style.display = 'flex';
      }
    }
  }

  /**
   * Disposes of resources
   */
  dispose() {
    this.clearIndicators();
    if (this.innerContainer && this.innerContainer.parentNode) {
      this.innerContainer.parentNode.removeChild(this.innerContainer);
    }
  }
}
