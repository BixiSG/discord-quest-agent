// The game window: a Shadow DOM root on document.body with its own frame,
// drag, resize, maximize and a mini mode. Owns the game state while open.
// Closed means closed: no timers, no drawing; the next open catches up from
// the saved timestamp. Mini mode is still open: the hero keeps fighting.

import { advance, runSheet, runZone, STEP_MS, type SimEvents } from "../core/sim/engine";
import { startReport, type Report } from "../core/sim/report";
import { newGame, sheetOf } from "../core/game";
import { SAVE_VERSION, SaveError, exportText, importText, unwrap, wrap, type SaveEnvelope } from "../core/save";
import { validateState } from "../core/validate";
import type { GameState } from "../core/state";
import { ZONES, CLASSES, SUPPORTS, xpToNext } from "../core/data";
import { deriveSheet, supportSlots } from "../core/character";
import { baseOf, itemLabel } from "../core/items";
import { pointsLeft, ascPointsLeft } from "../core/passives";
import { atlasPointsLeft } from "../core/maps";
import type { SaveStore } from "../platform/store";
import type { KV } from "../platform/kv";
import { Battle } from "./battle";
import { CSS } from "./css";
import { clear, fmt, fmtDuration, h } from "./dom";
import { glyph, type GlyphName } from "./glyphs";
import { Hud, HUD_H } from "./hud";
import { Sound, type Sfx } from "./sfx";
import { VIEWS, creationView, renderView, viewSig, type Ctx, type ViewId } from "./views";
import { itemCard } from "./views";

const GEO_KEY = "window";
/** Frame state that is not geometry: stage size, mini, maximized. */
const UI_KEY = "frame";
/** Synchronous copy written on pagehide, when an IndexedDB write may not finish. */
const QUICK_KEY = "quicksave";
const BACKUP_MS = 5 * 60e3;
const AUTOSAVE_MS = 20e3;
const REPORT_MIN_MS = 60e3;
const MINI_W = 320;
/** XP rate window for the time-to-level estimate. */
const XP_WINDOW_MS = 10 * 60e3;

type StageSize = "l" | "m" | "off";
const STAGE_FRAC: Record<Exclude<StageSize, "off">, number> = { l: 0.42, m: 0.28 };
const STAGE_NEXT: Record<StageSize, StageSize> = { m: "l", l: "off", off: "m" };
const STAGE_TITLE: Record<StageSize, string> = { m: "Battle view: normal (click for large)", l: "Battle view: large (click to hide)", off: "Battle view: hidden (click to show)" };

interface Frame { stage: StageSize; mini: boolean; max: boolean; sound: boolean; volume: number }

export interface Summary { name: string; cls: string; level: number; zone: string; savedAt: number; xpFrac: number }

export interface AppHooks {
    /** Small summary for the launcher card (hub storage). */
    summary?(s: Summary): void;
    theme?(): "dark" | "light";
    onClose?(): void;
}

// Events typed or pasted in the game must not reach Discord's document handlers.
const STOP_EVENTS = ["keydown", "keyup", "keypress", "paste", "copy", "cut", "input"];

const NAV_GLYPH: Record<ViewId, GlyphName> = { hero: "hero", gear: "gear", forge: "forge", skills: "skills", tree: "tree", world: "world", atlas: "atlas", log: "log", menu: "menu" };

export class GameWindow {
    private host: HTMLDivElement | null = null;
    private root!: ShadowRoot;
    private win!: HTMLDivElement;
    private body!: HTMLDivElement;
    private top!: HTMLDivElement;
    private stage!: HTMLDivElement;
    private stageBtn!: HTMLButtonElement;
    private soundBtn!: HTMLButtonElement;
    private hudWrap!: HTMLDivElement;
    private hud = new Hud();
    private sound = new Sound({ on: true, volume: 0.35 });
    /** When the hero last swung or cast (performance.now()), for the skill slot's cooldown sweep. */
    private lastUse = 0;
    private nav!: HTMLDivElement;
    private who!: HTMLSpanElement;
    private miniBtn!: HTMLButtonElement;
    private maxBtn!: HTMLButtonElement;
    private miniBox!: HTMLDivElement;
    private toasts!: HTMLDivElement;
    private battle = new Battle();
    private state: GameState | null = null;
    private view: ViewId = "hero";
    private sig = "";
    private timer: number | null = null;
    private raf: number | null = null;
    private lastSave = 0;
    private lastBackup = 0;
    private busy = false;
    private ctx!: Ctx;
    private stopKeys: ((e: Event) => void) | null = null;
    private frame: Frame = { stage: "m", mini: false, max: false, sound: true, volume: 0.35 };
    private xpLog: [number, number][] = [];
    private lastEvent = "";
    private onUnload = () => {
        if (!this.state) return;
        this.kv.set(QUICK_KEY, wrap(this.state, Date.now()));
        void this.save();
    };
    private onResize = () => this.refit();

