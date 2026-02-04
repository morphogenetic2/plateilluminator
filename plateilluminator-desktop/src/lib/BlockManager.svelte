<script>
    import {
        viewedBlocks,
        currentBlockIndex,
        addBlock,
        programData,
        selectedLedIndices,
    } from "../store.js";

    function removeBlock() {
        if (!confirm("Remove this block from all selected LEDs?")) return;
        const idxToRemove = $currentBlockIndex;
        programData.update((data) => {
            $selectedLedIndices.forEach((idx) => {
                const ledKey = `LED${idx}`;
                if (data[ledKey].blocks) {
                    data[ledKey].blocks.splice(idxToRemove, 1);
                }
            });
            return data;
        });
        if ($currentBlockIndex > 0)
            currentBlockIndex.set($currentBlockIndex - 1);
    }

    function setRepeatMode(mode) {
        programData.update((data) => {
            $selectedLedIndices.forEach((idx) => {
                const block = data[`LED${idx}`].blocks[$currentBlockIndex];
                if (block) {
                    block.repeat_continuous = mode === "continuous";
                    block.repeat_once = mode === "once";
                    if (mode === "count")
                        block.repeat_count = block.repeat_count || 1;
                    else block.repeat_count = null;
                    if (mode === "duration")
                        block.repeat_duration_minutes =
                            block.repeat_duration_minutes || 1;
                    else block.repeat_duration_minutes = null;
                }
            });
            return data;
        });
    }

    $: currentBlock = $viewedBlocks[$currentBlockIndex] || {};
</script>

<div
    class="editor-column"
    style="border-left: 1px solid var(--border-subtle); padding-left: 2rem;"
>
    <div class="panel-title">
        <span>Block Manager</span>
        <i class="fas fa-layer-group"></i>
    </div>

    <div class="control-group">
        <select bind:value={$currentBlockIndex} style="flex:1;">
            {#each $viewedBlocks as block, i}
                <option value={i}>{block.id || `Block ${i + 1}`}</option>
            {/each}
            {#if $viewedBlocks.length === 0}
                <option disabled>No blocks</option>
            {/if}
        </select>
        <button class="btn-icon success" on:click={addBlock} title="New Block">
            <i class="fas fa-plus"></i></button
        >
        <button
            class="btn-icon danger"
            on:click={removeBlock}
            title="Delete Block"
        >
            <i class="fas fa-trash"></i></button
        >
    </div>

    <div class="control-group">
        <span class="label-text">Name</span>
        <input
            type="text"
            bind:value={currentBlock.id}
            placeholder="Block Name"
            style="flex:1;"
        />
    </div>

    <div class="control-group">
        <span class="label-text">Repeat</span>
        <div class="segmented-control" style="flex:1;">
            <button
                class="segment-btn"
                class:is-selected={currentBlock.repeat_continuous}
                on:click={() => setRepeatMode("continuous")}>Cont.</button
            >
            <button
                class="segment-btn"
                class:is-selected={currentBlock.repeat_once}
                on:click={() => setRepeatMode("once")}>Once</button
            >
            <button
                class="segment-btn"
                class:is-selected={currentBlock.repeat_count !== null}
                on:click={() => setRepeatMode("count")}>Count</button
            >
            <button
                class="segment-btn"
                class:is-selected={currentBlock.repeat_duration_minutes !==
                    null}
                on:click={() => setRepeatMode("duration")}>Dur.</button
            >
        </div>
    </div>

    {#if currentBlock.repeat_count !== null}
        <div class="control-group">
            <span class="label-text">Count</span>
            <input
                type="number"
                bind:value={currentBlock.repeat_count}
                class="compact-input"
                min="1"
            />
            <span class="input-suffix">times</span>
        </div>
    {/if}

    {#if currentBlock.repeat_duration_minutes !== null}
        <div class="control-group">
            <span class="label-text">For</span>
            <input
                type="number"
                bind:value={currentBlock.repeat_duration_minutes}
                class="compact-input"
                min="0.1"
                step="0.1"
            />
            <span class="input-suffix">min</span>
        </div>
    {/if}
</div>
