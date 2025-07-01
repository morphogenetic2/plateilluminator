document.addEventListener('DOMContentLoaded', () => {
    const ledGridPane = document.getElementById('led-grid-pane');
    const ledSelectionBoxContent = ledGridPane.querySelector('.box');

    const placeholderText = ledSelectionBoxContent.querySelector('p');
    if (placeholderText && placeholderText.textContent.includes('Loading grid...')) {
        placeholderText.remove();
    }

    const numRows = 4;
    const numCols = 6;
    const totalLeds = numRows * numCols;

    // --- State for selected LEDs ---
    let selectedLedIndices = new Set(); // Use a Set to store 0-based indices of selected LEDs

    // --- Helper function to update button appearance ---
    function updateAllLedButtonAppearances() {
        allLedButtons.forEach(btn => {
            const ledId = parseInt(btn.dataset.ledId);
            const isSelected = selectedLedIndices.has(ledId);
            const isCurrentlyViewed = (ledId === currentlyViewedLedIndex);

            // Reset classes first
            btn.classList.remove('is-info', 'is-success', 'is-outlined');

            if (isCurrentlyViewed) {
                btn.classList.add('is-success'); // Green for the timeline-active LED
            } else if (isSelected) {
                btn.classList.add('is-info'); // Blue for other selected LEDs
            } else {
                btn.classList.add('is-outlined'); // Default outlined for non-selected
            }
        });
    }

    // --- Create the LED Grid ---
    const gridContainer = document.createElement('div');
    gridContainer.className = 'led-grid-actual mb-4';
    gridContainer.style.display = 'grid';
    gridContainer.style.gridTemplateColumns = `repeat(${numCols}, 1fr)`;
    gridContainer.style.gap = '0.5rem';



    // Store all LED button elements for easy access later
    const allLedButtons = [];

    for (let i = 0; i < totalLeds; i++) {
        const ledButton = document.createElement('button');
        const ledDisplayNumber = i + 1;

        ledButton.className = 'button is-rounded is-outlined led-button';
        ledButton.textContent = ledDisplayNumber;
        ledButton.dataset.ledId = i; // 0-based index

        // Event Listener for individual LED button clicks
        ledButton.addEventListener('click', (event) => {
            const ledId = parseInt(ledButton.dataset.ledId);
            const isCtrlClick = event.ctrlKey || event.metaKey; // metaKey for macOS Command

            if (isCtrlClick) {
                // --- Multi-selection logic ---
                if (selectedLedIndices.has(ledId)) {
                    selectedLedIndices.delete(ledId);
                } else {
                    selectedLedIndices.add(ledId);
                }
            } else {
                // --- Single-selection logic ---
                // If the clicked LED is the only one selected, deselect it.
                // Otherwise, clear the selection and select only the clicked LED.
                if (selectedLedIndices.has(ledId) && selectedLedIndices.size === 1) {
                    selectedLedIndices.clear();
                } else {
                    selectedLedIndices.clear();
                    selectedLedIndices.add(ledId);
                }
            }

            // Set the timeline to the most recently clicked LED
            currentlyViewedLedIndex = ledId;

            console.log("Selected LEDs:", Array.from(selectedLedIndices).sort((a,b)=>a-b));
            updateAllLedButtonAppearances();
            renderTimeline();
        });

        gridContainer.appendChild(ledButton);
        allLedButtons.push(ledButton); // Add to our array
    }
    ledSelectionBoxContent.appendChild(gridContainer);

    // --- Helper function to update button appearance based on program existence ---
    function updateLedProgramOutline(ledIndex) {
        const ledButton = allLedButtons[ledIndex];
        if (!ledButton) return;

        const ledKey = `LED${ledIndex}`;
        const hasProgram = programData[ledKey] && programData[ledKey].length > 0;

        if (hasProgram) {
            ledButton.classList.add('has-program');
        } else {
            ledButton.classList.remove('has-program');
        }
    }

    function updateAllLedOutlines() {
        allLedButtons.forEach((btn, index) => updateLedProgramOutline(index));
    }

    // --- Create Select All / Select None buttons ---
        // ---- MODIFIED/NEW SECTION for action buttons in LED Selection ----
    const ledActionsContainer = document.createElement('div');
    ledActionsContainer.className = 'field is-grouped is-grouped-multiline mt-4'; // For better wrapping if needed

    // Select All Button (ensure it's created and added here)
    const selectAllButton = document.createElement('button');
    selectAllButton.className = 'button control'; // Added 'control' for grouping
    selectAllButton.id = 'select-all-leds';
    selectAllButton.textContent = 'Select All';
    selectAllButton.addEventListener('click', () => {
        allLedButtons.forEach(btn => {
            const ledId = parseInt(btn.dataset.ledId);
            selectedLedIndices.add(ledId);
        });
        updateAllLedButtonAppearances();
        console.log("Selected LEDs:", Array.from(selectedLedIndices).sort((a,b)=>a-b) );
        // No timeline update needed here unless your logic changes
    });
    ledActionsContainer.appendChild(selectAllButton);


    // Select None Button (ensure it's created and added here)
    const selectNoneButton = document.createElement('button');
    selectNoneButton.className = 'button control'; // Added 'control'
    selectNoneButton.id = 'select-none-leds';
    selectNoneButton.textContent = 'Select None';
    selectNoneButton.addEventListener('click', () => {
        selectedLedIndices.clear();
        updateAllLedButtonAppearances();
        console.log("Selected LEDs:", Array.from(selectedLedIndices).sort((a,b)=>a-b) );
        if (currentlyViewedLedIndex !== null && !selectedLedIndices.has(currentlyViewedLedIndex)) {
            // If the timeline LED is no longer selected, perhaps clear timeline or show "no selection"
            // For now, timeline stays on the last explicitly clicked LED.
        }
        // renderTimeline(); // Only if deselection should immediately clear timeline for a deselected viewed LED
    });
    ledActionsContainer.appendChild(selectNoneButton);


    // **NEW** Clear Program for Selected LEDs Button
    const clearSelectedProgramButton = document.createElement('button');
    clearSelectedProgramButton.className = 'button is-warning control'; // 'is-warning' for a bit of caution
    clearSelectedProgramButton.id = 'clear-selected-program';
    clearSelectedProgramButton.innerHTML = '<span class="icon is-small"><i class="fas fa-eraser"></i></span><span>Clear Selected</span>'; // Icon + Text

    clearSelectedProgramButton.addEventListener('click', () => {
        if (selectedLedIndices.size === 0) {
            alert("Please select one or more LEDs to clear their program.");
            return;
        }

        // Confirmation dialog
        if (!confirm(`Are you sure you want to clear the program for ${selectedLedIndices.size} selected LED(s)? This cannot be undone.`)) {
            return;
        }

        let clearedAtLeastOne = false;
        selectedLedIndices.forEach(ledIndex => {
            const ledKey = `LED${ledIndex}`;
            if (programData[ledKey] && programData[ledKey].length > 0) {
                programData[ledKey] = []; // Reset the array of steps to empty
                clearedAtLeastOne = true;
                updateLedProgramOutline(ledIndex); // Update outline
            }
        });

        if (clearedAtLeastOne) {
            console.log("Program cleared for selected LEDs. programData:", JSON.parse(JSON.stringify(programData)));
            alert("Program for selected LED(s) has been cleared.");
            // If the currently viewed timeline LED was among those cleared, its timeline needs to update
            if (currentlyViewedLedIndex !== null && selectedLedIndices.has(currentlyViewedLedIndex)) {
                renderTimeline();
            }
        } else {
            alert("Selected LED(s) already have an empty program.");
        }
    });
    ledActionsContainer.appendChild(clearSelectedProgramButton); // Add the new button

    // Append the container with all three buttons
    ledSelectionBoxContent.appendChild(ledActionsContainer);

    console.log('LED Grid interaction enabled!');

    // --- Step Editor Logic ---
    const stepTypeSelect = document.getElementById('step-type');
    const paramsOnDiv = document.getElementById('params-on');
    const paramsRampDiv = document.getElementById('params-ramp');
    const paramsSineDiv = document.getElementById('params-sine');
    const paramsDurationDiv = document.getElementById('params-duration'); // Get the duration field group

    // Store all parameter divs in an array for easy iteration
    const allParamDivs = [paramsOnDiv, paramsRampDiv, paramsSineDiv];

    function updateStepEditorForm() {
        const selectedType = stepTypeSelect.value;

        // Hide all specific parameter divs first
        allParamDivs.forEach(div => {
            if (div) div.style.display = 'none';
        });
        // Always show duration for now, will refine for OFF type
        if (paramsDurationDiv) paramsDurationDiv.style.display = 'block';


        // Show the relevant div based on selected type
        if (selectedType === 'ON') {
            if (paramsOnDiv) paramsOnDiv.style.display = 'block';
        } else if (selectedType === 'RAMP') {
            if (paramsRampDiv) paramsRampDiv.style.display = 'block';
        } else if (selectedType === 'SINE') {
            if (paramsSineDiv) paramsSineDiv.style.display = 'block';
        } else if (selectedType === 'OFF') {
            // For OFF, we might not need any specific params, and duration is still relevant.
            // Or hide duration if OFF steps have no duration in your system?
            // For now, OFF shows only duration.
            if (paramsDurationDiv) paramsDurationDiv.style.display = 'block'; // Ensure duration is visible
        }
    }

    // Add event listener to the step type dropdown
    if (stepTypeSelect) {
        stepTypeSelect.addEventListener('change', updateStepEditorForm);
    }

    // Call it once on page load to set the initial state based on the default dropdown value
    updateStepEditorForm();

    console.log('Step Editor form initialized!');

    // --- Program Data Structure ---
    let programData = {}; // Stores the program for all LEDs
    const NUM_LEDS = 24; // From your Python script

    // Initialize programData with empty arrays for each LED
    for (let i = 0; i < NUM_LEDS; i++) {
        programData[`LED${i}`] = [];
    }
    console.log("Initial programData:", JSON.parse(JSON.stringify(programData))); // Deep copy for clean log

    // --- "Add Step" Button Logic ---
    const addStepButton = document.getElementById('add-step-button');

    // Get references to all input fields (do this once)
    const onIntInput = document.getElementById('on-int');
    const rampInt0Input = document.getElementById('ramp-int0');
    const rampInt1Input = document.getElementById('ramp-int1');
    const sineInt0Input = document.getElementById('sine-int0');
    const sineInt1Input = document.getElementById('sine-int1');
    const sineFreqInput = document.getElementById('sine-freq');
    const stepDurationInput = document.getElementById('step-duration');


        if (addStepButton) {
        addStepButton.addEventListener('click', () => {
            const type = stepTypeSelect.value;
            let durationMs = parseInt(stepDurationInput.value);

            // --- Get references to input fields (already defined outside this listener) ---
            // const onIntInput = document.getElementById('on-int');
            // const rampInt0Input = document.getElementById('ramp-int0');
            // ... etc.

            const MAX_INTENSITY = 1400;
            const MIN_DURATION = 50; // Minimum allowed duration in ms

            if (selectedLedIndices.size === 0) {
                alert("Please select at least one LED before adding a step.");
                return;
            }

            // --- Validate and Clamp Duration ---
            if (isNaN(durationMs) || durationMs < MIN_DURATION) {
                alert(`Duration must be a number and at least ${MIN_DURATION} ms.`);
                stepDurationInput.value = MIN_DURATION; // Correct the input field
                // Optionally focus the field: stepDurationInput.focus();
                return;
            }

            let step = {
                type: type,
                duration_ms: durationMs
            };

            // --- Helper function for clamping intensity ---
            function clampIntensity(value) {
                let numValue = parseInt(value);
                if (isNaN(numValue)) numValue = 0; // Default to 0 if not a number
                if (numValue < 0) return 0;
                if (numValue > MAX_INTENSITY) return MAX_INTENSITY;
                return numValue;
            }

            // --- Helper function for clamping frequency ---
            function clampFrequency(value) {
                let numValue = parseFloat(value);
                if (isNaN(numValue)) numValue = 0;
                if (numValue < 0) return 0;
                return numValue;
            }


            // Add type-specific parameters with validation and clamping
            switch (type) {
                case 'ON':
                    const onIntValue = clampIntensity(onIntInput.value);
                    step.int = onIntValue;
                    onIntInput.value = onIntValue; // Update input field if clamped
                    break;
                case 'RAMP':
                    const rampInt0Value = clampIntensity(rampInt0Input.value);
                    const rampInt1Value = clampIntensity(rampInt1Input.value);
                    step.int0 = rampInt0Value;
                    step.int1 = rampInt1Value;
                    rampInt0Input.value = rampInt0Value; // Update input fields
                    rampInt1Input.value = rampInt1Value;
                    break;
                case 'SINE':
                    const sineInt0Value = clampIntensity(sineInt0Input.value);
                    const sineInt1Value = clampIntensity(sineInt1Input.value);
                    const sineFreqValue = clampFrequency(sineFreqInput.value);
                    step.int0 = sineInt0Value;
                    step.int1 = sineInt1Value;
                    step.freq = sineFreqValue;
                    sineInt0Input.value = sineInt0Value; // Update input fields
                    sineInt1Input.value = sineInt1Value;
                    sineFreqInput.value = sineFreqValue;

                    // Optional: Ensure int0 <= int1 for SINE/RAMP if that's a logical requirement
                    if (step.int0 > step.int1 && (type === 'SINE' || type === 'RAMP')) {
                            // Swap them or alert, for now, let's just note it.
                            // console.warn(`${type}: int0 (${step.int0}) is greater than int1 (${step.int1}). Consider handling this.`);
                            // For simplicity, we'll allow it, Python script might handle it or user needs to be aware
                    }
                    break;
                case 'OFF':
                    // No intensity/frequency params for OFF
                    break;
            }

            // Add the created step to all currently selected LEDs
            selectedLedIndices.forEach(ledIndex => {
                if (!programData[`LED${ledIndex}`]) {
                    programData[`LED${ledIndex}`] = [];
                }
                programData[`LED${ledIndex}`].push(step);
                updateLedProgramOutline(ledIndex); // Update outline
            });

            console.log("Updated programData (with validation):", JSON.parse(JSON.stringify(programData)));
            // No need for an alert here if the timeline updates, or make it a less intrusive notification
            // alert(`Step added to ${selectedLedIndices.size} LED(s)!`);

            renderTimeline(); // Update the visual timeline
        });
    }


const removeStepButton = document.getElementById('remove-step-button');

    if (removeStepButton) {
        removeStepButton.addEventListener('click', () => {
            if (selectedLedIndices.size === 0) {
                alert("Please select at least one LED from which to remove a step.");
                return;
            }

            let
             removedStepFromAtLeastOne = false;
            selectedLedIndices.forEach(ledIndex => {
                const ledKey = `LED${ledIndex}`;
                if (programData[ledKey] && programData[ledKey].length > 0) {
                    programData[ledKey].pop(); // .pop() removes the last element from an array
                    removedStepFromAtLeastOne = true;
                    updateLedProgramOutline(ledIndex); // Update outline
                }
            });

            if (removedStepFromAtLeastOne) {
                console.log("After removing step - programData:", JSON.parse(JSON.stringify(programData)));
                alert(`Last step removed from selected LED(s) where applicable. Check the console.`);
            } else {
                alert("No steps to remove from the selected LED(s).");
            }

            renderTimeline();
        });
    }

    console.log('Remove Step button initialized!'); // Add this new log

    
    const timelineDisplayDiv = document.getElementById('timeline-display');
    const timelineLedLabel = document.getElementById('timeline-led-label'); // Get the span for the label

    // --- State for currently viewed timeline ---
    let currentlyViewedLedIndex = null; // 0-based index

    // --- Function to update the timeline display ---
        // --- Function to update the timeline display ---
    // Ensure 'timelineSortableInstance' is declared outside this function, e.g., let timelineSortableInstance = null;
    // Ensure 'programData', 'currentlyViewedLedIndex', 'timelineDisplayDiv', 'timelineLedLabel' are accessible in this scope.

    timelineSortableInstance = null;

    function renderTimeline() {
        if (!timelineDisplayDiv) {
            console.error("Timeline display div not found!");
            return;
        }
        timelineDisplayDiv.innerHTML = ''; // Clear previous timeline content

        if (timelineLedLabel) {
            if (currentlyViewedLedIndex !== null) {
                timelineLedLabel.textContent = `LED ${currentlyViewedLedIndex + 1}`;
            } else {
                timelineLedLabel.textContent = 'No LED Selected for Timeline';
            }
        }

        // Destroy previous Sortable instance if it exists
        if (timelineSortableInstance) {
            timelineSortableInstance.destroy();
            timelineSortableInstance = null;
        }

        if (currentlyViewedLedIndex === null || !programData[`LED${currentlyViewedLedIndex}`]) {
            const noStepsMsg = document.createElement('p');
            noStepsMsg.className = 'has-text-centered has-text-grey p-4';
            noStepsMsg.textContent = (currentlyViewedLedIndex !== null) ? `LED ${currentlyViewedLedIndex + 1} has no steps yet.` : 'No LED selected to display timeline.';
            timelineDisplayDiv.appendChild(noStepsMsg);
            return;
        }

        const steps = programData[`LED${currentlyViewedLedIndex}`];

        if (steps.length === 0) {
            const noStepsMsg = document.createElement('p');
            noStepsMsg.className = 'has-text-centered has-text-grey p-4';
            noStepsMsg.textContent = `LED ${currentlyViewedLedIndex + 1} has no steps.`;
            timelineDisplayDiv.appendChild(noStepsMsg);
            return;
        }

        // Define Block Sizes
        const BLOCK_SIZE_SMALL_PX = 160; // Was 80
        const BLOCK_SIZE_MEDIUM_PX = 240; // Was 120
        const BLOCK_SIZE_LARGE_PX = 320; // Was 160

        const timelineWrapper = document.createElement('div');
        // Optional: Give it a unique ID if needed for complex scenarios, though destroying instance is primary
        // timelineWrapper.id = `timeline-wrapper-led-${currentlyViewedLedIndex}`;
        timelineWrapper.style.display = 'flex';
        timelineWrapper.style.position = 'relative';
        timelineWrapper.style.minHeight = '100px';
        timelineWrapper.style.paddingTop = '25px'; // Space for time markers above

        steps.forEach((step, originalIndex) => {
            const stepBlock = document.createElement('div');
            stepBlock.className = 'timeline-step-block draggable-step'; // For styling and SortableJS
            stepBlock.dataset.stepOriginalIndex = originalIndex; // Store original index before any sorts

            stepBlock.style.minHeight = '80px';
            stepBlock.style.border = '1px solid #ccc';
            stepBlock.style.marginRight = '5px';
            stepBlock.style.padding = '5px';
            stepBlock.style.fontSize = '0.8em';
            stepBlock.style.overflow = 'hidden'; // Or 'auto' if content might exceed
            stepBlock.style.position = 'relative';

            // Assign categorized width
            if (step.duration_ms <= 2000) {
                stepBlock.style.width = `${BLOCK_SIZE_SMALL_PX}px`;
            } else if (step.duration_ms <= 5000) {
                stepBlock.style.width = `${BLOCK_SIZE_MEDIUM_PX}px`;
            } else {
                stepBlock.style.width = `${BLOCK_SIZE_LARGE_PX}px`;
            }

            let stepContent = `<strong>${step.type.toUpperCase()}</strong><br>`;
            switch (step.type) {
                case 'ON':
                    stepBlock.style.backgroundColor = 'lightgreen';
                    stepContent += `Int: ${step.int}<br>Dur: ${step.duration_ms}ms`;
                    break;
                case 'OFF':
                    stepBlock.style.backgroundColor = 'lightcoral';
                    stepContent += `Dur: ${step.duration_ms}ms`;
                    break;
                case 'RAMP':
                    stepBlock.style.backgroundColor = 'lightskyblue';
                    stepContent += `${step.int0}➔${step.int1}<br>Dur: ${step.duration_ms}ms`;
                    break;
                case 'SINE':
                    stepBlock.style.backgroundColor = 'lightgoldenrodyellow';
                    stepContent += `${step.int0}~${step.int1}<br>F:${step.freq}Hz<br>Dur:${step.duration_ms}ms`;
                    break;
                default:
                    stepBlock.style.backgroundColor = 'lightgrey';
                    stepContent += `Dur: ${step.duration_ms}ms`; // Fallback content
            }
            stepBlock.innerHTML = stepContent;
            timelineWrapper.appendChild(stepBlock);
        });

        timelineDisplayDiv.appendChild(timelineWrapper); // Add wrapper to DOM before initializing Sortable

        // Initialize SortableJS on the timelineWrapper
        if (steps.length > 0) {
            timelineSortableInstance = new Sortable(timelineWrapper, {
                animation: 150,
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                dragClass: 'sortable-drag',
                filter: '.timeline-time-marker', // Elements with this class will not be draggable
                preventOnFilter: true,      // Clicks on filtered elements prevent dragging

                onEnd: function (evt) {
                    if (evt.oldIndex === evt.newIndex) {
                        return; // Item dropped in the same place
                    }

                    console.log(`Step moved for LED${currentlyViewedLedIndex}: from index ${evt.oldIndex} to ${evt.newIndex}`);

                    const programForCurrentLed = programData[`LED${currentlyViewedLedIndex}`];
                    if (programForCurrentLed) {
                        const [movedItem] = programForCurrentLed.splice(evt.oldIndex, 1);
                        programForCurrentLed.splice(evt.newIndex, 0, movedItem);

                        console.log("programData updated after drag:", JSON.parse(JSON.stringify(programData)));
                        renderTimeline(); // Re-render to update indices and time markers
                    }
                }
            });
        }

        // Time Marker Logic (after SortableJS is initialized on the wrapper)
        // This ensures markers are added to the same wrapper that Sortable controls
        let currentPixelOffset = 0;
        let actualCumulativeTime = 0;
        steps.forEach((step) => { // We don't need 'index' here if just iterating for calculation
            let blockWidthPx;
            if (step.duration_ms <= 2000) {
                blockWidthPx = BLOCK_SIZE_SMALL_PX;
            } else if (step.duration_ms <= 5000) {
                blockWidthPx = BLOCK_SIZE_MEDIUM_PX;
            } else {
                blockWidthPx = BLOCK_SIZE_LARGE_PX;
            }
            // Add the margin-right of the block to the offset for the marker
            currentPixelOffset += blockWidthPx + 5; // 5px is the margin-right from stepBlock.style.marginRight
            actualCumulativeTime += step.duration_ms;

            const timeMarker = document.createElement('div');
            timeMarker.className = 'timeline-time-marker'; // For filtering in Sortable and styling
            timeMarker.style.position = 'absolute';
            timeMarker.style.left = `${currentPixelOffset - (blockWidthPx / 2) - 2}px`; // Attempt to center marker *between* blocks, or at end
                                                                                     // Or more simply, at the end: `${currentPixelOffset - 2}px`
            timeMarker.style.left = `${currentPixelOffset - 2.5}px`; // -2.5 to be roughly at the end of margin
            timeMarker.style.top = '5px'; // Position above the blocks (relative to timelineWrapper's padding-top)
            timeMarker.style.height = 'calc(100% + 10px)'; // Span height of wrapper + a bit more
            timeMarker.style.fontSize = '0.7em';
            timeMarker.style.borderLeft = '1px dotted #555';
            timeMarker.style.paddingLeft = '3px';
            timeMarker.innerHTML = `${actualCumulativeTime}<span style="font-size:0.8em;">ms</span>`;
            timelineWrapper.appendChild(timeMarker);
        });
    }

    const exportButton = document.getElementById('export-button');

        if (exportButton) {
            exportButton.addEventListener('click', () => {
                // Check if there's anything to export
                let hasAnySteps = false;
                for (const ledKey in programData) {
                    if (programData[ledKey].length > 0) {
                        hasAnySteps = true;
                        break;
                    }
                }

                if (!hasAnySteps) {
                    alert("The program is empty. Add some steps before exporting.");
                    return;
                }

                // The programData should already be in the correct format:
                // { "LED0": [...steps...], "LED1": [...steps...], ... }
                // Convert the programData object to a JSON string
                // The 'null, 2' arguments pretty-print the JSON with an indent of 2 spaces
                const jsonString = JSON.stringify(programData, null, 2);

                // Create a Blob with the JSON string
                const blob = new Blob([jsonString], { type: 'application/json' });

                // Create a temporary anchor element (<a>) to trigger the download
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob); // Set the href to a URL representing the Blob
                a.download = 'program.json';     // Set the desired filename for the download

                // Append the anchor to the body, click it, then remove it
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                // Revoke the object URL to free up resources
                URL.revokeObjectURL(a.href);

                console.log("program.json exported.");
                alert("program.json has been prepared for download!");
            });
        }

    console.log('Export button initialized!')

const loadProgramButton = document.getElementById('load-program-button');
    const fileInput = document.getElementById('file-input');

    if (loadProgramButton && fileInput) {
        loadProgramButton.addEventListener('click', () => {
            fileInput.click(); // Programmatically click the hidden file input
        });

        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0]; // Get the selected file

            if (file) {
                const reader = new FileReader();

                reader.onload = (e) => {
                    try {
                        const fileContent = e.target.result;
                        const loadedProgram = JSON.parse(fileContent);

                        // --- Basic Validation of loadedProgram structure ---
                        if (typeof loadedProgram !== 'object' || loadedProgram === null) {
                            throw new Error("Invalid JSON structure: not an object.");
                        }
                        let isValidStructure = true;
                        for (let i = 0; i < NUM_LEDS; i++) {
                            const ledKey = `LED${i}`;
                            if (!loadedProgram.hasOwnProperty(ledKey) || !Array.isArray(loadedProgram[ledKey])) {
                                isValidStructure = false;
                                break;
                            }
                            // Further validation: check if each item in the array is a valid step object
                            loadedProgram[ledKey].forEach(step => {
                                if (typeof step !== 'object' || step === null || !step.type || !step.hasOwnProperty('duration_ms')) {
                                    // Add more checks for type-specific params if needed
                                    isValidStructure = false;
                                }
                            });
                            if(!isValidStructure) break;
                        }

                        if (!isValidStructure) {
                            throw new Error("Loaded program.json has an invalid or incomplete structure for some LEDs.");
                        }

                        // If valid, replace current programData
                        programData = loadedProgram;
                        console.log("Program loaded successfully:", JSON.parse(JSON.stringify(programData)));
                        alert("Program loaded successfully!");

                        // Refresh UI elements
                        // 1. Potentially clear/update selectedLedIndices (or decide on behavior)
                        //    For now, let's keep current selection, timeline will update for viewed LED.
                        // selectedLedIndices.clear(); // Optional: clear selection
                        // allLedButtons.forEach(btn => updateLedButtonAppearance(btn, false)); // Optional: update UI
                        renderTimeline();
                        updateAllLedOutlines();
                        // (Future) If you were saving/loading LED selection states, update those too.

                    } catch (error) {
                        console.error("Error loading or parsing program.json:", error);
                        alert(`Error loading program.json: ${error.message}`);
                    } finally {
                        // Reset file input to allow loading the same file again if needed
                        fileInput.value = '';
                    }
                };

                reader.onerror = (error) => {
                    console.error("Error reading file:", error);
                    alert("Error reading file.");
                    fileInput.value = ''; // Reset
                };

                reader.readAsText(file); // Read the file as plain text
            }
        });
    }
    console.log('Load Program button initialized!');
    // --- Dark Mode Toggle Logic ---
    const darkModeToggleButton = document.getElementById('darkModeToggle');
    const htmlElement = document.documentElement; // Get the <html> element

    // Function to apply theme based on preference
    function applyTheme(theme) {
        if (theme === 'dark') {
            htmlElement.classList.add('dark-mode');
            if (darkModeToggleButton) { // Update button icon/text if needed
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
            let currentTheme = 'light';
            if (htmlElement.classList.contains('dark-mode')) {
                currentTheme = 'dark';
            }

            if (currentTheme === 'dark') {
                applyTheme('light');
                localStorage.setItem('theme', 'light'); // Save preference
            } else {
                applyTheme('dark');
                localStorage.setItem('theme', 'dark'); // Save preference
            }
        });
    }

    // Check for saved theme preference on page load
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        applyTheme(savedTheme);
    } else {
        // Optional: Check for OS preference if no user preference saved
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            applyTheme('dark');
        } else {
            applyTheme('light'); // Default to light
        }
    }
    console.log('Dark mode toggle initialized!');
    // Initial render on page load (will show "No LED selected" message)
    renderTimeline();
    console.log('Timeline rendering initialized!');
});