// The Forge: spend crafting currency on stash or equipped items, or buy it
// with ember dust. Laid out like a smithy: the items rack on the left, the
// piece being worked on the anvil (with the hone and the bench), the currency
// orbs on a shelf.

import { CURRENCIES, CURRENCY_ORDER } from "../core/data";
import { applyCurrency, benchCraft, benchDust, benchOptions, BENCH_GRAFTS, buyCurrency, craftUntilUpgrade, findItem, forgeCost, forgeRare, forgeUntilUpgrade, hone, honeCost, MAX_QUALITY, maxIlvl, REROLLS } from "../core/crafting";
import { setLocked } from "../core/game";
import { baseOf, itemLabel } from "../core/items";
import { SLOTS, type Item } from "../core/types";
import { fmt, h } from "./dom";
import { itemIcon } from "./gfx/itemart";
import { spriteCanvas } from "./gfx/sprites";
import { glyph } from "./glyphs";
import { itemCard, withTip, type Ctx } from "./views";

const SLOT_NAMES: Record<string, string> = { weapon: "Weapon", offhand: "Off-hand", helmet: "Helm", body: "Body", gloves: "Gloves", boots: "Boots", belt: "Belt", amulet: "Amulet", ring1: "Ring", ring2: "Ring 2" };

/** Forge a rare: one at a time, or up to ten until one is worth wearing. Kept for the session. */
const forgeOpts = { until: false };

