// Battle view: a pixel canvas scaled up by a whole number with pixelated
// sampling. Its logical size follows the window (resize()), so the scene is
// never stretched or letterboxed; the ground sits a fixed height above the
// bottom and the packs spread over the width.
// It only reads state and a queue of effects fed by the simulation events;
// nothing here changes the game.

import { BASES, CLASSES, COMPANIONS, MONSTERS, ZONES, type MonsterDef } from "../core/data";
import { runZone, type SimEvents } from "../core/sim/engine";
import type { GameState } from "../core/state";
import type { Sheet } from "../core/character";
import { drawText } from "./gfx/pixfont";
import { t } from "../i18n";
import { monsterName } from "../i18n/names";
import { drawSprite, loadSprites, spriteOf, tileLayer } from "./gfx/sprites";
import { setFor } from "./gfx/scenes";
import { HERO_CAST, MONSTER_CAST } from "./gfx/cast";

/** Default logical size; resize() changes it. */
export const W = 320, H = 120;

interface Fx { kind: string; t: number; targets: number[] }
interface Float { x: number; y: number; text: string; color: string; t: number; big: boolean }
interface Burst { x: number; y: number; t: number; big: boolean }

/** How long a one-shot animation (attack, hurt) plays, in ms. */
const HERO_ATTACK_MS = 380, MON_ATTACK_MS = 520, HURT_MS = 220, DEATH_FX_MS = 540;

export class Battle {
    readonly canvas: HTMLCanvasElement;
    private g: CanvasRenderingContext2D;
    private fx: Fx[] = [];
    private floats: Float[] = [];
    private bursts: Burst[] = [];
    private flash = new Map<number, number>();
    private dying = new Map<number, number>();
    /** Monster index -> when it last attacked (for its attack animation). */
    private monAtk = new Map<number, number>();
    private packKey = "";
    private heroHurt = 0;
    private heroAtk = -1e9;
    private shake = 0;
    private shakeAmp = 0;
    private lastDraw = 0;
    private travel = 0;
    /** Set by the app while it is catching up, so bursts of events don't pile up. */
    quiet = false;
    private W = W;
    private H = H;
    private get GROUND() { return this.H - 18; }
    private get HERO_X() { return Math.round(Math.max(48, this.W * 0.2)); }

    constructor() {
        this.canvas = document.createElement("canvas");
        this.canvas.width = W; this.canvas.height = H;
        this.g = this.canvas.getContext("2d")!;
        void loadSprites();
    }

    /** Logical size in scene pixels. */
    resize(w: number, h: number): void {
        w = Math.max(200, Math.round(w)); h = Math.max(72, Math.round(h));
        if (w === this.W && h === this.H) return;
        this.W = w; this.H = h;
        this.canvas.width = w; this.canvas.height = h;
    }

    positions(state: GameState): [number, number][] {
        const run = state.activity.run;
        if (!run) return [];
        const n = run.monsters.length, G = this.GROUND;
        if (n === 1 && MONSTERS[run.monsters[0]!.def]?.boss) return [[Math.round(this.W * 0.7), G]];
        // Packs fill the right half: three columns, later rows step back and up.
        const x0 = Math.round(Math.max(this.HERO_X + 100, this.W * 0.52));
        const step = Math.round(Math.max(30, Math.min(64, (this.W - 40 - x0) / 3)));
        return run.monsters.map((_, i) => {
            const row = Math.floor(i / 3), col = i % 3;
            return [x0 + col * step + row * Math.round(step / 2), G - row * 10];
        });
    }

