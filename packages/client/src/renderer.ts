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
  lastMoveHighlight: string;
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
  lastMoveHighlight: "rgba(255, 200, 0, 0.35)",
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
  type: "selected" | "validMove" | "lastMove";
}

interface Star {
  x: number;
  y: number;
  size: number;
  brightness: number;
  twinkleSpeed: number;
  twinkleOffset: number;
  layer: number; // 0 = distant (slow), 1 = near (faster twinkle)
}

interface NebulaPatch {
  x: number;
  y: number;
  radius: number;
  color: string;
  opacity: number;
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

  // Space background
  private stars: Star[] = [];
  private nebulaPatches: NebulaPatch[] = [];
  private backgroundCanvas: HTMLCanvasElement | null = null;
  private backgroundCtx: CanvasRenderingContext2D | null = null;

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
    this.initSpaceBackground();
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

    // Reinitialize space background on resize
    this.initSpaceBackground();
  }

  /** Initialize the space background with stars and nebula */
  private initSpaceBackground(): void {
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Create offscreen canvas for static background
    this.backgroundCanvas = document.createElement("canvas");
    this.backgroundCanvas.width = width;
    this.backgroundCanvas.height = height;
    this.backgroundCtx = this.backgroundCanvas.getContext("2d");

    if (!this.backgroundCtx) return;

    // Draw static background gradient and nebula
    this.drawStaticBackground(width, height);

    // Generate stars for twinkling animation
    this.generateStars(width, height);
  }

  /** Draw static background: gradient + nebula patches */
  private drawStaticBackground(width: number, height: number): void {
    if (!this.backgroundCtx) return;
    const ctx = this.backgroundCtx;

    // Deep space gradient
    const gradient = ctx.createRadialGradient(
      width / 2, height / 2, 0,
      width / 2, height / 2, Math.max(width, height) * 0.7
    );
    gradient.addColorStop(0, "#0d0d1a");
    gradient.addColorStop(0.5, "#0a0a14");
    gradient.addColorStop(1, "#050508");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Generate and draw subtle nebula patches
    this.nebulaPatches = [];
    const nebulaColors = [
      "rgba(0, 100, 150, 0.03)",   // Deep blue
      "rgba(80, 40, 120, 0.025)",  // Purple
      "rgba(0, 80, 100, 0.02)",    // Teal
      "rgba(60, 20, 80, 0.02)",    // Magenta hint
    ];

    // Create 4-6 nebula patches
    const numPatches = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numPatches; i++) {
      const patch: NebulaPatch = {
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.min(width, height) * (0.3 + Math.random() * 0.4),
        color: nebulaColors[i % nebulaColors.length],
        opacity: 0.5 + Math.random() * 0.5,
      };
      this.nebulaPatches.push(patch);

      // Draw nebula patch
      const nebulaGradient = ctx.createRadialGradient(
        patch.x, patch.y, 0,
        patch.x, patch.y, patch.radius
      );
      nebulaGradient.addColorStop(0, patch.color);
      nebulaGradient.addColorStop(0.5, patch.color.replace(/[\d.]+\)$/, "0.01)"));
      nebulaGradient.addColorStop(1, "transparent");

      ctx.fillStyle = nebulaGradient;
      ctx.fillRect(0, 0, width, height);
    }
  }

  /** Generate stars with different layers for parallax effect */
  private generateStars(width: number, height: number): void {
    this.stars = [];

    // Distant stars (more numerous, smaller, slower twinkle)
    const distantCount = Math.floor((width * height) / 3000);
    for (let i = 0; i < distantCount; i++) {
      this.stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: 0.5 + Math.random() * 0.8,
        brightness: 0.2 + Math.random() * 0.4,
        twinkleSpeed: 0.0005 + Math.random() * 0.001,
        twinkleOffset: Math.random() * Math.PI * 2,
        layer: 0,
      });
    }

    // Near stars (fewer, larger, faster twinkle)
    const nearCount = Math.floor((width * height) / 8000);
    for (let i = 0; i < nearCount; i++) {
      this.stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: 1 + Math.random() * 1.5,
        brightness: 0.5 + Math.random() * 0.5,
        twinkleSpeed: 0.002 + Math.random() * 0.003,
        twinkleOffset: Math.random() * Math.PI * 2,
        layer: 1,
      });
    }
  }

  /** Draw animated space background */
  private drawSpaceBackground(now: number): void {
    const rect = this.canvas.getBoundingClientRect();
    const ctx = this.ctx;

    // Draw cached static background
    if (this.backgroundCanvas) {
      ctx.drawImage(this.backgroundCanvas, 0, 0);
    } else {
      // Fallback solid color
      ctx.fillStyle = this.colors.background;
      ctx.fillRect(0, 0, rect.width, rect.height);
    }

    // Draw twinkling stars
    for (const star of this.stars) {
      // Calculate twinkle factor using sine wave
      const twinkle = Math.sin(now * star.twinkleSpeed + star.twinkleOffset);
      const brightness = star.brightness * (0.6 + twinkle * 0.4);

      // Draw star
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);

      // Use color based on brightness for subtle color variation
      const alpha = brightness;
      if (star.layer === 1 && brightness > 0.7) {
        // Bright near stars get a slight blue-white tint
        ctx.fillStyle = `rgba(200, 220, 255, ${alpha})`;
      } else {
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      }
      ctx.fill();

      // Add subtle glow to bright near stars
      if (star.layer === 1 && brightness > 0.6) {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size * 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 220, 255, ${alpha * 0.15})`;
        ctx.fill();
      }
    }
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

  /** Helper to desaturate a color for locked-down state */
  private desaturateColor(color: string): string {
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

  /** Draw a robot as a sleek dart fighter ship */
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

    // Select colors based on player
    let primaryColor: string;
    if (robot.player === 0) {
      primaryColor = this.colors.player1;
    } else {
      primaryColor = this.colors.player2;
    }

    // Desaturate color if locked down
    const color = robot.isLockedDown ? this.desaturateColor(primaryColor) : primaryColor;
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

    // Calculate direction angle (use animated angle if available)
    const angle = animatedAngle ?? directionToAngle(robot.direction);

    // Draw the dart fighter ship
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Engine glow (back of ship) - only when not locked down
    if (!robot.isLockedDown) {
      const glowGradient = ctx.createRadialGradient(
        -radius * 0.5, 0, 0,
        -radius * 0.5, 0, radius * 0.35
      );
      // Create gradient stops using rgba format
      const r = parseInt(primaryColor.slice(1, 3), 16);
      const g = parseInt(primaryColor.slice(3, 5), 16);
      const b = parseInt(primaryColor.slice(5, 7), 16);
      glowGradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`);
      glowGradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.5)`);
      glowGradient.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.beginPath();
      ctx.arc(-radius * 0.5, 0, radius * 0.35, 0, Math.PI * 2);
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

    ctx.fillStyle = color;
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
    type: "selected" | "validMove" | "lastMove",
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
    } else if (type === "lastMove") {
      // Draw yellow highlight for opponent's last move
      const radius = this.hexSize * 0.85;

      // Semi-transparent yellow fill
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = this.colors.lastMoveHighlight;
      ctx.fill();

      // Add subtle pulsing border
      ctx.strokeStyle = `rgba(255, 200, 0, ${0.5 + pulse * 0.1})`;
      ctx.lineWidth = 2;
      ctx.stroke();
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
    const now = performance.now();

    // Update animator
    if (this.animator) {
      this.animator.update(now);
    }

    // Draw space background with twinkling stars
    this.drawSpaceBackground(now);

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
