import { describe, expect, it } from "vitest";
import { ATLAS, MAP_AREAS, MAP_MODS, MONSTERS, PINNACLES, mapLevel, monsterDamage, monsterLife, MAX_TIER } from "../src/core/data";
import { newGame } from "../src/core/game";
import { atlasPointsLeft, craftMap, queuePinnacle, setMapMode, takeAtlas } from "../src/core/maps";
import { step, reconcileRewards } from "../src/core/sim/engine";
import { MIGRATIONS, unwrap } from "../src/core/save";
import { validateState } from "../src/core/validate";
import type { GameState, MapItem } from "../src/core/state";

const g0 = () => newGame({ name: "E", cls: "arcanist", now: 0, seed: 21 });
const endgame = () => { const g = g0(); g.world.clears.a4_lamphouse = 1; g.hero.level = 70; g.hero.rev++; return g; };
const map = (uid: number, tier: number, mods: string[] = []): MapItem => ({ uid, tier, area: "saltflats", mods, rarity: mods.length ? "enchanted" : "plain" });
function finish(g: GameState) { step(g); g.activity.run!.phase = "done"; step(g); }

describe("endgame content", () => {
    it("references are valid and scaling never breaks", () => {
        for (const a of Object.values(MAP_AREAS)) { for (const m of a.monsters) expect(MONSTERS[m]?.boss, m).toBeFalsy(); expect(MONSTERS[a.boss]?.boss).toBe(true); }
        for (const n of Object.values(ATLAS)) for (const r of n.requires) expect(ATLAS[r], r).toBeDefined();
        for (const p of Object.values(PINNACLES)) expect(MONSTERS[p.boss]?.boss).toBe(true);
        for (const m of Object.values(MAP_MODS)) expect(m.qty).toBeGreaterThan(0);
        for (const t of [1, 16, 17, 60, 300]) {
            const L = mapLevel(t);
            expect(Number.isFinite(monsterLife(L)) && Number.isFinite(monsterDamage(L))).toBe(true);
            if (t > 1) expect(L).toBeGreaterThan(mapLevel(t - 1));
        }
        expect(mapLevel(MAX_TIER + 1)).toBe(75);
    });
});

describe("maps", () => {
    it("only after Ashfold; runs consume maps, highest first, Outskirts when empty", () => {
        const locked = g0();
        expect(setMapMode(locked, true)).toMatch(/Ashfold/);
        const g = endgame();
        g.maps.push(map(900, 3), map(901, 5), map(902, 1));
        expect(setMapMode(g, true)).toBeNull();
        step(g);
        expect(g.activity.run!.map!.tier).toBe(5);
        expect(g.maps.length).toBe(2);
        finish(g);
        expect(g.atlas.tiers).toContain(5);
        expect(g.atlas.points).toBe(1);
        expect(g.activity.run!.map!.tier).toBe(3);
        g.maps.length = 0;
        finish(g);
        expect(g.activity.run!.map!.tier).toBe(0); // Outskirts
    });
    it("dying in a map loses it and 5% of a level", () => {
        const g = endgame();
        g.maps.push(map(900, 2));
        setMapMode(g, true);
        g.hero.xp = 1e6;
        step(g);
        g.activity.run!.hero.life = -1;
        g.activity.run!.phase = "fight";
        g.activity.run!.monsters.forEach(m => { m.atk = 99; });
        step(g);
        expect(g.activity.run!.phase).toBe("dead");
        expect(g.hero.xp).toBeLessThan(1e6);
        expect(g.maps.length).toBe(0);
    });
    it("map mods and crafting", () => {
        const g = endgame();
        g.maps.push(map(900, 4));
        g.currency.kindling = 1; g.currency.crownseal = 1; g.currency.reshaper = 1;
        expect(craftMap(g, "reshaper", 900)).toMatch(/enchanted/);
        expect(craftMap(g, "kindling", 900)).toBeNull();
        expect(g.maps[0]!.mods.length).toBeGreaterThan(0);
        expect(craftMap(g, "crownseal", 900)).toBeNull();
        expect(g.maps[0]!.rarity).toBe("rare");
        expect(new Set(g.maps[0]!.mods).size).toBe(g.maps[0]!.mods.length);
    });
    it("atlas nodes need points and their prerequisites", () => {
        const g = endgame();
        expect(takeAtlas(g, "a_cart")).toMatch(/points/);
        g.atlas.points = 2;
        expect(takeAtlas(g, "a_cart2")).toMatch(/before/);
        expect(takeAtlas(g, "a_cart")).toBeNull();
        expect(takeAtlas(g, "a_cart2")).toBeNull();
        expect(atlasPointsLeft(g)).toBe(0);
    });
    it("pinnacles cost sigils and give atlas points once", () => {
        const g = endgame();
        expect(queuePinnacle(g, "drownedsun")).toMatch(/Sigil/);
        g.sigils.tide_sigil = 3;
        expect(queuePinnacle(g, "drownedsun")).toBeNull();
        step(g);
        expect(g.activity.run!.map!.pinnacle).toBe("drownedsun");
        expect(g.activity.run!.monsters[0]!.def).toBe("p_drownedsun");
        expect(g.sigils.tide_sigil).toBe(0);
        finish(g);
        expect(g.pinnacleKills.drownedsun).toBe(1);
        expect(g.atlas.points).toBe(2);
    });
});

