// The Hero tab: the character sheet with its breakdowns, and the companions.

import { ASCENDANCIES, CLASSES, COMPANIONS, COMPANION_MAX_LEVEL, COMPANION_ORDER, DAWN_PERKS, PASSIVES, SKILLS, SUPPORTS, ZONES, bondFor, companionLevel, dawnName, xpToNext, type CompanionDef } from "../core/data";
import { setCompanion } from "../core/companions";
import { drawPumpkin } from "./gfx/pumpkin";
import { runZone } from "../core/sim/engine";
import type { Sheet } from "../core/character";
import { buildScore, codexRarity } from "../core/game";
import { itemLabel } from "../core/items";
import type { GameState } from "../core/state";
import { DAMAGE_TYPES, SLOTS, type DamageType } from "../core/types";
import { fmt, h, pct } from "./dom";
import { drawSprite, spriteOf } from "./gfx/sprites";
import { glyph } from "./glyphs";
import { portrait } from "./gfx/portrait";
import { pixText } from "./gfx/pix";
import { t, tn } from "../i18n";
import { ascName, ascNodeName, dawnTitle, featName, nodeName, className, companionBlurb, companionBonus, companionName, companionWhere, itemName, perkName, placeName, skillName, supportName, tagName } from "../i18n/names";
import { tErr } from "../i18n/errors";
import { TYPE_NAME, kv } from "./common";
import type { Ctx } from "./views";

const TYPE_COLOR: Record<DamageType, string> = { phys: "#8d8d8d", fire: "#ff5a36", cold: "#3a9bff", lightning: "#e0b800", chaos: "#8b5cf6" };

