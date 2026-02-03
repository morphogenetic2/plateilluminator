document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // STATE
    // ==========================================
    const NUM_LEDS = 24;
    const State = {
        programData: {},
        selectedLedIndices: new Set(),
        currentlyViewedLedIndex: null,
        currentblockIndex: 0,
        currentStepType: 'ON',
    };

    function initState() {
        for (let i = 0; i < NUM_LEDS; i++) {
            State.programData[`LED${i}`] = {
                blocks: [{
                    id: 'block0',
                    steps: [],
                    repeat_duration_minutes: null,
                    repeat_count: null
                }]
            };
        }
    }

    // ==========================================
    // TIMELINE (Horizontal Pills)
    // ==========================================
    let timelineSortableInstance = null;

    function renderTimeline() {
        const timeline = document.getElementById('timeline-display');
        const timelineLabel = document.getElementById('timeline-label');
        if (!timeline) return;

        timeline.innerHTML = '';

        // Update label with smart LED formatting
        if (timelineLabel) {
            if (State.selectedLedIndices.size === 0) {
                timelineLabel.textContent = '';
            } else if (State.selectedLedIndices.size === 1) {
                const ledNum = [...State.selectedLedIndices][0] + 1;
                timelineLabel.textContent = `(LED ${ledNum})`;
            } else {
                const sorted = [...State.selectedLedIndices].sort((a, b) => a - b);
                const ledNums = sorted.map(i => i + 1);
                const isConsecutive = sorted.every((val, idx) => idx === 0 || val === sorted[idx - 1] + 1);

                if (isConsecutive && ledNums.length > 2) {
                    timelineLabel.textContent = `(LEDs ${ledNums[0]}-${ledNums[ledNums.length - 1]})`;
                } else if (ledNums.length <= 5) {
                    timelineLabel.textContent = `(LEDs ${ledNums.join(', ')})`;
                } else {
                    timelineLabel.textContent = `(${ledNums.length} LEDs selected)`;
                }
            }
        }

        // Destroy previous sortable
        if (timelineSortableInstance) {
            timelineSortableInstance.destroy();
            timelineSortableInstance = null;
        }

        // Check state
        if (State.currentlyViewedLedIndex === null) {
            timeline.innerHTML = '<span class="timeline-empty">Select LEDs to begin.</span>';
            return;
        }

        const ledData = State.programData[`LED${State.currentlyViewedLedIndex}`];
        const blocks = ledData?.blocks || [];

        if (blocks.length === 0) {
            timeline.innerHTML = '<span class="timeline-empty">No blocks. Click "+ Add block" to begin.</span>';
            return;
        }

        // Render ALL blocks with visual grouping
        blocks.forEach((block, blockIdx) => {
            const blockGroup = document.createElement('div');
            blockGroup.className = 'block-group';
            blockGroup.dataset.blockIndex = blockIdx;
            if (blockIdx === State.currentblockIndex) blockGroup.classList.add('active');

            // block label
            const blockLabel = document.createElement('div');
            blockLabel.className = 'block-label';
            let repeatInfo = '';
            if (block.repeat_count) repeatInfo = ` • ${block.repeat_count}x`;
            else if (block.repeat_duration_minutes) repeatInfo = ` • ${block.repeat_duration_minutes}min`;
            blockLabel.textContent = `${block.id || `block ${blockIdx + 1}`}${repeatInfo}`;
            blockGroup.appendChild(blockLabel);

            const stepsContainer = document.createElement('div');
            stepsContainer.className = 'block-steps';
            stepsContainer.dataset.blockIndex = blockIdx;

            const steps = block.steps || [];
            if (steps.length === 0) {
                const emptyMsg = document.createElement('span');
                emptyMsg.className = 'timeline-empty';
                emptyMsg.textContent = 'Empty block';
                stepsContainer.appendChild(emptyMsg);
            } else {
                steps.forEach((step, stepIdx) => {
                    const pill = document.createElement('div');
                    pill.className = `step-pill type-${step.type.toLowerCase()}`;
                    pill.dataset.blockIndex = blockIdx;
                    pill.dataset.stepIndex = stepIdx;

                    let details = '';
                    if (step.type === 'ON') details = `${step.duration_ms}ms @ ${step.int}`;
                    else if (step.type === 'OFF') details = `${step.duration_ms}ms`;
                    else if (step.type === 'RAMP') details = `${step.duration_ms}ms: ${step.int0}→${step.int1}`;
                    else if (step.type === 'SINE') details = `${step.duration_ms}ms: ${step.freq}Hz`;

                    pill.innerHTML = `
                        <span>${step.type}</span>
                        <span style="opacity:0.7; font-size:0.65rem;">${details}</span>
                        <button class="delete-step" data-block-index="${blockIdx}" data-step-index="${stepIdx}" title="Remove"><i class="fas fa-times"></i></button>
                    `;
                    stepsContainer.appendChild(pill);
                });
            }

            blockGroup.appendChild(stepsContainer);
            timeline.appendChild(blockGroup);

            // Click handler to select block
            blockGroup.addEventListener('click', (e) => {
                if (!e.target.classList.contains('delete-step') && !e.target.closest('.delete-step')) {
                    State.currentblockIndex = blockIdx;
                    updateblockSelector();
                    renderTimeline();
                }
            });
        });

        // Delete handlers
        timeline.querySelectorAll('.delete-step').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const blockIdx = parseInt(btn.dataset.blockIndex);
                const stepIdx = parseInt(btn.dataset.stepIndex);
                blocks[blockIdx].steps.splice(stepIdx, 1);
                renderTimeline();
                updateAllLedProgramIndicators();
            });
        });

        // Sortable only on current block
        const currentblockStepsContainer = timeline.querySelector(`.block-steps[data-block-index="${State.currentblockIndex}"]`);
        if (currentblockStepsContainer && blocks[State.currentblockIndex]?.steps?.length > 0) {
            timelineSortableInstance = Sortable.create(currentblockStepsContainer, {
                animation: 150,
                filter: '.delete-step',
                onEnd: (evt) => {
                    if (evt.oldIndex === evt.newIndex) return;
                    const [moved] = blocks[State.currentblockIndex].steps.splice(evt.oldIndex, 1);
                    blocks[State.currentblockIndex].steps.splice(evt.newIndex, 0, moved);
                }
            });
        }
    }

    // ==========================================
    // block MANAGER
    // ==========================================
    function updateblockSelector() {
        const selector = document.getElementById('block-selector');
        const blockLedLabel = document.getElementById('block-led-label');

        if (!selector) return;
        selector.innerHTML = '';

        if (blockLedLabel) {
            if (State.selectedLedIndices.size === 0) {
                blockLedLabel.textContent = '';
            } else if (State.selectedLedIndices.size === 1) {
                const ledNum = [...State.selectedLedIndices][0] + 1;
                blockLedLabel.textContent = `(LED ${ledNum})`;
            } else {
                // Multiple LEDs selected - format nicely
                const sorted = [...State.selectedLedIndices].sort((a, b) => a - b);
                const ledNums = sorted.map(i => i + 1);

                // Check if consecutive
                const isConsecutive = sorted.every((val, idx) =>
                    idx === 0 || val === sorted[idx - 1] + 1
                );

                if (isConsecutive && ledNums.length > 2) {
                    blockLedLabel.textContent = `(LEDs ${ledNums[0]}-${ledNums[ledNums.length - 1]})`;
                } else if (ledNums.length <= 5) {
                    blockLedLabel.textContent = `(LEDs ${ledNums.join(', ')})`;
                } else {
                    blockLedLabel.textContent = `(${ledNums.length} LEDs selected)`;
                }
            }
        }

        if (State.currentlyViewedLedIndex === null) {
            const opt = document.createElement('option');
            opt.textContent = 'Select LED first';
            selector.appendChild(opt);
            return;
        }

        const ledData = State.programData[`LED${State.currentlyViewedLedIndex}`];
        const blocks = ledData?.blocks || [];

        if (blocks.length === 0) {
            const opt = document.createElement('option');
            opt.textContent = 'No blocks';
            selector.appendChild(opt);
            return;
        }

        blocks.forEach((block, i) => {
            const opt = document.createElement('option');
            let repeatInfo = '';
            if (block.repeat_count) repeatInfo = ` (${block.repeat_count}x)`;
            else if (block.repeat_duration_minutes) repeatInfo = ` (${block.repeat_duration_minutes}min)`;
            opt.value = i;
            opt.textContent = `${block.id || `block ${i + 1}`}${repeatInfo}`;
            if (i === State.currentblockIndex) opt.selected = true;
            selector.appendChild(opt);
        });

        // Update block config UI
        updateblockConfigUI();
    }

    function updateblockConfigUI() {
        const ledData = State.programData[`LED${State.currentlyViewedLedIndex}`];
        const blocks = ledData?.blocks || [];
        if (blocks.length === 0 || State.currentblockIndex >= blocks.length) return;

        const block = blocks[State.currentblockIndex];

        document.getElementById('block-name-input').value = block.id || '';

        // Update repeat mode buttons
        document.querySelectorAll('.repeat-mode-btn').forEach(btn => {
            btn.classList.remove('is-selected');
        });

        let mode = 'once';
        if (block.repeat_count) mode = 'count';
        else if (block.repeat_duration_minutes) mode = 'duration';

        document.querySelector(`.repeat-mode-btn[data-mode="${mode}"]`)?.classList.add('is-selected');

        document.getElementById('repeat-count-field').style.display = mode === 'count' ? 'flex' : 'none';
        document.getElementById('repeat-duration-field').style.display = mode === 'duration' ? 'flex' : 'none';

        if (mode === 'count') {
            document.getElementById('repeat-count-input').value = block.repeat_count || 10;
        } else if (mode === 'duration') {
            document.getElementById('repeat-duration-input').value = block.repeat_duration_minutes || 1;
        }
    }

    function saveblockConfig() {
        if (State.currentlyViewedLedIndex === null) return;

        const ledData = State.programData[`LED${State.currentlyViewedLedIndex}`];
        const blocks = ledData?.blocks || [];
        if (blocks.length === 0 || State.currentblockIndex >= blocks.length) return;

        const blockName = document.getElementById('block-name-input').value.trim();
        const selectedMode = document.querySelector('.repeat-mode-btn.is-selected')?.dataset.mode || 'once';

        let repeat_count = null;
        let repeat_duration_minutes = null;

        if (selectedMode === 'count') {
            repeat_count = Math.max(1, parseInt(document.getElementById('repeat-count-input').value) || 1);
        } else if (selectedMode === 'duration') {
            repeat_duration_minutes = Math.max(0, parseFloat(document.getElementById('repeat-duration-input').value) || 1);
        }

        // Apply to ALL selected LEDs
        State.selectedLedIndices.forEach(ledIdx => {
            const targetLedData = State.programData[`LED${ledIdx}`];
            if (!targetLedData?.blocks || State.currentblockIndex >= targetLedData.blocks.length) return;

            const targetblock = targetLedData.blocks[State.currentblockIndex];
            targetblock.id = blockName || `block${State.currentblockIndex}`;
            targetblock.repeat_count = repeat_count;
            targetblock.repeat_duration_minutes = repeat_duration_minutes;
        });

        updateblockSelector();
    }

    function addblock() {
        if (State.selectedLedIndices.size === 0) {
            alert('Select LEDs first.');
            return;
        }

        State.selectedLedIndices.forEach(idx => {
            const ledData = State.programData[`LED${idx}`];
            const newblock = {
                id: `block${ledData.blocks.length}`,
                steps: [],
                repeat_duration_minutes: null,
                repeat_count: null
            };
            ledData.blocks.push(newblock);
        });

        if (State.currentlyViewedLedIndex !== null) {
            const ledData = State.programData[`LED${State.currentlyViewedLedIndex}`];
            State.currentblockIndex = ledData.blocks.length - 1;
        }

        updateblockSelector();
        renderTimeline();
        updateAllLedProgramIndicators();
    }

    function removeblock() {
        if (State.currentlyViewedLedIndex === null) return;

        const ledData = State.programData[`LED${State.currentlyViewedLedIndex}`];
        if (!ledData.blocks || ledData.blocks.length === 0) return;

        if (!confirm(`Remove block ${State.currentblockIndex + 1}?`)) return;

        ledData.blocks.splice(State.currentblockIndex, 1);
        if (State.currentblockIndex >= ledData.blocks.length) {
            State.currentblockIndex = Math.max(0, ledData.blocks.length - 1);
        }

        updateblockSelector();
        renderTimeline();
        updateAllLedProgramIndicators();
    }

    // ==========================================
    // LED GRID
    // ==========================================
    let allLedButtons = [];

    function initLedGrid() {
        const grid = document.getElementById('led-grid');
        if (!grid) return;

        for (let i = 0; i < NUM_LEDS; i++) {
            const btn = document.createElement('button');
            btn.className = 'led-btn';
            btn.dataset.ledId = i;
            btn.textContent = i + 1;

            btn.addEventListener('click', (e) => {
                handleLedClick(i, e);
            });

            grid.appendChild(btn);
            allLedButtons.push(btn);
        }
    }

    function handleLedClick(ledIndex, event) {
        const isCtrl = event.ctrlKey || event.metaKey;

        if (isCtrl) {
            if (State.selectedLedIndices.has(ledIndex)) {
                State.selectedLedIndices.delete(ledIndex);
            } else {
                State.selectedLedIndices.add(ledIndex);
            }
        } else {
            if (State.selectedLedIndices.has(ledIndex) && State.selectedLedIndices.size === 1) {
                State.selectedLedIndices.clear();
            } else {
                State.selectedLedIndices.clear();
                State.selectedLedIndices.add(ledIndex);
            }
        }

        State.currentlyViewedLedIndex = ledIndex;
        State.currentblockIndex = 0;

        updateLedAppearances();
        updateblockSelector();
        renderTimeline();
    }

    function updateLedAppearances() {
        allLedButtons.forEach(btn => {
            const id = parseInt(btn.dataset.ledId);
            btn.classList.remove('selected', 'viewing');

            if (id === State.currentlyViewedLedIndex) btn.classList.add('viewing');
            else if (State.selectedLedIndices.has(id)) btn.classList.add('selected');
        });
    }

    function updateAllLedProgramIndicators() {
        allLedButtons.forEach(btn => {
            const idx = parseInt(btn.dataset.ledId);
            const ledData = State.programData[`LED${idx}`];

            // Only show has-program if there's at least one step in any block
            let hasProgram = false;
            if (ledData?.blocks) {
                for (const block of ledData.blocks) {
                    if (block.steps && block.steps.length > 0) {
                        hasProgram = true;
                        break;
                    }
                }
            }

            btn.classList.toggle('has-program', hasProgram);
        });
    }

    // ==========================================
    // STEP EDITOR
    // ==========================================
    function updateStepParams() {
        document.querySelectorAll('.step-params').forEach(el => el.classList.remove('active'));
        const type = State.currentStepType.toLowerCase();
        document.getElementById(`params-${type === 'off' ? 'on' : type}`)?.classList.add('active');
        if (type === 'off') {
            // No params for OFF
            document.querySelectorAll('.step-params').forEach(el => el.classList.remove('active'));
        }
    }

    function addStep() {
        if (State.selectedLedIndices.size === 0) {
            alert('Select LEDs first.');
            return;
        }

        // Check all selected LEDs have blocks
        for (const idx of State.selectedLedIndices) {
            const ledData = State.programData[`LED${idx}`];
            if (!ledData.blocks || ledData.blocks.length === 0) {
                alert(`LED ${idx + 1} has no blocks. Add a block first.`);
                return;
            }
        }

        const duration = parseInt(document.getElementById('step-duration').value) || 1000;
        if (duration < 50) {
            alert('Duration must be >= 50ms');
            return;
        }

        const step = { type: State.currentStepType, duration_ms: duration };

        if (State.currentStepType === 'ON') {
            step.int = Math.min(1400, Math.max(0, parseInt(document.getElementById('on-int').value) || 0));
        } else if (State.currentStepType === 'RAMP') {
            step.int0 = Math.min(1400, Math.max(0, parseInt(document.getElementById('ramp-int0').value) || 0));
            step.int1 = Math.min(1400, Math.max(0, parseInt(document.getElementById('ramp-int1').value) || 0));
        } else if (State.currentStepType === 'SINE') {
            step.int0 = Math.min(1400, Math.max(0, parseInt(document.getElementById('sine-int0').value) || 0));
            step.int1 = Math.min(1400, Math.max(0, parseInt(document.getElementById('sine-int1').value) || 0));
            step.freq = Math.min(20, Math.max(0, parseFloat(document.getElementById('sine-freq').value) || 1));
        }

        State.selectedLedIndices.forEach(idx => {
            const ledData = State.programData[`LED${idx}`];
            const block = ledData.blocks[State.currentblockIndex];
            if (block) {
                block.steps.push({ ...step });
            }
        });

        renderTimeline();
        updateAllLedProgramIndicators();
    }

    // ==========================================
    // FILE I/O
    // ==========================================

    // Helper: Calculate total duration of a single LED's program in minutes
    function calculateLedProgramDuration(ledData) {
        if (!ledData?.blocks || ledData.blocks.length === 0) return 0;

        let totalMs = 0;

        ledData.blocks.forEach(block => {
            const steps = block.steps || [];
            const blockDurationMs = steps.reduce((sum, step) => sum + (step.duration_ms || 0), 0);

            if (block.repeat_count) {
                totalMs += blockDurationMs * block.repeat_count;
            } else if (block.repeat_duration_minutes) {
                totalMs += block.repeat_duration_minutes * 60 * 1000;
            } else {
                // Run once
                totalMs += blockDurationMs;
            }
        });

        return totalMs / 60000; // Convert to minutes
    }

    // Helper: Find longest program duration across all LEDs
    function findLongestProgramDuration() {
        let maxDuration = 0;
        for (const ledKey in State.programData) {
            const duration = calculateLedProgramDuration(State.programData[ledKey]);
            if (duration > maxDuration) maxDuration = duration;
        }
        return maxDuration;
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

        const h = parseInt(document.getElementById('run-time-hours').value) || 0;
        const m = parseInt(document.getElementById('run-time-minutes').value) || 0;
        const s = parseInt(document.getElementById('run-time-seconds').value) || 0;
        const totalMinutes = parseFloat(((h * 60) + m + (s / 60)).toFixed(4));

        // Validation: Check if longest program exceeds total duration
        const longestProgramMinutes = findLongestProgramDuration();

        if (longestProgramMinutes > totalMinutes) {
            const longestHours = Math.floor(longestProgramMinutes / 60);
            const longestMins = Math.floor(longestProgramMinutes % 60);
            const longestSecs = Math.round((longestProgramMinutes % 1) * 60);

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

                // Recalculate with new values
                const adjustedTotal = parseFloat(((longestHours * 60) + longestMins + (longestSecs / 60)).toFixed(4));
                performExport(adjustedTotal);
                return;
            }
        }

        performExport(totalMinutes);
    }

    function performExport(totalMinutes) {
        const exportData = { ...State.programData, total_duration_minutes: totalMinutes };
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

    function loadProgram(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const loaded = JSON.parse(e.target.result);
                const totalMinutes = loaded.total_duration_minutes || 0;
                delete loaded.total_duration_minutes;

                // Convert and load
                for (const ledKey in loaded) {
                    const ledData = loaded[ledKey];

                    if (Array.isArray(ledData)) {
                        // Legacy format
                        State.programData[ledKey] = {
                            blocks: [{
                                id: 'block0',
                                steps: ledData,
                                repeat_duration_minutes: null,
                                repeat_count: null
                            }]
                        };
                    } else if (ledData?.blocks) {
                        State.programData[ledKey] = ledData;
                    } else {
                        State.programData[ledKey] = { blocks: [] };
                    }
                }

                // Ensure all LEDs exist
                for (let i = 0; i < NUM_LEDS; i++) {
                    if (!State.programData[`LED${i}`]) {
                        State.programData[`LED${i}`] = { blocks: [] };
                    }
                }

                // Update duration
                const totalSeconds = Math.round(totalMinutes * 60);
                document.getElementById('run-time-hours').value = Math.floor(totalSeconds / 3600);
                document.getElementById('run-time-minutes').value = Math.floor((totalSeconds % 3600) / 60);
                document.getElementById('run-time-seconds').value = totalSeconds % 60;

                State.currentblockIndex = 0;
                updateAllLedProgramIndicators();
                updateblockSelector();
                renderTimeline();

                alert('Loaded successfully!');
            } catch (err) {
                alert('Error loading: ' + err.message);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    // ==========================================
    // EVENT HANDLERS
    // ==========================================
    function initEventHandlers() {
        // Step type buttons
        document.querySelectorAll('.step-type-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.step-type-btn').forEach(b => b.classList.remove('is-selected'));
                btn.classList.add('is-selected');
                State.currentStepType = btn.dataset.value;
                updateStepParams();
            });
        });

        // LED actions
        document.getElementById('select-all-btn')?.addEventListener('click', () => {
            for (let i = 0; i < NUM_LEDS; i++) State.selectedLedIndices.add(i);
            State.currentlyViewedLedIndex = 0;
            updateLedAppearances();
            updateblockSelector();
            renderTimeline();
        });

        document.getElementById('select-none-btn')?.addEventListener('click', () => {
            State.selectedLedIndices.clear();
            updateLedAppearances();
        });

        document.getElementById('clear-selected-btn')?.addEventListener('click', () => {
            if (State.selectedLedIndices.size === 0) {
                alert('Select LEDs first.');
                return;
            }
            if (!confirm(`Clear all data for ${State.selectedLedIndices.size} LEDs?`)) return;

            State.selectedLedIndices.forEach(idx => {
                State.programData[`LED${idx}`] = { blocks: [] };
            });
            State.currentblockIndex = 0;
            updateAllLedProgramIndicators();
            updateblockSelector();
            renderTimeline();
        });

        // block management
        document.getElementById('block-selector')?.addEventListener('change', (e) => {
            State.currentblockIndex = parseInt(e.target.value) || 0;
            updateblockConfigUI();
            renderTimeline();
        });

        document.getElementById('add-block-btn')?.addEventListener('click', addblock);
        document.getElementById('remove-block-btn')?.addEventListener('click', removeblock);

        // block config
        document.getElementById('block-name-input')?.addEventListener('blur', saveblockConfig);
        document.getElementById('repeat-count-input')?.addEventListener('blur', saveblockConfig);
        document.getElementById('repeat-duration-input')?.addEventListener('blur', saveblockConfig);

        document.querySelectorAll('.repeat-mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.repeat-mode-btn').forEach(b => b.classList.remove('is-selected'));
                btn.classList.add('is-selected');

                const mode = btn.dataset.mode;
                document.getElementById('repeat-count-field').style.display = mode === 'count' ? 'flex' : 'none';
                document.getElementById('repeat-duration-field').style.display = mode === 'duration' ? 'flex' : 'none';

                saveblockConfig();
            });
        });

        // Add step
        document.getElementById('add-step-btn')?.addEventListener('click', addStep);

        // File I/O
        document.getElementById('load-btn')?.addEventListener('click', () => {
            document.getElementById('file-input').click();
        });
        document.getElementById('file-input')?.addEventListener('change', loadProgram);
        document.getElementById('export-btn')?.addEventListener('click', exportProgram);
    }

    // ==========================================
    // INIT
    // ==========================================
    initState();
    initLedGrid();
    initEventHandlers();
    updateStepParams();
    renderTimeline();
    updateblockSelector();
});

