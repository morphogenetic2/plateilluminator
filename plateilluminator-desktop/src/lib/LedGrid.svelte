<script>
    import {
        NUM_LEDS,
        selectedLedIndices,
        currentlyViewedLedIndex,
        selectLed,
        simIntensities,
    } from "../store.js";
    import { onMount } from "svelte";

    // Local state for drag select
    let dragBox = { startX: 0, startY: 0, x: 0, y: 0, active: false };
    let gridEl;
    let buttons = [];

    function handlePointerDown(e) {
        if (e.target.closest(".led-btn")) return; // Let button handle it

        const rect = gridEl.getBoundingClientRect();
        dragBox.startX = e.clientX - rect.left;
        dragBox.startY = e.clientY - rect.top;
        dragBox.active = true;
        dragBox.x = dragBox.startX;
        dragBox.y = dragBox.startY;
    }

    function handlePointerMove(e) {
        if (!dragBox.active) return;
        const rect = gridEl.getBoundingClientRect();
        dragBox.x = e.clientX - rect.left;
        dragBox.y = e.clientY - rect.top;

        // Update selection based on box
        const boxRect = {
            left: Math.min(dragBox.startX, dragBox.x),
            top: Math.min(dragBox.startY, dragBox.y),
            right: Math.max(dragBox.startX, dragBox.x),
            bottom: Math.max(dragBox.startY, dragBox.y),
        };

        const newFocus = new Set($selectedLedIndices);
        buttons.forEach((btn, i) => {
            if (!btn) return;
            const bRect = btn.getBoundingClientRect();
            const gRect = gridEl.getBoundingClientRect();
            const relativeRect = {
                left: bRect.left - gRect.left,
                top: bRect.top - gRect.top,
                right: bRect.right - gRect.left,
                bottom: bRect.bottom - gRect.top,
            };

            const intersects = !(
                relativeRect.left > boxRect.right ||
                relativeRect.right < boxRect.left ||
                relativeRect.top > boxRect.bottom ||
                relativeRect.bottom < boxRect.top
            );

            if (intersects) newFocus.add(i);
        });
        selectedLedIndices.set(newFocus);
    }

    function handlePointerUp() {
        dragBox.active = false;
    }

    function toggleAll() {
        selectedLedIndices.update((set) => {
            if (set.size === NUM_LEDS) set.clear();
            else for (let i = 0; i < NUM_LEDS; i++) set.add(i);
            return set;
        });
    }
</script>

<div class="panel-title">
    <span>Selection</span>
    <i class="fas fa-th" aria-hidden="true"></i>
</div>

{#if $selectedLedIndices.size > 1}
    <div class="batch-banner">
        <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
        <span>Batch: <strong>{$selectedLedIndices.size}</strong></span>
    </div>
{/if}

<div
    class="led-grid-container"
    bind:this={gridEl}
    role="grid"
    tabindex="0"
    aria-label="LED selection grid"
    on:pointerdown={handlePointerDown}
    on:pointermove={handlePointerMove}
    on:pointerup={handlePointerUp}
>
    <div class="led-grid" role="row">
        {#each Array(NUM_LEDS) as _, i}
            <button
                bind:this={buttons[i]}
                class="led-btn"
                class:selected={$selectedLedIndices.has(i)}
                class:viewing={$currentlyViewedLedIndex === i}
                style={$simIntensities[i] > 0
                    ? `background: hsl(245, 50%, ${10 + Math.min(1, $simIntensities[i] / 1400) * 50}%); box-shadow: 0 0 ${10 + Math.min(1, $simIntensities[i] / 1400) * 20}px rgba(99, 102, 241, 0.8);`
                    : ""}
                on:click={(e) => selectLed(i, e.ctrlKey || e.metaKey)}
                aria-label={`LED ${i + 1}`}
                aria-pressed={$selectedLedIndices.has(i)}
            >
                {i + 1}
            </button>
        {/each}
    </div>

    {#if dragBox.active}
        <div
            class="drag-select-box"
            style="
      display: block;
      left: {Math.min(dragBox.startX, dragBox.x)}px;
      top: {Math.min(dragBox.startY, dragBox.y)}px;
      width: {Math.abs(dragBox.x - dragBox.startX)}px;
      height: {Math.abs(dragBox.y - dragBox.startY)}px;
    "
        ></div>
    {/if}
</div>

<div class="led-actions">
    <button class="segment-btn" on:click={toggleAll}>All / None</button>
    <button
        class="segment-btn"
        on:click={() => selectedLedIndices.set(new Set())}>Clear</button
    >
</div>
