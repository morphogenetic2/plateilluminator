(function initIoModule(global) {
    const App = global.App;
    const State = App.state;
    const fn = App.fn;

    function updateAllLedProgramIndicators() {
        return fn.updateAllLedProgramIndicators();
    }

    function updateblockSelector() {
        return fn.updateblockSelector();
    }

    function renderTimeline() {
        return fn.renderTimeline();
    }

    function showTopToast(message) {
        return fn.showTopToast ? fn.showTopToast(message) : undefined;
    }

    function markClean() {
        return fn.markClean ? fn.markClean() : undefined;
    }

    function pushHistory() {
        return fn.pushHistory ? fn.pushHistory() : undefined;
    }

    const STEP_TYPES = new Set(['ON', 'OFF', 'RAMP', 'SINE']);

    function finiteNumber(value, fallback = null) {
        if (value === null || value === undefined || value === '') return fallback;
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function normalizeStep(rawStep, context) {
        if (!rawStep || typeof rawStep !== 'object' || Array.isArray(rawStep)) {
            throw new Error(`${context} must be an object`);
        }

        const type = String(rawStep.type ?? rawStep.action ?? '').toUpperCase();
        if (!STEP_TYPES.has(type)) {
            throw new Error(`${context} has an unsupported step type`);
        }

        let durationMs = null;
        if (rawStep.duration_ms !== undefined) {
            durationMs = finiteNumber(rawStep.duration_ms);
        } else if (rawStep.duration_s !== undefined) {
            const durationSeconds = finiteNumber(rawStep.duration_s);
            durationMs = durationSeconds === null ? null : durationSeconds * 1000;
        }
        if (!Number.isFinite(durationMs) || durationMs < 0) {
            throw new Error(`${context} has an invalid duration`);
        }

        const step = { type, duration_ms: durationMs };
        if (type === 'ON') {
            step.int = clamp(finiteNumber(rawStep.int ?? rawStep.intensity_uwcm2, 0), 0, 3000);
        } else if (type === 'RAMP') {
            step.int0 = clamp(finiteNumber(rawStep.int0 ?? rawStep.start_intensity_uwcm2, 0), 0, 3000);
            step.int1 = clamp(finiteNumber(rawStep.int1 ?? rawStep.end_intensity_uwcm2, 0), 0, 3000);
        } else if (type === 'SINE') {
            step.int0 = clamp(finiteNumber(rawStep.int0 ?? rawStep.min_intensity_uwcm2, 0), 0, 3000);
            step.int1 = clamp(finiteNumber(rawStep.int1 ?? rawStep.max_intensity_uwcm2, 0), 0, 3000);
            step.freq = clamp(finiteNumber(rawStep.freq ?? rawStep.frequency_hz, 1), 0, 20);
        }
        return step;
    }

    function normalizeBlock(rawBlock, blockIndex, ledKey) {
        if (!rawBlock || typeof rawBlock !== 'object' || Array.isArray(rawBlock)) {
            throw new Error(`${ledKey} block ${blockIndex + 1} must be an object`);
        }
        if (!Array.isArray(rawBlock.steps)) {
            throw new Error(`${ledKey} block ${blockIndex + 1} steps must be an array`);
        }

        const repeatDurationMinutes = rawBlock.repeat_duration_s !== undefined
            ? finiteNumber(rawBlock.repeat_duration_s) / 60
            : finiteNumber(rawBlock.repeat_duration_minutes);
        const repeatCount = finiteNumber(rawBlock.repeat_count);

        return {
            id: String(rawBlock.id ?? `block${blockIndex}`),
            steps: rawBlock.steps.map((step, stepIndex) =>
                normalizeStep(step, `${ledKey} block ${blockIndex + 1} step ${stepIndex + 1}`)
            ),
            repeat_duration_minutes: repeatDurationMinutes > 0 ? repeatDurationMinutes : null,
            repeat_count: repeatCount > 0 ? Math.floor(repeatCount) : null,
            repeat_continuous: Boolean(rawBlock.repeat_continuous),
        };
    }

    function normalizeLoadedProgram(loaded) {
        if (!loaded || typeof loaded !== 'object' || Array.isArray(loaded)) {
            throw new Error('Program must be a JSON object');
        }

        const programData = {};
        for (let i = 0; i < App.config.NUM_LEDS; i++) {
            programData[`LED${i}`] = { blocks: [] };
        }

        for (const [ledKey, ledData] of Object.entries(loaded)) {
            const match = /^LED(\d+)$/.exec(ledKey);
            if (!match) continue;
            const ledIndex = parseInt(match[1], 10);
            if (ledIndex < 0 || ledIndex >= App.config.NUM_LEDS) continue;

            if (Array.isArray(ledData)) {
                programData[ledKey] = {
                    blocks: ledData.length === 0 ? [] : [{
                        id: 'block0',
                        steps: ledData.map((step, stepIndex) =>
                            normalizeStep(step, `${ledKey} step ${stepIndex + 1}`)
                        ),
                        repeat_duration_minutes: null,
                        repeat_count: null,
                        repeat_continuous: false,
                    }],
                };
                continue;
            }

            if (!ledData || typeof ledData !== 'object' || !Array.isArray(ledData.blocks)) {
                throw new Error(`${ledKey} blocks must be an array`);
            }
            programData[ledKey] = {
                blocks: ledData.blocks.map((block, blockIndex) =>
                    normalizeBlock(block, blockIndex, ledKey)
                ),
            };
        }

        const rawTotalSeconds = loaded.total_duration_s !== undefined
            ? finiteNumber(loaded.total_duration_s)
            : finiteNumber(loaded.total_duration_minutes, 0) * 60;
        if (!Number.isFinite(rawTotalSeconds) || rawTotalSeconds < 0) {
            throw new Error('Total duration must be a non-negative number');
        }

        return {
            programData,
            totalSeconds: rawTotalSeconds,
        };
    }

    function padDurationValue(val) {
        return `${Math.max(0, parseInt(val, 10) || 0)}`.padStart(2, '0');
    }

    function syncRunTimePickerFromFields() {
        const hoursEl = document.getElementById('run-time-hours');
        const minutesEl = document.getElementById('run-time-minutes');
        const secondsEl = document.getElementById('run-time-seconds');
        const displayEl = document.getElementById('run-time-display');
        if (!hoursEl || !minutesEl || !secondsEl || !displayEl) return 0;

        let hours = Math.max(0, parseInt(hoursEl.value, 10) || 0);
        let minutes = Math.max(0, Math.min(59, parseInt(minutesEl.value, 10) || 0));
        let seconds = Math.max(0, Math.min(59, parseInt(secondsEl.value, 10) || 0));

        hoursEl.value = hours;
        minutesEl.value = minutes;
        secondsEl.value = seconds;
        displayEl.textContent = `${padDurationValue(hours)} : ${padDurationValue(minutes)} : ${padDurationValue(seconds)}`;

        return (hours * 3600) + (minutes * 60) + seconds;
    }

    function getBlockMode(block) {
        if (block.repeat_continuous) return 'continuous';
        if (block.repeat_count) return 'count';
        if (block.repeat_duration_minutes !== null && block.repeat_duration_minutes !== undefined) return 'duration';
        return 'once';
    }

    function getProgramFlowAnalysis() {
        const analysis = {
            hasContinuousBlocks: false,
            hasNonContinuousBlocks: false,
            hasContinuousBeforeOther: false,
            warning: null,
        };

        for (const ledKey in State.programData) {
            const blocks = State.programData[ledKey]?.blocks || [];

            let seenContinuousInLed = false;
            for (let idx = 0; idx < blocks.length; idx++) {
                const block = blocks[idx];
                const hasSteps = Array.isArray(block.steps) && block.steps.length > 0;
                if (!hasSteps) continue;

                const mode = getBlockMode(block);
                if (mode === 'continuous') {
                    analysis.hasContinuousBlocks = true;
                    seenContinuousInLed = true;
                    continue;
                }

                analysis.hasNonContinuousBlocks = true;
                if (seenContinuousInLed && !analysis.hasContinuousBeforeOther) {
                    analysis.hasContinuousBeforeOther = true;
                    const ledNum = parseInt(ledKey.replace('LED', ''), 10) + 1;
                    analysis.warning = `A continuous block will prevent the other blocks to run (LED ${ledNum}, block ${idx + 1} onward).`;
                }
            }
        }

        return analysis;
    }

    function updateTotalDurationAvailability() {
        const analysis = getProgramFlowAnalysis();
        const shouldEnable = analysis.hasContinuousBlocks && !analysis.hasNonContinuousBlocks;
        const shouldLock = !shouldEnable;
        const container = document.getElementById('total-duration-control');
        const hint = document.getElementById('total-duration-hint');
        const trigger = document.getElementById('run-time-trigger');
        const menu = document.getElementById('run-time-menu');
        const applyBtn = document.getElementById('run-time-apply-btn');
        const warningEl = document.getElementById('block-flow-warning');
        const warningTextEl = document.getElementById('block-flow-warning-text');
        const fields = [
            document.getElementById('run-time-hours'),
            document.getElementById('run-time-minutes'),
            document.getElementById('run-time-seconds'),
        ].filter(Boolean);

        if (container) container.classList.toggle('is-disabled', shouldLock);
        if (trigger) {
            trigger.disabled = shouldLock;
            trigger.classList.remove('is-open');
            trigger.setAttribute('aria-expanded', 'false');
        }
        if (menu) menu.classList.remove('is-open');
        if (applyBtn) applyBtn.disabled = shouldLock;
        fields.forEach(field => field.disabled = shouldLock);

        if (shouldLock) {
            fields.forEach(field => field.value = 0);
            syncRunTimePickerFromFields();
        }

        if (hint) {
            if (shouldEnable) {
                hint.textContent = 'Set a stop time or leave 00:00:00 for continuous run.';
            } else if (!analysis.hasContinuousBlocks) {
                hint.textContent = 'Disabled: add a continuous block to use total duration.';
            } else {
                hint.textContent = 'Disabled: once/count/duration blocks override total duration.';
            }
        }

        if (warningEl) {
            warningEl.style.display = analysis.hasContinuousBeforeOther ? 'flex' : 'none';
        }
        if (warningTextEl && analysis.hasContinuousBeforeOther) {
            warningTextEl.textContent = analysis.warning || 'A continuous block will prevent the other blocks to run.';
        }
    }
// Helper: Calculate total duration of a single LED's program in minutes
function calculateLedProgramDuration(ledData) {
    if (!ledData?.blocks || ledData.blocks.length === 0) return 0;

    let totalS = 0;

    ledData.blocks.forEach(block => {
        const steps = block.steps || [];
        const blockDurationS = steps.reduce((sum, step) => sum + (step.duration_s || (step.duration_ms / 1000) || 0), 0);

        if (block.repeat_continuous) {
            // For continuous blocks, we count one loop for export calculation purposes
            totalS += blockDurationS;
        } else if (block.repeat_count) {
            totalS += blockDurationS * block.repeat_count;
        } else if (block.repeat_duration_s) {
            totalS += block.repeat_duration_s;
        } else if (block.repeat_duration_minutes) {
            totalS += block.repeat_duration_minutes * 60;
        } else {
            // Run once
            totalS += blockDurationS;
        }
    });

    return totalS;
}

// Helper: Find longest program duration across all LEDs
function findLongestProgramDuration() {
    let maxDurationS = 0;
    for (const ledKey in State.programData) {
        const durationS = calculateLedProgramDuration(State.programData[ledKey]);
        if (durationS > maxDurationS) maxDurationS = durationS;
    }
    return maxDurationS;
}

function hasAnyProgramSteps() {
    return Object.values(State.programData).some(ledData =>
        ledData?.blocks?.some(block => Array.isArray(block.steps) && block.steps.length > 0)
    );
}

function resolveExportTotalSeconds() {
    if (!hasAnyProgramSteps()) {
        showTopToast('Add at least 1 step before exporting');
        return null;
    }

    const totalSeconds = syncRunTimePickerFromFields();
    const h = parseInt(document.getElementById('run-time-hours').value, 10) || 0;
    const m = parseInt(document.getElementById('run-time-minutes').value, 10) || 0;
    const s = parseInt(document.getElementById('run-time-seconds').value, 10) || 0;
    const longestProgramSeconds = findLongestProgramDuration();

    if (totalSeconds > 0 && longestProgramSeconds > totalSeconds) {
        const adjustedTotalS = Math.ceil(longestProgramSeconds);
        const longestHours = Math.floor(adjustedTotalS / 3600);
        const longestMins = Math.floor((adjustedTotalS % 3600) / 60);
        const longestSecs = adjustedTotalS % 60;

        const userChoice = confirm(
            `⚠️ Duration Mismatch!\n\n` +
            `The longest LED program is ${longestHours}h ${longestMins}m ${longestSecs}s, ` +
            `but the Total Duration is set to ${h}h ${m}m ${s}s.\n\n` +
            `Click OK to auto-adjust Total Duration to match the longest program, or Cancel to export as-is.`
        );

        if (userChoice) {
            document.getElementById('run-time-hours').value = longestHours;
            document.getElementById('run-time-minutes').value = longestMins;
            document.getElementById('run-time-seconds').value = longestSecs;
            syncRunTimePickerFromFields();
            return adjustedTotalS;
        }
    }

    return totalSeconds;
}

function exportProgram() {
    const totalSeconds = resolveExportTotalSeconds();
    if (totalSeconds === null) return;
    performExport(totalSeconds);
}

function getExportData(totalSeconds) {
    // Deep copy to avoid modifying state
    const exportData = JSON.parse(JSON.stringify(State.programData));
    exportData.total_duration_s = totalSeconds;

    // Sanitize for firmware compatibility
    for (const key in exportData) {
        if (key.startsWith('LED') && exportData[key].blocks) {
            exportData[key].blocks.forEach(block => {
                // Convert timing to seconds
                if (block.steps) {
                    block.steps.forEach(step => {
                        if (step.duration_ms !== undefined) {
                            step.duration_s = step.duration_ms / 1000;
                            delete step.duration_ms;
                        }
                    });
                }
                if (block.repeat_duration_minutes !== undefined) {
                    if (block.repeat_duration_minutes !== null) {
                        block.repeat_duration_s = block.repeat_duration_minutes * 60;
                    }
                    delete block.repeat_duration_minutes;
                }

                // Firmware expects repeat_count: 0 for infinite loops
                if (block.repeat_continuous) {
                    block.repeat_count = 0;
                }
            });
        }
    }
    return exportData;
}

function performExport(totalSeconds) {
    const exportData = getExportData(totalSeconds);
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'program.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    markClean();
    showTopToast('program.json exported');
}

async function saveToDevice() {
    const totalSeconds = resolveExportTotalSeconds();
    if (totalSeconds === null) return;

    if (!('showSaveFilePicker' in window)) {
        alert('Your browser does not support direct saving. Please use standard Export.');
        return;
    }

    const exportData = getExportData(totalSeconds);

    try {
        if (!State.fileHandle) {
            State.fileHandle = await window.showSaveFilePicker({
                suggestedName: 'program.json',
                types: [{
                    description: 'JSON Binary',
                    accept: { 'application/json': ['.json'] },
                }],
            });
        }

        // Check if we have permission to write
        const options = { mode: 'readwrite' };
        if (await State.fileHandle.queryPermission(options) !== 'granted') {
            if (await State.fileHandle.requestPermission(options) !== 'granted') {
                alert('Permission denied.');
                return;
            }
        }

        const writable = await State.fileHandle.createWritable();
        await writable.write(JSON.stringify(exportData, null, 2));
        await writable.close();
        markClean();

        // Visual feedback
        const btn = document.getElementById('save-device-btn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i> Saved';
        btn.style.color = 'var(--accent-success)';
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.style.color = '';
        }, 2000);
        showTopToast('program.json saved to device');

    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error('Save failed:', err);
            alert('Save failed. Try choosing the file again.');
            State.fileHandle = null;
        }
    }
}

function loadProgram(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const loaded = JSON.parse(e.target.result);
            const normalized = normalizeLoadedProgram(loaded);
            pushHistory();
            State.programData = normalized.programData;
            const totalSeconds = normalized.totalSeconds;

            // Update duration inputs
            document.getElementById('run-time-hours').value = Math.floor(totalSeconds / 3600);
            document.getElementById('run-time-minutes').value = Math.floor((totalSeconds % 3600) / 60);
            document.getElementById('run-time-seconds').value = Math.floor(totalSeconds % 60);
            syncRunTimePickerFromFields();

            State.currentblockIndex = 0;
            updateAllLedProgramIndicators();
            updateblockSelector();
            renderTimeline();
            updateTotalDurationAvailability();

            markClean();
            showTopToast('Program loaded');
        } catch (err) {
            showTopToast(`Could not load program: ${err.message}`);
        }
    };
    reader.onerror = () => {
        showTopToast('Could not read the selected program file');
    };
    reader.readAsText(file);
    event.target.value = '';
}

    fn.calculateLedProgramDuration = calculateLedProgramDuration;
    fn.findLongestProgramDuration = findLongestProgramDuration;
    fn.exportProgram = exportProgram;
    fn.getExportData = getExportData;
    fn.performExport = performExport;
    fn.saveToDevice = saveToDevice;
    fn.loadProgram = loadProgram;
    fn.syncRunTimePickerFromFields = syncRunTimePickerFromFields;
    fn.updateTotalDurationAvailability = updateTotalDurationAvailability;
    fn.normalizeLoadedProgram = normalizeLoadedProgram;
})(window);
