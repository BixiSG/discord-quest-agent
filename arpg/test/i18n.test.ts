// Russian and Ukrainian: complete tables, matching placeholders and plural
// forms, every character drawable by the pixel font, and every place the game
// builds text from content working in all three languages.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LANGS, TABLES, pluralIndex, setLang, setStrict, t, tn, type Lang } from "../src/i18n";
import { EN } from "../src/i18n/en";
import { tErr } from "../src/i18n/errors";
import * as N from "../src/i18n/names";
import { GLYPHS } from "../src/ui/gfx/pixfont";
import { ACTS, AFFIXES, ASCENDANCIES, ATLAS, BASES, CLASSES, COMPANIONS, CURRENCIES, MAP_AREAS, MAP_MODS, MONSTERS, PASSIVES, PINNACLES, RARE_NAMES_A, RARE_NAMES_B, RELICS, SKILLS, SUPPORTS, ZONES } from "../src/core/data";
import { BLESSINGS } from "../src/core/shrine";

const BLESSINGS_IDS = BLESSINGS.map(b => b.id);
import { newGame, pushLog } from "../src/core/game";
import { validateState } from "../src/core/validate";
import { ref } from "../src/i18n/refs";
import type { Item, Mod } from "../src/core/types";

const OTHER: Lang[] = ["ru", "uk"];
const holes = (s: string) => [...new Set(s.match(/\{\w+\}/g) ?? [])].sort();

describe("string tables", () => {
    for (const l of OTHER) {
        it(`${l} has every English key and no others`, () => {
            const missing = Object.keys(EN).filter(k => TABLES[l][k] === undefined);
            const extra = Object.keys(TABLES[l]).filter(k => EN[k] === undefined);
            expect(missing).toEqual([]);
            expect(extra).toEqual([]);
        });
        it(`${l} keeps every placeholder of each key`, () => {
            const bad = Object.keys(EN).filter(k => TABLES[l][k] !== undefined && holes(TABLES[l][k]!).join() !== holes(EN[k]!).join());
            expect(bad.map(k => `${k}: ${TABLES[l][k]}`)).toEqual([]);
        });
        it(`${l} has three plural forms where English has two, gendered forms only on prefixes`, () => {
            const bad: string[] = [];
            for (const [k, en] of Object.entries(EN)) {
                const forms = TABLES[l][k]!.split("|").length;
                const enForms = en.split("|").length;
                const prefix = /^affix\.(\w+)\.label$/.exec(k);
                const want = enForms === 2 ? [3] : k.startsWith("stat.") ? [2] : prefix && AFFIXES[prefix[1]!]?.type === "prefix" ? [4] : [1];
                if (!want.includes(forms)) bad.push(`${k} (${forms} forms)`);
                if (TABLES[l][k]!.split("|").some(f => !f.trim())) bad.push(`${k} (empty form)`);
            }
            expect(bad).toEqual([]);
        });
        it(`${l} strings are all drawable in the pixel font`, () => {
            // The web font: printable ASCII plus the code points make-font.ts adds. Canvas text is drawn in
            // capitals: every letter and digit needs a capital bitmap, and so does the punctuation that
            // Cyrillic lines add (plain ASCII punctuation on canvas only appears in English strings).
            const extra = /EXTRA = \[\.\.\."([^"]+)"\]/.exec(readFileSync(join(__dirname, "../tools/make-font.ts"), "utf8"))![1]!;
            const web = new Set([...Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)), ...extra]);
            const bad = new Set<string>();
            for (const s of Object.values(TABLES[l])) for (const ch of s.replace(/\{\w+\}|[|\n]/g, "")) {
                if (!web.has(ch)) bad.add(`web:${ch}`);
                const canvas = /[\p{L}\p{N}]/u.test(ch) || ch.charCodeAt(0) > 126;
                if (canvas && !GLYPHS[ch] && !GLYPHS[ch.toUpperCase()]) bad.add(`canvas:${ch}`);
            }
            expect([...bad]).toEqual([]);
        });
    }
    it("each Cyrillic table keeps to its own alphabet (Ukrainian is not Russian respelled)", () => {
        // Letters only one of the two languages has: ы э ъ ё are Russian, і ї є ґ Ukrainian.
        const ruOnly = /[ыэъёЫЭЪЁ]/, ukOnly = /[іїєґІЇЄҐ]/;
        expect(Object.entries(TABLES.uk).filter(([, v]) => ruOnly.test(v)).map(([k]) => k)).toEqual([]);
        expect(Object.entries(TABLES.ru).filter(([, v]) => ukOnly.test(v)).map(([k]) => k)).toEqual([]);
    });
    it("English plural strings have one|other forms and no key is empty", () => {
        for (const [k, v] of Object.entries(EN)) {
            expect(v.length, k).toBeGreaterThan(0);
            expect(v.split("|").length, k).toBeLessThanOrEqual(2);
        }
    });
});

