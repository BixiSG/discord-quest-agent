// The contract board: three standing goals (slay, clear, find) that fill in
// while the hero plays, each paying ember dust and currency, sometimes a
// relic the codex is missing, maps or a sigil. A finished contract waits to be
// claimed; claiming (or paying to reroll) puts a new one in its place. New
// contracts come from a seeded RNG, so they are deterministic like the rest.

import { CURRENCIES, CURRENCY_ORDER, MAX_TIER, PINNACLES, RELICS } from "./data";
import { endgameOpen, addMap, rollMap } from "./maps";
import { maxIlvl } from "./crafting";
import { pushLog, receiveItem } from "./game";
import { ref } from "../i18n/refs";
import { contractGoal } from "../i18n/names";
import { Rng, hashSeed } from "./rng";
import { grantCompanion, missingCompanions } from "./companions";
import type { GameState } from "./state";

export type ContractKind = "kills" | "champions" | "bosses" | "runs" | "maps" | "rares";

export interface Contract {
    kind: ContractKind;
    target: number;
    n: number;
    /** Maps: the lowest tier that counts. */
    tier?: number;
    dust: number;
    currency?: [string, number];
    /** An extra: a relic the codex is missing, a companion not found yet, a few maps, or a sigil. */
    extra?: "relic" | "companion" | "maps" | "sigil";
}

export interface ContractBoard { list: Contract[]; seq: number; done: number }

export const BOARD_SIZE = 3;

const KINDS: ContractKind[] = ["kills", "champions", "bosses", "runs", "maps", "rares"];

/** What a contract asks, in English ("Slay 1800 monsters"); the UI uses i18n/names contractGoal. */
export const contractText = (c: Contract) => contractGoal(c.kind, c.target, c.tier, "en");

/**
 * Dust a contract pays: what it was rolled with, or more if the hero has grown
 * since (a contract left waiting for levels must not pay like a level-1 one).
 */
export const contractDust = (s: GameState, c: Contract) => Math.max(c.dust, Math.round((60 + 25 * s.hero.level) * 0.9));

export function rewardText(c: Contract, s?: GameState): string {
    const parts = [`${s ? contractDust(s, c) : c.dust} dust`];
    if (c.currency) parts.push(`${c.currency[1]} ${CURRENCIES[c.currency[0]]?.name ?? c.currency[0]}`);
    if (c.extra === "relic") parts.push("a relic not in your codex");
    if (c.extra === "companion") parts.push("a companion you haven't met");
    if (c.extra === "maps") parts.push("3 maps");
    if (c.extra === "sigil") parts.push("a sigil");
    return parts.join(", ");
}

/** The deepest map tier completed (1 before any). */
const deepest = (s: GameState) => Math.max(1, ...(s.atlas?.tiers ?? []));

/** Relics that can drop at the hero's item level and are not in the codex yet. */
function missingRelics(s: GameState): string[] {
    const ilvl = maxIlvl(s);
    return Object.values(RELICS).filter(r => r.level <= ilvl && !s.codex[r.id]).map(r => r.id);
}

function rollContract(s: GameState, rng: Rng): Contract {
    const L = s.hero.level;
    const endgame = endgameOpen(s);
    const taken = new Set(s.contracts.list.map(c => c.kind));
    const kinds: ContractKind[] = (["kills", "champions", "bosses", endgame ? "maps" : "runs", "rares"] as ContractKind[]).filter(k => !taken.has(k));
    const kind: ContractKind = rng.pick(kinds.length ? kinds : ["kills" as ContractKind]);
    // Sized to take roughly half an hour of play at any stage.
    // Rares come faster as item rarity grows with the hero.
    const SIZE: Record<ContractKind, number> = { kills: 1800, champions: 80, bosses: 24, runs: 36, maps: 40, rares: 12 + Math.round(L * 0.9) };
    const size = SIZE[kind];
    const target = Math.max(3, Math.round(size * (0.8 + rng.next() * 0.4)));
    const c: Contract = { kind, target, n: 0, dust: Math.round((60 + 25 * L) * (0.9 + rng.next() * 0.3)) };
    if (kind === "maps") c.tier = Math.max(1, Math.min(MAX_TIER, deepest(s) - 2));
    // Currency: rarer orbs weigh more here than in drops.
    const cur = rng.weighted(CURRENCY_ORDER, id => 1 / Math.sqrt(CURRENCIES[id]!.drop))!;
    const rare = CURRENCIES[cur]!.drop < 200;
    c.currency = [cur, rare ? 1 + Math.floor(rng.next() * 3) : 3 + Math.floor(rng.next() * 6)];
    const r = rng.next();
    if (r < 0.3 && missingRelics(s).length) c.extra = "relic";
    else if (r < 0.4 && missingCompanions(s, maxIlvl(s)).length) c.extra = "companion";
    else if (r < 0.5 && endgame) c.extra = rng.chance(0.5) && deepest(s) >= 6 ? "sigil" : "maps";
    return c;
}

/** Tops the board up to three contracts (new games, old saves, after a claim). */
export function ensureContracts(s: GameState): void {
    s.contracts ??= { list: [], seq: 0, done: 0 };
    while (s.contracts.list.length < BOARD_SIZE) {
        const rng = new Rng(hashSeed(s.seed, 0x636f6e74, s.contracts.seq++));
        s.contracts.list.push(rollContract(s, rng));
    }
}

