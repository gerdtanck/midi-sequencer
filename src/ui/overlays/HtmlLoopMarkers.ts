import { GridConfig, CameraState } from '@/config/GridConfig';
import { Sequence } from '@/core/Sequence';

/**
 * HtmlLoopMarkers - HTML-based loop markers overlay
 *
 * Uses HTML elements instead of Three.js meshes for simpler drag handling.
 * Syncs with grid camera state like BarIndicators.
 */
export class HtmlLoopMarkers {
  private container: HTMLElement;
  private config: GridConfig;
  private sequence: Sequence;

  private markersContainer: HTMLElement;
  private regionOverlay: HTMLElement;
  private startMarker: HTMLElement;
  private endMarker: HTMLElement;

  private cameraState: CameraState | null = null;

  // Drag state
  private dragging: 'start' | 'end' | null = null;
  private dragStartX = 0; // Screen X where drag started
  private dragStartValue = 0; // Marker value when drag started

  constructor(container: HTMLElement, config: GridConfig, sequence: Sequence) {
    this.container = container;
    this.config = config;
    this.sequence = sequence;

    // Create markers container
    this.markersContainer = document.createElement('div');
    this.markersContainer.className = 'loop-markers-container';
    this.container.appendChild(this.markersContainer);

    // Create region overlay (between markers)
    this.regionOverlay = document.createElement('div');
    this.regionOverlay.className = 'loop-region-overlay';
    this.markersContainer.appendChild(this.regionOverlay);

    // Create start marker
    this.startMarker = this.createMarker('start');
    this.markersContainer.appendChild(this.startMarker);

    // Create end marker
    this.endMarker = this.createMarker('end');
    this.markersContainer.appendChild(this.endMarker);

    // Global listeners for drag
    document.addEventListener('pointermove', this.onPointerMove);
    document.addEventListener('pointerup', this.onPointerUp);
    document.addEventListener('pointercancel', this.onPointerUp);

    // Clear drag state if clicking elsewhere (fallback for missed pointerup)
    document.addEventListener('pointerdown', this.onDocumentPointerDown);

    // Clear drag state if window loses focus
    window.addEventListener('blur', this.clearDragState);
  }

  private createMarker(type: 'start' | 'end'): HTMLElement {
    const marker = document.createElement('div');
    marker.className = `loop-marker loop-marker-${type}`;
    marker.dataset.type = type;

    // Inner visible line
    const line = document.createElement('div');
    line.className = 'loop-marker-line';
    marker.appendChild(line);

    // Handle pointer down
    marker.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      this.dragging = type;
      this.dragStartX = e.clientX;
      this.dragStartValue = type === 'start'
        ? this.sequence.getLoopMarkers().start
        : this.sequence.getLoopMarkers().end;

      marker.classList.add('dragging');
      marker.setPointerCapture(e.pointerId);
    });

    return marker;
  }

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.dragging || !this.cameraState) return;

    const containerRect = this.container.getBoundingClientRect();
    const containerWidth = containerRect.width;

    // Calculate pixels per step
    const viewWidth = this.cameraState.right - this.cameraState.left;
    const pixelsPerStep = containerWidth / viewWidth;

    // Calculate how many steps the mouse moved
    const deltaPixels = e.clientX - this.dragStartX;
    const deltaSteps = deltaPixels / pixelsPerStep;

    // Calculate new position
    const newValue = Math.round(this.dragStartValue + deltaSteps);
    const markers = this.sequence.getLoopMarkers();

    if (this.dragging === 'start') {
      const clampedStart = Math.max(0, Math.min(newValue, markers.end - 1));
      if (clampedStart !== markers.start) {
        this.sequence.setLoopMarkers({ start: clampedStart, end: markers.end });
        this.updatePositions();
      }
    } else {
      const maxEnd = this.config.stepsPerBar * 128;
      const clampedEnd = Math.max(markers.start + 1, Math.min(newValue, maxEnd));
      if (clampedEnd !== markers.end) {
        this.sequence.setLoopMarkers({ start: markers.start, end: clampedEnd });
        this.updatePositions();
      }
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (this.dragging) {
      try {
        const marker = this.dragging === 'start' ? this.startMarker : this.endMarker;
        marker.releasePointerCapture(e.pointerId);
      } catch {
        // Pointer capture may already be released
      }
    }
    this.clearDragState();
  };

  private clearDragState = (): void => {
    // Always clear both markers to ensure no stuck states
    this.startMarker.classList.remove('dragging');
    this.endMarker.classList.remove('dragging');
    this.dragging = null;
  };

  private onDocumentPointerDown = (e: PointerEvent): void => {
    // If clicking outside loop markers, clear any stuck highlight
    const target = e.target as HTMLElement;
    if (!target.closest('.loop-marker')) {
      this.clearDragState();
    }
  };

  /**
   * Update marker positions from camera state
   */
  updateTransform(cameraState: CameraState): void {
    this.cameraState = cameraState;
    this.updatePositions();
  }

  private updatePositions(): void {
    if (!this.cameraState) return;

    const containerWidth = this.container.clientWidth;
    if (containerWidth === 0) return;

    const viewLeft = this.cameraState.left;
    const viewRight = this.cameraState.right;
    const viewWidth = viewRight - viewLeft;
    if (viewWidth <= 0) return;

    const pixelsPerStep = containerWidth / viewWidth;
    const markers = this.sequence.getLoopMarkers();

    // Position start marker
    const startScreenX = (markers.start - viewLeft) * pixelsPerStep;
    this.startMarker.style.left = `${startScreenX}px`;

    // Position end marker
    const endScreenX = (markers.end - viewLeft) * pixelsPerStep;
    this.endMarker.style.left = `${endScreenX}px`;

    // Position region overlay between markers
    this.regionOverlay.style.left = `${startScreenX}px`;
    this.regionOverlay.style.width = `${endScreenX - startScreenX}px`;
  }

  dispose(): void {
    document.removeEventListener('pointermove', this.onPointerMove);
    document.removeEventListener('pointerup', this.onPointerUp);
    document.removeEventListener('pointercancel', this.onPointerUp);
    document.removeEventListener('pointerdown', this.onDocumentPointerDown);
    window.removeEventListener('blur', this.clearDragState);

    this.markersContainer.remove();
  }
}
