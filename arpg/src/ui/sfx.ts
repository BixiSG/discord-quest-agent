// Sound effects synthesised with WebAudio: no sound files to ship, nothing
// for Discord's CSP to block. Every sound is a few oscillators or a noise
// burst with a short envelope, retro on purpose. Quiet by default, throttled
// so a fast attack speed doesn't turn into a buzz.

export type Sfx = "hit" | "crit" | "kill" | "hurt" | "loot1" | "loot2" | "loot3" | "level" | "death" | "flask" | "boss" | "click";

export interface SfxSettings { on: boolean; volume: number }

/** Minimum gap per sound, in ms. */
const GAP: Partial<Record<Sfx, number>> = { hit: 70, crit: 90, kill: 60, hurt: 110, flask: 300, click: 40 };

export class Sound {
    private ctx: AudioContext | null = null;
    private master: GainNode | null = null;
    private noise: AudioBuffer | null = null;
    private last = new Map<Sfx, number>();
    constructor(public settings: SfxSettings) {}

    /** Needs a user gesture on some platforms: call from a click (opening the window). */
    unlock(): void {
        if (!this.settings.on) return;
        try {
            if (!this.ctx) {
                const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
                if (!AC) return;
                this.ctx = new AC();
                this.master = this.ctx.createGain();
                this.master.connect(this.ctx.destination);
                const n = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.5, this.ctx.sampleRate);
                const d = n.getChannelData(0);
                for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
                this.noise = n;
            }
            if (this.ctx.state === "suspended") void this.ctx.resume();
            this.master!.gain.value = this.settings.volume * 0.5;
        } catch { this.ctx = null; }
    }

    set(on: boolean, volume = this.settings.volume): void {
        this.settings = { on, volume: Math.max(0, Math.min(1, volume)) };
        if (on) { this.unlock(); return; }
        // Muted: silence the output and stop the audio engine itself, so nothing
        // already scheduled (or queued by a later call) can reach the speakers.
        if (this.master) { this.master.gain.cancelScheduledValues(0); this.master.gain.value = 0; }
        if (this.ctx?.state === "running") void this.ctx.suspend().catch(() => {});
    }

    close(): void { void this.ctx?.close().catch(() => {}); this.ctx = null; this.master = null; }

    play(s: Sfx): void {
        if (!this.settings.on || !this.ctx || !this.master || this.ctx.state !== "running") return;
        const now = performance.now(), gap = GAP[s] ?? 0;
        if (gap && now - (this.last.get(s) ?? -1e9) < gap) return;
        this.last.set(s, now);
        const t = this.ctx.currentTime + 0.005;
        switch (s) {
            case "hit": this.tone("square", 220, 90, t, 0.06, 0.18); this.hiss(t, 0.04, 0.12, 2400); break;
            case "crit": this.tone("square", 520, 140, t, 0.1, 0.22); this.hiss(t, 0.08, 0.2, 5000); this.tone("triangle", 1040, 780, t, 0.08, 0.1); break;
            case "kill": this.tone("triangle", 150, 50, t, 0.14, 0.3); this.hiss(t, 0.1, 0.12, 900); break;
            case "hurt": this.tone("sawtooth", 140, 70, t, 0.1, 0.16); break;
            case "flask": [440, 560, 700].forEach((f, i) => this.tone("sine", f, f * 1.2, t + i * 0.05, 0.06, 0.14)); break;
            case "loot1": [660, 880].forEach((f, i) => this.tone("triangle", f, f, t + i * 0.07, 0.09, 0.18)); break;
            case "loot2": [784, 988, 1319].forEach((f, i) => this.tone("square", f, f, t + i * 0.07, 0.1, 0.12)); break;
            case "loot3":
                [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone("square", f, f, t + i * 0.07, 0.14, 0.13));
                this.hiss(t + 0.3, 0.5, 0.06, 7000);
                break;
            case "level": [392, 523, 659, 784, 1047].forEach((f, i) => { this.tone("square", f, f, t + i * 0.09, 0.16, 0.14); this.tone("triangle", f / 2, f / 2, t + i * 0.09, 0.16, 0.12); }); break;
            case "death": this.tone("sawtooth", 330, 55, t, 0.9, 0.2); this.hiss(t, 0.5, 0.1, 600); break;
            case "boss": this.tone("sawtooth", 55, 50, t, 1.1, 0.25); this.tone("square", 82, 80, t + 0.05, 0.9, 0.12); break;
            case "click": this.tone("square", 1200, 900, t, 0.025, 0.06); break;
        }
    }

    private env(t: number, dur: number, peak: number): GainNode {
        const g = this.ctx!.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(peak, t + Math.min(0.01, dur / 4));
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        g.connect(this.master!);
        return g;
    }

    private tone(type: OscillatorType, f0: number, f1: number, t: number, dur: number, peak: number): void {
        const o = this.ctx!.createOscillator();
        o.type = type;
        o.frequency.setValueAtTime(f0, t);
        if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
        o.connect(this.env(t, dur, peak));
        o.start(t); o.stop(t + dur + 0.02);
    }

    private hiss(t: number, dur: number, peak: number, cutoff: number): void {
        const src = this.ctx!.createBufferSource();
        src.buffer = this.noise;
        const f = this.ctx!.createBiquadFilter();
        f.type = "lowpass"; f.frequency.value = cutoff;
        src.connect(f); f.connect(this.env(t, dur, peak));
        src.start(t); src.stop(t + dur + 0.02);
    }
}