    constructor(private store: SaveStore, private kv: KV, private hooks: AppHooks = {}) {}

    get isOpen(): boolean { return !!this.host; }
    get isMini(): boolean { return this.frame.mini; }

    async open(): Promise<void> {
        if (this.host) { this.win.style.display = ""; this.refit(); this.win.focus(); this.flash(); return; }
        this.build();
        window.addEventListener("pagehide", this.onUnload);
        window.addEventListener("resize", this.onResize);
        const loaded = await this.load();
        if (!this.host) return; // closed while loading
        if (!loaded) { this.showCreation(); return; }
        await this.catchUp();
        this.startLoop();
    }

    async close(): Promise<void> {
        if (!this.host) return;
        this.stopLoop();
        await this.save();
        window.removeEventListener("pagehide", this.onUnload);
        window.removeEventListener("resize", this.onResize);
        if (this.stopKeys) for (const k of STOP_EVENTS) this.host.removeEventListener(k, this.stopKeys);
        this.host.remove();
        this.host = null;
        this.sound.close();
        this.state = null;
        this.hooks.onClose?.();
    }

    /** Like a taskbar button: opens the game, or folds it to mini mode and back. */
    async toggle(): Promise<void> {
        if (!this.host) { await this.open(); return; }
        this.setMini(!this.frame.mini);
    }

    // ---- frame ----------------------------------------------------------------

