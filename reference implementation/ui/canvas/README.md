# Canvas Grid Architecture

## Overview

The Canvas-based grid replaces DOM cell rendering with a Canvas element, improving performance for large grids (128 steps × 60 rows).

## Component Structure

### Canvas Layer (z-index: 1)
- **CanvasSequenceGrid** - Main Canvas grid component
- **CanvasRenderer** - Drawing operations (grid lines, notes)
- **CanvasHitTester** - Click detection (screen → grid coordinates)
- **CanvasSetup** - High-DPI initialization

### DOM Overlay Layer (z-index: 2+)
- **ScaleOverlay** - Out-of-scale row darkening (position: absolute)
- **PlaybackIndicator** - Vertical playhead line (position: absolute)
- **LoopMarkerControls** - Start/end position markers (position: absolute)

## Rendering Approach

**Line-based grid:** 188 draw calls (60 horizontal + 128 vertical lines) instead of 7,680 cell rectangles.

**Variable line thickness:**
- Thick lines: Octave boundaries (C notes), bar boundaries (every 16 steps)
- Thin lines: Semitones, beats

## Coordinate Spaces

1. **Screen space** - CSS pixels (clientX, clientY from events)
2. **Grid space** - Step (0-127) and pitch (0-59) indices
3. **Canvas backing store** - Scaled by devicePixelRatio for high-DPI

**Transform pipeline:** Screen → Grid → Canvas backing store

## Overlay Positioning Strategy

DOM overlays use CSS `position: absolute` with calculated offsets:

### ScaleOverlay
```typescript
// Calculate top position from pitch index
const visualRow = (numRows - 1) - pitch;
const top = visualRow * (rowHeight + rowGap);

bar.style.position = 'absolute';
bar.style.top = `${top}px`;
```

- **Independence:** No dependencies on DOM grid cells
- **Compatibility:** Works with both DOM and Canvas grid implementations
- **Positioning:** Uses GridConfig dimensions (rowHeight, rowGap)

### PlaybackIndicator
```typescript
// Calculate left position from step index
const leftPos = step * (gridStepWidth + gridGap);

playhead.style.left = `${leftPos}px`;
```

- **Independence:** Vertical line overlay, no grid cell interaction
- **Step highlighting:** Disabled for Canvas (will be drawn on Canvas layer)
- **Positioning:** Uses GridConfig dimensions (cellWidth, gridGap)

### Key Principle
**Overlays position themselves using math, not DOM queries.**

This allows them to work regardless of whether the grid is rendered as DOM elements or Canvas pixels.

## Event Handling

Canvas receives all pointer events. CanvasHitTester converts screen coordinates to grid coordinates for hit testing.

**Event flow:**
1. User clicks Canvas at screen position (clientX, clientY)
2. CanvasHitTester transforms screen → grid coordinates
3. Hit test determines if click is on note, grid cell, or background
4. Appropriate handler is called (note drag, cell toggle, etc.)

## Observer Pattern

Canvas subscribes to `Sequence.onChange()` just like DOM grid did. Uses requestAnimationFrame batching for 60fps rendering.

**Update flow:**
1. Note added/removed → `sequence.onChange()` fires
2. Canvas marks itself dirty
3. On next animation frame: Canvas redraws only if dirty
4. Dirty flag cleared after render

## High-DPI Support

Canvas backing store is scaled by `devicePixelRatio` to prevent blurry rendering on high-DPI displays (Retina, 4K, etc.).

```typescript
canvas.width = cssWidth * devicePixelRatio;
canvas.height = cssHeight * devicePixelRatio;
ctx.scale(devicePixelRatio, devicePixelRatio);
```

All drawing operations use CSS pixels - the scaling is handled by the context transform.
