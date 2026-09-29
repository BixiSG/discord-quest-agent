// The Forge: spend crafting currency on stash or equipped items, or buy it
// with ember dust. Laid out like a smithy: the items rack on the left, the
// piece being worked on the anvil, the currency orbs on a shelf.

import { CURRENCIES, CURRENCY_ORDER } from "../core/data";
import { applyCurrency, buyCurrency, findItem, forgeCost, forgeRare, maxIlvl } from "../core/crafting";
import { itemLabel } from "../core/items";
import { SLOTS, type Item } from "../core/types";
import { fmt, h } from "./dom";
import { itemIcon } from "./gfx/itemart";
import { spriteCanvas } from "./gfx/sprites";
import { glyph } from "./glyphs";
import { itemCard, withTip, type Ctx } from "./views";

const SLOT_NAMES: Record<string, string> = { weapon: "Weapon", offhand: "Off-hand", helmet: "Helm", body: "Body", gloves: "Gloves", boots: "Boots", belt: "Belt", amulet: "Amulet", ring1: "Ring", ring2: "Ring 2" };

export function forgeView(c: Ctx): HTMLElement {
    const st = c.state;
    const items: Item[] = [...SLOTS.map(s => st.hero.equipment[s]).filter((x): x is Item => !!x), ...st.stash];
    const rack = h("div", { class: "stash" });
    for (const it of items) {
        const worn = SLOTS.some(s => st.hero.equipment[s]?.uid === it.uid);
        const cell = h("div", { class: `cell ${it.rarity}${c.sel.uid === it.uid ? " sel" : ""}`, attrs: { "aria-label": itemLabel(it) + (worn ? " (worn)" : ""), role: "button", tabindex: "0" },
            on: { click: () => { c.sel = { uid: it.uid }; c.rerender(); } } }, itemIcon(it));
        withTip(cell, c, () => itemCard(it, null));
        if (worn) cell.append(h("span", { class: "worn", text: "worn" }));
        rack.append(cell);
    }
    const found = c.sel.uid !== undefined ? findItem(st, c.sel.uid) : null;

    // The anvil: the picked item, big, with its card.
    const anvil = h("div", { class: "card anvilcard" }, h("h3", { text: "On the anvil" }));
    if (found) {
        const big = itemIcon(found.item);
        big.classList.add("anvil-art");
        anvil.append(h("div", { class: `anvil-plate ${found.item.rarity}` }, big), itemCard(found.item, null));
    } else anvil.append(h("div", { class: "anvil-plate empty" }, glyph("forge", 44)), h("div", { class: "muted", style: "text-align:center", text: "Pick an item from the rack to work on it." }));

    // The shelf: one orb per currency, with what it does, how many, use and buy.
    const shelf = h("div", { class: "shelf" });
    for (const id of CURRENCY_ORDER) {
        const def = CURRENCIES[id]!;
        const have = st.currency[id] ?? 0;
        const art = spriteCanvas(`cur.${id}`) ?? h("span", { style: `display:block;width:24px;height:24px;background:${def.color};border:2px solid #111` });
        shelf.append(h("div", { class: `cur${have ? "" : " none"}` },
            h("div", { class: "orb" }, art, h("span", { class: "count num", text: have > 99 ? "99+" : String(have) })),
            h("div", { class: "grow" }, h("b", { text: def.name }), h("span", { text: def.blurb })),
            h("div", { class: "col", style: "gap:4px" },
                h("button", { class: "btn small", text: "Use", attrs: have > 0 && found ? {} : { disabled: "" }, title: found ? `Use on ${itemLabel(found.item)}` : "Pick an item first",
                    on: { click: () => c.act(s => applyCurrency(s, id, c.sel.uid!), `${def.name} used`) } }),
                h("button", { class: "btn alt small", text: `Buy ${def.cost}`, title: `Costs ${def.cost} ember dust`, attrs: st.dust >= def.cost ? {} : { disabled: "" },
                    on: { click: () => c.act(s => buyCurrency(s, id)) } }))));
    }

    // Forge a fresh rare for a slot.
    const cost = forgeCost(st);
    const smith = h("div", { class: "smith" });
    for (const slot of SLOTS) {
        smith.append(h("button", { class: "btn alt small", text: SLOT_NAMES[slot], title: st.dust >= cost ? `Forge a rare ${SLOT_NAMES[slot]!.toLowerCase()} for ${fmt(cost)} dust` : `Needs ${fmt(cost)} ember dust`, attrs: st.dust >= cost ? {} : { disabled: "" },
            on: { click: () => c.act(s => { const r = forgeRare(s, slot); if (!r.err && r.item) c.sel = { uid: r.item.uid }; return r.err; }, "Forged a rare") } }));
    }
    const dust = h("div", { class: "dust" }, glyph("forge", 20), h("b", { class: "num", text: fmt(st.dust) }), h("span", { text: "ember dust" }));

    return h("div", { class: "col", style: "gap:14px" },
        h("div", { class: "card" }, h("h3", { class: "split" }, h("span", { text: "Forge a rare" }), h("span", { class: "num", text: `${fmt(cost)} dust / item level ${maxIlvl(st)}` })),
            h("div", { class: "row", style: "align-items:center;gap:12px" }, dust,
                h("div", { class: "muted grow", style: "font-size:12px", text: "A random rare for the slot at the highest item level you have reached. Upgrades are worn at once. Currency drops from champions and bosses; the shelf sells it for dust." })),
            smith,
            st.dust < cost ? h("div", { class: "note", style: "margin-top:10px" }, glyph("forge", 16),
                h("span", { text: `${fmt(cost - st.dust)} more ember dust for a rare. Salvaging drops on the Gear tab (or a loot rule that salvages) makes dust.` })) : null),
        h("div", { class: "smithy" },
            h("div", { class: "card" }, h("h3", { text: "Rack" }), rack),
            anvil,
            h("div", { class: "card" }, h("h3", { text: "Currency" }), shelf)));
}
