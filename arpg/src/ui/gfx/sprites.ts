// Runtime side of the sprite atlas (atlas.gen.ts, built by tools/pack-assets.mjs).
// The atlas is one embedded PNG: Discord's CSP allows data: images. A white
// copy is made once for hit flashes; tinted frames are made on first use and
// cached. Until it has loaded (or if a sprite is missing) callers fall back to
// the old code-drawn shapes.

import { ATLAS_PNG, FRAMES, type Frame } from "./atlas.gen";

let img: HTMLImageElement | null = null;
let white: HTMLCanvasElement | null = null;
let loading: Promise<void> | null = null;
const tinted = new Map<string, HTMLCanvasElement>();

export function loadSprites(): Promise<void> {
    if (!ATLAS_PNG) return Promise.resolve();
    return (loading ??= new Promise<void>(resolve => {
        const im = new Image();
        im.onload = () => {
            img = im;
            try { white = recolour(im, 0, 0, im.width, im.height, "#ffffff", 1); } catch { white = null; }
            resolve();
        };
        im.onerror = () => { console.warn("[Hollowmarch] sprite atlas failed to load; using drawn shapes"); resolve(); };
        im.src = ATLAS_PNG;
    }));
}

export const spriteOf = (name: string): Frame | null => (img && FRAMES[name]) || null;

/** A copy of an atlas region with `colour` washed over its opaque pixels. */
function recolour(src: CanvasImageSource, sx: number, sy: number, w: number, h: number, colour: string, strength: number): HTMLCanvasElement {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d")!;
    g.drawImage(src, sx, sy, w, h, 0, 0, w, h);
    g.globalCompositeOperation = "source-atop";
    g.globalAlpha = strength;
    g.fillStyle = colour; g.fillRect(0, 0, w, h);
    return c;
}

export interface DrawOpts {
    /** Face left (the atlas records which way each sprite's art faces). */
    left?: boolean;
    /** White silhouette (hit flash). */
    flash?: boolean;
    tint?: string;
    strength?: number;
    /** Whole-number scale. */
    scale?: number;
}

/** Frame `f` (wraps) of `name`, feet at (x, y). Returns the drawn box, or null if the sprite isn't available. */
export function drawSprite(g: CanvasRenderingContext2D, name: string, f: number, x: number, y: number, o: DrawOpts = {}): { x: number; y: number; w: number; h: number } | null {
    const fr = spriteOf(name);
    if (!fr) return null;
    const i = ((Math.floor(f) % fr.n) + fr.n) % fr.n;
    const sx = fr.x + i * (fr.w + 1), s = o.scale ?? 1;
    const w = fr.w * s, h = fr.h * s;
    const flip = !!o.left !== (fr.f === 1);
    const dx = Math.round(x - (flip ? fr.w - fr.ax : fr.ax) * s), dy = Math.round(y - fr.ay * s);
    let src: CanvasImageSource = img!, rx = sx, ry = fr.y;
    if (o.flash && white) src = white;
    else if (o.tint) {
        const key = `${name}|${i}|${o.tint}|${o.strength ?? 0.4}`;
        let c = tinted.get(key);
        if (!c) { c = recolour(img!, sx, fr.y, fr.w, fr.h, o.tint, o.strength ?? 0.4); tinted.set(key, c); if (tinted.size > 600) tinted.delete(tinted.keys().next().value!); }
        src = c; rx = 0; ry = 0;
    }
    if (flip) {
        g.save(); g.translate(dx + w, dy); g.scale(-1, 1);
        g.drawImage(src, rx, ry, fr.w, fr.h, 0, 0, w, h);
        g.restore();
    } else g.drawImage(src, rx, ry, fr.w, fr.h, dx, dy, w, h);
    return { x: dx, y: dy, w, h };
}

/** A standalone canvas of one frame (item icons in the DOM). */
export function spriteCanvas(name: string, f = 0): HTMLCanvasElement | null {
    const fr = spriteOf(name);
    if (!fr) return null;
    const c = document.createElement("canvas");
    c.width = fr.w; c.height = fr.h;
    c.getContext("2d")!.drawImage(img!, fr.x + f * (fr.w + 1), fr.y, fr.w, fr.h, 0, 0, fr.w, fr.h);
    return c;
}
