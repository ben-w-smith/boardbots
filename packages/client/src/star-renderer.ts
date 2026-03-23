/**
 * StarRenderer - Independent star/nebula background renderer
 *
 * Renders a twinkling star field with nebula patches on its own canvas.
 * Runs an independent animation loop, decoupled from game rendering.
 */

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

export class StarRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private stars: Star[] = [];
  private nebulaPatches: NebulaPatch[] = [];
  private backgroundCanvas: HTMLCanvasElement | null = null;
  private backgroundCtx: CanvasRenderingContext2D | null = null;
  private animationFrameId: number | null = null;
  private isVisible: boolean = true;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get 2D context for star canvas");
    this.ctx = ctx;

    this.resize();
  }

  /** Resize canvas to fit container and regenerate stars */
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

    // Scale context for high DPI
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Reinitialize background
    this.initBackground(rect.width, rect.height);
  }

  /** Initialize the space background with stars and nebula */
  private initBackground(width: number, height: number): void {
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

  /** Render one frame of the star background */
  private render(now: number): void {
    const rect = this.canvas.getBoundingClientRect();
    const ctx = this.ctx;

    // Draw cached static background
    if (this.backgroundCanvas) {
      ctx.drawImage(this.backgroundCanvas, 0, 0);
    } else {
      // Fallback solid color
      ctx.fillStyle = "#0a0a0f";
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

  /** Animation loop */
  private animate = (now: number): void => {
    if (!this.isVisible) return;

    this.render(now);
    this.animationFrameId = requestAnimationFrame(this.animate);
  };

  /** Start the animation loop */
  start(): void {
    if (this.animationFrameId !== null) return; // Already running

    this.isVisible = true;
    this.animationFrameId = requestAnimationFrame(this.animate);
  }

  /** Stop the animation loop */
  stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /** Show the canvas */
  show(): void {
    this.canvas.style.display = "block";
    this.isVisible = true;
  }

  /** Hide the canvas */
  hide(): void {
    this.stop();
    this.canvas.style.display = "none";
    this.isVisible = false;
  }

  /** Check if animation is running */
  isRunning(): boolean {
    return this.animationFrameId !== null;
  }
}
