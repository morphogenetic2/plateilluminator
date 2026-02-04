<script>
    import {
        currentStepType,
        programData,
        selectedLedIndices,
        currentBlockIndex,
    } from "../store.js";

    let stepParams = {
        duration_ms: 1000,
        int: 1000,
        int0: 0,
        int1: 1000,
        freq: 1,
    };

    const types = [
        { id: "ON", icon: "fas fa-lightbulb" },
        { id: "OFF", icon: "fas fa-power-off" },
        { id: "RAMP", icon: "fas fa-chart-line" },
        { id: "SINE", icon: "fas fa-wave-square" },
    ];

    function addStep() {
        if ($selectedLedIndices.size === 0) return alert("Select LEDs first");

        const newStep = {
            type: $currentStepType,
            duration_ms: stepParams.duration_ms,
        };
        if ($currentStepType === "ON") newStep.int = stepParams.int;
        if ($currentStepType === "RAMP") {
            newStep.int0 = stepParams.int0;
            newStep.int1 = stepParams.int1;
        }
        if ($currentStepType === "SINE") {
            newStep.int0 = stepParams.int0;
            newStep.int1 = stepParams.int1;
            newStep.freq = stepParams.freq;
        }

        programData.update((data) => {
            $selectedLedIndices.forEach((idx) => {
                const ledKey = `LED${idx}`;
                const block = data[ledKey].blocks[$currentBlockIndex];
                if (block) {
                    if (!block.steps) block.steps = [];
                    block.steps.push({ ...newStep });
                }
            });
            return data;
        });
    }
</script>

<div class="editor-column">
    <div class="panel-title">
        <span>Step Editor</span>
        <i class="fas fa-sliders-h"></i>
    </div>

    <div class="control-group">
        <span class="label-text">Type</span>
        <div class="segmented-control">
            {#each types as t}
                <button
                    class="segment-btn"
                    class:is-selected={$currentStepType === t.id}
                    onclick={() => currentStepType.set(t.id)}
                >
                    <i class={t.icon}></i>
                    {t.id}
                </button>
            {/each}
        </div>
    </div>

    <div class="control-group">
        <span class="label-text">Duration</span>
        <input
            type="number"
            bind:value={stepParams.duration_ms}
            class="compact-input"
            min="50"
        />
        <span class="input-suffix">ms</span>
    </div>

    {#if $currentStepType === "ON"}
        <div class="params-zone active">
            <div class="control-group">
                <span class="label-text">Intensity</span>
                <input
                    type="number"
                    bind:value={stepParams.int}
                    class="compact-input"
                    min="0"
                    max="1400"
                />
                <span class="input-suffix">µW/cm²</span>
            </div>
        </div>
    {/if}

    {#if $currentStepType === "RAMP"}
        <div class="params-zone active">
            <div class="control-group">
                <span class="label-text">Start</span>
                <input
                    type="number"
                    bind:value={stepParams.int0}
                    class="compact-input"
                    min="0"
                    max="1400"
                />
            </div>
            <div class="control-group">
                <span class="label-text">End</span>
                <input
                    type="number"
                    bind:value={stepParams.int1}
                    class="compact-input"
                    min="0"
                    max="1400"
                />
                <span class="input-suffix">µW/cm²</span>
            </div>
        </div>
    {/if}

    {#if $currentStepType === "SINE"}
        <div class="params-zone active">
            <div class="control-group">
                <span class="label-text">Min</span>
                <input
                    type="number"
                    bind:value={stepParams.int0}
                    class="compact-input"
                    min="0"
                    max="1400"
                />
            </div>
            <div class="control-group">
                <span class="label-text">Max</span>
                <input
                    type="number"
                    bind:value={stepParams.int1}
                    class="compact-input"
                    min="0"
                    max="1400"
                />
            </div>
            <div class="control-group">
                <span class="label-text">Freq</span>
                <input
                    type="number"
                    bind:value={stepParams.freq}
                    class="compact-input"
                    min="0"
                    max="20"
                    step="0.1"
                />
                <span class="input-suffix">Hz</span>
            </div>
        </div>
    {/if}

    <div style="margin-top: auto; display: flex; gap: 8px;">
        <button class="btn-primary" onclick={addStep} style="flex: 1;">
            <i class="fas fa-plus-circle"></i> Add Step
        </button>
    </div>
</div>
