// Game content in the current language (or a given one): names and texts
// looked up by id, item labels, modifier lines, map and tier names, and the
// references stored in log entries. Pure: the core uses it in English to
// write the fallback text of log entries.

import { AFFIXES, COMPANIONS, FEATS, MAP_AREAS, MAX_TIER, RARE_NAMES_A, RARE_NAMES_B, RELICS, companionMod, type PassiveNode } from "../core/data";
import { affixOf } from "../core/items";
import type { GameState, LogEntry, RunMap } from "../core/state";
import type { AffixRoll, Item, Mod } from "../core/types";
import { PCT_STATS, slug } from "./en";
import { capFirst, fill, form, genderOf, lang, lowFirst, tr, trn, type Lang, type Params } from "./index";

export { slug };

const L = (l?: Lang): Lang => l ?? lang();

export const zoneName = (id: string, l?: Lang) => tr(L(l), `zone.${id}.name`);
export const zoneStory = (id: string, l?: Lang) => tr(L(l), `zone.${id}.story`);
export const actName = (id: number, l?: Lang) => tr(L(l), `act.${id}.name`);
export const actIntro = (id: number, l?: Lang) => tr(L(l), `act.${id}.intro`);
export const actOutro = (id: number, l?: Lang) => tr(L(l), `act.${id}.outro`);
export const className = (id: string, l?: Lang) => tr(L(l), `class.${id}.name`);
export const classBlurb = (id: string, l?: Lang) => tr(L(l), `class.${id}.blurb`);
export const skillName = (id: string, l?: Lang) => tr(L(l), `skill.${id}.name`);
export const skillBlurb = (id: string, l?: Lang) => tr(L(l), `skill.${id}.blurb`);
export const supportName = (id: string, l?: Lang) => tr(L(l), `support.${id}.name`);
export const supportBlurb = (id: string, l?: Lang) => tr(L(l), `support.${id}.blurb`);
export const monsterName = (id: string, l?: Lang) => tr(L(l), `monster.${id}.name`);
export const baseName = (id: string, l?: Lang) => tr(L(l), `base.${id}.name`);
export const currencyName = (id: string, l?: Lang) => tr(L(l), `currency.${id}.name`);
export const currencyBlurb = (id: string, l?: Lang) => tr(L(l), `currency.${id}.blurb`);
export const relicName = (id: string, l?: Lang) => tr(L(l), `relic.${id}.name`);
export const relicFlavour = (id: string, l?: Lang) => tr(L(l), `relic.${id}.flavour`);
export const companionName = (id: string, l?: Lang) => tr(L(l), `companion.${id}.name`);
export const companionBlurb = (id: string, l?: Lang) => tr(L(l), `companion.${id}.blurb`);
export const companionWhere = (id: string, l?: Lang) => tr(L(l), `companion.${id}.where`);
export const blessingName = (id: string, l?: Lang) => tr(L(l), `blessing.${id}.name`);
export const blessingText = (id: string, value: number, l?: Lang) => tr(L(l), `blessing.${id}.text`, { 0: value });
export const mapAreaName = (id: string, l?: Lang) => tr(L(l), `mapArea.${id}.name`);
export const mapModText = (id: string, l?: Lang) => tr(L(l), `mapMod.${id}.text`);
export const atlasName = (id: string, l?: Lang) => tr(L(l), `atlas.${id}.name`);
export const atlasText = (id: string, l?: Lang) => tr(L(l), `atlas.${id}.text`);
export const pinName = (id: string, l?: Lang) => tr(L(l), `pinnacle.${id}.name`);
export const pinText = (id: string, l?: Lang) => tr(L(l), `pinnacle.${id}.text`);
export const sigilName = (pinnacle: string, l?: Lang) => tr(L(l), `pinnacle.${pinnacle}.sigil`);
export const ascName = (id: string, l?: Lang) => tr(L(l), `asc.${id}.name`);
export const ascBlurb = (id: string, l?: Lang) => tr(L(l), `asc.${id}.blurb`);
export const ascNodeName = (id: string, l?: Lang) => tr(L(l), `ascnode.${id}.name`);
export const nodeName = (n: Pick<PassiveNode, "name">, l?: Lang) => tr(L(l), `node.${slug(n.name)}`);
export const keystoneText = (name: string, l?: Lang) => tr(L(l), `keystone.${slug(name)}`);
export const presetName = (id: string, l?: Lang) => tr(L(l), `preset.${id}.name`);
export const presetBlurb = (id: string, l?: Lang) => tr(L(l), `preset.${id}.blurb`);
export const groupName = (group: string, l?: Lang) => tr(L(l), `group.${group}`);
export const tagName = (tag: string, l?: Lang) => tr(L(l), `tag.${tag}`);
/** "Radiant Ruby" / "Сияющий рубин": a pouch key ("ruby:4") by name. */
export function stoneFullName(key: string, l?: Lang): string {
    const [id, t] = key.split(":");
    const lg = L(l), name = tr(lg, `stone.${id}.name`);
    return tr(lg, "stone.full", { tier: tr(lg, `stone.tier${t}`), name: lg === "en" ? name : lowFirst(name) });
}
export const stoneKindName = (id: string, l?: Lang) => tr(L(l), `stone.${id}.name`);
/** What a stone does in a place, its value filled in. */
export function stoneEffectText(key: string, place: "weapon" | "armour" | "jewel", value: number, l?: Lang): string {
    const [id] = key.split(":");
    return tr(L(l), `stone.${id}.${place}`, { 0: value });
}
export const echoWho = (id: string, l?: Lang) => tr(L(l), `echo.${id}.who`);
export const echoText = (id: string, l?: Lang) => tr(L(l), `echo.${id}.text`);
export const perkName = (id: string, l?: Lang) => tr(L(l), `perk.${id}.name`);
export const featName = (id: string, l?: Lang) => tr(L(l), `feat.${id}.name`);
export const omenName = (id: string, l?: Lang) => tr(L(l), `omen.${id}.name`);
export const omenText = (id: string, l?: Lang) => tr(L(l), `omen.${id}.text`);
/** What a feat asks, its goal filled in ("Slay 10k monsters"). */
export const featText = (id: string, l?: Lang) => tr(L(l), `feat.${id}.text`, { n: goalText(FEATS[id]?.goal ?? 0) });
/** Round goals read short: 10000 -> 10k, 1000000 -> 1M. */
export const goalText = (n: number) => (n >= 1e6 && n % 1e6 === 0 ? `${n / 1e6}M` : n >= 1e4 && n % 1e3 === 0 ? `${n / 1e3}k` : String(n));
export const perkText = (id: string, l?: Lang) => tr(L(l), `perk.${id}.text`);
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
/** "Dawn II". */
export const dawnTitle = (n: number, l?: Lang) => tr(L(l), "dawn.name", { n: ROMAN[n] ?? String(n) });

