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

function exportProgram() {
    let hasAnySteps = false;
    for (const ledKey in State.programData) {
        if (State.programData[ledKey].blocks?.length > 0) {
            hasAnySteps = true;
            break;
        }
    }

    if (!hasAnySteps) {
        alert('Program is empty.');
        return;
    }

    const totalSeconds = syncRunTimePickerFromFields();
    const h = parseInt(document.getElementById('run-time-hours').value, 10) || 0;
    const m = parseInt(document.getElementById('run-time-minutes').value, 10) || 0;
    const s = parseInt(document.getElementById('run-time-seconds').value, 10) || 0;

    // Validation: Check if longest program exceeds total duration
    const longestProgramSeconds = findLongestProgramDuration();

    if (totalSeconds > 0 && longestProgramSeconds > totalSeconds) {
        const longestHours = Math.floor(longestProgramSeconds / 3600);
        const longestMins = Math.floor((longestProgramSeconds % 3600) / 60);
        const longestSecs = Math.round(longestProgramSeconds % 60);

        const userChoice = confirm(
            `⚠️ Duration Mismatch!\n\n` +
            `The longest LED program is ${longestHours}h ${longestMins}m ${longestSecs}s, ` +
            `but the Total Duration is set to ${h}h ${m}m ${s}s.\n\n` +
            `Click OK to auto-adjust Total Duration to match the longest program, or Cancel to export as-is.`
        );

        if (userChoice) {
            // Auto-adjust
            document.getElementById('run-time-hours').value = longestHours;
            document.getElementById('run-time-minutes').value = longestMins;
            document.getElementById('run-time-seconds').value = longestSecs;
            syncRunTimePickerFromFields();

            // Recalculate with new values
            const adjustedTotalS = (longestHours * 3600) + (longestMins * 60) + longestSecs;
            performExport(adjustedTotalS);
            return;
        }
    }

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
    alert('Exported program.json!');
}

async function saveToDevice() {
    if (!('showSaveFilePicker' in window)) {
        alert('Your browser does not support direct saving. Please use standard Export.');
        return;
    }

    const totalSeconds = syncRunTimePickerFromFields();

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

        // Visual feedback
        const btn = document.getElementById('save-device-btn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> Saved!';
        btn.style.color = 'var(--accent-success)';
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.style.color = '';
        }, 2000);

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

            // Unified total duration in seconds
            let totalSeconds = 0;
            if (loaded.total_duration_s !== undefined) {
                totalSeconds = loaded.total_duration_s;
            } else if (loaded.total_duration_minutes !== undefined) {
                totalSeconds = loaded.total_duration_minutes * 60;
            }

            // Clean State
            State.programData = {};
            for (const ledKey in loaded) {
                if (!ledKey.startsWith('LED')) continue;
                const ledData = loaded[ledKey];

                if (Array.isArray(ledData)) {
                    // Legacy format
                    State.programData[ledKey] = {
                        blocks: [{
                            id: 'block0',
                            steps: ledData.map(step => {
                                // Map old field names to internal state
                                if (step.duration_s !== undefined) step.duration_ms = step.duration_s * 1000;
                                return step;
                            }),
                            repeat_duration_minutes: null,
                            repeat_count: null
                        }]
                    };
                } else if (ledData?.blocks) {
                    ledData.blocks.forEach(block => {
                        // Map old field names to internal UI state
                        if (block.repeat_duration_s !== undefined) {
                            block.repeat_duration_minutes = block.repeat_duration_s / 60;
                        }
                        if (block.steps) {
                            block.steps.forEach(step => {
                                if (step.duration_s !== undefined) {
                                    step.duration_ms = step.duration_s * 1000;
                                }
                            });
                        }
                    });
                    State.programData[ledKey] = ledData;
                } else {
                    State.programData[ledKey] = { blocks: [] };
                }
            }

            // Ensure all LEDs exist
            for (let i = 0; i < App.config.NUM_LEDS; i++) {
                if (!State.programData[`LED${i}`]) {
                    State.programData[`LED${i}`] = { blocks: [] };
                }
            }

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

            alert('Loaded successfully!');
        } catch (err) {
            alert('Error loading: ' + err.message);
        }
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
})(window);