    private build(): void {
        const host = document.createElement("div");
        host.id = "hollowmarch-root";
        this.host = host;
        this.root = host.attachShadow({ mode: "open" });
        const style = document.createElement("style");
        style.textContent = CSS;
        this.root.append(style);
        // Keys typed in the game must not reach Discord's shortcuts.
        this.stopKeys = (e: Event) => e.stopPropagation();
        for (const k of STOP_EVENTS) host.addEventListener(k, this.stopKeys);
        const f = this.kv.get(UI_KEY) as Partial<Frame> | null;
        if (f && typeof f === "object") {
            if (f.stage === "l" || f.stage === "m" || f.stage === "off") this.frame.stage = f.stage;
            this.frame.mini = f.mini === true;
            this.frame.max = f.max === true;
            this.frame.sound = f.sound !== false;
            if (typeof f.volume === "number" && f.volume >= 0 && f.volume <= 1) this.frame.volume = f.volume;
        }
        this.sound.set(this.frame.sound, this.frame.volume); // open() is a click: audio may start

        const shell = h("div", { class: `hm${this.hooks.theme?.() === "dark" ? " dark" : ""}` });
        const ctl = (g: GlyphName, title: string, fn: () => void, cls = "") => {
            const b = h("button", { class: `ctl ${cls}`, title, attrs: { "aria-label": title }, on: { click: fn } }, glyph(g, 12));
            return b;
        };
        this.who = h("span", { class: "who" });
        this.stageBtn = ctl("stage", STAGE_TITLE.m, () => this.setStage(STAGE_NEXT[this.frame.stage]), "sz");
        this.miniBtn = ctl("min", "Mini mode: keeps playing in a small strip", () => this.setMini(!this.frame.mini));
        this.maxBtn = ctl("max", "Maximize (double-click the title)", () => this.setMax(!this.frame.max), "mx");
        this.soundBtn = ctl("sound", "Sound on (click to mute)", () => this.setSound(!this.frame.sound), "snd");
        const bar = h("div", { class: "bar" }, h("span", { class: "logo", text: "Hollowmarch" }), this.who,
            h("span", { class: "ctls" }, this.soundBtn, this.stageBtn, this.miniBtn, this.maxBtn, ctl("close", "Close (the road keeps going; it is replayed on open)", () => void this.close(), "x")));
        bar.addEventListener("dblclick", e => { if (!(e.target as HTMLElement).closest("button")) this.setMax(!this.frame.max); });

        this.stage = h("div", { class: "stage" }, this.battle.canvas);
        this.top = h("div", { class: "top" }, this.stage);
        this.hudWrap = h("div", { class: "hudw", attrs: { role: "img", "aria-label": "Hero status" } }, this.hud.canvas);

        this.nav = h("div", { class: "nav", attrs: { role: "tablist", "aria-label": "Game sections" } });
        VIEWS.forEach((v, i) => {
            this.nav.append(h("button", { attrs: { "data-v": v.id, role: "tab", "aria-selected": "false", title: `${v.label} (${i + 1})` }, on: { click: () => {
                this.view = v.id; this.sig = ""; if (this.ctx) this.ctx.sel = {};
                this.renderTab(true); this.body.scrollTop = 0;
            } } }, glyph(NAV_GLYPH[v.id], 16), h("span", { class: "lbl", text: v.label }), h("span", { class: "key", text: String(i + 1) }), h("span", { class: "badge", attrs: { hidden: "" } })));
        });
        this.body = h("div", { class: "body", attrs: { role: "tabpanel" } });
        const main = h("div", { class: "main" }, this.nav, this.body);

        this.miniBox = h("div", { class: "minibox" }, h("div", { class: "mlast" }));

        this.toasts = h("div", { class: "toasts", attrs: { "aria-live": "polite" } });
        const grip = h("div", { class: "grip", attrs: { "aria-hidden": "true" } });
        this.win = h("div", { class: "win", attrs: { role: "dialog", "aria-label": "Hollowmarch" } }, bar, this.top, this.hudWrap, main, this.miniBox, this.toasts, grip);
        shell.append(this.win);
        this.root.append(shell);
        document.body.append(host);

        this.placeWindow();
        this.dragger(bar, (dx, dy, g) => { g.x += dx; g.y += dy; });
        this.dragger(grip, (dx, dy, g) => { g.w += dx; g.h += dy; });

        this.win.tabIndex = -1;
        // Keyboard: Esc closes the top window inside the game, 1-9 switch tabs.
        this.win.addEventListener("keydown", e => {
            const t = e.target as HTMLElement;
            if (t.closest("input, textarea, select")) return;
            if (e.key === "Escape") {
                const modals = this.win.querySelectorAll(".modal");
                const top = modals[modals.length - 1] as HTMLElement | undefined;
                // Closing never confirms anything: the window is just dismissed (the catch-up one stays).
                if (top && !top.querySelector(".progress")) { top.remove(); e.preventDefault(); }
                return;
            }
            if (e.ctrlKey || e.altKey || e.metaKey || this.frame.mini || this.win.querySelector(".modal")) return;
            const n = Number(e.key);
            if (n >= 1 && n <= VIEWS.length) {
                (this.nav.children[n - 1] as HTMLElement | undefined)?.click();
                e.preventDefault();
                return;
            }
            // Views mark their own shortcuts: <button data-key="e">.
            const k = e.key.length === 1 ? e.key.toLowerCase() : "";
            const hot = k && /^[a-z]$/.test(k) ? this.body.querySelector<HTMLButtonElement>(`[data-key="${k}"]:not([disabled])`) : null;
            if (hot) { hot.click(); e.preventDefault(); }
        });
        this.applyFrame();
    }

    private geo = { x: 80, y: 60, w: 900, h: 660 };
    private placeWindow(): void {
        const g = this.kv.get(GEO_KEY) as typeof this.geo | null;
        if (g && [g.x, g.y, g.w, g.h].every(v => typeof v === "number" && Number.isFinite(v))) this.geo = { x: g.x, y: g.y, w: g.w, h: g.h };
        else {
            // First open: big enough for the content, centred on Discord's window.
            this.geo.w = Math.min(920, window.innerWidth - 48);
            this.geo.h = Math.min(700, window.innerHeight - 72);
            this.geo.x = Math.max(8, Math.round((window.innerWidth - this.geo.w) / 2));
            this.geo.y = Math.max(40, Math.round((window.innerHeight - this.geo.h) / 2));
        }
        const fit = () => {
            const vw = window.innerWidth, vh = window.innerHeight;
            const g = this.geo;
            g.w = Math.max(380, Math.min(g.w, vw - 8)); g.h = Math.max(340, Math.min(g.h, vh - 8));
            g.x = Math.max(0, Math.min(g.x, vw - (this.frame.mini ? MINI_W : g.w))); g.y = Math.max(0, Math.min(g.y, vh - (this.frame.mini ? 120 : g.h)));
            // The HUD is pixel art too: whole-number scale, its logical width follows the window.
            const hudAt = (cssW: number, scale: number) => {
                this.hud.resize(cssW / scale);
                this.hud.canvas.style.width = cssW + "px";
                this.hud.canvas.style.height = HUD_H * scale + "px";
            };
            if (this.frame.mini) {
                Object.assign(this.win.style, { left: g.x + "px", top: g.y + "px", width: MINI_W + "px", height: "" });
                hudAt(MINI_W - 6, 1);
                return;
            }
            const box = this.frame.max ? { x: 8, y: 8, w: vw - 16, h: vh - 16 } : g;
            Object.assign(this.win.style, { left: box.x + "px", top: box.y + "px", width: box.w + "px", height: box.h + "px" });
            const inner = box.w - 6;
            hudAt(inner, inner >= 1180 ? 3 : inner >= 520 ? 2 : 1);
            if (this.frame.stage === "off") { this.stage.style.height = ""; return; }
            // The scene keeps about 160 logical pixels of height and gets as wide as the window:
            // whole-number scaling, nothing stretched or letterboxed.
            const stageH = Math.round(Math.min(inner * 0.5, box.h * STAGE_FRAC[this.frame.stage]));
            const sc = Math.max(1, Math.round(stageH / 160));
            this.stage.style.height = stageH + "px";
            this.battle.resize(Math.ceil(inner / sc), Math.ceil(stageH / sc));
            Object.assign(this.battle.canvas.style, { width: this.battle.canvas.width * sc + "px", height: this.battle.canvas.height * sc + "px" });
        };
        fit();
        this.refit = fit;
    }
    private refit: () => void = () => {};

