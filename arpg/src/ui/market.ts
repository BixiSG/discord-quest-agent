// The Market tab (round 5): the Wandering Market's traders. Stock rotates on
// the hero's clock; a paid refresh rolls it now. Gear shows the same compare
// as the Gear tab and says when it would be an upgrade.

import { slotsFor } from "../core/data";
import { buyGear, buyStone, marketOpen, nextStockIn, refreshCost, refreshMarket, tickMarket } from "../core/market";
import { upgradeSlot } from "../core/game";
import { baseOf } from "../core/items";
import type { GameState } from "../core/state";
import { fmt, fmtDuration, h } from "./dom";
import { itemIcon } from "./gfx/itemart";
import { glyph } from "./glyphs";
import { itemCard, withTip, type Ctx } from "./views";
import { stoneChip, stoneTip } from "./stones";
import { hint } from "./hints";
import { t } from "../i18n";
import { itemName, monsterName, stoneFullName } from "../i18n/names";

/** What the Market tab depends on. */
export function marketSig(s: GameState): string {
    const m = s.market;
    return `${marketOpen(s)}:${m?.seq ?? 0}:${m?.pedlar.map(o => (o.sold ? 1 : 0)).join("")}:${m?.jeweller.map(o => (o.sold ? 1 : 0)).join("")}:${Math.ceil(nextStockIn(s) / 60e3)}:${Math.floor(s.dust / 50)}:${s.hero.rev}`;
}

export function marketView(c: Ctx): HTMLElement {
    const st = c.state;
    const root = h("div", { class: "col market", style: "gap:14px" });
    if (!marketOpen(st)) {
        root.append(h("div", { class: "card" }, h("h3", { text: t("market.title") }),
            h("div", { class: "note" }, glyph("market", 16), h("span", { text: t("market.closed", { boss: monsterName("tidewarden") }) }))));
        return root;
    }
    // First visit, or the stock is overdue (it rotates as runs end): the caravan unpacks.
    if (!st.market.pedlar.length || nextStockIn(st) === 0) tickMarket(st);
    const cost = refreshCost(st);
    root.append(h("div", { class: "card" },
        h("h3", { class: "split" }, h("span", { text: t("market.title") }), h("span", { class: "num", text: t("market.next", { time: fmtDuration(nextStockIn(st)) }) })),
        h("div", { class: "row", style: "justify-content:space-between;gap:8px" },
            h("span", { class: "tag", style: "background:var(--gold);color:#1a1410", text: t("gear.dust", { n: fmt(st.dust) }) }),
            h("button", { class: "btn alt small", text: t("market.refresh", { cost: fmt(cost) }), title: t("market.refreshTip", { cost: fmt(cost) }), attrs: st.dust >= cost ? {} : { disabled: "" },
                on: { click: () => c.act(refreshMarket) } }))));
    const tip = hint(c, "market");
    if (tip) root.append(tip);

    // The Pedlar: gear, each with its price and Buy.
    const gear = h("div", { class: "offers" });
    st.market.pedlar.forEach((o, i) => {
        const it = o.item;
        const up = !o.sold && !!upgradeSlot(st, it);
        const cell = h("div", { class: `cell ${it.rarity}${o.sold ? " sold" : ""}${up ? " upg" : ""}`, attrs: { role: "img", "aria-label": itemName(it) } }, itemIcon(it));
        withTip(cell, c, () => { const targets = slotsFor(baseOf(it)); return itemCard(it, c, { compareSlot: upgradeSlot(st, it) ?? targets.find(x => !st.hero.equipment[x]) ?? targets[0]! }); });
        gear.append(h("div", { class: `offer${o.sold ? " sold" : ""}` }, cell,
            h("div", { class: "col grow", style: "gap:3px;min-width:0" },
                h("b", { class: `name ${it.rarity}`, text: itemName(it) }),
                up ? h("span", { class: "tag up", text: t("market.upgrade") }) : null),
            o.sold ? h("span", { class: "muted", text: t("market.sold") })
                : h("button", { class: "btn small", text: t("market.buy", { cost: fmt(o.price) }), attrs: st.dust >= o.price ? {} : { disabled: "" },
                    on: { click: () => c.act(s => buyGear(s, i), t("market.bought", { name: itemName(it) })) } })));
    });
    root.append(h("div", { class: "card" }, h("h3", { text: t("market.pedlar") }),
        h("div", { class: "muted", style: "font-size:12px;margin-bottom:8px", text: t("market.pedlarNote") }), gear));

    // The Jeweller: stones.
    const stones = h("div", { class: "offers" });
    st.market.jeweller.forEach((o, i) => {
        const chip = stoneChip(o.key, 22);
        chip.dataset.tip = stoneTip(o.key);
        stones.append(h("div", { class: `offer${o.sold ? " sold" : ""}` }, h("span", { class: "stonebig" }, chip),
            h("b", { class: "grow", text: stoneFullName(o.key) }),
            o.sold ? h("span", { class: "muted", text: t("market.sold") })
                : h("button", { class: "btn small", text: t("market.buy", { cost: fmt(o.price) }), attrs: st.dust >= o.price ? {} : { disabled: "" },
                    on: { click: () => c.act(s => buyStone(s, i), t("market.bought", { name: stoneFullName(o.key) })) } })));
    });
    root.append(h("div", { class: "card" }, h("h3", { text: t("market.jeweller") }),
        h("div", { class: "muted", style: "font-size:12px;margin-bottom:8px", text: t("market.jewellerNote") }), stones));
    return root;
}
