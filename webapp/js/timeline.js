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

    function updateLedAppearances() {
        return fn.updateLedAppearances ? fn.updateLedAppearances() : undefined;
    }

    function updateBatchIndicator() {
        return fn.updateBatchIndicator ? fn.updateBatchIndicator() : undefined;
    }

    function showTopToast(message) {
        return fn.showTopToast ? fn.showTopToast(message) : undefined;
    }

    function ensureBlockSelectionContext() {
        if (State.blockSelectionLedIndex !== State.currentlyViewedLedIndex) {
            State.selectedBlockIndices = new Set();
            State.blockSelectionLedIndex = State.currentlyViewedLedIndex;
        }
    }

    function getSortedSelectedBlockIndices() {
        ensureBlockSelectionContext();
        return [...State.selectedBlockIndices].sort((a, b) => a - b);
    }

    function setSelectedBlocks(indices) {
        State.selectedBlockIndices = new Set(indices);
        State.blockSelectionLedIndex = State.currentlyViewedLedIndex;
    }

    function clearSelectedBlocks() {
        State.selectedBlockIndices = new Set();
        State.blockSelectionLedIndex = State.currentlyViewedLedIndex;
    }

    function buildBlockPayload(blockIndices) {
        if (State.currentlyViewedLedIndex === null) return null;
        const ledData = State.programData[`LED${State.currentlyViewedLedIndex}`];
        const blocks = ledData?.blocks || [];
        const validIndices = blockIndices.filter(i => i >= 0 && i < blocks.length);
        if (validIndices.length === 0) return null;

        const payload = {
            sourceLedIndex: State.currentlyViewedLedIndex,
            blockIndices: [...validIndices],
            blocks: validIndices.map(i => JSON.parse(JSON.stringify(blocks[i]))),
        };
        return payload;
    }

    function copySelectedBlocks() {
        const selected = getSortedSelectedBlockIndices();
        if (selected.length === 0) return false;

        const payload = buildBlockPayload(selected);
        if (!payload) return false;

        State.blockClipboard = payload;
        Runtime.blockDragPayload = payload;
        State.lastCopyKind = 'block';
        showTopToast('copy');
        return true;
    }

    function getBlockClipboardPayload() {
        if (!State.blockClipboard) return null;
        return JSON.parse(JSON.stringify(State.blockClipboard));
    }

    function applyBlockPayloadToLed(ledIndex, payload = null) {
        const sourcePayload = payload || Runtime.blockDragPayload || State.blockClipboard;
        if (!sourcePayload?.blocks?.length) return false;

        pushHistory();

        const ledKey = `LED${ledIndex}`;
        if (!State.programData[ledKey]) {
            State.programData[ledKey] = { blocks: [] };
        }
        if (!Array.isArray(State.programData[ledKey].blocks)) {
            State.programData[ledKey].blocks = [];
        }

        const targetBlocks = State.programData[ledKey].blocks;
        const insertStart = targetBlocks.length;
        const inserted = sourcePayload.blocks.map(block => JSON.parse(JSON.stringify(block)));
        targetBlocks.push(...inserted);

        State.selectedLedIndices = new Set([ledIndex]);
        State.currentlyViewedLedIndex = ledIndex;
        State.currentblockIndex = insertStart;
        State.selectedBlockIndices = new Set(inserted.map((_, idx) => insertStart + idx));
        State.blockSelectionLedIndex = ledIndex;
        Runtime.blockDragPayload = JSON.parse(JSON.stringify(sourcePayload));
        State.blockClipboard = JSON.parse(JSON.stringify(sourcePayload));

        updateLedAppearances();
        updateBatchIndicator();
        updateAllLedProgramIndicators();
        updateblockSelector();
        renderTimeline();
        return true;
    }

    function ensureBlockSelectionBox(timeline) {
        if (!Runtime.blockSelectDrag) {
            Runtime.blockSelectDrag = {
                active: false,
                hasMoved: false,
                ignoreClick: false,
                startX: 0,
                startY: 0,
                additive: false,
                originSelection: new Set(),
                boxEl: null,
                bound: false,
            };
        }

        if (Runtime.blockSelectDrag.boxEl && Runtime.blockSelectDrag.boxEl.parentElement !== timeline) {
            Runtime.blockSelectDrag.boxEl = null;
        }

        if (!Runtime.blockSelectDrag.boxEl) {
            const box = document.createElement('div');
            box.className = 'block-drag-select-box';
            timeline.appendChild(box);
            Runtime.blockSelectDrag.boxEl = box;
        }
    }

    function updateBlockSelectionByRect(timeline, rect) {
        const drag = Runtime.blockSelectDrag;
        const nextSelection = drag.additive ? new Set(drag.originSelection) : new Set();

        timeline.querySelectorAll('.block-group').forEach(group => {
            const groupRect = group.getBoundingClientRect();
            const intersects =
                rect.left <= groupRect.right &&
                rect.right >= groupRect.left &&
                rect.top <= groupRect.bottom &&
                rect.bottom >= groupRect.top;

            if (intersects) {
                const idx = parseInt(group.dataset.blockIndex, 10);
                nextSelection.add(idx);
            }
        });

        setSelectedBlocks(nextSelection);
        timeline.querySelectorAll('.block-group').forEach(group => {
            const idx = parseInt(group.dataset.blockIndex, 10);
            group.classList.toggle('multi-selected', State.selectedBlockIndices.has(idx));
        });
    }

    function ensureTimelineBlockSelectionHandlers(timeline) {
        ensureBlockSelectionBox(timeline);
        const drag = Runtime.blockSelectDrag;
        if (drag.bound) return;
        drag.bound = true;

        timeline.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            if (!timeline.contains(e.target)) return;
            if (e.target.closest('.block-label, .delete-block-btn, .step-pill, .delete-step, .timeline-empty-state, .timeline-empty-inline')) return;

            ensureBlockSelectionBox(timeline);
            drag.active = true;
            drag.hasMoved = false;
            drag.startX = e.clientX;
            drag.startY = e.clientY;
            drag.additive = e.ctrlKey || e.metaKey;
            drag.originSelection = new Set(State.selectedBlockIndices);
            if (drag.boxEl) drag.boxEl.style.display = 'none';
        });

        timeline.addEventListener('pointermove', (e) => {
            if (!drag.active || !drag.boxEl) return;
            const dx = e.clientX - drag.startX;
            const dy = e.clientY - drag.startY;
            if (!drag.hasMoved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;

            drag.hasMoved = true;
            const minX = Math.min(drag.startX, e.clientX);
            const minY = Math.min(drag.startY, e.clientY);
            const maxX = Math.max(drag.startX, e.clientX);
            const maxY = Math.max(drag.startY, e.clientY);

            const timelineRect = timeline.getBoundingClientRect();
            drag.boxEl.style.left = `${minX - timelineRect.left}px`;
            drag.boxEl.style.top = `${minY - timelineRect.top}px`;
            drag.boxEl.style.width = `${maxX - minX}px`;
            drag.boxEl.style.height = `${maxY - minY}px`;
            drag.boxEl.style.display = 'block';

            e.preventDefault();
            updateBlockSelectionByRect(timeline, {
                left: minX,
                right: maxX,
                top: minY,
                bottom: maxY,
            });
        });

        window.addEventListener('pointerup', () => {
            if (!drag.active) return;
            drag.active = false;
            if (drag.boxEl) drag.boxEl.style.display = 'none';

            if (drag.hasMoved) {
                drag.ignoreClick = true;
                setTimeout(() => {
                    drag.ignoreClick = false;
                }, 0);
            }
        });
    }

    function getBlockRepeatMeta(block) {
        if (block.repeat_continuous) return { label: 'CONT', className: 'is-continuous' };
        if (block.repeat_count) return { label: `x${block.repeat_count}`, className: 'is-count' };
        if (block.repeat_duration_minutes) return { label: formatDurationMinutesToClock(block.repeat_duration_minutes), className: 'is-duration' };
        return { label: 'ONCE', className: 'is-once' };
    }

    function hasContinuousFlowRisk(blocks, blockIdx) {
        const current = blocks[blockIdx];
        if (!current?.repeat_continuous) return false;
        for (let i = blockIdx + 1; i < blocks.length; i++) {
            if (blocks[i]?.steps?.length) return true;
        }
        return false;
    }

    function remapBlockIndexAfterMove(index, oldIndex, newIndex) {
        if (index === oldIndex) return newIndex;
        if (oldIndex < newIndex && index > oldIndex && index <= newIndex) return index - 1;
        if (oldIndex > newIndex && index < oldIndex && index >= newIndex) return index + 1;
        return index;
    }

    function renderTimelineEmptyState(timeline, iconClass, title, subtitle) {
        timeline.innerHTML = `
            <div class="timeline-empty-state">
                <i class="${iconClass}" aria-hidden="true"></i>
                <div class="timeline-empty-copy">
                    <div class="timeline-empty-title">${title}</div>
                    <div class="timeline-empty-subtitle">${subtitle}</div>
                </div>
            </div>
        `;
    }

    function destroyTimelineSortables() {
        if (Array.isArray(Runtime.timelineSortableInstances)) {
            Runtime.timelineSortableInstances.forEach(instance => instance?.destroy?.());
            Runtime.timelineSortableInstances = [];
        }
        if (Runtime.timelineSortableInstance) {
            Runtime.timelineSortableInstance.destroy();
            Runtime.timelineSortableInstance = null;
        }
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
        ensureBlockSelectionContext();

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
        destroyTimelineSortables();
        if (Runtime.blockSortableInstance) {
            Runtime.blockSortableInstance.destroy();
            Runtime.blockSortableInstance = null;
        }

        // Check state
        if (State.currentlyViewedLedIndex === null) {
            clearSelectedBlocks();
            renderTimelineEmptyState(
                timeline,
                'fas fa-mouse-pointer',
                'Select LEDs to start',
                'Pick one or more LEDs to inspect and edit blocks.'
            );
            return;
        }

        const ledData = State.programData[`LED${State.currentlyViewedLedIndex}`];
        const blocks = ledData?.blocks || [];

        if (blocks.length === 0) {
            clearSelectedBlocks();
            renderTimelineEmptyState(
                timeline,
                'fas fa-layer-group',
                'No blocks yet',
                'Use + Add block to create your first sequence.'
            );
            return;
        }

        State.currentblockIndex = Math.max(0, Math.min(State.currentblockIndex, blocks.length - 1));
        const validSelected = getSortedSelectedBlockIndices().filter(idx => idx >= 0 && idx < blocks.length);
        if (validSelected.length !== State.selectedBlockIndices.size) {
            setSelectedBlocks(validSelected);
        }
        ensureTimelineBlockSelectionHandlers(timeline);

        // Render ALL blocks with visual grouping
        blocks.forEach((block, blockIdx) => {
            const blockGroup = document.createElement('div');
            blockGroup.className = 'block-group';
            blockGroup.dataset.blockIndex = blockIdx;
            if (blockIdx === State.currentblockIndex) blockGroup.classList.add('active');
            if (State.selectedBlockIndices.has(blockIdx)) blockGroup.classList.add('multi-selected');

            // block label
            const blockLabel = document.createElement('div');
            blockLabel.className = 'block-label';
            const repeatMeta = getBlockRepeatMeta(block);
            const flowRisk = hasContinuousFlowRisk(blocks, blockIdx);
            blockLabel.innerHTML = `
            <div class="block-label-content">
                <span class="block-title-text">${block.id || `block ${blockIdx + 1}`}</span>
                <div class="block-badge-row">
                    <span class="block-badge ${repeatMeta.className}">${repeatMeta.label}</span>
                    ${flowRisk ? '<span class="block-badge is-warning">FLOW RISK</span>' : ''}
                </div>
            </div>
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
                emptyMsg.className = 'timeline-empty-inline';
                emptyMsg.textContent = 'No steps yet';
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
                    else if (step.type === 'RAMP') details = `${step.duration_ms}ms: ${step.int0}->${step.int1}`;
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
                            if (Runtime.blockSelectDrag?.ignoreClick) return;
                            State.currentblockIndex = blockIdx;
                            setSelectedBlocks([blockIdx]);
                            updateblockSelector();
                            loadStepForEditing(stepIdx);
                            renderTimeline();
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
                if (Runtime.blockSelectDrag?.ignoreClick) return;
                if (
                    e.target.classList.contains('delete-step') ||
                    e.target.closest('.delete-step') ||
                    e.target.classList.contains('delete-block-btn') ||
                    e.target.closest('.delete-block-btn')
                ) return;

                State.currentblockIndex = blockIdx;
                if (e.ctrlKey || e.metaKey) {
                    const next = new Set(State.selectedBlockIndices);
                    if (next.has(blockIdx)) next.delete(blockIdx);
                    else next.add(blockIdx);
                    setSelectedBlocks(next);
                } else {
                    setSelectedBlocks([blockIdx]);
                }

                updateblockSelector();
                renderTimeline();
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

        // Sortable for STEPS in all blocks of the current LED (supports cross-block moves)
        Runtime.timelineSortableInstances = [];
        timeline.querySelectorAll('.block-steps').forEach(container => {
            const sortable = Sortable.create(container, {
                animation: 150,
                group: 'timeline-steps',
                draggable: '.step-pill',
                filter: '.delete-step',
                onStart: (evt) => {
                    const fromBlockIdx = parseInt(evt.from.dataset.blockIndex, 10);
                    if (!Number.isNaN(fromBlockIdx)) {
                        State.currentblockIndex = fromBlockIdx;
                        setSelectedBlocks([fromBlockIdx]);
                        updateblockSelector();
                    }
                },
                onEnd: (evt) => {
                    if (evt.oldIndex == null || evt.newIndex == null) return;

                    const fromBlockIdx = parseInt(evt.from.dataset.blockIndex, 10);
                    const toBlockIdx = parseInt(evt.to.dataset.blockIndex, 10);
                    if (Number.isNaN(fromBlockIdx) || Number.isNaN(toBlockIdx)) return;
                    if (fromBlockIdx === toBlockIdx && evt.oldIndex === evt.newIndex) return;

                    const fromSteps = blocks[fromBlockIdx]?.steps || [];
                    if (evt.oldIndex < 0 || evt.oldIndex >= fromSteps.length) return;

                    pushHistory();
                    const [movedStep] = fromSteps.splice(evt.oldIndex, 1);
                    const toSteps = blocks[toBlockIdx]?.steps || (blocks[toBlockIdx].steps = []);
                    const safeNewIndex = Math.max(0, Math.min(evt.newIndex, toSteps.length));
                    toSteps.splice(safeNewIndex, 0, movedStep);

                    State.currentblockIndex = toBlockIdx;
                    setSelectedBlocks([toBlockIdx]);
                    updateblockSelector();
                    renderTimeline();
                }
            });

            Runtime.timelineSortableInstances.push(sortable);
        });

        // Sortable for BLOCKS (NEW)
        if (blocks.length > 1) {
            Runtime.blockSortableInstance = Sortable.create(timeline, {
                animation: 150,
                draggable: '.block-group',
                handle: '.block-label', // Drag by header only
                filter: '.delete-block-btn',
                onEnd: (evt) => {
                    if (evt.oldIndex === evt.newIndex) return;

                    pushHistory();

                    const [movedBlock] = blocks.splice(evt.oldIndex, 1);
                    blocks.splice(evt.newIndex, 0, movedBlock);

                    State.currentblockIndex = remapBlockIndexAfterMove(
                        State.currentblockIndex,
                        evt.oldIndex,
                        evt.newIndex
                    );
                    if (State.blockSelectionLedIndex === State.currentlyViewedLedIndex) {
                        const remappedSelection = [...State.selectedBlockIndices].map(idx =>
                            remapBlockIndexAfterMove(idx, evt.oldIndex, evt.newIndex)
                        );
                        setSelectedBlocks(remappedSelection);
                    }

                    // Re-render to ensure DOM indices match data
                    updateblockSelector();
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
            const repeatMeta = getBlockRepeatMeta(block);
            const repeatInfo = ` (${repeatMeta.label})`;
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
            setSelectedBlocks([State.currentblockIndex]);
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
        if (blocksAfter.length > 0) setSelectedBlocks([State.currentblockIndex]);
        else clearSelectedBlocks();

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
    fn.copySelectedBlocks = copySelectedBlocks;
    fn.getBlockClipboardPayload = getBlockClipboardPayload;
    fn.applyBlockPayloadToLed = applyBlockPayloadToLed;
    fn.clearSelectedBlocks = clearSelectedBlocks;
})(window);

