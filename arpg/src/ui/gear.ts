// The Gear tab: the paper doll, the stash with its filters, search and sort,
// the bulk tools, and drag and drop between them.

import { emptySockets } from "./stones";
import { RELICS, slotsFor } from "../core/data";
import { stoneFullName, affixLine, baseName, className, itemName, relicFlavour, relicLines, relicName } from "../i18n/names";
import { canEquip, equip, salvage, unequip, upgradeSlot, RARITY_RANK, buyStashRoom, codexRarity, equipUpgrades, outdatedItems, ownedItem, setLocked, stashRoomCost, STASH_MAX, STASH_STEP } from "../core/game";
import { baseOf, levelReq, salvageValue } from "../core/items";
import type { GameState } from "../core/state";
import { SLOTS, type Item, type Slot } from "../core/types";
import { clear, fmt, h } from "./dom";
import { itemIcon } from "./gfx/itemart";
import { spriteCanvas } from "./gfx/sprites";
import { HERO_CAST } from "./gfx/cast";
import { glyph } from "./glyphs";
import { lang, t, tn } from "../i18n";
import { tErr } from "../i18n/errors";
import { SLOT_LABEL, chips } from "./common";
import { dnd, gridSep, hideTip, itemCard, itemCell, lockBadge, markWorn, placeBeside, withTip } from "./itemui";
import type { Ctx } from "./views";

type GearFilter = "all" | "upgrades" | "weapons" | "armour" | "jewellery" | "sockets" | "relics";

type GearSort = "rarity" | "level" | "slot";

/** Stash view options and marked items: kept for the session, not saved. */
const gearOpts: { filter: GearFilter; sort: GearSort; marks: Set<number>; query: string } = { filter: "all", sort: "rarity", marks: new Set(), query: "" };

/** Everything the stash search reads, in the language on screen: names, base, slot, affix and relic lines, stones. */
function searchText(it: Item): string {
    const b = baseOf(it);
    return [itemName(it), baseName(b.id), SLOT_LABEL(b.slot as Slot), ...it.affixes.map(a => affixLine(a)), ...relicLines(it),
        ...(it.stones ?? []).filter((k): k is string => !!k).map(k => stoneFullName(k))].join("\n").toLowerCase();
}

/** Every word of the query is in the item's text (any order). */
const matchesQuery = (text: string, q: string) => q.trim().toLowerCase().split(/\s+/).every(w => text.includes(w));

/** Shows only the stash cells that match the search, in place (typing never rebuilds the view). */
function applySearch(grid: HTMLElement): void {
    const q = gearOpts.query.trim();
    let shown = 0;
    for (const cell of grid.querySelectorAll<HTMLElement>(".cell[data-uid]")) {
        const ok = !q || matchesQuery(cell.dataset.q ?? "", q);
        cell.hidden = !ok;
        if (ok) shown++;
    }
    for (const cell of grid.querySelectorAll<HTMLElement>(".cell.empty")) cell.hidden = !!q;
    grid.querySelector(".nomatch")?.toggleAttribute("hidden", !q || shown > 0);
}

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

