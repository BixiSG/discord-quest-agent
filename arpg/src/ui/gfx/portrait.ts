// The hero standing in the scenery of where they are: the character sheet's
// portrait. Same layer sets as the battle, drawn once into a small canvas.

import type { ZoneDef } from "../../core/data";
import { HERO_CAST } from "./cast";
import { setFor } from "./scenes";
import { drawSprite, spriteOf, tileLayer } from "./sprites";

export function portrait(zone: Pick<ZoneDef, "id" | "name" | "palette">, cls: string, w = 150, h = 112): HTMLCanvasElement {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d")!;
    g.imageSmoothingEnabled = false;
    const G = h - 14;
    const set = setFor(zone.id, zone.name);
    g.fillStyle = set.sky; g.fillRect(0, 0, w, h);
    // Shift each layer a little differently so the crop isn't always the same corner.
    set.layers.forEach((l, i) => tileLayer(g, l.sprite, w, G + (l.drop ?? 0), 40 + i * 37));
    g.globalAlpha = 0.12; g.fillStyle = zone.palette[0]; g.fillRect(0, 0, w, G); g.globalAlpha = 1;
    g.fillStyle = set.ground; g.fillRect(0, G, w, h - G);
    g.fillStyle = set.edge; g.fillRect(0, G, w, 1);
    g.fillStyle = "#111"; g.fillRect(0, G + 1, w, 1);
    const hc = HERO_CAST[cls];
    if (hc && spriteOf(hc.idle)) {
        g.fillStyle = "rgba(0,0,0,.35)";
        g.beginPath(); g.ellipse(w / 2, G, 14, 3, 0, 0, Math.PI * 2); g.fill();
        drawSprite(g, hc.idle, 0, Math.round(w / 2), G);
    }
    return c;
}
