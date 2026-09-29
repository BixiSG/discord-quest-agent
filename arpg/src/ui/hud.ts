// The game HUD under the battle: life and mana globes at the ends, the skill
// slot with its cooldown sweep, the flask, the level badge and a segmented XP
// bar. A pixel canvas like the battle, redrawn every frame (cheap: a few
// hundred rects). Numbers use the pixel font.

import { drawText, textWidth } from "./gfx/pixfont";
import { iconFor } from "./icons";
import { fmt } from "./dom";

export const HUD_H = 44;

export interface HudData {
    life: number; lifeMax: number; es: number; esMax: number; mana: number; manaMax: number;
    flask: number; flaskMax: number; level: number; xpFrac: number; eta: string;
    /** 0..1: how far through the current attack/cast the hero is (1 = ready). */
    ready: number; skillName: string; weaponKind: string | null; spell: boolean;
    zone: string; zoneLevel: number; packDps: number; dead: boolean;
}

const INK = "#1a1410", CREAM = "#f3e7d3", GOLD = "#ffc233";

export class Hud {
    readonly canvas: HTMLCanvasElement;
    private g: CanvasRenderingContext2D;
    private w = 320;
    constructor() {
        this.canvas = document.createElement("canvas");
        this.canvas.height = HUD_H;
        this.g = this.canvas.getContext("2d")!;
    }

    /** Logical width in HUD pixels (the CSS width divided by the pixel scale). */
    resize(w: number): void {
        w = Math.max(200, Math.round(w));
        if (w === this.w && this.canvas.width === w) return;
        this.w = w; this.canvas.width = w;
    }

    draw(d: HudData, now: number): void {
        const g = this.g, W = this.w;
        g.imageSmoothingEnabled = false;
        g.fillStyle = INK; g.fillRect(0, 0, W, HUD_H);
        // a faint riveted rail behind the middle section
        g.fillStyle = "#241c16"; g.fillRect(44, 10, W - 88, HUD_H - 12);
        g.fillStyle = "#2f251d"; for (let x = 50; x < W - 50; x += 12) g.fillRect(x, HUD_H - 4, 2, 2);

        // XP bar: black frame, cream track, gold fill, a tick every 10%.
        const bx = 46, bw = W - 92, by = 2;
        g.fillStyle = "#000"; g.fillRect(bx - 1, by - 1, bw + 2, 7);
        g.fillStyle = "#3a2f25"; g.fillRect(bx, by, bw, 5);
        g.fillStyle = GOLD; g.fillRect(bx, by, Math.round(bw * clamp01(d.xpFrac)), 5);
        g.fillStyle = "#fff0b8"; g.fillRect(bx, by, Math.round(bw * clamp01(d.xpFrac)), 1);
        g.fillStyle = "#000"; for (let i = 1; i < 10; i++) g.fillRect(bx + Math.round(bw * i / 10), by, 1, 5);

        // Globes.
        this.globe(22, 24, 19, d.lifeMax ? d.life / d.lifeMax : 0, d.dead ? "#5a2a2a" : "#e5383b", "#9e1d1f", "#ff8a8c", now, 0);
        if (d.esMax > 0) this.ring(22, 24, 21, d.es / d.esMax, "#7fd1ff");
        this.globe(W - 22, 24, 19, d.manaMax ? d.mana / d.manaMax : 0, "#3a7bff", "#1f47a8", "#9dbbff", now, 1.7);
        const lifeTxt = fmt(Math.floor(Math.max(0, d.life)));
        drawText(g, lifeTxt, 22, 20, CREAM, "center");
        drawText(g, fmt(Math.floor(Math.max(0, d.mana))), W - 22, 20, CREAM, "center");
        if (d.esMax > 0 && d.es > 0) drawText(g, fmt(Math.floor(d.es)), 22, 30, "#bfe9ff", "center");

        // Centre group: flask, skill, level.
        const cx = Math.round(W / 2), row = 12;
        this.flask(cx - 36, row, d.flaskMax ? d.flask / d.flaskMax : 0);
        this.skill(cx - 14, row, d);
        this.level(cx + 18, row, d.level);

        // Side text, only when there is room.
        const leftRoom = cx - 40 - 48, rightRoom = W - 48 - (cx + 50);
        if (leftRoom >= 60) {
            const z = fit(d.zone.toUpperCase(), leftRoom - 4);
            drawText(g, z, 48, 13, CREAM);
            drawText(g, `AREA ${d.zoneLevel}`, 48, 24, "#b5a48b");
            drawText(g, `${fmt(d.packDps)} DPS`, 48, 33, GOLD);
        }
        if (rightRoom >= 60) {
            const rx = W - 48;
            drawText(g, `${Math.floor(d.xpFrac * 100)}% XP`, rx, 13, GOLD, "right");
            if (d.eta) drawText(g, fit(d.eta.toUpperCase(), rightRoom - 4), rx, 24, "#b5a48b", "right");
        }
    }

