// Character creation: the three callings side by side, each in its scenery.

import { CLASSES, ZONES } from "../core/data";
import { clear, h } from "./dom";
import { drawSprite, loadSprites } from "./gfx/sprites";
import { HERO_CAST } from "./gfx/cast";
import { glyph } from "./glyphs";
import { scenery } from "./gfx/portrait";
import { drawText } from "./gfx/pixfont";
import { t } from "../i18n";
import { baseName, classBlurb, className, skillName } from "../i18n/names";

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
