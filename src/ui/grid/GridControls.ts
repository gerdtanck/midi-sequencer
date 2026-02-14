import * as THREE from 'three';
import { GridConfig, CameraState } from '@/config/GridConfig';
import { screenToWorld as screenToWorldUtil } from '@/utils';
import type { NormalizedPointerEvent, InputHandler } from '../input';

interface TouchInfo {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

/**
 * GridControls - Handles pan and zoom interactions for the note grid
 *
 * Implements InputHandler for mouse interactions while keeping
 * direct touch event handling for pinch-zoom (multi-touch).
 *
 * Supports mouse (PC) and touch (mobile) input for panning and zooming.
 * View is bounded to grid edges with no empty space visible beyond boundaries.
 */
export class GridControls implements InputHandler {
  // InputHandler properties
  readonly priority = 100; // Low priority - pan is fallback after note interactions
  readonly name = 'GridControls';
  private camera: THREE.OrthographicCamera;
  private domElement: HTMLElement;
  private config: GridConfig;
  private renderCallback: () => void;
  private cameraChangeCallback: (state: CameraState) => void;

  // Grid dimensions
  private gridWidth = 0;
  private gridHeight = 0;

  // Zoom state
  private zoomLevel = 1.0;
  private zoomSpeed = 0.1;
  private minViewWidth = 8; // Half a bar for better mobile targeting
  private containerAspect = 1;

  // Pan state (mouse)
  isPanning = false;
  private panStartMouse = { x: 0, y: 0 };
  private panStartCameraCenter = { x: 0, y: 0 };

  // Touch state
  private touches = new Map<number, TouchInfo>();
  private gestureType: 'pan' | 'pinch' | null = null;
  private initialPinchDistance = 0;
  private initialZoomLevel = 0;
  private pinchCenterWorld = { x: 0, y: 0 };

  // Bound event handlers (touch events only - mouse handled via InputHandler)
  private boundOnTouchStart: (e: TouchEvent) => void;
  private boundOnTouchMove: (e: TouchEvent) => void;
  private boundOnTouchEnd: (e: TouchEvent) => void;
  private boundOnTouchCancel: (e: TouchEvent) => void;

  constructor(
    camera: THREE.OrthographicCamera,
    domElement: HTMLElement,
    config: GridConfig,
    renderCallback: () => void,
    cameraChangeCallback: (state: CameraState) => void
  ) {
    this.camera = camera;
    this.domElement = domElement;
    this.config = config;
    this.renderCallback = renderCallback;
    this.cameraChangeCallback = cameraChangeCallback;

    // Bind event handlers (touch only - mouse/wheel via InputHandler)
    this.boundOnTouchStart = this.onTouchStart.bind(this);
    this.boundOnTouchMove = this.onTouchMove.bind(this);
    this.boundOnTouchEnd = this.onTouchEnd.bind(this);
    this.boundOnTouchCancel = this.onTouchCancel.bind(this);

    this.updateContainerAspect();
    this.attachTouchEvents();
  }

  /**
   * Updates the grid dimensions and recalculates zoom limits
   */
  setGridDimensions(barCount: number, octaveCount: number): void {
    this.gridWidth = barCount * this.config.stepsPerBar;
    this.gridHeight = octaveCount * this.config.semitonesPerOctave;

    this.applyZoom();
    this.clampCameraToBounds();
    this.updateCameraProjection();
  }

  /**
   * Updates the container aspect ratio (call on resize)
   */
  updateContainerAspect(): void {
    const rect = this.domElement.getBoundingClientRect();
    this.containerAspect = rect.width / rect.height;
  }

  /**
   * Converts screen coordinates to world coordinates
   */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return screenToWorldUtil(this.camera, this.domElement, screenX, screenY);
  }

  /**
   * Calculates the view width based on current zoom level
   */
  private calculateViewWidth(): number {
    const gridAspect = this.gridWidth / this.gridHeight;
    let maxViewWidth: number;

    if (this.containerAspect > gridAspect) {
      maxViewWidth = this.gridHeight * this.containerAspect;
    } else {
      maxViewWidth = this.gridWidth;
    }

    return this.minViewWidth + (maxViewWidth - this.minViewWidth) * this.zoomLevel;
  }

  /**
   * Applies the current zoom level to the camera
   */
  private applyZoom(): void {
    const viewWidth = this.calculateViewWidth();
    const viewHeight = viewWidth / this.containerAspect;

    const centerX = (this.camera.left + this.camera.right) / 2;
    const centerY = (this.camera.top + this.camera.bottom) / 2;

    this.camera.left = centerX - viewWidth / 2;
    this.camera.right = centerX + viewWidth / 2;
    this.camera.top = centerY + viewHeight / 2;
    this.camera.bottom = centerY - viewHeight / 2;
  }

