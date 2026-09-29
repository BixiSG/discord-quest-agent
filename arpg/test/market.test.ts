// Round 5: sockets, ember stones and the Wandering Market.

import { describe, expect, it } from "vitest";
import { STONES, STONE_TIERS, parseStone, stoneKey, stoneMods, stoneText } from "../src/core/data";
import { addStone, autoSetStones, cutStones, drillCost, drillSocket, rollStone, setStone, socketCap } from "../src/core/sockets";
import { buyGear, buyStone, marketOpen, nextStockIn, refreshCost, refreshMarket, ROTATION_MS, tickMarket } from "../src/core/market";
import { newGame, salvage, sheetOf } from "../src/core/game";
import { itemStats, placeOf } from "../src/core/items";
import { Rng } from "../src/core/rng";
import { MIGRATIONS, unwrap } from "../src/core/save";
import { validateState } from "../src/core/validate";
import type { Item } from "../src/core/types";

const g0 = () => newGame({ name: "T", cls: "vanguard", now: 0, seed: 51 });
let uid = 5000;
const ring = (extra: Partial<Item> = {}): Item => ({ uid: uid++, base: "ring_iron", ilvl: 40, rarity: "rare", name: "R", affixes: [], ...extra });

describe("ember stones", () => {
    it("data: every stone has three places and five values, text without holes", () => {
        for (const s of Object.values(STONES)) for (const place of ["weapon", "armour", "jewel"] as const) {
            expect(s.effects[place].values.length).toBe(STONE_TIERS.length);
            for (let t = 1; t < STONE_TIERS.length; t++) expect(s.effects[place].values[t]).toBeGreaterThan(s.effects[place].values[t - 1]!);
            expect(stoneText(stoneKey(s.id, 4), place)).not.toMatch(/\{|undefined/);
        }
        expect(parseStone("ruby:2")).toEqual({ id: "ruby", tier: 2 });
        expect(parseStone("ruby:9")).toBeNull();
        expect(parseStone("nope:1")).toBeNull();
    });
    it("a stone's effect depends on the item it sits in", () => {
        const g = g0();
        const w = g.hero.equipment.weapon!;
        expect(placeOf(w)).toBe("weapon");
        expect(placeOf(ring())).toBe("jewel");
        expect(stoneMods("ruby:0", "weapon")[0]).toMatchObject({ stat: "damage", tags: ["fire"] });
        expect(stoneMods("ruby:0", "armour")[0]).toMatchObject({ stat: "res.fire" });
        expect(stoneMods("diamond:4", "jewel").length).toBe(3);
    });
    it("drill, set, pry: stones move between the pouch and the item, and count on the sheet", () => {
        const g = g0();
        const w = g.hero.equipment.weapon!;
        expect(drillSocket(g, w.uid)).toMatch(/dust/);
        g.dust = 1e6;
        expect(drillSocket(g, w.uid)).toBeNull();
        expect(w.sockets).toBe(1);
        expect(w.stones).toEqual([null]);
        expect(setStone(g, w.uid, 0, "ruby:1")).toMatch(/pouch/);
        addStone(g, "ruby:1", 2);
        const hit0 = sheetOf(g).bag.mods("damage").length;
        expect(setStone(g, w.uid, 0, "ruby:1")).toBeNull();
        expect(g.stones["ruby:1"]).toBe(1);
        expect(sheetOf(g).bag.mods("damage").length).toBe(hit0 + 1);
        expect(itemStats(w).global.some(m => m.tags?.includes("fire"))).toBe(true);
        expect(setStone(g, w.uid, 0, null)).toBeNull();
        expect(g.stones["ruby:1"]).toBe(2);
        while (drillCost(w) !== null) expect(drillSocket(g, w.uid)).toBeNull();
        expect(w.sockets).toBe(socketCap(w));
        expect(drillSocket(g, w.uid)).toMatch(/no room/);
    });
    it("salvaging a socketed item returns its stones", () => {
        const g = g0();
        const it = ring({ sockets: 1, stones: ["topaz:3"] });
        g.stash.push(it);
        salvage(g, [it.uid]);
        expect(g.stones["topaz:3"]).toBe(1);
    });
    it("three cut into one of the next tier, for dust; not past Radiant", () => {
        const g = g0();
        g.dust = 1e6;
        addStone(g, "emerald:0", 7);
        expect(cutStones(g, "emerald:0")).toBeNull();
        expect(cutStones(g, "emerald:0")).toBeNull();
        expect(cutStones(g, "emerald:0")).toMatch(/three/);
        expect(g.stones).toEqual({ "emerald:0": 1, "emerald:1": 2 });
        addStone(g, "onyx:4", 3);
        expect(cutStones(g, "onyx:4")).toMatch(/Radiant/);
    });
    it("drops follow the monster's level; auto-set fills empty sockets with the best stone", () => {
        const rng = new Rng(3);
        for (let i = 0; i < 50; i++) expect(parseStone(rollStone(rng, 1))!.tier).toBe(0);
        const tiers = new Set<number>();
        for (let i = 0; i < 200; i++) tiers.add(parseStone(rollStone(rng, 80))!.tier);
        expect([...tiers].sort()).toEqual([2, 3]); // Radiant only by cutting
        const g = g0();
        g.hero.equipment.weapon!.sockets = 1; g.hero.equipment.weapon!.stones = [null];
        addStone(g, "ruby:2", 1); addStone(g, "emerald:2", 1);
        expect(autoSetStones(g)).toBe(1);
        expect(g.hero.equipment.weapon!.stones![0]).not.toBeNull();
        expect(Object.values(g.stones).reduce((a, b) => a + b, 0)).toBe(1);
        // A better one of the same kind replaces it.
        const k = g.hero.equipment.weapon!.stones![0]!;
        addStone(g, stoneKey(parseStone(k)!.id, 4), 1);
        expect(autoSetStones(g)).toBe(1);
        expect(g.hero.equipment.weapon!.stones![0]).toBe(stoneKey(parseStone(k)!.id, 4));
    });
});

describe("the Wandering Market", () => {
    const open = () => { const g = g0(); g.world.clears.a1_lock = 1; g.hero.level = 20; g.simTo = 1e6; return g; };
    it("camps after Act 1; stock rolls deterministically and rotates every two hours", () => {
        const a = g0();
        tickMarket(a);
        expect(marketOpen(a)).toBe(false);
        expect(a.market.pedlar).toEqual([]);
        const g = open(), h = open();
        tickMarket(g); tickMarket(h);
        expect(g.market.pedlar.length).toBe(6);
        expect(g.market.jeweller.length).toBe(5);
        expect(JSON.stringify(g.market)).toBe(JSON.stringify(h.market));
        expect(g.market.pedlar.some(o => (o.item.sockets ?? 0) > 0)).toBe(true);
        const first = JSON.stringify(g.market.pedlar);
        g.simTo += ROTATION_MS - 1;
        tickMarket(g);
        expect(JSON.stringify(g.market.pedlar)).toBe(first);
        expect(nextStockIn(g)).toBe(1);
        g.simTo += 1;
        tickMarket(g);
        expect(JSON.stringify(g.market.pedlar)).not.toBe(first);
    });
    it("buying: dust, sold out after, gear to the stash or worn; stones to the pouch", () => {
        const g = open();
        tickMarket(g);
        g.settings.autoEquip = false;
        const o = g.market.pedlar.find(x => !x.item.relic)!;
        const i = g.market.pedlar.indexOf(o);
        expect(buyGear(g, i)).toMatch(/dust/);
        g.dust = o.price;
        expect(buyGear(g, i)).toBeNull();
        expect(g.dust).toBe(0);
        expect(g.stash.some(x => x.uid === o.item.uid)).toBe(true);
        expect(buyGear(g, i)).toMatch(/sold/);
        const s = g.market.jeweller[0]!;
        g.dust = s.price;
        expect(buyStone(g, 0)).toBeNull();
        expect(g.stones[s.key]).toBe(1);
    });
    it("a paid refresh costs more each time in a rotation", () => {
        const g = open();
        tickMarket(g);
        const c1 = refreshCost(g);
        g.dust = 1e7;
        expect(refreshMarket(g)).toBeNull();
        expect(refreshCost(g)).toBe(c1 * 2);
    });
    it("v6 saves get an empty pouch and market; the validator cleans them", () => {
        const g = g0() as any;
        delete g.stones; delete g.market; delete g.settings.autoStones;
        g.stash.push({ uid: 9, base: "ring_iron", ilvl: 10, rarity: "rare", name: "X", affixes: [], sockets: 5, stones: ["ruby:1", "bad:1", "x"] });
        const env = unwrap<any>({ game: "hollowmarch", v: 6, savedAt: 1, state: g }, MIGRATIONS, 7);
        const s = validateState(env.state);
        expect(s.stones).toEqual({});
        expect(s.settings.autoStones).toBe(true);
        expect(s.market.pedlar).toEqual([]);
        expect(s.stash[0]!.sockets).toBe(1);
        expect(s.stash[0]!.stones).toEqual(["ruby:1"]);
    });
});
