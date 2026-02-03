document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // STATE
    // ==========================================
    const NUM_LEDS = 24;
    const State = {
        programData: {},
        selectedLedIndices: new Set(),
        currentlyViewedLedIndex: null,
        currentChunkIndex: 0,
        currentStepType: 'ON',
    };

    function initState() {
        for (let i = 0; i < NUM_LEDS; i++) {
            State.programData[`LED${i}`] = {
                chunks: [{
                    id: 'chunk0',
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
        const chunks = ledData?.chunks || [];

        if (chunks.length === 0) {
            timeline.innerHTML = '<span class="timeline-empty">No chunks. Click "+ Add Chunk" to begin.</span>';
            return;
        }

        // Render ALL chunks with visual grouping
        chunks.forEach((chunk, chunkIdx) => {
            const chunkGroup = document.createElement('div');
            chunkGroup.className = 'chunk-group';
            chunkGroup.dataset.chunkIndex = chunkIdx;
            if (chunkIdx === State.currentChunkIndex) chunkGroup.classList.add('active');

            // Chunk label
            const chunkLabel = document.createElement('div');
            chunkLabel.className = 'chunk-label';
            let repeatInfo = '';
            if (chunk.repeat_count) repeatInfo = ` • ${chunk.repeat_count}x`;
            else if (chunk.repeat_duration_minutes) repeatInfo = ` • ${chunk.repeat_duration_minutes}min`;
            chunkLabel.textContent = `${chunk.id || `Chunk ${chunkIdx + 1}`}${repeatInfo}`;
            chunkGroup.appendChild(chunkLabel);

            const stepsContainer = document.createElement('div');
            stepsContainer.className = 'chunk-steps';
            stepsContainer.dataset.chunkIndex = chunkIdx;

            const steps = chunk.steps || [];
            if (steps.length === 0) {
                const emptyMsg = document.createElement('span');
                emptyMsg.className = 'timeline-empty';
                emptyMsg.textContent = 'Empty chunk';
                stepsContainer.appendChild(emptyMsg);
            } else {
                steps.forEach((step, stepIdx) => {
                    const pill = document.createElement('div');
                    pill.className = `step-pill type-${step.type.toLowerCase()}`;
                    pill.dataset.chunkIndex = chunkIdx;
                    pill.dataset.stepIndex = stepIdx;

                    let details = '';
                    if (step.type === 'ON') details = `${step.duration_ms}ms @ ${step.int}`;
                    else if (step.type === 'OFF') details = `${step.duration_ms}ms`;
                    else if (step.type === 'RAMP') details = `${step.duration_ms}ms: ${step.int0}→${step.int1}`;
                    else if (step.type === 'SINE') details = `${step.duration_ms}ms: ${step.freq}Hz`;

                    pill.innerHTML = `
                        <span>${step.type}</span>
                        <span style="opacity:0.7; font-size:0.65rem;">${details}</span>
                        <button class="delete-step" data-chunk-index="${chunkIdx}" data-step-index="${stepIdx}" title="Remove"><i class="fas fa-times"></i></button>
                    `;
                    stepsContainer.appendChild(pill);
                });
            }

            chunkGroup.appendChild(stepsContainer);
            timeline.appendChild(chunkGroup);

            // Click handler to select chunk
            chunkGroup.addEventListener('click', (e) => {
                if (!e.target.classList.contains('delete-step') && !e.target.closest('.delete-step')) {
                    State.currentChunkIndex = chunkIdx;
                    updateChunkSelector();
                    renderTimeline();
                }
            });
        });

        // Delete handlers
        timeline.querySelectorAll('.delete-step').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const chunkIdx = parseInt(btn.dataset.chunkIndex);
                const stepIdx = parseInt(btn.dataset.stepIndex);
                chunks[chunkIdx].steps.splice(stepIdx, 1);
                renderTimeline();
                updateAllLedProgramIndicators();
            });
        });

        // Sortable only on current chunk
        const currentChunkStepsContainer = timeline.querySelector(`.chunk-steps[data-chunk-index="${State.currentChunkIndex}"]`);
        if (currentChunkStepsContainer && chunks[State.currentChunkIndex]?.steps?.length > 0) {
            timelineSortableInstance = Sortable.create(currentChunkStepsContainer, {
                animation: 150,
                filter: '.delete-step',
                onEnd: (evt) => {
                    if (evt.oldIndex === evt.newIndex) return;
                    const [moved] = chunks[State.currentChunkIndex].steps.splice(evt.oldIndex, 1);
                    chunks[State.currentChunkIndex].steps.splice(evt.newIndex, 0, moved);
                }
            });
        }
    }

    // ==========================================
    // CHUNK MANAGER
    // ==========================================
    function updateChunkSelector() {
        const selector = document.getElementById('chunk-selector');
        const chunkLedLabel = document.getElementById('chunk-led-label');

        if (!selector) return;
        selector.innerHTML = '';

        if (chunkLedLabel) {
            if (State.selectedLedIndices.size === 0) {
                chunkLedLabel.textContent = '';
            } else if (State.selectedLedIndices.size === 1) {
                const ledNum = [...State.selectedLedIndices][0] + 1;
                chunkLedLabel.textContent = `(LED ${ledNum})`;
            } else {
                // Multiple LEDs selected - format nicely
                const sorted = [...State.selectedLedIndices].sort((a, b) => a - b);
                const ledNums = sorted.map(i => i + 1);

                // Check if consecutive
                const isConsecutive = sorted.every((val, idx) =>
                    idx === 0 || val === sorted[idx - 1] + 1
                );

                if (isConsecutive && ledNums.length > 2) {
                    chunkLedLabel.textContent = `(LEDs ${ledNums[0]}-${ledNums[ledNums.length - 1]})`;
                } else if (ledNums.length <= 5) {
                    chunkLedLabel.textContent = `(LEDs ${ledNums.join(', ')})`;
                } else {
                    chunkLedLabel.textContent = `(${ledNums.length} LEDs selected)`;
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
        const chunks = ledData?.chunks || [];

        if (chunks.length === 0) {
            const opt = document.createElement('option');
            opt.textContent = 'No chunks';
            selector.appendChild(opt);
            return;
        }

        chunks.forEach((chunk, i) => {
            const opt = document.createElement('option');
            let repeatInfo = '';
            if (chunk.repeat_count) repeatInfo = ` (${chunk.repeat_count}x)`;
            else if (chunk.repeat_duration_minutes) repeatInfo = ` (${chunk.repeat_duration_minutes}min)`;
            opt.value = i;
            opt.textContent = `${chunk.id || `Chunk ${i + 1}`}${repeatInfo}`;
            if (i === State.currentChunkIndex) opt.selected = true;
            selector.appendChild(opt);
        });

        // Update chunk config UI
        updateChunkConfigUI();
    }

    function updateChunkConfigUI() {
        const ledData = State.programData[`LED${State.currentlyViewedLedIndex}`];
        const chunks = ledData?.chunks || [];
        if (chunks.length === 0 || State.currentChunkIndex >= chunks.length) return;

        const chunk = chunks[State.currentChunkIndex];

        document.getElementById('chunk-name-input').value = chunk.id || '';

        // Update repeat mode buttons
        document.querySelectorAll('.repeat-mode-btn').forEach(btn => {
            btn.classList.remove('is-selected');
        });

        let mode = 'once';
        if (chunk.repeat_count) mode = 'count';
        else if (chunk.repeat_duration_minutes) mode = 'duration';

        document.querySelector(`.repeat-mode-btn[data-mode="${mode}"]`)?.classList.add('is-selected');

        document.getElementById('repeat-count-field').style.display = mode === 'count' ? 'flex' : 'none';
        document.getElementById('repeat-duration-field').style.display = mode === 'duration' ? 'flex' : 'none';

        if (mode === 'count') {
            document.getElementById('repeat-count-input').value = chunk.repeat_count || 10;
        } else if (mode === 'duration') {
            document.getElementById('repeat-duration-input').value = chunk.repeat_duration_minutes || 1;
        }
    }

    function saveChunkConfig() {
        if (State.currentlyViewedLedIndex === null) return;

        const ledData = State.programData[`LED${State.currentlyViewedLedIndex}`];
        const chunks = ledData?.chunks || [];
        if (chunks.length === 0 || State.currentChunkIndex >= chunks.length) return;

        const chunkName = document.getElementById('chunk-name-input').value.trim();
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
            if (!targetLedData?.chunks || State.currentChunkIndex >= targetLedData.chunks.length) return;

            const targetChunk = targetLedData.chunks[State.currentChunkIndex];
            targetChunk.id = chunkName || `chunk${State.currentChunkIndex}`;
            targetChunk.repeat_count = repeat_count;
            targetChunk.repeat_duration_minutes = repeat_duration_minutes;
        });

        updateChunkSelector();
    }

    function addChunk() {
        if (State.selectedLedIndices.size === 0) {
            alert('Select LEDs first.');
            return;
        }

        State.selectedLedIndices.forEach(idx => {
            const ledData = State.programData[`LED${idx}`];
            const newChunk = {
                id: `chunk${ledData.chunks.length}`,
                steps: [],
                repeat_duration_minutes: null,
                repeat_count: null
            };
            ledData.chunks.push(newChunk);
        });

        if (State.currentlyViewedLedIndex !== null) {
            const ledData = State.programData[`LED${State.currentlyViewedLedIndex}`];
            State.currentChunkIndex = ledData.chunks.length - 1;
        }

        updateChunkSelector();
        renderTimeline();
        updateAllLedProgramIndicators();
    }

    function removeChunk() {
        if (State.currentlyViewedLedIndex === null) return;

        const ledData = State.programData[`LED${State.currentlyViewedLedIndex}`];
        if (!ledData.chunks || ledData.chunks.length === 0) return;

        if (!confirm(`Remove chunk ${State.currentChunkIndex + 1}?`)) return;

        ledData.chunks.splice(State.currentChunkIndex, 1);
        if (State.currentChunkIndex >= ledData.chunks.length) {
            State.currentChunkIndex = Math.max(0, ledData.chunks.length - 1);
        }

        updateChunkSelector();
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
        State.currentChunkIndex = 0;

        updateLedAppearances();
        updateChunkSelector();
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

            // Only show has-program if there's at least one step in any chunk
            let hasProgram = false;
            if (ledData?.chunks) {
                for (const chunk of ledData.chunks) {
                    if (chunk.steps && chunk.steps.length > 0) {
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

        // Check all selected LEDs have chunks
        for (const idx of State.selectedLedIndices) {
            const ledData = State.programData[`LED${idx}`];
            if (!ledData.chunks || ledData.chunks.length === 0) {
                alert(`LED ${idx + 1} has no chunks. Add a chunk first.`);
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
            const chunk = ledData.chunks[State.currentChunkIndex];
            if (chunk) {
                chunk.steps.push({ ...step });
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
        if (!ledData?.chunks || ledData.chunks.length === 0) return 0;

        let totalMs = 0;

        ledData.chunks.forEach(chunk => {
            const steps = chunk.steps || [];
            const chunkDurationMs = steps.reduce((sum, step) => sum + (step.duration_ms || 0), 0);

            if (chunk.repeat_count) {
                totalMs += chunkDurationMs * chunk.repeat_count;
            } else if (chunk.repeat_duration_minutes) {
                totalMs += chunk.repeat_duration_minutes * 60 * 1000;
            } else {
                // Run once
                totalMs += chunkDurationMs;
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
            if (State.programData[ledKey].chunks?.length > 0) {
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
                            chunks: [{
                                id: 'chunk0',
                                steps: ledData,
                                repeat_duration_minutes: null,
                                repeat_count: null
                            }]
                        };
                    } else if (ledData?.chunks) {
                        State.programData[ledKey] = ledData;
                    } else {
                        State.programData[ledKey] = { chunks: [] };
                    }
                }

                // Ensure all LEDs exist
                for (let i = 0; i < NUM_LEDS; i++) {
                    if (!State.programData[`LED${i}`]) {
                        State.programData[`LED${i}`] = { chunks: [] };
                    }
                }

                // Update duration
                const totalSeconds = Math.round(totalMinutes * 60);
                document.getElementById('run-time-hours').value = Math.floor(totalSeconds / 3600);
                document.getElementById('run-time-minutes').value = Math.floor((totalSeconds % 3600) / 60);
                document.getElementById('run-time-seconds').value = totalSeconds % 60;

                State.currentChunkIndex = 0;
                updateAllLedProgramIndicators();
                updateChunkSelector();
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
            updateChunkSelector();
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
                State.programData[`LED${idx}`] = { chunks: [] };
            });
            State.currentChunkIndex = 0;
            updateAllLedProgramIndicators();
            updateChunkSelector();
            renderTimeline();
        });

        // Chunk management
        document.getElementById('chunk-selector')?.addEventListener('change', (e) => {
            State.currentChunkIndex = parseInt(e.target.value) || 0;
            updateChunkConfigUI();
            renderTimeline();
        });

        document.getElementById('add-chunk-btn')?.addEventListener('click', addChunk);
        document.getElementById('remove-chunk-btn')?.addEventListener('click', removeChunk);

        // Chunk config
        document.getElementById('chunk-name-input')?.addEventListener('blur', saveChunkConfig);
        document.getElementById('repeat-count-input')?.addEventListener('blur', saveChunkConfig);
        document.getElementById('repeat-duration-input')?.addEventListener('blur', saveChunkConfig);

        document.querySelectorAll('.repeat-mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.repeat-mode-btn').forEach(b => b.classList.remove('is-selected'));
                btn.classList.add('is-selected');

                const mode = btn.dataset.mode;
                document.getElementById('repeat-count-field').style.display = mode === 'count' ? 'flex' : 'none';
                document.getElementById('repeat-duration-field').style.display = mode === 'duration' ? 'flex' : 'none';

                saveChunkConfig();
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
    updateChunkSelector();
});