    /** A glass globe: black rim, liquid to `f` with a moving surface, a highlight. */
    private globe(cx: number, cy: number, r: number, f: number, col: string, deep: string, surf: string, now: number, phase: number): void {
        const g = this.g;
        f = clamp01(f);
        const top = cy - r, level = cy + r - Math.round(2 * r * f);
        for (let y = -r - 2; y <= r + 2; y++) {
            const half = Math.floor(Math.sqrt(Math.max(0, (r + 2) * (r + 2) - y * y)));
            g.fillStyle = "#000"; g.fillRect(cx - half, cy + y, half * 2 + 1, 1);
        }
        for (let y = -r; y <= r; y++) {
            const half = Math.floor(Math.sqrt(Math.max(0, r * r - y * y)));
            if (!half) continue;
            const py = cy + y;
            g.fillStyle = "#2a211b"; g.fillRect(cx - half, py, half * 2 + 1, 1);
            // liquid: rows below the (wavy) surface
            for (let x = -half; x <= half; x++) {
                const wave = f > 0 && f < 1 ? Math.round(Math.sin((x + now / 180 + phase * 10) * 0.35) * 1.2) : 0;
                const surface = level + wave;
                if (py < surface) continue;
                g.fillStyle = py === surface ? surf : py > cy + r * 0.45 ? deep : col;
                g.fillRect(cx + x, py, 1, 1);
            }
        }
        // glass shine
        g.fillStyle = "rgba(255,255,255,.55)";
        g.fillRect(cx - r + 5, top + 6, 2, 5); g.fillRect(cx - r + 7, top + 4, 3, 2);
    }

    /** Energy shield: a pale ring around the life globe, filled clockwise from the bottom. */
    private ring(cx: number, cy: number, r: number, f: number, col: string): void {
        const g = this.g;
        f = clamp01(f);
        g.fillStyle = col;
        for (let y = -r - 1; y <= r + 1; y++) for (let x = -r - 1; x <= r + 1; x++) {
            const d = Math.sqrt(x * x + y * y);
            if (d < r - 0.5 || d > r + 1.2) continue;
            const a = (Math.atan2(x, y) + Math.PI) / (2 * Math.PI); // 0 at the bottom, clockwise
            if (1 - a <= f) g.fillRect(cx + x, cy + y, 1, 1);
        }
    }

    private box(x: number, y: number, w: number, h: number, bg: string): void {
        const g = this.g;
        g.fillStyle = "#000"; g.fillRect(x - 1, y - 1, w + 2, h + 2);
        g.fillStyle = bg; g.fillRect(x, y, w, h);
        g.fillStyle = "rgba(255,255,255,.12)"; g.fillRect(x, y, w, 1);
    }

    private flask(x: number, y: number, f: number): void {
        const g = this.g;
        this.box(x, y, 18, 28, "#2a211b");
        // bottle: neck, body
        g.fillStyle = "#000"; g.fillRect(x + 6, y + 3, 6, 5); g.fillRect(x + 3, y + 8, 12, 17);
        g.fillStyle = "#4a3a2e"; g.fillRect(x + 7, y + 4, 4, 3); g.fillRect(x + 4, y + 9, 10, 15);
        const h = Math.round(15 * clamp01(f));
        g.fillStyle = "#3fbf5f"; g.fillRect(x + 4, y + 24 - h, 10, h);
        if (h) { g.fillStyle = "#9df0b2"; g.fillRect(x + 4, y + 24 - h, 10, 1); }
        g.fillStyle = "#8a5a2b"; g.fillRect(x + 7, y + 2, 4, 2); // cork
    }

    private skill(x: number, y: number, d: HudData): void {
        const g = this.g;
        this.box(x, y, 28, 28, d.spell ? "#3b2a52" : "#4a2a1f");
        const icon = iconFor(d.weaponKind ?? (d.spell ? "focus" : "sword"), "weapon");
        g.drawImage(icon, x + 2, y + 2, 24, 24);
        // cooldown: a dark pie over the part of the swing still to come
        const left = 1 - clamp01(d.ready);
        if (left > 0.02) {
            g.fillStyle = "rgba(10,8,6,.62)";
            for (let py = 0; py < 28; py++) for (let px = 0; px < 28; px++) {
                const a = (Math.atan2(px - 13.5, -(py - 13.5)) + 2 * Math.PI) % (2 * Math.PI) / (2 * Math.PI);
                if (a >= 1 - left) g.fillRect(x + px, y + py, 1, 1);
            }
        } else {
            g.fillStyle = GOLD; g.fillRect(x, y + 27, 28, 1);
        }
    }

    private level(x: number, y: number, lv: number): void {
        this.box(x, y, 28, 28, INK);
        const g = this.g;
        g.fillStyle = GOLD; g.fillRect(x, y, 28, 2); g.fillRect(x, y + 26, 28, 2);
        drawText(g, "LV", x + 14, y + 4, "#b5a48b", "center");
        drawText(g, String(lv), x + 14, y + 14, GOLD, "center");
    }
}

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

/** Trim text to fit a width in pixel-font pixels. */
function fit(text: string, max: number): string {
    if (textWidth(text) + 2 <= max) return text;
    let t = text;
    while (t.length > 1 && textWidth(t + ".") + 2 > max) t = t.slice(0, -1);
    return t.trimEnd() + ".";
}
