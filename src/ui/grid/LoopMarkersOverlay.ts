import * as THREE from 'three';
import { GridConfig } from '@/config/GridConfig';
import { Sequence } from '@/core/Sequence';
import { screenToWorld } from '@/utils';

/**
 * Callback when loop markers change
 */
export type LoopMarkersChangeCallback = (start: number, end: number) => void;

/**
 * LoopMarkersOverlay - Visual loop region markers with drag interaction
 *
 * Renders two vertical lines indicating loop start and end positions.
 * Lines can be dragged horizontally and snap to step boundaries.
 */
export class LoopMarkersOverlay {
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private domElement: HTMLElement;
  private config: GridConfig;
  private sequence: Sequence;

  // Marker meshes
  private startMesh: THREE.Mesh | null = null;
  private endMesh: THREE.Mesh | null = null;

  // Grid dimensions
  private gridHeight = 0;

  // Marker appearance
  private markerColor = 0xffa500; // Orange
  private markerWidth = 0.15;
  private markerZPosition = 0.9; // Behind playhead, in front of notes

  // Drag state
  private isDragging: 'start' | 'end' | null = null;
  private dragThreshold = 0.5; // World units to detect marker hit

  // Bound event handlers
  private boundOnPointerDown: (e: MouseEvent | TouchEvent) => void;
  private boundOnPointerMove: (e: MouseEvent | TouchEvent) => void;
  private boundOnPointerUp: (e: MouseEvent | TouchEvent) => void;

  // Callbacks
  private onChange: LoopMarkersChangeCallback | null = null;
  private onCancelPan: (() => void) | null = null;

  constructor(
    scene: THREE.Scene,
    camera: THREE.OrthographicCamera,
    domElement: HTMLElement,
    config: GridConfig,
    sequence: Sequence
  ) {
    this.scene = scene;
    this.camera = camera;
    this.domElement = domElement;
    this.config = config;
    this.sequence = sequence;

    this.boundOnPointerDown = this.onPointerDown.bind(this);
    this.boundOnPointerMove = this.onPointerMove.bind(this);
    this.boundOnPointerUp = this.onPointerUp.bind(this);

    this.createMeshes();
    this.attachEvents();
  }

  /**
   * Set callback for marker changes
   */
  setChangeCallback(callback: LoopMarkersChangeCallback): void {
    this.onChange = callback;
  }

  /**
   * Set callback to cancel panning (prevents conflict with grid pan)
   */
  setCancelPanCallback(callback: () => void): void {
    this.onCancelPan = callback;
  }