    private applyFrame(): void {
        const f = this.frame;
        this.win.classList.toggle("mini", f.mini);
        this.win.classList.toggle("max", f.max && !f.mini);
        this.top.classList.toggle("nostage", f.stage === "off");
        this.stageBtn.title = STAGE_TITLE[f.stage];
        this.stageBtn.setAttribute("aria-label", STAGE_TITLE[f.stage]);
        const setGlyph = (b: HTMLButtonElement, g: GlyphName, title: string) => { b.replaceChildren(glyph(g, 12)); b.title = title; b.setAttribute("aria-label", title); };
        setGlyph(this.miniBtn, f.mini ? "max" : "min", f.mini ? "Back to the full window" : "Mini mode: keeps playing in a small strip");
        setGlyph(this.maxBtn, f.max ? "restore" : "max", f.max ? "Restore size (double-click the title)" : "Maximize (double-click the title)");
        setGlyph(this.soundBtn, f.sound ? "sound" : "mute", f.sound ? "Sound on (click to mute)" : "Sound off (click to unmute)");
        this.refit();
    }
    private saveFrame(): void { this.kv.set(UI_KEY, { ...this.frame }); }
    setMini(on: boolean): void { this.frame.mini = on; this.saveFrame(); this.applyFrame(); if (!on) { this.sig = ""; this.renderTab(true); } }
    private setMax(on: boolean): void { if (this.frame.mini) return; this.frame.max = on; this.saveFrame(); this.applyFrame(); }
    private setStage(s: StageSize): void { this.frame.stage = s; this.saveFrame(); this.applyFrame(); }
    private setSound(on: boolean): void { this.frame.sound = on; this.saveFrame(); this.sound.set(on, this.frame.volume); this.applyFrame(); if (on) this.sound.play("click"); }
    /** A short pulse on the frame, so a click on the launcher visibly finds the window. */
    private flash(): void { this.win.classList.remove("flash"); void this.win.offsetWidth; this.win.classList.add("flash"); }

    private dragger(handle: HTMLElement, apply: (dx: number, dy: number, g: { x: number; y: number; w: number; h: number }) => void): void {
        handle.addEventListener("pointerdown", e => {
            if ((e.target as HTMLElement).closest("button") || e.button !== 0) return;
            // Dragging a maximized window puts it back to its own size first.
            if (this.frame.max && handle !== this.win.querySelector(".grip")) { this.frame.max = false; this.saveFrame(); this.applyFrame(); }
            if (this.frame.max) return;
            e.preventDefault();
            handle.setPointerCapture(e.pointerId);
            let lx = e.clientX, ly = e.clientY;
            const move = (ev: PointerEvent) => { apply(ev.clientX - lx, ev.clientY - ly, this.geo); lx = ev.clientX; ly = ev.clientY; this.refit(); };
            const up = () => {
                handle.removeEventListener("pointermove", move); handle.removeEventListener("pointerup", up); handle.removeEventListener("pointercancel", up);
                this.kv.set(GEO_KEY, this.geo);
            };
            handle.addEventListener("pointermove", move); handle.addEventListener("pointerup", up); handle.addEventListener("pointercancel", up);
        });
    }

    // ---- persistence --------------------------------------------------------

