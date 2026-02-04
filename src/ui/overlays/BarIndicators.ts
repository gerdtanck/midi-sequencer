import { GridConfig, CameraState } from '@/config/GridConfig';

/**
 * BarIndicators - Displays bar indicator row that syncs with the note grid
 *
 * The bar indicators scroll horizontally with the grid but remain fixed vertically.
 * Indicators zoom in/out with the grid to maintain alignment.
 */
export class BarIndicators {
  private container: HTMLElement;
  private config: GridConfig;
  private barCount: number;
  private innerContainer: HTMLElement;
  private indicatorElements: HTMLElement[] = [];

  // Callback for bar click
  private onBarClick?: (barIndex: number) => void;

  constructor(container: HTMLElement, config: GridConfig, barCount: number) {
    this.container = container;
    this.config = config;
    this.barCount = barCount;

    this.innerContainer = document.createElement('div');
    this.innerContainer.className = 'bar-indicators-inner';
    this.container.appendChild(this.innerContainer);

    this.buildIndicators();
  }

  /**
   * Set callback for bar click events
   */
  setCallback(onBarClick?: (barIndex: number) => void): void {
    this.onBarClick = onBarClick;
  }

  /**
   * Gets the label for a bar
   */
  private getBarLabel(barIndex: number): string {
    return `Bar ${barIndex + 1}`;
  }

  /**
   * Builds the bar indicator elements
   */
  private buildIndicators(): void {
    this.clearIndicators();

    for (let i = 0; i < this.barCount; i++) {
      const indicatorElement = document.createElement('div');
      indicatorElement.className = 'bar-indicator';
      indicatorElement.dataset.bar = String(i);

      const labelSpan = document.createElement('span');
      labelSpan.className = 'bar-indicator-label';
      labelSpan.textContent = this.getBarLabel(i);
      indicatorElement.appendChild(labelSpan);

      // Attach event listeners
      const barIndex = i;
      indicatorElement.addEventListener('mouseenter', () => {
        indicatorElement.classList.add('highlight');
      });
      indicatorElement.addEventListener('mouseleave', () => {
        indicatorElement.classList.remove('highlight');
      });
      indicatorElement.addEventListener('click', (e) => {
        if (e.button !== 0) return;
        this.onBarClick?.(barIndex);
      });

      this.innerContainer.appendChild(indicatorElement);
      this.indicatorElements.push(indicatorElement);
    }
  }

  /**
   * Clears all indicator elements
   */
  private clearIndicators(): void {
    this.innerContainer.innerHTML = '';
    this.indicatorElements = [];
  }

  /**
   * Sets the number of bars and rebuilds indicators
   */
  setBarCount(count: number): void {
    if (count !== this.barCount) {
      this.barCount = count;
      this.buildIndicators();
    }
  }

  /**
   * Updates the position and size of indicators to sync with camera state
   */
  updateTransform(cameraState: CameraState): void {
    const containerWidth = this.container.clientWidth;
    if (containerWidth === 0) return;

    const viewLeft = cameraState.left;
    const viewRight = cameraState.right;
    const viewWidth = viewRight - viewLeft;

    if (viewWidth <= 0) return;

    const stepsPerBar = this.config.stepsPerBar;
    const pixelsPerStep = containerWidth / viewWidth;

    for (const indicatorElement of this.indicatorElements) {
      const barIndex = parseInt(indicatorElement.dataset.bar!, 10);

      const barLeftWorld = barIndex * stepsPerBar;
      const barRightWorld = (barIndex + 1) * stepsPerBar;

      const barLeftScreen = (barLeftWorld - viewLeft) * pixelsPerStep;
      const barRightScreen = (barRightWorld - viewLeft) * pixelsPerStep;
      const barWidthPixels = barRightScreen - barLeftScreen;

      indicatorElement.style.left = `${barLeftScreen}px`;
      indicatorElement.style.width = `${barWidthPixels}px`;

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
  dispose(): void {
    this.clearIndicators();
    if (this.innerContainer.parentNode) {
      this.innerContainer.parentNode.removeChild(this.innerContainer);
    }
  }
}
