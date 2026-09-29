// Tab views. Each returns a fresh element; the app swaps it in when the view's
// signature changes, so scroll position and selection survive sim ticks.

import { ACTS, AFFIXES, ASCENDANCIES, CLASSES, COMPANIONS, COMPANION_MAX_LEVEL, COMPANION_ORDER, CURRENCIES, PASSIVES, RELICS, SKILLS, SUPPORTS, ZONES, bondFor, companionLevel, xpToNext, slotsFor, type CompanionDef } from "../core/data";
import { setCompanion } from "../core/companions";
import { runZone } from "../core/sim/engine";
import { deriveSheet, supportSlots, type Sheet } from "../core/character";
import { canEquip, equip, salvage, setSkill, setSupports, setZone, trialSheet, unequip, upgradeSlot, RARITY_RANK, buildScore, buyStashRoom, codexRarity, equipUpgrades, outdatedItems, ownedItem, setLocked, stashRoomCost, STASH_MAX, STASH_STEP } from "../core/game";
import { affixOf, baseOf, itemLabel, itemStats, levelReq, tierLabel, salvageValue, relicOf } from "../core/items";
import type { GameState } from "../core/state";
import { DAMAGE_TYPES, SLOTS, type DamageType, type Item, type Slot } from "../core/types";
import { clear, fmt, fmtDuration, h, pct } from "./dom";
import { itemIcon } from "./gfx/itemart";
import { drawSprite, loadSprites, spriteCanvas, spriteOf } from "./gfx/sprites";
import { HERO_CAST } from "./gfx/cast";
import { glyph } from "./glyphs";
import { portrait, scenery } from "./gfx/portrait";
import { pixText } from "./gfx/pix";
import { drawText } from "./gfx/pixfont";
import { modText } from "./text";
import { forgeView } from "./forge";
import { treeView } from "./tree";
import { atlasSig, atlasView } from "./atlas";
import { DEFAULT_FILTER, FILTER_PRESETS, type FilterRule } from "../core/filter";
import { claimContract, contractDust, rerollContract, rerollCost, type Contract } from "../core/contracts";
import { BLESSINGS, ORB_RESERVE, bless, blessingCost, setKeep, spareOrbValue } from "../core/shrine";
import { lang, t, tn } from "../i18n";
import { actIntro, actName, actOutro, affixLine, ascName, ascNodeName, baseName, nodeName, blessingName, blessingText, classBlurb, className, companionBlurb, companionBonus, companionName, companionWhere, contractGoal,
    currencyName, groupName, itemName, logText, placeName, presetBlurb, presetName, relicFlavour, relicLines, relicName, skillBlurb, skillName, supportBlurb, supportName, tagName, zoneName, zoneStory } from "../i18n/names";
import { tErr } from "../i18n/errors";

export interface Ctx {
    state: GameState;
    sheet(): Sheet;
    act(fn: (s: GameState) => string | null | void, ok?: string): void;
    toast(msg: string): void;
    modal(content: HTMLElement): () => void;
    sel: { uid?: number; slot?: Slot };
    /** Set while the player drags an item or reads a tooltip: the view isn't rebuilt under the mouse. */
    hold: boolean;
    rerender(): void;
    exportSave(): string;
    importSave(text: string): Promise<string | null>;
    resetGame(): void;
    storeKind: string;
}

export type ViewId = "hero" | "gear" | "forge" | "skills" | "tree" | "world" | "atlas" | "log" | "menu";
/** The tabs in rail order; labels are "nav.<id>" strings. */
export const VIEWS: { id: ViewId }[] = [
    { id: "hero" }, { id: "gear" }, { id: "forge" }, { id: "skills" }, { id: "tree" }, { id: "world" }, { id: "atlas" }, { id: "log" }, { id: "menu" },
];

/** What a view depends on; it is rebuilt when this changes (the app adds the language). */
export function viewSig(id: ViewId, c: Ctx): string {
    const s = c.state;
    switch (id) {
        case "hero": return `${s.hero.rev}:${s.hero.level}:${s.activity.run ? runZone(s, s.activity.run).name : s.activity.zone}:${Object.keys(s.companions).length}:${s.hero.pet ? Math.floor((s.companions[s.hero.pet.id] ?? 0) / 100) : -1}`;
        case "gear": return `${s.hero.rev}:${s.stash.length}:${s.stash[s.stash.length - 1]?.uid ?? 0}:${s.dust}:${c.sel.uid}:${c.sel.slot}:${gearSig(s)}`;
        case "forge": return `${s.hero.rev}:${s.stash.length}:${s.dust}:${JSON.stringify(s.currency)}:${c.sel.uid}:${s.craftSeq}:${gearSig(s)}`;
        case "skills": return `${s.hero.rev}:${s.hero.level}`;
        case "tree": return `${s.hero.rev}:${s.hero.level}:${s.dust >= 5 + s.hero.level * 2}:${s.hero.ascPoints}`;
        case "world": return `${s.activity.mode}:${s.activity.zone}:${s.world.unlocked.length}:${s.activity.autoPush}:${Object.values(s.world.clears).reduce((a, b) => a + b, 0)}:${s.contracts.list.map(x => `${x.kind}${x.n}/${x.target}`).join(",")}:${s.dust >= rerollCost(s)}:${shrineSig(s)}`;
        case "atlas": return atlasSig(c);
        case "log": return `${s.log.length}:${s.log[s.log.length - 1]?.t ?? 0}`;
        case "menu": return `${s.settings.keep}:${s.settings.autoEquip}:${s.settings.upkeep}:${JSON.stringify(s.settings.filter)}`;
    }
}

export function renderView(id: ViewId, c: Ctx): HTMLElement {
    switch (id) {
        case "hero": return heroView(c);
        case "gear": return gearView(c);
        case "forge": return forgeView(c);
        case "tree": return treeView(c);
        case "skills": return skillsView(c);
        case "world": return worldView(c);
        case "atlas": return atlasView(c);
        case "log": return logView(c);
        case "menu": return menuView(c);
    }
}

const TYPE_COLOR: Record<DamageType, string> = { phys: "#8d8d8d", fire: "#ff5a36", cold: "#3a9bff", lightning: "#e0b800", chaos: "#8b5cf6" };
const TYPE_NAME = (t0: DamageType) => t(`type.${t0}`);

function kv(rows: [string, string | HTMLElement, (() => void)?][]): HTMLElement {
    const el = h("div", { class: "kv" });
    for (const [k, v, click] of rows) {
        const key = h("div", { text: k });
        const val = typeof v === "string" ? h("div", { class: "num", text: v }) : v;
        if (click) { key.classList.add("click"); key.addEventListener("click", click); }
        el.append(key, val);
    }
    return el;
}

// ---- Hero ------------------------------------------------------------------

function heroView(c: Ctx): HTMLElement {
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
            const v = m.kind === "flat" ? `+${m.value}` : t(m.kind === "more" ? "hero.more" : "hero.inc", { v: m.value });
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
            asc ? h("span", { class: "tag asc", text: asc }) : null),
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
    drawSprite(g, def.sprite, 0, fr.f === 1 ? fr.w - fr.ax : fr.ax, fr.ay, def.tint ? { tint: def.tint, strength: def.strength ?? 0.4 } : {});
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

// ---- Gear ------------------------------------------------------------------

const SLOT_LABEL = (s: Slot) => t(`slot.${s === "ring2" ? "ring" : s}`);

function itemCell(item: Item | undefined, slot: Slot | null, selected: boolean, onClick: () => void): HTMLElement {
    const cell = h("div", { class: `cell ${item ? item.rarity : "empty"}${selected ? " sel" : ""}`,
        attrs: { "aria-label": item ? itemName(item) : slot ? t("gear.slotEmpty", { slot: SLOT_LABEL(slot) }) : t("gear.empty"), ...(item || slot ? { role: "button", tabindex: "0" } : {}), ...(selected ? { "aria-pressed": "true" } : {}) }, on: { click: onClick } });
    if (item) cell.append(itemIcon(item));
    if (slot) { cell.dataset.slot = slot; cell.append(h("span", { class: "lbl", text: SLOT_LABEL(slot) })); }
    return cell;
}

// ---- Tooltips and drag and drop (gear) -------------------------------------

let tipEl: HTMLElement | null = null;
function hideTip(): void { tipEl?.remove(); tipEl = null; }
/** A floating card next to `anchor`, inside the scrolling view; flips left when there's no room. */
function showTip(anchor: HTMLElement, content: HTMLElement): void {
    hideTip();
    const body = anchor.closest(".body") as HTMLElement | null;
    if (!body || !anchor.isConnected) return;
    tipEl = h("div", { class: "tip", attrs: { role: "tooltip" } }, content);
    body.append(tipEl);
    placeBeside(tipEl, anchor, body);
}
export function withTip(cell: HTMLElement, c: Ctx, make: () => HTMLElement): void {
    let t: number | null = null;
    const show = () => { c.hold = true; t = window.setTimeout(() => { if (!drag && !cell.classList.contains("sel")) showTip(cell, make()); }, 130); };
    const hide = () => { if (t !== null) clearTimeout(t); hideTip(); if (!drag) c.hold = false; };
    cell.addEventListener("mouseenter", show);
    cell.addEventListener("mouseleave", hide);
    // Keyboard players get the same card when a slot takes focus.
    cell.addEventListener("focus", () => { if (cell.matches(":focus-visible")) show(); });
    cell.addEventListener("blur", hide);
}

/** What is being dragged right now: a stash item (uid) or an equipped slot. */
let drag: { uid?: number; slot?: Slot } | null = null;

