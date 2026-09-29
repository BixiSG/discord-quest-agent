// Scenery canvases for the DOM: the character sheet's portrait (the hero in
// the scenery of where they are) and the world map's zone thumbnails. Same
// layer sets as the battle, drawn once per zone and size, then copied.

import type { ZoneDef } from "../../core/data";
import { HERO_CAST } from "./cast";
import { setFor } from "./scenes";
import { drawSprite, spriteOf, tileLayer } from "./sprites";

type Place = Pick<ZoneDef, "id" | "name" | "palette">;
const cache = new Map<string, HTMLCanvasElement>();

function paint(zone: Place, w: number, h: number, cls: string | null): HTMLCanvasElement {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d")!;
    g.imageSmoothingEnabled = false;
    const G = h - Math.max(6, Math.round(h * 0.12));
    const set = setFor(zone.id, zone.name);
    g.fillStyle = set.sky; g.fillRect(0, 0, w, h);
    // Shift each layer a little differently so the crop isn't always the same corner.
    set.layers.forEach((l, i) => tileLayer(g, l.sprite, w, G + (l.drop ?? 0), 40 + i * 37 + (zone.id.length * 13) % 60));
    g.globalAlpha = 0.12; g.fillStyle = zone.palette[0]; g.fillRect(0, 0, w, G); g.globalAlpha = 1;
    g.fillStyle = set.ground; g.fillRect(0, G, w, h - G);
    g.fillStyle = set.edge; g.fillRect(0, G, w, 1);
    g.fillStyle = "#111"; g.fillRect(0, G + 1, w, 1);
    const hc = cls ? HERO_CAST[cls] : null;
    if (hc && spriteOf(hc.idle)) {
        g.fillStyle = "rgba(0,0,0,.35)";
        g.beginPath(); g.ellipse(w / 2, G, 14, 3, 0, 0, Math.PI * 2); g.fill();
        drawSprite(g, hc.idle, 0, Math.round(w / 2), G);
    }
    return c;
}

function copy(src: HTMLCanvasElement): HTMLCanvasElement {
    const c = document.createElement("canvas");
    c.width = src.width; c.height = src.height;
    c.getContext("2d")!.drawImage(src, 0, 0);
    return c;
}

/** The hero in the scenery of `zone` (not cached: the hero changes). */
export function portrait(zone: Place, cls: string, w = 150, h = 112): HTMLCanvasElement {
    return paint(zone, w, h, cls);
}

/** A small view of a zone's scenery, cached once the atlas has loaded. */
export function scenery(zone: Place, w: number, h: number): HTMLCanvasElement {
    const key = `${zone.id}|${zone.name}|${w}x${h}`;
    let c = cache.get(key);
    if (!c) {
        c = paint(zone, w, h, null);
        if (spriteOf(setFor(zone.id, zone.name).layers[0]!.sprite)) cache.set(key, c);
    }
    return copy(c);
}
