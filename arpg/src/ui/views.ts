// Tab views. Each returns a fresh element; the app swaps it in when the view's
// signature changes, so scroll position and selection survive sim ticks.

import { ACTS, BASES, CLASSES, SKILLS, SUPPORTS, ZONES, xpToNext, slotsFor } from "../core/data";
import { deriveSheet, supportSlots, type Sheet } from "../core/character";
import { canEquip, equip, salvage, setSkill, setSupports, setZone, trialSheet, unequip, upgradeSlot, RARITY_RANK, buildScore } from "../core/game";
import { affixOf, affixText, baseOf, itemLabel, itemStats, levelReq, tierLabel, salvageValue, relicLines, relicOf } from "../core/items";
import type { GameState } from "../core/state";
import { DAMAGE_TYPES, SLOTS, type DamageType, type Item, type Slot } from "../core/types";
import { clear, fmt, h, pct } from "./dom";
import { iconFor } from "./icons";
import { modText } from "./text";
import { forgeView } from "./forge";
import { treeView } from "./tree";
import { atlasSig, atlasView } from "./atlas";
import { DEFAULT_FILTER, describeRule, type FilterRule } from "../core/filter";

export interface Ctx {
    state: GameState;
    sheet(): Sheet;
    act(fn: (s: GameState) => string | null | void, ok?: string): void;
    toast(msg: string): void;
    modal(content: HTMLElement): () => void;
    sel: { uid?: number; slot?: Slot };
    rerender(): void;
    exportSave(): string;
    importSave(text: string): Promise<string | null>;
    resetGame(): void;
    storeKind: string;
}

export type ViewId = "hero" | "gear" | "forge" | "skills" | "tree" | "world" | "atlas" | "log" | "menu";
export const VIEWS: { id: ViewId; label: string }[] = [
    { id: "hero", label: "Hero" }, { id: "gear", label: "Gear" }, { id: "forge", label: "Forge" }, { id: "skills", label: "Skills" },
    { id: "tree", label: "Tree" }, { id: "world", label: "World" }, { id: "atlas", label: "Atlas" }, { id: "log", label: "Log" }, { id: "menu", label: "Menu" },
];