    /** Unwraps, migrates and validates; the state is only used when it can produce a stat sheet. */
    private static accept(raw: unknown): SaveEnvelope<GameState> {
        const env = unwrap<GameState>(raw);
        env.state = validateState(env.state);
        sheetOf(env.state);
        return env;
    }

    private async load(): Promise<boolean> {
        let quick: SaveEnvelope<GameState> | null = null;
        try {
            const q = this.kv.get(QUICK_KEY);
            if (q) quick = GameWindow.accept(q);
        } catch (e) { console.warn("[Hollowmarch] quick save unusable:", e); }
        for (const key of ["main", "backup"]) {
            try {
                const raw = await this.store.get(key);
                if (!raw) continue;
                const env = GameWindow.accept(raw);
                this.state = quick && quick.savedAt > env.savedAt ? quick.state : env.state;
                this.lastBackup = Date.now();
                return true;
            } catch (e) { console.warn(`[Hollowmarch] save "${key}" unusable:`, e); }
        }
        if (quick) { this.state = quick.state; return true; }
        return false;
    }

    async save(): Promise<void> {
        const s = this.state;
        if (!s) return;
        this.lastSave = Date.now();
        try {
            // The backup rotates every few minutes, so a bad state can't overwrite both at once.
            if (Date.now() - this.lastBackup > BACKUP_MS) {
                const prev = await this.store.get("main");
                if (prev) await this.store.put("backup", prev as SaveEnvelope);
                this.lastBackup = Date.now();
            }
            await this.store.put("main", wrap(s, Date.now()));
            if (this.kv.get(QUICK_KEY)) this.kv.del(QUICK_KEY);
        } catch (e) { console.warn("[Hollowmarch] save failed:", e); }
        this.hooks.summary?.(summaryOf(s));
    }

    // ---- catch-up and loop --------------------------------------------------

    private async catchUp(): Promise<void> {
        const s = this.state!;
        const away = Date.now() - s.simTo;
        if (away < STEP_MS) return;
        this.busy = true;
        const rep = startReport(s);
        const bar = h("i", { style: "width:0%" });
        const label = h("div", { class: "muted", text: "" });
        const closeModal = away > 2000 ? this.modal(h("div", { class: "card col" }, h("h3", { text: "While you were away" }), label, h("div", { class: "progress" }, bar))) : () => {};
        const from = s.simTo, target = Date.now();
        this.battle.quiet = true;
        while (!advance(s, target, rep.events, 25000)) {
            const f = (s.simTo - from) / Math.max(1, target - from);
            bar.style.width = (f * 100).toFixed(1) + "%";
            label.textContent = `Replaying ${fmtDuration(target - from)}... ${(f * 100).toFixed(0)}%`;
            await new Promise(r => setTimeout(r, 0));
            if (!this.host) return;
        }
        this.battle.quiet = false;
        this.xpLog = []; // replayed time is not a live rate
        closeModal();
        this.busy = false;
        const report = rep.finish(s);
        if (away >= REPORT_MIN_MS) this.showReport(report);
        await this.save();
    }

    private startLoop(): void {
        this.stopLoop();
        this.win.classList.remove("creating");
        this.makeCtx();
        this.sig = "";
        this.renderTab(true);
        const be = this.battle.events(() => performance.now(), () => this.state!);
        const sfx = (x: Sfx, loud = false) => { if (!this.battle.quiet && (loud || !this.frame.mini)) this.sound.play(x); };
        const ev: SimEvents = {
            ...be,
            heroUse: (fx, targets) => { this.lastUse = performance.now(); be.heroUse?.(fx, targets); },
            heroHit: (i, dmg, crit) => { be.heroHit?.(i, dmg, crit); sfx(crit ? "crit" : "hit"); },
            monsterHit: (i, dmg, avoided) => { be.monsterHit?.(i, dmg, avoided); if (!avoided) sfx("hurt"); },
            flask: () => { be.flask?.(); sfx("flask"); },
            story: text => this.showStory(text),
            zone: (_from, to, why) => { if (why === "unlock") this.toast(`New road: ${ZONES[to]?.name ?? to}`, "road"); },
            kill: (_m, xp) => { if (xp > 0) this.xpLog.push([Date.now(), xp]); sfx("kill"); },
            level: l => { be.level?.(l); this.toast(`Level ${l}`, "level"); this.lastEvent = `Reached level ${l}`; sfx("level", true); },
            loot: (item, kept, equipped) => {
                if (!kept) return;
                if (item.rarity !== "plain") sfx(item.rarity === "enchanted" ? "loot1" : item.rarity === "rare" ? "loot2" : "loot3", item.rarity !== "enchanted");
                const name = itemLabel(item);
                if (equipped) { this.toast(`Equipped: ${name}`, item.rarity); this.lastEvent = `Equipped ${name}`; }
                else if (item.rarity === "rare" || item.rarity === "relic") { this.toast(`${item.rarity === "relic" ? "Relic" : "Rare"}: ${name}`, item.rarity); this.lastEvent = `Found ${name}`; }
            },
            death: () => { this.lastEvent = "Died. The ember relights."; sfx("death"); },
        };
        this.timer = window.setInterval(() => {
            if (!this.state || this.busy) return;
            // A long gap (sleep, throttled background tab) is replayed quietly, with a report.
            if (Date.now() - this.state.simTo > 30e3) { void this.catchUp(); return; }
            advance(this.state, Date.now(), ev, 50);
            if (Date.now() - this.lastSave > AUTOSAVE_MS) void this.save();
        }, STEP_MS);
        const frame = () => {
            this.raf = requestAnimationFrame(frame);
            if (!this.state || document.hidden) return;
            if (!this.frame.mini && this.frame.stage !== "off") this.battle.draw(this.state, runSheet(this.state), performance.now());
            this.drawHud();
            if (!this.frame.mini) this.renderTab(false);
        };
        this.raf = requestAnimationFrame(frame);
    }

