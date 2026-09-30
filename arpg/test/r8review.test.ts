// Round 8, review A: regressions for the bugs a code audit found (each was reproduced first).
import { describe, expect, it } from "vitest";
import { BASES, MAP_MODS, RELICS } from "../src/core/data";
import { deriveSheet } from "../src/core/character";
import { canEquip, equip, newGame, paidFits, receiveItem, relicRollScore, upgradeSlot } from "../src/core/game";
import { forgeCost, forgeRare, forgeUntilUpgrade } from "../src/core/crafting";
import { relightSun } from "../src/core/dawn";
import { buyGear, tickMarket } from "../src/core/market";
import { baseOf } from "../src/core/items";
import { gainXp, step } from "../src/core/sim/engine";
import { SLOTS, type Item } from "../src/core/types";

const g0 = (seed = 3, cls = "vanguard") => newGame({ name: "T", cls, now: 0, seed });

describe("review A", () => {
    it("the parched map mod really cuts life regeneration (it is a more modifier)", () => {
        const s = g0(1); s.hero.level = 40;
        const regen = [{ stat: "lifeRegen" as const, kind: "flat" as const, value: 50 }, { stat: "lifeRegenPct" as const, kind: "flat" as const, value: 2 }];
        const base = deriveSheet(s.hero, regen), parched = deriveSheet(s.hero, [...regen, ...MAP_MODS.parched!.hero!]);
        expect(parched.lifeRegen).toBeCloseTo(base.lifeRegen * 0.4);
    });
    it("forge until upgrade with auto-equip off keeps the first upgrade, once, and stops", () => {
        const s = g0(7); s.hero.level = 20; s.settings.autoEquip = false; s.dust = 1e5;
        const r = forgeUntilUpgrade(s, "helmet", 10);
        expect(r.err).toBeNull();
        expect(r.item).toBeDefined();
        expect(r.equipped).toBe(false);
        expect(s.stash.map(x => x.uid)).toEqual([r.item!.uid]);
        expect(s.totals.salvaged).toBe(r.made - 1);
        expect(upgradeSlot(s, r.item!)).not.toBeNull();
    });
    it("a forged upgrade that can't go on (locked gear, no room) is kept or refused, never handled twice", () => {
        let kept = 0;
        for (let seed = 1; seed < 400; seed++) {
            const s = g0(seed); s.hero.level = 2; s.dust = 1e6;
            const w = s.hero.equipment.weapon!; w.locked = true;
            const sh = Object.values(BASES).find(b => b.kind === "shield" && b.level <= 2)!;
            s.hero.equipment.offhand = { uid: 90, base: sh.id, ilvl: 1, rarity: "plain", affixes: [], locked: true };
            s.hero.rev++;
            s.stashCap = 3;
            s.stash.push({ uid: 91, base: w.base, ilvl: 1, rarity: "plain", affixes: [], locked: true }, { uid: 92, base: w.base, ilvl: 1, rarity: "plain", affixes: [], locked: true });
            s.settings.filter = [{ on: true, action: "salvage", rarity: ["rare"] }];
            const dust0 = s.dust, salvaged0 = s.totals.salvaged;
            const r = forgeRare(s, "weapon");
            if (r.err) { expect(s.dust).toBe(dust0); continue; }
            const copies = s.stash.filter(x => x.uid === r.item!.uid).length + (s.hero.equipment.weapon?.uid === r.item!.uid ? 1 : 0);
            expect(copies, `seed ${seed}`).toBe(1);
            expect(s.totals.salvaged).toBe(salvaged0);
            expect(s.dust).toBe(dust0 - forgeCost(s));
            kept++;
        }
        expect(kept).toBeGreaterThan(0);
    });
    it("relighting keeps the better copy of each relic and returns the stones of the one left behind", () => {
        const s = g0(3); s.hero.level = 40;
        const def = RELICS.gullfeather!;
        const mk = (uid: number, best: boolean): Item => ({ uid, base: def.base, ilvl: 40, rarity: "relic", affixes: [], relic: def.id, relicRolls: def.mods.map(m => (best ? m.range[1] : m.range[0])) });
        const best = mk(900, true); best.sockets = 2; best.stones = ["ruby:3", "diamond:3"];
        s.relics.push(best);
        expect(equip(s, 900, "boots")).toBeNull();
        s.settings.autoEquip = false;
        const worst = mk(901, false); worst.sockets = 1; worst.stones = ["topaz:1"];
        receiveItem(s, worst);
        s.pinnacleKills = { drownedsun: 1, glasschoir: 1, ashenking: 1 };
        expect(relightSun(s)).toBeNull();
        expect(s.relics.map(x => x.uid)).toEqual([900]);
        expect(relicRollScore(s.relics[0]!)).toBe(1);
        expect(s.relics[0]!.stones).toEqual(["ruby:3", "diamond:3"]);
        expect(s.stones["topaz:1"]).toBe(1);
    });
    it("relighting with the old starter as the heirloom gives the new starter its own id", () => {
        const s = g0(3);
        const starter = s.hero.equipment.weapon!;
        s.pinnacleKills = { drownedsun: 1, glasschoir: 1, ashenking: 1 };
        relightSun(s, { heirloom: starter.uid });
        const all = [...SLOTS.map(k => s.hero.equipment[k]).filter(Boolean), ...s.stash, ...s.relics].map(x => x!.uid);
        expect(new Set(all).size).toBe(all.length);
        expect(s.nextUid).toBeGreaterThan(Math.max(...all));
    });
    it("with stash upkeep off, auto-equip never gives a stash item up for room", () => {
        const s = g0(3); s.hero.level = 20; s.settings.upkeep = false;
        const helm = Object.values(BASES).filter(b => b.slot === "helmet" && b.level <= 20);
        s.hero.equipment.helmet = { uid: 50, base: helm[0]!.id, ilvl: 1, rarity: "plain", affixes: [], locked: true };
        s.hero.rev++;
        s.stashCap = 2;
        s.stash.push({ uid: 51, base: helm[0]!.id, ilvl: 1, rarity: "plain", affixes: [] }, { uid: 52, base: helm[0]!.id, ilvl: 2, rarity: "plain", affixes: [] });
        receiveItem(s, { uid: 53, base: helm[helm.length - 1]!.id, ilvl: 20, rarity: "rare", name: "Grim Bite", affixes: [{ id: "life", tier: 0, rolls: [40] }] });
        expect(s.stash.map(x => x.uid)).toEqual([51, 52]);
        expect(s.hero.equipment.helmet!.uid).toBe(50);
        expect(s.totals.swapped ?? 0).toBe(0);
    });
    it("the Pedlar and the Forge only offer off-hands the weapon allows", () => {
        const s = g0(11); s.hero.level = 30; s.world.clears.a1_lock = 1;
        s.world.unlocked.push("a2_throne");
        const gs = Object.values(BASES).filter(b => b.kind === "greatsword" && b.level <= 30).pop()!;
        s.hero.equipment.weapon = { uid: 500, base: gs.id, ilvl: 30, rarity: "plain", affixes: [] };
        s.hero.rev++;
        for (let rot = 0; rot < 10; rot++) {
            s.market.pedlar = []; tickMarket(s);
            for (const o of s.market.pedlar) expect(baseOf(o.item).slot).not.toBe("offhand");
        }
        s.dust = 1e6;
        expect(forgeRare(s, "offhand").err).toMatch(/nothing to forge/);
        // A bow: only quivers.
        const bow = Object.values(BASES).filter(b => b.kind === "bow" && b.level <= 30).pop()!;
        s.hero.equipment.weapon = { uid: 501, base: bow.id, ilvl: 30, rarity: "plain", affixes: [] };
        s.hero.rev++;
        for (let i = 0; i < 5; i++) { const r = forgeRare(s, "offhand"); expect(r.err).toBeNull(); expect(baseOf(r.item!).kind).toBe("quiver"); expect(canEquip(s, r.item!, "offhand")).toBeNull(); }
    });
    it("a bought relic the case already holds better goes to the stash, not to salvage; no room refuses before paying", () => {
        const s = g0(5); s.hero.level = 30; s.world.clears.a1_lock = 1; s.settings.autoEquip = false;
        const def = RELICS.gullfeather!;
        const mk = (uid: number, best: boolean): Item => ({ uid, base: def.base, ilvl: 30, rarity: "relic", affixes: [], relic: def.id, relicRolls: def.mods.map(m => (best ? m.range[1] : m.range[0])) });
        s.relics.push(mk(700, true));
        tickMarket(s);
        s.market.pedlar[0] = { item: mk(701, false), price: 100 };
        s.dust = 1000;
        const salvaged = s.totals.salvaged;
        expect(buyGear(s, 0)).toBeNull();
        expect(s.stash.map(x => x.uid)).toContain(701);
        expect(s.totals.salvaged).toBe(salvaged);
        expect(s.dust).toBe(900);
        s.market.pedlar[1] = { item: mk(702, false), price: 100 };
        s.stashCap = s.stash.length;
        expect(buyGear(s, 1)).toMatch(/stash full/);
        expect(s.dust).toBe(900);
    });
    it("forge until upgrade (auto-equip on) stops before paying for an upgrade it can neither wear nor keep", () => {
        let stopped = 0;
        for (let seed = 1; seed < 60 && stopped < 3; seed++) {
            const s = g0(seed); s.hero.level = 20; s.dust = 1e6; s.settings.upkeep = false;
            // Locked gear on, a full stash: an upgrade can't go on (the old helmet has nowhere to go) nor be kept.
            const helm = Object.values(BASES).filter(b => b.slot === "helmet" && b.level <= 20);
            s.hero.equipment.helmet = { uid: 50, base: helm[0]!.id, ilvl: 1, rarity: "plain", affixes: [], locked: true };
            s.hero.rev++;
            s.stashCap = 1;
            s.stash.push({ uid: 51, base: helm[0]!.id, ilvl: 1, rarity: "plain", affixes: [] });
            const dust0 = s.dust, got0 = s.totals.dust, salvaged0 = s.totals.salvaged;
            const r = forgeUntilUpgrade(s, "helmet", 10);
            if (!r.err) continue; // ten misses: nothing to test on this seed
            stopped++;
            expect(r.err).toMatch(/stash full/);
            // Paid for the misses only (salvaging them gives some dust back).
            expect(s.dust).toBe(dust0 - r.made * forgeCost(s) + (s.totals.dust - got0));
            expect(s.totals.salvaged).toBe(salvaged0 + r.made);
            expect(s.hero.equipment.helmet!.uid).toBe(50);
            expect(s.stash.map(x => x.uid)).toEqual([51]);
            // The next forge rolls the same upgrade again: it was not paid for.
            s.stashCap = 2;
            const again = forgeUntilUpgrade(s, "helmet", 1);
            expect(again.err).toBeNull();
            expect(again.made).toBe(1);
            expect(again.item).toBeDefined();
        }
        expect(stopped).toBeGreaterThan(0);
    });
    it("the Pedlar's Buy is a dry run of buyGear: a wearable upgrade fits a full stash only when it can really go on", () => {
        const s = g0(3); s.hero.level = 20;
        const helm = Object.values(BASES).filter(b => b.slot === "helmet" && b.level <= 20);
        s.hero.equipment.helmet = { uid: 50, base: helm[0]!.id, ilvl: 1, rarity: "plain", affixes: [], locked: true };
        s.hero.rev++;
        s.stashCap = 1;
        s.stash.push({ uid: 51, base: helm[0]!.id, ilvl: 1, rarity: "plain", affixes: [], locked: true });
        const up: Item = { uid: 53, base: helm[helm.length - 1]!.id, ilvl: 20, rarity: "rare", name: "Grim Bite", affixes: [{ id: "life", tier: 0, rolls: [40] }] };
        expect(upgradeSlot(s, up)).not.toBeNull();
        // The locked helmet coming off has nowhere to go, and upkeep can't touch a locked stash item.
        expect(paidFits(s, up)).toBe(false);
        s.world.clears.a1_lock = 1; tickMarket(s);
        s.market.pedlar[0] = { item: up, price: 10 }; s.dust = 100;
        expect(buyGear(s, 0)).toMatch(/stash full/);
        expect(s.dust).toBe(100);
        // Unlocked stash item: upkeep gives it up, the upgrade goes on.
        s.stash[0]!.locked = false;
        expect(paidFits(s, up)).toBe(true);
        expect(buyGear(s, 0)).toBeNull();
        expect(s.hero.equipment.helmet!.uid).toBe(53);
        // Auto-equip off: only room in the stash counts.
        const t = g0(3); t.settings.autoEquip = false; t.stashCap = 0;
        expect(paidFits(t, up)).toBe(false);
    });
    it("losing a pinnacle doesn't break the run of clean maps", async () => {
        const { queuePinnacle } = await import("../src/core/maps");
        const { PINNACLES } = await import("../src/core/data");
        const g = g0(4); g.world.clears.a4_lamphouse = 1; g.hero.level = 70; g.hero.rev++;
        g.activity.mode = "map"; g.activity.run = null; g.activity.autoPush = true; g.activity.streak = 5;
        const p = PINNACLES.drownedsun!;
        g.sigils[p.sigil] = p.cost;
        expect(queuePinnacle(g, p.id)).toBeNull();
        step(g);
        const run = () => g.activity.run!;
        run().hero.life = -1e9;
        step(g);
        expect(run().phase).toBe("dead");
        expect(g.activity.streak).toBe(5);
    });
    it("map bosses and repeat story bosses stay out of the chronicle", () => {
        const s = g0(9);
        s.world.clears.a1_chapel = 3;
        s.world.unlocked.push("a1_saltmire", "a1_chapel");
        s.activity.zone = "a1_chapel"; s.activity.autoPush = false; s.activity.run = null;
        s.hero.level = 30; s.hero.rev++;
        gainXp(s, 0);
        for (let i = 0; i < 20000 && !s.log.some(e => e.key === "log.bossFalls") && s.totals.runs < 3; i++) step(s);
        expect(s.totals.runs).toBeGreaterThan(0);
        expect(s.log.some(e => e.key === "log.bossFalls")).toBe(false);
    });
});