/** Progress from the simulation: every open contract of this kind moves on. */
export function contractEvent(s: GameState, kind: ContractKind, tier = 0): void {
    const b = s.contracts;
    if (!b) return;
    for (const c of b.list) {
        if (c.kind !== kind || c.n >= c.target) continue;
        if (kind === "maps" && tier < (c.tier ?? 1)) continue;
        c.n++;
        if (c.n >= c.target) pushLog(s, "info", "log.contractDone", { goal: ref.contract(c.kind, c.target, c.tier) });
    }
}

export const claimable = (s: GameState) => s.contracts?.list.filter(c => c.n >= c.target).length ?? 0;

/** Pays a finished contract and puts a new one in its place. */
export function claimContract(s: GameState, i: number): string | null {
    const c = s.contracts?.list[i];
    if (!c) return "no such contract";
    if (c.n < c.target) return "not finished yet";
    const rng = new Rng(hashSeed(s.seed, 0x636c6169, s.contracts.done));
    const dust = contractDust(s, c);
    s.dust += dust;
    if (c.currency) s.currency[c.currency[0]] = (s.currency[c.currency[0]] ?? 0) + c.currency[1];
    if (c.extra === "relic") {
        const pool = missingRelics(s);
        const id = pool.length ? rng.pick(pool) : null;
        const def = id ? RELICS[id] : undefined;
        if (def) {
            const item = { uid: s.nextUid++, base: def.base, ilvl: Math.max(def.level, maxIlvl(s)), rarity: "relic" as const, affixes: [], relic: def.id, relicRolls: def.mods.map(m => rng.int(m.range[0], m.range[1])) };
            receiveItem(s, item);
            pushLog(s, "loot", "log.contractRelic", { relic: ref.relic(def.id) });
        } else s.dust += dust; // the codex filled up meanwhile: double dust instead
    }
    if (c.extra === "companion") {
        const pool = missingCompanions(s, maxIlvl(s));
        if (pool.length) grantCompanion(s, rng.pick(pool));
        else s.dust += dust;
    }
    if (c.extra === "maps") for (let k = 0; k < 3; k++) addMap(s, rollMap(rng, s.nextUid++, Math.min(MAX_TIER, deepest(s))));
    if (c.extra === "sigil") {
        const open = Object.values(PINNACLES).filter(p => deepest(s) >= p.minTier);
        const p = open.length ? rng.pick(open) : undefined;
        if (p) s.sigils[p.sigil] = (s.sigils[p.sigil] ?? 0) + 1;
        else s.dust += dust;
    }
    s.contracts.list.splice(i, 1);
    s.contracts.done++;
    ensureContracts(s);
    // Keep the board's order stable: the new contract takes the claimed one's place.
    s.contracts.list.splice(i, 0, s.contracts.list.pop()!);
    return null;
}

export const rerollCost = (s: GameState) => 20 + 10 * s.hero.level;

/** Swaps an unwanted contract for a new one, for dust. Progress on it is lost. */
export function rerollContract(s: GameState, i: number): string | null {
    const c = s.contracts?.list[i];
    if (!c) return "no such contract";
    if (c.n >= c.target) return "claim it instead";
    const cost = rerollCost(s);
    if (s.dust < cost) return `needs ${cost} ember dust`;
    s.dust -= cost;
    s.contracts.list.splice(i, 1);
    ensureContracts(s);
    s.contracts.list.splice(i, 0, s.contracts.list.pop()!);
    return null;
}

/** Cleans a loaded board: unknown kinds and currencies go, numbers are clamped, then it is topped up. */
export function cleanContracts(s: GameState): void {
    const raw = s.contracts as unknown;
    const b = raw && typeof raw === "object" ? (raw as ContractBoard) : { list: [], seq: 0, done: 0 };
    const kinds: string[] = KINDS;
    const ok = (v: unknown, min = 0) => typeof v === "number" && Number.isFinite(v) && v >= min;
    b.list = (Array.isArray(b.list) ? b.list : []).filter(c => c && kinds.includes(c.kind) && ok(c.target, 1) && ok(c.n) && ok(c.dust)).slice(0, BOARD_SIZE)
        .map(c => {
            const out: Contract = { kind: c.kind, target: Math.round(c.target), n: Math.min(Math.round(c.n), Math.round(c.target)), dust: Math.round(c.dust) };
            if (c.kind === "maps") out.tier = ok(c.tier, 1) ? Math.round(c.tier!) : 1;
            if (Array.isArray(c.currency) && CURRENCIES[c.currency[0]] && ok(c.currency[1], 1)) out.currency = [c.currency[0], Math.round(c.currency[1])];
            if (c.extra === "relic" || c.extra === "companion" || c.extra === "maps" || c.extra === "sigil") out.extra = c.extra;
            return out;
        });
    b.seq = ok(b.seq) ? Math.round(b.seq) : 0;
    b.done = ok(b.done) ? Math.round(b.done) : 0;
    s.contracts = b;
    ensureContracts(s);
}