    private stopLoop(): void {
        if (this.timer !== null) clearInterval(this.timer);
        if (this.raf !== null) cancelAnimationFrame(this.raf);
        this.timer = this.raf = null;
    }

    // ---- UI -----------------------------------------------------------------

    private makeCtx(): void {
        const self = this;
        this.ctx = {
            get state() { return self.state!; },
            sheet: () => sheetOf(this.state!),
            act: (fn, ok) => {
                const err = fn(this.state!);
                if (typeof err === "string") this.toast(err, "err");
                else if (ok) this.toast(ok);
                this.sig = "";
                this.renderTab(true);
                void this.save();
            },
            toast: m => this.toast(m),
            modal: el => this.modal(el),
            sel: {},
            rerender: () => { this.sig = ""; this.renderTab(true); },
            exportSave: () => exportText(wrap(this.state!, Date.now())),
            importSave: async text => {
                try {
                    const env = GameWindow.accept(importText(text));
                    await this.save();
                    this.lastBackup = 0; // the next save moves the pre-import hero into the backup
                    this.state = env.state;
                    this.ctx.sel = {};
                    await this.catchUp();
                    await this.save();
                    this.sig = ""; this.renderTab(true);
                    return null;
                } catch (e) { return e instanceof SaveError ? e.message : "could not read that save"; }
            },
            resetGame: () => {
                this.stopLoop(); this.state = null;
                this.kv.del(QUICK_KEY);
                void this.store.del("main").then(() => this.store.del("backup")).then(() => this.showCreation());
            },
            storeKind: this.store.kind,
        };
    }

    private lastSigCheck = 0;
    private supportHint = { rev: -1, level: -1, gain: false };
    private renderTab(force: boolean): void {
        if (!this.state || !this.ctx) return;
        // Signatures are cheap but not free (some stringify state): check four times a second.
        if (!force) { const t = performance.now(); if (t - this.lastSigCheck < 250) return; this.lastSigCheck = t; }
        this.updateBadges();
        const sig = this.view + ":" + viewSig(this.view, this.ctx);
        if (!force && sig === this.sig) return;
        this.sig = sig;
        for (const b of this.nav.querySelectorAll("button")) {
            const on = b.getAttribute("data-v") === this.view;
            b.classList.toggle("on", on);
            b.setAttribute("aria-selected", String(on));
        }
        const top = this.body.scrollTop;
        clear(this.body);
        this.body.append(renderView(this.view, this.ctx));
        this.body.scrollTop = top;
    }

