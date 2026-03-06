/**
 * Animation system for game visual effects
 */

import type { Pair } from '@lockitdown/engine';

export interface AnimationState {
  // Robot movement animations
  robotAdvances: Map<string, RobotAdvanceAnim>;
  robotTurns: Map<string, RobotTurnAnim>;
  robotPlacements: Map<string, RobotPlacementAnim>;

  // Effect animations
  lockFlashes: Map<string, LockFlashAnim>;
  destructions: DestructionAnim[];
  particles: Particle[];

  // UI animations
  highlightPulse: number;
}

export interface RobotAdvanceAnim {
  robotId: string;
  startPos: Pair;
  endPos: Pair;
  startTime: number;
  duration: number; // ms
}

export interface RobotTurnAnim {
  robotId: string;
  startAngle: number;
  endAngle: number;
  startTime: number;
  duration: number; // ms
}

export interface RobotPlacementAnim {
  robotId: string;
  position: Pair;
  startTime: number;
  duration: number; // ms
  scale: number;
  opacity: number;
}

export interface LockFlashAnim {
  robotId: string;
  startTime: number;
  duration: number;
  intensity: number;
}

export interface DestructionAnim {
  position: Pair;
  startTime: number;
  duration: number;
  opacity: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

// Animation timing constants
const ADVANCE_DURATION = 300; // ms
const TURN_DURATION = 200; // ms
const PLACEMENT_DURATION = 250; // ms
const LOCK_FLASH_DURATION = 400; // ms
const DESTRUCTION_DURATION = 500; // ms
const PARTICLE_LIFETIME = 600; // ms

export class Animator {
  private state: AnimationState;

  // Callbacks for when animations complete
  private onComplete: (() => void) | null = null;

  constructor() {
    this.state = this.createEmptyState();
  }

  private createEmptyState(): AnimationState {
    return {
      robotAdvances: new Map(),
      robotTurns: new Map(),
      robotPlacements: new Map(),
      lockFlashes: new Map(),
      destructions: [],
      particles: [],
      highlightPulse: 0,
    };
  }

  /** Get current animation state */
  getState(): AnimationState {
    return this.state;
  }

  /** Check if any animations are active */
  isAnimating(): boolean {
    return (
      this.state.robotAdvances.size > 0 ||
      this.state.robotTurns.size > 0 ||
      this.state.robotPlacements.size > 0 ||
      this.state.lockFlashes.size > 0 ||
      this.state.destructions.length > 0 ||
      this.state.particles.length > 0
    );
  }

  /** Set callback for when all animations complete */
  setOnComplete(callback: () => void): void {
    this.onComplete = callback;
  }

  /** Start robot advance animation */
  animateAdvance(robotId: string, startPos: Pair, endPos: Pair): void {
    this.state.robotAdvances.set(robotId, {
      robotId,
      startPos: { ...startPos },
      endPos: { ...endPos },
      startTime: performance.now(),
      duration: ADVANCE_DURATION,
    });
  }

  /** Start robot turn animation */
  animateTurn(robotId: string, startAngle: number, endAngle: number): void {
    this.state.robotTurns.set(robotId, {
      robotId,
      startAngle,
      endAngle,
      startTime: performance.now(),
      duration: TURN_DURATION,
    });
  }

  /** Start robot placement animation */
  animatePlacement(robotId: string, position: Pair): void {
    this.state.robotPlacements.set(robotId, {
      robotId,
      position: { ...position },
      startTime: performance.now(),
      duration: PLACEMENT_DURATION,
      scale: 0,
      opacity: 0,
    });
  }

  /** Start lock flash animation */
  animateLockFlash(robotId: string): void {
    this.state.lockFlashes.set(robotId, {
      robotId,
      startTime: performance.now(),
      duration: LOCK_FLASH_DURATION,
      intensity: 1,
    });
  }

