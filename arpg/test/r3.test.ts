// Round 3: stash upkeep, locks, bulk tools, stash room, the relic codex.

import { describe, expect, it } from "vitest";
import { RELICS, xpToNext } from "../src/core/data";
import { buyStashRoom, codexRarity, equip, equipUpgrades, newGame, outdatedItems, receiveItem, relicRollScore, salvage, setLocked, stashRoomCost, STASH_MAX, unequip } from "../src/core/game";
import { gainXp } from "../src/core/sim/engine";
import { levelReq } from "../src/core/items";
import { MIGRATIONS, unwrap } from "../src/core/save";
import { validateState } from "../src/core/validate";
import type { Item } from "../src/core/types";

let uid = 1000;
const ring = (ilvl: number, rarity: Item["rarity"] = "rare", extra: Partial<Item> = {}): Item =>
    ({ uid: uid++, base: "ring_iron", ilvl, rarity, affixes: [], ...(rarity === "rare" ? { name: "R" } : {}), ...extra });
/** A hero wearing two strong rings, so plain stash rings are not upgrades (upkeep never gives those up). */
const g0 = () => {
    const g = newGame({ name: "T", cls: "vanguard", now: 0, seed: 3 });
    g.hero.equipment.ring1 = ring(1, "rare", { affixes: [{ id: "life", tier: 0, rolls: [500] }] });
    g.hero.equipment.ring2 = ring(1, "rare", { affixes: [{ id: "life", tier: 0, rolls: [500] }] });
    g.hero.rev++;
    return g;
};

describe("stash upkeep", () => {
    it("a keeper meeting a full stash replaces the least-worth item", () => {
        const g = g0();
        g.settings.autoEquip = false;
        g.stashCap = 3;
        const old = ring(2), mid = ring(20), top = ring(40);
        g.stash.push(mid, old, top);
        const drop = ring(30);
        const dust = g.dust;
        expect(receiveItem(g, drop).kept).toBe(true);
        expect(g.stash).toContain(drop);
        expect(g.stash).not.toContain(old);
        expect(g.dust).toBeGreaterThan(dust);
        expect(g.totals.swapped).toBe(1);
        expect(g.stashFull).toBeFalsy();
    });
    it("never gives up locked items, and not for a worse drop", () => {
        const g = g0();
        g.settings.autoEquip = false;
        g.stashCap = 2;
        const a = ring(2, "rare", { locked: true }), b = ring(3, "rare", { locked: true });
        g.stash.push(a, b);
        expect(receiveItem(g, ring(50)).kept).toBe(false);
        expect(g.stash).toEqual([a, b]);
        expect(g.stashFull).toBe(true);
        const g2 = g0();
        g2.settings.autoEquip = false;
        g2.stashCap = 1;
        const good = ring(40);
        g2.stash.push(good);
        expect(receiveItem(g2, ring(10)).kept).toBe(false);
        expect(g2.stash).toEqual([good]);
    });
    it("gear far above the hero's level is worth less: a wearable keeper replaces it", () => {
        const g = g0();
        g.settings.autoEquip = false;
        g.hero.level = 40;
        g.stashCap = 1;
        const far = { uid: uid++, base: "plate_body8", ilvl: 80, rarity: "rare", name: "F", affixes: [] } as Item; // needs 74
        g.stash.push(far);
        const now = { uid: uid++, base: "plate_body5", ilvl: 42, rarity: "rare", name: "N", affixes: [{ id: "life", tier: 0, rolls: [20] }] } as Item;
        expect(receiveItem(g, now).kept).toBe(true);
        expect(g.stash).toEqual([now]);
        // Near the hero's level it would have stayed.
        const g2 = g0();
        g2.settings.autoEquip = false;
        g2.hero.level = 72;
        g2.stashCap = 1;
        const soon = { ...far, uid: uid++ };
        g2.stash.push(soon);
        expect(receiveItem(g2, { ...now, uid: uid++ }).kept).toBe(false);
        expect(g2.stash).toEqual([soon]);
    });
    it("switched off, a full stash salvages the drop as before", () => {
        const g = g0();
        g.settings.autoEquip = false;
        g.settings.upkeep = false;
        g.stashCap = 1;
        const old = ring(1);
        g.stash.push(old);
        expect(receiveItem(g, ring(50)).kept).toBe(false);
        expect(g.stash).toEqual([old]);
    });
});