    /** Small counters on the tabs: things waiting for a decision. */
    private updateBadges(): void {
        const s = this.state!;
        const hero = s.hero;
        // A free support slot only counts when something that fits would actually add DPS
        // (a mana-starved build can lose DPS to any support). Worked out once per sheet change.
        if (this.supportHint.rev !== hero.rev || this.supportHint.level !== hero.level) {
            const slots = supportSlots(hero.level);
            const active = hero.supports.filter(id => SUPPORTS[id] && SUPPORTS[id]!.level <= hero.level).slice(0, slots);
            let gain = false;
            if (active.length < slots) {
                const cur = sheetOf(s).skill;
                for (const x of Object.values(SUPPORTS)) {
                    if (x.level > hero.level || active.includes(x.id) || (x.requires.length && !x.requires.some(t => cur.tags.includes(t)))) continue;
                    if (deriveSheet({ ...hero, supports: [...active, x.id], rev: -1 }).skill.packDps > cur.packDps * 1.005) { gain = true; break; }
                }
            }
            this.supportHint = { rev: hero.rev, level: hero.level, gain };
        }
        const freeSupport = this.supportHint.gain;
        const tree = Math.max(0, pointsLeft(hero)) + Math.max(0, ascPointsLeft(hero));
        const atlas = Math.max(0, atlasPointsLeft(s));
        const marks: Partial<Record<ViewId, [string, string]>> = {
            skills: freeSupport ? ["!", "A free support slot would add damage"] : undefined,
            tree: tree ? [String(tree), `${tree} passive point${tree > 1 ? "s" : ""} to spend`] : undefined,
            atlas: atlas ? [String(atlas), `${atlas} atlas point${atlas > 1 ? "s" : ""} to spend`] : undefined,
            gear: s.stashFull || s.stash.length >= s.stashCap ? ["!", "Stash is full: drops are being salvaged"] : undefined,
        };
        for (const b of this.nav.children) {
            const id = b.getAttribute("data-v") as ViewId;
            const badge = b.querySelector(".badge") as HTMLElement;
            const m = marks[id];
            const text = m?.[0] ?? "";
            if (badge.textContent !== text) { badge.textContent = text; badge.toggleAttribute("hidden", !m); badge.title = m?.[1] ?? ""; }
        }
    }

    private whereKey = "";
    private ariaAt = 0;
    private drawHud(): void {
        const s = this.state!;
        const sh = runSheet(s);
        const run = s.activity.run;
        const hh = run?.hero;
        const need = xpToNext(s.hero.level);
        const xpF = isFinite(need) ? s.hero.xp / need : 1;
        const eta = this.eta(need - s.hero.xp);
        const z = run ? runZone(s, run) : ZONES[s.activity.zone]!;
        const speed = Math.max(0.05, Math.min(sh.skill.speed, sh.skill.sustain));
        const w = s.hero.equipment.weapon;
        const now = performance.now();
        const life = hh?.life ?? sh.life, mana = hh?.mana ?? sh.mana, es = hh?.es ?? sh.es;
        this.hud.draw({
            life, lifeMax: sh.life, es, esMax: sh.es, mana, manaMax: sh.mana,
            flask: hh?.flask ?? 30, flaskMax: 30, level: s.hero.level, xpFrac: xpF, eta: eta.replace(/^~/, "~ "),
            ready: run?.phase === "fight" ? (now - this.lastUse) / (1000 / speed) : 1,
            skillName: sh.skill.name, weaponKind: w ? baseOf(w).kind : null, spell: sh.skill.kind !== "attack",
            zone: z.name, zoneLevel: z.level, packDps: sh.skill.packDps, dead: run?.phase === "dead",
        }, now);

        const wk = `${z.id}|${z.palette.join()}`;
        if (wk !== this.whereKey) {
            this.whereKey = wk;
            // Letterbox the canvas in its own sky and ground colours, so any window shape looks deliberate.
            const [sky, ground] = z.palette;
            this.stage.style.background = `linear-gradient(to bottom, ${sky} 0 83.4%, #111 83.4% 85%, ${ground} 85% 100%)`;
        }
        const cls = CLASSES[s.hero.cls]?.name ?? "";
        const who = `${s.hero.name}|${s.hero.level}|${cls}`;
        if (this.who.dataset.k !== who) {
            this.who.dataset.k = who;
            this.who.replaceChildren(h("b", { text: s.hero.name }), h("span", { text: `Level ${s.hero.level} ${cls}` }));
        }
        // Screen readers and hover get the numbers the canvas shows, refreshed once a second.
        if (now - this.ariaAt > 1000) {
            this.ariaAt = now;
            const n = (x: number) => fmt(Math.floor(Math.max(0, x)));
            const label = `Life ${n(life)} of ${n(sh.life)}${sh.es ? `, energy shield ${n(es)} of ${n(sh.es)}` : ""}, mana ${n(mana)} of ${n(sh.mana)}, flask ${Math.floor(hh?.flask ?? 30)} of 30. `
                + `Level ${s.hero.level}, ${(xpF * 100).toFixed(1)}% experience${eta ? ` (${eta})` : ""}. ${z.name}, area level ${z.level}. ${fmt(sh.skill.packDps)} pack DPS.`;
            this.hudWrap.setAttribute("aria-label", label);
            this.hudWrap.title = label;
            const last = this.miniBox.firstElementChild!;
            if (last.textContent !== this.lastEvent) last.textContent = this.lastEvent;
        }
    }

