// Entry. In Discord, registers the "arpg" addon with Quest Agent's hub (the
// hub shows a launcher card in its panel). Without a hub (dev/play.html),
// boots straight into the game window.

import { GameWindow, type Summary } from "./ui/app";
import { mountCard } from "./ui/card";
import { openStore, type SaveStore } from "./platform/store";

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
    "arpg.card.focus": "Game is open",
    "arpg.card.hint": "Opens in its own window. Nothing runs while it is closed; progress is replayed on open.",
};

interface HubApi {
    t(key: string, params?: Record<string, unknown>): string;
    theme(): string;
    load(): unknown;
    save(obj: unknown): boolean;
}

let storePromise: Promise<SaveStore> | null = null;
let game: GameWindow | null = null;
let hub: HubApi | null = null;
let refreshCard: (() => void) | null = null;

const store = () => (storePromise ??= openStore());

async function openGame(): Promise<void> {
    if (!game) {
        game = new GameWindow(await store(), {
            summary: (s: Summary) => { hub?.save(s); refreshCard?.(); },
            theme: () => (hub?.theme() === "light" ? "light" : hub ? "dark" : "light"),
            onClose: () => { refreshCard?.(); if (!hub) showOpener(); },
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
    init(api: HubApi) { hub = api; },
    mount(el: HTMLElement, api: HubApi) {
        hub = api;
        let view: { unmount(): void } | null = null;
        const draw = () => {
            view?.unmount();
            const saved = api.load() as Summary | null;
            view = mountCard(el, api, saved && typeof saved.level === "number" ? saved : null, !!game?.isOpen, () => void openGame());
        };
        draw();
        refreshCard = draw;
        return { unmount() { view?.unmount(); if (refreshCard === draw) refreshCard = null; } };
    },
    destroy() { void game?.close(); game = null; hub = null; },
};

// Standalone page: a button to reopen the window after closing it.
function showOpener(): void {
    const b = document.createElement("button");
    b.textContent = "Open Hollowmarch";
    b.setAttribute("style", "position:fixed;left:16px;bottom:16px;z-index:10049;font:900 14px Segoe UI,sans-serif;padding:10px 16px;background:#ffc233;border:3px solid #111;box-shadow:4px 4px 0 #111;cursor:pointer");
    b.addEventListener("click", () => { b.remove(); void openGame(); });
    document.body.append(b);
}

const w = window as unknown as { __questAgent?: unknown; __questAgentAddons?: { push(d: unknown): unknown }; __hollowmarch?: unknown };
if (w.__questAgent || w.__questAgentAddons) {
    const queue = w.__questAgentAddons ?? (w.__questAgentAddons = [] as unknown[] as { push(d: unknown): unknown });
    queue.push(def);
} else {
    void openGame();
}
w.__hollowmarch = { open: openGame, close: () => game?.close(), get game() { return game; } };