describe("plural rules", () => {
    it("ru and uk: one, few, many", () => {
        for (const l of OTHER) {
            expect([1, 2, 5, 11, 21, 22, 25, 12, 14, 104, 111, 0].map(n => pluralIndex(l, n))).toEqual([0, 1, 2, 2, 0, 1, 2, 2, 2, 1, 2, 2]);
            expect(pluralIndex(l, 1.5)).toBe(1);
        }
    });
    it("en: one and other", () => {
        expect([1, 2, 5, 11, 21, 0].map(n => pluralIndex("en", n))).toEqual([0, 1, 1, 1, 1, 1]);
    });
    it("tn picks the form and fills {n}", () => {
        setLang("ru");
        expect(tn("world.clears", 1)).toBe("1 проход");
        expect(tn("world.clears", 3)).toBe("3 прохода");
        expect(tn("world.clears", 25)).toBe("25 проходов");
        setLang("uk");
        expect(tn("world.clears", 21)).toBe("21 прохід");
        expect(tn("world.clears", 22)).toBe("22 проходи");
        setLang("en");
        expect(tn("world.clears", 1)).toBe("1 clear");
        expect(tn("world.clears", 2)).toBe("2 clears");
    });
});

describe("content in every language", () => {
    beforeAll(() => setStrict(true));
    afterAll(() => { setStrict(false); setLang("en"); });
    const mods: Mod[] = [];
    for (const k of Object.keys(EN)) if (k.startsWith("stat.")) for (const kind of ["flat", "inc", "more"] as const) for (const value of [12, -8]) mods.push({ stat: k.slice(5) as Mod["stat"], kind, value, tags: ["spell", "fire"] });

    for (const l of LANGS) {
        it(`${l}: names, texts and lines build without gaps`, () => {
            setLang(l);
            const out: string[] = [];
            for (const id of Object.keys(ZONES)) out.push(N.zoneName(id), ...(ZONES[id]!.story ? [N.zoneStory(id)] : []));
            for (const a of ACTS) out.push(N.actName(a.id), N.actIntro(a.id), N.actOutro(a.id));
            for (const id of Object.keys(CLASSES)) out.push(N.className(id), N.classBlurb(id));
            for (const id of Object.keys(SKILLS)) out.push(N.skillName(id), N.skillBlurb(id));
            for (const id of Object.keys(SUPPORTS)) out.push(N.supportName(id), N.supportBlurb(id));
            for (const id of Object.keys(MONSTERS)) out.push(N.monsterName(id));
            for (const id of Object.keys(CURRENCIES)) out.push(N.currencyName(id), N.currencyBlurb(id));
            for (const id of Object.keys(COMPANIONS)) out.push(N.companionName(id), N.companionBlurb(id), N.companionWhere(id), N.companionBonus(id, 7));
            for (const id of BLESSINGS_IDS) out.push(N.blessingName(id), N.blessingText(id, 20));
            for (const id of Object.keys(MAP_AREAS)) out.push(N.mapAreaName(id), N.mapLabel({ area: id, tier: 3 }), N.runMapName({ area: id, tier: 19, level: 1, mods: [] }));
            for (const id of Object.keys(MAP_MODS)) out.push(N.mapModText(id));
            for (const id of Object.keys(ATLAS)) out.push(N.atlasName(id), N.atlasText(id));
            for (const id of Object.keys(PINNACLES)) out.push(N.pinName(id), N.pinText(id), N.sigilName(id));
            for (const a of Object.values(ASCENDANCIES)) out.push(N.ascName(a.id), N.ascBlurb(a.id), ...a.nodes.map(n => N.ascNodeName(n.id)));
            for (const n of Object.values(PASSIVES)) out.push(N.nodeName(n));
            for (const m of mods) out.push(N.modLine(m));
            for (const tier of [0, 1, 16, 17, 40]) out.push(N.tierName(tier));
            for (const k of ["kills", "champions", "bosses", "runs", "maps", "rares"]) for (const n of [1, 3, 5, 21]) out.push(N.contractGoal(k, n, 4));
            for (const ms of [5e3, 90e3, 4e6, 2e8]) out.push(N.fmtDuration(ms));
            // Items: every base plain; every prefix and suffix on bases of each gender; every relic; rare names.
            const item = (base: string, extra: Partial<Item> = {}): Item => ({ uid: 1, base, ilvl: 80, rarity: "plain", affixes: [], ...extra });
            for (const b of Object.keys(BASES)) out.push(N.itemName(item(b)));
            const bases = ["plate_body1", "plate_helmet2", "leather_gloves3", "ring_iron", "sword2"];
            for (const a of Object.values(AFFIXES)) for (const b of bases) {
                const roll = { id: a.id, tier: 0, rolls: a.tiers[0]!.ranges.map(r => r[0]) };
                out.push(N.itemName(item(b, { rarity: "enchanted", affixes: [roll] })), N.affixLine(roll), N.affixTemplate(a.id));
            }
            for (const r of Object.values(RELICS)) {
                const it = item(r.base, { rarity: "relic", relic: r.id, relicRolls: r.mods.map(m => m.range[1]) });
                out.push(N.itemName(it), N.relicFlavour(r.id), ...N.relicLines(it));
            }
            for (const a of RARE_NAMES_A) for (const b of RARE_NAMES_B) out.push(N.rareName(`${a} ${b}`));
            for (const g of new Set(Object.values(AFFIXES).map(a => a.group))) out.push(N.groupName(g));
            for (const s of out) {
                expect(s).toBeTruthy();
                expect(s).not.toMatch(/\{\w*\}|undefined|NaN|\|/);
            }
        });
    }

    it("ru: a prefix agrees with its noun, a rare name reads noun first", () => {
        setLang("ru");
        const ench = (base: string) => N.itemName({ uid: 1, base, ilvl: 5, rarity: "enchanted", affixes: [{ id: "life", tier: 0, rolls: [12] }, { id: "str", tier: 0, rolls: [6] }] });
        expect(ench("plate_body1")).toBe("Крепкая мятая кираса быка");
        expect(ench("plate_helmet1")).toBe("Крепкий мятый шлем быка");
        expect(ench("ring_iron")).toBe("Крепкое железное кольцо быка");
        expect(ench("plate_boots1")).toBe("Крепкие мятые поножи быка");
        expect(N.rareName("Grim Bite")).toBe("Укус Мрака");
        expect(N.modLine({ stat: "armour", kind: "inc", value: 12 })).toBe("12% увеличение брони");
        expect(N.modLine({ stat: "res.fire", kind: "flat", value: 8 })).toBe("Сопротивление огню +8%");
        expect(N.modLine({ stat: "damage", kind: "more", value: 30, tags: ["melee"] })).toBe("На 30% больше урона (ближний бой)");
    });
    it("uk: a prefix agrees with its noun", () => {
        setLang("uk");
        const ench = (base: string) => N.itemName({ uid: 1, base, ilvl: 5, rarity: "enchanted", affixes: [{ id: "life", tier: 0, rolls: [12] }] });
        expect(ench("plate_body1")).toBe("Міцна пом'ята кіраса");
        expect(ench("plate_helmet1")).toBe("Міцний пом'ятий шолом");
        expect(ench("dagger8")).toBe("Міцне останнє світло");
        expect(ench("plate_boots1")).toBe("Міцні пом'яті поножі");
        expect(N.rareName("Grim Bite")).toBe("Укус Мороку");
        expect(N.modLine({ stat: "res.fire", kind: "flat", value: 8 })).toBe("Опір вогню +8%");
    });
    it("en: labels and modifier lines read as the data has them", () => {
        setLang("en");
        expect(N.itemName({ uid: 1, base: "plate_body1", ilvl: 5, rarity: "enchanted", affixes: [{ id: "life", tier: 0, rolls: [12] }, { id: "str", tier: 0, rolls: [6] }] })).toBe("Hale Dented Cuirass of the Ox");
        expect(N.modLine({ stat: "res.fire", kind: "flat", value: 8 })).toBe("+8% fire resistance");
        expect(N.modLine({ stat: "damage", kind: "inc", value: 10, tags: ["phys"] })).toBe("10% increased damage (physical)");
        expect(N.modLine({ stat: "life", kind: "flat", value: 15 })).toBe("+15 maximum life");
    });
});