export function heroView(c: Ctx): HTMLElement {
    const s = c.sheet();
    const st = c.state;
    const hero = st.hero;
    const sk = s.skill;
    const critFactor = 1 + (sk.critChance / 100) * (sk.critMulti / 100 - 1);
    const breakdown = (stat: Parameters<Sheet["bag"]["mods"]>[0], title: string) => () => {
        const mods = s.bag.mods(stat);
        const list = h("div", { class: "kv" });
        const src = sourceNames(st);
        for (const m of mods) {
            const up = m.value >= 0;
            const v = m.kind === "flat" ? `${up ? "+" : ""}${m.value}` : t(m.kind === "more" ? (up ? "hero.more" : "hero.less") : (up ? "hero.inc" : "hero.red"), { v: Math.abs(m.value) });
            list.append(h("div", { text: m.src ? src(m.src) : "?" }), h("div", { class: "num", text: `${v}${m.tags ? " [" + m.tags.map(x => tagName(x)).join(", ") + "]" : ""}` }));
        }
        if (!mods.length) list.append(h("div", { text: t("hero.noMods") }), h("div"));
        const close = c.modal(h("div", { class: "card" }, h("h3", { text: title }), list, h("div", { style: "margin-top:8px" }, h("button", { class: "btn", text: t("common.close"), on: { click: () => close() } }))));
    };

    // Who and where: the hero in the scenery of the current zone.
    const run = st.activity.run;
    const zone = run ? runZone(st, run) : ZONES[st.activity.zone]!;
    const por = portrait(zone, hero.cls);
    por.className = "portrait";
    por.style.width = por.width * 2 + "px"; por.style.height = por.height * 2 + "px";
    const asc = hero.asc && ASCENDANCIES[hero.asc] ? ascName(hero.asc) : null;
    const xpNeed = xpToNext(hero.level);
    const xpF = isFinite(xpNeed) ? hero.xp / xpNeed : 1;
    const who = h("div", { class: "card sheet-who" },
        h("h3", { text: hero.name }),
        h("div", { class: "portrait-frame" }, por, h("div", { class: "where-tag", text: placeName(st) })),
        h("div", { class: "row", style: "gap:5px;margin-top:8px" },
            h("span", { class: "tag lv", text: t("common.level", { n: hero.level }) }), h("span", { class: "tag", text: CLASSES[hero.cls] ? className(hero.cls) : hero.cls }),
            asc ? h("span", { class: "tag asc", text: asc }) : null, st.title ? h("span", { class: "tag dawn", title: t("feats.titleTag"), text: featName(st.title) }) : null),
        h("div", { class: "xpbar", title: isFinite(xpNeed) ? t("hero.xpTitle", { xp: fmt(hero.xp), need: fmt(xpNeed) }) : t("hero.maxLevel") }, h("i", { style: `width:${(xpF * 100).toFixed(1)}%` })),
        h("div", { class: "attrs" }, ...([["might", t("attr.str"), s.str], ["grace", t("attr.dex"), s.dex], ["wit", t("attr.int"), s.int]] as const).map(([g, label, v]) =>
            h("div", { class: `attr ${g}`, title: label }, glyph(g, 18), h("b", { class: "num", text: String(v) }), h("span", { text: label })))),
        ...s.problems.map(p => h("div", { class: "tag", style: "background:var(--ember);color:#1a1410;margin-top:6px;white-space:normal", text: tErr(p) })),
    );

    // Offence: the two numbers that matter, then how they are made.
    const rate = Math.min(sk.speed, sk.sustain);
    const chip = (label: string, value: string, click?: () => void, total = false) => h(click ? "button" : "div", { class: `fchip${total ? " total" : ""}`, on: click ? { click } : {} }, h("span", { text: label }), h("b", { class: "num", text: value }));
    const op = (t: string) => h("span", { class: "fop", text: t });
    const formula = h("div", { class: "formula" },
        chip(t("hero.hit"), fmt(sk.avgHit), breakdown("damage", t("hero.bdDamage"))), op("x"),
        chip(t("hero.crit"), critFactor.toFixed(2), breakdown("critChance", t("hero.bdCrit"))), op("x"),
        chip(sk.kind === "attack" ? t("hero.attacks") : t("hero.casts"), t("hero.perSec", { n: rate.toFixed(2) }), breakdown(sk.kind === "attack" ? "attackSpeed" : "castSpeed", t("hero.bdSpeed"))),
        ...(sk.kind === "attack" ? [op("x"), chip(t("hero.hitChance"), pct(sk.hitChance), breakdown("accuracy", t("hero.bdAccuracy")))] : []),
        op("="), chip(t("hero.dps"), fmt(sk.dps), undefined, true));
    const big = (label: string, value: string, colour: string, note: string) =>
        h("div", { class: "bigstat" }, pixText(value, colour, 4), h("div", null, h("b", { text: label }), h("span", { text: note })));
    const off = h("div", { class: "card" },
        h("h3", { text: t("hero.offence", { skill: skillName(sk.id) }) }),
        h("div", { class: "bigrow" }, big(t("hero.single"), fmt(sk.dps), "#ffc233", t("hero.singleNote")), big(t("hero.packs"), fmt(sk.packDps), "#ff8a5c", tn("hero.targets", sk.targets))),
        formula,
        kv([
            ...DAMAGE_TYPES.filter(d => sk.hit[d][1] > 0).map(d => [t(`dmg.${d}`), `${fmt(sk.hit[d][0])}-${fmt(sk.hit[d][1])}`] as [string, string]),
            [t("hero.critChance"), `${sk.critChance.toFixed(1)}%`, breakdown("critChance", t("hero.bdCrit"))],
            [t("hero.critMulti"), `${sk.critMulti.toFixed(0)}%`, breakdown("critMulti", t("hero.bdCritMulti"))],
            [t("hero.manaCost"), fmt(sk.manaCost)],
            ...(sk.sustain < sk.speed ? [[t("hero.manaLimited"), t("hero.perSec", { n: sk.sustain.toFixed(2) })] as [string, string]] : []),
            ...(sk.leech ? [[t("hero.leech"), `${sk.leech}%`] as [string, string]] : []),
        ]));

    // Resistances: one badge per element, red below zero, marked when over the cap.
    const RES_GLYPH = { fire: "skills", cold: "cold", lightning: "lightning", chaos: "chaos" } as const;
    const res = h("div", { class: "card" }, h("h3", { text: t("hero.resistances") }),
        h("div", { class: "resrow" }, ...(["fire", "cold", "lightning", "chaos"] as const).map(d => {
            const v = s.res[d], raw = s.resRaw[d], max = s.maxRes[d];
            return h("button", { class: `res ${d}${v < 0 ? " neg" : ""}${v >= max ? " cap" : ""}`, title: t("hero.whereTip", { name: t(`res.${d}`) }), on: { click: breakdown(`res.${d}`, t(`res.${d}`)) } },
                glyph(RES_GLYPH[d], 22), h("b", { class: "num", text: `${v}%` }), h("span", { text: raw > max ? t("hero.overCap", { n: raw }) : t("hero.max", { n: max }) }));
        })));

    // Defence: tiles with the pool and its layers; each opens its breakdown.
    const tile = (g: Parameters<typeof glyph>[0], label: string, value: string, stat: Parameters<Sheet["bag"]["mods"]>[0]) =>
        h("button", { class: `stat ${g}`, title: t("hero.whereTip", { name: label }), on: { click: breakdown(stat, label) } }, glyph(g, 18), h("b", { class: "num", text: value }), h("span", { text: label }));
    const pool = s.life + s.es;
    const def = h("div", { class: "card" },
        h("h3", { text: t("hero.defence") }),
        h("div", { class: "tiles" },
            tile("heart", t("hero.life"), fmt(s.life), "life"), tile("esorb", t("hero.es"), fmt(s.es), "energyShield"), tile("regen", t("hero.regen"), t("hero.perSec", { n: fmt(s.lifeRegen) }), "lifeRegen"),
            tile("armour", t("hero.armour"), fmt(s.armour), "armour"), tile("evasion", t("hero.evasion"), fmt(s.evasion), "evasion"), tile("block", t("hero.block"), `${s.block.toFixed(0)}%`, "block")),
        h("div", { class: "sub" }, t("hero.ehp", { n: fmt(pool) })),
        ehpBars(s),
        kv([[t("hero.move"), pct(s.moveSpeed)], [t("hero.rarity"), codexRarity(st) ? t("hero.rarityCodex", { total: s.rarity + codexRarity(st), codex: codexRarity(st) }) : `+${s.rarity}%`], [t("hero.flask"), pct(s.flaskHeal)], [t("hero.score"), fmt(buildScore(s))]]));

    return h("div", { class: "sheet" }, h("div", { class: "col", style: "gap:14px" }, who, companionCard(c)), h("div", { class: "col", style: "gap:14px" }, off, res), def);
}