describe("locks and bulk tools", () => {
    it("salvage skips locked items; setLocked finds worn gear too", () => {
        const g = g0();
        const a = ring(5), b = ring(6);
        g.stash.push(a, b);
        expect(setLocked(g, a.uid, true)).toBeNull();
        expect(salvage(g, [a.uid, b.uid])).toBe(1);
        expect(g.stash).toEqual([a]);
        const w = g.hero.equipment.weapon!;
        expect(setLocked(g, w.uid, true)).toBeNull();
        expect(w.locked).toBe(true);
        expect(setLocked(g, w.uid, false)).toBeNull();
        expect(w.locked).toBeUndefined();
        expect(setLocked(g, 999999, true)).toMatch(/not found/);
    });
    it("outdated: bases 10+ levels behind, not locked, relics or upgrades", () => {
        const g = g0();
        g.hero.level = 40;
        const old = { uid: uid++, base: "plate_body1", ilvl: 3, rarity: "rare", name: "O", affixes: [] } as Item;
        const oldLocked = { ...old, uid: uid++, locked: true };
        const fresh = { uid: uid++, base: "plate_body6", ilvl: 50, rarity: "rare", name: "F", affixes: [] } as Item;
        g.stash.push(old, oldLocked, fresh);
        g.hero.equipment.body = { uid: uid++, base: "plate_body4", ilvl: 30, rarity: "rare", name: "W", affixes: [] };
        g.hero.rev++;
        expect(outdatedItems(g).map(x => x.uid)).toEqual([old.uid]);
        // An old item that would still beat what is worn is not outdated.
        g.hero.equipment.body = undefined as never;
        delete g.hero.equipment.body;
        g.hero.rev++;
        old.affixes = [{ id: "life", tier: 0, rolls: [900] }];
        expect(outdatedItems(g).map(x => x.uid)).toEqual([]);
    });
    it("a level-up wears stash items that just became wearable", () => {
        const g = g0();
        const body = { uid: uid++, base: "plate_body2", ilvl: 10, rarity: "rare", name: "B", affixes: [{ id: "life", tier: 0, rolls: [400] }] } as Item;
        g.stash.push(body);
        expect(levelReq(body)).toBeGreaterThan(g.hero.level);
        while (g.hero.level < levelReq(body)) gainXp(g, xpToNext(g.hero.level));
        expect(g.hero.equipment.body?.uid).toBe(body.uid);
        expect(g.stash).not.toContain(body);
    });
    it("equipUpgrades wears every stash upgrade, one per slot", () => {
        const g = g0();
        g.settings.autoEquip = false;
        g.hero.level = 20;
        delete g.hero.equipment.ring1; delete g.hero.equipment.ring2; g.hero.rev++;
        g.stash.push(ring(10, "rare", { affixes: [{ id: "life", tier: 0, rolls: [30] }] }), ring(10, "rare", { affixes: [{ id: "life", tier: 0, rolls: [25] }] }));
        expect(equipUpgrades(g)).toBe(2);
        expect(g.hero.equipment.ring1).toBeDefined();
        expect(g.hero.equipment.ring2).toBeDefined();
        expect(equipUpgrades(g)).toBe(0);
    });
});

describe("stash room", () => {
    it("ten slots per purchase, rising prices, capped", () => {
        const g = g0();
        const costs: number[] = [];
        g.dust = 1e9;
        while (stashRoomCost(g) !== null) { costs.push(stashRoomCost(g)!); expect(buyStashRoom(g)).toBeNull(); }
        expect(g.stashCap).toBe(STASH_MAX);
        expect(costs.length).toBe(9);
        for (let i = 1; i < costs.length; i++) expect(costs[i]).toBeGreaterThan(costs[i - 1]!);
        expect(costs[0]).toBeLessThanOrEqual(300);
        expect(buyStashRoom(g)).toMatch(/big/);
        const poor = g0();
        expect(buyStashRoom(poor)).toMatch(/dust/);
        expect(poor.stashCap).toBe(60);
    });
});

const relic = (id: string, f = 0) => ({ uid: uid++, base: RELICS[id]!.base, ilvl: 80, rarity: "relic", affixes: [], relic: id,
    relicRolls: RELICS[id]!.mods.map(m => Math.round(m.range[0] + f * (m.range[1] - m.range[0]))) }) as Item;