export function itemCard(item: Item, c: Ctx | null, opts: { compareSlot?: Slot | null } = {}): HTMLElement {
    const b = baseOf(item);
    const st = itemStats(item);
    const card = h("div", { class: "card item" }, h("div", { class: `name ${item.rarity}`, text: itemName(item) }));
    const lines: string[] = [];
    if (item.rarity === "rare" || item.rarity === "relic") lines.push(baseName(b.id));
    card.append(h("div", { class: "muted", text: `${[...lines, b.kind === b.slot ? "" : t(`kind.${b.kind}`)].filter(Boolean).join(" - ")}  ${t("item.levels", { ilvl: item.ilvl, req: levelReq(item) })}` }));
    if (item.quality || item.locked) card.append(h("div", { class: "row", style: "gap:4px;margin-top:3px" },
        item.quality ? h("span", { class: "tag q", text: t("item.quality", { n: item.quality }) }) : null,
        item.locked ? h("span", { class: "tag lk" }, glyph("lock", 9), " " + t("item.locked")) : null));
    if (st.weapon) {
        const w = st.weapon;
        const rows: [string, string][] = [[t("item.physical"), `${w.phys[0]}-${w.phys[1]}`]];
        for (const [d, r] of Object.entries(w.added)) rows.push([TYPE_NAME(d as DamageType), `${r![0]}-${r![1]}`]);
        rows.push([t("item.aps"), w.aps.toFixed(2)], [t("item.crit"), `${w.crit.toFixed(1)}%`], [t("item.hands"), String(w.hands)]);
        card.append(kv(rows));
    }
    if (st.defence) {
        const d = st.defence;
        const rows: [string, string][] = [];
        if (d.armour) rows.push([t("item.armour"), String(d.armour)]);
        if (d.evasion) rows.push([t("item.evasion"), String(d.evasion)]);
        if (d.energyShield) rows.push([t("item.es"), String(d.energyShield)]);
        if (d.block) rows.push([t("item.block"), `${d.block}%`]);
        card.append(kv(rows));
    }
    if (b.implicit?.length) {
        card.append(h("hr"));
        for (const m of b.implicit) card.append(h("div", { class: "aff", text: modText(m) }));
    }
    if (item.affixes.length) {
        card.append(h("hr"));
        const sorted = [...item.affixes].sort((a, z) => (affixOf(a).type === affixOf(z).type ? 0 : affixOf(a).type === "prefix" ? -1 : 1));
        for (const a of sorted) card.append(h("div", { class: `aff${a.bench ? " bench" : ""}`, title: a.bench ? t("item.benchTip") : "" }, affixLine(a),
            h("b", { text: `${a.bench ? t("item.bench") + " " : ""}${t(affixOf(a).type === "prefix" ? "item.prefix" : "item.suffix")} ${t("item.tier", { n: tierLabel(a) })}` })));
    }
    const relic = relicOf(item);
    if (relic) {
        card.append(h("hr"));
        for (const l of relicLines(item)) card.append(h("div", { class: "aff", text: l }));
        card.append(h("div", { class: "muted", style: "font-style:italic;margin-top:4px", text: relicFlavour(relic.id) }));
    }
    if (c && opts.compareSlot !== undefined) {
        const slot = opts.compareSlot ?? slotsFor(b).find(s => !c.state.hero.equipment[s]) ?? slotsFor(b)[0]!;
        const trial = trialSheet(c.state, item, slot);
        if (trial) {
            card.append(h("hr"), compareRows(c.sheet(), trial));
        } else {
            card.append(h("hr"), h("div", { class: "down", text: tErr(canEquip(c.state, item, slot) ?? t("item.cantEquip")) }));
        }
    }
    return card;
}

function compareRows(now: Sheet, next: Sheet): HTMLElement {
    const rows: [string, number, number][] = [
        [t("cmp.dps"), now.skill.dps, next.skill.dps], [t("cmp.packDps"), now.skill.packDps, next.skill.packDps],
        [t("cmp.life"), now.life, next.life], [t("cmp.es"), now.es, next.es],
        [t("cmp.ehpPhys"), now.ehp.phys, next.ehp.phys],
        [t("cmp.ehpEle"), (now.ehp.fire + now.ehp.cold + now.ehp.lightning) / 3, (next.ehp.fire + next.ehp.cold + next.ehp.lightning) / 3],
    ];
    const el = h("div", { class: "kv" });
    for (const [k, a, b] of rows) {
        if (Math.abs(b - a) < 0.005 * Math.max(1, a)) continue;
        const d = b - a;
        el.append(h("div", { text: k }), h("div", { class: `num ${d > 0 ? "up" : "down"}`, text: `${d > 0 ? "+" : ""}${fmt(d)} (${a > 0 ? (d > 0 ? "+" : "") + ((d / a) * 100).toFixed(0) + "%" : t("cmp.new")})` }));
    }
    const sa = buildScore(now), sb = buildScore(next);
    el.append(h("div", { text: t("cmp.score") }), h("div", { class: `num ${sb >= sa ? "up" : "down"}`, text: `${sb >= sa ? "+" : ""}${sa > 0 ? (((sb - sa) / sa) * 100).toFixed(1) : "0"}%` }));
    return el;
}

type GearFilter = "all" | "upgrades" | "weapons" | "armour" | "jewellery" | "relics";
type GearSort = "rarity" | "level" | "slot";
/** Stash view options and marked items: kept for the session, not saved. */
const gearOpts: { filter: GearFilter; sort: GearSort; marks: Set<number> } = { filter: "all", sort: "rarity", marks: new Set() };
const SLOT_GROUP: Record<string, GearFilter> = { weapon: "weapons", offhand: "weapons", helmet: "armour", body: "armour", gloves: "armour", boots: "armour", belt: "jewellery", amulet: "jewellery", ring: "jewellery" };
const SLOT_ORDER = ["weapon", "offhand", "helmet", "body", "gloves", "boots", "belt", "amulet", "ring"];

/** What the gear view depends on beyond the hero: locks and marks change no counts. */
export function gearSig(s: GameState): string {
    let locks = 0;
    for (const x of s.stash) if (x.locked) locks++;
    for (const x of s.relics) if (x.locked) locks++;
    for (const k of SLOTS) if (s.hero.equipment[k]?.locked) locks++;
    return `${s.stashCap}:${s.relics.length}:${s.relics[s.relics.length - 1]?.uid ?? 0}:${locks}:${gearOpts.marks.size}:${Object.keys(s.codex).length}:${s.settings.upkeep}:${s.stashFull ?? false}`;
}

/** Upgrade checks cost a stat sheet each: remembered until the hero's sheet changes. */
let upgradeCache = { rev: -1, level: -1, map: new Map<number, Slot | null>() };
function upgradeOf(st: GameState, item: Item): Slot | null {
    if (upgradeCache.rev !== st.hero.rev || upgradeCache.level !== st.hero.level) upgradeCache = { rev: st.hero.rev, level: st.hero.level, map: new Map() };
    let v = upgradeCache.map.get(item.uid);
    if (v === undefined) { v = upgradeSlot(st, item); upgradeCache.map.set(item.uid, v); }
    return v;
}

function chips<T extends string>(opts: [T, string, number?][], cur: T, pick: (v: T) => void): HTMLElement {
    const el = h("div", { class: "chips", attrs: { role: "radiogroup" } });
    for (const [v, label, n] of opts) {
        el.append(h("button", { class: `chip${v === cur ? " on" : ""}`, attrs: { role: "radio", "aria-checked": String(v === cur) }, on: { click: () => pick(v) } },
            label, n !== undefined ? h("b", { text: String(n) }) : null));
    }
    return el;
}

/** A small lock in the cell's corner. */
const lockBadge = () => h("span", { class: "lockb", attrs: { "aria-hidden": "true" } }, glyph("lock", 9));

/** Marks a cell as an item the hero is wearing: a gold frame and a "worn" tag (Gear lists, the codex, the Forge rack). */
export function markWorn(cell: HTMLElement, slot?: Slot): HTMLElement {
    cell.classList.add("wornc");
    cell.append(h("span", { class: "worn", text: t("gear.worn") }));
    const label = cell.getAttribute("aria-label") ?? "";
    cell.setAttribute("aria-label", slot ? t("gear.wornAriaSlot", { label, slot: SLOT_LABEL(slot).toLowerCase() }) : t("gear.wornAria", { label }));
    return cell;
}

/** A label across the whole item grid ("Worn", "Stash"). */
const gridSep = (text: string) => h("div", { class: "gridsep", text });

