// The Menu tab: loot settings and the filter editor, save export and import,
// totals, and the Rekindling.

import { allShards, sunShards, SUN_PINNACLES } from "../core/echoes";
import { chooseDawnPerk, dawnOf, heirloomCandidates, perksToPick, relightSun } from "../core/dawn";
import { DAWN_PERKS, DAWN_RICHER, DAWN_TOUGHER, DAWN_XP, AFFIXES, CLASSES } from "../core/data";
import { dawnTitle, perkName, perkText, pinName, storyText, className, groupName, itemName, presetBlurb, presetName } from "../i18n/names";
import { hint, hintsSeen } from "./hints";
import { salvage } from "../core/game";
import type { Item } from "../core/types";
import { fmt, h } from "./dom";
import { glyph } from "./glyphs";
import { DEFAULT_FILTER, FILTER_PRESETS, type FilterRule } from "../core/filter";
import { lang, t } from "../i18n";
import { tErr } from "../i18n/errors";
import { kv } from "./common";
import type { Ctx } from "./views";

export function menuView(c: Ctx): HTMLElement {
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
    const autoStones = h("button", { class: `toggle${st.settings.autoStones ? " on" : ""}`, attrs: { role: "switch", "aria-checked": String(st.settings.autoStones) }, on: { click: () => c.act(s => { s.settings.autoStones = !s.settings.autoStones; }) } },
        h("i"), h("span", null, h("b", { text: t("menu.autoStones") }), h("small", { text: t("menu.autoStonesNote") })));

    const out = h("textarea", { attrs: { readonly: "", placeholder: t("menu.exportPh") } });
    const inp = h("textarea", { attrs: { placeholder: t("menu.importPh") } });
    const tot = st.totals;
    return h("div", { class: "grid2" },
        h("div", { class: "card col" }, h("h3", { text: t("menu.loot") }),
            auto, upkeep, autoStones,
            filterEditor(c),
            h("div", { class: "row" }, t("menu.otherwise"), keep),
            h("div", { class: "muted", style: "font-size:12px", text: t("menu.rulesNote") })),
        h("div", { class: "card col" }, h("h3", { text: t("menu.save") }),
            h("div", { class: "muted", style: "font-size:12px", text: c.storeKind === "indexeddb" ? t("menu.savedIdb") : t("menu.savedMem") }),
            h("div", { class: "row" }, h("button", { class: "btn", text: t("menu.export"), on: { click: () => { out.value = c.exportSave(); out.select(); } } }),
                h("button", { class: "btn alt", text: t("menu.copy"), on: { click: () => { out.select(); void navigator.clipboard?.writeText(out.value).then(() => c.toast(t("menu.copied")), () => c.toast(t("menu.copyByHand"))); } } })),
            out, inp,
            h("div", { class: "row" }, h("button", { class: "btn alt", text: t("menu.import"), on: { click: () => { void c.importSave(inp.value).then(e => c.toast(e ? tErr(e) : t("menu.loaded"))); } } }),
                h("button", { class: "btn alt", text: t("menu.hintsAgain"), attrs: hintsSeen(st).length ? {} : { disabled: "" },
                    on: { click: () => c.act(s => { delete s.settings.hints; }, t("menu.hintsBack")) } }))),
        h("div", { class: "card" }, h("h3", { text: t("menu.totals") }), kv([
            [t("menu.runs"), fmt(tot.runs)], [t("menu.kills"), fmt(tot.kills)], [t("menu.deaths"), fmt(tot.deaths)], [t("menu.items"), fmt(tot.items)], [t("menu.salvaged"), fmt(tot.salvaged)], [t("menu.swapped"), fmt(tot.swapped ?? 0)],
            [t("menu.time"), t("menu.hours", { n: (tot.simMs / 3600e3).toFixed(1) })]])),
        rekindleCard(c),
        h("div", { class: "card col" }, h("h3", { text: t("menu.danger") }),
            h("button", { class: "btn hot", text: t("menu.newHero"), on: { click: () => {
                const close = c.modal(h("div", { class: "card col" }, h("h3", { text: t("menu.startOver") }),
                    h("div", { text: t("menu.startOverNote") }),
                    h("div", { class: "row" }, h("button", { class: "btn hot", text: t("menu.deleteStart"), on: { click: () => { close(); c.resetGame(); } } }),
                        h("button", { class: "btn alt", text: t("common.cancel"), on: { click: () => close() } }))));
            } } })),
    );
}