  /**
   * Clamps the camera position to keep the view within grid bounds
   */
  private clampCameraToBounds(): void {
    const viewWidth = this.camera.right - this.camera.left;
    const viewHeight = this.camera.top - this.camera.bottom;

    let centerX = (this.camera.left + this.camera.right) / 2;
    let centerY = (this.camera.top + this.camera.bottom) / 2;

    if (viewWidth >= this.gridWidth) {
      centerX = this.gridWidth / 2;
    } else {
      centerX = Math.max(viewWidth / 2, Math.min(this.gridWidth - viewWidth / 2, centerX));
    }

    if (viewHeight >= this.gridHeight) {
      centerY = this.gridHeight / 2;
    } else {
      centerY = Math.max(viewHeight / 2, Math.min(this.gridHeight - viewHeight / 2, centerY));
    }

    this.camera.left = centerX - viewWidth / 2;
    this.camera.right = centerX + viewWidth / 2;
    this.camera.top = centerY + viewHeight / 2;
    this.camera.bottom = centerY - viewHeight / 2;
  }

  /**
   * Updates the camera projection matrix and triggers a render
   */
  private updateCameraProjection(): void {
    this.camera.updateProjectionMatrix();
    this.renderCallback();
    this.notifyCameraChange();
  }

  /**
   * Notifies listeners that camera bounds have changed
   */
  private notifyCameraChange(): void {
    this.cameraChangeCallback({
      left: this.camera.left,
      right: this.camera.right,
      top: this.camera.top,
      bottom: this.camera.bottom,
    });
  }

  /**
   * Zooms at a specific world point
   */
  private zoomAtPoint(worldX: number, worldY: number, delta: number): void {
    const oldZoomLevel = this.zoomLevel;
    this.zoomLevel = Math.max(0, Math.min(1, this.zoomLevel - delta * this.zoomSpeed));

    if (this.zoomLevel === oldZoomLevel) return;

    const oldViewWidth = this.camera.right - this.camera.left;
    const oldViewHeight = this.camera.top - this.camera.bottom;
    const oldCenterX = (this.camera.left + this.camera.right) / 2;
    const oldCenterY = (this.camera.top + this.camera.bottom) / 2;

    const offsetX = (worldX - oldCenterX) / oldViewWidth;
    const offsetY = (worldY - oldCenterY) / oldViewHeight;

    this.applyZoom();

    const newViewWidth = this.camera.right - this.camera.left;
    const newViewHeight = this.camera.top - this.camera.bottom;

    const newCenterX = worldX - offsetX * newViewWidth;
    const newCenterY = worldY - offsetY * newViewHeight;

    this.camera.left = newCenterX - newViewWidth / 2;
    this.camera.right = newCenterX + newViewWidth / 2;
    this.camera.top = newCenterY + newViewHeight / 2;
    this.camera.bottom = newCenterY - newViewHeight / 2;

    this.clampCameraToBounds();
    this.updateCameraProjection();
  }

  /**
   * Attach touch event listeners (pinch-zoom requires direct touch handling)
   */
  private attachTouchEvents(): void {
    this.domElement.addEventListener('touchstart', this.boundOnTouchStart, { passive: false });
    this.domElement.addEventListener('touchmove', this.boundOnTouchMove, { passive: false });
    this.domElement.addEventListener('touchend', this.boundOnTouchEnd);
    this.domElement.addEventListener('touchcancel', this.boundOnTouchCancel);
  }

  /**
   * Detach touch event listeners
   */
  private detachTouchEvents(): void {
    this.domElement.removeEventListener('touchstart', this.boundOnTouchStart);
    this.domElement.removeEventListener('touchmove', this.boundOnTouchMove);
    this.domElement.removeEventListener('touchend', this.boundOnTouchEnd);
    this.domElement.removeEventListener('touchcancel', this.boundOnTouchCancel);
  }

  // ============ InputHandler Implementation ============

  /**
   * Handle pointer down (InputHandler interface)
   * Claims left mouse button for panning
   */
  onPointerDown(e: NormalizedPointerEvent): boolean {
    // Only handle mouse (touch handled via direct touch events for pinch support)
    if (e.isTouchEvent) return false;

    // Only claim left mouse button
    if (e.button !== 0) return false;

    this.isPanning = true;
    this.panStartMouse = { x: e.screenX, y: e.screenY };
    this.panStartCameraCenter = {
      x: (this.camera.left + this.camera.right) / 2,
      y: (this.camera.top + this.camera.bottom) / 2,
    };

    this.domElement.style.cursor = 'grabbing';
    return true; // Claim the interaction
  }

