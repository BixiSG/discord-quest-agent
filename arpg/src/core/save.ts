// Versioned save envelope (ARCHITECTURE.md rule 5).
// MIGRATIONS[v] turns a version-v state into version v+1. Never edit an old
// migration once shipped; add a new one and bump SAVE_VERSION.

export const SAVE_VERSION = 7;

export interface SaveEnvelope<S = unknown> {
    game: "hollowmarch";
    v: number;
    savedAt: number;
    state: S;
}

type Migration = (state: any) => any;
export const MIGRATIONS: Record<number, Migration> = {
    // v2 (P2): passive bonus points, loot filter rules, crafting counter.
    1: (s: any) => {
        s.hero.bonusPoints ??= 0;
        s.settings.filter ??= [
            { on: true, action: "keep", rarity: ["relic"] },
            { on: true, action: "salvage", rarity: ["plain", "enchanted"], behind: 10 },
            { on: false, action: "keep", rarity: ["rare"], minAffixes: 5 },
        ];
        s.craftSeq ??= 0;
        s.currency ??= {};
        return s;
    },
    // v3 (P3): ascendancy nodes and points.
    2: (s: any) => {
        s.hero.ascNodes ??= [];
        s.hero.ascPoints ??= 0;
        return s;
    },
    // v4 (P4): maps, atlas, sigils, pinnacles.
    3: (s: any) => {
        s.activity.mode ??= "zone";
        s.activity.mapTier ??= 0;
        s.maps ??= [];
        s.mapCap ??= 40;
        s.atlas ??= { points: 0, nodes: [], tiers: [] };
        s.sigils ??= {};
        s.pinnacleKills ??= {};
        // Rewards ledger: mark what P3 already granted (2 points per act or trial),
        // so reconcileRewards() only adds what is missing.
        const acts = [["a1_lock", "act:1"], ["a2_throne", "act:2"], ["a3_sunfall", "act:3"]];
        const trials = ["a1_trial", "a2_trial", "a3_trial"];
        const clears = s.world.clears ?? {};
        const actsDone = acts.filter(([z]) => clears[z!] > 0).map(([, k]) => k);
        const trialsDone = trials.filter(z => clears[z] > 0).map(z => "trial:" + z);
        s.world.rewards ??= [...actsDone.slice(0, Math.floor((s.hero.bonusPoints ?? 0) / 2)), ...trialsDone.slice(0, Math.floor((s.hero.ascPoints ?? 0) / 2))];
        return s;
    },
    // v5 (round 3): stash upkeep, item locks, the relic codex (seeded with the relics owned) and
    // the relic case: stash relics move there; validateState keeps the best copy of each and
    // puts the rest back in the stash.
    4: (s: any) => {
        s.settings.upkeep ??= true;
        s.stashFull = false; // upkeep decides what "full" means now
        s.codex ??= {};
        const owned = [...(s.stash ?? []), ...Object.values(s.hero?.equipment ?? {})] as any[];
        for (const it of owned) if (it?.relic && !s.codex[it.relic]) s.codex[it.relic] = 1;
        s.relics ??= [];
        if (Array.isArray(s.stash)) {
            s.relics.push(...s.stash.filter((it: any) => it?.rarity === "relic"));
            s.stash = s.stash.filter((it: any) => it?.rarity !== "relic");
        }
        return s;
    },
    // v6 (round 4): companions (act companions are granted by reconcileRewards on load), the shrine.
    5: (s: any) => {
        s.companions ??= {};
        s.blessings ??= {};
        s.shrine ??= { keep: [], orbs: true };
        return s;
    },
    // v7 (round 5): the stone pouch, auto-set, the Wandering Market (rolled on first use), echoes
    // (pinnacles already beaten give theirs through reconcileRewards on load).
    6: (s: any) => {
        s.stones ??= {};
        s.settings.autoStones ??= true;
        s.market ??= { seq: 0, rolledAt: 0, refreshes: 0, pedlar: [], jeweller: [] };
        s.echoes ??= [];
        return s;
    },
};

export class SaveError extends Error {}

export function wrap<S>(state: S, savedAt: number): SaveEnvelope<S> {
    return { game: "hollowmarch", v: SAVE_VERSION, savedAt, state };
}

/** Parses and migrates an envelope. Throws SaveError on anything unusable. */
export function unwrap<S>(raw: unknown, migrations: Record<number, Migration> = MIGRATIONS, target = SAVE_VERSION): SaveEnvelope<S> {
    if (!raw || typeof raw !== "object") throw new SaveError("not a save");
    const env = raw as Partial<SaveEnvelope>;
    if (env.game !== "hollowmarch") throw new SaveError("not a Hollowmarch save");
    if (typeof env.v !== "number" || !Number.isInteger(env.v) || env.v < 1) throw new SaveError("bad save version");
    if (env.v > target) throw new SaveError(`save is from a newer version (${env.v})`);
    let state: any = env.state;
    for (let v = env.v; v < target; v++) {
        const m = migrations[v];
        if (!m) throw new SaveError(`no migration from version ${v}`);
        state = m(state);
    }
    return { game: "hollowmarch", v: target, savedAt: typeof env.savedAt === "number" ? env.savedAt : 0, state };
}

/** Portable text form: base64 of the JSON, ASCII only. */
export function exportText(env: SaveEnvelope): string {
    const json = JSON.stringify(env);
    const bytes = new TextEncoder().encode(json);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
    return "HM1:" + btoa(bin);
}

export function importText(text: string): unknown {
    const t = text.trim();
    if (!t.startsWith("HM1:")) throw new SaveError("not a Hollowmarch export");
    let bin: string;
    try { bin = atob(t.slice(4)); } catch { throw new SaveError("export is damaged"); }
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new SaveError("export is damaged"); }
}