/** The Rekindling: the sun shards held, the relight (with its confirmation), the dawn and its perks. */
function rekindleCard(c: Ctx): HTMLElement {
    const st = c.state;
    const held = sunShards(st);
    const dawn = dawnOf(st);
    const card = h("div", { class: "card col dawncard" }, h("h3", { class: "split" }, h("span", { text: t("dawn.title") }), dawn ? h("span", { class: "tag dawn", text: dawnTitle(dawn) }) : null));
    card.append(h("div", { class: "shards" }, ...SUN_PINNACLES.map(p => h("span", { class: `shard${held.includes(p) ? " on" : ""}`, title: pinName(p) }, glyph("sun", 18))),
        h("b", { text: t("dawn.shards", { n: held.length, total: SUN_PINNACLES.length }) })));
    card.append(h("div", { class: "muted", style: "font-size:12px", text: t("dawn.note", { pins: SUN_PINNACLES.map(p => pinName(p)).join(t("common.list")) }) }));
    if (held.length) { const tip = hint(c, "rekindle"); if (tip) card.append(tip); }
    if (dawn) {
        card.append(h("div", { class: "muted", style: "font-size:12px", text: t("dawn.world", { tough: DAWN_TOUGHER * dawn, rich: DAWN_RICHER * dawn }) }));
        const perks = st.hero.dawn?.perks ?? [];
        if (perks.length) card.append(h("div", { style: "font-size:12px", text: t("dawn.perks", { list: perks.map(p => perkName(p)).join(t("common.list")) }) }));
        if (perksToPick(st)) card.append(h("button", { class: "btn hot", text: t("dawn.pickNow"), on: { click: () => perkDialog(c) } }));
    }
    if (allShards(st)) {
        card.append(h("div", { class: "story", text: storyText("echo.shards") }),
            h("button", { class: "btn hot", text: t("dawn.relight"), on: { click: () => relightDialog(c) } }));
    }
    return card;
}

function relightDialog(c: Ctx): void {
    const st = c.state;
    const heir = h("select", { attrs: { "aria-label": t("dawn.heirloom") } });
    heir.append(h("option", { text: t("dawn.noHeirloom"), attrs: { value: "" } }));
    for (const it of heirloomCandidates(st)) heir.append(h("option", { text: itemName(it), attrs: { value: String(it.uid) } }));
    const cls = h("select", { attrs: { "aria-label": t("dawn.calling") } });
    for (const k of Object.keys(CLASSES)) { const o = h("option", { text: className(k), attrs: { value: k } }); if (k === st.hero.cls) o.selected = true; cls.append(o); }
    const next = dawnOf(st) + 1;
    const close = c.modal(h("div", { class: "card col", style: "max-width:560px" }, h("h3", { text: t("dawn.confirm") }),
        h("div", { style: "font-size:13px", text: t("dawn.gains", { dawn: dawnTitle(next), xp: DAWN_XP, tough: DAWN_TOUGHER, rich: DAWN_RICHER }) }),
        h("div", { class: "muted", style: "font-size:12px", text: t("dawn.keeps") }),
        h("div", { class: "muted", style: "font-size:12px", text: t("dawn.resets") }),
        h("div", { class: "row" }, h("b", { text: t("dawn.heirloom") }), heir),
        h("div", { class: "row" }, h("b", { text: t("dawn.calling") }), cls),
        h("div", { class: "row" },
            h("button", { class: "btn hot", text: t("dawn.go"), on: { click: () => {
                close();
                c.act(s => relightSun(s, { heirloom: heir.value ? Number(heir.value) : undefined, cls: cls.value }), undefined, "relight");
                const done = c.modal(h("div", { class: "card col", style: "max-width:560px" }, h("h3", { text: dawnTitle(dawnOf(c.state)) }),
                    ...storyText("dawn.story").split("\n\n").map(p => h("div", { class: "story", text: p })),
                    h("button", { class: "btn", text: t("dawn.pickNow"), on: { click: () => { done(); perkDialog(c); } } })));
            } } }),
            h("button", { class: "btn alt", text: t("common.cancel"), on: { click: () => close() } }))));
}

function perkDialog(c: Ctx): void {
    const st = c.state;
    const taken = st.hero.dawn?.perks ?? [];
    const list = h("div", { class: "perks" });
    const close = c.modal(h("div", { class: "card col", style: "max-width:600px" }, h("h3", { text: t("dawn.perkTitle", { dawn: dawnTitle(dawnOf(st)) }) }),
        h("div", { class: "muted", style: "font-size:12px", text: t("dawn.perkNote") }), list,
        h("button", { class: "btn alt", text: t("common.close"), on: { click: () => close() } })));
    for (const p of DAWN_PERKS) {
        const has = taken.includes(p.id);
        list.append(h("button", { class: `perk${has ? " on" : ""}`, attrs: has ? { disabled: "" } : {}, on: { click: () => { close(); c.act(s => chooseDawnPerk(s, p.id), perkName(p.id)); } } },
            h("b", { text: perkName(p.id) }), h("span", { text: perkText(p.id) })));
    }
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
