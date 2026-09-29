// The Forge: spend crafting currency on stash or equipped items, or buy it
// with ember dust.

import { CURRENCIES, CURRENCY_ORDER } from "../core/data";
import { applyCurrency, buyCurrency, findItem } from "../core/crafting";
import { itemLabel, baseOf } from "../core/items";
import { SLOTS, type Item } from "../core/types";
import { fmt, h } from "./dom";
import { iconFor } from "./icons";
import { itemCard, type Ctx } from "./views";

export function forgeView(c: Ctx): HTMLElement {
    const st = c.state;
    const items: Item[] = [...SLOTS.map(s => st.hero.equipment[s]).filter((x): x is Item => !!x), ...st.stash];
    const picker = h("div", { class: "stash" });
    for (const it of items) {
        const eq = SLOTS.some(s => st.hero.equipment[s]?.uid === it.uid);
        const cell = h("div", { class: `cell ${it.rarity}${c.sel.uid === it.uid ? " sel" : ""}`, title: itemLabel(it) + (eq ? " (equipped)" : ""),
            on: { click: () => { c.sel = { uid: it.uid }; c.rerender(); } } }, iconFor(baseOf(it).kind, baseOf(it).slot));
        if (eq) cell.append(h("span", { class: "lbl", text: "worn" }));
        picker.append(cell);
    }
    const found = c.sel.uid !== undefined ? findItem(st, c.sel.uid) : null;
    const target = found ? itemCard(found.item, null) : h("div", { class: "card muted", text: "Pick an item to work on." });

    const bench = h("div", { class: "col", style: "gap:6px" });
    for (const id of CURRENCY_ORDER) {
        const def = CURRENCIES[id]!;
        const have = st.currency[id] ?? 0;
        bench.append(h("div", { class: "skill", style: "cursor:default;align-items:center" },
            h("div", { style: `width:14px;height:14px;border:2px solid #111;background:${def.color};flex:none` }),
            h("div", { class: "grow" }, h("div", { class: "nm", text: `${def.name} x${have}` }), h("div", { class: "ds", text: def.blurb })),
            h("button", { class: "btn", text: "Use", attrs: have > 0 && found ? {} : { disabled: "" }, on: { click: () => c.act(s => applyCurrency(s, id, c.sel.uid!), `${def.name} used`) } }),
            h("button", { class: "btn alt", text: `Buy ${def.cost}`, title: "Costs ember dust", attrs: st.dust >= def.cost ? {} : { disabled: "" }, on: { click: () => c.act(s => buyCurrency(s, id)) } })));
    }
    return h("div", { class: "col" },
        h("div", { class: "row" }, h("span", { class: "tag", style: "background:var(--gold)", text: `Ember dust ${fmt(st.dust)}` }),
            h("span", { class: "muted", style: "font-size:11px", text: "Currency drops from champions and bosses; the forge sells it for dust." })),
        h("div", { class: "row", style: "align-items:flex-start;gap:12px" },
            h("div", { class: "col grow", style: "min-width:250px" }, target, h("div", { class: "card" }, h("h3", { text: "Items" }), picker)),
            h("div", { class: "card", style: "flex:1;min-width:260px" }, h("h3", { text: "Currency" }), bench)));
}