/** "Outskirts", "Tier 5", "Depth 3". */
export function tierName(tier: number, l?: Lang): string {
    const lg = L(l);
    return tier === 0 ? tr(lg, "tier.outskirts") : tier <= MAX_TIER ? tr(lg, "tier.tier", { n: tier }) : tr(lg, "tier.depth", { n: tier - MAX_TIER });
}

/** "Salt Flats (Tier 3)". */
export const mapLabel = (m: { tier: number; area: string }, l?: Lang) => tr(L(l), "map.label", { area: MAP_AREAS[m.area] ? mapAreaName(m.area, l) : m.area, tier: tierName(m.tier, l) });

/** A run's place: a map ("Salt Flats - Tier 3"), a pinnacle, or a story zone. */
export function runMapName(m: RunMap, l?: Lang): string {
    if (m.pinnacle) return pinName(m.pinnacle, l);
    return tr(L(l), "map.zone", { area: mapAreaName(MAP_AREAS[m.area] ? m.area : "cinderfield", l), tier: tierName(m.tier, l) });
}

/** Where the hero is right now, by name. */
export function placeName(s: GameState, l?: Lang): string {
    const run = s.activity.run;
    if (run?.map) return runMapName(run.map, l);
    return zoneName(run?.zone ?? s.activity.zone, l);
}

