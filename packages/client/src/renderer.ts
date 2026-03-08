import type { GameState, Pair, Robot } from "@lockitdown/engine";
import { pairAdd, pairDist, pairEq, pairSub } from "@lockitdown/engine";
import type { Animator } from "./animator.js";

export interface RenderOptions {
  hexSize?: number;
  padding?: number;
  colors?: Partial<ColorScheme>;
  animator?: Animator;
}

interface ColorScheme {
  background: string;
  arenaHex: string;
  arenaHexBorder: string;
  corridorHex: string;
  corridorHexBorder: string;
  player1: string;
  player2: string;
  player1Dim: string;
  player2Dim: string;
  beamColor: string;
  selectedGlow: string;
  validMove: string;
}

const DEFAULT_COLORS: ColorScheme = {
  background: "#0a0a0f",
  arenaHex: "#1a1a2e",
  arenaHexBorder: "#2a2a4e",
  corridorHex: "#16213e",
  corridorHexBorder: "#0f3460",
  player1: "#00D4FF",
  player2: "#FF4444",
  player1Dim: "#006688",
  player2Dim: "#882222",
  beamColor: "rgba(255, 255, 100, 0.6)",
  selectedGlow: "#00FF88",
  validMove: "rgba(0, 255, 136, 0.3)",
};

/** Convert a direction Pair to angle in radians (flat-top hex layout) */
export function directionToAngle(direction: Pair): number {
  return Math.atan2(
    Math.sqrt(3) * (direction.r + direction.q * 0.5),
    direction.q * 1.5,
  );
}

export interface Highlight {
  position: Pair;
  type: "selected" | "validMove";
}