/** What a view depends on; it is rebuilt when this changes. */
export function viewSig(id: ViewId, c: Ctx): string {
    const s = c.state;
    switch (id) {
        case "hero": return `${s.hero.rev}`;
        case "gear": return `${s.hero.rev}:${s.stash.length}:${s.stash[s.stash.length - 1]?.uid ?? 0}:${s.dust}:${c.sel.uid}:${c.sel.slot}`;
        case "forge": return `${s.hero.rev}:${s.stash.length}:${s.dust}:${JSON.stringify(s.currency)}:${c.sel.uid}:${s.craftSeq}`;
        case "skills": return `${s.hero.rev}:${s.hero.level}`;
        case "tree": return `${s.hero.rev}:${s.hero.level}:${s.dust >= 5 + s.hero.level * 2}:${s.hero.ascPoints}`;
        case "world": return `${s.activity.zone}:${s.world.unlocked.length}:${s.activity.autoPush}:${Object.values(s.world.clears).reduce((a, b) => a + b, 0)}`;
        case "atlas": return atlasSig(c);
        case "log": return `${s.log.length}:${s.log[s.log.length - 1]?.t ?? 0}`;
        case "menu": return `${s.settings.keep}:${s.settings.autoEquip}:${JSON.stringify(s.settings.filter)}`;
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
const TYPE_NAME: Record<DamageType, string> = { phys: "Physical", fire: "Fire", cold: "Cold", lightning: "Lightning", chaos: "Chaos" };

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
    const hero = c.state.hero;
    const sk = s.skill;
    const critFactor = 1 + (sk.critChance / 100) * (sk.critMulti / 100 - 1);
    const breakdown = (stat: Parameters<Sheet["bag"]["mods"]>[0], title: string) => () => {
        const mods = s.bag.mods(stat);
        const list = h("div", { class: "kv" });
        for (const m of mods) list.append(h("div", { text: m.src ?? "?" }), h("div", { class: "num", text: `${m.kind === "flat" ? "+" : ""}${m.value}${m.kind === "flat" ? "" : "% " + m.kind}${m.tags ? " [" + m.tags.join(",") + "]" : ""}` }));
        if (!mods.length) list.append(h("div", { text: "No modifiers" }), h("div"));
        const close = c.modal(h("div", { class: "card" }, h("h3", { text: title }), list, h("div", { style: "margin-top:8px" }, h("button", { class: "btn", text: "Close", on: { click: () => close() } }))));
    };

    const off = h("div", { class: "card" },
        h("h3", { text: `Offence: ${sk.name}` }),
        h("div", { class: "row" }, h("div", { class: "big num", text: fmt(sk.dps) }), h("div", { class: "muted", text: "DPS single target" })),
        h("div", { class: "row", style: "margin-bottom:6px" }, h("div", { class: "big num", text: fmt(sk.packDps) }), h("div", { class: "muted", text: `vs packs (${sk.targets} target${sk.targets > 1 ? "s" : ""})` })),
        kv([
            ["Average hit", fmt(sk.avgHit), breakdown("damage", "Damage modifiers")],
            ...DAMAGE_TYPES.filter(t => sk.hit[t][1] > 0).map(t => [`  ${TYPE_NAME[t]}`, `${fmt(sk.hit[t][0])}-${fmt(sk.hit[t][1])}`] as [string, string]),
            ["Critical chance", `${sk.critChance.toFixed(1)}%`, breakdown("critChance", "Critical chance")],
            ["Critical multiplier", `${sk.critMulti.toFixed(0)}%`, breakdown("critMulti", "Critical multiplier")],
            ["x Crit factor", critFactor.toFixed(2)],
            [sk.kind === "attack" ? "Attacks per second" : "Casts per second", sk.speed.toFixed(2), breakdown(sk.kind === "attack" ? "attackSpeed" : "castSpeed", "Speed")],
            ...(sk.kind === "attack" ? [["Hit chance (vs same level)", pct(sk.hitChance), breakdown("accuracy", "Accuracy")] as [string, string, () => void]] : []),
            ["Mana cost", fmt(sk.manaCost)],
            ...(sk.sustain < sk.speed ? [["Mana-limited to", `${sk.sustain.toFixed(2)}/s`] as [string, string]] : []),
            ...(sk.leech ? [["Life leech", `${sk.leech}%`] as [string, string]] : []),
        ]),
        h("div", { class: "muted", style: "margin-top:6px;font-size:11px", text: `DPS = ${fmt(sk.avgHit)} hit x ${critFactor.toFixed(2)} crit x ${Math.min(sk.speed, sk.sustain).toFixed(2)}/s${sk.sustain < sk.speed ? " (mana-limited)" : ""}${sk.kind === "attack" ? ` x ${pct(sk.hitChance)} hit` : ""}` }),
    );

    const pool = s.life + s.es;
    const def = h("div", { class: "card" },
        h("h3", { text: "Defence" }),
        kv([
            ["Life", fmt(s.life), breakdown("life", "Life")],
            ["Energy shield", fmt(s.es), breakdown("energyShield", "Energy shield")],
            ["Mana", fmt(s.mana), breakdown("mana", "Mana")],
            ["Armour", fmt(s.armour), breakdown("armour", "Armour")],
            ["Evasion", fmt(s.evasion), breakdown("evasion", "Evasion")],
            ["Block", `${s.block.toFixed(0)}%`, breakdown("block", "Block")],
            ["Life regen", `${fmt(s.lifeRegen)}/s`, breakdown("lifeRegen", "Life regeneration")],
            ...(["fire", "cold", "lightning", "chaos"] as const).map(t => [`${TYPE_NAME[t]} res`, h("div", { class: "num", style: s.res[t] < 0 ? "color:var(--red)" : "", text: `${s.res[t]}%${s.resRaw[t] > s.maxRes[t] ? ` (${s.resRaw[t]})` : ""}` }), breakdown(`res.${t}`, `${TYPE_NAME[t]} resistance`)] as [string, HTMLElement, () => void]),
        ]),
        h("h3", { style: "margin-top:8px", text: `Effective HP (pool ${fmt(pool)})` }),
        ehpBars(s),
    );

    const xpNeed = xpToNext(hero.level);
    const info = h("div", { class: "card" },
        h("h3", { text: `${hero.name} - ${CLASSES[hero.cls]?.name ?? hero.cls}` }),
        kv([
            ["Level", String(hero.level)],
            ["Experience", isFinite(xpNeed) ? `${fmt(hero.xp)} / ${fmt(xpNeed)}` : "max"],
            ["Might / Grace / Wit", `${s.str} / ${s.dex} / ${s.int}`],
            ["Movement speed", pct(s.moveSpeed)],
            ["Item rarity", `+${s.rarity}%`],
            ["Flask healing", pct(s.flaskHeal)],
            ["Build score", fmt(buildScore(s))],
        ]),
        ...s.problems.map(p => h("div", { class: "tag", style: "background:var(--ember);margin-top:4px", text: p })),
        h("div", { class: "muted", style: "margin-top:6px;font-size:11px", text: "Click an underlined stat for where it comes from." }),
    );
    return h("div", { class: "grid2" }, off, def, info);
}

function ehpBars(s: Sheet): HTMLElement {
    const max = Math.max(...DAMAGE_TYPES.map(t => s.ehp[t]));
    const el = h("div", { class: "col", style: "gap:3px" });
    for (const t of DAMAGE_TYPES) {
        const m = h("div", { class: "meter", title: t === "phys" ? "Against a typical hit: armour, evasion and block" : "Resistance and block" });
        m.append(h("i", { style: `width:${(s.ehp[t] / max) * 100}%;background:${TYPE_COLOR[t]}` }), h("span", { text: `${TYPE_NAME[t]} ${fmt(s.ehp[t])}` }));
        el.append(m);
    }
    return el;
}

// ---- Gear ------------------------------------------------------------------

const SLOT_LABEL: Record<Slot, string> = { weapon: "Weapon", offhand: "Off-hand", helmet: "Helm", body: "Body", gloves: "Gloves", boots: "Boots", belt: "Belt", amulet: "Amulet", ring1: "Ring", ring2: "Ring" };

function itemCell(item: Item | undefined, slot: Slot | null, selected: boolean, onClick: () => void): HTMLElement {
    const cell = h("div", { class: `cell ${item ? item.rarity : "empty"}${selected ? " sel" : ""}`, title: item ? itemLabel(item) : slot ? SLOT_LABEL[slot] : "", on: { click: onClick } });
    if (item) cell.append(iconFor(baseOf(item).kind, baseOf(item).slot));
    if (slot) cell.append(h("span", { class: "lbl", text: SLOT_LABEL[slot] }));
    return cell;
}

export function itemCard(item: Item, c: Ctx | null, opts: { compareSlot?: Slot | null } = {}): HTMLElement {
    const b = baseOf(item);
    const st = itemStats(item);
    const card = h("div", { class: "card item" }, h("div", { class: `name ${item.rarity}`, text: itemLabel(item) }));
    const lines: string[] = [];
    if (item.rarity === "rare" || item.rarity === "relic") lines.push(b.name);
    card.append(h("div", { class: "muted", text: `${[...lines, b.kind === b.slot ? "" : b.kind].filter(Boolean).join(" - ")}  ilvl ${item.ilvl}, needs level ${levelReq(item)}` }));
    if (st.weapon) {
        const w = st.weapon;
        const rows: [string, string][] = [["Physical", `${w.phys[0]}-${w.phys[1]}`]];
        for (const [t, r] of Object.entries(w.added)) rows.push([TYPE_NAME[t as DamageType], `${r![0]}-${r![1]}`]);
        rows.push(["Attacks per second", w.aps.toFixed(2)], ["Critical chance", `${w.crit.toFixed(1)}%`], ["Hands", String(w.hands)]);
        card.append(kv(rows));
    }
    if (st.defence) {
        const d = st.defence;
        const rows: [string, string][] = [];
        if (d.armour) rows.push(["Armour", String(d.armour)]);
        if (d.evasion) rows.push(["Evasion", String(d.evasion)]);
        if (d.energyShield) rows.push(["Energy shield", String(d.energyShield)]);
        if (d.block) rows.push(["Block", `${d.block}%`]);
        card.append(kv(rows));
    }
    if (b.implicit?.length) {
        card.append(h("hr"));
        for (const m of b.implicit) card.append(h("div", { class: "aff", text: modText(m) }));
    }
    if (item.affixes.length) {
        card.append(h("hr"));
        const sorted = [...item.affixes].sort((a, z) => (affixOf(a).type === affixOf(z).type ? 0 : affixOf(a).type === "prefix" ? -1 : 1));
        for (const a of sorted) card.append(h("div", { class: "aff" }, affixText(a), h("b", { text: `${affixOf(a).type === "prefix" ? "P" : "S"} T${tierLabel(a)}` })));
    }
    const relic = relicOf(item);
    if (relic) {
        card.append(h("hr"));
        for (const l of relicLines(item)) card.append(h("div", { class: "aff", text: l }));
        card.append(h("div", { class: "muted", style: "font-style:italic;margin-top:4px", text: relic.flavour }));
    }
    if (c && opts.compareSlot !== undefined) {
        const slot = opts.compareSlot ?? slotsFor(b).find(s => !c.state.hero.equipment[s]) ?? slotsFor(b)[0]!;
        const trial = trialSheet(c.state, item, slot);
        if (trial) {
            card.append(h("hr"), compareRows(c.sheet(), trial));
        } else {
            card.append(h("hr"), h("div", { class: "down", text: canEquip(c.state, item, slot) ?? "can't equip" }));
        }
    }
    return card;
}

function compareRows(now: Sheet, next: Sheet): HTMLElement {
    const rows: [string, number, number][] = [
        ["DPS", now.skill.dps, next.skill.dps], ["Pack DPS", now.skill.packDps, next.skill.packDps],
        ["Life", now.life, next.life], ["Energy shield", now.es, next.es],
        ["EHP physical", now.ehp.phys, next.ehp.phys],
        ["EHP elemental", (now.ehp.fire + now.ehp.cold + now.ehp.lightning) / 3, (next.ehp.fire + next.ehp.cold + next.ehp.lightning) / 3],
    ];
    const el = h("div", { class: "kv" });
    for (const [k, a, b] of rows) {
        if (Math.abs(b - a) < 0.005 * Math.max(1, a)) continue;
        const d = b - a;
        el.append(h("div", { text: k }), h("div", { class: `num ${d > 0 ? "up" : "down"}`, text: `${d > 0 ? "+" : ""}${fmt(d)} (${a > 0 ? (d > 0 ? "+" : "") + ((d / a) * 100).toFixed(0) + "%" : "new"})` }));
    }
    const sa = buildScore(now), sb = buildScore(next);
    el.append(h("div", { text: "Build score" }), h("div", { class: `num ${sb >= sa ? "up" : "down"}`, text: `${sb >= sa ? "+" : ""}${sa > 0 ? (((sb - sa) / sa) * 100).toFixed(1) : "0"}%` }));
    return el;
}

type GearFilter = "all" | "upgrades" | "weapons" | "armour" | "jewellery";
type GearSort = "rarity" | "level" | "slot";
/** Stash view options: kept for the session, not saved. */
const gearOpts: { filter: GearFilter; sort: GearSort } = { filter: "all", sort: "rarity" };
const SLOT_GROUP: Record<string, GearFilter> = { weapon: "weapons", offhand: "weapons", helmet: "armour", body: "armour", gloves: "armour", boots: "armour", belt: "jewellery", amulet: "jewellery", ring: "jewellery" };
const SLOT_ORDER = ["weapon", "offhand", "helmet", "body", "gloves", "boots", "belt", "amulet", "ring"];

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

function gearView(c: Ctx): HTMLElement {
    const st = c.state;
    const eq = st.hero.equipment;
    const slots = h("div", { class: "slots" });
    for (const s of SLOTS) slots.append(itemCell(eq[s], s, c.sel.slot === s && c.sel.uid === undefined, () => { c.sel = { slot: s }; c.rerender(); }));

    // Stash: filter chips with counts, a sort, and markers for upgrades and level-locked items.
    const ups = new Set(st.stash.filter(it => upgradeOf(st, it)).map(it => it.uid));
    const groupOf = (it: Item) => SLOT_GROUP[baseOf(it).slot] ?? "all";
    const count = (f: GearFilter) => f === "all" ? st.stash.length : f === "upgrades" ? ups.size : st.stash.filter(it => groupOf(it) === f).length;
    const shown = st.stash.filter(it => gearOpts.filter === "all" || (gearOpts.filter === "upgrades" ? ups.has(it.uid) : groupOf(it) === gearOpts.filter));
    const byRarity = (a: Item, b: Item) => RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity] || b.ilvl - a.ilvl;
    shown.sort(gearOpts.sort === "level" ? (a, b) => b.ilvl - a.ilvl || byRarity(a, b)
        : gearOpts.sort === "slot" ? (a, b) => SLOT_ORDER.indexOf(baseOf(a).slot) - SLOT_ORDER.indexOf(baseOf(b).slot) || byRarity(a, b)
        : byRarity);
    const stash = h("div", { class: "stash" });
    for (const it of shown) {
        const cell = itemCell(it, null, c.sel.uid === it.uid, () => { c.sel = { uid: it.uid }; c.rerender(); });
        if (ups.has(it.uid)) { cell.classList.add("upg"); cell.title += "  (upgrade)"; }
        else if (levelReq(it) > st.hero.level) { cell.classList.add("req"); cell.title += `  (needs level ${levelReq(it)})`; }
        stash.append(cell);
    }
    if (gearOpts.filter === "all") for (let i = st.stash.length; i < st.stashCap; i++) stash.append(h("div", { class: "cell empty" }));
    else if (!shown.length) stash.append(h("div", { class: "muted", style: "grid-column:1/-1;padding:6px 0", text: gearOpts.filter === "upgrades" ? "Nothing in the stash beats what is equipped." : "None of these in the stash." }));

    const sort = h("select", { attrs: { "aria-label": "Sort the stash" } });
    for (const [v, label] of [["rarity", "Sort: rarity"], ["level", "Sort: item level"], ["slot", "Sort: slot"]] as const) {
        const o = h("option", { text: label, attrs: { value: v } });
        if (gearOpts.sort === v) o.selected = true;
        sort.append(o);
    }
    sort.addEventListener("change", () => { gearOpts.sort = sort.value as GearSort; c.rerender(); });
    const full = st.stash.length >= st.stashCap;
    const stashCard = h("div", { class: "card" },
        h("h3", { class: "split" }, h("span", { text: "Stash" }), h("span", { class: `num${full ? " down" : ""}`, text: `${st.stash.length} / ${st.stashCap}` })),
        h("div", { class: "row", style: "margin-bottom:8px;justify-content:space-between" },
            chips<GearFilter>([["all", "All", count("all")], ["upgrades", "Upgrades", count("upgrades")], ["weapons", "Weapons", count("weapons")], ["armour", "Armour", count("armour")], ["jewellery", "Jewellery", count("jewellery")]],
                gearOpts.filter, v => { gearOpts.filter = v; c.rerender(); }),
            sort),
        stash);

    const plainCount = st.stash.filter(x => x.rarity === "plain").length;
    const enchCount = st.stash.filter(x => x.rarity === "enchanted").length;
    const tools = h("div", { class: "row" },
        h("span", { class: "tag", style: "background:var(--gold);color:#1a1410", text: `Ember dust ${fmt(st.dust)}` }),
        h("button", { class: "btn alt", text: `Salvage plain (${plainCount})`, attrs: plainCount ? {} : { disabled: "" },
            on: { click: () => c.act(s => { salvage(s, s.stash.filter(x => x.rarity === "plain").map(x => x.uid)); c.sel = {}; }) } }),
        h("button", { class: "btn alt", text: `Salvage enchanted (${enchCount})`, attrs: enchCount ? {} : { disabled: "" },
            on: { click: () => c.act(s => { salvage(s, s.stash.filter(x => x.rarity === "enchanted").map(x => x.uid)); c.sel = {}; }) } }),
    );

    // Detail: the picked item, what it would change, and what it would replace.
    const detail = h("div", { class: "col side" });
    const selItem = c.sel.uid !== undefined ? st.stash.find(x => x.uid === c.sel.uid) : undefined;
    const selSlot = c.sel.slot;
    if (selItem) {
        const targets = slotsFor(baseOf(selItem));
        const cmp = upgradeOf(st, selItem) ?? (targets.length > 1 ? (targets.find(t => !eq[t]) ?? targets[0]!) : targets[0]!);
        detail.append(itemCard(selItem, c, { compareSlot: cmp }));
        const row = h("div", { class: "row" });
        targets.forEach((t, i) => {
            const err = canEquip(st, selItem, t);
            row.append(h("button", { class: "btn", text: targets.length > 1 ? `Equip ${t === "ring1" ? "left" : "right"}` : "Equip",
                attrs: { ...(err ? { disabled: "" } : {}), ...(i === 0 ? { "data-key": "e" } : {}) }, title: err ?? (i === 0 ? "Equip (E)" : ""),
                on: { click: () => c.act(s => { const e = equip(s, selItem.uid, t); if (!e) c.sel = { slot: t }; return e; }) } }));
        });
        row.append(h("button", { class: "btn alt", text: `Salvage +${salvageValue(selItem)}`, title: "Salvage into ember dust (S)", attrs: { "data-key": "s" },
            on: { click: () => c.act(s => { salvage(s, [selItem.uid]); c.sel = {}; }) } }));
        detail.append(row);
        const worn = eq[cmp];
        if (worn) detail.append(h("div", { class: "sec", style: "margin-top:6px", text: `Now in ${SLOT_LABEL[cmp].toLowerCase()} slot` }), itemCard(worn, null));
    } else if (selSlot && eq[selSlot]) {
        detail.append(itemCard(eq[selSlot]!, c));
        detail.append(h("div", { class: "row" }, h("button", { class: "btn alt", text: "Unequip", on: { click: () => c.act(s => unequip(s, selSlot)) } })));
    } else {
        detail.append(h("div", { class: "card hint" }, h("h3", { text: "Pick an item" }),
            h("div", { class: "muted", text: "Stash items show what equipping them would change. A green corner marks an upgrade; faded ones need a higher level." }),
            h("div", { class: "muted", style: "margin-top:6px", text: "Keys: E equips the picked item, S salvages it." })));
    }

    return h("div", { class: "gear" },
        h("div", { class: "col" }, h("div", { class: "card" }, h("h3", { text: "Equipped" }), slots), stashCard, tools),
        detail);
}