    /** Events to hand to advance() while online. */
    events(now: () => number, state: () => GameState): SimEvents {
        return {
            heroUse: (kind, targets) => { if (this.quiet) return; this.heroAtk = now(); this.pushFx({ kind, t: now(), targets }); },
            heroHit: (i, dmg, crit) => {
                if (this.quiet) return;
                const p = this.positions(state())[i];
                this.flash.set(i, now());
                if (crit) this.kick(now(), 2);
                if (p) this.pushFloat({ x: p[0], y: p[1] - 44, text: fmtShort(dmg), color: crit ? "#ffc233" : "#ffffff", t: now(), big: crit });
            },
            heroMiss: i => {
                if (this.quiet) return;
                const p = this.positions(state())[i];
                if (p) this.pushFloat({ x: p[0], y: p[1] - 44, text: t("battle.miss"), color: "#9aa0a6", t: now(), big: false });
            },
            monsterHit: (i, dmg, avoided) => {
                if (this.quiet) return;
                this.monAtk.set(i, now());
                if (avoided) this.pushFloat({ x: this.HERO_X, y: this.GROUND - 56, text: t(avoided === "evade" ? "battle.evade" : "battle.block"), color: "#7fd1ff", t: now(), big: false });
                else { this.heroHurt = now(); this.pushFloat({ x: this.HERO_X - 6, y: this.GROUND - 56, text: fmtShort(dmg), color: "#ff5a36", t: now(), big: false }); }
            },
            flask: () => { if (!this.quiet) this.pushFloat({ x: this.HERO_X, y: this.GROUND - 66, text: t("battle.flask"), color: "#3fbf5f", t: now(), big: false }); },
            level: l => { if (!this.quiet) { this.pushFloat({ x: this.HERO_X, y: this.GROUND - 74, text: t("battle.level", { n: l }), color: "#ffc233", t: now(), big: true }); this.kick(now(), 2); } },
        };
    }

    /** A short screen shake. */
    private kick(t: number, amp: number) { this.shakeAmp = t - this.shake < 140 ? Math.max(amp, this.shakeAmp) : amp; this.shake = t; }
    private pushFx(f: Fx) { this.fx.push(f); if (this.fx.length > 12) this.fx.shift(); }
    private jitter = 0;
    private pushFloat(f: Float) {
        // Spread simultaneous numbers so they don't stack on one spot.
        this.jitter = (this.jitter + 1) % 5;
        f.x += (this.jitter - 2) * 11; f.y -= (this.jitter % 3) * 7;
        this.floats.push(f); if (this.floats.length > 24) this.floats.shift();
    }