function gearView(c: Ctx): HTMLElement {
    const st = c.state;
    const eq = st.hero.equipment;
    hideTip(); drag = null; c.hold = false;
    const root = h("div", { class: "gear" });
    const endDrag = () => { drag = null; c.hold = false; root.classList.remove("dragging"); root.querySelectorAll(".drop-ok, .over").forEach(e => e.classList.remove("drop-ok", "over")); };
    // Marks only mean something for items still in the stash.
    for (const uid of [...gearOpts.marks]) if (!st.stash.some(x => x.uid === uid)) gearOpts.marks.delete(uid);

    // Paper doll: the hero in the middle, the ten slots around them.
    const doll = h("div", { class: "doll" });
    const hc = HERO_CAST[st.hero.cls];
    const fig = h("div", { class: "fig" });
    const art = hc ? spriteCanvas(hc.idle) : null;
    if (art) { art.className = "figart"; art.style.width = art.width * 3 + "px"; art.style.height = art.height * 3 + "px"; fig.append(art); }
    doll.append(fig);
    const wb = eq.weapon ? baseOf(eq.weapon) : null;
    for (const s of SLOTS) {
        const it = eq[s];
        const cell = itemCell(it, s, c.sel.slot === s && c.sel.uid === undefined, () => { c.sel = { slot: s }; c.rerender(); });
        // An empty off-hand says why when the weapon decides what fits there.
        if (s === "offhand" && !it && wb?.weapon?.hands === 2) {
            const bow = wb.kind === "bow";
            cell.classList.add(bow ? "only" : "blocked");
            cell.querySelector(".lbl")!.textContent = bow ? t("gear.quiverOnly") : t("gear.twoHand");
            cell.title = bow ? t("gear.quiverTip") : t("gear.twoHandTip", { base: baseName(wb.id) });
            cell.setAttribute("aria-label", t("gear.offhandAria", { why: cell.title }));
            if (!bow) cell.tabIndex = -1; // nothing can go there: not a stop for the keyboard
        }
        // Hover a slot: the stash items that fit it light up, the rest fade.
        cell.addEventListener("mouseenter", () => {
            if (drag) return;
            root.classList.add("slotpick");
            for (const el of root.querySelectorAll<HTMLElement>(".stash .cell[data-uid]")) {
                const x = ownedItem(st, Number(el.dataset.uid));
                el.classList.toggle("fits", !!x && slotsFor(baseOf(x)).includes(s));
            }
        });
        cell.addEventListener("mouseleave", () => { root.classList.remove("slotpick"); root.querySelectorAll(".fits").forEach(e => e.classList.remove("fits")); });
        if (it) {
            if (it.locked) cell.append(lockBadge());
            withTip(cell, c, () => itemCard(it, c));
            cell.draggable = true;
            cell.addEventListener("dragstart", e => { drag = { slot: s }; c.hold = true; hideTip(); root.classList.add("dragging"); e.dataTransfer?.setData("text/plain", "slot:" + s); if (e.dataTransfer) e.dataTransfer.effectAllowed = "move"; });
            cell.addEventListener("dragend", endDrag);
        }
        // Drop a stash or relic-case item on a slot it fits.
        cell.addEventListener("dragover", e => {
            const it2 = drag?.uid !== undefined ? ownedItem(st, drag.uid) : undefined;
            if (it2 && slotsFor(baseOf(it2)).includes(s) && !canEquip(st, it2, s)) { e.preventDefault(); cell.classList.add("over"); }
        });
        cell.addEventListener("dragleave", () => cell.classList.remove("over"));
        cell.addEventListener("drop", e => {
            e.preventDefault();
            const uid = drag?.uid;
            endDrag();
            if (uid !== undefined) c.act(x => { const err = equip(x, uid, s); if (!err) c.sel = { slot: s }; return err; });
        });
        doll.append(cell);
    }

    /** A stash or relic-case cell: select, shift-click to mark (stash), hover to compare, drag to a slot or the anvil. */
    const ownedCell = (it: Item, markable: boolean): HTMLElement => {
        const cell = itemCell(it, null, c.sel.uid === it.uid, () => { c.sel = { uid: it.uid }; c.rerender(); });
        if (markable) {
            cell.addEventListener("click", e => {
                if (!e.shiftKey && !e.ctrlKey && !e.metaKey) return;
                e.stopImmediatePropagation();
                if (it.locked) { c.toast(t("gear.noMarkLocked")); return; }
                if (gearOpts.marks.has(it.uid)) gearOpts.marks.delete(it.uid); else gearOpts.marks.add(it.uid);
                c.rerender();
            }, { capture: true });
            if (gearOpts.marks.has(it.uid)) cell.classList.add("mark");
        }
        cell.dataset.uid = String(it.uid);
        // Hover a stash item: the worn piece it would replace glows on the doll.
        cell.addEventListener("mouseenter", () => {
            if (drag) return;
            const targets = slotsFor(baseOf(it));
            const cmp = upgradeOf(st, it) ?? targets.find(t => !eq[t]) ?? targets[0]!;
            root.querySelector(`.doll [data-slot="${cmp}"]`)?.classList.add("cmp");
        });
        cell.addEventListener("mouseleave", () => root.querySelectorAll(".doll .cmp").forEach(e => e.classList.remove("cmp")));
        if (it.locked) cell.append(lockBadge());
        if (upgradeOf(st, it)) cell.classList.add("upg");
        else if (levelReq(it) > st.hero.level) cell.classList.add("req");
        // Hover: the item with what it would change, next to what it would replace.
        withTip(cell, c, () => {
            const targets = slotsFor(baseOf(it));
            const cmp = upgradeOf(st, it) ?? targets.find(t => !eq[t]) ?? targets[0]!;
            const worn = eq[cmp];
            return h("div", { class: "tipcols" }, itemCard(it, c, { compareSlot: cmp }),
                worn ? h("div", { class: "col", style: "gap:4px" }, h("div", { class: "tiplbl", text: t("gear.equippedLbl") }), itemCard(worn, null)) : null);
        });
        cell.draggable = true;
        cell.addEventListener("dragstart", e => {
            drag = { uid: it.uid }; c.hold = true; hideTip(); root.classList.add("dragging");
            for (const t of slotsFor(baseOf(it))) if (!canEquip(st, it, t)) root.querySelector(`.doll [data-slot="${t}"]`)?.classList.add("drop-ok");
            e.dataTransfer?.setData("text/plain", "stash:" + it.uid); if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
        });
        cell.addEventListener("dragend", endDrag);
        return cell;
    };

    // Stash: filter chips with counts, a sort, and markers for upgrades and level-locked items.
    const ups = new Set(st.stash.filter(it => upgradeOf(st, it)).map(it => it.uid));
    const caseUps = st.relics.filter(it => upgradeOf(st, it)).length;
    const groupOf = (it: Item) => SLOT_GROUP[baseOf(it).slot] ?? "all";
    const count = (f: GearFilter) => f === "all" ? st.stash.length : f === "upgrades" ? ups.size : f === "relics" ? st.relics.length : st.stash.filter(it => groupOf(it) === f).length;
    const relicsTab = gearOpts.filter === "relics";
    const grid = h("div", { class: `stash${relicsTab ? " codex" : ""}` });
    if (relicsTab) {
        // The codex: every relic in level order - the case's copy, one that is worn, one only seen, or not found yet.
        const worn = new Map(SLOTS.map(s => eq[s]).filter((x): x is Item => !!x?.relic).map(x => [x.relic!, x]));
        for (const def of Object.values(RELICS).sort((a, b) => a.level - b.level || relicName(a.id).localeCompare(relicName(b.id), lang()))) {
            const own = st.relics.find(x => x.relic === def.id);
            const seen = st.codex[def.id] ?? 0;
            if (own) { grid.append(ownedCell(own, false)); continue; }
            const w = worn.get(def.id);
            if (w) {
                const ws = SLOTS.find(s => eq[s] === w)!;
                const cell = markWorn(itemCell(w, null, false, () => { c.sel = { slot: ws }; c.rerender(); }), ws);
                withTip(cell, c, () => itemCard(w, null));
                grid.append(cell);
                continue;
            }
            const ghost = h("div", { class: `cell ${seen ? "ghost" : "unknown"}`, attrs: { role: "img", "aria-label": seen ? t("gear.ghostAria", { name: relicName(def.id), n: seen }) : t("gear.unknownRelicAria") } });
            if (seen) ghost.append(itemIcon({ uid: -1, base: def.base, ilvl: def.level, rarity: "relic", affixes: [], relic: def.id }), h("span", { class: "cnt num", text: `x${seen}` }));
            else ghost.append(h("span", { class: "q", text: "?" }));
            withTip(ghost, c, () => h("div", { class: "card item" },
                h("div", { class: "name relic", text: seen ? relicName(def.id) : t("gear.unknownRelic") }),
                h("div", { class: "muted", text: seen ? tn("gear.foundTimes", seen) : t("gear.dropsFrom", { n: def.level }) }),
                seen ? h("div", { class: "muted", style: "font-style:italic;margin-top:4px", text: relicFlavour(def.id) }) : null));
            grid.append(ghost);
        }
    } else {
        const shown = st.stash.filter(it => gearOpts.filter === "all" || (gearOpts.filter === "upgrades" ? ups.has(it.uid) : groupOf(it) === gearOpts.filter));
        const byRarity = (a: Item, b: Item) => RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity] || b.ilvl - a.ilvl;
        shown.sort(gearOpts.sort === "level" ? (a, b) => b.ilvl - a.ilvl || byRarity(a, b)
            : gearOpts.sort === "slot" ? (a, b) => SLOT_ORDER.indexOf(baseOf(a).slot) - SLOT_ORDER.indexOf(baseOf(b).slot) || byRarity(a, b)
            : byRarity);
        // A group (weapons, armour, jewellery) shows what is worn in it first, framed in gold, to compare at a glance.
        const grouped = gearOpts.filter !== "all" && gearOpts.filter !== "upgrades";
        const worn = grouped ? SLOTS.filter(s => eq[s] && groupOf(eq[s]!) === gearOpts.filter) : [];
        if (worn.length) {
            grid.append(gridSep(t("gear.wornSep")));
            for (const s of worn) {
                const w = eq[s]!;
                const cell = markWorn(itemCell(w, null, c.sel.slot === s && c.sel.uid === undefined, () => { c.sel = { slot: s }; c.rerender(); }), s);
                if (w.locked) cell.append(lockBadge());
                withTip(cell, c, () => itemCard(w, c));
                grid.append(cell);
            }
            grid.append(gridSep(t("gear.inStash", { n: shown.length })));
        }
        for (const it of shown) grid.append(ownedCell(it, true));
        if (gearOpts.filter === "all") for (let i = st.stash.length; i < st.stashCap; i++) grid.append(h("div", { class: "cell empty" }));
        if (!st.stash.length) grid.prepend(h("div", { class: "muted stash-note", text: t("gear.stashEmpty") }));
        else if (!shown.length) grid.append(h("div", { class: "muted", style: "grid-column:1/-1;padding:6px 0", text: gearOpts.filter === "upgrades" ? t("gear.noUpgrades") : t("gear.noneHere") }));
    }
    // Drop an equipped item anywhere on the stash to take it off.
    grid.addEventListener("dragover", e => { if (drag?.slot) { e.preventDefault(); grid.classList.add("over"); } });
    grid.addEventListener("dragleave", () => grid.classList.remove("over"));
    grid.addEventListener("drop", e => { e.preventDefault(); const s = drag?.slot; endDrag(); if (s) c.act(x => unequip(x, s)); });

    const sort = h("select", { attrs: { "aria-label": t("gear.sortAria") } });
    for (const [v, label] of [["rarity", t("gear.sortRarity")], ["level", t("gear.sortLevel")], ["slot", t("gear.sortSlot")]] as const) {
        const o = h("option", { text: label, attrs: { value: v } });
        if (gearOpts.sort === v) o.selected = true;
        sort.append(o);
    }
    sort.addEventListener("change", () => { gearOpts.sort = sort.value as GearSort; c.rerender(); });
    const full = st.stash.length >= st.stashCap;
    const room = stashRoomCost(st);
    const roomBtn = room === null ? null : h("button", { class: "btn alt small", text: t("gear.roomBtn", { n: STASH_STEP }), attrs: st.dust >= room ? {} : { disabled: "" },
        title: t("gear.roomTip", { cost: fmt(room), max: STASH_MAX }), on: { click: () => c.act(buyStashRoom, t("gear.roomToast", { n: st.stashCap + STASH_STEP })) } });
    const found = Object.keys(st.codex).length, total = Object.keys(RELICS).length;
    const head = relicsTab
        ? h("h3", { class: "split" }, h("span", { text: t("gear.codex") }), h("span", { class: "num", title: t("gear.codexTip"), text: t("gear.codexCount", { found, total, n: codexRarity(st) }) }))
        : h("h3", { class: "split" }, h("span", { text: t("gear.stash") }), h("span", { class: "row", style: "gap:6px" }, roomBtn, h("span", { class: `num${full ? " full" : ""}`, text: `${st.stash.length} / ${st.stashCap}` })));
    const note = relicsTab
        ? h("div", { class: "muted", style: "font-size:12px;margin-bottom:8px", text: t("gear.caseNote") })
        : st.stashFull ? h("div", { class: "warnbar", attrs: { role: "status" } }, glyph("forge", 14),
            h("span", { text: st.settings.upkeep ? t("gear.fullUpkeep") : t("gear.fullNoUpkeep") }))
        : full && st.settings.upkeep ? h("div", { class: "note", style: "margin-bottom:8px" }, glyph("forge", 14),
            h("span", { text: t("gear.fullNote") })) : null;
    const stashCard = h("div", { class: "card" }, head, note,
        h("div", { class: "row", style: "margin-bottom:8px;justify-content:space-between" },
            chips<GearFilter>((["all", "upgrades", "weapons", "armour", "jewellery", "relics"] as const).map(f => [f, t(`gear.${f}`), count(f)] as [GearFilter, string, number]),
                gearOpts.filter, v => { gearOpts.filter = v; c.sel = {}; c.rerender(); }),
            relicsTab ? null : sort),
        grid);

    // Bulk tools: salvage by kind, by age or by mark; wear every upgrade.
    const free = (xs: Item[]) => xs.filter(x => !x.locked);
    const plain = free(st.stash.filter(x => x.rarity === "plain")), ench = free(st.stash.filter(x => x.rarity === "enchanted"));
    const old = outdatedItems(st);
    const marked = st.stash.filter(x => gearOpts.marks.has(x.uid));
    const bulk = (label: string, xs: Item[], title: string, key?: string) => h("button", { class: "btn alt small", text: t("common.count", { label, n: xs.length }), title,
        attrs: { ...(xs.length ? {} : { disabled: "" }), ...(key ? { "data-key": key } : {}) },
        on: { click: () => c.act(s => { const n = salvage(s, xs.map(x => x.uid)); for (const x of xs) gearOpts.marks.delete(x.uid); c.sel = {}; c.toast(t("gear.salvaged", { n })); }) } });
    const anvil = h("div", { class: "anvil", title: t("gear.anvilTip"), attrs: { "aria-label": t("gear.anvilAria") } }, glyph("forge", 18), h("span", { text: t("gear.salvage") }));
    anvil.addEventListener("dragover", e => { if (drag?.uid !== undefined) { e.preventDefault(); anvil.classList.add("over"); } });
    anvil.addEventListener("dragleave", () => anvil.classList.remove("over"));
    anvil.addEventListener("drop", e => { e.preventDefault(); const uid = drag?.uid; endDrag(); if (uid !== undefined) c.act(x => { if (!salvage(x, [uid])) return t("gear.lockedNoSalvage"); c.sel = {}; }); });
    const upCount = ups.size + caseUps;
    const tools = h("div", { class: "row tools" },
        anvil,
        h("span", { class: "tag", style: "background:var(--gold);color:#1a1410", text: t("gear.dust", { n: fmt(st.dust) }) }),
        h("button", { class: "btn small", text: t("gear.equipUps", { n: upCount }), title: t("gear.equipUpsTip"), attrs: upCount ? {} : { disabled: "" },
            on: { click: () => c.act(s => { const n = equipUpgrades(s); c.toast(n ? tn("gear.equippedN", n) : t("gear.nothingToEquip")); }) } }),
        bulk(t("gear.salvageOutdated"), old, t("gear.salvageOutdatedTip")),
        bulk(t("gear.salvagePlain"), plain, t("gear.salvagePlainTip")),
        bulk(t("gear.salvageEnchanted"), ench, t("gear.salvageEnchantedTip")),
        marked.length ? bulk(t("gear.salvageMarked"), marked, t("gear.salvageMarkedTip")) : null,
        marked.length ? h("button", { class: "btn alt small", text: t("gear.clearMarks"), on: { click: () => { gearOpts.marks.clear(); c.rerender(); } } }) : null,
    );

    // The picked item: its card pinned beside its slot, with what it would change and its actions.
    const selItem = c.sel.uid !== undefined ? ownedItem(st, c.sel.uid) : undefined;
    const selSlot = c.sel.slot;
    let pop: HTMLElement | null = null;
    const close = h("button", { class: "x popx", text: "x", title: t("gear.putBack"), attrs: { "aria-label": t("common.close"), "data-esc": "" }, on: { click: () => { c.sel = {}; c.rerender(); } } });
    const lockBtn = (it: Item) => h("button", { class: "btn alt", text: it.locked ? t("gear.unlock") : t("gear.lock"), attrs: { "data-key": "l" },
        title: it.locked ? t("gear.unlockTip") : t("gear.lockTip"),
        on: { click: () => c.act(s => setLocked(s, it.uid, !it.locked)) } });
    if (selItem) {
        const targets = slotsFor(baseOf(selItem));
        const cmp = upgradeOf(st, selItem) ?? (targets.length > 1 ? (targets.find(t => !eq[t]) ?? targets[0]!) : targets[0]!);
        const card = itemCard(selItem, c, { compareSlot: cmp });
        const row = h("div", { class: "row popacts" });
        targets.forEach((ts, i) => {
            const err = canEquip(st, selItem, ts);
            row.append(h("button", { class: "btn", text: targets.length > 1 ? t(ts === "ring1" ? "gear.equipLeft" : "gear.equipRight") : t("gear.equip"),
                attrs: { ...(err ? { disabled: "" } : {}), ...(i === 0 ? { "data-key": "e" } : {}) }, title: err ? tErr(err) : (i === 0 ? t("gear.equipKey") : ""),
                on: { click: () => c.act(s => { const e = equip(s, selItem.uid, ts); if (!e) c.sel = { slot: ts }; return e; }) } }));
        });
        row.append(lockBtn(selItem));
        row.append(h("button", { class: "btn alt", text: t("gear.salvageFor", { n: salvageValue(selItem) }), title: selItem.locked ? t("gear.unlockFirst") : t("gear.salvageTip"),
            attrs: { "data-key": "s", ...(selItem.locked ? { disabled: "" } : {}) },
            on: { click: () => c.act(s => { salvage(s, [selItem.uid]); c.sel = {}; }) } }));
        card.append(row);
        pop = h("div", { class: "gpop", attrs: { role: "dialog", "aria-label": itemName(selItem) } }, card, close);
    } else if (selSlot && eq[selSlot]) {
        const it = eq[selSlot]!;
        const card = itemCard(it, c);
        card.append(h("div", { class: "row popacts" }, h("button", { class: "btn alt", text: t("gear.unequip"), title: it.relic ? t("gear.toCase") : t("gear.toStash"), on: { click: () => c.act(s => unequip(s, selSlot)) } }), lockBtn(it)));
        pop = h("div", { class: "gpop", attrs: { role: "dialog", "aria-label": itemName(it) } }, card, close);
    }

    const help = h("button", { class: "info", text: "i", attrs: { "aria-label": t("gear.helpAria") }, title: t("gear.help") });
    const equipped = h("div", { class: "card" }, h("h3", { class: "split" }, h("span", { text: t("gear.equippedHead") }), help), doll);
    root.append(equipped, h("div", { class: "col" }, stashCard, tools));
    // A click on empty space puts the picked item back.
    root.addEventListener("click", e => {
        if ((c.sel.uid !== undefined || c.sel.slot) && !(e.target as HTMLElement).closest(".cell, .gpop, button, select, .anvil")) { c.sel = {}; c.rerender(); }
    });
    if (pop) {
        const p = pop;
        requestAnimationFrame(() => {
            const body = root.closest(".body") as HTMLElement | null;
            const anchor = root.querySelector<HTMLElement>(".cell.sel");
            if (!body || !anchor) return;
            body.append(p);
            placeBeside(p, anchor, body);
        });
    }
    return root;
}

