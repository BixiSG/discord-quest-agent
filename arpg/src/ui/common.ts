// Small pieces the tab views share: key/value rows, filter chips, slot and
// damage-type names.

import type { DamageType, Slot } from "../core/types";
import { h } from "./dom";
import { t } from "../i18n";

export const TYPE_NAME = (t0: DamageType) => t(`type.${t0}`);

export function kv(rows: [string, string | HTMLElement, (() => void)?][]): HTMLElement {
    const el = h("div", { class: "kv" });
    for (const [k, v, click] of rows) {
        const key = h("div", { text: k });
        const val = typeof v === "string" ? h("div", { class: "num", text: v }) : v;
        if (click) { key.classList.add("click"); key.addEventListener("click", click); }
        el.append(key, val);
    }
    return el;
}

export const SLOT_LABEL = (s: Slot) => t(`slot.${s === "ring2" ? "ring" : s}`);

export function chips<T extends string>(opts: [T, string, number?][], cur: T, pick: (v: T) => void): HTMLElement {
    const el = h("div", { class: "chips", attrs: { role: "radiogroup" } });
    for (const [v, label, n] of opts) {
        el.append(h("button", { class: `chip${v === cur ? " on" : ""}`, attrs: { role: "radio", "aria-checked": String(v === cur) }, on: { click: () => pick(v) } },
            label, n !== undefined ? h("b", { text: String(n) }) : null));
    }
    return el;
}