  /** Start destruction animation with particle burst */
  animateDestruction(position: Pair, color: string, hexToPixel: (q: number, r: number) => { x: number; y: number }): void {
    const { x, y } = hexToPixel(position.q, position.r);

    // Create particle burst
    const particleCount = 12;
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.5;
      const speed = 2 + Math.random() * 3;
      this.state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: PARTICLE_LIFETIME,
        maxLife: PARTICLE_LIFETIME,
        color,
        size: 3 + Math.random() * 4,
      });
    }

    // Add destruction overlay
    this.state.destructions.push({
      position: { ...position },
      startTime: performance.now(),
      duration: DESTRUCTION_DURATION,
      opacity: 1,
    });
  }

  /** Get interpolated position for a robot advance */
  getAdvancePosition(robotId: string, now: number): Pair | null {
    const anim = this.state.robotAdvances.get(robotId);
    if (!anim) return null;

    const elapsed = now - anim.startTime;
    const progress = Math.min(1, elapsed / anim.duration);
    const eased = this.easeOutCubic(progress);

    return {
      q: anim.startPos.q + (anim.endPos.q - anim.startPos.q) * eased,
      r: anim.startPos.r + (anim.endPos.r - anim.startPos.r) * eased,
    };
  }

  /** Get interpolated angle for a robot turn */
  getTurnAngle(robotId: string, now: number): number | null {
    const anim = this.state.robotTurns.get(robotId);
    if (!anim) return null;

    const elapsed = now - anim.startTime;
    const progress = Math.min(1, elapsed / anim.duration);
    const eased = this.easeOutQuad(progress);

    return anim.startAngle + (anim.endAngle - anim.startAngle) * eased;
  }

  /** Get placement animation progress */
  getPlacementProgress(robotId: string, now: number): { scale: number; opacity: number } | null {
    const anim = this.state.robotPlacements.get(robotId);
    if (!anim) return null;

    const elapsed = now - anim.startTime;
    const progress = Math.min(1, elapsed / anim.duration);
    const eased = this.easeOutBack(progress);

    return {
      scale: eased,
      opacity: eased,
    };
  }

  /** Get lock flash intensity */
  getLockFlashIntensity(robotId: string, now: number): number | null {
    const anim = this.state.lockFlashes.get(robotId);
    if (!anim) return null;

    const elapsed = now - anim.startTime;
    const progress = elapsed / anim.duration;

    if (progress >= 1) return null;

    // Flash pattern: quick burst then fade
    if (progress < 0.2) {
      return progress / 0.2; // Rise
    } else {
      return 1 - (progress - 0.2) / 0.8; // Fall
    }
  }

  /** Get highlight pulse phase (0-1) */
  getHighlightPulse(now: number): number {
    return (Math.sin(now / 300) + 1) / 2; // 0 to 1, ~600ms cycle
  }

  /** Update all animations */
  update(now: number): void {
    // Update highlight pulse
    this.state.highlightPulse = this.getHighlightPulse(now);

    // Clean up completed animations
    this.cleanupCompleted(now);

    // Update particles
    this.updateParticles();

    // Check if all animations complete
    if (!this.isAnimating() && this.onComplete) {
      this.onComplete();
      this.onComplete = null;
    }
  }

  /** Remove completed animations */
  private cleanupCompleted(now: number): void {
    // Clean advances
    for (const [id, anim] of this.state.robotAdvances) {
      if (now - anim.startTime >= anim.duration) {
        this.state.robotAdvances.delete(id);
      }
    }

    // Clean turns
    for (const [id, anim] of this.state.robotTurns) {
      if (now - anim.startTime >= anim.duration) {
        this.state.robotTurns.delete(id);
      }
    }

    // Clean placements
    for (const [id, anim] of this.state.robotPlacements) {
      if (now - anim.startTime >= anim.duration) {
        this.state.robotPlacements.delete(id);
      }
    }

    // Clean lock flashes
    for (const [id, anim] of this.state.lockFlashes) {
      if (now - anim.startTime >= anim.duration) {
        this.state.lockFlashes.delete(id);
      }
    }

    // Clean destructions
    this.state.destructions = this.state.destructions.filter(
      (d) => now - d.startTime < d.duration
    );
  }

  /** Update particle positions and lifetimes */
  private updateParticles(): void {
    this.state.particles = this.state.particles.filter((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1; // Gravity
      p.life -= 16; // ~60fps
      return p.life > 0;
    });
  }

  /** Clear all animations */
  reset(): void {
    this.state = this.createEmptyState();
  }

  // Easing functions
  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  private easeOutQuad(t: number): number {
    return 1 - (1 - t) * (1 - t);
  }

  private easeOutBack(t: number): number {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }
}

// Singleton instance
export const animator = new Animator();