export function forgeView(c: Ctx): HTMLElement {
    const st = c.state;
    const items: Item[] = [...SLOTS.map(s => st.hero.equipment[s]).filter((x): x is Item => !!x), ...st.stash, ...st.relics];
    const rack = h("div", { class: "stash" });
    for (const it of items) {
        const worn = SLOTS.some(s => st.hero.equipment[s]?.uid === it.uid);
        const cell = h("div", { class: `cell ${it.rarity}${c.sel.uid === it.uid ? " sel" : ""}`, attrs: { "aria-label": itemLabel(it) + (worn ? " (worn)" : ""), role: "button", tabindex: "0" },
            on: { click: () => { c.sel = { uid: it.uid }; c.rerender(); } } }, itemIcon(it));
        withTip(cell, c, () => itemCard(it, null));
        if (worn) cell.append(h("span", { class: "worn", text: "worn" }));
        if (it.locked) cell.append(h("span", { class: "lockb", attrs: { "aria-hidden": "true" } }, glyph("lock", 9)));
        rack.append(cell);
    }
    const found = c.sel.uid !== undefined ? findItem(st, c.sel.uid) : null;
    const inStash = !!found && !found.slot;

    // The anvil: the picked item, big, with its card, then the hone and the bench.
    const anvil = h("div", { class: "card anvilcard" }, h("h3", { text: "On the anvil" }));
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
        if (canHone) work.append(h("div", { class: "wrow" }, h("b", { text: "Hone" }),
            h("div", { class: "qbar", title: `${q}% / ${MAX_QUALITY}% quality` }, h("i", { style: `width:${(q / MAX_QUALITY) * 100}%` })),
            h("span", { class: "num", text: `${q}%` }),
            h("button", { class: "btn small", text: hc === null ? "Max" : `+1% for ${fmt(hc)}`, attrs: { "data-key": "h", ...(hc === null || st.dust < hc ? { disabled: "" } : {}) },
                title: hc === null ? "Fully honed" : `Each point of quality is 1% increased ${baseOf(it).weapon ? "physical damage" : "defences"} on the item itself (H)`,
                on: { click: () => c.act(s => hone(s, it.uid)) } })));
        // Bench: a chosen affix, one per item.
        const opts = benchOptions(it);
        if (it.rarity === "enchanted" || it.rarity === "rare") {
            const pick = h("select", { attrs: { "aria-label": "Affix to add at the bench" } });
            const benched = it.affixes.find(a => a.bench);
            for (const a of opts.sort((x, y) => (x.type === y.type ? x.text.localeCompare(y.text) : x.type === "prefix" ? -1 : 1))) {
                pick.append(h("option", { text: `${a.type === "prefix" ? "P" : "S"}: ${a.text.replace(/\{\d\}/g, "#")}`, attrs: { value: a.id } }));
            }
            const dust = benchDust(it), grafts = st.currency.graft ?? 0;
            const ok = opts.length > 0 && grafts >= BENCH_GRAFTS && st.dust >= dust;
            work.append(h("div", { class: "wrow" }, h("b", { text: "Bench" }),
                opts.length ? pick : h("span", { class: "muted grow", text: "No room for another affix." }),
                h("button", { class: "btn small", text: `${benched ? "Replace" : "Add"}: ${BENCH_GRAFTS} Graft + ${fmt(dust)}`, attrs: ok ? {} : { disabled: "" },
                    title: `Adds the chosen affix at a random tier the item level allows.${benched ? " Replaces the affix benched before." : ""} You have ${grafts} Graft.`,
                    on: { click: () => c.act(s => benchCraft(s, it.uid, pick.value), "Benched") } })));
        }
        work.append(h("div", { class: "wrow" }, h("b", { text: "Keep" }),
            h("span", { class: "muted grow", style: "font-size:12px", text: it.locked ? "Locked: upkeep and bulk salvage leave it alone." : "Unlocked: upkeep may swap it for a better drop." }),
            h("button", { class: "btn alt small", text: it.locked ? "Unlock" : "Lock", attrs: { "data-key": "l" }, on: { click: () => c.act(s => setLocked(s, it.uid, !it.locked)) } })));
        anvil.append(work);
    } else anvil.append(h("div", { class: "anvil-plate empty" }, glyph("forge", 44)), h("div", { class: "muted", style: "text-align:center", text: "Pick an item from the rack to work on it." }));

    // The shelf: one orb per currency, with what it does, how many, use and buy.
    const shelf = h("div", { class: "shelf" });
    for (const id of CURRENCY_ORDER) {
        const def = CURRENCIES[id]!;
        const have = st.currency[id] ?? 0;
        const art = spriteCanvas(`cur.${id}`) ?? h("span", { style: `display:block;width:24px;height:24px;background:${def.color};border:2px solid #111` });
        const reroll = REROLLS.includes(id);
        const buy = (e: MouseEvent) => { const n = e.shiftKey ? 10 : 1; c.act(s => buyCurrency(s, id, n), n > 1 ? `Bought ${n} ${def.name}` : undefined); };
        shelf.append(h("div", { class: `cur${have ? "" : " none"}` },
            h("div", { class: "orb" }, art, h("span", { class: "count num", text: have > 999 ? "999+" : String(have) })),
            h("div", { class: "grow" }, h("b", { text: def.name }), h("span", { text: def.blurb })),
            h("div", { class: "col", style: "gap:4px" },
                h("button", { class: "btn small", text: "Use", attrs: have > 0 && found ? {} : { disabled: "" }, title: found ? `Use on ${itemLabel(found.item)}` : "Pick an item first",
                    on: { click: () => c.act(s => applyCurrency(s, id, c.sel.uid!), `${def.name} used`) } }),
                reroll ? h("button", { class: "btn small", text: "Until upgrade", attrs: have > 0 && inStash ? {} : { disabled: "" },
                    title: inStash ? `Use ${def.name} again and again (up to 20) until ${itemLabel(found!.item)} beats what you wear` : "Pick a stash item first",
                    on: { click: () => c.act(s => { const r = craftUntilUpgrade(s, id, c.sel.uid!, 20); if (!r.err) c.toast(r.upgrade ? `Upgrade after ${r.used} ${def.name}` : `No upgrade after ${r.used} ${def.name}`); return r.err; }) } }) : null,
                h("button", { class: "btn alt small", text: `Buy ${def.cost}`, title: `Costs ${def.cost} ember dust; shift-click buys 10`, attrs: st.dust >= def.cost ? {} : { disabled: "" },
                    on: { click: buy } }))));
    }

    // Forge a fresh rare for a slot.
    const cost = forgeCost(st);
    const smith = h("div", { class: "smith" });
    for (const slot of SLOTS) {
        smith.append(h("button", { class: "btn alt small", text: SLOT_NAMES[slot], title: st.dust >= cost ? (forgeOpts.until ? `Forge rares for the ${SLOT_NAMES[slot]!.toLowerCase()} slot until one beats what you wear (up to 10 at ${fmt(cost)} dust each; misses are salvaged)` : `Forge a rare ${SLOT_NAMES[slot]!.toLowerCase()} for ${fmt(cost)} dust`) : `Needs ${fmt(cost)} ember dust`, attrs: st.dust >= cost ? {} : { disabled: "" },
            on: { click: () => c.act(s => {
                if (forgeOpts.until) {
                    const r = forgeUntilUpgrade(s, slot, 10);
                    if (!r.err) c.toast(r.item ? `Forged ${r.made}: wearing ${itemLabel(r.item)}` : `Forged ${r.made}, none better than what you wear`);
                    return r.err;
                }
                const r = forgeRare(s, slot); if (!r.err && r.item) c.sel = { uid: r.item.uid }; return r.err;
            }, forgeOpts.until ? undefined : "Forged a rare") } }));
    }
    const until = h("button", { class: `toggle${forgeOpts.until ? " on" : ""}`, attrs: { role: "switch", "aria-checked": String(forgeOpts.until) }, on: { click: () => { forgeOpts.until = !forgeOpts.until; c.rerender(); } } },
        h("i"), h("span", null, h("b", { text: "Until upgrade" }), h("small", { text: "Up to 10 rares, stop at the first worth wearing; misses become dust." })));
    const dust = h("div", { class: "dust" }, glyph("forge", 20), h("b", { class: "num", text: fmt(st.dust) }), h("span", { text: "ember dust" }));

    return h("div", { class: "col", style: "gap:14px" },
        h("div", { class: "card" }, h("h3", { class: "split" }, h("span", { text: "Forge a rare" }), h("span", { class: "num", text: `${fmt(cost)} dust / item level ${maxIlvl(st)}` })),
            h("div", { class: "row", style: "align-items:center;gap:12px" }, dust,
                h("div", { class: "muted grow", style: "font-size:12px", text: "A random rare for the slot at the highest item level you have reached. Upgrades are worn at once. Currency drops from champions and bosses; the shelf sells it for dust." }),
                until),
            smith,
            st.dust < cost ? h("div", { class: "note", style: "margin-top:10px" }, glyph("forge", 16),
                h("span", { text: `${fmt(cost - st.dust)} more ember dust for a rare. Salvaging drops on the Gear tab (or a loot rule that salvages) makes dust.` })) : null),
        h("div", { class: "smithy" },
            h("div", { class: "card" }, h("h3", { text: "Rack" }), rack),
            anvil,
            h("div", { class: "card" }, h("h3", { text: "Currency" }), shelf)));
}