describe("review A: views rebuild when their buttons change", () => {
    it("the market view follows each offer's affordability, the atlas the currency", async () => {
        const { marketSig } = await import("../src/ui/market");
        const { atlasSig } = await import("../src/ui/atlas");
        const s = g0(5); s.hero.level = 30; s.world.clears.a1_lock = 1;
        tickMarket(s);
        s.market.jeweller[0]!.price = 120;
        s.dust = 119;
        const a = marketSig(s);
        s.dust = 121;
        expect(marketSig(s)).not.toBe(a);
        const ctx = { state: s, sel: {} } as unknown as Parameters<typeof atlasSig>[0];
        const b = atlasSig(ctx);
        s.currency.kindling = 5;
        expect(atlasSig(ctx)).not.toBe(b);
    });
});

describe("review A: contracts and pinnacles in the endgame", () => {
    const endgame = () => { const g = g0(4); g.world.clears.a4_lamphouse = 1; g.hero.level = 70; g.hero.rev++; return g; };
    const finish = (g: ReturnType<typeof g0>) => { step(g); g.activity.run!.phase = "done"; step(g); };
    it("a map run moves a 'clear runs' contract taken before the maps opened", async () => {
        const { setMapMode } = await import("../src/core/maps");
        const g = endgame();
        g.contracts.list = [{ kind: "runs", target: 5, n: 0, dust: 10 }];
        g.maps.push({ uid: 9001, tier: 1, area: "saltflats", mods: [], rarity: "plain" });
        expect(setMapMode(g, true)).toBeNull();
        finish(g);
        expect(g.contracts.list[0]!.n).toBe(1);
    });
    it("losing a pinnacle fight doesn't count towards lowering the map device's tier", async () => {
        const { queuePinnacle } = await import("../src/core/maps");
        const { PINNACLES } = await import("../src/core/data");
        const g = endgame();
        g.activity.mode = "map"; g.activity.run = null; g.activity.autoPush = true;
        const p = PINNACLES.drownedsun!;
        g.sigils[p.sigil] = p.cost;
        expect(queuePinnacle(g, p.id)).toBeNull();
        step(g);
        const run = () => g.activity.run!; // step() replaces it; TypeScript only saw it set to null
        expect(run().map?.pinnacle).toBe(p.id);
        run().hero.life = -1e9;
        step(g);
        expect(run().phase).toBe("dead");
        expect(g.activity.deaths).toBe(0);
    });
});
