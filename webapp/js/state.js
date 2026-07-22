(function initStateModule(global) {
    const App = global.App || (global.App = {});
    App.config = App.config || {};
    App.state = App.state || {};
    App.dragSelect = App.dragSelect || {};
    App.runtime = App.runtime || {};
    App.fn = App.fn || {};

    App.config.NUM_LEDS = 24;
    App.config.DRAFT_STORAGE_KEY = 'plateilluminator-program-draft-v1';

    Object.assign(App.state, {
        programData: {},
        selectedLedIndices: new Set(),
        selectedBlockIndices: new Set(),
        blockSelectionLedIndex: null,
        currentlyViewedLedIndex: null,
        currentblockIndex: 0,
        currentStepType: 'ON',
        editingStepIndex: null,
        history: [],
        lastClickedLedIndex: null,
        clipboard: null,
        blockClipboard: null,
        lastCopyKind: null,
        fileHandle: null,
        isDirty: false,
        draftRestored: false,
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
        timelineSortableInstances: [],
        blockSortableInstance: null,
        allLedButtons: [],
        blockSelectDrag: null,
        blockDragPayload: null,
        toastTimeoutId: null,
        isBlockDragActive: false,
        isStepDragActive: false,
        suppressTimelineClicks: false,
        modalTrigger: null,
        draftSaveTimer: null,
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
        markDirty();
    }

    function saveDraft() {
        try {
            const hours = parseInt(document.getElementById('run-time-hours')?.value, 10) || 0;
            const minutes = parseInt(document.getElementById('run-time-minutes')?.value, 10) || 0;
            const seconds = parseInt(document.getElementById('run-time-seconds')?.value, 10) || 0;
            localStorage.setItem(App.config.DRAFT_STORAGE_KEY, JSON.stringify({
                programData: State.programData,
                totalDurationS: (hours * 3600) + (minutes * 60) + seconds,
                savedAt: Date.now(),
            }));
        } catch (error) {
            console.warn('Could not save local draft:', error);
        }
    }

    function markDirty() {
        State.isDirty = true;
        if (App.runtime.draftSaveTimer) clearTimeout(App.runtime.draftSaveTimer);
        App.runtime.draftSaveTimer = setTimeout(saveDraft, 0);
    }

    function markClean() {
        State.isDirty = false;
        try {
            localStorage.removeItem(App.config.DRAFT_STORAGE_KEY);
        } catch (error) {
            console.warn('Could not clear local draft:', error);
        }
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
            markDirty();
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

    function updateEditorAvailability() {
        const hasSelection = State.selectedLedIndices.size > 0 && State.currentlyViewedLedIndex !== null;
        const viewedBlocks = hasSelection
            ? (State.programData[`LED${State.currentlyViewedLedIndex}`]?.blocks || [])
            : [];
        const hasBlock = viewedBlocks.length > 0;
        const guidance = document.getElementById('editor-guidance');

        document.querySelectorAll('.step-type-btn, .step-params input, #step-duration').forEach(control => {
            control.disabled = !hasSelection;
        });
        ['add-step-btn', 'update-step-btn', 'cancel-step-btn'].forEach(id => {
            const button = document.getElementById(id);
            if (button) button.disabled = !hasSelection;
        });

        const addBlockButton = document.getElementById('add-block-btn');
        if (addBlockButton) addBlockButton.disabled = !hasSelection;

        document.querySelectorAll('#block-selector, #remove-block-btn, #block-name-input, .repeat-mode-btn, #repeat-count-input, #repeat-duration-trigger').forEach(control => {
            control.disabled = !hasBlock;
        });

        if (guidance) {
            guidance.classList.toggle('is-ready', hasSelection);
            if (!hasSelection) {
                guidance.textContent = 'Select an LED to enable the step editor.';
            } else if (!hasBlock) {
                guidance.textContent = 'Add a block, or add a step to create the first block automatically.';
            } else {
                guidance.textContent = `Editing LED ${State.currentlyViewedLedIndex + 1}, block ${State.currentblockIndex + 1}.`;
            }
        }
    }

    function initState() {
        for (let i = 0; i < App.config.NUM_LEDS; i++) {
            State.programData[`LED${i}`] = {
                blocks: []
            };
        }

        try {
            const savedDraft = JSON.parse(localStorage.getItem(App.config.DRAFT_STORAGE_KEY) || 'null');
            if (savedDraft?.programData && typeof savedDraft.programData === 'object') {
                State.programData = savedDraft.programData;
                for (let i = 0; i < App.config.NUM_LEDS; i++) {
                    if (!State.programData[`LED${i}`]) State.programData[`LED${i}`] = { blocks: [] };
                }
                State.isDirty = true;
                State.draftRestored = true;
                const totalSeconds = Math.max(0, parseInt(savedDraft.totalDurationS, 10) || 0);
                const hoursInput = document.getElementById('run-time-hours');
                const minutesInput = document.getElementById('run-time-minutes');
                const secondsInput = document.getElementById('run-time-seconds');
                if (hoursInput) hoursInput.value = Math.floor(totalSeconds / 3600);
                if (minutesInput) minutesInput.value = Math.floor((totalSeconds % 3600) / 60);
                if (secondsInput) secondsInput.value = totalSeconds % 60;
            }
        } catch (error) {
            console.warn('Could not restore local draft:', error);
        }
    }

    function showTopToast(message = 'copy') {
        let toast = document.getElementById('top-mini-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'top-mini-toast';
            toast.className = 'mini-toast';
            toast.setAttribute('role', 'status');
            toast.setAttribute('aria-live', 'polite');
            toast.setAttribute('aria-atomic', 'true');
            document.body.appendChild(toast);
        }

        toast.textContent = message;
        toast.classList.add('is-visible');

        if (App.runtime.toastTimeoutId) {
            clearTimeout(App.runtime.toastTimeoutId);
        }

        App.runtime.toastTimeoutId = setTimeout(() => {
            toast.classList.remove('is-visible');
        }, 900);
    }

    fn.pushHistory = pushHistory;
    fn.undo = undo;
    fn.updateBatchIndicator = updateBatchIndicator;
    fn.updateEditorAvailability = updateEditorAvailability;
    fn.initState = initState;
    fn.showTopToast = showTopToast;
    fn.markDirty = markDirty;
    fn.markClean = markClean;
    fn.saveDraft = saveDraft;
})(window);