describe("rewards ledger", () => {
    it("saves from before P3 catch up on trials and act points exactly once", () => {
        const g = g0() as any;
        g.world.clears = { a1_chapel: 3, a1_lock: 2, a1_trial: 1 };
        delete g.world.rewards;
        const env = unwrap<any>({ game: "hollowmarch", v: 3, savedAt: 0, state: g }, MIGRATIONS, 4);
        const s = validateState(env.state);
        expect(s.world.unlocked).toContain("a1_trial");
        expect(s.hero.bonusPoints).toBe(2);
        expect(s.hero.ascPoints).toBe(2);
        reconcileRewards(s);
        expect(s.hero.bonusPoints).toBe(2);
    });
    it("P3 saves that already got their points are not paid twice", () => {
        const g = g0() as any;
        g.world.clears = { a1_lock: 1, a1_trial: 1 };
        g.hero.bonusPoints = 2; g.hero.ascPoints = 2;
        delete g.world.rewards; delete g.maps; delete g.atlas;
        const env = unwrap<any>({ game: "hollowmarch", v: 3, savedAt: 0, state: g }, MIGRATIONS, 4);
        const s = validateState(env.state);
        expect(s.hero.bonusPoints).toBe(2);
        expect(s.hero.ascPoints).toBe(2);
        expect(s.atlas.points).toBe(0);
    });
});

import { setZone } from "../src/core/game";
import { forgeRare, forgeCost } from "../src/core/crafting";
import { setMapTier } from "../src/core/maps";

describe("P4 review fixes", () => {
    it("a map run survives save and load", () => {
        const g = endgame();
        g.maps.push(map(900, 5));
        setMapMode(g, true);
        step(g);
        const s = validateState(JSON.parse(JSON.stringify(g)));
        expect(s.activity.run?.map?.tier).toBe(5);
    });
    it("picking a story zone in map mode leaves map mode without burning a map", () => {
        const g = endgame();
        g.maps.push(map(900, 5), map(901, 4));
        setMapMode(g, true);
        step(g);
        expect(setZone(g, "a1_shore")).toBeNull();
        expect(g.activity.mode).toBe("zone");
        expect(g.activity.run?.map?.tier).toBe(5); // the running map finishes
        finish(g);
        expect(g.activity.run?.map).toBeUndefined();
        expect(g.maps.length).toBe(1);
    });
    it("map mode before the endgame is repaired on load", () => {
        const g = g0() as any;
        g.activity.mode = "map"; g.activity.pinnacle = "drownedsun";
        const s = validateState(g);
        expect(s.activity.mode).toBe("zone");
        expect(s.activity.pinnacle).toBeUndefined();
    });
    it("auto-push lowers its own cap, never the player's", () => {
        const g = endgame();
        setMapMode(g, true);
        setMapTier(g, 5);
        for (let i = 0; i < 3; i++) { g.maps.push(map(950 + i, 9)); step(g); const r = g.activity.run!; r.phase = "fight"; r.hero.life = -1; r.monsters.forEach(m => { m.atk = 99; }); step(g); g.activity.run!.timer = 0; step(g); }
        expect(g.activity.mapTier).toBe(5);
    });
    it("forging a rare costs dust and yields a rare for the slot", () => {
        const g = endgame();
        g.dust = forgeCost(g) + 1;
        const r = forgeRare(g, "helmet");
        expect(r.err).toBeNull();
        expect(r.item!.rarity).toBe("rare");
        expect(r.item!.crafted).toBe(true);
        expect(g.dust).toBe(1);
        expect(forgeRare(g, "helmet").err).toMatch(/dust/);
    });
});

import { levelReq } from "../src/core/items";
import { autoXpCap } from "../src/core/maps";

describe("P5 review fixes", () => {
    it("forged rares are wearable and never lost to the filter", () => {
        const g = g0(); g.hero.level = 7; g.hero.rev++;
        g.settings.filter = [{ on: true, action: "salvage", rarity: ["rare"] }];
        g.settings.autoEquip = false;
        for (let i = 0; i < 30; i++) {
            g.dust = 1e6;
            const r = forgeRare(g, "body");
            expect(r.err).toBeNull();
            expect(levelReq(r.item!)).toBeLessThanOrEqual(9);
            expect(g.stash.some(x => x.uid === r.item!.uid)).toBe(true);
        }
        g.stashCap = g.stash.length; g.dust = 1e6;
        expect(forgeRare(g, "body").err).toMatch(/stash/);
        expect(g.dust).toBe(1e6);
    });
    it("the XP cap yields to the player's tier and to max level", () => {
        const g = endgame();
        expect(autoXpCap(g)).toBeGreaterThan(0);
        g.activity.mapTier = 30;
        expect(autoXpCap(g)).toBe(0);
        g.activity.mapTier = 0; g.hero.level = 100;
        expect(autoXpCap(g)).toBe(0);
    });
});