/** Puts `el` (absolute, inside the scrolling `body`) beside `anchor`: right if it fits, else left, kept on screen. */
function placeBeside(el: HTMLElement, anchor: HTMLElement, body: HTMLElement): void {
    const br = body.getBoundingClientRect(), ar = anchor.getBoundingClientRect();
    const w = el.offsetWidth, ht = el.offsetHeight;
    let x = ar.right - br.left + body.scrollLeft + 10;
    if (x + w > body.scrollLeft + body.clientWidth - 6) x = ar.left - br.left + body.scrollLeft - w - 10;
    x = Math.max(body.scrollLeft + 4, x);
    let y = ar.top - br.top + body.scrollTop - 6;
    y = Math.max(body.scrollTop + 4, Math.min(y, body.scrollTop + body.clientHeight - ht - 6));
    el.style.left = x + "px"; el.style.top = y + "px";
}

// ---- Skills ----------------------------------------------------------------

const pctDelta = (a: number, b: number) => b / Math.max(0.01, a) - 1;

const fmtPct = (d: number) => `${d >= 0 ? "+" : ""}${(d * 100).toFixed(Math.abs(d) < 0.1 ? 1 : 0)}%`;

function skillsView(c: Ctx): HTMLElement {
    const hero = c.state.hero;
    const cur = c.sheet();
    const colourOf = (tags: string[]) => tags.includes("spell") ? "#3a7bff" : tags.some(t => t === "projectile" || t === "bow") ? "#3fbf5f" : tags.some(t => t === "attack" || t === "melee") ? "#e5383b" : "#e6d9b8";
    const gem = (colour: string, big = false, size = big ? 36 : 26) => h("span", { class: `gem${big ? " big" : ""}`, style: `color:${colour}` }, glyph("gem", size), h("span", { class: "shine" }, glyph("gemshine", size)));
    // Main skill: every unlocked one shows the pack DPS it would have with the current gear and supports.
    const skills = h("div", { class: "list" });
    for (const s of Object.values(SKILLS)) {
        const locked = s.level > hero.level;
        const on = hero.skill === s.id;
        let meta: HTMLElement;
        if (locked) meta = h("span", { class: "tag", text: t("skills.levelTag", { n: s.level }) });
        else if (on) meta = h("span", { class: "tag", style: "background:#1a1410;color:var(--gold)", text: t("skills.dps", { dps: fmt(cur.skill.packDps) }) });
        else {
            const sh = deriveSheet({ ...hero, skill: s.id, rev: -1 });
            const d = pctDelta(cur.skill.packDps, sh.skill.packDps);
            meta = h("span", { class: "col", style: "gap:1px;align-items:flex-end" }, h("span", { class: "num", style: "font-weight:700", text: fmt(sh.skill.packDps) }),
                h("span", { class: `delta ${d >= 0 ? "up" : "down"}`, text: fmtPct(d) }));
        }
        skills.append(h("div", { class: `li${on ? " on" : ""}${locked ? " locked" : ""}`, attrs: { role: "button", tabindex: locked || on ? "-1" : "0" },
            title: locked ? t("skills.unlocksAt", { n: s.level }) : on ? t("skills.main") : t("skills.packTip"),
            on: { click: () => { if (!locked && !on) c.act(st => setSkill(st, s.id), t("skills.selected", { name: skillName(s.id) })); } } },
            h("div", { class: "nm" }, gem(colourOf(s.tags), false, 14), h("span", { text: skillName(s.id) })),
            h("div", { class: "meta" }, meta),
            h("div", { class: "ds", text: skillBlurb(s.id) }),
            h("div", { class: "tags" }, ...s.tags.map(x => h("span", { class: "tag", text: tagName(x) })), h("span", { class: "tag", text: t("skills.eff", { n: s.effectiveness }) }))));
    }

    // Supports: what adding, removing or swapping each one does, best first.
    const slots = supportSlots(hero.level);
    const active = hero.supports.slice(0, slots);
    const full = active.length >= slots;
    const trial = (ids: string[]) => deriveSheet({ ...hero, supports: ids, rev: -1 }).skill.packDps;
    type Row = { s: (typeof SUPPORTS)[string]; on: boolean; locked: boolean; fits: boolean; d: number | null; swap?: string };
    const rows: Row[] = Object.values(SUPPORTS).map(s => {
        const locked = s.level > hero.level;
        const on = active.includes(s.id);
        const fits = !s.requires.length || s.requires.some(t => cur.skill.tags.includes(t));
        let d: number | null = null, swap: string | undefined;
        if (!locked && fits) {
            if (on) d = pctDelta(cur.skill.packDps, trial(active.filter(x => x !== s.id)));
            else if (!full) d = pctDelta(cur.skill.packDps, trial([...active, s.id]));
            else for (const out of active) {
                // Slots full: the best single swap for this one.
                const v = pctDelta(cur.skill.packDps, trial(active.map(x => x === out ? s.id : x)));
                if (d === null || v > d) { d = v; swap = out; }
            }
        }
        return { s, on, locked, fits, d, swap };
    });
    const rank = (r: Row) => (r.on ? 0 : r.locked ? 3 : r.fits ? 1 : 2);
    rows.sort((a, b) => rank(a) - rank(b) || (a.on ? (a.d ?? 0) - (b.d ?? 0) : (b.d ?? -9) - (a.d ?? -9)) || a.s.level - b.s.level);
    const sups = h("div", { class: "list" });
    for (const r of rows) {
        const { s, on, locked, fits, d, swap } = r;
        let meta: HTMLElement, tip: string;
        const needs = s.requires.map(x => tagName(x)).join(t("common.or"));
        if (locked) { meta = h("span", { class: "tag", text: t("skills.levelTag", { n: s.level }) }); tip = t("skills.unlocksAt", { n: s.level }); }
        else if (!fits) { meta = h("span", { class: "tag", text: t("skills.noFit") }); tip = t("skills.needs", { tags: needs }); }
        else if (on) { meta = h("span", { class: "col", style: "gap:1px;align-items:flex-end" }, h("span", { class: "tag", text: t("skills.slotted") }), h("span", { class: `delta ${(d ?? 0) <= 0 ? "up" : "down"}`, text: t("skills.worth", { pct: fmtPct(-(d ?? 0)) }) })); tip = t("skills.clickRemove", { pct: fmtPct(d ?? 0) }); }
        else {
            const good = (d ?? 0) > 0;
            const swapName = swap && SUPPORTS[swap] ? supportName(swap) : swap ?? "";
            meta = h("span", { class: "col", style: "gap:1px;align-items:flex-end" }, h("span", { class: `delta ${good ? "up" : "down"}`, text: fmtPct(d ?? 0) }),
                swap ? h("span", { class: "muted", style: "font-size:8px", text: t("skills.for", { name: swapName }) }) : null);
            tip = swap ? t("skills.clickSwap", { name: swapName, pct: fmtPct(d ?? 0) }) : t("skills.clickAdd", { pct: fmtPct(d ?? 0) });
        }
        sups.append(h("div", { class: `li${on ? " on" : ""}${locked || !fits ? " locked" : ""}`, attrs: { role: "button", tabindex: locked || !fits ? "-1" : "0" }, title: tip, on: { click: () => {
            if (locked || !fits) return;
            if (on) c.act(st => setSupports(st, active.filter(x => x !== s.id)), t("skills.removed", { name: supportName(s.id) }));
            else if (!full) c.act(st => setSupports(st, [...active, s.id]), t("skills.added", { name: supportName(s.id) }));
            else if (swap) c.act(st => setSupports(st, active.map(x => x === swap ? s.id : x)), t("skills.swapped", { out: supportName(swap), name: supportName(s.id) }));
        } } },
            h("div", { class: "nm" }, gem(colourOf(s.requires), false, 14), h("span", { text: supportName(s.id) })), h("div", { class: "meta" }, meta),
            h("div", { class: "ds", text: supportBlurb(s.id) + (s.requires.length ? "  " + t("skills.needsShort", { tags: needs }) : "") })));
    }
    const next = [1, 1, 8, 18, 32].find(l => l > hero.level);

    // Skill links: the main gem chained to its support sockets, like a socketed item.
    const main = SKILLS[hero.skill];
    const links = h("div", { class: "links" },
        h("div", { class: "sock main", title: main ? skillBlurb(main.id) : "" }, gem(colourOf(cur.skill.tags), true), h("b", { text: main ? skillName(main.id) : hero.skill })));
    [1, 1, 8, 18, 32].forEach((lvl, i) => {
        links.append(h("span", { class: `link${i < slots ? "" : " off"}`, attrs: { "aria-hidden": "true" } }));
        const id = active[i];
        const sup = id ? SUPPORTS[id] : undefined;
        if (sup) {
            const row = rows.find(r => r.s.id === id);
            links.append(h("button", { class: "sock", title: t("skills.sockTip", { name: supportName(sup.id), blurb: supportBlurb(sup.id) }) + (row?.d != null ? " " + t("skills.sockWorth", { pct: fmtPct(-(row.d)) }) : ""),
                on: { click: () => c.act(st => setSupports(st, active.filter(x => x !== id)), t("skills.removed", { name: supportName(sup.id) })) } },
                gem(colourOf(sup.requires)), h("b", { text: supportName(sup.id) })));
        } else if (i < slots) {
            links.append(h("div", { class: "sock empty", title: t("skills.emptyTip") }, h("span", { class: "hole" }, glyph("socket", 26)), h("b", { text: t("skills.empty") })));
        } else {
            links.append(h("div", { class: "sock locked", title: t("skills.opensAt", { n: lvl }) }, h("span", { class: "hole" }, glyph("socket", 26)), h("b", { text: t("common.level", { n: lvl }) })));
        }
    });
    const bar = h("div", { class: "card socketbar" }, h("h3", { text: t("skills.links") }), links);
    // A label whose word doesn't fit its socket whole (long Russian and Ukrainian names) drops to the small size.
    requestAnimationFrame(() => { for (const b of links.querySelectorAll<HTMLElement>(".sock b")) if (b.scrollWidth > b.clientWidth + 1) b.classList.add("long"); });
    return h("div", { class: "col", style: "gap:14px" }, bar, h("div", { class: "grid2" },
        h("div", null, h("div", { class: "sec", text: t("skills.mainSkill") }), skills),
        h("div", null, h("div", { class: "sec" }, t("skills.supports") + " ", h("span", { class: "num", text: `${active.length}/${slots}` }),
            next ? h("span", { class: "muted", text: t("skills.nextSlot", { n: next }) }) : null), sups)));
}

