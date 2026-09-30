// Tab views. Each returns a fresh element; the app swaps it in when the view's
// signature changes, so scroll position and selection survive sim ticks. Each
// tab lives in its own module (hero.ts, gear.ts, skills.ts, world.ts, log.ts,
// menu.ts; forge, tree, atlas and market beside them).

import { marketSig, marketView } from "./market";
import { sunShards } from "../core/echoes";
import { hintsSeen } from "./hints";
import type { Sfx } from "./sfx";
import { runZone } from "../core/sim/engine";
import type { Sheet } from "../core/character";
import { ownedItem } from "../core/game";
import type { GameState } from "../core/state";
import { SLOTS, type Slot } from "../core/types";
import { forgeView } from "./forge";
import { treeView } from "./tree";
import { atlasSig, atlasView } from "./atlas";
import { rerollCost } from "../core/contracts";
import { t } from "../i18n";
import { gearSig, gearView } from "./gear";
import { heroView } from "./hero";
import { logSig, logView } from "./log";
import { menuView } from "./menu";
import { skillsView } from "./skills";
import { hollowSig, shrineSig, worldView } from "./world";

export interface Ctx {
    state: GameState;
    sheet(): Sheet;
    /** Runs a player action; `ok` is toasted and `sound` played when it succeeds. */
    act(fn: (s: GameState) => string | null | void, ok?: string, sound?: Sfx): void;
    toast(msg: string): void;
    modal(content: HTMLElement): () => void;
    sel: { uid?: number; slot?: Slot };
    /** Set while the player drags an item or reads a tooltip: the view isn't rebuilt under the mouse. */
    hold: boolean;
    rerender(): void;
    exportSave(): string;
    importSave(text: string): Promise<string | null>;
    resetGame(): void;
    storeKind: string;
}

export type ViewId = "hero" | "gear" | "forge" | "skills" | "tree" | "world" | "atlas" | "log" | "menu" | "market";

/** The tabs in rail order; labels are "nav.<id>" strings. */
export const VIEWS: { id: ViewId }[] = [
    { id: "hero" }, { id: "gear" }, { id: "forge" }, { id: "skills" }, { id: "tree" }, { id: "world" }, { id: "atlas" }, { id: "log" }, { id: "menu" }, { id: "market" },
];

/** What a view depends on; it is rebuilt when this changes (the app adds the language). */
export function viewSig(id: ViewId, c: Ctx): string {
    const s = c.state;
    switch (id) {
        case "hero": return `${s.hero.rev}:${s.hero.level}:${s.activity.run ? runZone(s, s.activity.run).name : s.activity.zone}:${Object.keys(s.companions).length}:${s.hero.pet ? Math.floor((s.companions[s.hero.pet.id] ?? 0) / 100) : -1}`;
        case "gear": return `${s.hero.rev}:${s.stash.length}:${s.stash[s.stash.length - 1]?.uid ?? 0}:${s.dust}:${c.sel.uid}:${c.sel.slot}:${gearSig(s)}`;
        case "forge": return `${s.hero.rev}:${s.stash.length}:${s.dust}:${JSON.stringify(s.currency)}:${c.sel.uid}:${s.craftSeq}:${gearSig(s)}:${JSON.stringify(s.stones)}:${JSON.stringify(c.sel.uid !== undefined ? ownedItem(s, c.sel.uid)?.stones ?? SLOTS.map(k => s.hero.equipment[k]).find(x => x?.uid === c.sel.uid)?.stones ?? null : null)}`;
        case "skills": return `${s.hero.rev}:${s.hero.level}`;
        case "tree": return `${s.hero.rev}:${s.hero.level}:${s.dust >= 5 + s.hero.level * 2}:${s.hero.ascPoints}`;
        case "world": return `${s.activity.mode}:${s.activity.zone}:${s.world.unlocked.length}:${s.activity.autoPush}:${Object.values(s.world.clears).reduce((a, b) => a + b, 0)}:${s.contracts.list.map(x => `${x.kind}${x.n}/${x.target}`).join(",")}:${s.dust >= rerollCost(s)}:${shrineSig(s)}:${hollowSig(s)}`;
        case "atlas": return atlasSig(c);
        case "log": return logSig(s);
        case "menu": return `${hintsSeen(s).length}:${s.settings.keep}:${s.settings.autoEquip}:${s.settings.upkeep}:${s.settings.autoStones}:${JSON.stringify(s.settings.filter)}:${sunShards(s).length}:${JSON.stringify(s.hero.dawn ?? null)}`;
        case "market": return marketSig(s);
    }
}

export function renderView(id: ViewId, c: Ctx): HTMLElement {
    switch (id) {
        case "hero": return heroView(c);
        case "gear": return gearView(c);
        case "forge": return forgeView(c);
        case "tree": return treeView(c);
        case "skills": return skillsView(c);
        case "world": return worldView(c);
        case "atlas": return atlasView(c);
        case "log": return logView(c);
        case "menu": return menuView(c);
        case "market": return marketView(c);
    }
}