/** A companion's art at `size` times its atlas size (frame 0, its tint), or a "?" when the art isn't in yet. */
function petArt(def: CompanionDef, size = 1): HTMLElement {
    const fr = spriteOf(def.sprite);
    if (!fr) return h("span", { class: "q", text: "?" });
    const cv = h("canvas", { class: "petart", attrs: { width: String(fr.w), height: String(fr.h), "aria-hidden": "true" } }) as HTMLCanvasElement;
    const g = cv.getContext("2d")!;
    g.imageSmoothingEnabled = false;
    // Feet at the anchor: place it so the whole frame lands on the canvas.
    const box = drawSprite(g, def.sprite, 0, fr.f === 1 ? fr.w - fr.ax : fr.ax, fr.ay, def.tint ? { tint: def.tint, strength: def.strength ?? 0.4 } : {});
    if (box && def.overlay === "pumpkin") drawPumpkin(g, fr.w / 2, Math.round(box.y + box.h / 2 + 5), 0);
    cv.style.width = fr.w * size + "px";
    cv.style.height = fr.h * size + "px";
    return cv;
}

/** The companion at the hero's side (level, bond, bonus) and the collection; unfound ones say where they wait. */
function companionCard(c: Ctx): HTMLElement {
    const st = c.state;
    const pet = st.hero.pet;
    const owned = COMPANION_ORDER.filter(id => st.companions[id] !== undefined);
    const card = h("div", { class: "card pets" }, h("h3", { class: "split" }, h("span", { text: t("pets.title") }), h("span", { class: "num", text: t("pets.found", { n: owned.length, total: COMPANION_ORDER.length }) })));
    if (pet && COMPANIONS[pet.id]) {
        const def = COMPANIONS[pet.id]!;
        const bond = st.companions[pet.id] ?? 0;
        const max = pet.level >= COMPANION_MAX_LEVEL;
        const lo = bondFor(pet.level), hi = bondFor(pet.level + 1);
        card.append(h("div", { class: "pet-now" },
            h("div", { class: "pet-stage" }, petArt(def, 2)),
            h("div", { class: "col grow", style: "gap:4px;min-width:0" },
                h("div", { class: "row", style: "gap:6px" }, h("b", { text: companionName(def.id) }), h("span", { class: "tag lv", text: t("common.level", { n: pet.level }) })),
                h("span", { class: "pet-bonus", text: companionBonus(pet.id, pet.level) }),
                h("div", { class: "xpbar", title: max ? t("pets.fullBond") : t("pets.bond", { have: fmt(bond - lo), need: fmt(hi - lo) }) }, h("i", { style: `width:${max ? 100 : Math.min(100, ((bond - lo) / (hi - lo)) * 100).toFixed(1)}%` })),
                h("span", { class: "muted", style: "font-size:12px;font-style:italic", text: companionBlurb(def.id) }))));
    } else {
        card.append(h("div", { class: "muted", style: "font-size:12px;margin-bottom:6px", text: owned.length ? t("pets.noneOut") : t("pets.none") }));
    }
    const grid = h("div", { class: "pet-grid" });
    for (const id of COMPANION_ORDER) {
        const def = COMPANIONS[id]!;
        const has = st.companions[id] !== undefined;
        const out = pet?.id === id;
        const lvl = has ? companionLevel(st.companions[id]!) : 0;
        const name = companionName(id), where = companionWhere(id);
        const tile = h(has ? "button" : "div", { class: `pet${out ? " on" : ""}${has ? "" : " unknown"}`,
            attrs: has ? { "aria-pressed": String(out), "aria-label": t("pets.aria", { name, level: lvl }) } : { role: "img", "aria-label": t("pets.notFoundAria", { where }) },
            on: has && !out ? { click: () => c.act(s => setCompanion(s, id), t("pets.walks", { name })) } : {} },
            h("span", { class: "pic" }, has ? petArt(def, 1) : h("span", { class: "q", text: "?" })),
            h("b", { text: has ? name : t("pets.unknown") }),
            h("span", { text: has ? t(out ? "pets.lvOut" : "pets.lv", { n: lvl }) : where }));
        tile.dataset.tip = has ? t(out ? "pets.tipOut" : "pets.tipIn", { name, level: lvl, bonus: companionBonus(id, lvl) }) : t("pets.tipUnknown", { where });
        grid.append(tile);
    }
    card.append(grid);
    return card;
}

