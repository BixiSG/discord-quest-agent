// Battle view: a 320x120 pixel canvas scaled up with pixelated sampling.
// It only reads state and a queue of effects fed by the simulation events;
// nothing here changes the game.

import { BASES, CLASSES, MONSTERS, ZONES, type MonsterDef } from "../core/data";
import { runZone, type SimEvents } from "../core/sim/engine";
import type { GameState } from "../core/state";
import type { Sheet } from "../core/character";

export const W = 320, H = 120;
const GROUND = 100;
const HERO_X = 64;

interface Fx { kind: string; t: number; targets: number[] }
interface Float { x: number; y: number; text: string; color: string; t: number; big: boolean }

export class Battle {
    readonly canvas: HTMLCanvasElement;
    private g: CanvasRenderingContext2D;
    private fx: Fx[] = [];
    private floats: Float[] = [];
    private flash = new Map<number, number>();
    private dying = new Map<number, number>();
    private packKey = "";
    private heroHurt = 0;
    private lastDraw = 0;
    private travel = 0;
    /** Set by the app while it is catching up, so bursts of events don't pile up. */
    quiet = false;

    constructor() {
        this.canvas = document.createElement("canvas");
        this.canvas.width = W; this.canvas.height = H;
        this.g = this.canvas.getContext("2d")!;
    }

    positions(state: GameState): [number, number][] {
        const run = state.activity.run;
        if (!run) return [];
        const n = run.monsters.length;
        if (n === 1 && MONSTERS[run.monsters[0]!.def]?.boss) return [[236, GROUND]];
        return run.monsters.map((_, i) => {
            const row = Math.floor(i / 3), col = i % 3;
            return [178 + col * 44 + row * 22, GROUND - row * 12];
        });
    }

    /** Events to hand to advance() while online. */
    events(now: () => number, state: () => GameState): SimEvents {
        return {
            heroUse: (kind, targets) => { if (!this.quiet) this.pushFx({ kind, t: now(), targets }); },
            heroHit: (i, dmg, crit) => {
                if (this.quiet) return;
                const p = this.positions(state())[i];
                this.flash.set(i, now());
                if (p) this.pushFloat({ x: p[0], y: p[1] - 30, text: fmtShort(dmg), color: crit ? "#ffc233" : "#ffffff", t: now(), big: crit });
            },
            heroMiss: i => {
                if (this.quiet) return;
                const p = this.positions(state())[i];
                if (p) this.pushFloat({ x: p[0], y: p[1] - 30, text: "miss", color: "#9aa0a6", t: now(), big: false });
            },
            monsterHit: (_i, dmg, avoided) => {
                if (this.quiet) return;
                if (avoided) this.pushFloat({ x: HERO_X, y: GROUND - 34, text: avoided, color: "#7fd1ff", t: now(), big: false });
                else { this.heroHurt = now(); this.pushFloat({ x: HERO_X - 6, y: GROUND - 34, text: fmtShort(dmg), color: "#ff5a36", t: now(), big: false }); }
            },
            flask: () => { if (!this.quiet) this.pushFloat({ x: HERO_X, y: GROUND - 44, text: "+flask", color: "#3fbf5f", t: now(), big: false }); },
            level: l => { if (!this.quiet) this.pushFloat({ x: HERO_X, y: GROUND - 52, text: "LEVEL " + l, color: "#ffc233", t: now(), big: true }); },
        };
    }

    private pushFx(f: Fx) { this.fx.push(f); if (this.fx.length > 12) this.fx.shift(); }
    private jitter = 0;
    private pushFloat(f: Float) {
        // Spread simultaneous numbers so they don't stack on one spot.
        this.jitter = (this.jitter + 1) % 5;
        f.x += (this.jitter - 2) * 5; f.y -= (this.jitter % 3) * 4;
        this.floats.push(f); if (this.floats.length > 24) this.floats.shift();
    }