export class BoardRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private hexSize: number;
  private padding: number;
  private colors: ColorScheme;
  private centerX: number = 0;
  private centerY: number = 0;
  private arenaRadius: number = 4;
  private animator: Animator | null = null;
  private cachedHexes: { pos: Pair; isCorridor: boolean }[] | null = null;

  constructor(canvas: HTMLCanvasElement, options?: RenderOptions) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get 2D context");
    this.ctx = ctx;

    this.hexSize = options?.hexSize ?? 30;
    this.padding = options?.padding ?? 50;
    this.colors = { ...DEFAULT_COLORS, ...options?.colors };
    this.animator = options?.animator ?? null;

    this.resize();
  }

  /** Set the animator instance */
  setAnimator(animator: Animator | null): void {
    this.animator = animator;
  }

  /** Resize canvas to fit container */
  resize(): void {
    const container = this.canvas.parentElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Set canvas size
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;

    // Reset transform and scale context for high DPI
    // Using setTransform prevents scale accumulation on multiple resize calls
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Calculate center
    this.centerX = rect.width / 2;
    this.centerY = rect.height / 2;

    // Calculate hex size to fit the arena
    const maxRadius = this.arenaRadius + 1; // Include corridor
    const gridWidth = this.hexSize * 1.5 * maxRadius * 2 + this.hexSize;
    const gridHeight =
      this.hexSize * Math.sqrt(3) * maxRadius * 2 + this.hexSize * Math.sqrt(3);

    const availableWidth = rect.width - this.padding * 2;
    const availableHeight = rect.height - this.padding * 2;

    const scale = Math.min(
      availableWidth / gridWidth,
      availableHeight / gridHeight,
    );
    this.hexSize = Math.max(10, this.hexSize * scale);
  }

  /** Convert axial coordinates to pixel coordinates */
  private hexToPixel(q: number, r: number): { x: number; y: number } {
    // Flat-top hex layout
    const x = this.hexSize * (3 / 2) * q;
    const y = this.hexSize * ((Math.sqrt(3) / 2) * q + Math.sqrt(3) * r);
    return {
      x: this.centerX + x,
      y: this.centerY + y,
    };
  }

  /** Convert pixel coordinates to hex position */
  pixelToHex(x: number, y: number): Pair | null {
    // Adjust for center offset
    const px = x - this.centerX;
    const py = y - this.centerY;

    // Flat-top hex conversion (inverse of hexToPixel)
    const q = ((2 / 3) * px) / this.hexSize;
    const r = ((-1 / 3) * px + (Math.sqrt(3) / 3) * py) / this.hexSize;

    // Round to nearest hex
    return this.hexRound(q, r);
  }

  /** Round fractional hex coordinates to nearest hex */
  private hexRound(q: number, r: number): Pair {
    const s = -q - r;

    let rq = Math.round(q);
    let rr = Math.round(r);
    let rs = Math.round(s);

    const qDiff = Math.abs(rq - q);
    const rDiff = Math.abs(rr - r);
    const sDiff = Math.abs(rs - s);

    if (qDiff > rDiff && qDiff > sDiff) {
      rq = -rr - rs;
    } else if (rDiff > sDiff) {
      rr = -rq - rs;
    }

    return { q: rq, r: rr };
  }

  /** Draw a single hexagon at pixel coordinates */
  private drawHex(
    x: number,
    y: number,
    fillColor: string,
    strokeColor: string,
  ): void {
    const ctx = this.ctx;
    ctx.beginPath();

    // Flat-top hex: first corner at 0°
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 180) * (60 * i);
      const hx = x + this.hexSize * Math.cos(angle);
      const hy = y + this.hexSize * Math.sin(angle);
      if (i === 0) {
        ctx.moveTo(hx, hy);
      } else {
        ctx.lineTo(hx, hy);
      }
    }
    ctx.closePath();

    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /** Draw a robot (circle with direction indicator) */
  private drawRobot(robot: Robot, isSelected: boolean, now: number): void {
    const ctx = this.ctx;
    const robotId = `${robot.position.q},${robot.position.r}`;

    // Check for animations
    let animatedPos: { x: number; y: number } | null = null;
    let animatedAngle: number | null = null;
    let scale = 1;
    let opacity = 1;

    if (this.animator) {
      // Check advance animation
      const advancePos = this.animator.getAdvancePosition(robotId, now);
      if (advancePos) {
        animatedPos = this.hexToPixel(advancePos.q, advancePos.r);
      }

      // Check turn animation
      animatedAngle = this.animator.getTurnAngle(robotId, now);

      // Check placement animation
      const placementProgress = this.animator.getPlacementProgress(
        robotId,
        now,
      );
      if (placementProgress) {
        scale = placementProgress.scale;
        opacity = placementProgress.opacity;
      }
    }

    // Use animated or static position
    const { x, y } =
      animatedPos || this.hexToPixel(robot.position.q, robot.position.r);

    // Select colors based on player and locked state
    let primaryColor: string;
    let dimColor: string;
    if (robot.player === 0) {
      primaryColor = this.colors.player1;
      dimColor = this.colors.player1Dim;
    } else {
      primaryColor = this.colors.player2;
      dimColor = this.colors.player2Dim;
    }

    const color = robot.isLockedDown ? dimColor : primaryColor;
    const baseRadius = this.hexSize * 0.5;
    const radius = baseRadius * scale;

    // Apply opacity
    ctx.globalAlpha = opacity;

    // Check for lock flash animation
    if (this.animator && robot.isLockedDown) {
      const flashIntensity = this.animator.getLockFlashIntensity(robotId, now);
      if (flashIntensity !== null && flashIntensity > 0) {
        // Draw flash ring
        ctx.beginPath();
        ctx.arc(x, y, radius + 8 * flashIntensity, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 100, ${flashIntensity})`;
        ctx.lineWidth = 4;
        ctx.stroke();
      }
    }

    // Draw selection glow
    if (isSelected) {
      ctx.beginPath();
      ctx.arc(x, y, radius + 5, 0, Math.PI * 2);
      ctx.strokeStyle = this.colors.selectedGlow;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Glow effect
      ctx.shadowColor = this.colors.selectedGlow;
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Draw robot body (circle)
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Add gradient effect
    const gradient = ctx.createRadialGradient(
      x - radius * 0.3,
      y - radius * 0.3,
      0,
      x,
      y,
      radius,
    );
    gradient.addColorStop(0, "rgba(255, 255, 255, 0.3)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.2)");
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw direction indicator (triangle arrow)
    const arrowLength = radius * 0.8;
    const arrowWidth = radius * 0.5;

    // Calculate arrow direction angle (use animated angle if available)
    const angle = animatedAngle ?? directionToAngle(robot.direction);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    ctx.beginPath();
    ctx.moveTo(radius * 0.3, 0); // Tip
    ctx.lineTo(-arrowLength * 0.5 + radius * 0.3, -arrowWidth / 2);
    ctx.lineTo(-arrowLength * 0.5 + radius * 0.3, arrowWidth / 2);
    ctx.closePath();
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();

    ctx.restore();

    // Draw lock icon if locked down
    if (robot.isLockedDown) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.font = `${this.hexSize * 0.4}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("X", x, y);
    }

    // Reset opacity
    ctx.globalAlpha = 1;
  }

  /** Draw beam line from robot in its facing direction */
  private drawBeam(robot: Robot, allRobots: Robot[], arenaRadius: number): void {
    const startPos = this.hexToPixel(robot.position.q, robot.position.r);
    const ctx = this.ctx;

    // Cast ray to find where beam stops (first robot or board edge)
    const stopPosition = this.findBeamStopPosition(robot, allRobots, arenaRadius);
    const endPixel = this.hexToPixel(stopPosition.q, stopPosition.r);

    // Determine beam color based on player
    const beamColor = robot.player === 0 ? "#00D4FF" : "#FF4444";

    ctx.beginPath();
    ctx.moveTo(startPos.x, startPos.y);
    ctx.lineTo(endPixel.x, endPixel.y);

    ctx.strokeStyle = beamColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Glow effect
    ctx.shadowColor = beamColor;
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Draw impact effect at stop position
    this.drawBeamImpact(endPixel.x, endPixel.y);
  }

  /** Find the position where the beam stops (first obstacle or boundary) */
  private findBeamStopPosition(
    sourceRobot: Robot,
    allRobots: Robot[],
    arenaRadius: number,
  ): Pair {
    const direction = sourceRobot.direction;
    const boundary = arenaRadius + 1; // Include corridor
    let currentPos = pairAdd(sourceRobot.position, direction);

    // Step through hexes along the beam direction
    while (pairDist(currentPos) <= boundary) {
      // Check if a robot is at this position (excluding the source robot)
      const robotAtPos = allRobots.find(
        (r) => pairEq(r.position, currentPos) && !pairEq(r.position, sourceRobot.position),
      );
      if (robotAtPos) {
        return currentPos;
      }
      // Move to next hex in direction
      currentPos = pairAdd(currentPos, direction);
    }

    // Beam stopped at boundary - return the last valid position
    return pairSub(currentPos, direction);
  }

  /** Draw impact effect at beam stop point */
  private drawBeamImpact(x: number, y: number): void {
    const ctx = this.ctx;
    const impactRadius = this.hexSize * 0.3;

    // Outer glow
    ctx.beginPath();
    ctx.arc(x, y, impactRadius * 1.5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 100, 0.3)";
    ctx.fill();

    // Inner bright core
    ctx.beginPath();
    ctx.arc(x, y, impactRadius * 0.7, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 200, 0.7)";
    ctx.fill();
  }

  /** Draw highlight on a hex */
  private drawHighlight(
    position: Pair,
    type: "selected" | "validMove",
    now: number,
  ): void {
    const { x, y } = this.hexToPixel(position.q, position.r);
    const ctx = this.ctx;

    // Get pulse value from animator
    const pulse = this.animator ? this.animator.getHighlightPulse(now) : 0.5;

    if (type === "selected") {
      // Draw glowing ring with pulse
      const radius = this.hexSize * (0.7 + pulse * 0.05);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = this.colors.selectedGlow;
      ctx.lineWidth = 3;
      ctx.shadowColor = this.colors.selectedGlow;
      ctx.shadowBlur = 10 + pulse * 5;
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else if (type === "validMove") {
      // Draw pulsing circle
      const radius = this.hexSize * (0.35 + pulse * 0.08);
      const alpha = 0.3 + pulse * 0.15;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 255, 136, ${alpha})`;
      ctx.fill();

      // Add subtle glow
      ctx.shadowColor = "rgba(0, 255, 136, 0.5)";
      ctx.shadowBlur = 5 + pulse * 5;
      ctx.beginPath();
      ctx.arc(x, y, radius * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 255, 136, ${alpha * 0.8})`;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  /** Get all hex positions within arena and corridor (cached) */
  private getAllHexPositions(
    state: GameState,
  ): { pos: Pair; isCorridor: boolean }[] {
    const arenaRadius = state.gameDef.board.hexaBoard.arenaRadius;

    // Return cached hexes if arena radius hasn't changed
    if (this.cachedHexes && this.arenaRadius === arenaRadius) {
      return this.cachedHexes;
    }

    this.arenaRadius = arenaRadius;
    const hexes: { pos: Pair; isCorridor: boolean }[] = [];
    const fullRadius = arenaRadius + 1; // Include corridor

    for (let q = -fullRadius; q <= fullRadius; q++) {
      for (let r = -fullRadius; r <= fullRadius; r++) {
        const dist = pairDist({ q, r });
        if (dist <= fullRadius) {
          hexes.push({
            pos: { q, r },
            isCorridor: dist === arenaRadius + 1,
          });
        }
      }
    }

    this.cachedHexes = hexes;
    return hexes;
  }

  /** Render the full board state */
  render(state: GameState, highlights: Highlight[] = []): void {
    const ctx = this.ctx;
    const rect = this.canvas.getBoundingClientRect();
    const now = performance.now();

    // Update animator
    if (this.animator) {
      this.animator.update(now);
    }

    // Clear canvas with background
    ctx.fillStyle = this.colors.background;
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Draw all hexes
    const hexes = this.getAllHexPositions(state);
    for (const { pos, isCorridor } of hexes) {
      const { x, y } = this.hexToPixel(pos.q, pos.r);
      if (isCorridor) {
        this.drawHex(
          x,
          y,
          this.colors.corridorHex,
          this.colors.corridorHexBorder,
        );
      } else {
        this.drawHex(x, y, this.colors.arenaHex, this.colors.arenaHexBorder);
      }
    }

    // Draw highlights (valid moves, etc.) with pulsing effect
    for (const highlight of highlights) {
      this.drawHighlight(highlight.position, highlight.type, now);
    }

    // Draw beams for robots with enabled beams
    for (const robot of state.robots) {
      if (robot.isBeamEnabled && !robot.isLockedDown) {
        this.drawBeam(robot, state.robots, state.gameDef.board.hexaBoard.arenaRadius);
      }
    }

    // Draw particles from destruction animations
    if (this.animator) {
      this.drawParticles();
    }

    // Draw robots with animations
    for (const robot of state.robots) {
      const isSelected = highlights.some(
        (h) => h.type === "selected" && pairEq(h.position, robot.position),
      );
      this.drawRobot(robot, isSelected, now);
    }
  }

  /** Draw all particles */
  private drawParticles(): void {
    if (!this.animator) return;

    const ctx = this.ctx;
    const particles = this.animator.getState().particles;

    for (const p of particles) {
      const alpha = p.life / p.maxLife;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fillStyle = p.color
        .replace(")", `, ${alpha})`)
        .replace("rgb", "rgba");
      ctx.fill();
    }
  }

  /** Expose hexToPixel for animator */
  public getPixelFromHex(q: number, r: number): { x: number; y: number } {
    return this.hexToPixel(q, r);
  }
}
