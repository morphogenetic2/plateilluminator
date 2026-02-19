(function initEventsModule(global) {
    const App = global.App;
    const State = App.state;
    const fn = App.fn;

    function updateStepParams() { return fn.updateStepParams(); }
    function updateLedAppearances() { return fn.updateLedAppearances(); }
    function updateblockSelector() { return fn.updateblockSelector(); }
    function updateBatchIndicator() { return fn.updateBatchIndicator(); }
    function renderTimeline() { return fn.renderTimeline(); }
    function updateAllLedProgramIndicators() { return fn.updateAllLedProgramIndicators(); }
    function updateblockConfigUI() { return fn.updateblockConfigUI(); }
    function addblock() { return fn.addblock(); }
    function removeblock() { return fn.removeblock(); }
    function saveblockConfig() { return fn.saveblockConfig(); }
    function addStep() { return fn.addStep(); }
    function updateStep() { return fn.updateStep(); }
    function cancelStepEdit() { return fn.cancelStepEdit(); }
    function pushHistory() { return fn.pushHistory(); }
    function loadProgram(event) { return fn.loadProgram(event); }
    function exportProgram() { return fn.exportProgram(); }
    function saveToDevice() { return fn.saveToDevice(); }
    function undo() { return fn.undo(); }
    function renderAllTimelinesModal() { return fn.renderAllTimelinesModal(); }
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
        for (let i = 0; i < App.config.NUM_LEDS; i++) State.selectedLedIndices.add(i);
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
            if (val > 3000) {
                e.target.value = 3000;
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
            for (let i = 0; i < App.config.NUM_LEDS; i++) {
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


    fn.initEventHandlers = initEventHandlers;
})(window);
