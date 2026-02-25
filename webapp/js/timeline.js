(function initTimelineModule(global) {
    const App = global.App;
    const State = App.state;
    const Runtime = App.runtime;
    const fn = App.fn;

    function pushHistory() {
        return fn.pushHistory();
    }

    function loadStepForEditing(stepIdx) {
        return fn.loadStepForEditing(stepIdx);
    }

    function updateAllLedProgramIndicators() {
        return fn.updateAllLedProgramIndicators();
    }
function renderTimeline() {
    const timeline = document.getElementById('timeline-display');
    const timelineLabel = document.getElementById('timeline-label');
    if (!timeline) {
        if (fn.updateTotalDurationAvailability) fn.updateTotalDurationAvailability();
        return;
    }

    if (fn.updateTotalDurationAvailability) fn.updateTotalDurationAvailability();

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
    if (Runtime.timelineSortableInstance) {
        Runtime.timelineSortableInstance.destroy();
        Runtime.timelineSortableInstance = null;
    }
    if (Runtime.blockSortableInstance) {
        Runtime.blockSortableInstance.destroy();
        Runtime.blockSortableInstance = null;
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
        if (block.repeat_continuous) repeatInfo = ' • ∞';
        else if (block.repeat_count) repeatInfo = ` • ${block.repeat_count}x`;
        else if (block.repeat_duration_minutes) repeatInfo = ` • ${formatDurationMinutesToClock(block.repeat_duration_minutes)}`;
        blockLabel.innerHTML = `
            <span>${block.id || `block ${blockIdx + 1}`}${repeatInfo}</span>
            <button class="delete-block-btn" data-block-index="${blockIdx}" title="Remove Block">
                <i class="fas fa-times"></i>
            </button>
        `;
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

                if (State.editingStepIndex === stepIdx && State.currentblockIndex === blockIdx) {
                    pill.classList.add('editing');
                }

                pill.innerHTML = `
                    <span>${step.type}</span>
                    <span style="opacity:0.7; font-size:0.65rem;">${details}</span>
                    <button class="delete-step" data-block-index="${blockIdx}" data-step-index="${stepIdx}" title="Remove"><i class="fas fa-times"></i></button>
                `;

                pill.addEventListener('click', (e) => {
                    if (!e.target.classList.contains('delete-step') && !e.target.closest('.delete-step')) {
                        // Step click should also focus its parent block.
                        State.currentblockIndex = blockIdx;
                        updateblockSelector();
                        loadStepForEditing(stepIdx);
                        e.stopPropagation();
                    }
                });

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

            pushHistory(); // Undo point before delete

            const blockIdx = parseInt(btn.dataset.blockIndex);
            const stepIdx = parseInt(btn.dataset.stepIndex);

            // Apply to ALL selected LEDs (Batch delete step)
            State.selectedLedIndices.forEach(ledIdx => {
                const targetLedData = State.programData[`LED${ledIdx}`];
                // Ensure the block and step exist for this LED
                if (targetLedData?.blocks && targetLedData.blocks[blockIdx]?.steps) {
                    targetLedData.blocks[blockIdx].steps.splice(stepIdx, 1);
                }
            });

            renderTimeline();
            updateAllLedProgramIndicators();
        });
    });

    // Delete Block Handlers
    timeline.querySelectorAll('.delete-block-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const blockIdx = parseInt(btn.dataset.blockIndex);
            // Call global wrapper or method? removeBlock is defined in outer scope.
            removeblock(blockIdx);
        });
    });

    // Sortable only on current block
    const currentblockStepsContainer = timeline.querySelector(`.block-steps[data-block-index="${State.currentblockIndex}"]`);
    if (currentblockStepsContainer && blocks[State.currentblockIndex]?.steps?.length > 0) {
        Runtime.timelineSortableInstance = Sortable.create(currentblockStepsContainer, {
            animation: 150,
            filter: '.delete-step',
            onEnd: (evt) => {
                if (evt.oldIndex === evt.newIndex) return;
                pushHistory();
                const [moved] = blocks[State.currentblockIndex].steps.splice(evt.oldIndex, 1);
                blocks[State.currentblockIndex].steps.splice(evt.newIndex, 0, moved);
            }
        });
    }

    // Sortable for BLOCKS (NEW)
    if (blocks.length > 1) {
        Runtime.blockSortableInstance = Sortable.create(timeline, {
            animation: 150,
            handle: '.block-label', // Drag by header only
            filter: '.delete-block-btn',
            onEnd: (evt) => {
                if (evt.oldIndex === evt.newIndex) return;

                pushHistory();

                // Apply reorder to ALL selected LEDs
                State.selectedLedIndices.forEach(ledIdx => {
                    const targetLedData = State.programData[`LED${ledIdx}`];
                    if (targetLedData?.blocks && targetLedData.blocks.length > evt.oldIndex) {
                        // Ensure enough blocks exist to swap (basic safety)
                        const [movedBlock] = targetLedData.blocks.splice(evt.oldIndex, 1);
                        // Careful with index bounds if arrays differ, but assuming batch symmetry:
                        targetLedData.blocks.splice(evt.newIndex, 0, movedBlock);
                    }
                });

                // Update State.currentblockIndex if we moved the active block check
                // If active block was at oldIndex, it's now at newIndex.
                // If active was between old and new, it shifted.
                // Simplest approach: Map the index. 
                if (State.currentblockIndex === evt.oldIndex) {
                    State.currentblockIndex = evt.newIndex;
                } else if (State.currentblockIndex > evt.oldIndex && State.currentblockIndex <= evt.newIndex) {
                    // Block moved from left to right, passing current. Current shifts left (-1).
                    State.currentblockIndex--;
                } else if (State.currentblockIndex < evt.oldIndex && State.currentblockIndex >= evt.newIndex) {
                    // Block moved from right to left, passing current. Current shifts right (+1).
                    State.currentblockIndex++;
                }

                // Re-render to ensure DOM indices match data
                updateblockSelector();
                // renderTimeline(); // Sortable moved DOM, but we want full refresh to be clean
                // Actually, if we don't re-render, the data-index attributes on other blocks are WRONG.
                // So we MUST re-render.
                renderTimeline();
                updateAllLedProgramIndicators();
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
        if (block.repeat_continuous) repeatInfo = ' (∞)';
        else if (block.repeat_count) repeatInfo = ` (${block.repeat_count}x)`;
        else if (block.repeat_duration_minutes) repeatInfo = ` (${formatDurationMinutesToClock(block.repeat_duration_minutes)})`;
        opt.value = i;
        opt.textContent = `${block.id || `block ${i + 1}`}${repeatInfo}`;
        if (i === State.currentblockIndex) opt.selected = true;
        selector.appendChild(opt);
    });

    // Update block config UI
    updateblockConfigUI();
}

function padDurationValue(val) {
    return `${Math.max(0, parseInt(val, 10) || 0)}`.padStart(2, '0');
}

function formatDurationMinutesToClock(totalMinutes) {
    const totalSeconds = Math.max(0, Math.round((parseFloat(totalMinutes) || 0) * 60));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${padDurationValue(hours)}:${padDurationValue(minutes)}:${padDurationValue(seconds)}`;
}

function setBlockDurationPickerFromMinutes(totalMinutes) {
    const hoursEl = document.getElementById('repeat-duration-hours');
    const minutesEl = document.getElementById('repeat-duration-minutes');
    const secondsEl = document.getElementById('repeat-duration-seconds');
    const displayEl = document.getElementById('repeat-duration-display');
    const hiddenEl = document.getElementById('repeat-duration-input');
    if (!hoursEl || !minutesEl || !secondsEl || !displayEl || !hiddenEl) return;

    const safeMinutes = Math.max(0, parseFloat(totalMinutes) || 0);
    const totalSeconds = Math.round(safeMinutes * 60);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    hoursEl.value = hours;
    minutesEl.value = minutes;
    secondsEl.value = seconds;
    hiddenEl.value = safeMinutes;

    displayEl.textContent = `${padDurationValue(hours)} : ${padDurationValue(minutes)} : ${padDurationValue(seconds)}`;
}

function syncBlockDurationPickerFromFields() {
    const hoursEl = document.getElementById('repeat-duration-hours');
    const minutesEl = document.getElementById('repeat-duration-minutes');
    const secondsEl = document.getElementById('repeat-duration-seconds');
    if (!hoursEl || !minutesEl || !secondsEl) return 0;

    let hours = Math.max(0, parseInt(hoursEl.value, 10) || 0);
    let minutes = Math.max(0, Math.min(59, parseInt(minutesEl.value, 10) || 0));
    let seconds = Math.max(0, Math.min(59, parseInt(secondsEl.value, 10) || 0));

    hoursEl.value = hours;
    minutesEl.value = minutes;
    secondsEl.value = seconds;

    const totalMinutes = (hours * 60) + minutes + (seconds / 60);
    setBlockDurationPickerFromMinutes(totalMinutes);
    return totalMinutes;
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
    if (block.repeat_continuous) mode = 'continuous';
    else if (block.repeat_count) mode = 'count';
    else if (block.repeat_duration_minutes) mode = 'duration';

    document.querySelector(`.repeat-mode-btn[data-mode="${mode}"]`)?.classList.add('is-selected');

    document.getElementById('repeat-count-field').style.display = mode === 'count' ? 'flex' : 'none';
    document.getElementById('repeat-duration-field').style.display = mode === 'duration' ? 'flex' : 'none';

    if (mode === 'count') {
        document.getElementById('repeat-count-input').value = block.repeat_count || 10;
    } else if (mode === 'duration') {
        setBlockDurationPickerFromMinutes(block.repeat_duration_minutes ?? 1);
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
    let repeat_continuous = false;

    if (selectedMode === 'count') {
        repeat_count = Math.max(1, parseInt(document.getElementById('repeat-count-input').value) || 1);
    } else if (selectedMode === 'duration') {
        repeat_duration_minutes = syncBlockDurationPickerFromFields();
    } else if (selectedMode === 'continuous') {
        repeat_continuous = true;
    }

    pushHistory();

    // Apply to ALL selected LEDs
    State.selectedLedIndices.forEach(ledIdx => {
        const targetLedData = State.programData[`LED${ledIdx}`];
        if (!targetLedData?.blocks || State.currentblockIndex >= targetLedData.blocks.length) return;

        const targetblock = targetLedData.blocks[State.currentblockIndex];
        targetblock.id = blockName || `block${State.currentblockIndex}`;
        targetblock.repeat_count = repeat_count;
        targetblock.repeat_duration_minutes = repeat_duration_minutes;
        targetblock.repeat_continuous = repeat_continuous;
    });

    updateblockSelector();
    renderTimeline();
}

function addblock() {
    if (State.selectedLedIndices.size === 0) {
        alert('Select LEDs first.');
        return;
    }

    pushHistory();

    State.selectedLedIndices.forEach(idx => {
        const ledData = State.programData[`LED${idx}`];
        const newblock = {
            id: `block${ledData.blocks.length}`,
            steps: [],
            repeat_duration_minutes: null,
            repeat_count: null,
            repeat_continuous: true
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

function removeblock(targetBlockIdx = null) {
    if (State.currentlyViewedLedIndex === null) return;

    const ledData = State.programData[`LED${State.currentlyViewedLedIndex}`];
    if (!ledData.blocks || ledData.blocks.length === 0) return;

    // If no index provided, use current (from button)
    const idxToRemove = targetBlockIdx !== null ? targetBlockIdx : State.currentblockIndex;

    if (!confirm(`Remove block ${idxToRemove + 1} from all ${State.selectedLedIndices.size} selected LEDs?`)) return;

    pushHistory();

    // Apply to ALL selected LEDs (Batch delete block)
    State.selectedLedIndices.forEach(ledIdx => {
        const targetLedData = State.programData[`LED${ledIdx}`];
        if (targetLedData?.blocks && targetLedData.blocks.length > idxToRemove) {
            targetLedData.blocks.splice(idxToRemove, 1);
        }
    });

    // Adjust current selection if needed for the VIEWED LED
    const blocksAfter = State.programData[`LED${State.currentlyViewedLedIndex}`]?.blocks || [];
    if (State.currentblockIndex >= blocksAfter.length) {
        State.currentblockIndex = Math.max(0, blocksAfter.length - 1);
    } else if (idxToRemove < State.currentblockIndex) {
        // If we removed a block *before* the current one, decrement index
        State.currentblockIndex--;
    }

    updateblockSelector();
    renderTimeline();
    updateAllLedProgramIndicators();
}

    fn.renderTimeline = renderTimeline;
    fn.updateblockSelector = updateblockSelector;
    fn.updateblockConfigUI = updateblockConfigUI;
    fn.saveblockConfig = saveblockConfig;
    fn.addblock = addblock;
    fn.removeblock = removeblock;
    fn.setBlockDurationPickerFromMinutes = setBlockDurationPickerFromMinutes;
    fn.syncBlockDurationPickerFromFields = syncBlockDurationPickerFromFields;
    fn.formatDurationMinutesToClock = formatDurationMinutesToClock;
})(window);