// ---- Skills ----------------------------------------------------------------

const pctDelta = (a: number, b: number) => b / Math.max(0.01, a) - 1;
const fmtPct = (d: number) => `${d >= 0 ? "+" : ""}${(d * 100).toFixed(Math.abs(d) < 0.1 ? 1 : 0)}%`;

function skillsView(c: Ctx): HTMLElement {
    const hero = c.state.hero;
    const cur = c.sheet();
    // Main skill: every unlocked one shows the pack DPS it would have with the current gear and supports.
    const skills = h("div", { class: "list" });
    for (const s of Object.values(SKILLS)) {
        const locked = s.level > hero.level;
        const on = hero.skill === s.id;
        let meta: HTMLElement;
        if (locked) meta = h("span", { class: "tag", text: `level ${s.level}` });
        else if (on) meta = h("span", { class: "tag", style: "background:#1a1410;color:var(--gold)", text: `${fmt(cur.skill.packDps)} dps` });
        else {
            const sh = deriveSheet({ ...hero, skill: s.id, rev: -1 });
            const d = pctDelta(cur.skill.packDps, sh.skill.packDps);
            meta = h("span", { class: "col", style: "gap:1px;align-items:flex-end" }, h("span", { class: "num", style: "font-weight:700", text: fmt(sh.skill.packDps) }),
                h("span", { class: `delta ${d >= 0 ? "up" : "down"}`, text: fmtPct(d) }));
        }
        skills.append(h("div", { class: `li${on ? " on" : ""}${locked ? " locked" : ""}`, attrs: { role: "button", tabindex: locked || on ? "-1" : "0" },
            title: locked ? `Unlocks at level ${s.level}` : on ? "Your main skill" : "Pack DPS with your current gear and supports",
            on: { click: () => { if (!locked && !on) c.act(st => setSkill(st, s.id), `${s.name} selected`); } } },
            h("div", { class: "nm", text: s.name }),
            h("div", { class: "meta" }, meta),
            h("div", { class: "ds", text: s.blurb }),
            h("div", { class: "tags" }, ...s.tags.map(t => h("span", { class: "tag", text: t })), h("span", { class: "tag", text: `${s.effectiveness}% eff.` }))));
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
        if (locked) { meta = h("span", { class: "tag", text: `level ${s.level}` }); tip = `Unlocks at level ${s.level}`; }
        else if (!fits) { meta = h("span", { class: "tag", text: "no fit" }); tip = `Needs a ${s.requires.join(" or ")} skill`; }
        else if (on) { meta = h("span", { class: "col", style: "gap:1px;align-items:flex-end" }, h("span", { class: "tag", text: "slotted" }), h("span", { class: `delta ${(d ?? 0) <= 0 ? "up" : "down"}`, text: `worth ${fmtPct(-(d ?? 0))}` })); tip = `Click to remove: ${fmtPct(d ?? 0)} pack DPS`; }
        else {
            const good = (d ?? 0) > 0;
            meta = h("span", { class: "col", style: "gap:1px;align-items:flex-end" }, h("span", { class: `delta ${good ? "up" : "down"}`, text: fmtPct(d ?? 0) }),
                swap ? h("span", { class: "muted", style: "font-size:10.5px", text: `for ${SUPPORTS[swap]?.name ?? swap}` }) : null);
            tip = swap ? `Click to swap out ${SUPPORTS[swap]?.name}: ${fmtPct(d ?? 0)} pack DPS` : `Click to add: ${fmtPct(d ?? 0)} pack DPS`;
        }
        sups.append(h("div", { class: `li${on ? " on" : ""}${locked || !fits ? " locked" : ""}`, attrs: { role: "button", tabindex: locked || !fits ? "-1" : "0" }, title: tip, on: { click: () => {
            if (locked || !fits) return;
            if (on) c.act(st => setSupports(st, active.filter(x => x !== s.id)), `${s.name} removed`);
            else if (!full) c.act(st => setSupports(st, [...active, s.id]), `${s.name} added`);
            else if (swap) c.act(st => setSupports(st, active.map(x => x === swap ? s.id : x)), `${SUPPORTS[swap]?.name} swapped for ${s.name}`);
        } } },
            h("div", { class: "nm", text: s.name }), h("div", { class: "meta" }, meta),
            h("div", { class: "ds", text: s.blurb + (s.requires.length ? `  Needs: ${s.requires.join(" or ")}.` : "") })));
    }
    const next = [1, 1, 8, 18, 32].find(l => l > hero.level);
    return h("div", { class: "grid2" },
        h("div", null, h("div", { class: "sec", text: "Main skill" }), skills),
        h("div", null, h("div", { class: "sec" }, "Supports ", h("span", { class: "num", text: `${active.length}/${slots}` }),
            next ? h("span", { class: "muted", text: `next slot at level ${next}` }) : null), sups));
}