describe("chronicle", () => {
    afterAll(() => setLang("en"));
    it("entries keep a key and params, with English text for exports and old readers", () => {
        const g = newGame({ name: "Ashling", cls: "vanguard", now: 1e12, seed: 7 });
        pushLog(g, "death", "log.died", { place: ref.place("a1_saltmire") });
        pushLog(g, "info", "log.actDone", { act: 1, n: 2 });
        const [wake, died, act] = g.log;
        expect(wake).toMatchObject({ key: "log.wake", text: "Ashling wakes on the shore." });
        expect(died).toMatchObject({ key: "log.died", params: { place: "@zone:a1_saltmire" }, text: "Died in Saltmire." });
        expect(act!.text).toBe("Act 1 complete: +2 passive points.");
        setLang("ru");
        expect(N.logText(died!)).toBe("Смерть: Солёная топь.");
        expect(N.logText(act!)).toBe("Акт 1 пройден: +2 очка умений.");
        setLang("uk");
        expect(N.logText(act!)).toMatch(/^Акт 1/);
    });
    it("old entries (text only) and unknown keys read their text; bad params are dropped", () => {
        const g = newGame({ name: "Ashling", cls: "vanguard", now: 1e12, seed: 7 });
        g.log = [
            { t: 1, kind: "info", text: "An old line." },
            { t: 2, kind: "info", text: "From the future.", key: "log.notYet", params: { a: 1 } },
            { t: 3, kind: "loot", text: "Equipped a new Rusted Blade.", key: "log.equippedNew", params: { base: "@base:sword1", bad: { x: 1 } as unknown as string } },
            { t: 4, kind: "bogus" as "info", text: "?" },
        ];
        const s = validateState(g);
        expect(s.log).toHaveLength(3);
        expect(s.log[1]).toEqual({ t: 2, kind: "info", text: "From the future." });
        expect(s.log[2]!.params).toEqual({ base: "@base:sword1" });
        setLang("ru");
        expect(N.logText(s.log[0]!)).toBe("An old line.");
        expect(N.logText(s.log[2]!)).toBe("Надето новое: Ржавый клинок.");
    });
    it("item references read like the item's label", () => {
        const it: Item = { uid: 1, base: "plate_body1", ilvl: 5, rarity: "enchanted", affixes: [{ id: "life", tier: 0, rolls: [12] }] };
        setLang("en");
        expect(N.resolveParam(ref.item(it))).toBe("Hale Dented Cuirass");
        setLang("ru");
        expect(N.resolveParam(ref.item(it))).toBe("Крепкая мятая кираса");
        expect(N.resolveParam(ref.item({ ...it, rarity: "rare", name: "Salt Song", affixes: [] }))).toBe("Песнь Соли");
    });
});

