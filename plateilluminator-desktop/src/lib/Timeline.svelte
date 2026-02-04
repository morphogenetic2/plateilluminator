<script>
    import {
        viewedBlocks,
        currentlyViewedLedIndex,
        currentBlockIndex,
        programData,
    } from "../store.js";

    function getStepClass(type) {
        if (type === "ON") return "type-on";
        if (type === "OFF") return "type-off";
        if (type === "RAMP") return "type-ramp";
        if (type === "SINE") return "type-sine";
        return "";
    }

    function deleteStep(blockIdx, stepIdx) {
        programData.update((data) => {
            const ledKey = `LED${$currentlyViewedLedIndex}`;
            data[ledKey].blocks[blockIdx].steps.splice(stepIdx, 1);
            return data;
        });
    }

    function selectBlock(idx) {
        currentBlockIndex.set(idx);
    }

    function deleteBlock(idx) {
        if (!confirm("Remove this block from the current LED?")) return;
        programData.update((data) => {
            const ledKey = `LED${$currentlyViewedLedIndex}`;
            data[ledKey].blocks.splice(idx, 1);
            return data;
        });
        if ($currentBlockIndex >= idx && $currentBlockIndex > 0) {
            currentBlockIndex.set($currentBlockIndex - 1);
        }
    }

    function handleKey(e, idx) {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            selectBlock(idx);
        }
    }
</script>

<div class="panel">
    <div class="panel-title">
        <span
            >Timeline <span style="color: var(--primary);"
                >(LED {$currentlyViewedLedIndex + 1})</span
            ></span
        >
        <i class="fas fa-stream" aria-hidden="true"></i>
    </div>

    <div class="timeline-strip">
        {#each $viewedBlocks as block, bIdx}
            <div
                role="button"
                tabindex="0"
                class="block-group"
                class:active={$currentBlockIndex === bIdx}
                onclick={() => selectBlock(bIdx)}
                onkeydown={(e) => handleKey(e, bIdx)}
                aria-label={`Select ${block.id || `Block ${bIdx + 1}`}`}
            >
                <div class="block-label">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span>{block.id || `B${bIdx + 1}`}</span>
                        <button
                            type="button"
                            class="delete-block-btn"
                            onclick={(e) => {
                                e.stopPropagation();
                                deleteBlock(bIdx);
                            }}
                            aria-label={`Delete ${block.id || `Block ${bIdx + 1}`}`}
                            style="opacity: 1; color: var(--accent-danger); cursor: pointer;"
                        >
                            <i class="fas fa-times" aria-hidden="true"></i>
                        </button>
                    </div>
                    {#if block.repeat_continuous}
                        <i class="fas fa-infinity" aria-hidden="true"></i>
                    {:else if block.repeat_count}
                        <span>{block.repeat_count}x</span>
                    {:else if block.repeat_duration_minutes}
                        <span>{block.repeat_duration_minutes}m</span>
                    {/if}
                </div>
                <div class="block-steps">
                    {#each block.steps || [] as step, sIdx}
                        <div class={`step-pill ${getStepClass(step.type)}`}>
                            {step.type} ({(
                                step.duration_s || step.duration_ms / 1000
                            ).toFixed(1)}s)
                            <button
                                type="button"
                                class="delete-step"
                                onclick={(e) => {
                                    e.stopPropagation();
                                    deleteStep(bIdx, sIdx);
                                }}
                                aria-label={`Delete ${step.type} step`}
                            >
                                <i class="fas fa-times" aria-hidden="true"></i>
                            </button>
                        </div>
                    {/each}
                    {#if !block.steps || block.steps.length === 0}
                        <span
                            style="font-size: 0.65rem; color: var(--text-muted); opacity: 0.5;"
                            >Empty</span
                        >
                    {/if}
                </div>
            </div>
        {:else}
            <span class="timeline-empty">No blocks defined for this LED</span>
        {/each}
    </div>
</div>
