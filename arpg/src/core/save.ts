// Versioned save envelope (ARCHITECTURE.md rule 5).
// MIGRATIONS[v] turns a version-v state into version v+1. Never edit an old
// migration once shipped; add a new one and bump SAVE_VERSION.

export const SAVE_VERSION = 2;

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
