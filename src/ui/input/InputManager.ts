import * as THREE from 'three';
import type { NormalizedPointerEvent, InputHandler } from './InputEvent';
import { screenToWorld } from '@/utils';

/**
 * InputManager - Central event dispatcher for unified input handling
 *
 * Manages pointer, wheel, and context menu events, normalizing them
 * into a common format and dispatching to registered handlers by priority.
 *
 * Features:
 * - Unified mouse/touch handling via pointer events
 * - Priority-based handler selection
 * - Automatic handler claiming for drag operations
 * - World coordinate calculation for each event
 */
export class InputManager {
  private handlers: InputHandler[] = [];
  private activeHandler: InputHandler | null = null;
  private domElement: HTMLElement;
  private camera: THREE.OrthographicCamera;

  // Touch tracking
  private touchCount: number = 0;

  // Bound event handlers for cleanup
  private boundPointerDown: (e: PointerEvent) => void;
  private boundPointerMove: (e: PointerEvent) => void;
  private boundPointerUp: (e: PointerEvent) => void;
  private boundWheel: (e: WheelEvent) => void;
  private boundContextMenu: (e: MouseEvent) => void;
  private boundTouchStart: (e: TouchEvent) => void;
  private boundTouchEnd: (e: TouchEvent) => void;

  constructor(domElement: HTMLElement, camera: THREE.OrthographicCamera) {
    this.domElement = domElement;
    this.camera = camera;

    // Bind handlers
    this.boundPointerDown = this.onPointerDown.bind(this);
    this.boundPointerMove = this.onPointerMove.bind(this);
    this.boundPointerUp = this.onPointerUp.bind(this);
    this.boundWheel = this.onWheel.bind(this);
    this.boundContextMenu = this.onContextMenu.bind(this);
    this.boundTouchStart = this.onTouchStart.bind(this);
    this.boundTouchEnd = this.onTouchEnd.bind(this);

    this.attachEvents();
  }

  /**
   * Register an input handler
   * Handlers are sorted by priority (lower = higher priority)
   */
  register(handler: InputHandler): void {
    this.handlers.push(handler);
    this.handlers.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Unregister an input handler
   */
  unregister(handler: InputHandler): void {
    const index = this.handlers.indexOf(handler);
    if (index !== -1) {
      this.handlers.splice(index, 1);
    }
    if (this.activeHandler === handler) {
      this.activeHandler = null;
    }
  }

  /**
   * Update camera reference (if camera changes)
   */
  setCamera(camera: THREE.OrthographicCamera): void {
    this.camera = camera;
  }

  /**
   * Attach DOM event listeners
   */
  private attachEvents(): void {
    this.domElement.addEventListener('pointerdown', this.boundPointerDown);
    this.domElement.addEventListener('pointermove', this.boundPointerMove);
    this.domElement.addEventListener('pointerup', this.boundPointerUp);
    this.domElement.addEventListener('pointercancel', this.boundPointerUp);
    this.domElement.addEventListener('wheel', this.boundWheel, { passive: false });
    this.domElement.addEventListener('contextmenu', this.boundContextMenu);

    // Track touch count separately (pointer events don't give us total touch count)
    this.domElement.addEventListener('touchstart', this.boundTouchStart, { passive: true });
    this.domElement.addEventListener('touchend', this.boundTouchEnd, { passive: true });
  }

  /**
   * Detach DOM event listeners
   */
  private detachEvents(): void {
    this.domElement.removeEventListener('pointerdown', this.boundPointerDown);
    this.domElement.removeEventListener('pointermove', this.boundPointerMove);
    this.domElement.removeEventListener('pointerup', this.boundPointerUp);
    this.domElement.removeEventListener('pointercancel', this.boundPointerUp);
    this.domElement.removeEventListener('wheel', this.boundWheel);
    this.domElement.removeEventListener('contextmenu', this.boundContextMenu);
    this.domElement.removeEventListener('touchstart', this.boundTouchStart);
    this.domElement.removeEventListener('touchend', this.boundTouchEnd);
  }

  /**
   * Normalize a pointer event into our common format
   */
  private normalizeEvent(
    e: PointerEvent,
    type: 'down' | 'move' | 'up'
  ): NormalizedPointerEvent {
    const rect = this.domElement.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    const world = screenToWorld(this.camera, this.domElement, screenX, screenY);

    return {
      type,
      screenX,
      screenY,
      worldX: world.x,
      worldY: world.y,
      button: e.button,
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey,
      altKey: e.altKey,
      isTouchEvent: e.pointerType === 'touch',
      touchCount: this.touchCount,
      timestamp: e.timeStamp,
      originalEvent: e,
    };
  }

  /**
   * Handle pointer down - find a handler to claim the interaction
   */
  private onPointerDown(e: PointerEvent): void {
    const normalized = this.normalizeEvent(e, 'down');

    // Try handlers in priority order
    for (const handler of this.handlers) {
      if (handler.onPointerDown(normalized)) {
        this.activeHandler = handler;
        break;
      }
    }
  }

  /**
   * Handle pointer move - dispatch to active handler
   */
  private onPointerMove(e: PointerEvent): void {
    if (!this.activeHandler) return;

    const normalized = this.normalizeEvent(e, 'move');
    this.activeHandler.onPointerMove(normalized);
  }

  /**
   * Handle pointer up - dispatch to active handler and release
   */
  private onPointerUp(e: PointerEvent): void {
    if (!this.activeHandler) return;

    const normalized = this.normalizeEvent(e, 'up');
    this.activeHandler.onPointerUp(normalized);
    this.activeHandler = null;
  }

  /**
   * Handle wheel events
   */
  private onWheel(e: WheelEvent): void {
    // Try handlers in priority order
    for (const handler of this.handlers) {
      if (handler.onWheel?.(e)) {
        e.preventDefault();
        break;
      }
    }
  }

  /**
   * Handle context menu events
   */
  private onContextMenu(e: MouseEvent): void {
    // Try handlers in priority order
    for (const handler of this.handlers) {
      if (handler.onContextMenu?.(e)) {
        e.preventDefault();
        break;
      }
    }
  }

  /**
   * Track touch start for touch count
   */
  private onTouchStart(e: TouchEvent): void {
    this.touchCount = e.touches.length;
  }

  /**
   * Track touch end for touch count
   */
  private onTouchEnd(e: TouchEvent): void {
    this.touchCount = e.touches.length;
  }

  /**
   * Get the currently active handler (for debugging)
   */
  getActiveHandler(): InputHandler | null {
    return this.activeHandler;
  }

  /**
   * Get all registered handlers (for debugging)
   */
  getHandlers(): InputHandler[] {
    return [...this.handlers];
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.detachEvents();
    this.handlers = [];
    this.activeHandler = null;
  }
}
