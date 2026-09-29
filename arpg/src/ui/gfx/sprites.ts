// Runtime side of the sprite atlas (atlas.gen.ts, built by tools/pack-assets.mjs).
// The atlas is one embedded PNG: Discord's CSP allows data: images. A white
// copy is made once for hit flashes. Until it has loaded (or if a sprite is
// missing) callers fall back to the old code-drawn shapes.

import { ATLAS_PNG, FRAMES, type Frame } from "./atlas.gen";

let img: HTMLImageElement | null = null;
let white: HTMLCanvasElement | null = null;
let loading: Promise<void> | null = null;

export function loadSprites(): Promise<void> {
    if (!ATLAS_PNG) return Promise.resolve();
    return (loading ??= new Promise<void>(resolve => {
        const im = new Image();
        im.onload = () => {
            img = im;
            try {
                const c = document.createElement("canvas");
                c.width = im.width; c.height = im.height;
                const g = c.getContext("2d")!;
                g.drawImage(im, 0, 0);
                g.globalCompositeOperation = "source-in";
                g.fillStyle = "#ffffff"; g.fillRect(0, 0, c.width, c.height);
                white = c;
            } catch { white = null; }
            resolve();
        };
        im.onerror = () => { console.warn("[Hollowmarch] sprite atlas failed to load; using drawn shapes"); resolve(); };
        im.src = ATLAS_PNG;
    }));
}

export const spriteOf = (name: string): Frame | null => (img && FRAMES[name]) || null;

export interface DrawOpts {
    /** Mirror horizontally (sprites face right by default). */
    flip?: boolean;
    /** Draw the white silhouette instead (hit flash). */
    flash?: boolean;
    /** Scale factor (whole numbers keep pixels square). */
    scale?: number;
}

/** Draws frame `f` of `name` with its bottom centre at (x, y). Returns false if the sprite isn't available. */
export function drawSprite(g: CanvasRenderingContext2D, name: string, f: number, x: number, y: number, o: DrawOpts = {}): boolean {
    const fr = spriteOf(name);
    if (!fr) return false;
    const src = o.flash && white ? white : img!;
    const i = ((Math.floor(f) % fr.n) + fr.n) % fr.n;
    const sx = fr.x + i * (fr.w + 1), s = o.scale ?? 1;
    const w = fr.w * s, h = fr.h * s;
    const dx = Math.round(x - w / 2), dy = Math.round(y - h);
    if (o.flip) {
        g.save(); g.translate(dx + w, dy); g.scale(-1, 1);
        g.drawImage(src, sx, fr.y, fr.w, fr.h, 0, 0, w, h);
        g.restore();
    } else g.drawImage(src, sx, fr.y, fr.w, fr.h, dx, dy, w, h);
    return true;
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
