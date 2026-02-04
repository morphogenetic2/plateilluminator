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
        editingStepIndex: null,
        history: [], // Stack of programData strings
        lastClickedLedIndex: null, // For Shift+click range selection
        clipboard: null, // For copy/paste LED programs
        fileHandle: null, // For File System Access API (Direct Save)
    };

    const DragSelect = {
        active: false,
        hasMoved: false,
        ignoreClick: false,
        startX: 0,
        startY: 0,
        additive: false,
        originSelection: new Set(),
        lastHitLedIndex: null,
        boxEl: null,
        containerEl: null,
        gridEl: null,
    };

    function pushHistory() {
        if (State.history.length > 50) State.history.shift(); // Limit size
        State.history.push(JSON.stringify(State.programData));
        document.getElementById('undo-btn').disabled = false;
        document.getElementById('undo-btn').style.opacity = 1;
    }

    function undo() {
        if (State.history.length === 0) return;
        const prev = State.history.pop();
        if (State.history.length === 0) {
            document.getElementById('undo-btn').disabled = true;
            document.getElementById('undo-btn').style.opacity = 0.5;
        }

        try {
            State.programData = JSON.parse(prev);
            // Refresh UI
            renderTimeline();
            updateAllLedProgramIndicators();
            updateBlockSelector();
            if (State.editingStepIndex !== null) cancelStepEdit();
        } catch (e) { console.error('Undo failed', e); }
    }

    function updateBatchIndicator() {
        const banner = document.getElementById('batch-banner');
        const countSpan = document.getElementById('batch-count');

        if (State.selectedLedIndices.size > 1) {
            banner.style.display = 'flex';
            countSpan.textContent = State.selectedLedIndices.size;
        } else {
            banner.style.display = 'none';
        }
    }

    function initState() {
        for (let i = 0; i < NUM_LEDS; i++) {
            State.programData[`LED${i}`] = {
                blocks: []
            };
        }
    }

    // ==========================================
    // TIMELINE (Horizontal Pills)
    // ==========================================
    let timelineSortableInstance = null;
    let blockSortableInstance = null;

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
        if (blockSortableInstance) {
            blockSortableInstance.destroy();
            blockSortableInstance = null;
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
            else if (block.repeat_duration_minutes) repeatInfo = ` • ${block.repeat_duration_minutes}min`;
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
            timelineSortableInstance = Sortable.create(currentblockStepsContainer, {
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
            blockSortableInstance = Sortable.create(timeline, {
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
        if (block.repeat_continuous) mode = 'continuous';
        else if (block.repeat_count) mode = 'count';
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
        let repeat_continuous = false;

        if (selectedMode === 'count') {
            repeat_count = Math.max(1, parseInt(document.getElementById('repeat-count-input').value) || 1);
        } else if (selectedMode === 'duration') {
            repeat_duration_minutes = Math.max(0, parseFloat(document.getElementById('repeat-duration-input').value) || 1);
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

    // ==========================================
    // LED GRID
    // ==========================================
    let allLedButtons = [];

    function ensureDragSelectBox() {
        if (DragSelect.boxEl) return;
        const container = document.querySelector('.led-grid-container');
        if (!container) return;

        const box = document.createElement('div');
        box.className = 'drag-select-box';
        container.appendChild(box);

        DragSelect.boxEl = box;
        DragSelect.containerEl = container;
    }

    function updateSelectionByRect(rect) {
        const nextSelection = DragSelect.additive ? new Set(DragSelect.originSelection) : new Set();
        let lastHit = null;

        allLedButtons.forEach(btn => {
            const btnRect = btn.getBoundingClientRect();
            const intersects =
                rect.left <= btnRect.right &&
                rect.right >= btnRect.left &&
                rect.top <= btnRect.bottom &&
                rect.bottom >= btnRect.top;

            if (intersects) {
                const id = parseInt(btn.dataset.ledId);
                nextSelection.add(id);
                lastHit = id;
            }
        });

        DragSelect.lastHitLedIndex = lastHit;
        State.selectedLedIndices = nextSelection;
        updateLedAppearances();
        updateBatchIndicator();
    }

    function onGridPointerDown(e) {
        if (e.button !== 0) return;
        if (Simulator.isActive) return;

        const grid = DragSelect.gridEl || document.getElementById('led-grid');
        if (!grid || !grid.contains(e.target)) return;

        ensureDragSelectBox();

        DragSelect.active = true;
        DragSelect.hasMoved = false;
        DragSelect.startX = e.clientX;
        DragSelect.startY = e.clientY;
        DragSelect.additive = e.ctrlKey || e.metaKey;
        DragSelect.originSelection = new Set(State.selectedLedIndices);
        DragSelect.lastHitLedIndex = null;
        DragSelect.gridEl = grid;

        if (DragSelect.boxEl) {
            DragSelect.boxEl.style.display = 'none';
        }
    }

    function onGridPointerMove(e) {
        if (!DragSelect.active || !DragSelect.containerEl) return;

        const dx = e.clientX - DragSelect.startX;
        const dy = e.clientY - DragSelect.startY;
        if (!DragSelect.hasMoved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;

        DragSelect.hasMoved = true;
        DragSelect.gridEl?.setPointerCapture?.(e.pointerId);

        const minX = Math.min(DragSelect.startX, e.clientX);
        const minY = Math.min(DragSelect.startY, e.clientY);
        const maxX = Math.max(DragSelect.startX, e.clientX);
        const maxY = Math.max(DragSelect.startY, e.clientY);

        const containerRect = DragSelect.containerEl.getBoundingClientRect();
        if (DragSelect.boxEl) {
            DragSelect.boxEl.style.left = `${minX - containerRect.left}px`;
            DragSelect.boxEl.style.top = `${minY - containerRect.top}px`;
            DragSelect.boxEl.style.width = `${maxX - minX}px`;
            DragSelect.boxEl.style.height = `${maxY - minY}px`;
            DragSelect.boxEl.style.display = 'block';
        }

        e.preventDefault();
        updateSelectionByRect({
            left: minX,
            right: maxX,
            top: minY,
            bottom: maxY,
        });
    }

    function onGridPointerUp(e) {
        if (!DragSelect.active) return;

        DragSelect.active = false;

        if (DragSelect.boxEl) {
            DragSelect.boxEl.style.display = 'none';
        }

        if (DragSelect.hasMoved) {
            DragSelect.gridEl?.releasePointerCapture?.(e.pointerId);
        }

        if (DragSelect.hasMoved) {
            DragSelect.ignoreClick = true;
            setTimeout(() => {
                DragSelect.ignoreClick = false;
            }, 0);

            if (State.selectedLedIndices.size > 0) {
                if (
                    State.currentlyViewedLedIndex === null ||
                    !State.selectedLedIndices.has(State.currentlyViewedLedIndex)
                ) {
                    const fallback = DragSelect.lastHitLedIndex ?? [...State.selectedLedIndices][0];
                    State.currentlyViewedLedIndex = fallback;
                }
                State.lastClickedLedIndex = State.currentlyViewedLedIndex;
                State.currentblockIndex = 0;
            } else {
                State.currentlyViewedLedIndex = null;
            }

            updateLedAppearances();
            updateblockSelector();
            updateBatchIndicator();
            renderTimeline();
        }
    }

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

        ensureDragSelectBox();
        DragSelect.gridEl = grid;
        grid.addEventListener('pointerdown', onGridPointerDown);
        grid.addEventListener('pointermove', onGridPointerMove);
        window.addEventListener('pointerup', onGridPointerUp);
    }

    function handleLedClick(ledIndex, event) {
        if (DragSelect.ignoreClick) return;
        const isCtrl = event.ctrlKey || event.metaKey;
        const isShift = event.shiftKey;

        if (isShift && State.lastClickedLedIndex !== null) {
            // Shift+click: Select range
            const start = Math.min(State.lastClickedLedIndex, ledIndex);
            const end = Math.max(State.lastClickedLedIndex, ledIndex);

            // Add all LEDs in range to selection
            for (let i = start; i <= end; i++) {
                State.selectedLedIndices.add(i);
            }
        } else if (isCtrl) {
            // Ctrl+click: Toggle individual LED
            if (State.selectedLedIndices.has(ledIndex)) {
                State.selectedLedIndices.delete(ledIndex);
            } else {
                State.selectedLedIndices.add(ledIndex);
            }
        } else {
            // Regular click: Select only this LED
            if (State.selectedLedIndices.has(ledIndex) && State.selectedLedIndices.size === 1) {
                State.selectedLedIndices.clear();
            } else {
                State.selectedLedIndices.clear();
                State.selectedLedIndices.add(ledIndex);
            }
        }

        // Update last clicked for Shift+click functionality
        State.lastClickedLedIndex = ledIndex;

        State.currentlyViewedLedIndex = ledIndex;
        State.currentblockIndex = 0;

        updateLedAppearances();
        updateblockSelector();
        updateBatchIndicator();
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
    // VIEW ALL TIMELINES MODAL
    // ==========================================
    function renderAllTimelinesModal() {
        const container = document.getElementById('all-timelines-container');
        if (!container) return;

        container.innerHTML = '';

        // Iterate through all LEDs
        for (let i = 0; i < NUM_LEDS; i++) {
            const ledData = State.programData[`LED${i}`];
            const blocks = ledData?.blocks || [];

            // Filter: Hide LEDs with no blocks or only empty blocks
            const hasAnySteps = blocks.some(block => block.steps && block.steps.length > 0);
            if (!hasAnySteps) continue;

            // Create row
            const row = document.createElement('div');
            row.className = 'timeline-row';

            // LED Label
            const label = document.createElement('div');
            label.className = 'timeline-row-label';
            label.textContent = `LED ${i + 1}`;
            row.appendChild(label);

            // Timeline Content
            const content = document.createElement('div');
            content.className = 'timeline-row-content';

            blocks.forEach((block, blockIdx) => {
                // Skip empty blocks
                if (!block.steps || block.steps.length === 0) return;

                const blockGroup = document.createElement('div');
                blockGroup.className = 'block-group';
                blockGroup.style.cursor = 'default'; // Read-only

                // Block label
                const blockLabel = document.createElement('div');
                blockLabel.className = 'block-label';
                let repeatInfo = '';
                if (block.repeat_continuous) repeatInfo = ' • ∞';
                else if (block.repeat_count) repeatInfo = ` • ${block.repeat_count}x`;
                else if (block.repeat_duration_minutes) repeatInfo = ` • ${block.repeat_duration_minutes}min`;
                blockLabel.textContent = `${block.id || `Block ${blockIdx + 1}`}${repeatInfo}`;
                blockGroup.appendChild(blockLabel);

                // Steps
                const stepsContainer = document.createElement('div');
                stepsContainer.className = 'block-steps';

                block.steps.forEach((step, stepIdx) => {
                    const pill = document.createElement('div');
                    pill.className = `step-pill type-${step.type.toLowerCase()}`;
                    pill.style.cursor = 'default'; // Read-only

                    let details = '';
                    if (step.type === 'ON') details = `${step.duration_ms}ms @ ${step.int}`;
                    else if (step.type === 'OFF') details = `${step.duration_ms}ms`;
                    else if (step.type === 'RAMP') details = `${step.duration_ms}ms: ${step.int0}→${step.int1}`;
                    else if (step.type === 'SINE') details = `${step.duration_ms}ms: ${step.freq}Hz`;

                    pill.innerHTML = `
                        <span>${step.type}</span>
                        <span style="opacity:0.7; font-size:0.65rem;">${details}</span>
                    `;

                    stepsContainer.appendChild(pill);
                });

                blockGroup.appendChild(stepsContainer);
                content.appendChild(blockGroup);
            });

            row.appendChild(content);
            container.appendChild(row);
        }

        // If no LEDs have programs, show message
        if (container.children.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'timeline-empty';
            emptyMsg.textContent = 'No LED programs to display.';
            emptyMsg.style.padding = '2rem';
            emptyMsg.style.textAlign = 'center';
            container.appendChild(emptyMsg);
        }
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

        const step = buildStepObject();
        if (!step) return;

        pushHistory();

        State.selectedLedIndices.forEach(idx => {
            const ledData = State.programData[`LED${idx}`];

            // Auto-create first block if LED has no blocks
            if (!ledData.blocks || ledData.blocks.length === 0) {
                ledData.blocks = [{
                    id: 'block0',
                    steps: [],
                    repeat_duration_minutes: null,
                    repeat_count: null,
                    repeat_continuous: true
                }];
                // Set current block index to 0 for this new block
                State.currentblockIndex = 0;
            }

            const block = ledData.blocks[State.currentblockIndex];
            if (block) {
                block.steps.push({ ...step });
            }
        });

        renderTimeline();
        updateAllLedProgramIndicators();
    }

    function validateSelection() {
        for (const idx of State.selectedLedIndices) {
            const ledData = State.programData[`LED${idx}`];
            if (!ledData.blocks || ledData.blocks.length === 0) {
                alert(`LED ${idx + 1} has no blocks. Add a block first.`);
                return false;
            }
        }
        return true;
    }

    function loadStepForEditing(stepIdx) {
        if (State.currentlyViewedLedIndex === null) return;

        const ledData = State.programData[`LED${State.currentlyViewedLedIndex}`];
        const block = ledData?.blocks[State.currentblockIndex];
        if (!block || !block.steps[stepIdx]) return;

        const step = block.steps[stepIdx];
        State.editingStepIndex = stepIdx;
        State.currentStepType = step.type;

        // Select Type Button
        document.querySelectorAll('.step-type-btn').forEach(b => {
            b.classList.remove('is-selected');
            if (b.dataset.value === step.type) b.classList.add('is-selected');
        });

        // Populate Common
        document.getElementById('step-duration').value = step.duration_ms;

        // Populate Specifics
        if (step.type === 'ON') {
            document.getElementById('on-int').value = step.int;
        } else if (step.type === 'RAMP') {
            document.getElementById('ramp-int0').value = step.int0;
            document.getElementById('ramp-int1').value = step.int1;
        } else if (step.type === 'SINE') {
            document.getElementById('sine-int0').value = step.int0;
            document.getElementById('sine-int1').value = step.int1;
            document.getElementById('sine-freq').value = step.freq;
        }

        updateStepParams();
        updateEditButtonsUI();

        // Ensure inputs are enabled
        document.querySelectorAll('.editor-container input').forEach(el => el.disabled = false);

        renderTimeline(); // to show highlight
    }

    function cancelStepEdit() {
        State.editingStepIndex = null;
        updateEditButtonsUI();
        renderTimeline();
    }

    function updateStep() {
        if (State.editingStepIndex === null) return;

        const step = buildStepObject();
        if (!step) return;

        pushHistory();

        State.selectedLedIndices.forEach(idx => {
            const ledData = State.programData[`LED${idx}`];
            const block = ledData.blocks[State.currentblockIndex];
            if (block && block.steps[State.editingStepIndex]) {
                // Preserve original type if we want? No, overwrite completely.
                block.steps[State.editingStepIndex] = step;
            }
        });

        cancelStepEdit(); // Clear mode
        renderTimeline();
        updateAllLedProgramIndicators();
    }

    function buildStepObject() {
        const duration = parseInt(document.getElementById('step-duration').value) || 1000;
        if (duration < 50) {
            alert('Duration must be >= 50ms');
            return null;
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
        return step;
    }

    function updateEditButtonsUI() {
        const isEditing = State.editingStepIndex !== null;
        document.getElementById('add-step-btn').style.display = isEditing ? 'none' : 'inline-flex';
        document.getElementById('update-step-btn').style.display = isEditing ? 'inline-flex' : 'none';
        document.getElementById('cancel-step-btn').style.display = isEditing ? 'inline-flex' : 'none';
    }

    // ==========================================
    // FILE I/O
    // ==========================================

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

        const h = parseInt(document.getElementById('run-time-hours').value) || 0;
        const m = parseInt(document.getElementById('run-time-minutes').value) || 0;
        const s = parseInt(document.getElementById('run-time-seconds').value) || 0;
        const totalSeconds = (h * 3600) + (m * 60) + s;

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

        const h = parseInt(document.getElementById('run-time-hours').value) || 0;
        const m = parseInt(document.getElementById('run-time-minutes').value) || 0;
        const s = parseInt(document.getElementById('run-time-seconds').value) || 0;
        const totalSeconds = (h * 3600) + (m * 60) + s;

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
                for (let i = 0; i < NUM_LEDS; i++) {
                    if (!State.programData[`LED${i}`]) {
                        State.programData[`LED${i}`] = { blocks: [] };
                    }
                }

                // Update duration inputs
                document.getElementById('run-time-hours').value = Math.floor(totalSeconds / 3600);
                document.getElementById('run-time-minutes').value = Math.floor((totalSeconds % 3600) / 60);
                document.getElementById('run-time-seconds').value = Math.floor(totalSeconds % 60);

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
            updateBatchIndicator();
            renderTimeline();
        });

        document.getElementById('select-none-btn')?.addEventListener('click', () => {
            State.selectedLedIndices.clear();
            updateLedAppearances();
            updateBatchIndicator();
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

        // Intensity Clamping
        ['on-int', 'ramp-int0', 'ramp-int1', 'sine-int0', 'sine-int1'].forEach(id => {
            document.getElementById(id)?.addEventListener('blur', (e) => {
                let val = parseInt(e.target.value);
                if (val > 1400) {
                    e.target.value = 1400;
                }
            });
        });

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
        document.getElementById('update-step-btn')?.addEventListener('click', updateStep);
        document.getElementById('cancel-step-btn')?.addEventListener('click', cancelStepEdit);

        // File I/O
        document.getElementById('load-btn')?.addEventListener('click', () => {
            document.getElementById('file-input').click();
        });
        document.getElementById('file-input')?.addEventListener('change', (e) => {
            pushHistory(); // Save before load
            loadProgram(e);
        });
        document.getElementById('export-btn')?.addEventListener('click', exportProgram);
        document.getElementById('save-device-btn')?.addEventListener('click', saveToDevice);

        // Undo
        document.getElementById('undo-btn')?.addEventListener('click', undo);
        document.addEventListener('keydown', (e) => {
            // Ctrl+Z: Undo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                undo();
            }

            // Ctrl+A: Select All LEDs
            if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
                e.preventDefault();
                State.selectedLedIndices.clear();
                for (let i = 0; i < NUM_LEDS; i++) {
                    State.selectedLedIndices.add(i);
                }
                // Keep current viewed LED if set, otherwise view first
                if (State.currentlyViewedLedIndex === null) {
                    State.currentlyViewedLedIndex = 0;
                }
                updateLedAppearances();
                updateblockSelector();
                updateBatchIndicator();
                renderTimeline();
            }

            // Ctrl+C: Copy current LED program
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                e.preventDefault();
                if (State.currentlyViewedLedIndex !== null) {
                    const ledKey = `LED${State.currentlyViewedLedIndex}`;
                    const ledData = State.programData[ledKey];

                    // Deep copy the LED program
                    State.clipboard = JSON.parse(JSON.stringify(ledData || { blocks: [] }));

                    // Visual feedback
                    const timelineLabel = document.getElementById('timeline-label');
                    if (timelineLabel) {
                        const originalText = timelineLabel.textContent;
                        timelineLabel.textContent = ' (Copied!)';
                        timelineLabel.style.color = 'var(--accent-success)';
                        setTimeout(() => {
                            timelineLabel.textContent = originalText;
                            timelineLabel.style.color = 'var(--primary)';
                        }, 1000);
                    }
                }
            }

            // Ctrl+V: Paste to selected LEDs
            if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                e.preventDefault();
                if (State.clipboard && State.selectedLedIndices.size > 0) {
                    // Check if clipboard is empty (no blocks or only empty blocks)
                    const clipboardIsEmpty = !State.clipboard.blocks ||
                        State.clipboard.blocks.length === 0 ||
                        !State.clipboard.blocks.some(block => block.steps && block.steps.length > 0);

                    // Check if any target LEDs have programs
                    let targetsHavePrograms = false;
                    State.selectedLedIndices.forEach(ledIdx => {
                        const ledKey = `LED${ledIdx}`;
                        const ledData = State.programData[ledKey];
                        if (ledData?.blocks) {
                            for (const block of ledData.blocks) {
                                if (block.steps && block.steps.length > 0) {
                                    targetsHavePrograms = true;
                                    break;
                                }
                            }
                        }
                    });

                    // Warn if pasting empty over non-empty
                    if (clipboardIsEmpty && targetsHavePrograms) {
                        const confirmed = confirm(
                            `⚠️ Warning: You are about to paste an empty program.\n\n` +
                            `This will clear the existing programs on ${State.selectedLedIndices.size} LED${State.selectedLedIndices.size > 1 ? 's' : ''}.\n\n` +
                            `Do you want to continue?`
                        );
                        if (!confirmed) return; // User canceled
                    }

                    pushHistory(); // Undo point

                    State.selectedLedIndices.forEach(ledIdx => {
                        const ledKey = `LED${ledIdx}`;
                        // Deep copy from clipboard
                        State.programData[ledKey] = JSON.parse(JSON.stringify(State.clipboard));
                    });

                    // Visual feedback
                    const timelineLabel = document.getElementById('timeline-label');
                    if (timelineLabel) {
                        const originalText = timelineLabel.textContent;
                        timelineLabel.textContent = ` (Pasted to ${State.selectedLedIndices.size} LED${State.selectedLedIndices.size > 1 ? 's' : ''}!)`;
                        timelineLabel.style.color = 'var(--accent-success)';
                        setTimeout(() => {
                            timelineLabel.textContent = originalText;
                            timelineLabel.style.color = 'var(--primary)';
                        }, 1500);
                    }

                    renderTimeline();
                    updateAllLedProgramIndicators();
                }
            }
        });

        // View All Modal
        document.getElementById('view-all-btn')?.addEventListener('click', () => {
            renderAllTimelinesModal();
            document.getElementById('view-all-modal').style.display = 'flex';
        });

        document.getElementById('close-view-all-btn')?.addEventListener('click', () => {
            document.getElementById('view-all-modal').style.display = 'none';
        });

        // Close modal on background click
        document.getElementById('view-all-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'view-all-modal') {
                document.getElementById('view-all-modal').style.display = 'none';
            }
        });
    }


    // ==========================================
    // SIMULATOR
    // ==========================================
    class LedRuntime {
        constructor(ledId, blocks) {
            this.ledId = ledId;
            this.blocks = blocks;
            this.reset();
        }

        reset() {
            this.blockIdx = 0;
            this.stepIdx = 0;
            this.blockLoopCount = 0;
            this.blockStartTime = 0;
            this.stepStartTime = 0;
            this.isDone = false;
            this.currentInt = 0;
            // Handle empty program
            if (!this.blocks || this.blocks.length === 0) {
                this.isDone = true;
            }
        }

        tick(globalTimeS) {
            if (this.isDone) return 0;

            const block = this.blocks[this.blockIdx];
            if (!block || !block.steps || block.steps.length === 0) {
                this.advanceBlock(globalTimeS);
                return 0; // Skip empty block
            }

            // Check block duration limit
            const blockDurationS = block.repeat_duration_s || (block.repeat_duration_minutes * 60) || null;
            if (blockDurationS) {
                if (globalTimeS - this.blockStartTime >= blockDurationS) {
                    this.advanceBlock(globalTimeS);
                    return this.tick(globalTimeS);
                }
            }

            const step = block.steps[this.stepIdx];
            const stepDurationS = step.duration_s || (step.duration_ms / 1000) || 0;
            const timeInStepS = globalTimeS - this.stepStartTime;

            // Calculate Intensity
            let val = 0;
            if (step.type === 'ON') val = step.int;
            else if (step.type === 'OFF') val = 0;
            else if (step.type === 'RAMP') {
                const progress = Math.min(1, stepDurationS > 0 ? timeInStepS / stepDurationS : 1);
                val = step.int0 + (step.int1 - step.int0) * progress;
            } else if (step.type === 'SINE') {
                const tBlockS = globalTimeS - this.blockStartTime;
                const sineVal = Math.sin(2 * Math.PI * step.freq * tBlockS); // -1 to 1
                const amp = (step.int1 - step.int0) / 2;
                const midpoint = (step.int0 + step.int1) / 2;
                val = midpoint + (sineVal * amp);
            }

            this.currentInt = val;

            // Check Step Complete
            if (timeInStepS >= stepDurationS) {
                this.advanceStep(globalTimeS);
            }

            return Math.max(0, val);
        }

        advanceStep(globalTimeS) {
            this.stepIdx++;
            const block = this.blocks[this.blockIdx];

            // End of block steps?
            if (this.stepIdx >= block.steps.length) {
                // Check block Repetition
                if (block.repeat_continuous) {
                    this.stepIdx = 0; // Loop forever
                } else if (block.repeat_count) {
                    this.blockLoopCount++;
                    if (this.blockLoopCount < block.repeat_count) {
                        this.stepIdx = 0; // Loop block
                    } else {
                        this.advanceBlock(globalTimeS); // Done with this block
                    }
                } else if (!block.repeat_duration_s && !block.repeat_duration_minutes) {
                    // Mode Once
                    this.advanceBlock(globalTimeS);
                } else {
                    // Mode Duration - just loop steps until duration cuts it off
                    this.stepIdx = 0;
                }
            }
            this.stepStartTime = globalTimeS;
        }

        advanceBlock(globalTimeS) {
            this.blockIdx++;
            this.stepIdx = 0;
            this.blockLoopCount = 0;
            this.blockStartTime = globalTimeS;
            this.stepStartTime = globalTimeS;

            if (this.blockIdx >= this.blocks.length) {
                this.isDone = true;
            }
        }
    }

    const Simulator = {
        isActive: false,
        isPlaying: false,
        speed: 1,
        currentTimeS: 0,
        lastFrameTime: 0,
        runtimes: [], // Array of LedRuntime
        rafId: null,
        savedSelection: null,
        savedViewedLedLink: null,

        init() {
            // Nothing special to init visual-wise, we use existing #led-grid
        },

        // "Open" concept is gone. We just Play/Stop.

        togglePlay() {
            if (this.isPlaying) this.pause();
            else this.play();
        },

        play() {
            if (this.isPlaying) return;

            // If starting from scratch/stopped
            if (!this.isActive) {
                this.startSession();
            }

            this.isPlaying = true;
            this.lastFrameTime = performance.now();
            document.getElementById('sim-play-btn').innerHTML = '<i class="fas fa-pause"></i>';
            document.body.classList.add('simulating');
            this.loop();
        },

        startSession() {
            this.isActive = true;
            this.currentTimeS = 0;

            // Backup and Clear Selection
            this.savedSelection = new Set(State.selectedLedIndices);
            this.savedViewedLedLink = State.currentlyViewedLedIndex;

            State.selectedLedIndices.clear();
            State.currentlyViewedLedIndex = null;

            updateLedAppearances();
            updateblockSelector();
            updateBatchIndicator();
            renderTimeline();

            // Re-build runtimes
            this.runtimes = [];
            for (let i = 0; i < NUM_LEDS; i++) {
                const ledData = State.programData[`LED${i}`] || { blocks: [] };
                this.runtimes.push(new LedRuntime(i, ledData.blocks));
            }
        },

        pause() {
            this.isPlaying = false;
            cancelAnimationFrame(this.rafId);
            document.getElementById('sim-play-btn').innerHTML = '<i class="fas fa-play"></i>';
        },

        stop() {
            this.pause();
            this.isActive = false;
            this.currentTimeS = 0;
            this.runtimes.forEach(r => r.reset());
            this.updateDisplay();

            // Restore Selection and UI
            if (this.savedSelection) {
                State.selectedLedIndices = new Set(this.savedSelection);
                State.currentlyViewedLedIndex = this.savedViewedLedLink;
                this.savedSelection = null;
                this.savedViewedLedLink = null;
            }

            document.body.classList.remove('simulating');

            updateLedAppearances();
            updateblockSelector();
            updateBatchIndicator();
            renderTimeline();
        },

        setSpeed(val) {
            this.speed = val;
            document.querySelectorAll('.sim-speed-btn').forEach(b => {
                b.classList.toggle('is-selected', parseInt(b.dataset.speed) === val);
            });
        },

        loop() {
            if (!this.isPlaying) return;

            const now = performance.now();
            const realDeltaS = (now - this.lastFrameTime) / 1000;
            this.lastFrameTime = now;

            const simDeltaS = realDeltaS * this.speed;
            this.currentTimeS += simDeltaS;

            // Tick runtimes
            let allDone = true;
            this.runtimes.forEach((rt, idx) => {
                const intensity = rt.tick(this.currentTimeS); // 0-1400
                if (!rt.isDone) allDone = false;

                const el = allLedButtons[idx];
                if (el) {
                    const norm = Math.min(1, intensity / 1400);
                    const bgLightness = 10 + (norm * 50); // 10% to 60%
                    el.style.backgroundColor = `hsl(245, 50%, ${bgLightness}%)`;
                    el.style.boxShadow = `0 0 ${10 + (norm * 20)}px rgba(99, 102, 241, ${0.2 + (norm * 0.8)})`;
                    el.style.borderColor = `rgba(255,255,255,${0.1 + (norm * 0.9)})`;
                }
            });

            this.updateTimeDisplay();

            if (allDone) {
                this.stop();
            } else {
                this.rafId = requestAnimationFrame(() => this.loop());
            }
        },

        updateDisplay() {
            this.updateTimeDisplay();
            if (!this.isActive) {
                allLedButtons.forEach(el => {
                    el.style.backgroundColor = '';
                    el.style.boxShadow = '';
                    el.style.borderColor = '';
                });
            }
        },

        updateTimeDisplay() {
            const totalS = this.currentTimeS;
            const h = Math.floor(totalS / 3600);
            const m = Math.floor((totalS % 3600) / 60);
            const s = Math.floor(totalS % 60);
            const ms = Math.floor((totalS % 1) * 1000);

            const pad = (n, z = 2) => n.toString().padStart(z, '0');
            document.getElementById('sim-time-display').textContent =
                `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}`;
        }
    };

    function initSimulatorEvents() {
        Simulator.init();

        document.getElementById('sim-play-btn')?.addEventListener('click', () => Simulator.togglePlay());
        document.getElementById('sim-stop-btn')?.addEventListener('click', () => Simulator.stop());

        document.querySelectorAll('.sim-speed-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                Simulator.setSpeed(parseInt(btn.dataset.speed));
            });
        });
    }

    initSimulatorEvents();

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