// ---- World -----------------------------------------------------------------

/** Cleared acts the player opened again this session (the rest stay folded). */
const openActs = new Set<number>();

function worldView(c: Ctx): HTMLElement {
    const st = c.state;
    const root = h("div", { class: "col", style: "gap:14px" });
    const inMaps = st.activity.mode === "map";
    const push = h("button", { class: `toggle${st.activity.autoPush ? " on" : ""}`, attrs: { role: "switch", "aria-checked": String(st.activity.autoPush) },
        on: { click: () => c.act(s => { s.activity.autoPush = !s.activity.autoPush; }) } },
        h("i"), h("span", null, h("b", { text: t("world.autoPush") }), h("small", { text: t("world.autoPushNote") })));
    root.append(push, contractBoard(c), shrineCard(c));
    if (inMaps) root.append(h("div", { class: "note" }, glyph("atlas", 16), h("span", { text: t("world.inMaps") })));
    const hc = HERO_CAST[st.hero.cls];
    for (const act of ACTS) {
        if (!act.zones.some(z => st.world.unlocked.includes(z))) continue;
        const done = !!st.world.clears[act.zones[act.zones.length - 1]!];
        const current = !inMaps && (act.zones.includes(st.activity.zone) || act.trial === st.activity.zone);
        // A finished act folds to one line unless the hero is in it or the player opened it.
        if (done && !current && !openActs.has(act.id)) {
            const total = act.zones.reduce((a, z) => a + (st.world.clears[z] ?? 0), 0);
            root.append(h("div", { class: "card act folded" },
                h("h3", { text: t("world.act", { n: act.id, name: actName(act.id) }) }),
                h("div", { class: "row" }, h("span", { class: "tag done", text: t("world.cleared") }), h("span", { class: "muted grow", text: t("world.folded", { places: act.zones.length, clears: fmt(total) }) }),
                    h("button", { class: "btn alt small", text: t("world.openRoad"), on: { click: () => { openActs.add(act.id); c.rerender(); } } }))));
            continue;
        }
        const road = h("div", { class: "road" });
        const stop = (id: string, n: string) => {
            const z = ZONES[id]!;
            const open = st.world.unlocked.includes(id);
            const here = st.activity.mode === "zone" && st.activity.zone === id;
            const clears = st.world.clears[id] ?? 0;
            const thumb = scenery(z, 112, 62);
            thumb.className = "thumb";
            const name = zoneName(id);
            const el = h("button", { class: `stop${here ? " here" : ""}${open ? "" : " locked"}${z.trial ? " trial" : ""}${z.boss ? " boss" : ""}`,
                attrs: { "aria-label": open ? t("world.stopAria", { name, level: z.level, clears }) : t("world.stopAriaLocked", { name, level: z.level }) },
                title: open ? (z.story ? zoneStory(id) : name) : t("world.notReached"),
                on: { click: () => { if (open && !here) c.act(s => setZone(s, id), t("world.travelling", { zone: name })); } } },
                h("div", { class: "pic" }, thumb,
                    h("span", { class: "num-badge", text: n }),
                    z.boss ? h("span", { class: "flag boss", text: t("world.boss") }) : z.trial ? h("span", { class: "flag trial", text: t("world.trial") }) : null,
                    here && hc ? (() => { const a = spriteCanvas(hc.idle); if (a) a.className = "hero-mark"; return a; })() : null,
                    open ? null : h("span", { class: "lock" }, glyph("block", 18))),
                h("b", { text: name }),
                h("span", { class: "meta" }, h("span", { class: "tag", text: t("world.lvl", { n: z.level }) }), h("span", { text: open ? tn("world.clears", clears) : t("world.locked") })));
            return el;
        };
        act.zones.forEach((id, i) => {
            if (i) road.append(h("span", { class: `path${st.world.unlocked.includes(id) ? "" : " dim"}`, attrs: { "aria-hidden": "true" } }));
            road.append(stop(id, String(i + 1)));
        });
        const trial = h("div", { class: "trialrow" }, h("span", { class: "sub", text: t("world.offRoad") }), stop(act.trial, "T"));
        root.append(h("div", { class: "card act" },
            h("h3", { text: t("world.act", { n: act.id, name: actName(act.id) }) }),
            h("div", { class: "story muted", text: done ? actOutro(act.id) : actIntro(act.id) }),
            road, trial,
            done && !current ? h("div", { class: "row", style: "justify-content:flex-end;margin-top:8px" },
                h("button", { class: "btn alt small", text: t("world.foldRoad"), on: { click: () => { openActs.delete(act.id); c.rerender(); } } })) : null));
    }
    // Opening the tab lands on the hero's stop, not the top of Act 1.
    requestAnimationFrame(() => {
        const here = root.querySelector<HTMLElement>(".stop.here");
        const body = root.closest(".body") as HTMLElement | null;
        if (here && body && body.scrollTop === 0) {
            const top = here.getBoundingClientRect().top - body.getBoundingClientRect().top;
            if (top > body.clientHeight - 60) body.scrollTop = top - 80;
        }
    });
    return root;
}

