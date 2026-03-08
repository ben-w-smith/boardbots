# Spaceship Design Research Spike

**Date:** 2026-03-07
**Goal:** Research design options for replacing the current robot visualization (colored circle with arrow) with sleek fighter ship designs.

## Current State

The current robot rendering is located in `packages/client/src/renderer.ts` in the `drawRobot` method (lines 200-336).

**Current implementation:**
- Colored circle body (`ctx.arc()`) with radius `hexSize * 0.5`
- White triangular arrow for direction indicator
- Radial gradient overlay for depth
- Selection glow effect
- Lock-down "X" icon overlay

**Design constraints:**
- Must be drawn with Canvas 2D API (no external sprites)
- Should be distinguishable by team color
- Should clearly show direction
- Should look good at small sizes (hexSize * 0.5 radius ~ 15-30 pixels)
- Should be simple but "sleek" looking

---

## Design Inspiration & References

### Classic Game References

1. **Asteroids (1979, Atari)**
   - Simple triangular vector ship
   - Clean geometric lines
   - White/glowing lines on black background
   - Distinctive silhouette at any size

2. **Space Wars (1962, MIT)**
   - Various simple geometric ship shapes
   - One of the first space combat games
   - Clean, readable designs

3. **FTL: Faster Than Light**
   - Top-down 2D pixel art ships
   - Module-based designs with clear silhouettes
   - Ships remain readable at small sizes

4. **Geometry Wars**
   - Neon geometric shapes
   - Glowing effects on clean lines
   - Simple shapes with high visual impact

### Design Principles from Research

From [MDN Canvas Tutorial](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Drawing_shapes):
- Use `Path2D` for reusable shapes
- Combine basic shapes (triangles, lines, arcs) for complex designs
- Use `translate()` and `rotate()` for positioning
- Consider pixel alignment for crisp edges at small sizes

---

## Proposed Design Options

### Option 1: Classic Triangle Fighter (Asteroids Style)

A simple, iconic triangle ship that's instantly recognizable and works well at small sizes.

```typescript
function drawTriangleShip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  angle: number,
  color: string
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Main ship body - sleek triangle
  ctx.beginPath();
  ctx.moveTo(radius * 0.9, 0);              // Nose (pointing right)
  ctx.lineTo(-radius * 0.6, -radius * 0.5); // Back left
  ctx.lineTo(-radius * 0.3, 0);             // Back center indent
  ctx.lineTo(-radius * 0.6, radius * 0.5);  // Back right
  ctx.closePath();

  ctx.fillStyle = color;
  ctx.fill();

  // Highlight stripe
  ctx.beginPath();
  ctx.moveTo(radius * 0.7, 0);
  ctx.lineTo(-radius * 0.2, -radius * 0.15);
  ctx.lineTo(-radius * 0.2, radius * 0.15);
  ctx.closePath();
  ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
  ctx.fill();

  ctx.restore();
}
```

**Pros:**
- Instantly recognizable as a spaceship
- Works well at very small sizes
- Clean silhouette
- Fast to render

**Cons:**
- Very simple, may not feel "sleek" enough
- Limited visual interest

---

### Option 2: Sleek Dart Fighter (Recommended)

A more refined design with swept-back wings and engine detail. Inspired by classic sci-fi fighters.

```typescript
function drawDartShip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  angle: number,
  color: string,
  isLockedDown: boolean
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Engine glow (back of ship)
  if (!isLockedDown) {
    const glowGradient = ctx.createRadialGradient(
      -radius * 0.5, 0, 0,
      -radius * 0.5, 0, radius * 0.3
    );
    glowGradient.addColorStop(0, color);
    glowGradient.addColorStop(0.5, color.replace(")", ", 0.5)").replace("rgb", "rgba"));
    glowGradient.addColorStop(1, "transparent");

    ctx.beginPath();
    ctx.arc(-radius * 0.5, 0, radius * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = glowGradient;
    ctx.fill();
  }

  // Main hull - sleek dart shape
  ctx.beginPath();
  ctx.moveTo(radius * 0.95, 0);               // Sharp nose
  ctx.lineTo(radius * 0.3, -radius * 0.15);   // Front upper
  ctx.lineTo(-radius * 0.2, -radius * 0.35);  // Wing upper
  ctx.lineTo(-radius * 0.5, -radius * 0.15);  // Wing tip upper
  ctx.lineTo(-radius * 0.4, 0);               // Back center
  ctx.lineTo(-radius * 0.5, radius * 0.15);   // Wing tip lower
  ctx.lineTo(-radius * 0.2, radius * 0.35);   // Wing lower
  ctx.lineTo(radius * 0.3, radius * 0.15);    // Front lower
  ctx.closePath();

  ctx.fillStyle = isLockedDown ? desaturateColor(color) : color;
  ctx.fill();

  // Cockpit detail
  ctx.beginPath();
  ctx.moveTo(radius * 0.6, 0);
  ctx.lineTo(radius * 0.2, -radius * 0.08);
  ctx.lineTo(radius * 0.2, radius * 0.08);
  ctx.closePath();
  ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
  ctx.fill();

  // Wing highlight lines
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(radius * 0.3, -radius * 0.15);
  ctx.lineTo(-radius * 0.4, -radius * 0.1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(radius * 0.3, radius * 0.15);
  ctx.lineTo(-radius * 0.4, radius * 0.1);
  ctx.stroke();

  ctx.restore();
}

// Helper for locked-down state
function desaturateColor(color: string): string {
  // For hex colors like "#00D4FF"
  if (color.startsWith("#")) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    const gray = Math.round(r * 0.3 + g * 0.3 + b * 0.3);
    return `rgb(${Math.round(r * 0.4 + gray * 0.6)}, ${Math.round(g * 0.4 + gray * 0.6)}, ${Math.round(b * 0.4 + gray * 0.6)})`;
  }
  return color;
}
```