// ---- items -------------------------------------------------------------------

/** A rare's two-word name ("Grim Bite"), in the language's word order and words. */
export function rareName(name: string, l?: Lang): string {
    const lg = L(l);
    if (lg === "en") return name;
    const [a, b, ...rest] = name.split(" ");
    if (!a || !b || rest.length || !RARE_NAMES_A.includes(a) || !RARE_NAMES_B.includes(b)) return name;
    return tr(lg, "item.rareName", { a: tr(lg, `rare.a.${slug(a)}`), b: tr(lg, `rare.b.${slug(b)}`) });
}

/** An enchanted item's name from its base and first prefix and suffix; the prefix agrees with the base noun. */
function enchantedName(base: string, prefix: string, suffix: string, lg: Lang): string {
    const b = baseName(base, lg);
    const p = prefix && AFFIXES[prefix] ? form(tr(lg, `affix.${prefix}.label`), genderOf(base, lg)) : "";
    const s = suffix && AFFIXES[suffix] ? tr(lg, `affix.${suffix}.label`) : "";
    return [p, p && lg !== "en" ? lowFirst(b) : b, s].filter(Boolean).join(" ");
}

/** What an item is called: its relic name, its rare name, its affixes and base, or its base. */
export function itemName(item: Item, l?: Lang): string {
    const lg = L(l);
    if (item.relic && RELICS[item.relic]) return relicName(item.relic, lg);
    if (item.rarity === "rare" && item.name) return rareName(item.name, lg);
    if (item.rarity === "enchanted") {
        const p = item.affixes.find(a => affixOf(a).type === "prefix")?.id ?? "";
        const s = item.affixes.find(a => affixOf(a).type === "suffix")?.id ?? "";
        return enchantedName(item.base, p, s, lg);
    }
    return baseName(item.base, lg);
}

/** One affix roll as a line: "+12% fire resistance". */
export function affixLine(a: AffixRoll, l?: Lang): string {
    const params: Params = {};
    a.rolls.forEach((v, i) => { params[i] = v; });
    return fill(tr(L(l), `affix.${a.id}.text`).replace(/\{(\d)\}/g, (m, i: string) => (params[i] === undefined ? "?" : m)), params);
}

/** An affix as the bench lists it, rolls as "#". */
export const affixTemplate = (id: string, l?: Lang) => tr(L(l), `affix.${id}.text`).replace(/\{\d\}/g, "#");

/** A relic's modifier lines with its rolls. */
export function relicLines(item: Item, l?: Lang): string[] {
    const def = item.relic ? RELICS[item.relic] : undefined;
    if (!def) return [];
    return def.mods.map((m, i) => tr(L(l), `relic.${def.id}.mod${i}`, { 0: item.relicRolls?.[i] ?? m.range[0] }));
}

/** A companion's bonus at a level: "4% increased armour". */
export function companionBonus(id: string, level: number, l?: Lang): string {
    const m = companionMod(id, level);
    return m && COMPANIONS[id] ? tr(L(l), `companion.${id}.bonus`, { 0: m.value }) : "";
}

// ---- modifiers -----------------------------------------------------------------

/** A modifier as a line: "12% increased armour", "+40 accuracy", "30% more damage (melee)". */
export function modLine(m: Mod, l?: Lang): string {
    const lg = L(l);
    const [nom, gen = nom] = tr(lg, `stat.${m.stat}`).split("|") as [string, string?];
    const v = Math.abs(m.value);
    let s: string;
    if (m.kind === "inc") s = tr(lg, m.value >= 0 ? "mod.inc" : "mod.red", { v, stat: gen });
    else if (m.kind === "more") s = tr(lg, m.value >= 0 ? "mod.more" : "mod.less", { v, stat: gen });
    else s = tr(lg, "mod.flat", { v: `${m.value >= 0 ? "+" : ""}${m.value}${PCT_STATS.has(m.stat) ? "%" : ""}`, stat: nom });
    const tags = m.tags?.length ? ` (${m.tags.map(x => tagName(x, lg)).join(", ")})` : "";
    return capFirst(s + tags);
}

