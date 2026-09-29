// Content references inside log parameters. A log entry is saved with a key
// and params; a param that names game content is stored as a reference
// ("@zone:a1_shore"), not as a name, so it reads in whatever language the
// game is in when the log is shown (names.ts resolves them).

import { affixOf } from "../core/items";
import type { Item } from "../core/types";

export const ref = {
    zone: (id: string) => `@zone:${id}`,
    monster: (id: string) => `@monster:${id}`,
    companion: (id: string) => `@companion:${id}`,
    pinnacle: (id: string) => `@pin:${id}`,
    /** A pinnacle's sigil, by the pinnacle id. */
    sigil: (pinnacle: string) => `@sigil:${pinnacle}`,
    tier: (tier: number) => `@tier:${tier}`,
    base: (id: string) => `@base:${id}`,
    relic: (id: string) => `@relic:${id}`,
    skill: (id: string) => `@skill:${id}`,
    support: (id: string) => `@support:${id}`,
    /** Several references read as one list ("Sunpiercer, Sunflare"). */
    list: (refs: string[]) => `@list:${refs.map(r => r.slice(1)).join(",")}`,
    /** A place a run was in: a story zone, or a map (area and tier) or pinnacle. */
    place: (zone: string, map?: { area: string; tier: number; pinnacle?: string }) => (map ? `@map:${map.area}:${map.tier}:${map.pinnacle ?? ""}` : `@zone:${zone}`),
    /** A contract's goal ("Slay 1800 monsters"). */
    contract: (kind: string, target: number, tier?: number) => `@contract:${kind}:${target}:${tier ?? 1}`,
    /** Another string of the tables, by key. */
    key: (key: string) => `@key:${key}`,
    /** An item as its label shows it: base, rarity, first prefix and suffix, relic, rare name. */
    item: (it: Item) => {
        const p = it.affixes.find(a => affixOf(a).type === "prefix")?.id ?? "", s = it.affixes.find(a => affixOf(a).type === "suffix")?.id ?? "";
        return `@item:${it.base}:${it.rarity}:${p}:${s}:${it.relic ?? ""}:${it.name ?? ""}`;
    },
};