export function gearView(c: Ctx): HTMLElement {
    const st = c.state;
    const eq = st.hero.equipment;
    hideTip(); dnd.drag = null; c.hold = false;
    const root = h("div", { class: "gear" });
    const endDrag = () => { dnd.drag = null; c.hold = false; root.classList.remove("dragging"); root.querySelectorAll(".drop-ok, .over").forEach(e => e.classList.remove("drop-ok", "over")); };
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
            if (dnd.drag) return;
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
            cell.addEventListener("dragstart", e => { dnd.drag = { slot: s }; c.hold = true; hideTip(); root.classList.add("dragging"); e.dataTransfer?.setData("text/plain", "slot:" + s); if (e.dataTransfer) e.dataTransfer.effectAllowed = "move"; });
            cell.addEventListener("dragend", endDrag);
        }
        // Drop a stash or relic-case item on a slot it fits.
        cell.addEventListener("dragover", e => {
            const it2 = dnd.drag?.uid !== undefined ? ownedItem(st, dnd.drag.uid) : undefined;
            if (it2 && slotsFor(baseOf(it2)).includes(s) && !canEquip(st, it2, s)) { e.preventDefault(); cell.classList.add("over"); }
        });
        cell.addEventListener("dragleave", () => cell.classList.remove("over"));
        cell.addEventListener("drop", e => {
            e.preventDefault();
            const uid = dnd.drag?.uid;
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
        cell.dataset.q = searchText(it);
        // Hover a stash item: the worn piece it would replace glows on the doll.
        cell.addEventListener("mouseenter", () => {
            if (dnd.drag) return;
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
            dnd.drag = { uid: it.uid }; c.hold = true; hideTip(); root.classList.add("dragging");
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
    const inFilter = (it: Item, f: GearFilter) => f === "all" || (f === "upgrades" ? ups.has(it.uid) : f === "sockets" ? emptySockets(it) > 0 : groupOf(it) === f);
    const count = (f: GearFilter) => f === "relics" ? st.relics.length : st.stash.filter(it => inFilter(it, f)).length;
    const wornEmpty = SLOTS.filter(s => eq[s] && emptySockets(eq[s]!) > 0);
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
                h("div", { class: "muted", text: seen ? tn("gear.foundTimes", seen) : def.season ? t("hollow.onlyTip") : t("gear.dropsFrom", { n: def.level }) }),
                seen ? h("div", { class: "muted", style: "font-style:italic;margin-top:4px", text: relicFlavour(def.id) }) : null));
            grid.append(ghost);
        }
    } else {
        const shown = st.stash.filter(it => inFilter(it, gearOpts.filter));
        const byRarity = (a: Item, b: Item) => RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity] || b.ilvl - a.ilvl;
        shown.sort(gearOpts.sort === "level" ? (a, b) => b.ilvl - a.ilvl || byRarity(a, b)
            : gearOpts.sort === "slot" ? (a, b) => SLOT_ORDER.indexOf(baseOf(a).slot) - SLOT_ORDER.indexOf(baseOf(b).slot) || byRarity(a, b)
            : byRarity);
        // A group (weapons, armour, jewellery) shows what is worn in it first, framed in gold, to compare at a glance.
        const grouped = gearOpts.filter !== "all" && gearOpts.filter !== "upgrades";
        const worn = gearOpts.filter === "sockets" ? wornEmpty : grouped ? SLOTS.filter(s => eq[s] && groupOf(eq[s]!) === gearOpts.filter) : [];
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
        if (shown.length) { grid.append(h("div", { class: "muted nomatch", style: "grid-column:1/-1;padding:6px 0", text: t("gear.noMatch") })); applySearch(grid); }
    }
    // Drop an equipped item anywhere on the stash to take it off.
    grid.addEventListener("dragover", e => { if (dnd.drag?.slot) { e.preventDefault(); grid.classList.add("over"); } });
    grid.addEventListener("dragleave", () => grid.classList.remove("over"));
    grid.addEventListener("drop", e => { e.preventDefault(); const s = dnd.drag?.slot; endDrag(); if (s) c.act(x => unequip(x, s)); });

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
    // Search: filters the cells in place while typing; rebuilds wait until the field is left.
    const search = h("input", { class: "search", attrs: { type: "search", placeholder: t("gear.search"), "aria-label": t("gear.searchAria"), spellcheck: "false" } }) as HTMLInputElement;
    search.value = gearOpts.query;
    search.addEventListener("input", () => { gearOpts.query = search.value; applySearch(grid); });
    search.addEventListener("focus", () => { c.hold = true; });
    search.addEventListener("blur", () => { c.hold = false; });
    search.addEventListener("keydown", e => { if (e.key === "Escape" && search.value) { e.stopPropagation(); e.preventDefault(); search.value = gearOpts.query = ""; applySearch(grid); } });
    const filters = (["all", "upgrades", "weapons", "armour", "jewellery", "sockets", "relics"] as const)
        .filter(f => f !== "sockets" || gearOpts.filter === "sockets" || count("sockets") > 0 || wornEmpty.length > 0);
    const stashCard = h("div", { class: "card" }, head, note,
        h("div", { class: "row", style: "margin-bottom:8px;justify-content:space-between;flex-wrap:wrap;gap:6px" },
            chips<GearFilter>(filters.map(f => [f, t(`gear.${f}`), f === "sockets" ? count(f) + wornEmpty.length : count(f)] as [GearFilter, string, number]),
                gearOpts.filter, v => { gearOpts.filter = v; c.sel = {}; c.rerender(); }),
            relicsTab ? null : h("div", { class: "row", style: "gap:6px" }, search, sort)),
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
    anvil.addEventListener("dragover", e => { if (dnd.drag?.uid !== undefined) { e.preventDefault(); anvil.classList.add("over"); } });
    anvil.addEventListener("dragleave", () => anvil.classList.remove("over"));
    anvil.addEventListener("drop", e => { e.preventDefault(); const uid = dnd.drag?.uid; endDrag(); if (uid !== undefined) c.act(x => { if (!salvage(x, [uid])) return t("gear.lockedNoSalvage"); c.sel = {}; }); });
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