/** What a contract asks: "Slay 1800 monsters", "Complete 40 maps of tier 5 or deeper". */
export const contractGoal = (kind: string, target: number, tier: number | undefined, l?: Lang) => trn(L(l), `contract.${kind}`, target, { tier: tier ?? 1 });

// ---- time ----------------------------------------------------------------------

/** "2d 3h", "1h 5m", "12m", "40s" in the language's units. */
export function fmtDuration(ms: number, l?: Lang): string {
    const lg = L(l);
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    if (d) return tr(lg, "time.dh", { d, h });
    if (h) return tr(lg, "time.hm", { h, m });
    if (m) return tr(lg, "time.m", { m });
    return tr(lg, "time.s", { s });
}

// ---- log entries -----------------------------------------------------------------

/** A log parameter: content references become names, other values stay. */
export function resolveParam(v: string | number, l?: Lang): string | number {
    if (typeof v !== "string" || v[0] !== "@") return v;
    const lg = L(l);
    const i = v.indexOf(":");
    const kind = v.slice(1, i), rest = v.slice(i + 1);
    switch (kind) {
        case "zone": return zoneName(rest, lg);
        case "monster": return monsterName(rest, lg);
        case "companion": return companionName(rest, lg);
        case "pin": return pinName(rest, lg);
        case "sigil": return sigilName(rest, lg);
        case "tier": return tierName(Number(rest), lg);
        case "base": return baseName(rest, lg);
        case "relic": return relicName(rest, lg);
        case "skill": return skillName(rest, lg);
        case "support": return supportName(rest, lg);
        case "feat": return featName(rest, lg);
        case "omen": return omenName(rest, lg);
        case "list": return rest.split(",").map(x => resolveParam(`@${x}`, lg)).join(tr(lg, "common.list"));
        case "key": return tr(lg, rest);
        case "map": {
            const [area = "", tier = "0", pin = ""] = rest.split(":");
            return runMapName({ area, tier: Number(tier), level: 0, mods: [], ...(pin ? { pinnacle: pin } : {}) }, lg);
        }
        case "contract": {
            const [k = "kills", target = "0", tier = "1"] = rest.split(":");
            return contractGoal(k, Number(target), Number(tier), lg);
        }
        case "item": {
            const [base = "", rarity = "plain", p = "", s = "", relic = "", ...name] = rest.split(":");
            if (relic && RELICS[relic]) return relicName(relic, lg);
            if (rarity === "rare" && name.length) return rareName(name.join(":"), lg);
            if (rarity === "enchanted") return enchantedName(base, p, s, lg);
            return baseName(base, lg);
        }
        default: return v;
    }
}

export function resolveParams(params: Params | undefined, l?: Lang): Params | undefined {
    if (!params) return params;
    const out: Params = {};
    for (const [k, v] of Object.entries(params)) out[k] = resolveParam(v, l);
    return out;
}

/** A log line from its key and params (a count `n` picks the plural form when the string has forms). */
export function logLine(key: string, params: Params | undefined, l?: Lang): string {
    const lg = L(l);
    const p = resolveParams(params, lg);
    return typeof params?.n === "number" && tr(lg, key).includes("|") ? trn(lg, key, params.n, p) : tr(lg, key, p);
}

/** A log entry's line in a language: from its key when it has one, else its saved English text. */
export const logText = (e: LogEntry, l?: Lang): string => (e.key ? logLine(e.key, e.params, l) : e.text);

/** Story beats come as keys (a zone's boss text, an act's outro). */
export const storyText = (key: string, l?: Lang) => tr(L(l), key);