    draw(state: GameState, sheet: Sheet, now: number): void {
        const g = this.g;
        const run = state.activity.run;
        const zone = run ? runZone(state, run) : ZONES[state.activity.zone]!;
        const dt = this.lastDraw ? Math.min(100, now - this.lastDraw) : 16;
        this.lastDraw = now;
        if (run?.phase === "travel") this.travel += dt * 0.06;
        const key = `${state.activity.runIndex}:${run?.pack ?? 0}`;
        if (key !== this.packKey) { this.packKey = key; this.flash.clear(); this.dying.clear(); }

        this.background(zone.palette, zone.id);
        const pos = this.positions(state);
        if (run && (run.phase === "fight" || run.phase === "dead")) {
            run.monsters.forEach((m, i) => {
                const p = pos[i]!;
                if (m.life <= 0 && !this.dying.has(i)) this.dying.set(i, now);
                const died = this.dying.get(i);
                const fade = died ? 1 - (now - died) / 400 : 1;
                if (fade <= 0) return;
                const def = MONSTERS[m.def]!;
                const hit = now - (this.flash.get(i) ?? -1e9) < 90;
                g.globalAlpha = Math.max(0, fade);
                drawMonster(g, def, p[0], p[1] + (died ? (1 - fade) * 6 : 0), hit, m.champion, now);
                g.globalAlpha = 1;
                if (!died) {
                    const w = def.boss ? 40 : 22;
                    bar(g, p[0] - w / 2, p[1] - monsterHeight(def) - 8, w, 3, m.life / m.maxLife, m.champion ? "#ffc233" : "#e5383b");
                }
            });
            const boss = run.monsters.find(m => MONSTERS[m.def]?.boss && m.life > 0);
            if (boss) {
                g.fillStyle = "#111"; g.fillRect(90, 4, 140, 12);
                g.fillStyle = "#fff"; g.font = "bold 8px monospace"; g.textAlign = "center";
                g.fillText(MONSTERS[boss.def]!.name.toUpperCase(), 160, 13);
            }
        }

        // Hero, with a lunge on melee swings.
        const last = this.fx[this.fx.length - 1];
        let lunge = 0;
        if (last && now - last.t < 160 && (last.kind === "arc" || last.kind === "stab" || last.kind === "slam")) lunge = Math.sin((now - last.t) / 160 * Math.PI) * 14;
        const walking = run?.phase === "travel";
        const dead = run?.phase === "dead";
        const wItem = state.hero.equipment.weapon;
        const look = { cape: CLASSES[state.hero.cls]?.color ?? "#e2543b", weapon: wItem ? (BASES[wItem.base]?.kind ?? "sword") : "none", shield: !!state.hero.equipment.offhand };
        drawHero(g, HERO_X + lunge, GROUND, look, walking ? now : 0, now - this.heroHurt < 120, dead);

        // Skill effects.
        this.fx = this.fx.filter(f => now - f.t < 350);
        for (const f of this.fx) this.drawFx(f, pos, now);

        // Floating numbers.
        g.textAlign = "center";
        this.floats = this.floats.filter(f => now - f.t < 800);
        for (const f of this.floats) {
            const k = (now - f.t) / 800;
            g.font = f.big ? "bold 10px monospace" : "bold 8px monospace";
            g.globalAlpha = 1 - k * k;
            const y = f.y - k * 16;
            g.fillStyle = "#111"; g.fillText(f.text, f.x + 1, y + 1);
            g.fillStyle = f.color; g.fillText(f.text, f.x, y);
        }
        g.globalAlpha = 1;

        if (dead && run) {
            g.fillStyle = "rgba(10,10,14,0.6)"; g.fillRect(0, 0, W, H);
            g.fillStyle = "#ff5a36"; g.font = "bold 12px monospace"; g.textAlign = "center";
            g.fillText("THE EMBER RELIGHTS", W / 2, 54);
            g.fillStyle = "#fff"; g.font = "bold 8px monospace";
            g.fillText(`back in ${Math.max(0, run.timer).toFixed(0)}s`, W / 2, 68);
        }
        // Pack progress pips.
        if (run) {
            for (let i = 0; i < run.packs + (run.boss ? 1 : 0); i++) {
                const isBoss = run.boss && i === run.packs;
                g.fillStyle = "#111"; g.fillRect(6 + i * 9, 6, 7, 7);
                g.fillStyle = i < run.pack ? "#19b3a3" : i === run.pack ? (isBoss ? "#ff5a36" : "#ffc233") : "#555";
                g.fillRect(7 + i * 9, 7, 5, 5);
            }
        }
        void sheet;
    }