  /**
   * Create the marker meshes
   */
  private createMeshes(): void {
    const geometry = new THREE.PlaneGeometry(1, 1);

    // Start marker
    const startMaterial = new THREE.MeshBasicMaterial({
      color: this.markerColor,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
    this.startMesh = new THREE.Mesh(geometry, startMaterial);
    this.scene.add(this.startMesh);

    // End marker
    const endMaterial = new THREE.MeshBasicMaterial({
      color: this.markerColor,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
    this.endMesh = new THREE.Mesh(geometry.clone(), endMaterial);
    this.scene.add(this.endMesh);
  }

  /**
   * Update marker positions from sequence
   */
  update(gridHeight: number): void {
    this.gridHeight = gridHeight;
    const markers = this.sequence.getLoopMarkers();

    if (this.startMesh) {
      const x = markers.start + this.markerWidth / 2;
      const y = gridHeight / 2;
      this.startMesh.position.set(x, y, this.markerZPosition);
      this.startMesh.scale.set(this.markerWidth, gridHeight, 1);
    }

    if (this.endMesh) {
      const x = markers.end - this.markerWidth / 2;
      const y = gridHeight / 2;
      this.endMesh.position.set(x, y, this.markerZPosition);
      this.endMesh.scale.set(this.markerWidth, gridHeight, 1);
    }
  }

  /**
   * Attach event listeners
   */
  private attachEvents(): void {
    this.domElement.addEventListener('mousedown', this.boundOnPointerDown, { capture: true });
    this.domElement.addEventListener('touchstart', this.boundOnPointerDown, { capture: true, passive: false });
    document.addEventListener('mousemove', this.boundOnPointerMove);
    document.addEventListener('touchmove', this.boundOnPointerMove, { passive: false });
    document.addEventListener('mouseup', this.boundOnPointerUp);
    document.addEventListener('touchend', this.boundOnPointerUp);
    document.addEventListener('touchcancel', this.boundOnPointerUp);
  }

  /**
   * Detach event listeners
   */
  private detachEvents(): void {
    this.domElement.removeEventListener('mousedown', this.boundOnPointerDown, { capture: true });
    this.domElement.removeEventListener('touchstart', this.boundOnPointerDown, { capture: true });
    document.removeEventListener('mousemove', this.boundOnPointerMove);
    document.removeEventListener('touchmove', this.boundOnPointerMove);
    document.removeEventListener('mouseup', this.boundOnPointerUp);
    document.removeEventListener('touchend', this.boundOnPointerUp);
    document.removeEventListener('touchcancel', this.boundOnPointerUp);
  }

  /**
   * Get pointer position from event
   */
  private getPointerPos(e: MouseEvent | TouchEvent): { x: number; y: number } | null {
    if ('touches' in e) {
      // For touchmove, use touches; for touchend, use changedTouches
      const touch = e.touches[0] || e.changedTouches?.[0];
      if (touch) {
        return { x: touch.clientX, y: touch.clientY };
      }
      return null;
    } else if ('clientX' in e) {
      return { x: e.clientX, y: e.clientY };
    }
    return null;
  }

  /**
   * Convert screen to world coordinates
   */
  private toWorld(screenX: number, screenY: number): { x: number; y: number } {
    return screenToWorld(this.camera, this.domElement, screenX, screenY);
  }

  /**
   * Handle pointer down
   */
  private onPointerDown(e: MouseEvent | TouchEvent): void {
    const pos = this.getPointerPos(e);
    if (!pos) return;

    const world = this.toWorld(pos.x, pos.y);
    const markers = this.sequence.getLoopMarkers();

    const distToStart = Math.abs(world.x - markers.start);
    const distToEnd = Math.abs(world.x - markers.end);

    // Check which marker is closer (if both within threshold)
    if (distToStart < this.dragThreshold || distToEnd < this.dragThreshold) {
      // Pick the closer one
      if (distToStart <= distToEnd && distToStart < this.dragThreshold) {
        this.isDragging = 'start';
      } else if (distToEnd < this.dragThreshold) {
        this.isDragging = 'end';
      }

      if (this.isDragging) {
        e.preventDefault();
        e.stopPropagation();
        this.onCancelPan?.(); // Cancel any ongoing pan
        this.domElement.style.cursor = 'ew-resize';
      }
    }
  }

  /**
   * Handle pointer move
   */
  private onPointerMove(e: MouseEvent | TouchEvent): void {
    if (!this.isDragging) return;

    e.preventDefault();
    e.stopPropagation();

    const pos = this.getPointerPos(e);
    if (!pos) return;

    const world = this.toWorld(pos.x, pos.y);

    // Get fresh marker values
    const markers = this.sequence.getLoopMarkers();

    // Snap to step
    const snappedStep = Math.round(world.x);

    // Enforce minimum loop length of 1 step
    const minLoopLength = 1;

    if (this.isDragging === 'start') {
      // Clamp start marker: >= 0 and < end
      const newStart = Math.max(0, Math.min(snappedStep, markers.end - minLoopLength));
      if (newStart !== markers.start) {
        this.sequence.setLoopMarkers({ start: newStart, end: markers.end });
        this.update(this.gridHeight);
        this.onChange?.(newStart, markers.end);
      }
    } else if (this.isDragging === 'end') {
      // Clamp end marker: > start and <= max
      const maxEnd = this.config.stepsPerBar * 128; // Max supported bars
      const newEnd = Math.max(markers.start + minLoopLength, Math.min(snappedStep, maxEnd));
      if (newEnd !== markers.end) {
        this.sequence.setLoopMarkers({ start: markers.start, end: newEnd });
        this.update(this.gridHeight);
        this.onChange?.(markers.start, newEnd);
      }
    }
  }

  /**
   * Handle pointer up
   */
  private onPointerUp(_e: MouseEvent | TouchEvent): void {
    if (this.isDragging) {
      this.isDragging = null;
      this.domElement.style.cursor = 'pointer';
    }
  }

  /**
   * Set marker color
   */
  setColor(color: number): void {
    this.markerColor = color;
    if (this.startMesh) {
      (this.startMesh.material as THREE.MeshBasicMaterial).color.setHex(color);
    }
    if (this.endMesh) {
      (this.endMesh.material as THREE.MeshBasicMaterial).color.setHex(color);
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.detachEvents();

    if (this.startMesh) {
      this.startMesh.geometry.dispose();
      (this.startMesh.material as THREE.Material).dispose();
      this.scene.remove(this.startMesh);
      this.startMesh = null;
    }

    if (this.endMesh) {
      this.endMesh.geometry.dispose();
      (this.endMesh.material as THREE.Material).dispose();
      this.scene.remove(this.endMesh);
      this.endMesh = null;
    }
  }
}
