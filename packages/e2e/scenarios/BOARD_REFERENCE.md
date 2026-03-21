# Board Reference

Hex grid uses **axial coordinates (q, r)** with flat-top orientation.

## Hex Grid Diagram

```
          NW  (0,-1)      NE  (1,-1)
                 \     /
     W (-1,0) ---- (0,0) ---- E (1,0)
                 /     \
          SW (-1, 1)      SE  (0, 1)
```

For reference with cubic coordinates (q, r, s) where s = -q - r.

## Cardinal Directions

| Direction | (q, r) |
|-----------|--------|
| NW        | (0, -1) |
| NE        | (1, -1) |
| E         | (1, 0)  |
| SE        | (0, 1)  |
| SW        | (-1, 1) |
| W         | (-1, 0) |

## Board Dimensions

| Zone         | Radius | Description |
|--------------|--------|-------------|
| Arena        | ≤ 4    | Playable game area |
| Corridor     | 5      | Robot placement zone |

## Key Positions

| Position           | (q, r) | Description |
|--------------------|--------|-------------|
| Center             | (0, 0) | Arena center |
| ARENA_ENTRY_SOUTH  | (0, 4) | South arena entrance |
| CORRIDOR_SOUTH     | (0, 5) | South corridor hex |

## Corridor Placement Hexes

Robots are placed in the corridor (radius 5) facing inward toward the arena.

For arenaRadius = 4, corridor is at radius 5. The corridor consists of 30 hexes arranged in a ring.

Corridor hexes have distance = 5 from center:
- `pairDist({q, r}) = 5`

Each corridor hex may face multiple directions inward (toward arena).

## Pixel Coordinate Conversion

Use `renderer.getPixelFromHex(q, r)` to convert axial coords to canvas pixel coords for clicking.

Implementation (flat-top hex):
```javascript
x = centerX + hexSize * (3/2) * q
y = centerY + hexSize * (sqrt(3)/2 * q + sqrt(3) * r)
```

Returns `{ x, y }` relative to canvas top-left.
