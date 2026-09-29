// Content validation: every table must be internally consistent.
import { describe, expect, it } from "vitest";
import { ACTS, AFFIXES, BASES, CLASSES, MONSTERS, SKILLS, SUPPORTS, ZONES, ZONE_ORDER, xpToNext, monsterLife } from "../src/core/data";
import { DAMAGE_TYPES } from "../src/core/types";
import { domainsOf } from "../src/core/items";

const ID = /^[a-z][a-z0-9_]*$/;
const ascii = (s: string) => /^[\x20-\x7e]*$/.test(s);

describe("content", () => {
    it("ids match their keys and are well formed", () => {
        for (const table of [CLASSES, SKILLS, SUPPORTS, BASES, AFFIXES, MONSTERS, ZONES] as Record<string, { id: string }>[])
            for (const [k, v] of Object.entries(table)) { expect(v.id).toBe(k); expect(k).toMatch(ID); }
    });
    it("all text is ASCII", () => {
        const walk = (v: unknown): void => {
            if (typeof v === "string") expect(ascii(v), v).toBe(true);
            else if (v && typeof v === "object") Object.values(v).forEach(walk);
        };
        walk([CLASSES, SKILLS, SUPPORTS, BASES, AFFIXES, MONSTERS, ZONES, ACTS]);
    });
    it("classes reference real skills, bases", () => {
        for (const c of Object.values(CLASSES)) {
            expect(SKILLS[c.startSkill]).toBeDefined();
            expect(BASES[c.startWeapon]?.slot).toBe("weapon");
            expect(SKILLS[c.startSkill]!.level).toBe(1);
        }
    });
    it("skills are sane", () => {
        for (const s of Object.values(SKILLS)) {
            expect(s.tags).toContain(s.kind);
            if (s.kind === "spell") { expect(s.castTime).toBeGreaterThan(0); expect(s.damage).toBeDefined(); }
            expect(s.effectiveness).toBeGreaterThan(0);
            for (const w of s.weapons ?? []) expect(Object.values(BASES).some(b => b.kind === w), w).toBe(true);
        }
    });
    it("supports are sane", () => {
        for (const s of Object.values(SUPPORTS)) { expect(s.manaMult).toBeGreaterThanOrEqual(1); expect(s.mods.length + (s.targets ?? 0)).toBeGreaterThan(0); }
    });
    it("affix tiers climb and every affix can roll somewhere", () => {
        const allDomains = new Set(Object.values(BASES).flatMap(b => [...domainsOf(b)]));
        for (const a of Object.values(AFFIXES)) {
            expect(a.tiers.length).toBeGreaterThan(0);
            expect(a.domains.some(d => allDomains.has(d)), a.id).toBe(true);
            for (const t of a.tiers) { expect(t.ranges.length).toBe(a.mods.length); for (const [lo, hi] of t.ranges) expect(lo).toBeLessThanOrEqual(hi); }
            for (let i = 1; i < a.tiers.length; i++) {
                expect(a.tiers[i]!.ilvl).toBeGreaterThan(a.tiers[i - 1]!.ilvl);
                a.tiers[i]!.ranges.forEach(([, hi], k) => expect(hi, a.id).toBeGreaterThanOrEqual(a.tiers[i - 1]!.ranges[k]![1]));
            }
            expect(a.text.includes("{0}")).toBe(true);
        }
    });
    it("bases are sane", () => {
        for (const b of Object.values(BASES)) {
            if (b.weapon) { expect(b.weapon.phys[0]).toBeLessThanOrEqual(b.weapon.phys[1]); expect(b.weapon.aps).toBeGreaterThan(0); }
            expect(b.level).toBeGreaterThanOrEqual(1);
        }
    });
    it("monsters split damage to 100% and zones reference real monsters", () => {
        for (const m of Object.values(MONSTERS)) {
            const sum = DAMAGE_TYPES.reduce((s, t) => s + (m.split[t] ?? 0), 0);
            expect(sum, m.id).toBeCloseTo(1);
        }
        for (const z of Object.values(ZONES)) {
            for (const id of z.monsters) { expect(MONSTERS[id], id).toBeDefined(); expect(MONSTERS[id]!.boss).toBeFalsy(); }
            if (z.boss) expect(MONSTERS[z.boss]?.boss).toBe(true);
            expect(z.packSize[0]).toBeLessThanOrEqual(z.packSize[1]);
            expect(z.palette.every(c => /^#[0-9a-f]{6}$/.test(c))).toBe(true);
        }
        expect(new Set(ZONE_ORDER).size).toBe(ZONE_ORDER.length);
        for (const id of ZONE_ORDER) expect(ZONES[id]).toBeDefined();
    });
    it("level curves are increasing", () => {
        for (let l = 1; l < 99; l++) { expect(xpToNext(l + 1)).toBeGreaterThan(xpToNext(l)); expect(monsterLife(l + 1)).toBeGreaterThan(monsterLife(l)); }
    });
});

// COMBAT.md sections 9-10 quote these curves; change both together.
import { monsterDamage, monsterDefence, monsterXp } from "../src/core/data";
describe("scaling matches COMBAT.md", () => {
    it("pins the documented curves", () => {
        expect(monsterLife(1)).toBeCloseTo(20);
        expect(monsterLife(11)).toBeCloseTo(20 * Math.pow(1.085, 10) * 1.3);
        expect(monsterDamage(11)).toBeCloseTo(5 * Math.pow(1.055, 10) * 1.2);
        expect(monsterDefence(11)).toBeCloseTo(12 + 90 * Math.pow(1.03, 10));
        expect(xpToNext(10)).toBe(Math.round(3 * (80 * Math.pow(10, 2.8) + 1200)));
        expect(xpToNext(70)).toBe(Math.round(3 * (80 * Math.pow(70, 2.8) + 120 * 70) * Math.pow(1.07, 10)));
        expect(monsterXp(10)).toBeCloseTo(4 * Math.pow(10, 1.9) + 6);
    });
});
import { spellScale, heroBaseLife } from "../src/core/data";
describe("hero curves match COMBAT.md", () => {
    it("pins spell scale and base life", () => {
        expect(spellScale(11)).toBeCloseTo(Math.pow(1.06, 10) * 1.15);
        expect(heroBaseLife(11, 60)).toBe(260);
    });
});