const CONTRACT_GLYPH: Record<Contract["kind"], Parameters<typeof glyph>[0]> = { kills: "skills", champions: "chaos", bosses: "atlas", runs: "world", maps: "atlas", rares: "gem" };

/** Three standing goals: progress, reward, Claim when done, Reroll for dust otherwise. */
function contractBoard(c: Ctx): HTMLElement {
    const st = c.state;
    const cost = rerollCost(st);
    const rows = h("div", { class: "contracts" });
    st.contracts.list.forEach((k, i) => {
        const done = k.n >= k.target;
        rows.append(h("div", { class: `contract${done ? " done" : ""}` },
            h("span", { class: "cg" }, glyph(CONTRACT_GLYPH[k.kind], 16)),
            h("div", { class: "grow col", style: "gap:3px;min-width:0" },
                h("b", { text: contractGoal(k.kind, k.target, k.tier) }),
                h("div", { class: "meter" }, h("i", { style: `width:${Math.min(100, (k.n / k.target) * 100).toFixed(1)}%` }), h("span", { class: "num", text: `${fmt(k.n)} / ${fmt(k.target)}` })),
                h("span", { class: "muted", style: "font-size:12px", text: t("contracts.reward", { text: rewardLine(k, st) }) })),
            done ? h("button", { class: "btn small", text: t("contracts.claim"), on: { click: () => c.act(s => claimContract(s, i), t("contracts.claimed")) } })
                : h("button", { class: "btn alt small", text: t("contracts.reroll", { cost: fmt(cost) }), title: t("contracts.rerollTip", { cost: fmt(cost) }), attrs: st.dust >= cost ? {} : { disabled: "" },
                    on: { click: () => c.act(s => rerollContract(s, i)) } })));
    });
    return h("div", { class: "card" }, h("h3", { class: "split" }, h("span", { text: t("contracts.title") }), h("span", { class: "num", text: t("contracts.done", { n: fmt(st.contracts.done) }) })), rows);
}

/** What a contract pays, in words: "300 dust, 3 Kindling, a relic not in your codex". */
function rewardLine(k: Contract, s: GameState): string {
    const parts = [t("reward.dust", { n: contractDust(s, k) })];
    if (k.currency && CURRENCIES[k.currency[0]]) parts.push(t("reward.currency", { n: k.currency[1], name: currencyName(k.currency[0]) }));
    if (k.extra) parts.push(t(`reward.${k.extra}`));
    return parts.join(t("common.list"));
}

/** Minutes left on each blessing, what can be paid, the switches: the shrine card is rebuilt when these change. */
function shrineSig(s: GameState): string {
    const cost = blessingCost(s);
    return `${BLESSINGS.map(b => Math.ceil(Math.max(0, (s.blessings[b.id] ?? 0) - s.simTo) / 60e3)).join(",")}:${s.dust >= cost}:${spareOrbValue(s) + s.dust >= cost}:${s.shrine.keep.join(",")}:${s.shrine.orbs}`;
}

const BLESS_GLYPH: Record<string, Parameters<typeof glyph>[0]> = { insight: "regen", fortune: "gem", plenty: "gear", hoard: "forge" };