    /** "~12m to go" from the kill XP of the last few minutes; blank until there is enough to go on. */
    private eta(left: number): string {
        const now = Date.now();
        while (this.xpLog.length && now - this.xpLog[0]![0] > XP_WINDOW_MS) this.xpLog.shift();
        if (!isFinite(left) || this.xpLog.length < 3) return "";
        const span = Math.max(30e3, now - this.xpLog[0]![0]);
        const rate = this.xpLog.reduce((a, [, x]) => a + x, 0) / span;
        if (rate <= 0) return "";
        return `~${fmtDuration(left / rate)} to level`;
    }

    toast(msg: string, kind = ""): void {
        const t = h("div", { class: `toast${kind ? " t-" + kind : ""}`, text: msg });
        this.toasts.prepend(t);
        while (this.toasts.childElementCount > 4) this.toasts.lastElementChild!.remove();
        setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 220); }, kind === "err" ? 3200 : 2600);
    }

    modal(content: HTMLElement): () => void {
        const m = h("div", { class: "modal", attrs: { role: "dialog", "aria-modal": "true" } }, content);
        this.win.append(m);
        return () => m.remove();
    }

    private showCreation(): void {
        clear(this.body);
        this.win.classList.add("creating");
        if (this.frame.mini) this.setMini(false);
        this.who.dataset.k = "";
        this.who.replaceChildren(h("b", { text: "A new Kindled" }));
        let started = false;
        this.body.append(creationView(async (name, cls) => {
            if (started) return;
            started = true;
            this.state = newGame({ name, cls, now: Date.now(), seed: (Math.random() * 2 ** 32) >>> 0 });
            await this.save();
            this.startLoop();
        }));
    }

    private storyBox: HTMLElement | null = null;
    /** One story window at a time: later beats are added to the open one. */
    private showStory(text: string): void {
        if (this.storyBox?.isConnected) { this.storyBox.append(h("div", { class: "story", style: "margin-top:6px", text })); return; }
        const box = h("div", { class: "col" }, h("div", { class: "story", text }));
        const card = h("div", { class: "card col" }, h("h3", { text: "The road remembers" }), box);
        const close = this.modal(card);
        this.storyBox = box;
        card.append(h("button", { class: "btn", text: "Onward", on: { click: () => { close(); this.storyBox = null; } } }));
    }

    private showReport(r: Report): void {
        const rows: [string, string][] = [
            ["Time away", fmtDuration(r.to - r.from)],
            ["Runs cleared", fmt(r.runs)], ["Monsters slain", fmt(r.kills)], ["Bosses", fmt(r.bosses)], ["Deaths", fmt(r.deaths)],
            ["Levels", r.levelTo > r.levelFrom ? `${r.levelFrom} -> ${r.levelTo}` : `${r.levelTo} (no change)`],
            ["Experience", fmt(r.xp)], ["Items kept", fmt(r.kept)], ["Salvaged", fmt(r.salvaged)], ["Ember dust", `+${fmt(r.dust)}`],
        ];
        const kvEl = h("div", { class: "kv" });
        for (const [k, v] of rows) kvEl.append(h("div", { text: k }), h("div", { class: "num", text: v }));
        const card = h("div", { class: "card col" }, h("h3", { text: "While you were away" }), kvEl);
        for (const t of r.story.slice(-3)) card.append(h("div", { class: "story", text: t }));
        if (r.zones.length) card.append(h("div", { class: "tag", style: "background:var(--teal)", text: `New roads: ${r.zones.join(", ")}` }));
        if (r.equipped.length) card.append(h("div", { class: "tag", style: "background:var(--gold)", text: `Equipped: ${r.equipped.slice(-4).join(", ")}` }));
        if (r.best.length) {
            const best = r.best[r.best.length - 1]!;
            card.append(h("div", { class: "muted", text: "Best find:" }), itemCard(best, null));
        }
        const close = this.modal(card);
        card.append(h("button", { class: "btn", text: "Back to it", on: { click: () => close() } }));
    }
}

export function summaryOf(s: GameState): Summary {
    const need = xpToNext(s.hero.level);
    const run = s.activity.run;
    return { name: s.hero.name, cls: s.hero.cls, level: s.hero.level, zone: run ? runZone(s, run).name : ZONES[s.activity.zone]?.name ?? s.activity.zone, savedAt: Date.now(), xpFrac: isFinite(need) ? s.hero.xp / need : 1 };
}

export { SAVE_VERSION };
