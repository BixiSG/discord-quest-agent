// A simple player for the balance simulator: picks the best skill and
// supports, and spends passive points greedily by build score.

import { RARITY_RANK, buildScore, salvage, setSkill, setSupports, sheetOf } from "../src/core/game";
import { forgeCost, forgeRare } from "../src/core/crafting";
import { SLOTS } from "../src/core/types";
import { deriveSheet, supportSlots } from "../src/core/character";
import { ASCENDANCIES, ATLAS, PASSIVES, PINNACLES, SKILLS, SUPPORTS, companionLevel } from "../src/core/data";
import { setCompanion } from "../src/core/companions";
import { BLESSINGS, setKeep } from "../src/core/shrine";
import { scoutPinnacle } from "../src/core/scout";
import { buyGear, tickMarket } from "../src/core/market";
import { autoSetStones, cutStones } from "../src/core/sockets";
import { upgradeSlot } from "../src/core/game";
import { canTakeAtlas, endgameOpen, queuePinnacle, setMapMode, takeAtlas } from "../src/core/maps";
import { ascPointsLeft, canAllocate, chooseAscendancy, pointsLeft, takeAscNode } from "../src/core/passives";
import type { GameState, Hero } from "../src/core/state";

const score = (hero: Hero) => buildScore(deriveSheet({ ...hero, rev: -1 }));

export function botTune(state: GameState): void {
    const hero = state.hero;
    // Skill + supports: greedy supports for each usable skill, keep the best.
    let best = { skill: hero.skill, supports: hero.supports, score: -1 };
    for (const sk of Object.values(SKILLS)) {
        if (sk.level > hero.level) continue;
        const sup: string[] = [];
        for (let slot = 0; slot < supportSlots(hero.level); slot++) {
            let pick: string | null = null, ps = score({ ...hero, skill: sk.id, supports: sup });
            for (const s of Object.values(SUPPORTS)) {
                if (s.level > hero.level || sup.includes(s.id)) continue;
                const v = score({ ...hero, skill: sk.id, supports: [...sup, s.id] });
                if (v > ps * 1.001) { ps = v; pick = s.id; }
            }
            if (!pick) break;
            sup.push(pick);
        }
        const v = score({ ...hero, skill: sk.id, supports: sup });
        if (v > best.score) best = { skill: sk.id, supports: sup, score: v };
    }
    setSkill(state, best.skill);
    setSupports(state, best.supports);
    // Passives: take the open node with the best score gain, notables first on ties.
    while (pointsLeft(hero) > 0) {
        const open = Object.values(PASSIVES).filter(n => !canAllocate(hero, n.id));
        if (!open.length) break;
        let pick = open[0]!, ps = -1;
        for (const n of open) {
            const v = score({ ...hero, passives: [...hero.passives, n.id] }) * (n.kind === "notable" ? 1.002 : 1);
            if (v > ps) { ps = v; pick = n; }
        }
        hero.passives.push(pick.id);
        hero.rev++;
    }
    // Ascendancy: pick the one whose full node set scores best, then take nodes greedily.
    if (!hero.asc && hero.ascPoints > 0) {
        let pick = "", ps = -1;
        for (const a of Object.values(ASCENDANCIES).filter(x => x.cls === hero.cls)) {
            const v = score({ ...hero, asc: a.id, ascNodes: a.nodes.map(n => n.id) });
            if (v > ps) { ps = v; pick = a.id; }
        }
        chooseAscendancy(state, pick);
    }
    while (hero.asc && ascPointsLeft(hero) > 0) {
        const open = ASCENDANCIES[hero.asc]!.nodes.filter(n => !hero.ascNodes.includes(n.id));
        if (!open.length) break;
        let pick = open[0]!, ps = -1;
        for (const n of open) { const v = score({ ...hero, ascNodes: [...hero.ascNodes, n.id] }); if (v > ps) { ps = v; pick = n; } }
        takeAscNode(state, pick.id);
    }
    // Companion: the one whose bonus scores best.
    let petPick: string | null = hero.pet?.id ?? null, petScore = score(hero);
    for (const id of Object.keys(state.companions ?? {})) {
        const v = score({ ...hero, pet: { id, level: companionLevel(state.companions[id]!) } });
        if (v > petScore * 1.001) { petScore = v; petPick = id; }
    }
    if (petPick && petPick !== hero.pet?.id) setCompanion(state, petPick);
    // Shrine: from level 20, keep every blessing up (spare orbs pay first).
    if (hero.level >= 20 && !state.shrine.keep.length) for (const b of BLESSINGS) setKeep(state, b.id, true);
    // Market: buy what would be worn at once (keeping a reserve for the shrine); cut stones up.
    tickMarket(state);
    state.market.pedlar.forEach((o, i) => { if (!o.sold && state.dust >= o.price * 2 && upgradeSlot(state, o.item)) buyGear(state, i); });
    for (const k of Object.keys(state.stones)) while ((state.stones[k] ?? 0) >= 3 && !cutStones(state, k)) { /* cut */ }
    autoSetStones(state);
    // Spend dust like a player would: forge rares for the weakest slots (up to 20 per tune).
    for (let n = 0; n < 20 && state.dust >= forgeCost(state) * 3; n++) {
        const worst = SLOTS.map(s => ({ s, v: hero.equipment[s] ? (RARITY_RANK[hero.equipment[s]!.rarity] * 100 + hero.equipment[s]!.ilvl) : -1 }))
            .sort((a, b) => a.v - b.v)[0]!.s;
        forgeRare(state, worst);
        // Keep the stash from filling with forged misses.
        salvage(state, state.stash.filter(x => x.crafted).map(x => x.uid));
    }
    // Endgame: run maps, spend atlas points in table order, fight pinnacles when sigils allow.
    if (endgameOpen(state)) {
        setMapMode(state, true);
        for (const id of Object.keys(ATLAS)) if (!canTakeAtlas(state, id)) takeAtlas(state, id);
        // Pinnacles only when a scout says the hero wins most fights (like a careful player).
        for (const p of Object.values(PINNACLES)) {
            if (state.activity.pinnacle || (state.sigils[p.sigil] ?? 0) < p.cost) continue;
            if (scoutPinnacle(state, p.id, 3).wins >= 2) queuePinnacle(state, p.id);
        }
    }
    void sheetOf(state);
}