/** The ember shrine: an hour of a blessing per offering, kept up on its own if asked; spare orbs can pay. */
function shrineCard(c: Ctx): HTMLElement {
    const st = c.state;
    const cost = blessingCost(st);
    const spare = spareOrbValue(st);
    const canPay = st.dust + (st.shrine.orbs ? spare : 0) >= cost;
    const rows = h("div", { class: "contracts" });
    for (const b of BLESSINGS) {
        const left = Math.max(0, (st.blessings[b.id] ?? 0) - st.simTo);
        const keep = st.shrine.keep.includes(b.id);
        rows.append(h("div", { class: `contract bless${left ? " done" : ""}` },
            h("span", { class: "cg" }, glyph(BLESS_GLYPH[b.id] ?? "gem", 16)),
            h("div", { class: "grow col", style: "gap:2px;min-width:0" },
                h("b", { text: t("shrine.line", { name: blessingName(b.id), text: blessingText(b.id, b.value) }) }),
                h("span", { class: "muted", style: "font-size:12px", text: left ? t(keep ? "shrine.leftKept" : "shrine.left", { time: fmtDuration(left) }) : keep ? t("shrine.keptUp") : t("shrine.notRunning") })),
            h("button", { class: `chip${keep ? " on" : ""}`, attrs: { role: "switch", "aria-checked": String(keep) }, title: t("shrine.keepTip"),
                on: { click: () => c.act(s => { setKeep(s, b.id, !keep); if (!keep && !left) return bless(s, b.id); }) } }, t("shrine.keep")),
            h("button", { class: "btn small", text: t("shrine.hour"), title: t(st.shrine.orbs ? "shrine.hourTipOrbs" : "shrine.hourTip", { name: blessingName(b.id), cost: fmt(cost) }), attrs: canPay ? {} : { disabled: "" },
                on: { click: () => c.act(s => bless(s, b.id), t("shrine.blessed", { name: blessingName(b.id) })) } })));
    }
    const orbs = h("button", { class: `toggle${st.shrine.orbs ? " on" : ""}`, attrs: { role: "switch", "aria-checked": String(st.shrine.orbs) },
        on: { click: () => c.act(s => { s.shrine.orbs = !s.shrine.orbs; }) } },
        h("i"), h("span", null, h("b", { text: t("shrine.orbs") }), h("small", { text: t("shrine.orbsNote", { n: ORB_RESERVE, v: fmt(spare) }) })));
    return h("div", { class: "card" }, h("h3", { class: "split" }, h("span", { text: t("shrine.title") }), h("span", { class: "num", text: t("shrine.cost", { cost: fmt(cost) }) })),
        h("div", { class: "muted", style: "font-size:12px;margin-bottom:8px", text: t("shrine.note") }), rows, h("div", { style: "margin-top:8px" }, orbs));
}

// ---- Log -------------------------------------------------------------------

const LOG_GLYPH: Record<string, Parameters<typeof glyph>[0]> = { level: "regen", loot: "gem", death: "chaos", zone: "world", boss: "atlas", info: "log" };
const LOG_KINDS: Record<string, string> = { level: "var(--gold)", loot: "var(--r-enchanted)", death: "var(--ember)", zone: "var(--teal)", boss: "var(--violet)", info: "var(--paper2)" };
let logFilter = "all";

function logView(c: Ctx): HTMLElement {
    const log = c.state.log;
    const n = (k: string) => log.filter(e => e.kind === k).length;
    const filter = chips<string>([["all", t("log.all"), log.length], ...Object.keys(LOG_KINDS).filter(k => n(k)).map(k => [k, t(`logkind.${k}`), n(k)] as [string, string, number])],
        logFilter, v => { logFilter = v; c.rerender(); });
    const el = h("div", { class: "card log" }, h("h3", { text: t("log.title") }), h("div", { style: "margin-bottom:8px" }, filter));
    const now = Date.now();
    for (const e of [...log].reverse()) {
        if (logFilter !== "all" && e.kind !== logFilter) continue;
        const color = LOG_KINDS[e.kind] ?? "var(--paper2)";
        el.append(h("div", { class: `entry k-${e.kind}` }, h("span", { class: "lg", style: `background:${color}`, title: t(`logkind.${e.kind}`) }, glyph(LOG_GLYPH[e.kind] ?? "log", 14)), h("span", { class: "grow", text: logText(e) }),
            h("span", { class: "muted num when", text: e.t > 1e12 ? `${fmtAgo(now - e.t)}` : "" })));
    }
    return el;
}

function fmtAgo(ms: number): string {
    if (ms < 60e3) return t("ago.now");
    const m = Math.floor(ms / 60e3);
    if (m < 60) return t("ago.m", { n: m });
    const hh = Math.floor(m / 60);
    return hh < 48 ? t("ago.h", { n: hh }) : t("ago.d", { n: Math.floor(hh / 24) });
}

// ---- Menu ------------------------------------------------------------------

function menuView(c: Ctx): HTMLElement {
    const st = c.state;
    const keep = h("select");
    for (const [v, label] of [["plain", t("menu.keepAll")], ["enchanted", t("menu.keepEnchanted")], ["rare", t("menu.keepRares")]] as const) {
        const o = h("option", { text: label, attrs: { value: v } });
        if (st.settings.keep === v) o.selected = true;
        keep.append(o);
    }
    keep.addEventListener("change", () => c.act(s => { s.settings.keep = keep.value as typeof s.settings.keep; }));
    const auto = h("button", { class: `toggle${st.settings.autoEquip ? " on" : ""}`, attrs: { role: "switch", "aria-checked": String(st.settings.autoEquip) }, on: { click: () => c.act(s => { s.settings.autoEquip = !s.settings.autoEquip; }) } },
        h("i"), h("span", null, h("b", { text: t("menu.autoEquip") }), h("small", { text: t("menu.autoEquipNote") })));
    const upkeep = h("button", { class: `toggle${st.settings.upkeep ? " on" : ""}`, attrs: { role: "switch", "aria-checked": String(st.settings.upkeep) }, on: { click: () => c.act(s => { s.settings.upkeep = !s.settings.upkeep; }) } },
        h("i"), h("span", null, h("b", { text: t("menu.upkeep") }), h("small", { text: t("menu.upkeepNote") })));

    const out = h("textarea", { attrs: { readonly: "", placeholder: t("menu.exportPh") } });
    const inp = h("textarea", { attrs: { placeholder: t("menu.importPh") } });
    const tot = st.totals;
    return h("div", { class: "grid2" },
        h("div", { class: "card col" }, h("h3", { text: t("menu.loot") }),
            auto, upkeep,
            filterEditor(c),
            h("div", { class: "row" }, t("menu.otherwise"), keep),
            h("div", { class: "muted", style: "font-size:12px", text: t("menu.rulesNote") })),
        h("div", { class: "card col" }, h("h3", { text: t("menu.save") }),
            h("div", { class: "muted", style: "font-size:12px", text: c.storeKind === "indexeddb" ? t("menu.savedIdb") : t("menu.savedMem") }),
            h("div", { class: "row" }, h("button", { class: "btn", text: t("menu.export"), on: { click: () => { out.value = c.exportSave(); out.select(); } } }),
                h("button", { class: "btn alt", text: t("menu.copy"), on: { click: () => { out.select(); void navigator.clipboard?.writeText(out.value).then(() => c.toast(t("menu.copied")), () => c.toast(t("menu.copyByHand"))); } } })),
            out, inp,
            h("div", { class: "row" }, h("button", { class: "btn alt", text: t("menu.import"), on: { click: () => { void c.importSave(inp.value).then(e => c.toast(e ? tErr(e) : t("menu.loaded"))); } } }))),
        h("div", { class: "card" }, h("h3", { text: t("menu.totals") }), kv([
            [t("menu.runs"), fmt(tot.runs)], [t("menu.kills"), fmt(tot.kills)], [t("menu.deaths"), fmt(tot.deaths)], [t("menu.items"), fmt(tot.items)], [t("menu.salvaged"), fmt(tot.salvaged)], [t("menu.swapped"), fmt(tot.swapped ?? 0)],
            [t("menu.time"), t("menu.hours", { n: (tot.simMs / 3600e3).toFixed(1) })]])),
        h("div", { class: "card col" }, h("h3", { text: t("menu.danger") }),
            h("button", { class: "btn hot", text: t("menu.newHero"), on: { click: () => {
                const close = c.modal(h("div", { class: "card col" }, h("h3", { text: t("menu.startOver") }),
                    h("div", { text: t("menu.startOverNote") }),
                    h("div", { class: "row" }, h("button", { class: "btn hot", text: t("menu.deleteStart"), on: { click: () => { close(); c.resetGame(); } } }),
                        h("button", { class: "btn alt", text: t("common.cancel"), on: { click: () => close() } }))));
            } } })),
    );
}

