<script>
    import {
        programData,
        selectedLedIndices,
        simIntensities,
        isSimulating,
        NUM_LEDS,
        currentlyViewedLedIndex,
        currentBlockIndex,
    } from "../store.js";
    import { onDestroy } from "svelte";
    import { LedRuntime } from "./simulator.js";

    /* global eel */
    /** @type {any} */
    const anyWindow = window;
    const eelInstance = anyWindow.eel;

    let simTime = "00:00:00.000";
    let simTimeS = 0;
    let isPlaying = false;
    let simSpeed = 1;
    let runTimeHours = 0;
    let runTimeMinutes = 0;
    let runTimeSeconds = 0;

    let runtimes = [];
    let rafId;
    let lastTime;

    function stopSim() {
        isPlaying = false;
        isSimulating.set(false);
        cancelAnimationFrame(rafId);
        simTimeS = 0;
        updateTimeDisplay();
        simIntensities.set(new Array(NUM_LEDS).fill(0));
    }

    function togglePlay() {
        isPlaying = !isPlaying;
        if (isPlaying) {
            if (simTimeS === 0) {
                // Initialize runtimes
                runtimes = [];
                programData.subscribe((data) => {
                    for (let i = 0; i < NUM_LEDS; i++) {
                        runtimes.push(
                            new LedRuntime(i, data[`LED${i}`].blocks),
                        );
                    }
                })();
                isSimulating.set(true);
            }
            lastTime = performance.now();
            rafId = requestAnimationFrame(tick);
        } else {
            cancelAnimationFrame(rafId);
        }
    }

    function tick(now) {
        if (!isPlaying) return;
        const dt = ((now - lastTime) / 1000) * simSpeed;
        lastTime = now;
        simTimeS += dt;

        const newIntensities = runtimes.map((rt) => rt.tick(simTimeS));
        simIntensities.set(newIntensities);
        updateTimeDisplay();

        if (runtimes.every((rt) => rt.isDone)) {
            isPlaying = false;
        } else {
            rafId = requestAnimationFrame(tick);
        }
    }

    function updateTimeDisplay() {
        const h = Math.floor(simTimeS / 3600);
        const m = Math.floor((simTimeS % 3600) / 60);
        const s = Math.floor(simTimeS % 60);
        const ms = Math.floor((simTimeS % 1) * 1000);
        simTime = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
    }

    async function exportProgram() {
        const totalSeconds =
            runTimeHours * 3600 + runTimeMinutes * 60 + runTimeSeconds;
        console.log("Exporting...", totalSeconds);
    }

    async function saveToDevice() {
        const totalSeconds =
            runTimeHours * 3600 + runTimeMinutes * 60 + runTimeSeconds;

        const exportData = {
            total_duration_s: totalSeconds,
            leds: {},
        };
        programData.subscribe((d) => (exportData.leds = d))();

        const jsonStr = JSON.stringify(exportData, null, 2);

        try {
            const result = await eelInstance.save_program_to_device(jsonStr)();
            if (result.success) {
                alert("Saved successfully to " + result.path);
            } else {
                alert("Error: " + result.error);
            }
        } catch (e) {
            alert(
                "Native Save failed. This feature only works when running the desktop app via main.py.",
            );
        }
    }

    function handleLoad() {
        document.getElementById("file-input").click();
    }

    function onFileChange(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const result = e.target.result;
                if (typeof result !== "string") return;
                const loaded = JSON.parse(result);
                let totalSeconds = 0;
                if (loaded.total_duration_s !== undefined) {
                    totalSeconds = loaded.total_duration_s;
                } else if (loaded.total_duration_minutes !== undefined) {
                    totalSeconds = loaded.total_duration_minutes * 60;
                }

                runTimeHours = Math.floor(totalSeconds / 3600);
                runTimeMinutes = Math.floor((totalSeconds % 3600) / 60);
                runTimeSeconds = Math.floor(totalSeconds % 60);

                const newProgramData = {};
                for (const ledKey in loaded) {
                    if (!ledKey.startsWith("LED")) continue;
                    const ledData = loaded[ledKey];

                    if (Array.isArray(ledData)) {
                        newProgramData[ledKey] = {
                            blocks: [
                                {
                                    id: "block0",
                                    steps: ledData.map((step) => {
                                        if (step.duration_s !== undefined)
                                            step.duration_ms =
                                                step.duration_s * 1000;
                                        return step;
                                    }),
                                    repeat_duration_minutes: null,
                                    repeat_count: null,
                                },
                            ],
                        };
                    } else if (ledData?.blocks) {
                        ledData.blocks.forEach((block) => {
                            if (block.repeat_duration_s !== undefined) {
                                block.repeat_duration_minutes =
                                    block.repeat_duration_s / 60;
                            }
                            if (block.steps) {
                                block.steps.forEach((step) => {
                                    if (step.duration_s !== undefined) {
                                        step.duration_ms =
                                            step.duration_s * 1000;
                                    }
                                });
                            }
                        });
                        newProgramData[ledKey] = ledData;
                    } else {
                        newProgramData[ledKey] = { blocks: [] };
                    }
                }

                // Ensure all LEDs exist
                for (let i = 0; i < NUM_LEDS; i++) {
                    if (!newProgramData[`LED${i}`]) {
                        newProgramData[`LED${i}`] = { blocks: [] };
                    }
                }

                programData.set(newProgramData);
                selectedLedIndices.set(new Set([0]));
                currentlyViewedLedIndex.set(0);
                currentBlockIndex.set(0);

                alert("Loaded successfully!");
            } catch (err) {
                alert("Error loading: " + err.message);
            }
        };
        reader.readAsText(file);
        event.target.value = "";
    }

    onDestroy(() => {
        cancelAnimationFrame(rafId);
    });
