// Modifier engine (COMBAT.md section 1).
//   final = (base + sum flat) * (1 + sum inc / 100) * prod(1 + more / 100)
// Modifiers with tags only apply when all their tags are in the query context.

import type { Mod, ModKind, StatId } from "./types";

export class StatBag {
    private by = new Map<StatId, Mod[]>();

    constructor(mods: Iterable<Mod> = []) { for (const m of mods) this.add(m); }

    add(m: Mod): void {
        let list = this.by.get(m.stat);
        if (!list) this.by.set(m.stat, list = []);
        list.push(m);
    }
    addAll(mods: Iterable<Mod>): void { for (const m of mods) this.add(m); }

    /** Every modifier for a stat (for breakdowns). */
    mods(stat: StatId): readonly Mod[] { return this.by.get(stat) ?? []; }

    private static applies(m: Mod, ctx: ReadonlySet<string> | undefined): boolean {
        if (!m.tags || m.tags.length === 0) return true;
        if (!ctx) return false;
        for (const t of m.tags) if (!ctx.has(t)) return false;
        return true;
    }

    /** Sum of flat or inc values. */
    sum(stat: StatId, kind: Exclude<ModKind, "more">, ctx?: ReadonlySet<string>): number {
        let s = 0;
        for (const m of this.by.get(stat) ?? []) if (m.kind === kind && StatBag.applies(m, ctx)) s += m.value;
        return s;
    }
    /** Product of (1 + more/100). */
    more(stat: StatId, ctx?: ReadonlySet<string>): number {
        let p = 1;
        for (const m of this.by.get(stat) ?? []) if (m.kind === "more" && StatBag.applies(m, ctx)) p *= 1 + m.value / 100;
        return p;
    }
    flat(stat: StatId, ctx?: ReadonlySet<string>): number { return this.sum(stat, "flat", ctx); }
    inc(stat: StatId, ctx?: ReadonlySet<string>): number { return this.sum(stat, "inc", ctx); }
    /** Increase multiplier (1 + inc/100), floored at zero. */
    incMult(stat: StatId, ctx?: ReadonlySet<string>): number { return Math.max(0, 1 + this.inc(stat, ctx) / 100); }
    /** Full formula. */
    calc(stat: StatId, base = 0, ctx?: ReadonlySet<string>): number {
        return (base + this.flat(stat, ctx)) * this.incMult(stat, ctx) * this.more(stat, ctx);
    }
}

export const tagSet = (...groups: (readonly string[] | undefined)[]): Set<string> => {
    const s = new Set<string>();
    for (const g of groups) if (g) for (const t of g) s.add(t);
    return s;
};
