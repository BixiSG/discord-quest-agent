// The Forge: spend crafting currency on stash or equipped items, or buy it
// with ember dust. Laid out like a smithy: the items rack on the left, the
// piece being worked on the anvil (with the hone and the bench), the currency
// orbs on a shelf.

import { CURRENCIES, CURRENCY_ORDER } from "../core/data";
import { applyCurrency, benchCraft, benchDust, benchOptions, BENCH_GRAFTS, buyCurrency, craftUntilUpgrade, findItem, forgeCost, forgeRare, forgeUntilUpgrade, hone, honeCost, MAX_QUALITY, maxIlvl, REROLLS } from "../core/crafting";
import { setLocked } from "../core/game";
import { baseOf } from "../core/items";
import { SLOTS, type Item } from "../core/types";
import { fmt, h } from "./dom";
import { itemIcon } from "./gfx/itemart";
import { spriteCanvas } from "./gfx/sprites";
import { glyph } from "./glyphs";
import { itemCard, markWorn, withTip, type Ctx } from "./views";
import { lang, t } from "../i18n";
import { affixTemplate, currencyBlurb, currencyName, itemName } from "../i18n/names";

const SLOT_NAMES = (slot: string) => t(`slot.${slot}`);

/** Forge a rare: one at a time, or up to ten until one is worth wearing. Kept for the session. */
const forgeOpts = { until: false };

