// "While you were away": collects what happened during a catch-up.

import { MONSTERS, ZONES } from "../data";
import { itemLabel } from "../items";
import type { GameState } from "../state";
import type { Item } from "../types";
import type { SimEvents } from "./engine";

export interface Report {
    from: number;
    to: number;
    levelFrom: number;
    levelTo: number;
    xp: number;
    runs: number;
    kills: number;
    bosses: number;
    deaths: number;
    kept: number;
    salvaged: number;
    /** Stash items upkeep gave up for better drops. */
    swapped: number;
    /** Relics found for the first time. */
    newRelics: string[];
    dust: number;
    equipped: string[];
    best: Item[];
    zones: string[];
    story: string[];
}

export function startReport(state: GameState): { report: Report; events: SimEvents; finish(state: GameState): Report } {
    const report: Report = {
        from: state.simTo, to: state.simTo, levelFrom: state.hero.level, levelTo: state.hero.level, xp: 0,
        runs: 0, kills: 0, bosses: 0, deaths: 0, kept: 0, salvaged: 0, swapped: state.totals.swapped ?? 0, newRelics: [], dust: state.dust, equipped: [], best: [], zones: [], story: [],
    };
    const seen = new Set(Object.keys(state.codex ?? {}));
    const events: SimEvents = {
        kill: (m, xp) => { report.kills++; report.xp += xp; if (MONSTERS[m.def]?.boss) report.bosses++; },
        death: () => { report.deaths++; },
        runDone: () => { report.runs++; },
        loot: (item, kept, equipped) => {
            if (item.relic && !seen.has(item.relic)) { seen.add(item.relic); report.newRelics.push(itemLabel(item)); }
            if (equipped) report.equipped.push(itemLabel(item));
            else if (kept) report.kept++;
            else report.salvaged++;
            if (kept && (item.rarity === "rare" || item.rarity === "relic")) {
                report.best.push(item);
                if (report.best.length > 6) report.best.shift();
            }
        },
        zone: (_from, to, why) => { if (why === "unlock") report.zones.push(ZONES[to]?.name ?? to); },
        story: text => { report.story.push(text); },
    };
    return {
        report, events,
        finish(s: GameState) { report.to = s.simTo; report.levelTo = s.hero.level; report.dust = s.dust - report.dust; report.swapped = (s.totals.swapped ?? 0) - report.swapped; return report; },
    };
}