  /**
   * Handle pointer move (InputHandler interface)
   */
  onPointerMove(e: NormalizedPointerEvent): void {
    if (!this.isPanning) return;

    const rect = this.domElement.getBoundingClientRect();
    const ndcDeltaX = ((e.screenX - this.panStartMouse.x) / rect.width) * 2;
    const ndcDeltaY = -((e.screenY - this.panStartMouse.y) / rect.height) * 2;

    const viewWidth = this.camera.right - this.camera.left;
    const viewHeight = this.camera.top - this.camera.bottom;

    const worldDeltaX = (ndcDeltaX * viewWidth) / 2;
    const worldDeltaY = (ndcDeltaY * viewHeight) / 2;

    const newCenterX = this.panStartCameraCenter.x - worldDeltaX;
    const newCenterY = this.panStartCameraCenter.y - worldDeltaY;

    this.camera.left = newCenterX - viewWidth / 2;
    this.camera.right = newCenterX + viewWidth / 2;
    this.camera.top = newCenterY + viewHeight / 2;
    this.camera.bottom = newCenterY - viewHeight / 2;

    this.clampCameraToBounds();
    this.updateCameraProjection();
  }

  /**
   * Handle pointer up (InputHandler interface)
   */
  onPointerUp(_e: NormalizedPointerEvent): void {
    this.isPanning = false;
    this.domElement.style.cursor = 'pointer';
  }

  /**
   * Handle wheel zoom (InputHandler interface)
   */
  onWheel(e: WheelEvent): boolean {
    // Don't zoom if ctrl/meta key is pressed (browser zoom)
    if (e.ctrlKey || e.metaKey) return false;

    const worldPos = this.screenToWorld(e.clientX, e.clientY);
    const delta = e.deltaY > 0 ? -1 : 1;

    this.zoomAtPoint(worldPos.x, worldPos.y, delta);
    return true; // Handled
  }

  // ============ Touch Event Handlers (Direct - for pinch-zoom support) ============

  private onTouchStart(event: TouchEvent): void {
    event.preventDefault();

    for (const touch of Array.from(event.changedTouches)) {
      this.touches.set(touch.identifier, {
        startX: touch.clientX,
        startY: touch.clientY,
        currentX: touch.clientX,
        currentY: touch.clientY,
      });
    }

    if (this.touches.size === 1) {
      this.gestureType = 'pan';
      const touch = this.touches.values().next().value!;
      this.panStartMouse = { x: touch.startX, y: touch.startY };
      this.panStartCameraCenter = {
        x: (this.camera.left + this.camera.right) / 2,
        y: (this.camera.top + this.camera.bottom) / 2,
      };
    } else if (this.touches.size === 2) {
      this.gestureType = 'pinch';
      this.initializePinch();
    }
  }

  private initializePinch(): void {
    const touchArray = Array.from(this.touches.values());
    if (touchArray.length < 2) return;

    const t1 = touchArray[0];
    const t2 = touchArray[1];

    const dx = t2.currentX - t1.currentX;
    const dy = t2.currentY - t1.currentY;
    this.initialPinchDistance = Math.sqrt(dx * dx + dy * dy);
    this.initialZoomLevel = this.zoomLevel;

    const centerX = (t1.currentX + t2.currentX) / 2;
    const centerY = (t1.currentY + t2.currentY) / 2;
    this.pinchCenterWorld = this.screenToWorld(centerX, centerY);
  }