function ehpBars(s: Sheet): HTMLElement {
    const max = Math.max(...DAMAGE_TYPES.map(d => s.ehp[d]));
    const el = h("div", { class: "col", style: "gap:3px" });
    for (const d of DAMAGE_TYPES) {
        const m = h("div", { class: "meter", title: d === "phys" ? t("hero.ehpPhys") : t("hero.ehpEle") });
        m.append(h("i", { style: `width:${(s.ehp[d] / max) * 100}%;background:${TYPE_COLOR[d]}` }), h("span", { text: `${TYPE_NAME(d)} ${fmt(s.ehp[d])}` }));
        el.append(m);
    }
    return el;
}

/**
 * Stat breakdown sources are English names (a class, an attribute, a passive, a support, an item);
 * this turns them into the current language, items by what the hero wears.
 */
function sourceNames(st: GameState): (src: string) => string {
    const map = new Map<string, string>();
    const add = (en: string, local: string) => { if (!map.has(en)) map.set(en, local); };
    for (const c0 of Object.values(CLASSES)) add(c0.name, className(c0.id));
    add("Might", t("attr.str")); add("Grace", t("attr.dex")); add("Wit", t("attr.int"));
    for (const s of Object.values(SKILLS)) add(s.name, skillName(s.id));
    for (const s of Object.values(SUPPORTS)) add(s.name, supportName(s.id));
    for (const n of Object.values(PASSIVES)) add(n.name, nodeName(n));
    for (const a of Object.values(ASCENDANCIES)) for (const n of a.nodes) add(n.name, ascNodeName(n.id));
    for (const p of Object.values(COMPANIONS)) add(`Companion: ${p.name}`, `${t("pets.title")}: ${companionName(p.id)}`);
    add("Map", t("atlas.maps"));
    add("Renown", t("feats.renownName"));
    for (const p of DAWN_PERKS) add(p.name, perkName(p.id));
    for (let n = 1; n <= (st.hero.dawn?.level ?? 0); n++) add(dawnName(n), dawnTitle(n));
    for (const s of SLOTS) { const it = st.hero.equipment[s]; if (it) add(itemLabel(it), itemName(it)); }
    return src => map.get(src) ?? src;
}