    private background(pal: [string, string, string], seedStr: string): void {
        const g = this.g;
        g.fillStyle = pal[0]; g.fillRect(0, 0, W, H);
        // Stars / motes in the accent colour.
        let s = 0; for (const c of seedStr) s = (s * 31 + c.charCodeAt(0)) >>> 0;
        g.fillStyle = pal[2];
        for (let i = 0; i < 14; i++) { s = (s * 1103515245 + 12345) >>> 0; const x = s % W; s = (s * 1103515245 + 12345) >>> 0; g.fillRect(x, (s % 50) + 4, 1, 1); }
        // Two hill layers with parallax while travelling.
        hills(g, shade(pal[0], -0.25), 64, 18, this.travel * 0.3, 0.035);
        hills(g, shade(pal[1], -0.35), 82, 12, this.travel * 0.6, 0.06);
        g.fillStyle = pal[1]; g.fillRect(0, GROUND, W, H - GROUND);
        g.fillStyle = "#111"; g.fillRect(0, GROUND, W, 2);
        g.fillStyle = shade(pal[1], -0.2);
        for (let x = -((this.travel * 1.2) % 24); x < W; x += 24) g.fillRect(x, GROUND + 8, 10, 2);
    }

    private drawFx(f: Fx, pos: [number, number][], now: number): void {
        const g = this.g;
        const k = (now - f.t) / 350;
        const targets = f.targets.map(i => pos[i]).filter((p): p is [number, number] => !!p);
        g.lineWidth = 2;
        if (f.kind === "arc") {
            g.strokeStyle = `rgba(255,255,255,${1 - k})`;
            g.beginPath(); g.arc(HERO_X + 14, GROUND - 14, 22 + k * 20, -1.1, 0.9); g.stroke();
            g.strokeStyle = `rgba(255,90,54,${1 - k})`;
            g.beginPath(); g.arc(HERO_X + 14, GROUND - 14, 18 + k * 20, -1.0, 0.8); g.stroke();
        } else if (f.kind === "slam") {
            g.strokeStyle = `rgba(255,194,51,${1 - k})`;
            g.beginPath(); g.ellipse(HERO_X + 30 + k * 60, GROUND, 10 + k * 90, 4 + k * 6, 0, Math.PI, 0); g.stroke();
        } else if (f.kind === "stab") {
            for (const p of targets.slice(0, 1)) {
                g.strokeStyle = `rgba(255,255,255,${1 - k})`;
                g.beginPath(); g.moveTo(p[0] - 10, p[1] - 22); g.lineTo(p[0] + 10, p[1] - 8); g.stroke();
                g.beginPath(); g.moveTo(p[0] + 10, p[1] - 22); g.lineTo(p[0] - 10, p[1] - 8); g.stroke();
            }
        } else if (f.kind === "bolt") {
            const end = targets[targets.length - 1] ?? [W - 20, GROUND - 14];
            const x = HERO_X + 10 + (end[0] - HERO_X - 10) * Math.min(1, k * 2), y = GROUND - 14 + (end[1] - 14 - GROUND + 14) * Math.min(1, k * 2);
            g.fillStyle = "#111"; g.fillRect(x - 3, y - 3, 7, 7);
            g.fillStyle = "#ffc233"; g.fillRect(x - 2, y - 2, 5, 5);
        } else if (f.kind === "nova") {
            g.strokeStyle = `rgba(143,211,255,${1 - k})`;
            g.beginPath(); g.arc(HERO_X, GROUND - 12, 10 + k * 120, 0, Math.PI * 2); g.stroke();
        }
        g.lineWidth = 1;
    }
}

function hills(g: CanvasRenderingContext2D, color: string, base: number, amp: number, off: number, freq: number): void {
    g.fillStyle = color;
    g.beginPath(); g.moveTo(0, GROUND);
    for (let x = 0; x <= W; x += 4) g.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin((x + off) * freq) * Math.cos((x + off) * freq * 0.37)));
    g.lineTo(W, GROUND); g.closePath(); g.fill();
}

function bar(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, f: number, color: string): void {
    g.fillStyle = "#111"; g.fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle = "#3a3a3a"; g.fillRect(x, y, w, h);
    g.fillStyle = color; g.fillRect(x, y, Math.max(0, Math.min(1, f)) * w, h);
}

export function shade(hex: string, amt: number): string {
    const n = parseInt(hex.slice(1), 16);
    const f = (c: number) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
    return "#" + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(f).map(c => c.toString(16).padStart(2, "0")).join("");
}

