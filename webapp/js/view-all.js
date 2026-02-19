(function initViewAllModule(global) {
    const App = global.App;
    const State = App.state;
    const fn = App.fn;
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

    fn.renderAllTimelinesModal = renderAllTimelinesModal;
})(window);