export function forgeView(c: Ctx): HTMLElement {
    const st = c.state;
    // The rack in three groups: what is worn (framed in gold), the stash, the relic case.
    const rack = h("div", { class: "stash" });
    const cellFor = (it: Item) => {
        const cell = h("div", { class: `cell ${it.rarity}${c.sel.uid === it.uid ? " sel" : ""}`, attrs: { "aria-label": itemName(it), role: "button", tabindex: "0" },
            on: { click: () => { c.sel = { uid: it.uid }; c.rerender(); } } }, itemIcon(it));
        withTip(cell, c, () => itemCard(it, null));
        if (it.locked) cell.append(h("span", { class: "lockb", attrs: { "aria-hidden": "true" } }, glyph("lock", 9)));
        return cell;
    };
    const group = (label: string, list: Item[], worn = false) => {
        if (!list.length) return;
        rack.append(h("div", { class: "gridsep", text: t("common.count", { label, n: list.length }) }));
        for (const it of list) {
            const cell = cellFor(it);
            if (worn) markWorn(cell, SLOTS.find(s => st.hero.equipment[s] === it));
            rack.append(cell);
        }
    };
    group(t("forge.worn"), SLOTS.map(s => st.hero.equipment[s]).filter((x): x is Item => !!x), true);
    group(t("forge.stash"), st.stash);
    group(t("forge.case"), st.relics);
    const found = c.sel.uid !== undefined ? findItem(st, c.sel.uid) : null;
    const inStash = !!found && !found.slot;

    // The anvil: the picked item, big, with its card, then the hone and the bench.
    const anvil = h("div", { class: "card anvilcard" }, h("h3", { text: t("forge.anvil") }));
    if (found) {
        const it = found.item;
        const big = itemIcon(it);
        big.classList.add("anvil-art");
        anvil.append(h("div", { class: `anvil-plate ${it.rarity}` }, big), itemCard(it, null));
        const work = h("div", { class: "work" });
        // Hone: quality, a point at a time.
        const hc = honeCost(it);
        const q = it.quality ?? 0;
        const canHone = hc !== null || q >= MAX_QUALITY;
        if (canHone) work.append(h("div", { class: "wrow" }, h("b", { text: t("forge.hone") }),
            h("div", { class: "qbar", title: t("forge.qualityTip", { q, max: MAX_QUALITY }) }, h("i", { style: `width:${(q / MAX_QUALITY) * 100}%` })),
            h("span", { class: "num", text: `${q}%` }),
            h("button", { class: "btn small", text: hc === null ? t("forge.max") : t("forge.honeFor", { cost: fmt(hc) }), attrs: { "data-key": "h", ...(hc === null || st.dust < hc ? { disabled: "" } : {}) },
                title: hc === null ? t("forge.fullyHoned") : t(baseOf(it).weapon ? "forge.honeTipWeapon" : "forge.honeTipArmour"),
                on: { click: () => c.act(s => hone(s, it.uid)) } })));
        // Bench: a chosen affix, one per item.
        const opts = benchOptions(it);
        if (it.rarity === "enchanted" || it.rarity === "rare") {
            const pick = h("select", { attrs: { "aria-label": t("forge.benchAria") } });
            const benched = it.affixes.find(a => a.bench);
            for (const a of opts.sort((x, y) => (x.type === y.type ? affixTemplate(x.id).localeCompare(affixTemplate(y.id), lang()) : x.type === "prefix" ? -1 : 1))) {
                pick.append(h("option", { text: t("forge.benchOption", { ps: t(a.type === "prefix" ? "item.prefix" : "item.suffix"), text: affixTemplate(a.id) }), attrs: { value: a.id } }));
            }
            const dust = benchDust(it), grafts = st.currency.graft ?? 0;
            const ok = opts.length > 0 && grafts >= BENCH_GRAFTS && st.dust >= dust;
            work.append(h("div", { class: "wrow" }, h("b", { text: t("forge.bench") }),
                opts.length ? pick : h("span", { class: "muted grow", text: t("forge.noRoom") }),
                h("button", { class: "btn small", text: t(benched ? "forge.benchReplace" : "forge.benchAdd", { n: BENCH_GRAFTS, dust: fmt(dust) }), attrs: ok ? {} : { disabled: "" },
                    title: [t("forge.benchTip"), benched ? t("forge.benchTipReplace") : "", t("forge.benchHave", { n: grafts })].filter(Boolean).join(" "),
                    on: { click: () => c.act(s => benchCraft(s, it.uid, pick.value), t("forge.benched")) } })));
        }
        work.append(h("div", { class: "wrow" }, h("b", { text: t("forge.keep") }),
            h("span", { class: "muted grow", style: "font-size:12px", text: it.locked ? t("forge.lockedNote") : t("forge.unlockedNote") }),
            h("button", { class: "btn alt small", text: it.locked ? t("gear.unlock") : t("gear.lock"), attrs: { "data-key": "l" }, on: { click: () => c.act(s => setLocked(s, it.uid, !it.locked)) } })));
        anvil.append(work);
    } else anvil.append(h("div", { class: "anvil-plate empty" }, glyph("forge", 44)), h("div", { class: "muted", style: "text-align:center", text: t("forge.pick") }));

    // The shelf: one orb per currency, with what it does, how many, use and buy.
    const shelf = h("div", { class: "shelf" });
    for (const id of CURRENCY_ORDER) {
        const def = CURRENCIES[id]!;
        const have = st.currency[id] ?? 0;
        const art = spriteCanvas(`cur.${id}`) ?? h("span", { style: `display:block;width:24px;height:24px;background:${def.color};border:2px solid #111` });
        const reroll = REROLLS.includes(id);
        const cur = currencyName(id);
        const buy = (e: MouseEvent) => { const n = e.shiftKey ? 10 : 1; c.act(s => buyCurrency(s, id, n), n > 1 ? t("forge.bought", { n, cur }) : undefined); };
        shelf.append(h("div", { class: `cur${have ? "" : " none"}` },
            h("div", { class: "orb" }, art, h("span", { class: "count num", text: have > 999 ? "999+" : String(have) })),
            h("div", { class: "grow" }, h("b", { text: cur }), h("span", { text: currencyBlurb(id) })),
            h("div", { class: "col", style: "gap:4px" },
                h("button", { class: "btn small", text: t("forge.use"), attrs: have > 0 && found ? {} : { disabled: "" }, title: found ? t("forge.useOn", { item: itemName(found.item) }) : t("forge.pickFirst"),
                    on: { click: () => c.act(s => applyCurrency(s, id, c.sel.uid!), t("forge.used", { cur })) } }),
                reroll ? h("button", { class: "btn small", text: t("forge.until"), attrs: have > 0 && inStash ? {} : { disabled: "" },
                    title: inStash ? t("forge.untilTip", { cur, item: itemName(found!.item) }) : t("forge.pickStash"),
                    on: { click: () => c.act(s => { const r = craftUntilUpgrade(s, id, c.sel.uid!, 20); if (!r.err) c.toast(t(r.upgrade ? "forge.upAfter" : "forge.noUpAfter", { n: r.used, cur })); return r.err; }) } }) : null,
                h("button", { class: "btn alt small", text: t("forge.buy", { cost: def.cost }), title: t("forge.buyTip", { cost: def.cost }), attrs: st.dust >= def.cost ? {} : { disabled: "" },
                    on: { click: buy } }))));
    }

    // Forge a fresh rare for a slot.
    const cost = forgeCost(st);
    const smith = h("div", { class: "smith" });
    for (const slot of SLOTS) {
        const slotName = SLOT_NAMES(slot).toLowerCase();
        smith.append(h("button", { class: "btn alt small", text: SLOT_NAMES(slot), title: st.dust >= cost ? t(forgeOpts.until ? "forge.smithUntilTip" : "forge.smithTip", { slot: slotName, cost: fmt(cost) }) : t("forge.needsDust", { cost: fmt(cost) }), attrs: st.dust >= cost ? {} : { disabled: "" },
            on: { click: () => c.act(s => {
                if (forgeOpts.until) {
                    const r = forgeUntilUpgrade(s, slot, 10);
                    if (!r.err) c.toast(r.item ? t("forge.forgedWearing", { n: r.made, item: itemName(r.item) }) : t("forge.forgedNone", { n: r.made }));
                    return r.err;
                }
                const r = forgeRare(s, slot); if (!r.err && r.item) c.sel = { uid: r.item.uid }; return r.err;
            }, forgeOpts.until ? undefined : t("forge.forged")) } }));
    }
    const until = h("button", { class: `toggle${forgeOpts.until ? " on" : ""}`, attrs: { role: "switch", "aria-checked": String(forgeOpts.until) }, on: { click: () => { forgeOpts.until = !forgeOpts.until; c.rerender(); } } },
        h("i"), h("span", null, h("b", { text: t("forge.until") }), h("small", { text: t("forge.untilNote") })));
    const dust = h("div", { class: "dust" }, glyph("forge", 20), h("b", { class: "num", text: fmt(st.dust) }), h("span", { text: t("forge.dust") }));

    return h("div", { class: "col", style: "gap:14px" },
        h("div", { class: "card" }, h("h3", { class: "split" }, h("span", { text: t("forge.title") }), h("span", { class: "num", text: t("forge.costLine", { cost: fmt(cost), ilvl: maxIlvl(st) }) })),
            h("div", { class: "row", style: "align-items:center;gap:12px" }, dust,
                h("div", { class: "muted grow", style: "font-size:12px", text: t("forge.note") }),
                until),
            smith,
            st.dust < cost ? h("div", { class: "note", style: "margin-top:10px" }, glyph("forge", 16),
                h("span", { text: t("forge.moreDust", { n: fmt(cost - st.dust) }) })) : null),
        h("div", { class: "smithy" },
            h("div", { class: "card" }, h("h3", { text: t("forge.rack") }), rack),
            anvil,
            h("div", { class: "card" }, h("h3", { text: t("forge.currency") }), shelf)));
}
