/**
 * GridControls - Handles pan and zoom interactions for the note grid
 *
 * Supports mouse (PC) and touch (mobile) input for panning and zooming.
 * View is bounded to grid edges with no empty space visible beyond boundaries.
 */
class GridControls {
  /**
   * Creates a new GridControls instance
   * @param {THREE.OrthographicCamera} camera - The orthographic camera
   * @param {HTMLElement} domElement - The DOM element to attach events to
   * @param {Object} config - Grid configuration
   * @param {Function} renderCallback - Function to call when view changes
   * @param {Function} cameraChangeCallback - Function to call when camera bounds change
   */
  constructor(camera, domElement, config, renderCallback, cameraChangeCallback) {
    this.camera = camera;
    this.domElement = domElement;
    this.config = config;
    this.renderCallback = renderCallback || (() => {});
    this.cameraChangeCallback = cameraChangeCallback || (() => {});

    // Grid dimensions (updated when grid changes)
    this.gridWidth = 0;
    this.gridHeight = 0;

    // Raycaster for mouse position conversion
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Current grid coordinates under mouse
    this.gridPosition = { x: 0, y: 0 };

    // Zoom state
    // zoomLevel: 1.0 = zoomed out (entire grid visible), 0.0 = zoomed in (1 bar visible)
    this.zoomLevel = 1.0;
    this.zoomSpeed = 0.1;
    this.minViewWidth = 16; // 1 bar (constant)
    this.containerAspect = 1;

    // Pan state (mouse)
    this.isPanning = false;
    this.panStartMouse = { x: 0, y: 0 };
    this.panStartCameraCenter = { x: 0, y: 0 };

    // Touch state
    this.touches = new Map(); // touchId -> {startX, startY, currentX, currentY}
    this.gestureType = null; // 'pan' | 'pinch' | null
    this.initialPinchDistance = 0;
    this.initialZoomLevel = 0;
    this.pinchCenterWorld = { x: 0, y: 0 };

    // Bind event handlers
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onMouseLeave = this.onMouseLeave.bind(this);
    this.onWheel = this.onWheel.bind(this);
    this.onTouchStart = this.onTouchStart.bind(this);
    this.onTouchMove = this.onTouchMove.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);
    this.onTouchCancel = this.onTouchCancel.bind(this);

    // Initialize container aspect ratio
    this.updateContainerAspect();

