// Pixel type in the DOM: headings, section titles, buttons and tab labels are
// redrawn in the game's 5x7 bitmap font at 2x, in the element's own colour.
// The text stays in the DOM for screen readers and copy; only the glyphs
// change. Strings the font can't draw are left alone.

import { textSprite } from "./pixfont";

const DRAWABLE = /^[A-Z0-9 .,:/%+\-!?'()~\u00ab\u00bb\u0401\u0404\u0406\u0407\u0410-\u042f\u0490]+$/; // Latin and Cyrillic capitals (regex source stays ASCII)
const SELECTOR = "h3:not(.split), h3.split > span, .btn, .sec, .nav .lbl, .plaque";

/** A pixel-font canvas for `text` at a whole-number scale (big numbers on the sheet). */
export function pixText(text: string, colour: string, scale = 3, outline = ""): HTMLCanvasElement {
    const src = textSprite(text.toUpperCase(), colour, outline);
    const c = document.createElement("canvas");
    c.width = src.width; c.height = src.height;
    c.getContext("2d")!.drawImage(src, 0, 0);
    c.className = "pxc";
    c.style.width = src.width * scale + "px"; c.style.height = src.height * scale + "px";
    c.setAttribute("aria-hidden", "true");
    return c;
}

/** Replace the text of plain-text labels under `root` with pixel-font canvases. */
export function pixelize(root: ParentNode): void {
    for (const el of root.querySelectorAll<HTMLElement>(SELECTOR)) {
        if (el.dataset.px !== undefined) continue;
        el.dataset.px = "";
        if ([...el.childNodes].some(n => n.nodeType === 1)) continue; // has markup: leave it
        const text = (el.textContent ?? "").trim().toUpperCase().replace(/\s+/g, " ");
        if (!text || !DRAWABLE.test(text)) continue;
        const colour = getComputedStyle(el).color || "#1a1410";
        const src = textSprite(text, colour, "");
        const c = document.createElement("canvas");
        c.width = src.width; c.height = src.height;
        c.getContext("2d")!.drawImage(src, 0, 0);
        c.className = "pxc";
        c.style.width = src.width * 2 + "px"; c.style.height = src.height * 2 + "px";
        c.setAttribute("aria-hidden", "true");
        const sr = document.createElement("span");
        sr.className = "sr"; sr.textContent = el.textContent ?? "";
        el.replaceChildren(c, sr);
    }
}
