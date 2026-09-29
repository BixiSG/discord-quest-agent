// The game window: a Shadow DOM root on document.body with its own frame,
// drag, resize, maximize and a mini mode. Owns the game state while open.
// Closed means closed: no timers, no drawing; the next open catches up from
// the saved timestamp. Mini mode is still open: the hero keeps fighting.

import { iconName, itemIcon } from "./gfx/itemart";
import type { Item } from "../core/types";
import { parseStone } from "../core/data";
import { allShards } from "../core/echoes";
import { perksToPick } from "../core/dawn";
import { echoWho, stoneFullName } from "../i18n/names";
import { advance, runSheet, runZone, STEP_MS, type SimEvents } from "../core/sim/engine";
import { startReport, type Report } from "../core/sim/report";
import { newGame, sheetOf } from "../core/game";
import { SAVE_VERSION, SaveError, exportText, importText, unwrap, wrap, type SaveEnvelope } from "../core/save";
import { validateState } from "../core/validate";
import type { GameState } from "../core/state";
import { ZONES, CLASSES, SUPPORTS, xpToNext } from "../core/data";
import { deriveSheet, supportSlots } from "../core/character";
import { baseOf } from "../core/items";
import { pointsLeft, ascPointsLeft } from "../core/passives";
import { atlasPointsLeft } from "../core/maps";
import { claimable } from "../core/contracts";
import type { SaveStore } from "../platform/store";
import type { KV } from "../platform/kv";
import { Battle } from "./battle";
import { CSS } from "./css";
import { clear, fmt, fmtDuration, h } from "./dom";
import { glyph, type GlyphName } from "./glyphs";
import { frameVars } from "./gfx/frames";
import { pixelize } from "./gfx/pix";
import { loadSprites } from "./gfx/sprites";
import { Hud, HUD_H } from "./hud";
import { Sound, type Sfx } from "./sfx";
import { installTips } from "./tips";
import { loadPixelFont } from "./gfx/webfont";
import { VIEWS, renderView, viewSig, type Ctx, type ViewId } from "./views";
import { creationView } from "./creation";
import { itemCard } from "./itemui";
import { lang, setLang, t, tn } from "../i18n";
import { className, companionName, itemName, placeName, relicName, skillName, storyText, zoneName } from "../i18n/names";
import { tErr } from "../i18n/errors";

const GEO_KEY = "window";
/** Frame state that is not geometry: stage size, mini, maximized. */
const UI_KEY = "frame";
/** Synchronous copy written on pagehide, when an IndexedDB write may not finish. */
const QUICK_KEY = "quicksave";
const BACKUP_MS = 5 * 60e3;
const AUTOSAVE_MS = 20e3;
const REPORT_MIN_MS = 60e3;
const MINI_W = 320;
/** The strip's battle view: 1x pixels, just tall enough for the hero and a pack. */
const MINI_STAGE_H = 84;
/** XP rate window for the time-to-level estimate. */
const XP_WINDOW_MS = 10 * 60e3;

type StageSize = "l" | "m" | "off";
const STAGE_FRAC: Record<Exclude<StageSize, "off">, number> = { l: 0.42, m: 0.28 };
const STAGE_NEXT: Record<StageSize, StageSize> = { m: "l", l: "off", off: "m" };
const STAGE_TITLE = (s: StageSize) => t(`app.stage.${s}`);

/** `sfx` replaced an older `sound` flag that defaulted to on: sound starts muted, even for old saves. */
interface Frame { stage: StageSize; mini: boolean; max: boolean; sfx: boolean; volume: number }

export interface Summary { name: string; cls: string; level: number; zone: string; savedAt: number; xpFrac: number; zoneId?: string; sky?: string }

export interface AppHooks {
    /** Small summary for the launcher card (hub storage). */
    summary?(s: Summary): void;
    theme?(): "dark" | "light";
    onClose?(): void;
    /** The window folded into the strip or back (the launcher card shows which). */
    onMini?(mini: boolean): void;
    /** The language to show (the hub's, in Discord); asked when the window opens and while it runs. */
    lang?(): string;
}

// Events typed or pasted in the game must not reach Discord's document handlers.
const STOP_EVENTS = ["keydown", "keyup", "keypress", "paste", "copy", "cut", "input"];