describe("relic case", () => {
    it("keeps the better-rolled copy of each relic outside the stash", () => {
        const g = g0();
        g.settings.autoEquip = false;
        const low = relic("emberknot", 0), high = relic("emberknot", 1), mid = relic("emberknot", 0.5);
        expect(receiveItem(g, low).kept).toBe(true);
        expect(g.relics).toEqual([low]);
        expect(g.stash).toEqual([]);
        const dust = g.dust;
        expect(receiveItem(g, high).kept).toBe(true);
        expect(g.relics).toEqual([high]);
        expect(g.dust).toBeGreaterThan(dust); // the worse copy was salvaged
        expect(receiveItem(g, mid).kept).toBe(false);
        expect(g.relics).toEqual([high]);
        expect(relicRollScore(high)).toBe(1);
        expect(relicRollScore(low)).toBe(0);
    });
    it("a locked copy that loses its place goes to the stash", () => {
        const g = g0();
        g.settings.autoEquip = false;
        const low = relic("lampwick", 0);
        receiveItem(g, low);
        low.locked = true;
        receiveItem(g, relic("lampwick", 1));
        expect(g.stash).toEqual([low]);
    });
    it("equips from the case; taking a relic off puts it back", () => {
        const g = g0();
        g.settings.autoEquip = false;
        g.hero.level = 30;
        const r = relic("gullfeather", 1);
        receiveItem(g, r);
        expect(equip(g, r.uid)).toBeNull();
        expect(g.hero.equipment.boots?.uid).toBe(r.uid);
        expect(g.relics).toEqual([]);
        expect(unequip(g, "boots")).toBeNull();
        expect(g.relics).toEqual([r]);
        expect(g.stash).toEqual([]);
    });
    it("v4 saves move stash relics into the case, one per relic", () => {
        const g = g0() as any;
        delete g.relics;
        const a = relic("emberknot", 0), b = relic("emberknot", 1), c = relic("lampwick", 0.5);
        g.stash.push(a, ring(10), b, c);
        const env = unwrap<any>({ game: "hollowmarch", v: 4, savedAt: 1, state: g }, MIGRATIONS, 5);
        const s = validateState(env.state);
        expect(s.relics.map(x => x.uid).sort()).toEqual([b.uid, c.uid].sort());
        expect(s.stash.map(x => x.uid)).toContain(a.uid);
        expect(s.stash.some(x => x.rarity === "relic" && x.uid !== a.uid)).toBe(false);
    });
});

describe("relic codex", () => {
    it("counts relic drops and gives +1% rarity per relic found", () => {
        const g = g0();
        g.settings.autoEquip = false;
        receiveItem(g, relic("lampwick"));
        receiveItem(g, relic("lampwick"));
        receiveItem(g, relic("gullfeather"));
        expect(g.codex).toEqual({ lampwick: 2, gullfeather: 1 });
        expect(codexRarity(g)).toBe(2);
    });
    it("v4 saves get upkeep on and a codex seeded from owned relics", () => {
        const g = g0() as any;
        delete g.codex; delete g.settings.upkeep;
        g.stash.push({ uid: 5, base: "ring_ember", ilvl: 30, rarity: "relic", relic: "emberknot", relicRolls: [20, 20, -10], affixes: [] });
        const env = unwrap<any>({ game: "hollowmarch", v: 4, savedAt: 1, state: g }, MIGRATIONS, 5);
        expect(env.state.settings.upkeep).toBe(true);
        expect(env.state.codex).toEqual({ emberknot: 1 });
        const s = validateState(env.state);
        expect(s.codex).toEqual({ emberknot: 1 });
    });
    it("the validator cleans lock, quality and bench marks", () => {
        const g = g0() as any;
        g.codex = { nope: 3, lampwick: 1.4, gullfeather: -1 };
        g.stash.push({ uid: 7, base: "ring_iron", ilvl: 10, rarity: "rare", name: "X", locked: "yes", quality: 55,
            affixes: [{ id: "life", tier: 0, rolls: [30], bench: true }, { id: "res_fire", tier: 0, rolls: [10], bench: true }] });
        const s = validateState(g);
        const it = s.stash[0]!;
        expect(it.locked).toBeUndefined();
        expect(it.quality).toBe(20);
        expect(it.affixes.filter(a => a.bench).length).toBe(1);
        expect(s.codex).toEqual({ lampwick: 1 });
    });
});

import { FILTER_PRESETS, groupLabel, keepItem } from "../src/core/filter";
describe("loot filter presets and affix rules", () => {
    it("Resist hunter keeps rare jewellery with a resistance and salvages other rares under 5 affixes", () => {
        const g = g0();
        g.settings.filter = structuredClone(FILTER_PRESETS.find(p => p.id === "resists")!.rules);
        const withRes = { uid: uid++, base: "ring_iron", ilvl: 30, rarity: "rare", name: "R", affixes: [{ id: "res_fire", tier: 0, rolls: [10] }] } as Item;
        const without = { ...withRes, uid: uid++, affixes: [{ id: "life", tier: 0, rolls: [10] }] } as Item;
        expect(keepItem(g, withRes)).toBe(true);
        expect(keepItem(g, without)).toBe(false);
        expect(groupLabel("resFire")).toBe("fire resistance");
        expect(groupLabel("aspd")).toMatch(/weapon/);
    });
});