  private onTouchMove(event: TouchEvent): void {
    event.preventDefault();

    for (const touch of Array.from(event.changedTouches)) {
      const tracked = this.touches.get(touch.identifier);
      if (tracked) {
        tracked.currentX = touch.clientX;
        tracked.currentY = touch.clientY;
      }
    }

    if (this.gestureType === 'pan' && this.touches.size === 1) {
      const touch = this.touches.values().next().value!;
      const rect = this.domElement.getBoundingClientRect();

      const ndcDeltaX = ((touch.currentX - this.panStartMouse.x) / rect.width) * 2;
      const ndcDeltaY = -((touch.currentY - this.panStartMouse.y) / rect.height) * 2;

      const viewWidth = this.camera.right - this.camera.left;
      const viewHeight = this.camera.top - this.camera.bottom;

      const worldDeltaX = (ndcDeltaX * viewWidth) / 2;
      const worldDeltaY = (ndcDeltaY * viewHeight) / 2;

      const newCenterX = this.panStartCameraCenter.x - worldDeltaX;
      const newCenterY = this.panStartCameraCenter.y - worldDeltaY;

      this.camera.left = newCenterX - viewWidth / 2;
      this.camera.right = newCenterX + viewWidth / 2;
      this.camera.top = newCenterY + viewHeight / 2;
      this.camera.bottom = newCenterY - viewHeight / 2;

      this.clampCameraToBounds();
      this.updateCameraProjection();
    } else if (this.gestureType === 'pinch' && this.touches.size === 2) {
      const touchArray = Array.from(this.touches.values());
      const t1 = touchArray[0];
      const t2 = touchArray[1];

      const dx = t2.currentX - t1.currentX;
      const dy = t2.currentY - t1.currentY;
      const currentDistance = Math.sqrt(dx * dx + dy * dy);

      const scale = currentDistance / this.initialPinchDistance;
      const logScale = Math.log(scale);
      const pinchZoomSpeed = 0.7;
      const newZoomLevel = Math.max(
        0,
        Math.min(1, this.initialZoomLevel - logScale * pinchZoomSpeed)
      );

      this.zoomLevel = newZoomLevel;
      this.applyZoom();

      const viewWidth = this.camera.right - this.camera.left;
      const viewHeight = this.camera.top - this.camera.bottom;

      const screenCenterX = (t1.currentX + t2.currentX) / 2;
      const screenCenterY = (t1.currentY + t2.currentY) / 2;
      const rect = this.domElement.getBoundingClientRect();

      const ndcX = ((screenCenterX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((screenCenterY - rect.top) / rect.height) * 2 + 1;

      const newCenterX = this.pinchCenterWorld.x - (ndcX * viewWidth) / 2;
      const newCenterY = this.pinchCenterWorld.y - (ndcY * viewHeight) / 2;

      this.camera.left = newCenterX - viewWidth / 2;
      this.camera.right = newCenterX + viewWidth / 2;
      this.camera.top = newCenterY + viewHeight / 2;
      this.camera.bottom = newCenterY - viewHeight / 2;

      this.clampCameraToBounds();
      this.updateCameraProjection();
    }
  }

  private onTouchEnd(event: TouchEvent): void {
    for (const touch of Array.from(event.changedTouches)) {
      this.touches.delete(touch.identifier);
    }

    if (this.touches.size === 0) {
      this.gestureType = null;
    } else if (this.touches.size === 1 && this.gestureType === 'pinch') {
      this.gestureType = 'pan';
      const touch = this.touches.values().next().value!;
      this.panStartMouse = { x: touch.currentX, y: touch.currentY };
      this.panStartCameraCenter = {
        x: (this.camera.left + this.camera.right) / 2,
        y: (this.camera.top + this.camera.bottom) / 2,
      };
    }
  }

  private onTouchCancel(_event: TouchEvent): void {
    this.touches.clear();
    this.gestureType = null;
  }

  /**
   * Zooms the camera to show exactly the given horizontal step range
   */
  zoomToStepRange(leftStep: number, rightStep: number): void {
    const targetViewWidth = rightStep - leftStep;

    const gridAspect = this.gridWidth / this.gridHeight;
    const maxViewWidth = this.containerAspect > gridAspect
      ? this.gridHeight * this.containerAspect
      : this.gridWidth;

    this.zoomLevel = Math.max(0, Math.min(1,
      (targetViewWidth - this.minViewWidth) / (maxViewWidth - this.minViewWidth)
    ));

    this.applyZoom();

    // Center camera on the target range
    const centerX = (leftStep + rightStep) / 2;
    const viewWidth = this.camera.right - this.camera.left;
    const viewHeight = this.camera.top - this.camera.bottom;
    const centerY = (this.camera.top + this.camera.bottom) / 2;

    this.camera.left = centerX - viewWidth / 2;
    this.camera.right = centerX + viewWidth / 2;
    this.camera.top = centerY + viewHeight / 2;
    this.camera.bottom = centerY - viewHeight / 2;

    this.clampCameraToBounds();
    this.updateCameraProjection();
  }

  /**
   * Resets the view to show the entire grid (zoomed out)
   */
  resetView(): void {
    this.zoomLevel = 1.0;
    this.applyZoom();

    const centerX = this.gridWidth / 2;
    const centerY = this.gridHeight / 2;
    const viewWidth = this.camera.right - this.camera.left;
    const viewHeight = this.camera.top - this.camera.bottom;

    this.camera.left = centerX - viewWidth / 2;
    this.camera.right = centerX + viewWidth / 2;
    this.camera.top = centerY + viewHeight / 2;
    this.camera.bottom = centerY - viewHeight / 2;

    this.clampCameraToBounds();
    this.updateCameraProjection();
  }

  /**
   * Cancel any ongoing pan operation
   * Called when another interaction (like resize) takes over
   */
  cancelPan(): void {
    this.isPanning = false;
    this.touches.clear();
    this.gestureType = null;
    this.domElement.style.cursor = 'pointer';
  }

  /**
   * Disposes of event listeners
   */
  dispose(): void {
    this.detachTouchEvents();
  }
}