const NAV_GLYPH: Record<ViewId, GlyphName> = { hero: "hero", gear: "gear", forge: "forge", skills: "skills", tree: "tree", world: "world", atlas: "atlas", log: "log", menu: "menu", market: "market" };
/** Rarity colours for the HUD weapon slot's rim. */
const RIM: Record<string, string> = { plain: "#c9c3b5", enchanted: "#5aa9ff", rare: "#ffd23f", relic: "#ff8a3a" };
/** Tab keys: 1-9, then 0 for the tenth. */
const navKey = (i: number) => String((i + 1) % 10);

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
    private sound = new Sound({ on: false, volume: 0.35 });
    /** When the hero last swung or cast (performance.now()), for the skill slot's cooldown sweep. */
    private lastUse = 0;
    private nav!: HTMLDivElement;
    private who!: HTMLSpanElement;
    private miniBtn!: HTMLButtonElement;
    private maxBtn!: HTMLButtonElement;
    private miniBox!: HTMLDivElement;
    /** Mini strip rows: the last notable event, a dialog waiting for the full window, the replay progress. */
    private miniLast!: HTMLDivElement;
    private miniNote!: HTMLButtonElement;
    private miniProg!: HTMLDivElement;
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
    private frame: Frame = { stage: "m", mini: false, max: false, sfx: false, volume: 0.35 };
    private xpLog: [number, number][] = [];
    /** The strip's last notable event: a string key and params (it follows a language switch), or a toast's text. */
    private lastEvent: [string, Record<string, string | number>] | string | null = null;
    private closeBtn!: HTMLButtonElement;
    /** The language the window's fixed labels were drawn in. */
    private lang = "";
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
        if (!this.state) { this.flash(); return; } // creating a hero: the window stays full
        this.setMini(!this.frame.mini);
    }

    // ---- frame ----------------------------------------------------------------

    private build(): void {
        if (this.hooks.lang) setLang(this.hooks.lang());
        this.lang = lang();
        const host = document.createElement("div");
        host.id = "hollowmarch-root";
        this.host = host;
        this.root = host.attachShadow({ mode: "open" });
        void loadPixelFont();
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
            this.frame.sfx = f.sfx === true;
            if (typeof f.volume === "number" && f.volume >= 0 && f.volume <= 1) this.frame.volume = f.volume;
        }
        this.sound.set(this.frame.sfx, this.frame.volume); // open() is a click: audio may start

        const dark = this.hooks.theme?.() === "dark";
        const shell = h("div", { class: `hm${dark ? " dark" : ""}` });
        for (const [k, v] of Object.entries(frameVars(dark))) shell.style.setProperty(k, v);
        const ctl = (g: GlyphName, title: string, fn: () => void, cls = "") => {
            const b = h("button", { class: `ctl ${cls}`, title, attrs: { "aria-label": title }, on: { click: fn } }, glyph(g, 12));
            return b;
        };
        this.who = h("span", { class: "who" });
        this.stageBtn = ctl("stage", STAGE_TITLE("m"), () => this.setStage(STAGE_NEXT[this.frame.stage]), "sz");
        this.miniBtn = ctl("min", t("app.mini"), () => this.setMini(!this.frame.mini), "mn");
        this.maxBtn = ctl("max", t("app.max"), () => this.setMax(!this.frame.max), "mx");
        this.soundBtn = ctl("mute", t("app.soundOff"), () => this.setSound(!this.frame.sfx), "snd");
        this.closeBtn = ctl("close", t("app.close"), () => void this.close(), "x");
        const bar = h("div", { class: "bar" }, h("span", { class: "logo", text: "Hollowmarch" }), this.who,
            h("span", { class: "ctls" }, this.soundBtn, this.stageBtn, this.miniBtn, this.maxBtn, this.closeBtn));
        bar.addEventListener("dblclick", e => { if (!(e.target as HTMLElement).closest("button")) this.setMax(!this.frame.max); });

        // Dialogs never open inside the strip: they wait, hidden, and a row over the strip's battle brings the window back for them.
        this.miniLast = h("div", { class: "mlast", attrs: { "aria-live": "polite" } });
        this.miniNote = h("button", { class: "mnote", attrs: { hidden: "" }, on: { click: () => this.setMini(false) } });
        this.miniProg = h("div", { class: "mprog", attrs: { hidden: "" } }, h("span"), h("div", { class: "progress" }, h("i")));
        this.miniBox = h("div", { class: "minibox" }, this.miniProg, this.miniNote, this.miniLast);
        this.stage = h("div", { class: "stage" }, this.battle.canvas, this.miniBox);
        this.top = h("div", { class: "top" }, this.stage);
        // In the strip the battle is the handle: drag it to move, double-click for the full window.
        this.stage.addEventListener("dblclick", e => { if (this.frame.mini && !(e.target as HTMLElement).closest("button")) this.setMini(false); });
        this.hudWrap = h("div", { class: "hudw", attrs: { role: "img", "aria-label": t("app.hudLabel") } }, this.hud.canvas);

        this.nav = h("div", { class: "nav", attrs: { role: "tablist", "aria-label": t("app.sections") } });
        VIEWS.forEach((v, i) => {
            this.nav.append(h("button", { attrs: { "data-v": v.id, role: "tab", "aria-selected": "false", title: `${t(`nav.${v.id}`)} (${navKey(i)})` }, on: { click: () => {
                this.view = v.id; this.sig = ""; if (this.ctx) this.ctx.sel = {};
                this.renderTab(true); this.body.scrollTop = 0;
            } } }, glyph(NAV_GLYPH[v.id], 16), h("span", { class: "lbl", text: t(`nav.${v.id}`) }), h("span", { class: "key", text: navKey(i) }), h("span", { class: "badge", attrs: { hidden: "" } })));
        });
        this.body = h("div", { class: "body", attrs: { role: "tabpanel" } });
        const main = h("div", { class: "main" }, this.nav, this.body);

        this.toasts = h("div", { class: "toasts", attrs: { "aria-live": "polite" } });
        const grip = h("div", { class: "grip", attrs: { "aria-hidden": "true" } });
        this.win = h("div", { class: `win lang-${lang()}`, attrs: { role: "dialog", "aria-label": "Hollowmarch", lang: lang() } }, bar, this.top, this.hudWrap, main, this.toasts, grip);
        shell.append(this.win);
        this.root.append(shell);
        document.body.append(host);

        this.placeWindow();
        this.tips = installTips(this.win, this.win);
        this.dragger(bar, (dx, dy, g) => { g.x += dx; g.y += dy; });
        this.dragger(this.stage, (dx, dy, g) => { g.x += dx; g.y += dy; }, () => this.frame.mini);
        this.dragger(grip, (dx, dy, g) => { g.w += dx; g.h += dy; });

        this.win.tabIndex = -1;
        // Keyboard: Esc closes the top window inside the game, 1-9 switch tabs.
        this.win.addEventListener("keydown", e => {
            const t = e.target as HTMLElement;
            if (t.closest("input, textarea, select")) return;
            // Rows and item slots drawn as divs act like buttons from the keyboard too.
            if ((e.key === "Enter" || e.key === " ") && t.getAttribute("role") === "button" && t.tagName !== "BUTTON") { t.click(); e.preventDefault(); return; }
            if (e.key === "Escape") {
                if (this.frame.mini) return; // dialogs are hidden in the strip
                const modals = this.win.querySelectorAll(".modal");
                const top = modals[modals.length - 1] as HTMLElement | undefined;
                // Closing never confirms anything: the window is just dismissed (the catch-up one stays).
                if (top) { if (!top.querySelector(".progress")) { top.remove(); e.preventDefault(); } return; }
                // Otherwise a pinned card in the tab (it marks its close button data-esc).
                const esc = this.body.querySelector<HTMLElement>("[data-esc]");
                if (esc) { esc.click(); e.preventDefault(); }
                return;
            }
            if (e.ctrlKey || e.altKey || e.metaKey || this.frame.mini || this.win.querySelector(".modal")) return;
            const n = e.key === "0" ? 10 : Number(e.key);
            if (n >= 1 && n <= VIEWS.length) {
                (this.nav.children[n - 1] as HTMLElement | undefined)?.click();
                e.preventDefault();
                return;
            }
            if (e.key === "m" || e.key === "M") { this.setSound(!this.frame.sfx); e.preventDefault(); return; }
            // Views mark their own shortcuts: <button data-key="e">.
            const k = e.key.length === 1 ? e.key.toLowerCase() : "";
            const hot = k && /^[a-z]$/.test(k) ? this.body.querySelector<HTMLButtonElement>(`[data-key="${k}"]:not([disabled])`) : null;
            if (hot) { hot.click(); e.preventDefault(); }
        });
        this.applyFrame();
        pixelize(this.nav);
        // Item icons and portraits come from the atlas: redraw the tab once it has loaded.
        void loadSprites().then(() => { if (this.state && this.ctx) { this.sig = ""; this.renderTab(true); } });
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
            // Discord's own title bar (minimize, maximize, close) stays uncovered.
            const top = this.topReserve();
            g.w = Math.max(380, Math.min(g.w, vw - 8)); g.h = Math.max(340, Math.min(g.h, vh - top - 8));
            g.x = Math.max(0, Math.min(g.x, vw - (this.frame.mini ? MINI_W : g.w)));
            g.y = Math.max(top, Math.min(g.y, vh - (this.frame.mini ? MINI_STAGE_H + HUD_H + 12 : g.h)));
            // The HUD is pixel art too: whole-number scale, its logical width follows the window.
            const hudAt = (cssW: number, scale: number) => {
                this.hud.resize(cssW / scale);
                this.hud.canvas.style.width = cssW + "px";
                this.hud.canvas.style.height = HUD_H * scale + "px";
            };
            if (this.frame.mini) {
                Object.assign(this.win.style, { left: g.x + "px", top: g.y + "px", width: MINI_W + "px", height: "" });
                hudAt(MINI_W - 6, 1);
                this.stage.style.height = MINI_STAGE_H + "px";
                this.battle.resize(MINI_W - 6, MINI_STAGE_H);
                Object.assign(this.battle.canvas.style, { width: MINI_W - 6 + "px", height: MINI_STAGE_H + "px" });
                return;
            }
            const box = this.frame.max ? { x: 8, y: top + 8, w: vw - 16, h: vh - top - 16 } : g;
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

    private reserve = { at: -1e9, px: 0 };
    /**
     * How far down Discord's title bar reaches (its window buttons live there), measured
     * from whatever sits at the top-right corner: a full-width strip under 64px tall.
     */
    private topReserve(): number {
        const now = performance.now();
        if (now - this.reserve.at < 1500) return this.reserve.px;
        let px = 0;
        const hit = document.elementsFromPoint(window.innerWidth - 12, 3).find(el => el !== this.host && !this.host?.contains(el));
        for (let e: Element | null = hit ?? null; e && e !== document.body && e !== document.documentElement; e = e.parentElement) {
            const b = e.getBoundingClientRect();
            if (b.top <= 0 && b.height > 0 && b.height <= 64 && b.width >= window.innerWidth * 0.5) { px = Math.round(b.bottom); break; }
        }
        this.reserve = { at: now, px };
        return px;
    }

    private applyFrame(): void {
        const f = this.frame;
        this.win.classList.toggle("mini", f.mini);
        this.win.classList.toggle("max", f.max && !f.mini);
        this.top.classList.toggle("nostage", f.stage === "off");
        // Tooltip text goes to data-tip (the game's own tooltips), never a native title.
        this.stageBtn.dataset.tip = STAGE_TITLE(f.stage);
        this.stageBtn.setAttribute("aria-label", STAGE_TITLE(f.stage));
        const setGlyph = (b: HTMLButtonElement, g: GlyphName, title: string) => { b.replaceChildren(glyph(g, 12)); b.removeAttribute("title"); b.dataset.tip = title; b.setAttribute("aria-label", title); };
        setGlyph(this.miniBtn, f.mini ? "max" : "min", f.mini ? t("app.unmini") : t("app.mini"));
        setGlyph(this.maxBtn, f.max ? "restore" : "max", f.max ? t("app.restore") : t("app.max"));
        setGlyph(this.soundBtn, f.sfx ? "sound" : "mute", f.sfx ? t("app.soundOn") : t("app.soundOff"));
        setGlyph(this.closeBtn, "close", t("app.close"));
        this.soundBtn.classList.toggle("off", !f.sfx);
        this.refit();
    }
    private saveFrame(): void { this.kv.set(UI_KEY, { ...this.frame }); }
    setMini(on: boolean): void {
        if (on && !this.state) return; // no hero yet: nothing to show in a strip
        this.frame.mini = on; this.saveFrame(); this.applyFrame();
        if (!on) { this.sig = ""; this.renderTab(true); this.focusModal(); }
        this.syncMini();
        this.hooks.onMini?.(on);
    }
    private setMax(on: boolean): void { if (this.frame.mini) return; this.frame.max = on; this.saveFrame(); this.applyFrame(); }
    private setStage(s: StageSize): void { this.frame.stage = s; this.saveFrame(); this.applyFrame(); }
    private setSound(on: boolean): void { this.frame.sfx = on; this.saveFrame(); this.sound.set(on, this.frame.volume); this.applyFrame(); if (on) this.sound.play("click"); }
    /** A short pulse on the frame, so a click on the launcher visibly finds the window. */
    private flash(): void { this.win.classList.remove("flash"); void this.win.offsetWidth; this.win.classList.add("flash"); }

    private dragger(handle: HTMLElement, apply: (dx: number, dy: number, g: { x: number; y: number; w: number; h: number }) => void, when: () => boolean = () => true): void {
        handle.addEventListener("pointerdown", e => {
            if ((e.target as HTMLElement).closest("button") || e.button !== 0 || !when()) return;
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
        const shown = away > 2000;
        const closeModal = shown ? this.modal(h("div", { class: "card col" }, h("h3", { text: t("report.title") }), label, h("div", { class: "progress" }, bar))) : () => {};
        // The strip shows the same progress in one line.
        const [miniLabel, miniBar] = [this.miniProg.firstElementChild as HTMLElement, this.miniProg.querySelector("i") as HTMLElement];
        this.miniProg.hidden = !shown;
        const from = s.simTo, target = Date.now();
        stampTz(s);
        this.battle.quiet = true;
        while (!advance(s, target, rep.events, 25000)) {
            const f = (s.simTo - from) / Math.max(1, target - from);
            bar.style.width = miniBar.style.width = (f * 100).toFixed(1) + "%";
            label.textContent = miniLabel.textContent = t("app.replaying", { time: fmtDuration(target - from), pct: (f * 100).toFixed(0) });
            if (this.frame.mini) this.drawHud();
            await new Promise(r => setTimeout(r, 0));
            if (!this.host) return;
        }
        this.battle.quiet = false;
        this.xpLog = []; // replayed time is not a live rate
        this.miniProg.hidden = true;
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
            story: key => this.showStory(key),
            zone: (_from, to, why) => { if (why === "unlock") this.toast(t("toast.newRoad", { zone: ZONES[to] ? zoneName(to) : to }), "road"); },
            kill: (m, xp) => { if (xp > 0) this.xpLog.push([Date.now(), xp]); sfx(m.lantern ? "snuff" : "kill"); },
            level: l => { be.level?.(l); this.toast(t("toast.level", { level: l }), "level"); this.lastEvent = ["event.level", { level: l }]; sfx("level", true); },
            loot: (item, kept, equipped) => {
                if (!kept) return;
                if (item.rarity !== "plain") sfx(item.rarity === "enchanted" ? "loot1" : item.rarity === "rare" ? "loot2" : "loot3", item.rarity !== "enchanted");
                const name = itemName(item);
                if (equipped) { this.toast(t("toast.equipped", { item: name }), item.rarity); this.lastEvent = ["event.equipped", { item: name }]; }
                else if (item.rarity === "rare" || item.rarity === "relic") { this.toast(t(item.rarity === "relic" ? "toast.relic" : "toast.rare", { item: name }), item.rarity); this.lastEvent = ["event.found", { item: name }]; }
            },
            death: () => { this.lastEvent = ["event.died", {}]; sfx("death"); },
            stone: key => {
                // Only the good ones make noise; the rest go to the pouch quietly.
                if ((parseStone(key)?.tier ?? 0) >= 3) { const name = stoneFullName(key); this.toast(t("toast.stone", { name }), "rare"); this.lastEvent = ["toast.stone", { name }]; sfx("stone", true); }
            },
            echo: id => {
                const who = echoWho(id);
                this.toast(t("toast.echo", { who }), "relic");
                this.lastEvent = ["toast.echo", { who }];
                sfx("echo", true);
            },
            companion: (id, isNew) => {
                const pet = companionName(id);
                this.toast(t(isNew ? "toast.petJoins" : "toast.petCloser", { pet }), "relic");
                this.lastEvent = [isNew ? "event.petJoined" : "event.petCloser", { pet }];
                sfx("level", true);
            },
        };
        this.timer = window.setInterval(() => {
            if (!this.state || this.busy) return;
            // A long gap (sleep, throttled background tab) is replayed quietly, with a report.
            if (Date.now() - this.state.simTo > 30e3) { void this.catchUp(); return; }
            stampTz(this.state);
            advance(this.state, Date.now(), ev, 50);
            if (Date.now() - this.lastSave > AUTOSAVE_MS) void this.save();
        }, STEP_MS);
        const frame = () => {
            this.raf = requestAnimationFrame(frame);
            if (!this.state || document.hidden) return;
            if (this.frame.mini || this.frame.stage !== "off") this.battle.draw(this.state, runSheet(this.state), performance.now());
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
            act: (fn, ok, sound) => {
                const err = fn(this.state!);
                if (typeof err === "string") this.toast(tErr(err), "err");
                else { if (ok) this.toast(ok); if (sound) this.sound.play(sound); }
                this.sig = "";
                this.renderTab(true);
                void this.save();
            },
            toast: m => this.toast(m),
            modal: el => this.modal(el),
            sel: {},
            hold: false,
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

    private tips: { busy(): boolean } = { busy: () => false };
    private lastSigCheck = 0;
    private supportHint = { rev: -1, level: -1, gain: false };
    private renderTab(force: boolean): void {
        if (!this.state || !this.ctx) return;
        // Signatures are cheap but not free (some stringify state): check four times a second.
        if (!force) {
            const now = performance.now();
            if (now - this.lastSigCheck < 250 || this.ctx.hold || this.tips.busy()) return; // not under a drag or a tooltip
            this.lastSigCheck = now;
        }
        this.syncLang();
        this.updateBadges();
        const sig = this.view + ":" + lang() + ":" + viewSig(this.view, this.ctx);
        if (!force && sig === this.sig) return;
        this.sig = sig;
        for (const b of this.nav.querySelectorAll("button")) {
            const on = b.getAttribute("data-v") === this.view;
            b.classList.toggle("on", on);
            b.setAttribute("aria-selected", String(on));
        }
        const top = this.body.scrollTop;
        // A rebuild must not throw keyboard focus out of the tab: it goes back to the same place.
        const FOCUSABLE = "button, select, input, textarea, [tabindex='0']";
        const active = this.root.activeElement as HTMLElement | null;
        const focusAt = active && this.body.contains(active) ? [...this.body.querySelectorAll(FOCUSABLE)].indexOf(active) : -1;
        clear(this.body);
        this.body.append(renderView(this.view, this.ctx));
        pixelize(this.body);
        this.body.scrollTop = top;
        if (focusAt >= 0) (this.body.querySelectorAll<HTMLElement>(FOCUSABLE)[focusAt])?.focus({ preventScroll: true });
    }

    /** Follows the hub's language while the window is open: a change redraws the frame's own labels (the tab follows by its signature). */
    private syncLang(): void {
        if (this.hooks.lang) setLang(this.hooks.lang());
        if (lang() === this.lang || !this.host) return;
        this.lang = lang();
        this.win.classList.remove("lang-en", "lang-ru", "lang-uk");
        this.win.classList.add(`lang-${this.lang}`);
        this.win.setAttribute("lang", this.lang);
        this.nav.setAttribute("aria-label", t("app.sections"));
        this.hudWrap.setAttribute("aria-label", t("app.hudLabel"));
        VIEWS.forEach((v, i) => {
            const b = this.nav.children[i] as HTMLElement | undefined;
            if (!b) return;
            b.title = `${t(`nav.${v.id}`)} (${navKey(i)})`;
            delete b.dataset.tip;
            b.removeAttribute("aria-description");
            b.querySelector(".lbl")?.replaceWith(h("span", { class: "lbl", text: t(`nav.${v.id}`) }));
        });
        pixelize(this.nav);
        this.who.dataset.k = "";
        this.sig = "";
        this.applyFrame();
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
            skills: freeSupport ? ["!", t("badge.support")] : undefined,
            tree: tree ? [String(tree), tn("badge.tree", tree)] : undefined,
            atlas: atlas ? [String(atlas), tn("badge.atlas", atlas)] : undefined,
            gear: s.stashFull ? ["!", t("badge.stash")] : undefined,
            world: claimable(s) ? [String(claimable(s)), tn("badge.contracts", claimable(s))] : undefined,
            menu: perksToPick(s) ? ["!", t("badge.perk")] : allShards(s) ? ["!", t("badge.relight")] : undefined,
        };
        for (const b of this.nav.children) {
            const id = b.getAttribute("data-v") as ViewId;
            const badge = b.querySelector(".badge") as HTMLElement;
            const m = marks[id];
            const text = m?.[0] ?? "";
            if (badge.textContent !== text || badge.dataset.tip !== (m?.[1] ?? "")) { badge.textContent = text; badge.toggleAttribute("hidden", !m); badge.dataset.tip = m?.[1] ?? ""; }
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
            skillName: skillName(sh.skill.id), weaponKind: w ? baseOf(w).kind : null, spell: sh.skill.kind !== "attack",
            weaponArt: w ? this.weaponArt(w) : null, weaponRim: w ? RIM[w.rarity] : undefined,
            zone: placeName(s), zoneLevel: z.level, packDps: sh.skill.packDps, dead: run?.phase === "dead", respawn: run?.phase === "dead" ? run.timer : 0,
        }, now);

        const wk = `${z.id}|${z.palette.join()}`;
        if (wk !== this.whereKey) {
            this.whereKey = wk;
            // Letterbox the canvas in its own sky and ground colours, so any window shape looks deliberate.
            const [sky, ground] = z.palette;
            this.stage.style.background = `linear-gradient(to bottom, ${sky} 0 83.4%, #111 83.4% 85%, ${ground} 85% 100%)`;
        }
        const cls = CLASSES[s.hero.cls] ? className(s.hero.cls) : "";
        const who = `${s.hero.name}|${s.hero.level}|${cls}|${lang()}`;
        if (this.who.dataset.k !== who) {
            this.who.dataset.k = who;
            this.who.replaceChildren(h("b", { text: s.hero.name }), h("span", { text: t("app.who", { level: s.hero.level, cls }) }));
        }
        // Screen readers and hover get the numbers the canvas shows, refreshed once a second.
        if (now - this.ariaAt > 1000) {
            this.ariaAt = now;
            const n = (x: number) => fmt(Math.floor(Math.max(0, x)));
            const label = (run?.phase === "dead" ? t("hud.ariaDead", { n: Math.ceil(run.timer) }) : "") + t("hud.aria", {
                life: n(life), lifeMax: n(sh.life), es: sh.es ? t("hud.ariaEs", { es: n(es), esMax: n(sh.es) }) : "", mana: n(mana), manaMax: n(sh.mana), flask: Math.floor(hh?.flask ?? 30),
                level: s.hero.level, xp: (xpF * 100).toFixed(1), eta: eta ? ` (${eta})` : "", zone: placeName(s), area: z.level, dps: fmt(sh.skill.packDps) });
            this.hudWrap.setAttribute("aria-label", label);
            this.hudWrap.dataset.tip = label;
            this.syncLang();
            const e = this.lastEvent;
            const last = !e ? "" : typeof e === "string" ? e : t(e[0], e[1]);
            if (this.miniLast.textContent !== last) this.miniLast.textContent = last;
        }
    }

    /** "~12m to go" from the kill XP of the last few minutes; blank until there is enough to go on. */
    /** The worn weapon's item art, made once per weapon (again once the atlas is in, if it wasn't). */
    private wart: { uid: number; atlas: boolean; c: HTMLCanvasElement } | null = null;
    private weaponArt(w: Item): HTMLCanvasElement | null {
        if (!this.wart || this.wart.uid !== w.uid || (!this.wart.atlas && iconName(w))) {
            const c = itemIcon(w);
            this.wart = { uid: w.uid, atlas: c.classList.contains("ic"), c };
        }
        return this.wart.atlas ? this.wart.c : null;
    }

    private eta(left: number): string {
        const now = Date.now();
        while (this.xpLog.length && now - this.xpLog[0]![0] > XP_WINDOW_MS) this.xpLog.shift();
        if (!isFinite(left) || this.xpLog.length < 3) return "";
        const span = Math.max(30e3, now - this.xpLog[0]![0]);
        const rate = this.xpLog.reduce((a, [, x]) => a + x, 0) / span;
        if (rate <= 0) return "";
        return t("hud.eta", { time: fmtDuration(left / rate) });
    }

    private pingTimer = 0;
    toast(msg: string, kind = ""): void {
        // The strip is too small for toasts: the news goes to its event line, which flashes.
        if (this.frame.mini) {
            this.lastEvent = msg;
            this.miniLast.textContent = msg;
            this.miniLast.className = "mlast";
            void this.miniLast.offsetWidth;
            this.miniLast.className = `mlast ping${kind ? " t-" + kind : ""}`;
            clearTimeout(this.pingTimer);
            this.pingTimer = window.setTimeout(() => this.miniLast.classList.remove("ping"), 3200);
            return;
        }
        const t = h("div", { class: `toast${kind ? " t-" + kind : ""}`, text: msg });
        this.toasts.prepend(t);
        while (this.toasts.childElementCount > 4) this.toasts.lastElementChild!.remove();
        setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 220); }, kind === "err" ? 3200 : 2600);
    }

    /**
     * A dialog over the window. In mini mode it waits hidden (the strip gets a row that
     * brings the window back); a click on the backdrop closes it, except the replay one.
     */
    modal(content: HTMLElement): () => void {
        const m = h("div", { class: "modal", attrs: { role: "dialog", "aria-modal": "true" } }, content);
        const title = content.querySelector("h3")?.textContent?.trim();
        if (title) m.setAttribute("aria-label", title);
        const close = () => {
            if (!m.isConnected) return;
            const hadFocus = m.contains(this.root.activeElement);
            m.remove();
            if (hadFocus && !this.focusModal()) this.win.focus();
            this.syncMini();
        };
        m.addEventListener("click", e => { if (e.target === m && !m.querySelector(".progress")) close(); });
        this.win.append(m);
        this.syncMini();
        if (this.frame.mini && !m.querySelector(".progress")) this.flash();
        // Callers add their buttons right after this returns.
        queueMicrotask(() => { pixelize(m); this.focusModal(); });
        return close;
    }

    /** Moves focus to the top dialog's first button, only if the player is in the game (never out of Discord's chat box). */
    private focusModal(): boolean {
        if (!this.host || this.frame.mini || document.activeElement !== this.host) return false;
        const modals = this.win.querySelectorAll(":scope > .modal");
        const b = modals[modals.length - 1]?.querySelector<HTMLElement>("button, [tabindex]");
        b?.focus();
        return !!b;
    }

    /** The strip's row for dialogs that wait for the full window. */
    private syncMini(): void {
        if (!this.miniNote) return;
        const waiting = [...this.win.querySelectorAll<HTMLElement>(":scope > .modal")].filter(m => !m.querySelector(".progress"));
        const top = waiting[waiting.length - 1];
        this.miniNote.hidden = !top;
        if (!top) return;
        const title = top.getAttribute("aria-label") || t("mini.message");
        this.miniNote.dataset.tip = t("mini.tip", { title });
        this.miniNote.replaceChildren(glyph("log", 12), h("b", { text: title }), h("span", { text: waiting.length > 1 ? tn("mini.waiting", waiting.length) : t("mini.open") }));
    }

    private showCreation(): void {
        clear(this.body);
        this.win.classList.add("creating");
        if (this.frame.mini) this.setMini(false);
        this.who.dataset.k = "";
        this.who.replaceChildren(h("b", { text: t("app.newKindled") }));
        let started = false;
        this.body.append(creationView(async (name, cls) => {
            if (started) return;
            started = true;
            this.state = newGame({ name, cls, now: Date.now(), seed: (Math.random() * 2 ** 32) >>> 0 });
            await this.save();
            this.startLoop();
        }));
        pixelize(this.body);
    }

    private storyBox: HTMLElement | null = null;
    /** One story window at a time: later beats are added to the open one. Beats come as string keys. */
    private showStory(key: string): void {
        const text = storyText(key);
        if (this.storyBox?.isConnected) { this.storyBox.append(h("div", { class: "story", style: "margin-top:6px", text })); return; }
        const box = h("div", { class: "col" }, h("div", { class: "story", text }));
        const card = h("div", { class: "card col" }, h("h3", { text: t("story.title") }), box);
        const close = this.modal(card);
        this.storyBox = box;
        card.append(h("button", { class: "btn", text: t("story.onward"), on: { click: () => { close(); this.storyBox = null; } } }));
    }

    private showReport(r: Report): void {
        const rows: [string, string][] = [
            [t("report.away"), fmtDuration(r.to - r.from)],
            [t("report.runs"), fmt(r.runs)], [t("report.kills"), fmt(r.kills)], [t("report.bosses"), fmt(r.bosses)], [t("report.deaths"), fmt(r.deaths)],
            [t("report.levels"), r.levelTo > r.levelFrom ? t("report.levelUp", { from: r.levelFrom, to: r.levelTo }) : t("report.noChange", { level: r.levelTo })],
            [t("report.xp"), fmt(r.xp)], [t("report.kept"), fmt(r.kept)], [t("report.salvaged"), fmt(r.salvaged)], [t("report.dust"), `+${fmt(r.dust)}`],
            ...(r.swapped ? [[t("report.swapped"), fmt(r.swapped)] as [string, string]] : []),
        ];
        const kvEl = h("div", { class: "kv" });
        for (const [k, v] of rows) kvEl.append(h("div", { text: k }), h("div", { class: "num", text: v }));
        const card = h("div", { class: "card col" }, h("h3", { text: t("report.title") }), kvEl);
        const list = (xs: string[]) => xs.join(t("common.list"));
        for (const key of r.story.slice(-3)) card.append(h("div", { class: "story", text: storyText(key) }));
        if (r.zones.length) card.append(h("div", { class: "tag teal", text: t("report.roads", { list: list(r.zones.map(id => zoneName(id))) }) }));
        if (r.equipped.length) card.append(h("div", { class: "tag gold", text: t("report.equipped", { list: list(r.equipped.slice(-4).map(it => itemName(it))) }) }));
        if (r.newCompanions.length) card.append(h("div", { class: "tag gold", text: tn("report.pets", r.newCompanions.length, { list: list(r.newCompanions.map(id => companionName(id))) }) }));
        if (r.newRelics.length) card.append(h("div", { class: "tag", style: "background:var(--r-relic);color:#1a1410", text: t("report.relics", { list: list(r.newRelics.map(id => relicName(id))) }) }));
        if (r.best.length) {
            const best = r.best[r.best.length - 1]!;
            card.append(h("div", { class: "muted", text: t("report.best") }), itemCard(best, null));
        }
        const close = this.modal(card);
        card.append(h("button", { class: "btn", text: t("report.back"), on: { click: () => close() } }));
    }
}

/** The player's UTC offset for the core's calendar (Hollow Night follows the local date). */
function stampTz(s: GameState): void { s.tz = -new Date().getTimezoneOffset(); }

export function summaryOf(s: GameState): Summary {
    const need = xpToNext(s.hero.level);
    const run = s.activity.run;
    const z = run ? runZone(s, run) : ZONES[s.activity.zone];
    return { name: s.hero.name, cls: s.hero.cls, level: s.hero.level, zone: z ? placeName(s) : s.activity.zone, savedAt: Date.now(), xpFrac: isFinite(need) ? s.hero.xp / need : 1,
        zoneId: z?.id ?? s.activity.zone, sky: z?.palette[0] };
}

export { SAVE_VERSION };
