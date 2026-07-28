(function initGridModule(global) {
    const App = global.App;
    const State = App.state;
    const DragSelect = App.dragSelect;
    const Runtime = App.runtime;
    const fn = App.fn;

    function updateBatchIndicator() {
        return fn.updateBatchIndicator();
    }

    function updateblockSelector() {
        return fn.updateblockSelector();
    }

    function renderTimeline() {
        return fn.renderTimeline();
    }

    function cancelStepEdit() {
        return fn.cancelStepEdit ? fn.cancelStepEdit() : undefined;
    }

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

    Runtime.allLedButtons.forEach(btn => {
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
    if (App.simulator && App.simulator.isActive) return;

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

    for (let i = 0; i < App.config.NUM_LEDS; i++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = `led-btn-${i}`;
        btn.className = 'led-btn';
        btn.dataset.ledId = i;
        btn.textContent = i + 1;
        btn.setAttribute('aria-label', `LED ${i + 1}`);
        btn.setAttribute('aria-pressed', 'false');
        btn.tabIndex = i === 0 ? 0 : -1;

        btn.addEventListener('click', (e) => {
            handleLedClick(i, e);
        });
        btn.addEventListener('keydown', handleLedGridKeydown);

        grid.appendChild(btn);
        Runtime.allLedButtons.push(btn);
    }

    ensureDragSelectBox();
    DragSelect.gridEl = grid;
    grid.addEventListener('pointerdown', onGridPointerDown);
    grid.addEventListener('pointermove', onGridPointerMove);
    window.addEventListener('pointerup', onGridPointerUp);
}

function handleLedGridKeydown(event) {
    const currentIndex = parseInt(event.currentTarget.dataset.ledId, 10);
    let nextIndex = currentIndex;

    if (event.key === 'ArrowRight') nextIndex = Math.min(App.config.NUM_LEDS - 1, currentIndex + 1);
    else if (event.key === 'ArrowLeft') nextIndex = Math.max(0, currentIndex - 1);
    else if (event.key === 'ArrowDown') nextIndex = Math.min(App.config.NUM_LEDS - 1, currentIndex + 6);
    else if (event.key === 'ArrowUp') nextIndex = Math.max(0, currentIndex - 6);
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = App.config.NUM_LEDS - 1;
    else return;

    event.preventDefault();
    Runtime.allLedButtons.forEach((button, index) => {
        button.tabIndex = index === nextIndex ? 0 : -1;
    });
    Runtime.allLedButtons[nextIndex]?.focus();
}

function handleLedClick(ledIndex, event) {
    if (DragSelect.ignoreClick) return;
    if (App.simulator?.isActive) return;
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

    if (State.selectedLedIndices.size === 0) {
        State.lastClickedLedIndex = null;
        State.currentlyViewedLedIndex = null;
        State.currentblockIndex = 0;
        cancelStepEdit();
    } else {
        // Update last clicked for Shift+click functionality
        State.lastClickedLedIndex = ledIndex;
        State.currentlyViewedLedIndex = ledIndex;
        State.currentblockIndex = 0;
    }

    Runtime.allLedButtons.forEach((button, index) => {
        button.tabIndex = index === ledIndex ? 0 : -1;
    });

    updateLedAppearances();
    updateblockSelector();
    updateBatchIndicator();
    renderTimeline();
}

function updateLedAppearances() {
    Runtime.allLedButtons.forEach(btn => {
        const id = parseInt(btn.dataset.ledId);
        btn.classList.remove('selected', 'viewing');

        if (id === State.currentlyViewedLedIndex) btn.classList.add('viewing');
        else if (State.selectedLedIndices.has(id)) btn.classList.add('selected');

        const isSelected = State.selectedLedIndices.has(id);
        btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        if (id === State.currentlyViewedLedIndex) btn.setAttribute('aria-current', 'true');
        else btn.removeAttribute('aria-current');
    });
    if (fn.updateEditorAvailability) fn.updateEditorAvailability();
}

function updateAllLedProgramIndicators() {
    Runtime.allLedButtons.forEach(btn => {
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
        btn.setAttribute('aria-label', `LED ${idx + 1}${hasProgram ? ', has program' : ''}`);
    });
}

    fn.initLedGrid = initLedGrid;
    fn.handleLedClick = handleLedClick;
    fn.updateLedAppearances = updateLedAppearances;
    fn.updateAllLedProgramIndicators = updateAllLedProgramIndicators;
})(window);
