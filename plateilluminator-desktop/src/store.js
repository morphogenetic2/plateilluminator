import { writable, derived } from 'svelte/store';

export const NUM_LEDS = 24;

// Initial state of program data
const initialProgramData = {};
for (let i = 0; i < NUM_LEDS; i++) {
    initialProgramData[`LED${i}`] = { blocks: [] };
}

// Stores
export const programData = writable(initialProgramData);
export const selectedLedIndices = writable(new Set());
export const currentlyViewedLedIndex = writable(0);
export const currentBlockIndex = writable(0);
export const currentStepType = writable('ON');
export const history = writable([]);
export const simIntensities = writable(new Array(NUM_LEDS).fill(0));
export const isSimulating = writable(false);

// Derived values
export const selectedLedsArr = derived(selectedLedIndices, $set => [...$set].sort((a, b) => a - b));
export const viewedLedData = derived(
    [programData, currentlyViewedLedIndex],
    ([$data, $index]) => $data[`LED${$index}`] || { blocks: [] }
);
export const viewedBlocks = derived(viewedLedData, $data => $data.blocks || []);
export const currentBlock = derived(
    [viewedBlocks, currentBlockIndex],
    ([$blocks, $index]) => $blocks[$index] || null
);

// Actions
export function selectLed(index, multi = false, range = false, lastClicked = null) {
    selectedLedIndices.update(set => {
        if (range && lastClicked !== null) {
            const start = Math.min(lastClicked, index);
            const end = Math.max(lastClicked, index);
            for (let i = start; i <= end; i++) set.add(i);
        } else if (multi) {
            if (set.has(index)) set.delete(index);
            else set.add(index);
        } else {
            set.clear();
            set.add(index);
        }
        return set;
    });
    currentlyViewedLedIndex.set(index);
    currentBlockIndex.set(0);
}

export function addBlock() {
    selectedLedIndices.subscribe(selected => {
        programData.update(data => {
            selected.forEach(idx => {
                const ledKey = `LED${idx}`;
                if (!data[ledKey].blocks) data[ledKey].blocks = [];
                const newBlock = {
                    id: `block ${data[ledKey].blocks.length + 1}`,
                    steps: [],
                    repeat_continuous: true,
                    repeat_count: null,
                    repeat_duration_minutes: null
                };
                data[ledKey].blocks.push(newBlock);
            });
            return data;
        });
    })();
}
