<script lang="ts">
  import type { Pair } from '@lockitdown/engine';
  import { pairKey } from '@lockitdown/engine';

  export let selectedPosition: Pair | null = null;
  export let isMyTurn: boolean = false;
  export let canAdvance: boolean = false;
  export let onTurnLeft: () => void = () => {};
  export let onTurnRight: () => void = () => {};
  export let onAdvance: () => void = () => {};
  export let onCancel: () => void = () => {};

  $: isVisible = isMyTurn;
</script>

<div class="turn-controls" class:hidden={!isVisible}">
  <button
    class="action-btn"
    title="Turn Left"
    on:click={onTurnLeft}
    disabled={!selectedPosition}
  >
    <span>↶ Turn L</span>
  </button>

  <button
    class="action-btn primary"
    title="Advance"
    on:click={onAdvance}
    disabled={!canAdvance}
  >
    <span>↑ Advance</span>
  </button>

  <button
    class="action-btn"
    title="Turn Right"
    on:click={onTurnRight}
    disabled={!selectedPosition}
  >
    <span>↷ Turn R</span>
  </button>

  {#if selectedPosition}
    <button
      class="action-btn danger"
      title="Cancel"
      on:click={onCancel}
    >
      <span>Cancel</span>
    </button>
  {/if}
</div>

<style>
  .turn-controls {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 12px;
    background: rgba(0, 0, 0, 0.8);
    border-radius: 8px;
    transition: opacity 0.3s ease;
  }

  .turn-controls.hidden {
    opacity: 0.3;
    pointer-events: none;
  }

  .turn-controls button {
    padding: 8px 16px;
    border-radius: 4px;
    font-weight: 500;
  }

  .turn-controls button:disabled {
    opacity: 0.5;
  }

  .turn-controls button.primary {
    background: #00d4ff;
    color: white;
  }

  .turn-controls button.danger {
    background: #ff4444;
    color: white;
  }
</style>