**Pros:**
- Sleek, modern appearance
- Clear direction indicator (nose)
- Engine glow adds visual interest
- Still works well at small sizes
- Wings help with silhouette recognition

**Cons:**
- Slightly more complex rendering
- Needs careful tuning for very small sizes

---

### Option 3: Hexagonal Scout Ship

A more unique design using hexagonal elements that tie into the game's hex grid theme.

```typescript
function drawHexShip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  angle: number,
  color: string
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Main hexagonal hull
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const hexAngle = (Math.PI / 3) * i;
    const hx = Math.cos(hexAngle) * radius * 0.7;
    const hy = Math.sin(hexAngle) * radius * 0.7;
    if (i === 0) ctx.moveTo(hx, hy);
    else ctx.lineTo(hx, hy);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();

  // Forward protrusion (nose)
  ctx.beginPath();
  ctx.moveTo(radius * 0.9, 0);
  ctx.lineTo(radius * 0.35, -radius * 0.25);
  ctx.lineTo(radius * 0.35, radius * 0.25);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();

  // Central core detail
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.25, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
  ctx.fill();

  // Direction indicator line
  ctx.beginPath();
  ctx.moveTo(radius * 0.25, 0);
  ctx.lineTo(radius * 0.75, 0);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}
```

**Pros:**
- Unique design that ties into game's hex theme
- Clear direction via nose protrusion
- Symmetrical design looks balanced

**Cons:**
- May look less "fighter-like"
- Hexagon shape might be confused with hex tiles

---

## Recommendation

**Recommended Design: Option 2 - Sleek Dart Fighter**

The Dart Fighter offers the best balance of:
1. **Sleek appearance** - Swept wings and pointed nose look fast and modern
2. **Readability** - Clear silhouette at all sizes
3. **Direction indication** - Nose points clearly in facing direction
4. **Visual interest** - Engine glow and cockpit detail add polish
5. **Team color support** - Main body color easily identifies team
6. **Locked state** - Engine glow turns off, body desaturates

---

## Animation Considerations

### Idle Animation
- **Engine pulse**: Subtle pulsing of the engine glow (0.8x to 1.2x scale)
- **No movement**: Ship remains static otherwise to avoid visual noise

```typescript
// Engine pulse animation
const pulse = 0.9 + Math.sin(now / 500) * 0.1;
const glowRadius = radius * 0.3 * pulse;
```

### Selection Animation
- **Existing glow**: Keep current selection glow ring
- **Enhanced engine**: Increase engine glow intensity when selected
- **No rotation**: Avoid rotating ship as it needs to show direction

### Movement Animation
- **Trail effect**: Optional brief engine trail during movement
- **Smooth position**: Use existing animation system for position interpolation
- **Direction change**: Smooth rotation interpolation (already implemented)

### Lock-Down Animation
- **Engine off**: Remove engine glow immediately
- **Desaturate**: Fade color to dimmer version
- **Existing flash**: Keep the yellow flash ring effect

---

## Implementation Notes

1. **Replace `drawRobot` method** in `renderer.ts`
2. **Add helper function** for color desaturation
3. **Add engine glow state** based on `isLockedDown`
4. **Test at various hexSize values** to ensure readability
5. **Consider adding** a subtle ship shadow or outline for better contrast against dark hexes

---

## References

- [MDN Canvas API Tutorial - Drawing Shapes](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Drawing_shapes)
- Asteroids (1979) - Classic vector graphics ship design
- FTL: Faster Than Light - Top-down spaceship art direction
- Geometry Wars - Neon geometric aesthetics