// ---- World -----------------------------------------------------------------

function worldView(c: Ctx): HTMLElement {
    const st = c.state;
    const root = h("div", { class: "col" });
    root.append(h("div", { class: "row" },
        h("label", { class: "chk" }, (() => { const i = h("input", { attrs: { type: "checkbox" } }); i.checked = st.activity.autoPush; i.addEventListener("change", () => c.act(s => { s.activity.autoPush = i.checked; })); return i; })(),
            "Auto-push: move on after 3 clean clears, fall back after 3 deaths")));
    for (const act of ACTS) {
        if (!act.zones.some(z => st.world.unlocked.includes(z))) continue;
        const done = !!st.world.clears[act.zones[act.zones.length - 1]!];
        const card = h("div", { class: "card" }, h("h3", { text: `Act ${act.id}: ${act.name}` }), h("div", { class: "story muted", style: "margin-bottom:8px", text: done ? act.outro : act.intro }));
        for (const id of [...act.zones, act.trial]) {
            const z = ZONES[id]!;
            const open = st.world.unlocked.includes(id);
            const on = st.activity.zone === id;
            const clears = st.world.clears[id] ?? 0;
            const row = h("div", { class: `zone${on ? " on" : ""}${open ? "" : " locked"}`, on: { click: () => { if (open && !on) c.act(s => setZone(s, id), `Travelling to ${z.name}`); } } },
                h("div", { class: "tag", text: `L${z.level}` }),
                h("div", { class: "grow" }, h("div", { style: "font-weight:800", text: z.name }), open && z.story ? h("div", { class: "muted", style: "font-size:11px", text: z.story }) : null),
                z.trial ? h("div", { class: "tag", style: "background:var(--violet);color:#fff", text: "trial" }) : z.boss ? h("div", { class: "tag", style: "background:var(--ember)", text: "boss" }) : null,
                h("div", { class: "tag", text: open ? `${clears} clears` : "locked" }));
            card.append(row);
        }
        root.append(card);
    }
    return root;
}

