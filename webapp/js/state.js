(function initStateModule(global) {
    const App = global.App || (global.App = {});
    App.config = App.config || {};
    App.state = App.state || {};
    App.dragSelect = App.dragSelect || {};
    App.runtime = App.runtime || {};
    App.fn = App.fn || {};

    App.config.NUM_LEDS = 24;

    Object.assign(App.state, {
        programData: {},
        selectedLedIndices: new Set(),
        currentlyViewedLedIndex: null,
        currentblockIndex: 0,
        currentStepType: 'ON',
        editingStepIndex: null,
        history: [],
        lastClickedLedIndex: null,
        clipboard: null,
        fileHandle: null,
    });

    Object.assign(App.dragSelect, {
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
    });

    Object.assign(App.runtime, {
        timelineSortableInstance: null,
        blockSortableInstance: null,
        allLedButtons: [],
    });

    const State = App.state;
    const fn = App.fn;

    function renderTimeline() {
        return fn.renderTimeline ? fn.renderTimeline() : undefined;
    }

    function updateAllLedProgramIndicators() {
        return fn.updateAllLedProgramIndicators ? fn.updateAllLedProgramIndicators() : undefined;
    }

    function updateblockSelector() {
        return fn.updateblockSelector ? fn.updateblockSelector() : undefined;
    }

    function cancelStepEdit() {
        return fn.cancelStepEdit ? fn.cancelStepEdit() : undefined;
    }

    function pushHistory() {
        if (State.history.length > 50) State.history.shift();
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
            renderTimeline();
            updateAllLedProgramIndicators();
            updateblockSelector();
            if (State.editingStepIndex !== null) cancelStepEdit();
        } catch (e) {
            console.error('Undo failed', e);
        }
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
        for (let i = 0; i < App.config.NUM_LEDS; i++) {
            State.programData[`LED${i}`] = {
                blocks: []
            };
        }
    }

    fn.pushHistory = pushHistory;
    fn.undo = undo;
    fn.updateBatchIndicator = updateBatchIndicator;
    fn.initState = initState;
})(window);
