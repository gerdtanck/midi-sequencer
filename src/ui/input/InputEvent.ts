/**
 * Normalized pointer event for unified input handling
 *
 * Abstracts mouse and touch events into a common format that
 * handlers can process without caring about the input source.
 */
export interface NormalizedPointerEvent {
  /** Event type */
  type: 'down' | 'move' | 'up';

  /** Screen coordinates (pixels) */
  screenX: number;
  screenY: number;

  /** World coordinates (grid units) */
  worldX: number;
  worldY: number;

  /** Mouse button (0=left, 1=middle, 2=right) */
  button: number;

  /** Modifier keys */
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;

  /** Touch-specific info */
  isTouchEvent: boolean;
  touchCount: number;

  /** Event timestamp for gesture detection */
  timestamp: number;

  /** Original DOM event (for advanced use cases) */
  originalEvent: PointerEvent | MouseEvent | TouchEvent;
}

/**
 * Input handler interface for event-driven input processing
 *
 * Handlers are checked in priority order (lower = higher priority).
 * When a handler returns true from onPointerDown, it "claims" the
 * interaction and receives all subsequent move/up events until release.
 */
export interface InputHandler {
  /** Handler priority (lower = higher priority, checked first) */
  priority: number;

  /** Handler name for debugging */
  name: string;

  /**
   * Called on pointer down
   * @returns true to claim this interaction (receive move/up events)
   */
  onPointerDown(e: NormalizedPointerEvent): boolean;

  /**
   * Called on pointer move (only if this handler claimed the interaction)
   */
  onPointerMove(e: NormalizedPointerEvent): void;

  /**
   * Called on pointer up (only if this handler claimed the interaction)
   */
  onPointerUp(e: NormalizedPointerEvent): void;

  /**
   * Called on wheel/scroll events
   * @returns true if handled (prevents other handlers)
   */
  onWheel?(e: WheelEvent): boolean;

  /**
   * Called on context menu (right-click)
   * @returns true if handled (prevents default context menu)
   */
  onContextMenu?(e: MouseEvent): boolean;
}
