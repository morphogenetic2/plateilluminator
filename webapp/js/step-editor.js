(function initStepEditorModule(global) {
    const App = global.App;
    const State = App.state;
    const fn = App.fn;

    function pushHistory() {
        return fn.pushHistory();
    }

    function renderTimeline() {
        return fn.renderTimeline();
    }

    function updateAllLedProgramIndicators() {
        return fn.updateAllLedProgramIndicators();
    }
    function showTopToast(message) {
        return fn.showTopToast ? fn.showTopToast(message) : undefined;
    }
    function updateblockSelector() {
        return fn.updateblockSelector ? fn.updateblockSelector() : undefined;
    }
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
        showTopToast('Select at least 1 LED first');
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
    updateblockSelector();
}

function validateSelection() {
    for (const idx of State.selectedLedIndices) {
        const ledData = State.programData[`LED${idx}`];
        if (!ledData.blocks || ledData.blocks.length === 0) {
            showTopToast(`LED ${idx + 1} needs a block first`);
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
        b.setAttribute('aria-pressed', 'false');
        if (b.dataset.value === step.type) {
            b.classList.add('is-selected');
            b.setAttribute('aria-pressed', 'true');
        }
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
    updateblockSelector();
}

function buildStepObject() {
    const durationInput = document.getElementById('step-duration');
    const error = document.getElementById('step-error');
    const duration = parseInt(durationInput.value) || 1000;
    durationInput.removeAttribute('aria-invalid');
    if (error) error.textContent = '';
    if (duration < 50) {
        durationInput.setAttribute('aria-invalid', 'true');
        if (error) error.textContent = 'Duration must be at least 50 ms.';
        durationInput.focus();
        return null;
    }

    const step = { type: State.currentStepType, duration_ms: duration };

    if (State.currentStepType === 'ON') {
        step.int = Math.min(3000, Math.max(0, parseInt(document.getElementById('on-int').value) || 0));
    } else if (State.currentStepType === 'RAMP') {
        step.int0 = Math.min(3000, Math.max(0, parseInt(document.getElementById('ramp-int0').value) || 0));
        step.int1 = Math.min(3000, Math.max(0, parseInt(document.getElementById('ramp-int1').value) || 0));
    } else if (State.currentStepType === 'SINE') {
        step.int0 = Math.min(3000, Math.max(0, parseInt(document.getElementById('sine-int0').value) || 0));
        step.int1 = Math.min(3000, Math.max(0, parseInt(document.getElementById('sine-int1').value) || 0));
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

    fn.updateStepParams = updateStepParams;
    fn.addStep = addStep;
    fn.validateSelection = validateSelection;
    fn.loadStepForEditing = loadStepForEditing;
    fn.cancelStepEdit = cancelStepEdit;
    fn.updateStep = updateStep;
    fn.buildStepObject = buildStepObject;
    fn.updateEditButtonsUI = updateEditButtonsUI;
})(window);