// ---- Log -------------------------------------------------------------------

const LOG_KINDS: Record<string, [string, string]> = { level: ["Level", "var(--gold)"], loot: ["Loot", "var(--r-enchanted)"], death: ["Death", "var(--ember)"], zone: ["Road", "var(--teal)"], boss: ["Boss", "var(--violet)"], info: ["Note", "var(--paper2)"] };
let logFilter = "all";

function logView(c: Ctx): HTMLElement {
    const log = c.state.log;
    const n = (k: string) => log.filter(e => e.kind === k).length;
    const filter = chips<string>([["all", "All", log.length], ...Object.entries(LOG_KINDS).filter(([k]) => n(k)).map(([k, [label]]) => [k, label, n(k)] as [string, string, number])],
        logFilter, v => { logFilter = v; c.rerender(); });
    const el = h("div", { class: "card log" }, h("h3", { text: "Chronicle" }), h("div", { style: "margin-bottom:8px" }, filter));
    const now = Date.now();
    for (const e of [...log].reverse()) {
        if (logFilter !== "all" && e.kind !== logFilter) continue;
        const [label, color] = LOG_KINDS[e.kind] ?? [e.kind, "var(--paper2)"];
        el.append(h("div", { class: "entry" }, h("span", { class: "tag", style: `background:${color};color:#1a1410`, text: label }), h("span", { class: "grow", text: e.text }),
            h("span", { class: "muted num when", text: e.t > 1e12 ? `${fmtAgo(now - e.t)}` : "" })));
    }
    return el;
}

