import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Animator } from '../animator.js';

describe('Animator', () => {
  let animator: Animator;

  beforeEach(() => {
    animator = new Animator();
  });

  describe('initial state', () => {
    it('starts with no animations', () => {
      expect(animator.isAnimating()).toBe(false);
    });

    it('has empty animation state', () => {
      const state = animator.getState();
      expect(state.robotAdvances.size).toBe(0);
      expect(state.robotTurns.size).toBe(0);
      expect(state.robotPlacements.size).toBe(0);
      expect(state.lockFlashes.size).toBe(0);
      expect(state.destructions.length).toBe(0);
      expect(state.particles.length).toBe(0);
    });
  });

  describe('advance animation', () => {
    it('starts advance animation', () => {
      animator.animateAdvance('1,0', { q: 1, r: 0 }, { q: 2, r: 0 });
      expect(animator.isAnimating()).toBe(true);
    });

    it('stores advance animation data', () => {
      animator.animateAdvance('1,0', { q: 1, r: 0 }, { q: 2, r: 0 });
      const state = animator.getState();
      expect(state.robotAdvances.has('1,0')).toBe(true);
    });

    it('returns interpolated position during animation', () => {
      animator.animateAdvance('1,0', { q: 1, r: 0 }, { q: 2, r: 0 });
      const now = performance.now();
      const pos = animator.getAdvancePosition('1,0', now);
      expect(pos).not.toBeNull();
    });

    it('returns null for non-existent animation', () => {
      const pos = animator.getAdvancePosition('nonexistent', performance.now());
      expect(pos).toBeNull();
    });
  });

  describe('turn animation', () => {
    it('starts turn animation', () => {
      animator.animateTurn('1,0', 0, Math.PI / 3);
      expect(animator.isAnimating()).toBe(true);
    });

    it('returns interpolated angle during animation', () => {
      animator.animateTurn('1,0', 0, Math.PI / 3);
      const now = performance.now();
      const angle = animator.getTurnAngle('1,0', now);
      expect(angle).not.toBeNull();
    });

    it('returns null for non-existent turn animation', () => {
      const angle = animator.getTurnAngle('nonexistent', performance.now());
      expect(angle).toBeNull();
    });
  });

  describe('placement animation', () => {
    it('starts placement animation', () => {
      animator.animatePlacement('1,0', { q: 1, r: 0 });
      expect(animator.isAnimating()).toBe(true);
    });

    it('returns progress during animation', () => {
      animator.animatePlacement('1,0', { q: 1, r: 0 });
      const now = performance.now();
      const progress = animator.getPlacementProgress('1,0', now);
      expect(progress).not.toBeNull();
      expect(progress?.scale).toBeGreaterThanOrEqual(0);
      expect(progress?.opacity).toBeGreaterThanOrEqual(0);
    });
  });

  describe('lock flash animation', () => {
    it('starts lock flash animation', () => {
      animator.animateLockFlash('1,0');
      expect(animator.isAnimating()).toBe(true);
    });

    it('returns intensity during flash', () => {
      animator.animateLockFlash('1,0');
      const now = performance.now();
      const intensity = animator.getLockFlashIntensity('1,0', now);
      expect(intensity).not.toBeNull();
      expect(intensity).toBeGreaterThanOrEqual(0);
      expect(intensity).toBeLessThanOrEqual(1);
    });
  });

  describe('destruction animation', () => {
    const mockHexToPixel = (q: number, r: number) => ({ x: q * 30, y: r * 30 });

    it('creates destruction animation with particles', () => {
      animator.animateDestruction({ q: 1, r: 0 }, 'rgb(0, 212, 255)', mockHexToPixel);
      expect(animator.isAnimating()).toBe(true);

      const state = animator.getState();
      expect(state.particles.length).toBeGreaterThan(0);
      expect(state.destructions.length).toBe(1);
    });

    it('creates multiple particles for burst effect', () => {
      animator.animateDestruction({ q: 0, r: 0 }, 'rgb(255, 68, 68)', mockHexToPixel);
      const state = animator.getState();
      expect(state.particles.length).toBe(12); // particleCount in animator
    });
  });

  describe('highlight pulse', () => {
    it('returns pulse value between 0 and 1', () => {
      const pulse = animator.getHighlightPulse(performance.now());
      expect(pulse).toBeGreaterThanOrEqual(0);
      expect(pulse).toBeLessThanOrEqual(1);
    });

    it('pulse oscillates over time', () => {
      const pulse1 = animator.getHighlightPulse(0);
      const pulse2 = animator.getHighlightPulse(150); // Quarter cycle
      const pulse3 = animator.getHighlightPulse(300); // Half cycle

      // Values should vary
      const values = [pulse1, pulse2, pulse3].filter(v => v !== undefined);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBeGreaterThan(1);
    });
  });

  describe('update', () => {
    it('updates without errors', () => {
      animator.update(performance.now());
      expect(animator.isAnimating()).toBe(false);
    });

    it('cleans up completed animations', async () => {
      animator.animateAdvance('1,0', { q: 1, r: 0 }, { q: 2, r: 0 });

      // Wait for animation to complete (300ms duration)
      await new Promise(resolve => setTimeout(resolve, 350));

      animator.update(performance.now());
      expect(animator.getState().robotAdvances.size).toBe(0);
    });
  });

  describe('reset', () => {
    it('clears all animations', () => {
      animator.animateAdvance('1,0', { q: 1, r: 0 }, { q: 2, r: 0 });
      animator.animateTurn('1,0', 0, Math.PI / 3);
      animator.animatePlacement('1,0', { q: 1, r: 0 });

      animator.reset();

      expect(animator.isAnimating()).toBe(false);
      expect(animator.getState().robotAdvances.size).toBe(0);
      expect(animator.getState().robotTurns.size).toBe(0);
      expect(animator.getState().robotPlacements.size).toBe(0);
    });
  });

  describe('onComplete callback', () => {
    it('calls onComplete when animations finish', async () => {
      const onComplete = vi.fn();
      animator.setOnComplete(onComplete);

      animator.animateAdvance('1,0', { q: 1, r: 0 }, { q: 2, r: 0 });

      // Wait for animation to complete
      await new Promise(resolve => setTimeout(resolve, 350));

      animator.update(performance.now());

      expect(onComplete).toHaveBeenCalled();
    });
  });
});
