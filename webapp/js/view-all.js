(function initViewAllModule(global) {
    const App = global.App;
    const State = App.state;
    const fn = App.fn;

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
        })[char]);
    }

    function activateOnKeyboard(element) {
        element.addEventListener('keydown', event => {
            if (event.target !== element || (event.key !== 'Enter' && event.key !== ' ')) return;
            event.preventDefault();
            element.click();
        });
    }

    function focusEditorContext(ledIdx, blockIdx, stepIdx = null) {
        State.selectedLedIndices.clear();
        State.selectedLedIndices.add(ledIdx);
        State.currentlyViewedLedIndex = ledIdx;
        State.currentblockIndex = blockIdx;

        if (stepIdx === null) {
            State.editingStepIndex = null;
            if (fn.updateEditButtonsUI) fn.updateEditButtonsUI();
        }

        fn.updateLedAppearances();
        fn.updateblockSelector();
        fn.updateBatchIndicator();
        fn.renderTimeline();

        const modal = document.getElementById('view-all-modal');
        if (modal && fn.closeViewAllModal) fn.closeViewAllModal();

        if (stepIdx !== null && fn.loadStepForEditing) {
            fn.loadStepForEditing(stepIdx);
        }
    }

    function formatDurationMinutesToClock(totalMinutes) {
        if (fn.formatDurationMinutesToClock) {
            return fn.formatDurationMinutesToClock(totalMinutes);
        }
        const totalSeconds = Math.max(0, Math.round((parseFloat(totalMinutes) || 0) * 60));
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        const pad = (n) => `${n}`.padStart(2, '0');
        return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }

    function getBlockRepeatMeta(block) {
        if (block.repeat_continuous) return { label: 'CONT', className: 'is-continuous' };
        if (block.repeat_count) return { label: `x${block.repeat_count}`, className: 'is-count' };
        if (block.repeat_duration_minutes) return { label: formatDurationMinutesToClock(block.repeat_duration_minutes), className: 'is-duration' };
        return { label: 'ONCE', className: 'is-once' };
    }

    function hasContinuousFlowRisk(blocks, blockIdx) {
        if (!blocks[blockIdx]?.repeat_continuous) return false;
        for (let i = blockIdx + 1; i < blocks.length; i++) {
            if (blocks[i]?.steps?.length) return true;
        }
        return false;
    }

function renderAllTimelinesModal() {
    const container = document.getElementById('all-timelines-container');
    if (!container) return;

    container.innerHTML = '';

    // Iterate through all LEDs
    for (let i = 0; i < App.config.NUM_LEDS; i++) {
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
            blockGroup.style.cursor = 'pointer';
            blockGroup.tabIndex = 0;
            blockGroup.setAttribute('role', 'button');
            blockGroup.setAttribute('aria-label', `Open ${block.id || `Block ${blockIdx + 1}`} for LED ${i + 1}`);
            activateOnKeyboard(blockGroup);

            // Block label
            const blockLabel = document.createElement('div');
            blockLabel.className = 'block-label';
            const repeatMeta = getBlockRepeatMeta(block);
            const flowRisk = hasContinuousFlowRisk(blocks, blockIdx);
            blockLabel.innerHTML = `
                <div class="block-label-content">
                    <span class="block-title-text">${escapeHtml(block.id || `Block ${blockIdx + 1}`)}</span>
                    <div class="block-badge-row">
                        <span class="block-badge ${repeatMeta.className}">${repeatMeta.label}</span>
                        ${flowRisk ? '<span class="block-badge is-warning">FLOW RISK</span>' : ''}
                    </div>
                </div>
            `;
            blockGroup.appendChild(blockLabel);

            // Steps
            const stepsContainer = document.createElement('div');
            stepsContainer.className = 'block-steps';

            block.steps.forEach((step, stepIdx) => {
                const pill = document.createElement('div');
                const safeStepType = ['ON', 'OFF', 'RAMP', 'SINE'].includes(step.type) ? step.type : 'OFF';
                pill.className = `step-pill type-${safeStepType.toLowerCase()}`;
                pill.style.cursor = 'pointer';
                pill.tabIndex = 0;
                pill.setAttribute('role', 'button');
                pill.setAttribute('aria-label', `Edit ${safeStepType} step ${stepIdx + 1} for LED ${i + 1}`);
                activateOnKeyboard(pill);

                let details = '';
                if (step.type === 'ON') details = `${step.duration_ms}ms @ ${step.int}`;
                else if (step.type === 'OFF') details = `${step.duration_ms}ms`;
                else if (step.type === 'RAMP') details = `${step.duration_ms}ms: ${step.int0}→${step.int1}`;
                else if (step.type === 'SINE') details = `${step.duration_ms}ms: ${step.freq}Hz`;

                pill.innerHTML = `
                    <span>${escapeHtml(safeStepType)}</span>
                    <span class="step-details">${escapeHtml(details)}</span>
                `;

                pill.addEventListener('click', (e) => {
                    e.stopPropagation();
                    focusEditorContext(i, blockIdx, stepIdx);
                });

                stepsContainer.appendChild(pill);
            });

            blockGroup.addEventListener('click', () => {
                focusEditorContext(i, blockIdx);
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
        emptyMsg.className = 'timeline-empty-state';
        emptyMsg.innerHTML = `
            <i class="fas fa-inbox" aria-hidden="true"></i>
            <div class="timeline-empty-copy">
                <div class="timeline-empty-title">No LED programs yet</div>
                <div class="timeline-empty-subtitle">Create steps in the editor to populate this overview.</div>
            </div>
        `;
        container.appendChild(emptyMsg);
    }
}

    fn.renderAllTimelinesModal = renderAllTimelinesModal;
})(window);
