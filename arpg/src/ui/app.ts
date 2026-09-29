// The game window: a Shadow DOM root on document.body with its own frame,
// drag and resize. Owns the game state while open. Closed means closed: no
// timers, no drawing; the next open catches up from the saved timestamp.

import { advance, STEP_MS, type SimEvents } from "../core/sim/engine";
import { startReport, type Report } from "../core/sim/report";
import { newGame, sheetOf } from "../core/game";
import { SAVE_VERSION, SaveError, exportText, importText, unwrap, wrap, type SaveEnvelope } from "../core/save";
import { validateState } from "../core/validate";
import type { GameState } from "../core/state";
import { ZONES, CLASSES, SUPPORTS, xpToNext } from "../core/data";
import { supportSlots } from "../core/character";
import type { SaveStore } from "../platform/store";
import type { KV } from "../platform/kv";
import { Battle, W as BW, H as BH } from "./battle";
import { CSS } from "./css";
import { clear, fmt, fmtDuration, h } from "./dom";
import { VIEWS, creationView, renderView, viewSig, type Ctx, type ViewId } from "./views";
import { itemCard } from "./views";

const GEO_KEY = "window";
/** Synchronous copy written on pagehide, when an IndexedDB write may not finish. */
const QUICK_KEY = "quicksave";
const BACKUP_MS = 5 * 60e3;
const AUTOSAVE_MS = 20e3;
const REPORT_MIN_MS = 60e3;

export interface Summary { name: string; cls: string; level: number; zone: string; savedAt: number; xpFrac: number }

export interface AppHooks {
    /** Small summary for the launcher card (hub storage). */
    summary?(s: Summary): void;
    theme?(): "dark" | "light";
    onClose?(): void;
}

// Events typed or pasted in the game must not reach Discord's document handlers.
const STOP_EVENTS = ["keydown", "keyup", "keypress", "paste", "copy", "cut", "input"];

export class GameWindow {
    private host: HTMLDivElement | null = null;
    private root!: ShadowRoot;
    private win!: HTMLDivElement;
    private body!: HTMLDivElement;
    private hud!: HTMLDivElement;
    private tabs!: HTMLDivElement;
    private who!: HTMLSpanElement;
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
    private onUnload = () => {
        if (!this.state) return;
        this.kv.set(QUICK_KEY, wrap(this.state, Date.now()));
        void this.save();
    };
    private onResize = () => this.refit();

    constructor(private store: SaveStore, private kv: KV, private hooks: AppHooks = {}) {}

    get isOpen(): boolean { return !!this.host; }

    async open(): Promise<void> {
        if (this.host) { this.win.style.display = ""; this.refit(); return; }
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
        this.state = null;
        this.hooks.onClose?.();
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

        const shell = h("div", { class: `hm${this.hooks.theme?.() === "dark" ? " dark" : ""}` });
        this.who = h("span", { class: "who" });
        const bar = h("div", { class: "bar" }, h("span", { class: "logo", text: "Hollowmarch" }), this.who,
            h("button", { class: "x", text: "x", title: "Close (progress keeps counting while closed)", on: { click: () => void this.close() } }));
        this.hud = h("div", { class: "hud" });
        this.tabs = h("div", { class: "tabs" });
        this.body = h("div", { class: "body" });
        const stage = h("div", { class: "stage" }, this.battle.canvas);
        const grip = h("div", { class: "grip" });
        this.win = h("div", { class: "win", attrs: { role: "dialog", "aria-label": "Hollowmarch" } }, bar, stage, this.hud, this.tabs, this.body, grip);
        shell.append(this.win);
        this.root.append(shell);
        document.body.append(host);

        this.placeWindow(stage);
        this.dragger(bar, (dx, dy, g) => { g.x += dx; g.y += dy; });
        this.dragger(grip, (dx, dy, g) => { g.w += dx; g.h += dy; });

        for (const v of VIEWS) {
            this.tabs.append(h("button", { text: v.label, attrs: { "data-v": v.id }, on: { click: () => {
                this.view = v.id; this.sig = ""; if (this.ctx) this.ctx.sel = {};
                this.renderTab(true); this.body.scrollTop = 0;
            } } }));
        }
    }

    private geo = { x: 80, y: 60, w: 760, h: 620 };
    private placeWindow(stage: HTMLElement): void {
        const g = this.kv.get(GEO_KEY) as typeof this.geo | null;
        if (g && [g.x, g.y, g.w, g.h].every(v => typeof v === "number" && Number.isFinite(v))) this.geo = { x: g.x, y: g.y, w: g.w, h: g.h };
        const fit = () => {
            const vw = window.innerWidth, vh = window.innerHeight;
            const g = this.geo;
            g.w = Math.max(360, Math.min(g.w, vw - 8)); g.h = Math.max(320, Math.min(g.h, vh - 8));
            g.x = Math.max(0, Math.min(g.x, vw - g.w)); g.y = Math.max(0, Math.min(g.y, vh - g.h));
            Object.assign(this.win.style, { left: g.x + "px", top: g.y + "px", width: g.w + "px", height: g.h + "px" });
            stage.style.height = Math.round(Math.min(g.w * BH / BW, g.h * 0.36)) + "px";
        };
        fit();
        this.refit = fit;
    }
    private refit: () => void = () => {};

