document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // MODULE: STATE
    // ==========================================
    const NUM_LEDS = 24;
    const State = {
        programData: {},            // { "LED0": [...], ... }
        selectedLedIndices: new Set(),
        currentlyViewedLedIndex: null,
        currentStepType: 'ON',
    };

    function initState() {
        for (let i = 0; i < NUM_LEDS; i++) {
            State.programData[`LED${i}`] = [];
        }
        console.log("State initialized.");
    }

    // ==========================================
    // MODULE: TIMELINE
    // ==========================================
    const BLOCK_SIZE_SMALL_PX = 160;
    const BLOCK_SIZE_MEDIUM_PX = 240;
    const BLOCK_SIZE_LARGE_PX = 320;
    let timelineSortableInstance = null;

    function renderTimeline() {
        const timelineDisplayDiv = document.getElementById('timeline-display');
        const timelineLedLabel = document.getElementById('timeline-led-label');

        if (!timelineDisplayDiv) {
            console.error("Timeline display div not found!");
            return;
        }
        timelineDisplayDiv.innerHTML = '';

        // Update Label
        if (timelineLedLabel) {
            if (State.currentlyViewedLedIndex !== null) {
                timelineLedLabel.textContent = `LED ${State.currentlyViewedLedIndex + 1}`;
            } else {
                timelineLedLabel.textContent = 'No LED Selected for Timeline';
            }
        }

        // Destroy previous Sortable instance
        if (timelineSortableInstance) {
            timelineSortableInstance.destroy();
            timelineSortableInstance = null;
        }

        // Check if valid LED selected
        if (State.currentlyViewedLedIndex === null || !State.programData[`LED${State.currentlyViewedLedIndex}`]) {
            const noStepsMsg = document.createElement('p');
            noStepsMsg.className = 'has-text-centered has-text-grey p-4';
            noStepsMsg.textContent = (State.currentlyViewedLedIndex !== null)
                ? `LED ${State.currentlyViewedLedIndex + 1} has no steps yet.`
                : 'No LED selected to display timeline.';
            timelineDisplayDiv.appendChild(noStepsMsg);
            return;
        }

        const steps = State.programData[`LED${State.currentlyViewedLedIndex}`];

        if (steps.length === 0) {
            const noStepsMsg = document.createElement('p');
            noStepsMsg.className = 'has-text-centered has-text-grey p-4';
            noStepsMsg.textContent = `LED ${State.currentlyViewedLedIndex + 1} has no steps.`;
            timelineDisplayDiv.appendChild(noStepsMsg);
            return;
        }

        // Create Wrapper
        const timelineWrapper = document.createElement('div');
        timelineWrapper.style.display = 'flex';
        timelineWrapper.style.position = 'relative';
        timelineWrapper.style.minHeight = '100px';
        timelineWrapper.style.paddingTop = '25px';

        // Render Steps
        steps.forEach((step, originalIndex) => {
            const stepBlock = document.createElement('div');
            stepBlock.className = 'timeline-step-block draggable-step';
            stepBlock.dataset.stepOriginalIndex = originalIndex;

            // Dimensions
            const BLOCK_HEIGHT = 80;
            let blockWidth;
            if (step.duration_ms <= 2000) blockWidth = BLOCK_SIZE_SMALL_PX;
            else if (step.duration_ms <= 5000) blockWidth = BLOCK_SIZE_MEDIUM_PX;
            else blockWidth = BLOCK_SIZE_LARGE_PX;

            stepBlock.style.width = blockWidth + 'px';
            stepBlock.style.display = 'flex';
            stepBlock.style.flexDirection = 'column';
            stepBlock.style.marginRight = '5px';
            stepBlock.style.position = 'relative';
            stepBlock.style.boxSizing = 'border-box';

            // Visual Block
            const visualBlock = document.createElement('div');
            visualBlock.style.width = '100%';
            visualBlock.style.height = BLOCK_HEIGHT + 'px';
            visualBlock.style.border = '1px solid #ccc';
            visualBlock.style.backgroundColor = '#fafafa';
            visualBlock.style.position = 'relative';
            visualBlock.style.boxSizing = 'border-box';
            visualBlock.style.cursor = 'grab';

            // SVG
            const SVG_NS = "http://www.w3.org/2000/svg";
            const svg = document.createElementNS(SVG_NS, "svg");
            svg.setAttribute("width", blockWidth);
            svg.setAttribute("height", BLOCK_HEIGHT);
            svg.setAttribute("viewBox", "0 0 " + blockWidth + " " + BLOCK_HEIGHT);
            svg.style.display = 'block';
            svg.style.position = 'absolute';
            svg.style.top = '0';
            svg.style.left = '0';

            const MAX_INT = 1400;
            const Y_TOP = 5;
            const Y_BOTTOM = 75;
            const mapY = (intensity) => Y_BOTTOM - ((intensity / MAX_INT) * (Y_BOTTOM - Y_TOP));

            let desc = step.type;

            if (step.type === 'ON') {
                const y = mapY(step.int || 0);
                const rect = document.createElementNS(SVG_NS, "rect");
                rect.setAttribute("x", 0); rect.setAttribute("y", y);
                rect.setAttribute("width", blockWidth); rect.setAttribute("height", Y_BOTTOM - y);
                rect.setAttribute("fill", "#ffdd57"); rect.setAttribute("opacity", "0.4");
                svg.appendChild(rect);
                const line = document.createElementNS(SVG_NS, "line");
                line.setAttribute("x1", 0); line.setAttribute("y1", y);
                line.setAttribute("x2", blockWidth); line.setAttribute("y2", y);
                line.setAttribute("stroke", "#ffdd57"); line.setAttribute("stroke-width", 3);
                svg.appendChild(line);
                desc = "ON: " + step.int;
            } else if (step.type === 'OFF') {
                const y = mapY(0);
                const line = document.createElementNS(SVG_NS, "line");
                line.setAttribute("x1", 0); line.setAttribute("y1", y);
                line.setAttribute("x2", blockWidth); line.setAttribute("y2", y);
                line.setAttribute("stroke", "#ff3860"); line.setAttribute("stroke-width", 3);
                svg.appendChild(line);
                desc = "OFF";
            } else if (step.type === 'RAMP') {
                const y1 = mapY(step.int0 || 0);
                const y2 = mapY(step.int1 || 0);
                const line = document.createElementNS(SVG_NS, "line");
                line.setAttribute("x1", 0); line.setAttribute("y1", y1);
                line.setAttribute("x2", blockWidth); line.setAttribute("y2", y2);
                line.setAttribute("stroke", "#3273dc"); line.setAttribute("stroke-width", 3);
                svg.appendChild(line);
                desc = "RAMP: " + step.int0 + "->" + step.int1;
            } else if (step.type === 'SINE') {
                const mid = ((step.int0 || 0) + (step.int1 || 0)) / 2;
                const amp = Math.abs((step.int1 || 0) - (step.int0 || 0)) / 2;
                const freq = step.freq || 1;
                const durSec = step.duration_ms / 1000;
                let pathData = "";
                for (let px = 0; px <= blockWidth; px += 2) {
                    const t = (px / blockWidth) * durSec;
                    const intensity = mid + amp * Math.sin(2 * Math.PI * freq * t);
                    const y = mapY(intensity);
                    if (px === 0) pathData = "M " + px + " " + y;
                    else pathData += " L " + px + " " + y;
                }
                const path = document.createElementNS(SVG_NS, "path");
                path.setAttribute("d", pathData); path.setAttribute("fill", "none");
                path.setAttribute("stroke", "#b86bff"); path.setAttribute("stroke-width", 2);
                svg.appendChild(path);
                desc = "SINE: " + step.int0 + "~" + step.int1;
            }

            visualBlock.appendChild(svg);

            // Label
            const label = document.createElement('div');
            label.style.position = 'absolute'; label.style.bottom = '2px'; label.style.left = '4px';
            label.style.fontSize = '10px'; label.style.color = '#333'; label.style.pointerEvents = 'none';
            label.style.whiteSpace = 'nowrap'; label.textContent = desc + " (" + step.duration_ms + "ms)";
            visualBlock.appendChild(label);
            stepBlock.appendChild(visualBlock);

            // Controls Block
            const controlsBlock = document.createElement('div');
            controlsBlock.style.width = '100%'; controlsBlock.style.height = '24px';
            controlsBlock.style.display = 'flex'; controlsBlock.style.justifyContent = 'center'; controlsBlock.style.alignItems = 'center';

            const deleteBtn = document.createElement('div');
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
            deleteBtn.style.cursor = 'pointer'; deleteBtn.style.color = '#999'; deleteBtn.style.fontSize = '12px';
            deleteBtn.title = 'Delete this step';
            deleteBtn.addEventListener('mouseenter', () => deleteBtn.style.color = '#ff3860');
            deleteBtn.addEventListener('mouseleave', () => deleteBtn.style.color = '#999');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const currentLedKey = `LED${State.currentlyViewedLedIndex}`;
                if (State.programData[currentLedKey]) {
                    State.programData[currentLedKey].splice(originalIndex, 1);
                    renderTimeline();
                    document.dispatchEvent(new CustomEvent('programChanged', { detail: { ledIndex: State.currentlyViewedLedIndex } }));
                }
            });

            controlsBlock.appendChild(deleteBtn);
            stepBlock.appendChild(controlsBlock);
            stepBlock.title = desc + "\nDuration: " + step.duration_ms + "ms";
            timelineWrapper.appendChild(stepBlock);
        });

        timelineDisplayDiv.appendChild(timelineWrapper);

        // SortableJS
        if (steps.length > 0) {
            timelineSortableInstance = new Sortable(timelineWrapper, {
                animation: 150,
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                dragClass: 'sortable-drag',
                filter: '.timeline-time-marker',
                preventOnFilter: true,
                onEnd: function (evt) {
                    if (evt.oldIndex === evt.newIndex) return;
                    const programForCurrentLed = State.programData[`LED${State.currentlyViewedLedIndex}`];
                    if (programForCurrentLed) {
                        const [movedItem] = programForCurrentLed.splice(evt.oldIndex, 1);
                        programForCurrentLed.splice(evt.newIndex, 0, movedItem);
                        renderTimeline();
                        document.dispatchEvent(new CustomEvent('programChanged', { detail: { ledIndex: State.currentlyViewedLedIndex } }));
                    }
                }
            });
        }

        // Time Markers
        let currentPixelOffset = 0;
        let actualCumulativeTime = 0;
        steps.forEach((step) => {
            let blockWidthPx;
            if (step.duration_ms <= 2000) blockWidthPx = BLOCK_SIZE_SMALL_PX;
            else if (step.duration_ms <= 5000) blockWidthPx = BLOCK_SIZE_MEDIUM_PX;
            else blockWidthPx = BLOCK_SIZE_LARGE_PX;

            currentPixelOffset += blockWidthPx + 5;
            actualCumulativeTime += step.duration_ms;

            const timeMarker = document.createElement('div');
            timeMarker.className = 'timeline-time-marker';
            timeMarker.style.position = 'absolute';
            timeMarker.style.left = `${currentPixelOffset - 2.5}px`;
            timeMarker.style.top = '5px';
            timeMarker.style.height = 'calc(100% + 10px)';
            timeMarker.style.fontSize = '0.7em';
            timeMarker.style.borderLeft = '1px dotted #555';
            timeMarker.style.paddingLeft = '3px';
            timeMarker.innerHTML = `${actualCumulativeTime}<span style="font-size:0.8em;">ms</span>`;
            timelineWrapper.appendChild(timeMarker);
        });
    }

    // ==========================================
    // MODULE: IO
    // ==========================================
    function exportProgram() {
        let hasAnySteps = false;
        for (const ledKey in State.programData) {
            if (State.programData[ledKey].length > 0) {
                hasAnySteps = true; break;
            }
        }
        if (!hasAnySteps) return alert("The program is empty. Add some steps before exporting.");

        const hoursInput = document.getElementById('run-time-hours');
        const minutesInput = document.getElementById('run-time-minutes');
        const secondsInput = document.getElementById('run-time-seconds');

        let totalMinutes = 0;
        if (hoursInput && minutesInput && secondsInput) {
            const h = parseInt(hoursInput.value) || 0;
            const m = parseInt(minutesInput.value) || 0;
            const s = parseInt(secondsInput.value) || 0;
            totalMinutes = (h * 60) + m + (s / 60);
            totalMinutes = parseFloat(totalMinutes.toFixed(4));
        }

        const exportData = { ...State.programData, total_duration_minutes: totalMinutes };
        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'program.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
        console.log("Exported program.json with duration:", totalMinutes, "minutes");
        alert("program.json has been exported!");
    }

    function loadProgram(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const loadedProgram = JSON.parse(e.target.result);
                if (typeof loadedProgram !== 'object' || loadedProgram === null) throw new Error("Invalid JSON structure.");

                const loadedTotalMinutes = loadedProgram.total_duration_minutes || 0;
                delete loadedProgram.total_duration_minutes;

                State.programData = loadedProgram;
                console.log("Program loaded.");

                const hoursInput = document.getElementById('run-time-hours');
                const minutesInput = document.getElementById('run-time-minutes');
                const secondsInput = document.getElementById('run-time-seconds');
                if (hoursInput && minutesInput && secondsInput) {
                    const totalSeconds = Math.round(loadedTotalMinutes * 60);
                    hoursInput.value = Math.floor(totalSeconds / 3600);
                    minutesInput.value = Math.floor((totalSeconds % 3600) / 60);
                    secondsInput.value = totalSeconds % 60;
                }
                alert("Program loaded successfully!");
                renderTimeline();
                document.dispatchEvent(new CustomEvent('programLoaded'));
            } catch (error) {
                console.error("Error loading program:", error);
                alert(`Error loading program: ${error.message}`);
            }
        };
        reader.readAsText(file);
    }

    // ==========================================
    // MODULE: UI CONTROLS
    // ==========================================

    // Helpers
    function createBtn(content, className, onClick) {
        const btn = document.createElement('button');
        if (typeof content === 'string') {
            btn.textContent = content;
            if (className) btn.className = className;
        } else {
            btn.innerHTML = `<span class="icon is-small"><i class="fas ${content.icon}"></i></span><span>${content.text}</span>`;
            if (content.cls) btn.className = content.cls;
        }
        btn.addEventListener('click', onClick);
        return btn;
    }

    function updateAllLedButtonAppearances(allLedButtons) {
        allLedButtons.forEach(btn => {
            const id = parseInt(btn.dataset.ledId);
            btn.classList.remove('is-info', 'is-success', 'is-outlined');
            if (id === State.currentlyViewedLedIndex) btn.classList.add('is-success');
            else if (State.selectedLedIndices.has(id)) btn.classList.add('is-info');
            else btn.classList.add('is-outlined');
        });
    }

    function updateLedOutline(ledIndex, allLedButtons) {
        const btn = allLedButtons[ledIndex];
        if (State.programData[`LED${ledIndex}`].length > 0) btn.classList.add('has-program');
        else btn.classList.remove('has-program');
    }

    function updateStepEditorForm() {
        ['params-on', 'params-ramp', 'params-sine'].forEach(id => {
            const d = document.getElementById(id);
            if (d) d.style.display = 'none';
        });
        document.getElementById('params-duration').style.display = 'block';

        const type = State.currentStepType;
        if (type === 'ON') document.getElementById('params-on').style.display = 'block';
        if (type === 'RAMP') document.getElementById('params-ramp').style.display = 'block';
        if (type === 'SINE') document.getElementById('params-sine').style.display = 'block';
    }

    function initUI() {
        const ledGridPane = document.getElementById('led-grid-pane');
        const ledSelectionBoxContent = ledGridPane.querySelector('.box');

        const placeholderText = ledSelectionBoxContent.querySelector('p');
        if (placeholderText && placeholderText.textContent.includes('Loading grid...')) {
            placeholderText.remove();
        }

        // LED Grid
        const allLedButtons = [];
        const gridContainer = document.createElement('div');
        gridContainer.className = 'led-grid-actual mb-4';
        gridContainer.style.display = 'grid';
        gridContainer.style.gridTemplateColumns = `repeat(6, 1fr)`;
        gridContainer.style.gap = '0.5rem';

        for (let i = 0; i < NUM_LEDS; i++) {
            const ledButton = document.createElement('button');
            ledButton.className = 'button is-rounded is-outlined led-button';
            ledButton.textContent = i + 1;
            ledButton.dataset.ledId = i;

            ledButton.addEventListener('click', (event) => {
                const ledId = parseInt(ledButton.dataset.ledId);
                const isCtrlClick = event.ctrlKey || event.metaKey;

                if (isCtrlClick) {
                    if (State.selectedLedIndices.has(ledId)) State.selectedLedIndices.delete(ledId);
                    else State.selectedLedIndices.add(ledId);
                } else {
                    if (State.selectedLedIndices.has(ledId) && State.selectedLedIndices.size === 1) State.selectedLedIndices.clear();
                    else {
                        State.selectedLedIndices.clear();
                        State.selectedLedIndices.add(ledId);
                    }
                }
                State.currentlyViewedLedIndex = ledId;
                updateAllLedButtonAppearances(allLedButtons);
                renderTimeline();
            });

            gridContainer.appendChild(ledButton);
            allLedButtons.push(ledButton);
        }
        ledSelectionBoxContent.appendChild(gridContainer);

        // Action Buttons
        const ledActionsContainer = document.createElement('div');
        ledActionsContainer.className = 'field is-grouped is-grouped-multiline mt-4';

        ledActionsContainer.appendChild(createBtn('Select All', 'button control', () => {
            allLedButtons.forEach(btn => State.selectedLedIndices.add(parseInt(btn.dataset.ledId)));
            updateAllLedButtonAppearances(allLedButtons);
        }));

        ledActionsContainer.appendChild(createBtn('Select None', 'button control', () => {
            State.selectedLedIndices.clear();
            updateAllLedButtonAppearances(allLedButtons);
        }));

        ledActionsContainer.appendChild(createBtn({ icon: 'fa-eraser', text: 'Clear Selected', cls: 'button is-warning control' }, null, () => {
            if (State.selectedLedIndices.size === 0) return alert("Select LEDs first.");
            if (!confirm(`Clear program for ${State.selectedLedIndices.size} LEDs?`)) return;
            State.selectedLedIndices.forEach(idx => {
                State.programData[`LED${idx}`] = [];
                updateLedOutline(idx, allLedButtons);
            });
            if (State.currentlyViewedLedIndex !== null && State.selectedLedIndices.has(State.currentlyViewedLedIndex)) {
                renderTimeline();
            }
        }));
        ledSelectionBoxContent.appendChild(ledActionsContainer);

        // Step Editor
        const stepTypeButtons = document.querySelectorAll('.step-type-btn');
        stepTypeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                State.currentStepType = btn.dataset.value;
                stepTypeButtons.forEach(b => b.classList.remove('is-selected', 'is-info'));
                btn.classList.add('is-selected', 'is-info');
                updateStepEditorForm();
            });
        });
        updateStepEditorForm(); // Initial call

        // Add Step
        const addStepButton = document.getElementById('add-step-button');
        if (addStepButton) {
            addStepButton.addEventListener('click', () => {
                if (State.selectedLedIndices.size === 0) return alert("Select LEDs first.");
                const durationInput = document.getElementById('step-duration');
                const dur = parseInt(durationInput.value);
                if (isNaN(dur) || dur < 50) return alert("Duration must be >= 50ms");

                const type = State.currentStepType;
                let step = { type, duration_ms: dur };
                const clamp = (val, max) => Math.max(0, Math.min(max, parseInt(val) || 0));

                if (type === 'ON') step.int = clamp(document.getElementById('on-int').value, 1400);
                else if (type === 'RAMP') {
                    step.int0 = clamp(document.getElementById('ramp-int0').value, 1400);
                    step.int1 = clamp(document.getElementById('ramp-int1').value, 1400);
                } else if (type === 'SINE') {
                    step.int0 = clamp(document.getElementById('sine-int0').value, 1400);
                    step.int1 = clamp(document.getElementById('sine-int1').value, 1400);
                    let f = parseFloat(document.getElementById('sine-freq').value) || 0;
                    step.freq = Math.min(20, Math.max(0, f));
                }

                State.selectedLedIndices.forEach(idx => {
                    State.programData[`LED${idx}`].push(step);
                });
                document.dispatchEvent(new CustomEvent('programChanged'));
                renderTimeline();
            });
        }

        // Export/Import
        const exportButton = document.getElementById('export-button');
        if (exportButton) exportButton.addEventListener('click', exportProgram);

        const loadButton = document.getElementById('load-program-button');
        const fileInput = document.getElementById('file-input');
        if (loadButton && fileInput) {
            loadButton.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => {
                if (e.target.files[0]) {
                    loadProgram(e.target.files[0]);
                    e.target.value = '';
                }
            });
        }

        // --- DARK MODE LOGIC ---
        const darkModeToggleButton = document.getElementById('darkModeToggle');
        const htmlElement = document.documentElement;

        function applyTheme(theme) {
            if (theme === 'dark') {
                htmlElement.classList.add('dark-mode');
                if (darkModeToggleButton) {
                    darkModeToggleButton.querySelector('i').classList.remove('fa-moon');
                    darkModeToggleButton.querySelector('i').classList.add('fa-sun');
                }
            } else {
                htmlElement.classList.remove('dark-mode');
                if (darkModeToggleButton) {
                    darkModeToggleButton.querySelector('i').classList.remove('fa-sun');
                    darkModeToggleButton.querySelector('i').classList.add('fa-moon');
                }
            }
        }

        if (darkModeToggleButton) {
            darkModeToggleButton.addEventListener('click', () => {
                const currentTheme = htmlElement.classList.contains('dark-mode') ? 'dark' : 'light';
                const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
                applyTheme(newTheme);
                localStorage.setItem('theme', newTheme);
            });
        }

        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) applyTheme(savedTheme);
        else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) applyTheme('dark');
        else applyTheme('light');

        // Events
        document.addEventListener('programChanged', (e) => {
            if (e.detail && e.detail.ledIndex !== undefined) updateLedOutline(e.detail.ledIndex, allLedButtons);
            else allLedButtons.forEach((_, idx) => updateLedOutline(idx, allLedButtons));
        });
        document.addEventListener('programLoaded', () => {
            allLedButtons.forEach((_, idx) => updateLedOutline(idx, allLedButtons));
            // Also update the time picker display when loading
            updateTimePickerDisplay();
        });

        // ==========================================
        // TIME PICKER MODAL
        // ==========================================
        const timePickerDisplay = document.getElementById('time-picker-display');
        const timePickerModal = document.getElementById('time-picker-modal');
        const timeDisplayText = document.getElementById('time-display-text');
        const spinnerHours = document.getElementById('spinner-hours');
        const spinnerMinutes = document.getElementById('spinner-minutes');
        const spinnerSeconds = document.getElementById('spinner-seconds');
        const hiddenHours = document.getElementById('run-time-hours');
        const hiddenMinutes = document.getElementById('run-time-minutes');
        const hiddenSeconds = document.getElementById('run-time-seconds');
        const confirmBtn = document.getElementById('time-picker-confirm');
        const cancelBtn = document.getElementById('time-picker-cancel');

        // Temp values while modal is open
        let tempHours = 0, tempMinutes = 0, tempSeconds = 0;

        function pad(n) { return n.toString().padStart(2, '0'); }

        function updateTimePickerDisplay() {
            const h = parseInt(hiddenHours.value) || 0;
            const m = parseInt(hiddenMinutes.value) || 0;
            const s = parseInt(hiddenSeconds.value) || 0;
            timeDisplayText.textContent = `${pad(h)}:${pad(m)}:${pad(s)}`;
        }

        function openModal() {
            tempHours = parseInt(hiddenHours.value) || 0;
            tempMinutes = parseInt(hiddenMinutes.value) || 0;
            tempSeconds = parseInt(hiddenSeconds.value) || 0;
            spinnerHours.value = pad(tempHours);
            spinnerMinutes.value = pad(tempMinutes);
            spinnerSeconds.value = pad(tempSeconds);
            timePickerModal.classList.add('is-active');
        }

        function closeModal() {
            timePickerModal.classList.remove('is-active');
        }

        function confirmTime() {
            // Read from inputs in case user typed directly
            tempHours = Math.max(0, Math.min(99, parseInt(spinnerHours.value) || 0));
            tempMinutes = Math.max(0, Math.min(59, parseInt(spinnerMinutes.value) || 0));
            tempSeconds = Math.max(0, Math.min(59, parseInt(spinnerSeconds.value) || 0));

            hiddenHours.value = tempHours;
            hiddenMinutes.value = tempMinutes;
            hiddenSeconds.value = tempSeconds;
            updateTimePickerDisplay();
            closeModal();
        }

        // Spinner button handling
        function adjustValue(unit, direction) {
            // First read current value from input
            if (unit === 'hours') {
                tempHours = parseInt(spinnerHours.value) || 0;
                tempHours += direction;
                if (tempHours < 0) tempHours = 99;
                if (tempHours > 99) tempHours = 0;
                spinnerHours.value = pad(tempHours);
            } else if (unit === 'minutes') {
                tempMinutes = parseInt(spinnerMinutes.value) || 0;
                tempMinutes += direction;
                if (tempMinutes < 0) tempMinutes = 59;
                if (tempMinutes > 59) tempMinutes = 0;
                spinnerMinutes.value = pad(tempMinutes);
            } else if (unit === 'seconds') {
                tempSeconds = parseInt(spinnerSeconds.value) || 0;
                tempSeconds += direction;
                if (tempSeconds < 0) tempSeconds = 59;
                if (tempSeconds > 59) tempSeconds = 0;
                spinnerSeconds.value = pad(tempSeconds);
            }
        }

        // Event Listeners
        if (timePickerDisplay) {
            timePickerDisplay.addEventListener('click', openModal);
        }
        if (confirmBtn) {
            confirmBtn.addEventListener('click', confirmTime);
        }
        if (cancelBtn) {
            cancelBtn.addEventListener('click', closeModal);
        }

        // Spinner buttons
        document.querySelectorAll('.time-spinner-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const unit = btn.dataset.unit;
                const direction = btn.classList.contains('up') ? 1 : -1;
                adjustValue(unit, direction);
            });
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && timePickerModal.classList.contains('is-active')) {
                closeModal();
            }
        });

        // Close on overlay click (outside modal box)
        timePickerModal.addEventListener('click', (e) => {
            if (e.target === timePickerModal) {
                closeModal();
            }
        });

        // Initialize display
        updateTimePickerDisplay();
    }

    // ==========================================
    // INITIALIZATION
    // ==========================================
    initState();
    initUI();
    renderTimeline();
});