</script>

<div class="panel io-bar">
    <div class="io-controls">
        <div class="playback-cluster">
            <button
                class="control-btn small"
                title="Stop/Reset"
                onclick={stopSim}
            >
                <i class="fas fa-stop"></i>
            </button>
            <button
                class="control-btn primary"
                title="Play/Pause"
                onclick={togglePlay}
            >
                <i class={isPlaying ? "fas fa-pause" : "fas fa-play"}></i>
            </button>

            <div class="sim-time-display">{simTime}</div>

            <div class="segmented-control">
                {#each [1, 5, 10] as speed}
                    <button
                        class="segment-btn"
                        class:is-selected={simSpeed === speed}
                        onclick={() => (simSpeed = speed)}>{speed}x</button
                    >
                {/each}
            </div>
        </div>

        <div
            style="width: 1px; background: var(--border-subtle); height: 24px; margin: 0 8px;"
        ></div>

        <button class="segment-btn" onclick={handleLoad}>
            <i class="fas fa-folder-open"></i> Load
        </button>
        <button
            class="segment-btn"
            onclick={saveToDevice}
            title="Direct save to flash drive"
        >
            <i class="fas fa-microchip"></i> Save to Device
        </button>
        <button
            class="btn-primary"
            onclick={exportProgram}
            style="padding: 0.6rem 1rem; font-size: 0.85rem;"
        >
            <i class="fas fa-download"></i> Export
        </button>
        <input
            type="file"
            id="file-input"
            accept=".json"
            onchange={onFileChange}
            style="display: none;"
        />
    </div>

    <div class="duration-display">
        <label
            >TOTAL DURATION
            <div style="display: flex; align-items: center; gap: 4px;">
                <input
                    type="number"
                    bind:value={runTimeHours}
                    class="compact-input"
                    min="0"
                    style="width: 50px;"
                />
                <span class="input-suffix">h</span>
                <input
                    type="number"
                    bind:value={runTimeMinutes}
                    class="compact-input"
                    min="0"
                    max="59"
                    style="width: 50px;"
                />
                <span class="input-suffix">m</span>
                <input
                    type="number"
                    bind:value={runTimeSeconds}
                    class="compact-input"
                    min="0"
                    max="59"
                    style="width: 50px;"
                />
                <span class="input-suffix">s</span>
            </div>
        </label>
    </div>
</div>