function filterEditor(c: Ctx): HTMLElement {
    const rules = c.state.settings.filter;
    const box = h("div", { class: "col", style: "gap:4px" });
    const edit = (fn: (r: FilterRule[]) => void) => c.act(s => { fn(s.settings.filter); });
    rules.forEach((r, i) => {
        const on = h("input", { attrs: { type: "checkbox" } });
        on.checked = r.on;
        on.addEventListener("change", () => edit(rs => { rs[i]!.on = on.checked; }));
        box.append(h("div", { class: "row", style: "gap:4px;flex-wrap:nowrap" }, on,
            h("span", { class: "grow", style: `font-size:12px;${r.on ? "" : "opacity:.5"}`, text: ruleText(r) }),
            h("button", { class: "x", text: "^", title: t("filter.moveUp"), attrs: i === 0 ? { disabled: "", "aria-label": t("filter.moveUp") } : { "aria-label": t("filter.moveUp") }, on: { click: () => edit(rs => { if (i > 0) [rs[i - 1], rs[i]] = [rs[i]!, rs[i - 1]!]; }) } }),
            h("button", { class: "x", text: "x", title: t("filter.delete"), attrs: { "aria-label": t("filter.deleteAria", { rule: ruleText(r) }) }, on: { click: () => edit(rs => { rs.splice(i, 1); }) } })));
    });
    const action = h("select");
    for (const a of ["keep", "salvage"]) action.append(h("option", { text: t(`filter.${a}`), attrs: { value: a } }));
    const rarity = h("select");
    for (const v of ["", "plain", "enchanted", "rare", "relic"]) rarity.append(h("option", { text: v ? t(`rarity.${v}`) : t("filter.anyRarity"), attrs: { value: v } }));
    const slot = h("select");
    for (const v of ["", "weapon", "offhand", "helmet", "body", "gloves", "boots", "belt", "amulet", "ring"]) slot.append(h("option", { text: v ? t(`slot.${v}`).toLowerCase() : t("filter.anySlot"), attrs: { value: v } }));
    const minAff = h("select");
    for (const v of ["0", "3", "4", "5", "6"]) minAff.append(h("option", { text: v === "0" ? t("filter.anyAffixes") : t("filter.minAffixes", { n: v }), attrs: { value: v } }));
    const behind = h("select", { attrs: { "aria-label": t("filter.behindAria") } });
    for (const v of ["0", "5", "10", "20"]) behind.append(h("option", { text: v === "0" ? t("filter.anyBase") : t("filter.behind", { n: v }), attrs: { value: v } }));
    const group = h("select", { attrs: { "aria-label": t("filter.groupAria") } });
    group.append(h("option", { text: t("filter.anyAffix"), attrs: { value: "" } }));
    for (const g of affixGroups()) group.append(h("option", { text: t("filter.with", { group: g.label }), attrs: { value: g.group } }));
    box.append(h("div", { class: "row", style: "gap:4px" }, action, rarity, slot, minAff, behind, group,
        h("button", { class: "btn alt", text: t("filter.add"), on: { click: () => edit(rs => {
            const r: FilterRule = { on: true, action: action.value as FilterRule["action"] };
            if (rarity.value) r.rarity = [rarity.value as Item["rarity"]];
            if (slot.value) r.slots = [slot.value];
            if (+minAff.value) r.minAffixes = +minAff.value;
            if (+behind.value) r.behind = +behind.value;
            if (group.value) r.group = group.value;
            rs.push(r);
        }) } }),
        h("button", { class: "btn alt", text: t("filter.reset"), on: { click: () => edit(rs => { rs.splice(0, rs.length, ...structuredClone(DEFAULT_FILTER)); }) } })));
    // Presets: one click replaces the rules with a ready-made set.
    const same = (a: FilterRule[], b: FilterRule[]) => JSON.stringify(a) === JSON.stringify(b);
    box.append(h("div", { class: "row presets", style: "gap:4px;margin-top:4px" }, h("span", { class: "muted", style: "font-size:12px", text: t("filter.presets") }),
        ...FILTER_PRESETS.map(p => h("button", { class: `chip${same(rules, p.rules) ? " on" : ""}`, text: presetName(p.id), title: presetBlurb(p.id),
            on: { click: () => edit(rs => { rs.splice(0, rs.length, ...structuredClone(p.rules)); }) } }))));
    return box;
}

/** Affix groups for the rule editor, by their name in the current language. */
function affixGroups(): { group: string; label: string }[] {
    return [...new Set(Object.values(AFFIXES).map(a => a.group))].map(group => ({ group, label: groupName(group) })).sort((a, b) => a.label.localeCompare(b.label, lang()));
}

/** A loot rule in words: "Salvage plain/enchanted, base 10+ levels behind". */
export function ruleText(r: FilterRule): string {
    const parts: string[] = [];
    parts.push(r.rarity?.length ? r.rarity.map(x => t(`rarity.${x}`)).join("/") : t("filter.anyRarity"));
    if (r.slots?.length) parts.push(r.slots.map(x => t(`slot.${x}`).toLowerCase()).join("/"));
    if (r.minIlvl) parts.push(t("rule.ilvl", { n: r.minIlvl }));
    if (r.behind) parts.push(t("rule.behind", { n: r.behind }));
    if (r.minAffixes) parts.push(t("rule.affixes", { n: r.minAffixes }));
    if (r.group) parts.push(t("rule.with", { group: groupName(r.group) }));
    return t(r.action === "keep" ? "rule.keep" : "rule.salvage", { what: parts.join(t("common.list")) });
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
    for (const s of SLOTS) { const it = st.hero.equipment[s]; if (it) add(itemLabel(it), itemName(it)); }
    return src => map.get(src) ?? src;
}

/** Where each calling is shown on the creation screen. */
const CALLING_SCENE: Record<string, string> = { vanguard: "a1_lock", strider: "a1_cliffs", arcanist: "a1_chapel" };
const SCENE_W = 120, SCENE_H = 84;

/** A calling's hero standing in its scenery; `frame` picks the idle frame. */
function callingScene(cls: string, bg: HTMLCanvasElement, into: HTMLCanvasElement, frame: number): void {
    const g = into.getContext("2d")!;
    g.imageSmoothingEnabled = false;
    g.drawImage(bg, 0, 0);
    const hc = HERO_CAST[cls];
    if (!hc) return;
    const ground = SCENE_H - Math.max(6, Math.round(SCENE_H * 0.12));
    g.fillStyle = "rgba(0,0,0,.35)";
    g.beginPath(); g.ellipse(SCENE_W / 2, ground, 14, 3, 0, 0, Math.PI * 2); g.fill();
    // The art may not be in yet (a first open): say so rather than show an empty stage.
    if (!drawSprite(g, hc.idle, frame, SCENE_W / 2, ground)) drawText(g, t("create.loading"), SCENE_W / 2, SCENE_H / 2 - 3, "#b5a48b", "center");
}

/** Character creation: the three callings side by side, each in its own scenery; the picked one breathes. */
export function creationView(onStart: (name: string, cls: string) => void): HTMLElement {
    const name = h("input", { attrs: { type: "text", maxlength: "20", value: "Ashling", "aria-label": t("create.nameAria"), spellcheck: "false", autocomplete: "off" } });
    let cls = Object.keys(CLASSES)[0]!;
    // Printable ASCII and the Cyrillic letters the pixel font draws (the regex stays ASCII for the build).
    const start = () => onStart(name.value.replace(/[^ -~\u0401\u0404\u0406\u0407\u0410-\u044f\u0451\u0454\u0456\u0457\u0490\u0491]/g, "").trim().slice(0, 20) || "Ashling", cls);
    name.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); start(); } });
    const grid = h("div", { class: "callings", attrs: { role: "radiogroup", "aria-label": t("create.calling") } });
    let live: { cls: string; bg: HTMLCanvasElement; c: HTMLCanvasElement } | null = null;
    const draw = () => {
        clear(grid);
        live = null;
        for (const k of Object.values(CLASSES)) {
            const on = k.id === cls;
            const bg = scenery(ZONES[CALLING_SCENE[k.id] ?? "a1_shore"]!, SCENE_W, SCENE_H);
            const pic = h("canvas", { class: "cscene", attrs: { width: String(SCENE_W), height: String(SCENE_H), "aria-hidden": "true" } });
            callingScene(k.id, bg, pic, 0);
            if (on) live = { cls: k.id, bg, c: pic };
            const attrs = ([["might", t("attr.str"), k.str], ["grace", t("attr.dex"), k.dex], ["wit", t("attr.int"), k.int]] as const)
                .map(([gl, label, v]) => h("span", { class: `cattr ${gl}`, title: label }, glyph(gl, 14), h("b", { class: "num", text: String(v) }), h("small", { text: label })));
            grid.append(h("button", { class: `calling${on ? " on" : ""}`, style: `--cc:${k.color}`, attrs: { role: "radio", "aria-checked": String(on) },
                on: { click: () => { if (cls !== k.id) { cls = k.id; draw(); (grid.querySelector(".calling.on") as HTMLElement | null)?.focus(); } } } },
                h("span", { class: "cpic" }, pic, on ? h("span", { class: "cpick", text: t("create.chosen") }) : null),
                h("span", { class: "cname", text: className(k.id) }),
                h("span", { class: "cattrs" }, ...attrs),
                h("span", { class: "ds", text: classBlurb(k.id) }),
                h("span", { class: "ds muted", text: t("create.starts", { skill: skillName(k.startSkill), weapon: baseName(k.startWeapon) }) })));
        }
    };
    draw();
    // The art may still be loading on a first open: draw again once it is in.
    void loadSprites().then(() => { if (grid.isConnected) draw(); });
    // The picked hero idles; the timer ends itself when the screen is gone.
    let f = 0;
    const timer = window.setInterval(() => {
        if (!root.isConnected && f > 20) { clearInterval(timer); return; }
        f++;
        if (live) callingScene(live.cls, live.bg, live.c, f);
    }, 150);
    const root = h("div", { class: "create" },
        h("div", { class: "card story", text: t("create.story") }),
        h("div", { class: "sec", text: t("create.choose") }),
        grid,
        h("div", { class: "card col" }, h("h3", { text: t("create.name") }),
            h("div", { class: "row namebar" }, name, h("button", { class: "btn hot", text: t("create.wake"), on: { click: start } })),
            h("div", { class: "muted", style: "font-size:12px", text: t("create.nameNote") })));
    return root;
}