    private dragger(handle: HTMLElement, apply: (dx: number, dy: number, g: { x: number; y: number; w: number; h: number }) => void): void {
        handle.addEventListener("pointerdown", e => {
            if ((e.target as HTMLElement).closest("button")) return;
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
        closeModal();
        this.busy = false;
        const report = rep.finish(s);
        if (away >= REPORT_MIN_MS) this.showReport(report);
        await this.save();
    }

    private startLoop(): void {
        this.stopLoop();
        this.makeCtx();
        this.sig = "";
        this.renderTab(true);
        const ev: SimEvents = {
            ...this.battle.events(() => performance.now(), () => this.state!),
            story: text => this.showStory(text),
            zone: (_from, to, why) => { if (why === "unlock") this.toast(`New road: ${ZONES[to]?.name ?? to}`); },
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
            this.battle.draw(this.state, sheetOf(this.state), performance.now());
            this.drawHud();
            this.renderTab(false);
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
                if (typeof err === "string") this.toast(err);
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

    private renderTab(force: boolean): void {
        if (!this.state || !this.ctx) return;
        const sig = this.view + ":" + viewSig(this.view, this.ctx);
        if (!force && sig === this.sig) return;
        this.sig = sig;
        for (const b of this.tabs.querySelectorAll("button")) b.classList.toggle("on", b.getAttribute("data-v") === this.view);
        const top = this.body.scrollTop;
        clear(this.body);
        this.body.append(renderView(this.view, this.ctx));
        this.body.scrollTop = top;
    }

    private hudEls: Record<string, { fill: HTMLElement; text: HTMLElement }> = {};
    private drawHud(): void {
        const s = this.state!;
        const sh = sheetOf(s);
        const run = s.activity.run;
        if (!this.hud.childElementCount) {
            for (const k of ["life", "es", "mana", "flask", "xp", "zone"]) {
                const fill = h("i"), text = h("span");
                this.hud.append(h("div", { class: "meter" }, fill, text));
                this.hudEls[k] = { fill, text };
            }
        }
        const set = (k: string, f: number, color: string, text: string) => {
            const e = this.hudEls[k]!;
            e.fill.style.width = (Math.max(0, Math.min(1, f)) * 100).toFixed(1) + "%";
            e.fill.style.background = color;
            if (e.text.textContent !== text) e.text.textContent = text;
        };
        const hh = run?.hero;
        const n = (x: number) => fmt(Math.floor(Math.max(0, x)));
        set("life", hh ? hh.life / sh.life : 1, "#e5383b", `Life ${n(hh?.life ?? sh.life)} / ${n(sh.life)}`);
        set("es", sh.es ? (hh?.es ?? sh.es) / sh.es : 0, "#7fd1ff", sh.es ? `Shield ${n(hh?.es ?? sh.es)} / ${n(sh.es)}` : "No energy shield");
        set("mana", hh ? hh.mana / sh.mana : 1, "#3a7bff", `Mana ${n(hh?.mana ?? sh.mana)} / ${n(sh.mana)}`);
        set("flask", (hh?.flask ?? 30) / 30, "#3fbf5f", `Flask ${Math.floor(hh?.flask ?? 30)} / 30`);
        const need = xpToNext(s.hero.level);
        set("xp", isFinite(need) ? s.hero.xp / need : 1, "#ffc233", `Level ${s.hero.level}  ${isFinite(need) ? ((s.hero.xp / need) * 100).toFixed(1) + "%" : "max"}`);
        const z = ZONES[s.activity.zone]!;
        const packs = run ? run.packs + (run.boss ? 1 : 0) : 1;
        set("zone", run ? run.pack / packs : 0, "#19b3a3", `${z.name} (L${z.level})  ${s.world.clears[z.id] ?? 0} clears`);
        const free = supportSlots(s.hero.level) > s.hero.supports.filter(id => SUPPORTS[id] && SUPPORTS[id]!.level <= s.hero.level).length
            && Object.values(SUPPORTS).some(x => x.level <= s.hero.level && !s.hero.supports.includes(x.id));
        const skillsTab = this.tabs.querySelector('[data-v="skills"]');
        if (skillsTab && skillsTab.textContent !== (free ? "Skills !" : "Skills")) skillsTab.textContent = free ? "Skills !" : "Skills";
        const who = `${s.hero.name}, level ${s.hero.level} ${CLASSES[s.hero.cls]?.name ?? ""}  |  ${fmt(sh.skill.packDps)} pack DPS`;
        if (this.who.textContent !== who) this.who.textContent = who;
    }

    toast(msg: string): void {
        const t = h("div", { class: "toast", text: msg });
        this.win.append(t);
        setTimeout(() => t.remove(), 2200);
    }

    modal(content: HTMLElement): () => void {
        const m = h("div", { class: "modal" }, content);
        this.win.append(m);
        return () => m.remove();
    }

    private showCreation(): void {
        clear(this.body);
        clear(this.hud);
        this.hudEls = {};
        this.who.textContent = "A new Kindled";
        let started = false;
        this.body.append(creationView(async (name, cls) => {
            if (started) return;
            started = true;
            this.state = newGame({ name, cls, now: Date.now(), seed: (Math.random() * 2 ** 32) >>> 0 });
            await this.save();
            this.startLoop();
        }));
    }

    private showStory(text: string): void {
        const card = h("div", { class: "card col" }, h("h3", { text: "The road remembers" }), h("div", { class: "story", text }));
        const close = this.modal(card);
        card.append(h("button", { class: "btn", text: "Onward", on: { click: () => close() } }));
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
    return { name: s.hero.name, cls: s.hero.cls, level: s.hero.level, zone: s.activity.zone, savedAt: Date.now(), xpFrac: isFinite(need) ? s.hero.xp / need : 1 };
}

export { SAVE_VERSION };