function fmtAgo(ms: number): string {
    if (ms < 60e3) return "now";
    const m = Math.floor(ms / 60e3);
    if (m < 60) return `${m}m`;
    const hh = Math.floor(m / 60);
    return hh < 48 ? `${hh}h` : `${Math.floor(hh / 24)}d`;
}

// ---- Menu ------------------------------------------------------------------

function menuView(c: Ctx): HTMLElement {
    const st = c.state;
    const keep = h("select");
    for (const [v, label] of [["plain", "Keep everything"], ["enchanted", "Keep enchanted and better"], ["rare", "Keep rares only"]] as const) {
        const o = h("option", { text: label, attrs: { value: v } });
        if (st.settings.keep === v) o.selected = true;
        keep.append(o);
    }
    keep.addEventListener("change", () => c.act(s => { s.settings.keep = keep.value as typeof s.settings.keep; }));
    const auto = h("input", { attrs: { type: "checkbox" } });
    auto.checked = st.settings.autoEquip;
    auto.addEventListener("change", () => c.act(s => { s.settings.autoEquip = auto.checked; }));

    const out = h("textarea", { attrs: { readonly: "", placeholder: "Press Export" } });
    const inp = h("textarea", { attrs: { placeholder: "Paste an HM1: export here" } });
    const t = st.totals;
    return h("div", { class: "grid2" },
        h("div", { class: "card col" }, h("h3", { text: "Loot" }),
            h("label", { class: "chk" }, auto, "Equip upgrades automatically"),
            filterEditor(c),
            h("div", { class: "row" }, "Otherwise", keep),
            h("div", { class: "muted", style: "font-size:11px", text: "Rules run top to bottom; the first match decides. Salvaged items become ember dust." })),
        h("div", { class: "card col" }, h("h3", { text: "Save" }),
            h("div", { class: "muted", style: "font-size:11px", text: `Saved in ${c.storeKind === "indexeddb" ? "this Discord profile (IndexedDB)" : "memory only: export to keep it"}.` }),
            h("div", { class: "row" }, h("button", { class: "btn", text: "Export", on: { click: () => { out.value = c.exportSave(); out.select(); } } }),
                h("button", { class: "btn alt", text: "Copy", on: { click: () => { out.select(); void navigator.clipboard?.writeText(out.value).then(() => c.toast("Copied"), () => c.toast("Select and copy it by hand")); } } })),
            out, inp,
            h("div", { class: "row" }, h("button", { class: "btn alt", text: "Import", on: { click: () => { void c.importSave(inp.value).then(e => c.toast(e ?? "Save loaded")); } } }))),
        h("div", { class: "card" }, h("h3", { text: "Totals" }), kv([
            ["Runs", fmt(t.runs)], ["Kills", fmt(t.kills)], ["Deaths", fmt(t.deaths)], ["Items found", fmt(t.items)], ["Salvaged", fmt(t.salvaged)],
            ["Time simulated", `${(t.simMs / 3600e3).toFixed(1)} h`]])),
        h("div", { class: "card col" }, h("h3", { text: "Danger" }),
            h("button", { class: "btn hot", text: "Start a new hero", on: { click: () => {
                const close = c.modal(h("div", { class: "card col" }, h("h3", { text: "Start over?" }),
                    h("div", { text: "This deletes the current hero. Export first if you want to keep it." }),
                    h("div", { class: "row" }, h("button", { class: "btn hot", text: "Delete and start over", on: { click: () => { close(); c.resetGame(); } } }),
                        h("button", { class: "btn alt", text: "Cancel", on: { click: () => close() } }))));
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
            h("span", { class: "grow", style: `font-size:12px;${r.on ? "" : "opacity:.5"}`, text: describeRule(r) }),
            h("button", { class: "x", text: "^", title: "Move up", on: { click: () => edit(rs => { if (i > 0) [rs[i - 1], rs[i]] = [rs[i]!, rs[i - 1]!]; }) } }),
            h("button", { class: "x", text: "x", title: "Delete", on: { click: () => edit(rs => { rs.splice(i, 1); }) } })));
    });
    const action = h("select");
    for (const a of ["keep", "salvage"]) action.append(h("option", { text: a, attrs: { value: a } }));
    const rarity = h("select");
    for (const [v, t] of [["", "any rarity"], ["plain", "plain"], ["enchanted", "enchanted"], ["rare", "rare"], ["relic", "relic"]] as const) rarity.append(h("option", { text: t, attrs: { value: v } }));
    const slot = h("select");
    for (const v of ["", "weapon", "offhand", "helmet", "body", "gloves", "boots", "belt", "amulet", "ring"]) slot.append(h("option", { text: v || "any slot", attrs: { value: v } }));
    const minAff = h("select");
    for (const v of ["0", "3", "4", "5", "6"]) minAff.append(h("option", { text: v === "0" ? "any affixes" : `${v}+ affixes`, attrs: { value: v } }));
    box.append(h("div", { class: "row", style: "gap:4px" }, action, rarity, slot, minAff,
        h("button", { class: "btn alt", text: "Add rule", on: { click: () => edit(rs => {
            const r: FilterRule = { on: true, action: action.value as FilterRule["action"] };
            if (rarity.value) r.rarity = [rarity.value as Item["rarity"]];
            if (slot.value) r.slots = [slot.value];
            if (+minAff.value) r.minAffixes = +minAff.value;
            rs.push(r);
        }) } }),
        h("button", { class: "btn alt", text: "Reset", on: { click: () => edit(rs => { rs.splice(0, rs.length, ...structuredClone(DEFAULT_FILTER)); }) } })));
    return box;
}

/** Character creation. */
export function creationView(onStart: (name: string, cls: string) => void): HTMLElement {
    const name = h("input", { attrs: { type: "text", maxlength: "20", value: "Ashling", "aria-label": "Hero name" } });
    let cls = Object.keys(CLASSES)[0]!;
    const list = h("div", { class: "col" });
    const draw = () => {
        clear(list);
        for (const k of Object.values(CLASSES)) list.append(h("div", { class: `skill${k.id === cls ? " on" : ""}`, on: { click: () => { cls = k.id; draw(); } } },
            h("div", { class: "grow" }, h("div", { class: "nm", text: k.name }), h("div", { class: "ds", text: k.blurb }),
                h("div", { class: "ds muted", text: `Might ${k.str} / Grace ${k.dex} / Wit ${k.int}. Starts with ${SKILLS[k.startSkill]!.name} and a ${BASES[k.startWeapon]!.name}.` }))));
    };
    draw();
    return h("div", { class: "col", style: "max-width:520px;margin:0 auto" },
        h("div", { class: "card story", text: "The sun of the March went out three hundred years ago. What is left of it fell as embers, and whoever holds one does not stay dead." }),
        h("div", { class: "card col" }, h("h3", { text: "Name your Kindled" }), name, h("h3", { text: "Choose a calling" }), list,
            h("button", { class: "btn hot", text: "Wake up", on: { click: () => onStart(name.value.replace(/[^\x20-\x7e]/g, "").trim().slice(0, 20) || "Ashling", cls) } })));
}