    draw(state: GameState, sheet: Sheet, now: number): void {
        const g = this.g;
        g.imageSmoothingEnabled = false;
        const run = state.activity.run;
        const zone = run ? runZone(state, run) : ZONES[state.activity.zone]!;
        const dt = this.lastDraw ? Math.min(100, now - this.lastDraw) : 16;
        this.lastDraw = now;
        if (run?.phase === "travel") this.travel += dt * 0.06;
        const key = `${state.activity.runIndex}:${run?.pack ?? 0}`;
        if (key !== this.packKey) { this.packKey = key; this.flash.clear(); this.dying.clear(); this.monAtk.clear(); }

        g.save();
        if (now - this.shake < 140 && this.shakeAmp) g.translate(Math.round((Math.random() - 0.5) * this.shakeAmp * 2), Math.round((Math.random() - 0.5) * this.shakeAmp));
        this.background(zone);
        const pos = this.positions(state);
        const G = this.GROUND;
        if (run && (run.phase === "fight" || run.phase === "dead")) {
            // Back rows first so the front row overlaps them.
            const order = run.monsters.map((_, i) => i).sort((a, b) => pos[a]![1] - pos[b]![1]);
            for (const i of order) {
                const m = run.monsters[i]!, p = pos[i]!;
                const def = MONSTERS[m.def]!;
                if (m.life <= 0 && !this.dying.has(i)) {
                    this.dying.set(i, now);
                    if (!this.quiet) this.bursts.push({ x: p[0], y: p[1], t: now, big: !!def.boss });
                }
                const died = this.dying.get(i);
                const fade = died ? 1 - (now - died) / 160 : 1;
                if (fade <= 0) continue;
                const hit = now - (this.flash.get(i) ?? -1e9) < 80;
                const cast = MONSTER_CAST[m.def];
                const hover = cast?.hover ? cast.hover + Math.round(Math.sin(now / 320 + i) * 2) : 0;
                g.globalAlpha = Math.max(0, fade);
                let box: { x: number; y: number; w: number; h: number } | null = null;
                if (cast) {
                    const at = this.monAtk.get(i);
                    const attacking = !!cast.attack && at !== undefined && now - at < MON_ATTACK_MS && !died;
                    const name = attacking ? cast.attack! : cast.sprite;
                    const fr = spriteOf(name);
                    if (fr) {
                        shadow(g, p[0], p[1], Math.max(10, Math.round(fr.w * 0.5)), hover);
                        if (m.champion) ring(g, p[0], p[1], Math.max(12, Math.round(fr.w * 0.55)), now);
                        const f = attacking ? ((now - at!) / MON_ATTACK_MS) * fr.n : now / (1000 / (cast.fps ?? 8)) + i * 1.7;
                        box = drawSprite(g, name, f, p[0], p[1] - hover, { left: true, flash: hit, tint: m.champion ? "#ffc233" : cast.tint, strength: m.champion ? 0.3 : cast.strength });
                    }
                }
                if (!box) {
                    drawMonster(g, def, p[0], p[1] + (died ? (1 - fade) * 6 : 0), hit, m.champion, now);
                    const hgt = monsterHeight(def);
                    box = { x: p[0] - 11, y: p[1] - hgt, w: 22, h: hgt };
                }
                g.globalAlpha = 1;
                if (!died && !def.boss) {
                    const w = Math.max(16, Math.min(40, Math.round(box.w * 0.6)));
                    bar(g, Math.round(p[0] - w / 2), box.y - 5, w, 2, m.life / m.maxLife, m.champion ? "#ffc233" : "#e5383b");
                }
            }
            const boss = run.monsters.find(m => MONSTERS[m.def]?.boss && m.life > 0);
            if (boss) {
                // Boss plate: name over a life bar, top centre.
                const bw = Math.min(200, this.W - 120), bx = Math.round(this.W / 2 - bw / 2);
                g.fillStyle = "#111"; g.fillRect(bx - 2, 3, bw + 4, 19);
                drawText(g, monsterName(boss.def).toUpperCase(), this.W / 2, 3, "#ffffff", "center");
                bar(g, bx, 15, bw, 4, boss.life / boss.maxLife, "#e5383b");
            }
        }

        // Hero: the calling's own sprite, idle / run / attack / hurt.
        const walking = run?.phase === "travel";
        const dead = run?.phase === "dead";
        const hc = HERO_CAST[state.hero.cls];
        let drew = false;

        // The companion trots behind the hero (fliers bob above it) and hops when the hero strikes.
        const pet = state.hero.pet ? COMPANIONS[state.hero.pet.id] : undefined;
        if (pet && spriteOf(pet.sprite)) {
            const px = this.HERO_X - 24;
            const since = now - this.heroAtk;
            const hop = !walking && !dead && since < 260 ? Math.round(Math.sin((since / 260) * Math.PI) * 4) : 0;
            const lift = (pet.hover ?? 0) + (pet.hover ? Math.round(Math.sin(now / 320) * 2) : 0);
            shadow(g, px, G, pet.hover ? 5 : 7, pet.hover ?? 0);
            const fps = (pet.fps ?? 8) * (walking ? 1.5 : 1);
            drawSprite(g, pet.sprite, dead ? 0 : (now * fps) / 1000, px, G - lift - hop,
                { scale: pet.scale ?? 1, ...(dead ? { tint: "#1a1410", strength: 0.5 } : pet.tint ? { tint: pet.tint, strength: pet.strength ?? 0.4 } : {}) });
        }
        if (hc && spriteOf(hc.idle)) {
            const hurt = now - this.heroHurt < HURT_MS;
            const atk = now - this.heroAtk;
            shadow(g, this.HERO_X, G, 12, 0);
            // Swings win over flinches: under a big pack the hero is hit all the time, so a hit
            // only washes the current frame red; the hurt pose shows when it isn't attacking.
            const red = now - this.heroHurt < 70 ? { tint: "#ff2a2a", strength: 0.3 } : {};
            if (dead) drew = !!drawSprite(g, hc.hurt, 99, this.HERO_X, G, { tint: "#1a1410", strength: 0.5 });
            else if (atk < HERO_ATTACK_MS && !walking) drew = !!drawSprite(g, hc.attack, (atk / HERO_ATTACK_MS) * (spriteOf(hc.attack)?.n ?? 1), this.HERO_X, G, red);
            else if (walking) drew = !!drawSprite(g, hc.run, now / 70, this.HERO_X, G);
            else if (hurt) drew = !!drawSprite(g, hc.hurt, (now - this.heroHurt) / HURT_MS * (spriteOf(hc.hurt)?.n ?? 1), this.HERO_X, G, red);
            else drew = !!drawSprite(g, hc.idle, now / 160, this.HERO_X, G);
        }
        if (!drew) {
            const last = this.fx[this.fx.length - 1];
            let lunge = 0;
            if (last && now - last.t < 160 && (last.kind === "arc" || last.kind === "stab" || last.kind === "slam")) lunge = Math.sin((now - last.t) / 160 * Math.PI) * 14;
            const wItem = state.hero.equipment.weapon;
            const look = { cape: CLASSES[state.hero.cls]?.color ?? "#e2543b", weapon: wItem ? (BASES[wItem.base]?.kind ?? "sword") : "none", shield: !!state.hero.equipment.offhand };
            drawHero(g, this.HERO_X + lunge, G, look, walking ? now : 0, now - this.heroHurt < 120, !!dead);
        }

        // Skill effects.
        this.fx = this.fx.filter(f => now - f.t < 350);
        for (const f of this.fx) this.drawFx(f, pos, now, hc?.projectile);

        // Deaths burst where the monster stood.
        this.bursts = this.bursts.filter(b => now - b.t < DEATH_FX_MS);
        for (const b of this.bursts) {
            const k = (now - b.t) / DEATH_FX_MS;
            drawSprite(g, "fx.death", k * (spriteOf("fx.death")?.n ?? 1), b.x, b.y + 4, { scale: b.big ? 2 : 1 });
        }

        // Floating numbers: pixel font, crits pop bigger for a moment.
        this.floats = this.floats.filter(f => now - f.t < 800);
        for (const f of this.floats) {
            const k = (now - f.t) / 800;
            g.globalAlpha = Math.max(0, 1 - k * k);
            const y = Math.round(f.y - k * 16 - (f.big && k < 0.15 ? 2 : 0));
            drawText(g, f.text.toUpperCase(), Math.round(f.x), y, f.color, "center");
        }
        g.globalAlpha = 1;
        g.restore();

        if (dead && run) {
            g.fillStyle = "rgba(10,10,14,0.6)"; g.fillRect(0, 0, this.W, this.H);
            const cy = Math.round(this.H / 2) - 12;
            drawText(g, t("battle.relights"), this.W / 2, cy, "#ff5a36", "center");
            drawText(g, t("battle.backIn", { n: Math.max(0, run.timer).toFixed(0) }), this.W / 2, cy + 12, "#ffffff", "center");
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

    private background(zone: { id: string; name: string; palette: [string, string, string] }): void {
        const g = this.g;
        const W = this.W, H = this.H, G = this.GROUND, pal = zone.palette, seedStr = zone.id;
        const set = setFor(zone.id, zone.name);
        if (spriteOf(set.layers[0]!.sprite)) {
            // Parallax art: far layers barely move, near ones follow the road.
            g.fillStyle = set.sky; g.fillRect(0, 0, W, H);
            const road = this.travel * 5;
            for (const l of set.layers) tileLayer(g, l.sprite, W, G + (l.drop ?? 0), road * l.parallax);
            // The zone's own tone over the shared art.
            g.globalAlpha = 0.12; g.fillStyle = pal[0]; g.fillRect(0, 0, W, G); g.globalAlpha = 1;
            g.fillStyle = set.ground; g.fillRect(0, G, W, H - G);
            g.fillStyle = set.edge; g.fillRect(0, G, W, 1);
            g.fillStyle = "#111"; g.fillRect(0, G + 1, W, 1);
            g.fillStyle = set.edge;
            for (let x = -((this.travel * 1.2) % 24); x < W; x += 24) g.fillRect(Math.round(x), G + 8, 10, 1);
            return;
        }
        g.fillStyle = pal[0]; g.fillRect(0, 0, W, H);
        // Stars / motes in the accent colour, as many as the width asks for.
        let s = 0; for (const c of seedStr) s = (s * 31 + c.charCodeAt(0)) >>> 0;
        g.fillStyle = pal[2];
        const sky = Math.max(20, G - 50);
        for (let i = 0; i < Math.round(W / 22); i++) { s = (s * 1103515245 + 12345) >>> 0; const x = s % W; s = (s * 1103515245 + 12345) >>> 0; g.fillRect(x, (s % sky) + 4, 1, 1); }
        // Two hill layers with parallax while travelling.
        hills(g, W, G, shade(pal[0], -0.25), G - 40, 22, this.travel * 0.3, 0.03);
        hills(g, W, G, shade(pal[1], -0.35), G - 18, 12, this.travel * 0.6, 0.06);
        g.fillStyle = pal[1]; g.fillRect(0, G, W, H - G);
        g.fillStyle = "#111"; g.fillRect(0, G, W, 2);
        g.fillStyle = shade(pal[1], -0.2);
        for (let x = -((this.travel * 1.2) % 24); x < W; x += 24) g.fillRect(x, G + 8, 10, 2);
    }

    private drawFx(f: Fx, pos: [number, number][], now: number, projectile?: "arrow" | "fireball"): void {
        const g = this.g;
        const k = (now - f.t) / 350;
        const targets = f.targets.map(i => pos[i]).filter((p): p is [number, number] => !!p);
        const HX = this.HERO_X, G = this.GROUND;
        g.lineWidth = 2;
        if (f.kind === "arc") {
            g.strokeStyle = `rgba(255,255,255,${1 - k})`;
            g.beginPath(); g.arc(HX + 16, G - 20, 26 + k * 22, -1.1, 0.9); g.stroke();
            g.strokeStyle = `rgba(255,90,54,${1 - k})`;
            g.beginPath(); g.arc(HX + 16, G - 20, 22 + k * 22, -1.0, 0.8); g.stroke();
        } else if (f.kind === "slam") {
            g.strokeStyle = `rgba(255,194,51,${1 - k})`;
            g.beginPath(); g.ellipse(HX + 30 + k * 70, G, 10 + k * 100, 4 + k * 6, 0, Math.PI, 0); g.stroke();
        } else if (f.kind === "stab") {
            for (const p of targets.slice(0, 1)) {
                g.strokeStyle = `rgba(255,255,255,${1 - k})`;
                g.beginPath(); g.moveTo(p[0] - 10, p[1] - 30); g.lineTo(p[0] + 10, p[1] - 14); g.stroke();
                g.beginPath(); g.moveTo(p[0] + 10, p[1] - 30); g.lineTo(p[0] - 10, p[1] - 14); g.stroke();
            }
        } else if (f.kind === "bolt") {
            const end = targets[targets.length - 1] ?? [this.W - 20, G - 20];
            const t = Math.min(1, k * 2);
            const x = HX + 14 + (end[0] - HX - 14) * t, y = G - 24 + (end[1] - 20 - G + 24) * t;
            if (projectile === "fireball" && spriteOf("fx.fireball")) drawSprite(g, "fx.fireball", now / 60, x, y + 12);
            else if (projectile === "arrow") { g.fillStyle = "#111"; g.fillRect(Math.round(x) - 7, Math.round(y) - 1, 12, 3); g.fillStyle = "#ffe8a0"; g.fillRect(Math.round(x) - 6, Math.round(y), 10, 1); }
            else if (spriteOf("fx.orb")) drawSprite(g, "fx.orb", now / 80, x, y + 6);
            else { g.fillStyle = "#111"; g.fillRect(x - 3, y - 3, 7, 7); g.fillStyle = "#ffc233"; g.fillRect(x - 2, y - 2, 5, 5); }
        } else if (f.kind === "nova") {
            g.strokeStyle = `rgba(143,211,255,${1 - k})`;
            g.beginPath(); g.arc(HX, G - 16, 10 + k * 130, 0, Math.PI * 2); g.stroke();
        }
        g.lineWidth = 1;
    }
}

/** A soft oval under a character; fliers cast a smaller, fainter one. */
function shadow(g: CanvasRenderingContext2D, x: number, y: number, rx: number, hover: number): void {
    g.fillStyle = hover ? "rgba(0,0,0,.18)" : "rgba(0,0,0,.32)";
    g.beginPath(); g.ellipse(x, y, Math.max(4, rx - hover / 3), 2.5, 0, 0, Math.PI * 2); g.fill();
}

/** Champions stand in a pulsing gold ring. */
function ring(g: CanvasRenderingContext2D, x: number, y: number, rx: number, now: number): void {
    g.strokeStyle = `rgba(255,194,51,${0.55 + 0.35 * Math.sin(now / 180)})`;
    g.lineWidth = 1;
    g.beginPath(); g.ellipse(x, y, rx, 4, 0, 0, Math.PI * 2); g.stroke();
}

function hills(g: CanvasRenderingContext2D, w: number, ground: number, color: string, base: number, amp: number, off: number, freq: number): void {
    g.fillStyle = color;
    g.beginPath(); g.moveTo(0, ground);
    for (let x = 0; x <= w + 4; x += 4) g.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin((x + off) * freq) * Math.cos((x + off) * freq * 0.37)));
    g.lineTo(w, ground); g.closePath(); g.fill();
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
