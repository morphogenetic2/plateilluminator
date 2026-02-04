export class LedRuntime {
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
        if (!this.blocks || this.blocks.length === 0) {
            this.isDone = true;
        }
    }

    tick(globalTimeS) {
        if (this.isDone) return 0;

        const block = this.blocks[this.blockIdx];
        if (!block || !block.steps || block.steps.length === 0) {
            this.advanceBlock(globalTimeS);
            return 0;
        }

        // Check block duration limit
        const blockDurationS = block.repeat_duration_s || (block.repeat_duration_minutes * 60) || null;
        if (blockDurationS && (globalTimeS - this.blockStartTime >= blockDurationS)) {
            this.advanceBlock(globalTimeS);
            return this.tick(globalTimeS);
        }

        const step = block.steps[this.stepIdx];
        const stepDurationS = (step.duration_s !== undefined) ? step.duration_s : (step.duration_ms / 1000);
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
            const sineVal = Math.sin(2 * Math.PI * step.freq * tBlockS);
            const amp = (step.int1 - step.int0) / 2;
            const midpoint = (step.int0 + step.int1) / 2;
            val = midpoint + (sineVal * amp);
        }

        this.currentInt = val;

        if (timeInStepS >= stepDurationS) {
            this.advanceStep(globalTimeS);
        }

        return val;
    }

    advanceStep(globalTimeS) {
        const block = this.blocks[this.blockIdx];
        this.stepIdx++;
        this.stepStartTime = globalTimeS;

        if (this.stepIdx >= block.steps.length) {
            this.stepIdx = 0;
            this.blockLoopCount++;

            if (block.repeat_once) {
                this.advanceBlock(globalTimeS);
            } else if (block.repeat_count && this.blockLoopCount >= block.repeat_count) {
                this.advanceBlock(globalTimeS);
            }
        }
    }

    advanceBlock(globalTimeS) {
        this.blockIdx++;
        this.blockStartTime = globalTimeS;
        this.stepIdx = 0;
        this.stepStartTime = globalTimeS;
        this.blockLoopCount = 0;

        if (this.blockIdx >= this.blocks.length) {
            this.isDone = true;
        }
    }
}