const monsterHeight = (d: MonsterDef) => Math.round((d.look.shape === "crab" ? 12 : d.look.shape === "bird" ? 14 : d.look.shape === "blob" ? 14 : 22) * d.look.size);

/** Pixel rectangles with a 1px black outline. */
function box(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string): void {
    g.fillStyle = "#111"; g.fillRect(Math.round(x) - 1, Math.round(y) - 1, Math.round(w) + 2, Math.round(h) + 2);
    g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function drawMonster(g: CanvasRenderingContext2D, d: MonsterDef, x: number, y: number, hit: boolean, champ: boolean, now: number): void {
    const s = d.look.size;
    const body = hit ? "#ffffff" : d.look.body;
    const dark = hit ? "#dddddd" : shade(d.look.body, -0.3);
    const bob = Math.round(Math.sin(now / 260 + x) * 1);
    if (champ) { g.fillStyle = "rgba(255,194,51,0.35)"; g.fillRect(x - 14 * s, y - 26 * s, 28 * s, 28 * s); }
    switch (d.look.shape) {
        case "tall": {
            box(g, x - 5 * s, y - 22 * s + bob, 10 * s, 8 * s, body);           // head
            box(g, x - 6 * s, y - 14 * s + bob, 12 * s, 10 * s, dark);          // torso
            box(g, x - 5 * s, y - 4 * s, 3 * s, 4 * s, dark); box(g, x + 2 * s, y - 4 * s, 3 * s, 4 * s, dark);
            box(g, x - 9 * s, y - 13 * s + bob, 3 * s, 8 * s, body);            // arm reaching
            g.fillStyle = d.look.eye; g.fillRect(x - 4 * s, y - 19 * s + bob, 2, 2); g.fillRect(x - 1 * s, y - 19 * s + bob, 2, 2);
            break;
        }
        case "crab": {
            box(g, x - 9 * s, y - 9 * s + bob, 18 * s, 7 * s, body);
            box(g, x - 13 * s, y - 13 * s, 5 * s, 4 * s, dark); box(g, x + 8 * s, y - 13 * s, 5 * s, 4 * s, dark);
            for (let i = 0; i < 3; i++) { g.fillStyle = "#111"; g.fillRect(x - 8 * s + i * 7 * s, y - 2, 2, 2); }
            g.fillStyle = d.look.eye; g.fillRect(x - 3 * s, y - 12 * s + bob, 2, 3); g.fillRect(x + 2 * s, y - 12 * s + bob, 2, 3);
            break;
        }
        case "bird": {
            const flap = Math.sin(now / 90 + x) > 0 ? -4 : 2;
            const yy = y - 18 * s + bob * 3;
            box(g, x - 5 * s, yy, 10 * s, 6 * s, body);
            box(g, x - 13 * s, yy + flap, 8 * s, 3, dark); box(g, x + 5 * s, yy + flap, 8 * s, 3, dark);
            box(g, x - 8 * s, yy + 2, 3, 2, "#ffc233");
            g.fillStyle = d.look.eye; g.fillRect(x - 3 * s, yy + 1, 2, 2);
            break;
        }
        case "robe": {
            box(g, x - 4 * s, y - 22 * s + bob, 8 * s, 7 * s, dark);
            g.fillStyle = "#111"; g.beginPath(); g.moveTo(x - 9 * s, y); g.lineTo(x, y - 17 * s + bob); g.lineTo(x + 9 * s, y); g.closePath(); g.fill();
            g.fillStyle = body; g.beginPath(); g.moveTo(x - 8 * s, y - 1); g.lineTo(x, y - 15 * s + bob); g.lineTo(x + 8 * s, y - 1); g.closePath(); g.fill();
            g.fillStyle = d.look.eye; g.fillRect(x - 2 * s, y - 19 * s + bob, 2, 2); g.fillRect(x + 1 * s, y - 19 * s + bob, 2, 2);
            break;
        }
        case "blob": {
            box(g, x - 8 * s, y - 12 * s + bob, 16 * s, 12 * s + -bob, body);
            box(g, x - 4 * s, y - 16 * s + bob, 8 * s, 4 * s, dark);
            g.fillStyle = d.look.eye; g.fillRect(x - 5 * s, y - 9 * s + bob, 3, 3); g.fillRect(x + 2 * s, y - 9 * s + bob, 3, 3);
            break;
        }
        case "giant": {
            box(g, x - 7 * s, y - 34 * s + bob, 14 * s, 10 * s, dark);
            box(g, x - 11 * s, y - 24 * s + bob, 22 * s, 16 * s, body);
            box(g, x - 16 * s, y - 24 * s + bob, 5 * s, 14 * s, dark); box(g, x + 11 * s, y - 24 * s + bob, 5 * s, 14 * s, dark);
            box(g, x - 8 * s, y - 8 * s, 6 * s, 8 * s, dark); box(g, x + 2 * s, y - 8 * s, 6 * s, 8 * s, dark);
            g.fillStyle = d.look.eye; g.fillRect(x - 4 * s, y - 30 * s + bob, 3, 2); g.fillRect(x + 2 * s, y - 30 * s + bob, 3, 2);
            break;
        }
    }
}

function drawHero(g: CanvasRenderingContext2D, x: number, y: number, look: { cape: string; weapon: string; shield: boolean }, walk: number, hurt: boolean, dead: boolean): void {
    if (dead) { box(g, x - 10, y - 5, 20, 5, "#555"); return; }
    const color = look.cape;
    const step = walk ? Math.round(Math.sin(walk / 90) * 2) : 0;
    const skin = hurt ? "#ffd0c0" : "#f0c9a0";
    const armour = hurt ? "#e5a0a0" : "#6b7280";
    box(g, x - 7, y - 20, 4, 12, color);                  // cape
    box(g, x - 3, y - 5, 3, 5 + step, armour); box(g, x + 1, y - 5, 3, 5 - step, armour);
    box(g, x - 4, y - 16, 9, 11, armour);                                 // torso
    box(g, x - 3, y - 23, 7, 7, skin);                                    // head
    box(g, x - 4, y - 25, 9, 3, armour);                                  // helm rim
    g.fillStyle = "#ff5a36"; g.fillRect(x, y - 13, 2, 3);                  // the ember
    g.fillStyle = "#111"; g.fillRect(x + 2, y - 21, 1, 2);                 // eye
    drawWeapon(g, x, y, look.weapon);
    if (look.shield && look.weapon !== "bow") box(g, x - 9, y - 16, 5, 8, "#8a5a2b");  // off-hand
}

/** The hero holds what is equipped: blades, hafts, a bow or a caster's rod. */
function drawWeapon(g: CanvasRenderingContext2D, x: number, y: number, kind: string): void {
    switch (kind) {
        case "bow":
            g.strokeStyle = "#111"; g.lineWidth = 3; g.beginPath(); g.arc(x + 5, y - 15, 9, -1.2, 1.2); g.stroke();
            g.strokeStyle = "#8a5a2b"; g.lineWidth = 1.5; g.beginPath(); g.arc(x + 5, y - 15, 9, -1.2, 1.2); g.stroke();
            g.fillStyle = "#e9e4d4"; g.fillRect(x + 8, y - 23, 1, 16);
            g.lineWidth = 1;
            break;
        case "staff":
            box(g, x + 6, y - 28, 2, 26, "#8a5a2b"); box(g, x + 5, y - 31, 4, 4, "#19b3a3");
            break;
        case "wand":
            box(g, x + 6, y - 20, 2, 10, "#8a5a2b"); box(g, x + 5, y - 23, 4, 3, "#ff5a36");
            break;
        case "axe": case "greataxe":
            box(g, x + 6, y - 26, 2, 16, "#8a5a2b"); box(g, x + 8, y - 26, kind === "greataxe" ? 6 : 4, 6, "#c9ced6");
            break;
        case "mace":
            box(g, x + 6, y - 22, 2, 12, "#8a5a2b"); box(g, x + 4, y - 26, 6, 5, "#9aa4b2");
            break;
        case "dagger":
            box(g, x + 6, y - 18, 2, 8, "#c9ced6"); box(g, x + 4, y - 11, 6, 2, "#ffc233");
            break;
        case "none":
            break;
        default: // swords
            box(g, x + 6, y - (kind === "greatsword" ? 30 : 24), kind === "greatsword" ? 3 : 2, kind === "greatsword" ? 20 : 14, "#c9ced6");
            box(g, x + 4, y - 11, 6, 2, "#ffc233");
    }
}

function fmtShort(n: number): string {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e4) return Math.round(n / 1e3) + "k";
    return Math.round(n).toString();
}