    // Attach events
    this.attachEvents();
  }

  /**
   * Updates the grid dimensions and recalculates zoom limits
   * @param {number} barCount - Number of bars
   * @param {number} octaveCount - Number of octaves
   */
  setGridDimensions(barCount, octaveCount) {
    this.gridWidth = barCount * this.config.stepsPerBar;
    this.gridHeight = octaveCount * this.config.semitonesPerOctave;

    // Recalculate zoom and clamp view
    this.applyZoom();
    this.clampCameraToBounds();
    this.updateCameraProjection();
  }

  /**
   * Updates the container aspect ratio (call on resize)
   */
  updateContainerAspect() {
    const rect = this.domElement.getBoundingClientRect();
    this.containerAspect = rect.width / rect.height;
  }

  /**
   * Converts screen coordinates to world coordinates
   * @param {number} screenX - Screen X coordinate (clientX)
   * @param {number} screenY - Screen Y coordinate (clientY)
   * @returns {Object} World coordinates {x, y}
   */
  screenToWorld(screenX, screenY) {
    const rect = this.domElement.getBoundingClientRect();

    // Normalize to -1 to +1
    const ndcX = ((screenX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((screenY - rect.top) / rect.height) * 2 + 1;

    // Convert to world coordinates
    const worldX = (ndcX * (this.camera.right - this.camera.left) / 2) +
                   (this.camera.right + this.camera.left) / 2;
    const worldY = (ndcY * (this.camera.top - this.camera.bottom) / 2) +
                   (this.camera.top + this.camera.bottom) / 2;

    return { x: worldX, y: worldY };
  }

  /**
   * Calculates the view width based on current zoom level
   * @returns {number} View width in world units
   */
  calculateViewWidth() {
    // Calculate the maximum view width (when zoomed out)
    const gridAspect = this.gridWidth / this.gridHeight;
    let maxViewWidth;

    if (this.containerAspect > gridAspect) {
      // Container is wider than grid - view width determined by height
      maxViewWidth = this.gridHeight * this.containerAspect;
    } else {
      // Container is taller or equal - view width equals grid width
      maxViewWidth = this.gridWidth;
    }

    // Interpolate between min and max based on zoom level
    // zoomLevel 1.0 = maxViewWidth, zoomLevel 0.0 = minViewWidth
    return this.minViewWidth + (maxViewWidth - this.minViewWidth) * this.zoomLevel;
  }

  /**
   * Applies the current zoom level to the camera
   */
  applyZoom() {
    const viewWidth = this.calculateViewWidth();
    const viewHeight = viewWidth / this.containerAspect;

    // Get current camera center
    const centerX = (this.camera.left + this.camera.right) / 2;
    const centerY = (this.camera.top + this.camera.bottom) / 2;

    // Set new camera bounds
    this.camera.left = centerX - viewWidth / 2;
    this.camera.right = centerX + viewWidth / 2;
    this.camera.top = centerY + viewHeight / 2;
    this.camera.bottom = centerY - viewHeight / 2;
  }

  /**
   * Clamps the camera position to keep the view within grid bounds
   */
  clampCameraToBounds() {
    const viewWidth = this.camera.right - this.camera.left;
    const viewHeight = this.camera.top - this.camera.bottom;

    let centerX = (this.camera.left + this.camera.right) / 2;
    let centerY = (this.camera.top + this.camera.bottom) / 2;

    // Clamp X
    if (viewWidth >= this.gridWidth) {
      // View is wider than grid - center on grid
      centerX = this.gridWidth / 2;
    } else {
      // Clamp to keep view within grid
      centerX = Math.max(viewWidth / 2, Math.min(this.gridWidth - viewWidth / 2, centerX));
    }

    // Clamp Y
    if (viewHeight >= this.gridHeight) {
      // View is taller than grid - center on grid
      centerY = this.gridHeight / 2;
    } else {
      // Clamp to keep view within grid
      centerY = Math.max(viewHeight / 2, Math.min(this.gridHeight - viewHeight / 2, centerY));
    }

    // Apply clamped center
    this.camera.left = centerX - viewWidth / 2;
    this.camera.right = centerX + viewWidth / 2;
    this.camera.top = centerY + viewHeight / 2;
    this.camera.bottom = centerY - viewHeight / 2;
  }

  /**
   * Updates the camera projection matrix and triggers a render
   */
  updateCameraProjection() {
    this.camera.updateProjectionMatrix();
    this.renderCallback();
    this.notifyCameraChange();
  }

  /**
   * Notifies listeners that camera bounds have changed
   */
  notifyCameraChange() {
    this.cameraChangeCallback({
      left: this.camera.left,
      right: this.camera.right,
      top: this.camera.top,
      bottom: this.camera.bottom
    });
  }

  /**
   * Zooms at a specific world point
   * @param {number} worldX - World X coordinate to zoom at
   * @param {number} worldY - World Y coordinate to zoom at
   * @param {number} delta - Zoom delta (positive = zoom in, negative = zoom out)
   */
  zoomAtPoint(worldX, worldY, delta) {
    // Store old zoom level
    const oldZoomLevel = this.zoomLevel;

    // Apply zoom change
    this.zoomLevel = Math.max(0, Math.min(1, this.zoomLevel - delta * this.zoomSpeed));

    // If zoom didn't change, nothing to do
    if (this.zoomLevel === oldZoomLevel) return;

    // Get current camera center and view dimensions
    const oldViewWidth = this.camera.right - this.camera.left;
    const oldViewHeight = this.camera.top - this.camera.bottom;
    const oldCenterX = (this.camera.left + this.camera.right) / 2;
    const oldCenterY = (this.camera.top + this.camera.bottom) / 2;

    // Calculate cursor offset from camera center (as fraction of view)
    const offsetX = (worldX - oldCenterX) / oldViewWidth;
    const offsetY = (worldY - oldCenterY) / oldViewHeight;

    // Apply new zoom level
    this.applyZoom();

    // Get new view dimensions
    const newViewWidth = this.camera.right - this.camera.left;
    const newViewHeight = this.camera.top - this.camera.bottom;

    // Position camera so cursor stays at same world position
    // New center should be: worldX - offsetX * newViewWidth
    const newCenterX = worldX - offsetX * newViewWidth;
    const newCenterY = worldY - offsetY * newViewHeight;

    this.camera.left = newCenterX - newViewWidth / 2;
    this.camera.right = newCenterX + newViewWidth / 2;
    this.camera.top = newCenterY + newViewHeight / 2;
    this.camera.bottom = newCenterY - newViewHeight / 2;

    // Clamp to grid bounds
    this.clampCameraToBounds();
    this.updateCameraProjection();
  }

  /**
   * Attaches mouse and touch event listeners
   */
  attachEvents() {
    // Mouse events
    this.domElement.addEventListener('mousemove', this.onMouseMove);
    this.domElement.addEventListener('mousedown', this.onMouseDown);
    this.domElement.addEventListener('mouseup', this.onMouseUp);
    this.domElement.addEventListener('mouseleave', this.onMouseLeave);
    this.domElement.addEventListener('wheel', this.onWheel, { passive: false });

    // Touch events
    this.domElement.addEventListener('touchstart', this.onTouchStart, { passive: false });
    this.domElement.addEventListener('touchmove', this.onTouchMove, { passive: false });
    this.domElement.addEventListener('touchend', this.onTouchEnd);
    this.domElement.addEventListener('touchcancel', this.onTouchCancel);
  }

  /**
   * Detaches mouse and touch event listeners
   */
  detachEvents() {
    // Mouse events
    this.domElement.removeEventListener('mousemove', this.onMouseMove);
    this.domElement.removeEventListener('mousedown', this.onMouseDown);
    this.domElement.removeEventListener('mouseup', this.onMouseUp);
    this.domElement.removeEventListener('mouseleave', this.onMouseLeave);
    this.domElement.removeEventListener('wheel', this.onWheel);

    // Touch events
    this.domElement.removeEventListener('touchstart', this.onTouchStart);
    this.domElement.removeEventListener('touchmove', this.onTouchMove);
    this.domElement.removeEventListener('touchend', this.onTouchEnd);
    this.domElement.removeEventListener('touchcancel', this.onTouchCancel);
  }

  /**
   * Handles mouse move events
   * @param {MouseEvent} event
   */
  onMouseMove(event) {
    // Ignore mouse during touch gestures
    if (this.touches.size > 0) return;

    // Convert mouse position to normalized device coordinates (-1 to +1)
    const rect = this.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Update grid position
    this.updateGridPosition();

    // Handle panning
    if (this.isPanning) {
      const currentWorld = this.screenToWorld(event.clientX, event.clientY);
      const startWorld = this.screenToWorld(this.panStartMouse.x, this.panStartMouse.y);

      // Calculate delta in world coordinates at the start of pan
      // We need to use a consistent scale, so recalculate based on pan start
      const rect = this.domElement.getBoundingClientRect();
      const ndcDeltaX = ((event.clientX - this.panStartMouse.x) / rect.width) * 2;
      const ndcDeltaY = -((event.clientY - this.panStartMouse.y) / rect.height) * 2;

      const viewWidth = this.camera.right - this.camera.left;
      const viewHeight = this.camera.top - this.camera.bottom;

      const worldDeltaX = ndcDeltaX * viewWidth / 2;
      const worldDeltaY = ndcDeltaY * viewHeight / 2;

      // New camera center is start center minus delta (pan in opposite direction of drag)
      const newCenterX = this.panStartCameraCenter.x - worldDeltaX;
      const newCenterY = this.panStartCameraCenter.y - worldDeltaY;

      this.camera.left = newCenterX - viewWidth / 2;
      this.camera.right = newCenterX + viewWidth / 2;
      this.camera.top = newCenterY + viewHeight / 2;
      this.camera.bottom = newCenterY - viewHeight / 2;

      // Clamp to bounds
      this.clampCameraToBounds();
      this.updateCameraProjection();
    }
  }

  /**
   * Handles mouse down events
   * @param {MouseEvent} event
   */
  onMouseDown(event) {
    // Only handle left mouse button
    if (event.button !== 0) return;

    // Ignore mouse during touch gestures
    if (this.touches.size > 0) return;

    this.isPanning = true;
    this.panStartMouse = { x: event.clientX, y: event.clientY };
    this.panStartCameraCenter = {
      x: (this.camera.left + this.camera.right) / 2,
      y: (this.camera.top + this.camera.bottom) / 2
    };

    // Set cursor
    this.domElement.style.cursor = 'grabbing';
  }

  /**
   * Handles mouse up events
   * @param {MouseEvent} event
   */
  onMouseUp(event) {
    if (event.button !== 0) return;

    this.isPanning = false;
    this.domElement.style.cursor = 'grab';
  }

  /**
   * Handles mouse leave events
   * @param {MouseEvent} event
   */
  onMouseLeave(event) {
    this.isPanning = false;
    this.domElement.style.cursor = 'default';
  }

  /**
   * Handles mouse wheel events
   * @param {WheelEvent} event
   */
  onWheel(event) {
    // Ignore if Ctrl or Meta is held (browser zoom)
    if (event.ctrlKey || event.metaKey) return;

    event.preventDefault();

    // Get world position under cursor
    const worldPos = this.screenToWorld(event.clientX, event.clientY);

    // Calculate zoom delta (wheel up = zoom in = negative zoomLevel change)
    // deltaY is positive when scrolling down
    const delta = event.deltaY > 0 ? -1 : 1;

    this.zoomAtPoint(worldPos.x, worldPos.y, delta);
  }

  /**
   * Handles touch start events
   * @param {TouchEvent} event
   */
  onTouchStart(event) {
    event.preventDefault();

    // Track all new touches
    for (const touch of event.changedTouches) {
      this.touches.set(touch.identifier, {
        startX: touch.clientX,
        startY: touch.clientY,
        currentX: touch.clientX,
        currentY: touch.clientY
      });
    }

    // Determine gesture type
    if (this.touches.size === 1) {
      // Single touch - pan
      this.gestureType = 'pan';
      const touch = this.touches.values().next().value;
      this.panStartMouse = { x: touch.startX, y: touch.startY };
      this.panStartCameraCenter = {
        x: (this.camera.left + this.camera.right) / 2,
        y: (this.camera.top + this.camera.bottom) / 2
      };
    } else if (this.touches.size === 2) {
      // Two touches - pinch zoom
      this.gestureType = 'pinch';
      this.initializePinch();
    }
  }

  /**
   * Initializes pinch gesture state
   */
  initializePinch() {
    const touchArray = Array.from(this.touches.values());
    if (touchArray.length < 2) return;

    const t1 = touchArray[0];
    const t2 = touchArray[1];

    // Calculate initial pinch distance
    const dx = t2.currentX - t1.currentX;
    const dy = t2.currentY - t1.currentY;
    this.initialPinchDistance = Math.sqrt(dx * dx + dy * dy);
    this.initialZoomLevel = this.zoomLevel;

    // Calculate pinch center in world coordinates
    const centerX = (t1.currentX + t2.currentX) / 2;
    const centerY = (t1.currentY + t2.currentY) / 2;
    this.pinchCenterWorld = this.screenToWorld(centerX, centerY);
  }

  /**
   * Handles touch move events
   * @param {TouchEvent} event
   */
  onTouchMove(event) {
    event.preventDefault();

    // Update tracked touches
    for (const touch of event.changedTouches) {
      const tracked = this.touches.get(touch.identifier);
      if (tracked) {
        tracked.currentX = touch.clientX;
        tracked.currentY = touch.clientY;
      }
    }

    if (this.gestureType === 'pan' && this.touches.size === 1) {
      // Handle pan
      const touch = this.touches.values().next().value;
      const rect = this.domElement.getBoundingClientRect();

      const ndcDeltaX = ((touch.currentX - this.panStartMouse.x) / rect.width) * 2;
      const ndcDeltaY = -((touch.currentY - this.panStartMouse.y) / rect.height) * 2;

      const viewWidth = this.camera.right - this.camera.left;
      const viewHeight = this.camera.top - this.camera.bottom;

      const worldDeltaX = ndcDeltaX * viewWidth / 2;
      const worldDeltaY = ndcDeltaY * viewHeight / 2;

      const newCenterX = this.panStartCameraCenter.x - worldDeltaX;
      const newCenterY = this.panStartCameraCenter.y - worldDeltaY;

      this.camera.left = newCenterX - viewWidth / 2;
      this.camera.right = newCenterX + viewWidth / 2;
      this.camera.top = newCenterY + viewHeight / 2;
      this.camera.bottom = newCenterY - viewHeight / 2;

      this.clampCameraToBounds();
      this.updateCameraProjection();
    } else if (this.gestureType === 'pinch' && this.touches.size === 2) {
      // Handle pinch zoom
      const touchArray = Array.from(this.touches.values());
      const t1 = touchArray[0];
      const t2 = touchArray[1];

      // Calculate current pinch distance
      const dx = t2.currentX - t1.currentX;
      const dy = t2.currentY - t1.currentY;
      const currentDistance = Math.sqrt(dx * dx + dy * dy);

      // Calculate scale factor
      const scale = currentDistance / this.initialPinchDistance;

      // Use logarithmic scale for consistent zoom speed at all zoom levels
      // scale > 1 means fingers moved apart = zoom in = decrease zoomLevel
      // scale < 1 means fingers moved together = zoom out = increase zoomLevel
      const logScale = Math.log(scale);
      const pinchZoomSpeed = 0.7;
      const newZoomLevel = Math.max(0, Math.min(1, this.initialZoomLevel - logScale * pinchZoomSpeed));

      // Apply zoom centered on pinch center
      this.zoomLevel = newZoomLevel;
      this.applyZoom();

      // Get new view dimensions
      const viewWidth = this.camera.right - this.camera.left;
      const viewHeight = this.camera.top - this.camera.bottom;

      // Calculate current pinch center in screen coords
      const screenCenterX = (t1.currentX + t2.currentX) / 2;
      const screenCenterY = (t1.currentY + t2.currentY) / 2;
      const rect = this.domElement.getBoundingClientRect();

      // Calculate where pinch center is in NDC
      const ndcX = ((screenCenterX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((screenCenterY - rect.top) / rect.height) * 2 + 1;

      // We want the initial pinch world position to remain under the current pinch screen position
      // So: pinchCenterWorld.x = newCenterX + ndcX * viewWidth / 2
      // Therefore: newCenterX = pinchCenterWorld.x - ndcX * viewWidth / 2
      const newCenterX = this.pinchCenterWorld.x - ndcX * viewWidth / 2;
      const newCenterY = this.pinchCenterWorld.y - ndcY * viewHeight / 2;

      this.camera.left = newCenterX - viewWidth / 2;
      this.camera.right = newCenterX + viewWidth / 2;
      this.camera.top = newCenterY + viewHeight / 2;
      this.camera.bottom = newCenterY - viewHeight / 2;

      this.clampCameraToBounds();
      this.updateCameraProjection();
    }
  }

  /**
   * Handles touch end events
   * @param {TouchEvent} event
   */
  onTouchEnd(event) {
    // Remove ended touches
    for (const touch of event.changedTouches) {
      this.touches.delete(touch.identifier);
    }

    // Update gesture type
    if (this.touches.size === 0) {
      this.gestureType = null;
    } else if (this.touches.size === 1 && this.gestureType === 'pinch') {
      // Transitioned from pinch to pan
      this.gestureType = 'pan';
      const touch = this.touches.values().next().value;
      this.panStartMouse = { x: touch.currentX, y: touch.currentY };
      this.panStartCameraCenter = {
        x: (this.camera.left + this.camera.right) / 2,
        y: (this.camera.top + this.camera.bottom) / 2
      };
    }
  }

  /**
   * Handles touch cancel events
   * @param {TouchEvent} event
   */
  onTouchCancel(event) {
    // Clear all touches
    this.touches.clear();
    this.gestureType = null;
  }

  /**
   * Updates the current grid position based on mouse position
   */
  updateGridPosition() {
    // Convert normalized mouse coordinates to world coordinates
    const worldX = (this.mouse.x * (this.camera.right - this.camera.left) / 2) +
                   (this.camera.right + this.camera.left) / 2;
    const worldY = (this.mouse.y * (this.camera.top - this.camera.bottom) / 2) +
                   (this.camera.top + this.camera.bottom) / 2;

    this.gridPosition.x = worldX;
    this.gridPosition.y = worldY;
  }

  /**
   * Gets the current grid coordinates under the mouse
   * @returns {Object} Grid coordinates {x, y}
   */
  getGridPosition() {
    return { ...this.gridPosition };
  }

  /**
   * Resets the view to show the entire grid (zoomed out)
   */
  resetView() {
    this.zoomLevel = 1.0;
    this.applyZoom();

    // Center on grid
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
   * Disposes of event listeners
   */
  dispose() {
    this.detachEvents();
  }
}
