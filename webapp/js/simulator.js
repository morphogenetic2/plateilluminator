(function initSimulatorModule(global) {
    const App = global.App;
    const State = App.state;
    const Runtime = App.runtime;
    const fn = App.fn;

    function updateLedAppearances() { return fn.updateLedAppearances(); }
    function updateblockSelector() { return fn.updateblockSelector(); }
    function updateBatchIndicator() { return fn.updateBatchIndicator(); }
    function renderTimeline() { return fn.renderTimeline(); }
class LedRuntime {
    constructor(ledId, blocks) {
        this.ledId = ledId;
        this.blocks = blocks;
        this.reset();
    }

    reset() {
        this.blockIdx = 0;
        this.stepIdx = 0;
        this.blockLoopCount = 0;
        this.blockStartTime = 0;
        this.stepStartTime = 0;
        this.isDone = false;
        this.currentInt = 0;
        // Handle empty program
        if (!this.blocks || this.blocks.length === 0) {
            this.isDone = true;
        }
    }

    tick(globalTimeS) {
        if (this.isDone) return 0;

        const block = this.blocks[this.blockIdx];
        if (!block || !block.steps || block.steps.length === 0) {
            this.advanceBlock(globalTimeS);
            return 0; // Skip empty block
        }

        // Check block duration limit
        const blockDurationS = block.repeat_duration_s || (block.repeat_duration_minutes * 60) || null;
        if (blockDurationS) {
            if (globalTimeS - this.blockStartTime >= blockDurationS) {
                this.advanceBlock(globalTimeS);
                return this.tick(globalTimeS);
            }
        }

        const step = block.steps[this.stepIdx];
        const stepDurationS = step.duration_s || (step.duration_ms / 1000) || 0;
        const timeInStepS = globalTimeS - this.stepStartTime;

        // Calculate Intensity
        let val = 0;
        if (step.type === 'ON') val = step.int;
        else if (step.type === 'OFF') val = 0;
        else if (step.type === 'RAMP') {
            const progress = Math.min(1, stepDurationS > 0 ? timeInStepS / stepDurationS : 1);
            val = step.int0 + (step.int1 - step.int0) * progress;
        } else if (step.type === 'SINE') {
            const tBlockS = globalTimeS - this.blockStartTime;
            const sineVal = Math.sin(2 * Math.PI * step.freq * tBlockS); // -1 to 1
            const amp = (step.int1 - step.int0) / 2;
            const midpoint = (step.int0 + step.int1) / 2;
            val = midpoint + (sineVal * amp);
        }

        this.currentInt = val;

        // Check Step Complete
        if (timeInStepS >= stepDurationS) {
            this.advanceStep(globalTimeS);
        }

        return Math.max(0, val);
    }

    advanceStep(globalTimeS) {
        this.stepIdx++;
        const block = this.blocks[this.blockIdx];

        // End of block steps?
        if (this.stepIdx >= block.steps.length) {
            // Check block Repetition
            if (block.repeat_continuous) {
                this.stepIdx = 0; // Loop forever
            } else if (block.repeat_count) {
                this.blockLoopCount++;
                if (this.blockLoopCount < block.repeat_count) {
                    this.stepIdx = 0; // Loop block
                } else {
                    this.advanceBlock(globalTimeS); // Done with this block
                }
            } else if (!block.repeat_duration_s && !block.repeat_duration_minutes) {
                // Mode Once
                this.advanceBlock(globalTimeS);
            } else {
                // Mode Duration - just loop steps until duration cuts it off
                this.stepIdx = 0;
            }
        }
        this.stepStartTime = globalTimeS;
    }

    advanceBlock(globalTimeS) {
        this.blockIdx++;
        this.stepIdx = 0;
        this.blockLoopCount = 0;
        this.blockStartTime = globalTimeS;
        this.stepStartTime = globalTimeS;

        if (this.blockIdx >= this.blocks.length) {
            this.isDone = true;
        }
    }
}

const Simulator = {
    isActive: false,
    isPlaying: false,
    speed: 1,
    currentTimeS: 0,
    lastFrameTime: 0,
    runtimes: [], // Array of LedRuntime
    rafId: null,
    savedSelection: null,
    savedViewedLedLink: null,

    init() {
        // Nothing special to init visual-wise, we use existing #led-grid
    },

    // "Open" concept is gone. We just Play/Stop.

    togglePlay() {
        if (this.isPlaying) this.pause();
        else this.play();
    },

    play() {
        if (this.isPlaying) return;

        // If starting from scratch/stopped
        if (!this.isActive) {
            this.startSession();
        }

        this.isPlaying = true;
        this.lastFrameTime = performance.now();
        document.getElementById('sim-play-btn').innerHTML = '<i class="fas fa-pause"></i>';
        document.body.classList.add('simulating');
        this.loop();
    },

    startSession() {
        this.isActive = true;
        this.currentTimeS = 0;

        // Backup and Clear Selection
        this.savedSelection = new Set(State.selectedLedIndices);
        this.savedViewedLedLink = State.currentlyViewedLedIndex;

        State.selectedLedIndices.clear();
        State.currentlyViewedLedIndex = null;

        updateLedAppearances();
        updateblockSelector();
        updateBatchIndicator();
        renderTimeline();

        // Re-build runtimes
        this.runtimes = [];
        for (let i = 0; i < App.config.NUM_LEDS; i++) {
            const ledData = State.programData[`LED${i}`] || { blocks: [] };
            this.runtimes.push(new LedRuntime(i, ledData.blocks));
        }
    },

    pause() {
        this.isPlaying = false;
        cancelAnimationFrame(this.rafId);
        document.getElementById('sim-play-btn').innerHTML = '<i class="fas fa-play"></i>';
    },

    stop() {
        this.pause();
        this.isActive = false;
        this.currentTimeS = 0;
        this.runtimes.forEach(r => r.reset());
        this.updateDisplay();

        // Restore Selection and UI
        if (this.savedSelection) {
            State.selectedLedIndices = new Set(this.savedSelection);
            State.currentlyViewedLedIndex = this.savedViewedLedLink;
            this.savedSelection = null;
            this.savedViewedLedLink = null;
        }

        document.body.classList.remove('simulating');

        updateLedAppearances();
        updateblockSelector();
        updateBatchIndicator();
        renderTimeline();
    },

    setSpeed(val) {
        this.speed = val;
        document.querySelectorAll('.sim-speed-btn').forEach(b => {
            b.classList.toggle('is-selected', parseInt(b.dataset.speed) === val);
        });
    },

    getConfiguredTotalDurationS() {
        const h = Math.max(0, parseInt(document.getElementById('run-time-hours')?.value, 10) || 0);
        const m = Math.max(0, parseInt(document.getElementById('run-time-minutes')?.value, 10) || 0);
        const s = Math.max(0, parseInt(document.getElementById('run-time-seconds')?.value, 10) || 0);
        return (h * 3600) + (m * 60) + s;
    },

    loop() {
        if (!this.isPlaying) return;

        const now = performance.now();
        const realDeltaS = (now - this.lastFrameTime) / 1000;
        this.lastFrameTime = now;

        const simDeltaS = realDeltaS * this.speed;
        this.currentTimeS += simDeltaS;

        // Tick runtimes
        let allDone = true;
        this.runtimes.forEach((rt, idx) => {
            const intensity = rt.tick(this.currentTimeS); // 0-3000
            if (!rt.isDone) allDone = false;

                const el = Runtime.allLedButtons[idx];
                if (el) {
                    const norm = Math.min(1, intensity / 3000);
                    const bgLightness = 10 + (norm * 50); // 10% to 60%
                    el.style.backgroundColor = `hsl(172, 56%, ${bgLightness}%)`;
                    el.style.boxShadow = `0 0 ${10 + (norm * 20)}px rgba(20, 184, 166, ${0.2 + (norm * 0.8)})`;
                    el.style.borderColor = `rgba(255,255,255,${0.1 + (norm * 0.9)})`;
                }
            });

        this.updateTimeDisplay();

        const totalDurationS = this.getConfiguredTotalDurationS();
        if (totalDurationS > 0 && this.currentTimeS >= totalDurationS) {
            this.stop();
            return;
        }

        if (allDone) {
            this.stop();
        } else {
            this.rafId = requestAnimationFrame(() => this.loop());
        }
    },

    updateDisplay() {
        this.updateTimeDisplay();
        if (!this.isActive) {
            Runtime.allLedButtons.forEach(el => {
                el.style.backgroundColor = '';
                el.style.boxShadow = '';
                el.style.borderColor = '';
            });
        }
    },

    updateTimeDisplay() {
        const totalS = this.currentTimeS;
        const h = Math.floor(totalS / 3600);
        const m = Math.floor((totalS % 3600) / 60);
        const s = Math.floor(totalS % 60);
        const ms = Math.floor((totalS % 1) * 1000);

        const pad = (n, z = 2) => n.toString().padStart(z, '0');
        document.getElementById('sim-time-display').textContent =
            `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}`;
    }
};

function initSimulatorEvents() {
    Simulator.init();

    document.getElementById('sim-play-btn')?.addEventListener('click', () => Simulator.togglePlay());
    document.getElementById('sim-stop-btn')?.addEventListener('click', () => Simulator.stop());

    document.querySelectorAll('.sim-speed-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            Simulator.setSpeed(parseInt(btn.dataset.speed));
        });
    });
}

    App.simulator = Simulator;
    fn.initSimulatorEvents = initSimulatorEvents;
})(window);
