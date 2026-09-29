// Entry. In Discord, registers the "arpg" addon with Quest Agent's hub (the
// hub shows a launcher card in its panel). Without a hub (dev/play.html),
// boots straight into the game window.

import { GameWindow, type Summary } from "./ui/app";
import { mountCard, type CardStatus } from "./ui/card";
import { openStore, type SaveStore } from "./platform/store";
import { hubKV, localKV } from "./platform/kv";

const ID = "arpg";
const ICON = "M12 1.5c1.7 3.1 4.6 4.9 4.6 8.9a4.6 4.6 0 0 1-9.2 0c0-1.9.8-3.2 1.9-4.3.2 1.4.9 2.4 2.2 2.8-.6-2.6-.2-5 .5-7.4ZM4 17h16v2.5H4ZM7 21h10v1.5H7Z";

const STRINGS: Record<string, string> = {
    "arpg.title": "Hollowmarch",
    "arpg.desc": "An idle action RPG. Build a hero, it fights on its own; time away is replayed when you come back.",
    "arpg.card.line": "Level {level} {cls} in {zone}",
    "arpg.card.away": "Last seen {time} ago. The road kept going.",
    "arpg.card.new": "The sun went out. You woke up anyway.",
    "arpg.card.play": "Open the game",
    "arpg.card.start": "Start a hero",
    "arpg.card.show": "Show the window",
    "arpg.card.fold": "Fold to strip",
    "arpg.card.unfold": "Full window",
    "arpg.card.stateOpen": "Playing",
    "arpg.card.stateMini": "In the strip",
    "arpg.card.inWindow": "Playing now in its own window.",
    "arpg.card.inMini": "Playing now, folded into the mini strip.",
    "arpg.card.hint": "Opens in its own window. Nothing runs while it is closed; progress is replayed on open.",
    "arpg.card.hintOpen": "Closing the window pauses nothing: the time away is replayed on the next open.",
};

interface HubApi {
    t(key: string, params?: Record<string, unknown>): string;
    theme(): string;
    load(): unknown;
    save(obj: unknown): boolean;
}

let storePromise: Promise<SaveStore> | null = null;
let game: GameWindow | null = null;
let opening: Promise<void> | null = null;
const w = window as unknown as { __questAgent?: unknown; __questAgentAddons?: { push(d: unknown): unknown }; __hollowmarch?: unknown };
/** No hub on the page (dev/play.html): the game boots by itself. */
const standalone = !(w.__questAgent || w.__questAgentAddons);
let hub: HubApi | null = null;
let refreshCard: (() => void) | null = null;

const store = () => (storePromise ??= openStore());

function openGame(): Promise<void> {
    // One open at a time: a double click must not create two windows on one save.
    return (opening ??= doOpen().finally(() => { opening = null; }));
}

/** Bumped by destroy(): anything started before it must not act afterwards. */
let generation = 0;

async function doOpen(): Promise<void> {
    const gen = generation;
    if (!game) {
        const st = await store();
        if (gen !== generation) return; // switched off while opening
        const kv = hub ? hubKV(hub) : localKV();
        game = new GameWindow(st, kv, {
            summary: (s: Summary) => { if (hub) { const o = (hub.load() as Record<string, unknown> | null) ?? {}; hub.save({ ...o, summary: s }); } refreshCard?.(); },
            theme: () => (hub?.theme() === "light" ? "light" : hub ? "dark" : "light"),
            onClose: () => { refreshCard?.(); if (standalone) showOpener(); },
            onMini: () => refreshCard?.(),
        });
    }
    await game.open();
    refreshCard?.();
}

const def = {
    id: ID,
    version: 1,
    icon: ICON,
    strings: STRINGS,
    init(api: HubApi) { hub = api; generation++; },
    /** The hub's title-bar button works like a taskbar button: opens the game, then folds it to mini mode and back. */
    launch(api: HubApi) { hub = api; if (game?.isOpen) void game.toggle(); else void openGame(); },
    mount(el: HTMLElement, api: HubApi) {
        hub = api;
        let view: { unmount(): void } | null = null;
        const draw = () => {
            view?.unmount();
            const o = api.load() as { summary?: Summary; level?: number } | null;
            const saved = o?.summary ?? (o && typeof o.level === "number" ? (o as Summary) : null);
            const status: CardStatus = game?.isOpen ? (game.isMini ? "mini" : "open") : "closed";
            view = mountCard(el, api, saved && typeof saved.level === "number" ? saved : null, status, {
                open: () => void openGame(),
                mini: on => { if (game?.isOpen) game.setMini(on); },
            });
        };
        draw();
        refreshCard = draw;
        return { unmount() { view?.unmount(); if (refreshCard === draw) refreshCard = null; } };
    },
    destroy() {
        // Switched off in Settings: save and close, then let go of the hub,
        // unless the addon was switched back on meanwhile (a newer generation).
        const g = game, gen = ++generation;
        game = null;
        void (g ? g.close() : Promise.resolve()).finally(() => { if (gen === generation) { hub = null; refreshCard = null; } });
    },
};

// Standalone page: a button to reopen the window after closing it.
function showOpener(): void {
    const b = document.createElement("button");
    b.textContent = "Open Hollowmarch";
    b.setAttribute("style", "position:fixed;left:16px;bottom:16px;z-index:10049;font:900 14px Segoe UI,sans-serif;padding:10px 16px;background:#ffc233;border:3px solid #111;box-shadow:4px 4px 0 #111;cursor:pointer");
    b.addEventListener("click", () => { b.remove(); void openGame(); });
    document.body.append(b);
}

if (!standalone) {
    const queue = w.__questAgentAddons ?? (w.__questAgentAddons = [] as unknown[] as { push(d: unknown): unknown });
    queue.push(def);
} else {
    void openGame();
}
w.__hollowmarch = { open: openGame, close: () => game?.close(), get game() { return game; } };
