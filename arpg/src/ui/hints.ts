// First-time hints: one line where a round-five feature first shows up, gone
// for good once dismissed. The save keeps which (settings.hints), so a hint
// read in Discord stays read everywhere; Menu > Show hints again clears them.

import { h } from "./dom";
import { glyph, type GlyphName } from "./glyphs";
import { t } from "../i18n";
import type { GameState } from "../core/state";
import type { Ctx } from "./views";

export const HINTS = ["market", "sockets", "pouch", "echoes", "rekindle"] as const;
export type HintId = (typeof HINTS)[number];
const GLYPH: Record<HintId, GlyphName> = { market: "market", sockets: "socket", pouch: "gem", echoes: "log", rekindle: "sun" };

export const hintsSeen = (s: GameState): string[] => s.settings.hints ?? [];

/** The hint line, or null once it has been dismissed. */
export function hint(c: Ctx, id: HintId): HTMLElement | null {
    if (hintsSeen(c.state).includes(id)) return null;
    return h("div", { class: "note hint1", attrs: { role: "note" } }, glyph(GLYPH[id], 16), h("span", { class: "grow", text: t(`hint.${id}`) }),
        h("button", { class: "btn alt small", text: t("hint.ok"), on: { click: () => c.act(s => { s.settings.hints = [...new Set([...hintsSeen(s), id])]; }) } }));
}