describe("messages from the core", () => {
    afterAll(() => setLang("en"));
    const files = (dir: string): string[] => readdirSync(dir).flatMap(f => {
        const p = join(dir, f);
        return statSync(p).isDirectory() ? files(p) : p.endsWith(".ts") ? [p] : [];
    });
    // Every fixed string the core returns as an action result or throws as a save error.
    const literals = new Set<string>();
    for (const f of files(join(__dirname, "../src/core"))) {
        const src = readFileSync(f, "utf8");
        for (const m of src.matchAll(/(?:return|err:|SaveError\()\s*"([^"]+)"/g)) literals.add(m[1]!);
    }
    for (const x of ["HM1:", "plain", "enchanted", "rare", "weapon", "armour", "jewel"]) literals.delete(x); // not messages
    const samples = ["needs 120 ember dust", "needs 40 ember dust (or spare orbs)", "needs level 12", "helmet: needs level 30", "Heavy Hand needs level 20",
        "Sunder can't be used with this weapon", "Twin Shot can't be used with no weapon", "Potency does not support Sunder", "needs 3 Tide Sigils", "no Kindling left",
        "already at 20% quality", "needs 3 Graft", "save is from a newer version (9)", "no migration from version 2", "bad seed", "missing hero", "unknown class x", "relic with affixes",
        "no room for more than 2 sockets", "no room for more than 1 socket"];
    for (const l of OTHER) {
        it(`${l}: every one is translated`, () => {
            setLang(l);
            const untranslated = [...literals, ...samples].filter(m => tErr(m) === m);
            expect(untranslated).toEqual([]);
            expect(tErr("Heavy Hand needs level 20")).toContain(t("support.heavyhand.name"));
        });
    }
});
