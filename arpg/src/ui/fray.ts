// The Fray's view: the arena from three-quarters above, like the survivors
// games with a Diablo floor. A pixel canvas the app scales up by a whole
// number; its logical size follows the window (resize()). The camera follows
// the hero and stops at the arena's edges; a view wider than the arena shows
// all of it, centred, on the zone's darkened sky.
// It only reads the fray and a queue of effects fed by the simulation's
// events (the same idea as battle.ts); nothing here changes the game.

import { BASES, CLASSES, MONSTERS, ZONES, type MonsterDef, type ZoneDef } from "../core/data";
import { ARENA_W, ARENA_H, type FrayEvents, type FrayState } from "../core/fray";
import type { GameState, MonsterState } from "../core/state";
import type { Sheet } from "../core/character";
import { drawText, textSprite, textWidth } from "./gfx/pixfont";
import { t } from "../i18n";
import { monsterName } from "../i18n/names";
import { drawSprite, loadSprites, spriteOf } from "./gfx/sprites";
import { HERO_CAST, MONSTER_CAST } from "./gfx/cast";
import { drawPumpkin } from "./gfx/pumpkin";
import { shade } from "./battle";

/** Hollow Night: lantern-touched monsters glow pumpkin orange (champions keep their gold). */
const LANTERN_TINT = "#ff7a1a";

/** How long one-shot animations and effects last, in ms. */
const HERO_ATTACK_MS = 380, MON_ATTACK_MS = 520, HURT_MS = 220, DEATH_FX_MS = 540;
const FLASH_MS = 120, BAR_MS = 1500, FX_MS = 350, BOLT_MS = 180, FLOAT_MS = 800, BANNER_MS = 1400, SPAWN_MS = 250;
const IMPACT_FRAME_MS = 55;
/** A monster this close to its swing (seconds) shows it is winding up. */
const TELEGRAPH = 0.35;
/** Mirrors the core's swing reach (core/fray.ts: CAST_RANGE + 12 for casters, reach * 1.25 in melee): farther, the swing is air. */
const CAST_REACH = 108, MELEE_REACH = 1.25;
/** Seconds of fray time the key hint stays up. */
const HINT_S = 12;
/** Caps on the effect queues (a big pack under an area skill makes a lot of numbers). */
const MAX_FX = 12, MAX_FLOATS = 32, MAX_BURSTS = 16, MAX_IMPACTS = 4;
/** Floor tiles: 2:1 diamonds. */
const TILE = 32;

/** A skill effect; target positions are world coordinates captured when it fired. */
interface Fx { kind: string; t: number; tx: number[]; ty: number[] }
/** World coordinates, so a number stays where it popped while the camera moves. */
interface Float { x: number; y: number; text: string; color: string; t: number; big: boolean }
interface Burst { x: number; y: number; t: number; big: boolean; color: string }
/** A monster's spell effect bursting on the hero. */
interface Impact { sprite: string; t: number }
/**
 * What the view remembers about one monster. Keyed by its state object, not its
 * index: a new wave drops the dead from the lists and every index shifts.
 */
interface MonFx { seed: number; born: number; hit: number; atk: number; dead: boolean; left: boolean; h: number }

type Box = { x: number; y: number; w: number; h: number };

export class FrayView {
    readonly canvas: HTMLCanvasElement;
    private g: CanvasRenderingContext2D;
    private W = 320;
    private H = 200;
    private fx: Fx[] = [];
    private floats: Float[] = [];
    private bursts: Burst[] = [];
    private impacts: Impact[] = [];
    private mons = new WeakMap<MonsterState, MonFx>();
    private seq = 0;
    private heroAtk = -1e9;
    private heroHurt = -1e9;
    /** How far the hero sprite reaches above its feet (last frame), for numbers over its head. */
    private heroTop = 30;
    private shake = -1e9;
    private shakeAmp = 0;
    private jitter = 0;
    private banner = "";
    private bannerAt = -1e9;
    private bannerBoss = false;
    private endAt = 0;
    /** The fray the transient fx belong to; a different one wipes them. */
    private last: FrayState | null = null;
    /** Floor cache: one offscreen canvas per zone and margin. */
    private floor: HTMLCanvasElement | null = null;
    private floorZone = "";
    private floorMx = -1;
    private floorMy = -1;
    /** Draw order, reused every frame (-1 is the hero). */
    private order: number[] = [];
    private cur: FrayState | null = null;
    private byY = (a: number, b: number): number => this.footY(a) - this.footY(b);

    constructor() {
        this.canvas = document.createElement("canvas");
        this.canvas.width = this.W; this.canvas.height = this.H;
        this.g = this.canvas.getContext("2d")!;
        void loadSprites();
    }

    /** Logical size in pixels (the app scales the canvas up by a whole number with CSS, image-rendering: pixelated). */
    resize(w: number, h: number): void {
        w = Math.max(160, Math.round(w)); h = Math.max(100, Math.round(h));
        if (w === this.W && h === this.H) return;
        this.W = w; this.H = h;
        this.canvas.width = w; this.canvas.height = h;
    }

    /** Forget transient fx (called when a fray starts). */
    reset(): void {
        this.fx.length = 0; this.floats.length = 0; this.bursts.length = 0; this.impacts.length = 0;
        this.mons = new WeakMap();
        this.heroAtk = -1e9; this.heroHurt = -1e9;
        this.shake = -1e9; this.shakeAmp = 0;
        this.banner = ""; this.bannerAt = -1e9; this.bannerBoss = false;
        this.endAt = 0;
        this.last = null;
    }

    /** A new fray object (events or a draw seeing it first) starts from a clean slate. */
    private sync(f: FrayState): void {
        if (f === this.last) return;
        this.reset();
        this.last = f;
    }

    private monFx(m: MonsterState, now: number): MonFx {
        let mf = this.mons.get(m);
        if (!mf) { mf = { seed: (this.seq++ * 7) % 23, born: now, hit: -1e9, atk: -1e9, dead: false, left: true, h: 24 }; this.mons.set(m, mf); }
        return mf;
    }

    /** Hooks for the simulation's events (same idea as Battle.events). `fray()` returns the live fray or null. */
    events(now: () => number, fray: () => FrayState | null): FrayEvents {
        return {
            heroUse: (kind, targets) => {
                const f = fray(); if (!f) return;
                this.sync(f);
                const n = now();
                this.heroAtk = n;
                const tx: number[] = [], ty: number[] = [];
                for (const i of targets) {
                    const fm = f.mons[i];
                    if (fm) { tx.push(fm.x); ty.push(fm.y); }
                    if (tx.length >= 4) break;
                }
                this.fx.push({ kind, t: n, tx, ty });
                if (this.fx.length > MAX_FX) this.fx.shift();
            },
            heroHit: (i, dmg, crit) => {
                const f = fray(); if (!f) return;
                this.sync(f);
                const m = f.run.monsters[i], fm = f.mons[i];
                if (!m || !fm) return;
                const n = now(), mf = this.monFx(m, n);
                mf.hit = n;
                if (crit) this.kick(n, 2);
                this.pushFloat({ x: fm.x, y: fm.y - mf.h - 4, text: fmtShort(dmg), color: crit ? "#ffc233" : "#ffffff", t: n, big: crit });
                // The core calls this before it counts the kill, so the burst lands on the frame it died.
                if (m.life <= 0) this.die(m, fm.x, fm.y, n);
            },
            heroMiss: i => {
                const f = fray(); if (!f) return;
                this.sync(f);
                const m = f.run.monsters[i], fm = f.mons[i];
                if (!m || !fm) return;
                const n = now();
                this.pushFloat({ x: fm.x, y: fm.y - this.monFx(m, n).h - 4, text: t("battle.miss"), color: "#9aa0a6", t: n, big: false });
            },
            monsterHit: (i, dmg, avoided) => {
                const f = fray(); if (!f) return;
                this.sync(f);
                const n = now(), m = f.run.monsters[i];
                if (m) this.monFx(m, n).atk = n;
                const hx = f.hero.x, hy = f.hero.y - this.heroTop - 2;
                if (avoided) { this.pushFloat({ x: hx, y: hy, text: t(avoided === "evade" ? "battle.evade" : "battle.block"), color: "#7fd1ff", t: n, big: false }); return; }
                this.heroHurt = n;
                this.kick(n, 1);
                this.pushFloat({ x: hx - 4, y: hy, text: fmtShort(dmg), color: "#ff5a36", t: n, big: false });
                const fx = MONSTER_CAST[m?.def ?? ""]?.castFx;
                if (fx && this.impacts.length < MAX_IMPACTS) this.impacts.push({ sprite: fx, t: n });
            },
            flask: () => {
                const f = fray(); if (!f) return;
                this.sync(f);
                this.pushFloat({ x: f.hero.x, y: f.hero.y - this.heroTop - 10, text: t("battle.flask"), color: "#3fbf5f", t: now(), big: false });
            },
            level: l => {
                const f = fray(); if (!f) return;
                this.sync(f);
                const n = now();
                this.pushFloat({ x: f.hero.x, y: f.hero.y - this.heroTop - 22, text: t("battle.level", { n: l }), color: "#ffc233", t: n, big: true });
                this.kick(n, 2);
            },
            wave: (n, boss) => {
                const f = fray();
                if (f) this.sync(f);
                this.banner = boss ? t("fray.bossIncoming") : t("fray.incoming", { n });
                this.bannerAt = now();
                this.bannerBoss = boss;
            },
        };
    }

    /** A short screen shake. */
    private kick(t: number, amp: number) { this.shakeAmp = t - this.shake < 140 ? Math.max(amp, this.shakeAmp) : amp; this.shake = t; }

    private pushFloat(f: Float) {
        // Spread simultaneous numbers so they don't stack on one spot.
        this.jitter = (this.jitter + 1) % 5;
        f.x += (this.jitter - 2) * 8; f.y -= (this.jitter % 3) * 6;
        this.floats.push(f); if (this.floats.length > MAX_FLOATS) this.floats.shift();
    }

    private die(m: MonsterState, x: number, y: number, now: number): void {
        const mf = this.monFx(m, now);
        if (mf.dead) return;
        mf.dead = true;
        const d = MONSTERS[m.def];
        this.bursts.push({ x, y, t: now, big: !!d?.boss, color: d?.look.body ?? "#ffffff" });
        if (this.bursts.length > MAX_BURSTS) this.bursts.shift();
    }

    private footY(i: number): number {
        const f = this.cur!;
        return i < 0 ? f.hero.y : f.mons[i]!.y;
    }

    draw(state: GameState, fray: FrayState, sheet: Sheet, now: number, ui: { paused: boolean; leaveArmed: boolean }): void {
        const g = this.g;
        g.imageSmoothingEnabled = false;
        this.sync(fray);
        this.cur = fray;
        const W = this.W, H = this.H;
        const zone = ZONES[fray.zone] ?? ZONES.a1_shore!;
        const hero = fray.hero, run = fray.run;

        // Camera: the hero's body in the middle, clamped to the arena; whole pixels only.
        const camX = W >= ARENA_W ? -Math.round((W - ARENA_W) / 2) : Math.round(Math.max(0, Math.min(ARENA_W - W, hero.x - W / 2)));
        const camY = H >= ARENA_H ? -Math.round((H - ARENA_H) / 2) : Math.round(Math.max(0, Math.min(ARENA_H - H, hero.y - 12 - H / 2)));
        let sx = 0, sy = 0;
        if (now - this.shake < 140 && this.shakeAmp) {
            // Deterministic wobble rather than Math.random: the same frame looks the same.
            sx = Math.round(Math.sin(now * 0.9) * this.shakeAmp);
            sy = Math.round(Math.cos(now * 1.3) * this.shakeAmp * 0.5);
        }
        const cx = camX - sx, cy = camY - sy;

        // Floor: built once, blitted with the camera offset. The canvas edge (seen while
        // shaking) gets the same dark as outside the arena.
        const fl = this.floorFor(zone);
        g.fillStyle = shade(zone.palette[0], -0.6); g.fillRect(0, 0, W, H);
        g.drawImage(fl, -cx - this.floorMx, -cy - this.floorMy);

        // Entities by their feet: whoever stands lower on the screen is in front.
        const ord = this.order;
        ord.length = 0;
        for (let i = 0; i < run.monsters.length; i++) {
            const m = run.monsters[i]!, fm = fray.mons[i];
            if (!fm) continue;
            if (m.life <= 0) { this.die(m, fm.x, fm.y, now); continue; }
            ord.push(i);
        }
        ord.push(-1);
        ord.sort(this.byY);
        const hc = HERO_CAST[state.hero.cls];
        for (const i of ord) {
            if (i < 0) this.drawHero(state, fray, sheet, now, cx, cy);
            else this.drawMon(fray, i, now, cx, cy);
        }

        const hx = Math.round(hero.x - cx), hy = Math.round(hero.y - cy);
        // Monster spells bursting on the hero.
        {
            let j = 0;
            for (const im of this.impacts) if ((now - im.t) / IMPACT_FRAME_MS < (spriteOf(im.sprite)?.n ?? 0)) this.impacts[j++] = im;
            this.impacts.length = j;
            for (const im of this.impacts) drawSprite(g, im.sprite, (now - im.t) / IMPACT_FRAME_MS, hx, hy);
        }

        // Skill effects, aimed from the hero at what it hit.
        prune(this.fx, now, FX_MS);
        for (const f of this.fx) this.drawFx(f, now, hx, hy, cx, cy, hero.face, hc?.projectile);

        // Deaths burst where the monster stood.
        prune(this.bursts, now, DEATH_FX_MS);
        const deathN = spriteOf("fx.death")?.n ?? 0;
        for (const b of this.bursts) {
            const k = (now - b.t) / DEATH_FX_MS;
            const bx = Math.round(b.x - cx), by = Math.round(b.y - cy);
            if (deathN) drawSprite(g, "fx.death", k * deathN, bx, by + 4, { scale: b.big ? 2 : 1 });
            else {
                // No atlas: chips of the body colour fly out and fade.
                g.globalAlpha = Math.max(0, 1 - k);
                const r = (b.big ? 26 : 14) * k, s = b.big ? 4 : 3;
                for (let a = 0; a < 6; a++) {
                    const ang = a * 1.047 + 0.3;
                    box(g, bx + Math.cos(ang) * r - 1, by - 8 + Math.sin(ang) * r * 0.6 - 1, s, s, b.color);
                }
                g.globalAlpha = 1;
            }
        }

        // Floating numbers: pixel font; crits and level-ups twice the size.
        prune(this.floats, now, FLOAT_MS);
        for (const f of this.floats) {
            const k = (now - f.t) / FLOAT_MS;
            g.globalAlpha = Math.max(0, 1 - k * k);
            const x = Math.round(f.x - cx), y = Math.round(f.y - cy - k * 16);
            if (f.big) drawBig(g, f.text.toUpperCase(), x, y - 8, f.color, 2);
            else drawText(g, f.text.toUpperCase(), x, y, f.color, "center");
        }
        g.globalAlpha = 1;

        this.hud(fray, now, ui);
    }

    private drawMon(fray: FrayState, i: number, now: number, cx: number, cy: number): void {
        const g = this.g;
        const m = fray.run.monsters[i]!, fm = fray.mons[i]!, def = MONSTERS[m.def]!;
        const mf = this.monFx(m, now);
        const x = Math.round(fm.x - cx), y = Math.round(fm.y - cy);
        // Facing: the way it walks; standing, toward the hero. The dead zone keeps a
        // monster jostled in a crowd from flickering left and right.
        if (fm.vx < -4) mf.left = true;
        else if (fm.vx > 4) mf.left = false;
        else if (Math.abs(fray.hero.x - fm.x) > 3) mf.left = fray.hero.x < fm.x;
        const hit = now - mf.hit < FLASH_MS;
        const cast = MONSTER_CAST[m.def];
        const hover = cast?.hover ? cast.hover + Math.round(Math.sin(now / 320 + mf.seed) * 2) : 0;
        const reach = fm.caster ? CAST_REACH : fm.reach * MELEE_REACH;
        const winding = fray.outcome === "fight" && m.atk < TELEGRAPH && Math.hypot(fray.hero.x - fm.x, fray.hero.y - fm.y) <= reach;
        // Newcomers fade in at the edge instead of popping.
        g.globalAlpha = Math.max(0, Math.min(1, (now - mf.born) / SPAWN_MS));
        let b: Box | null = null;
        let showsSwing = false;
        if (cast) {
            const fr = spriteOf(cast.sprite);
            if (fr) {
                const sc = cast.scale ?? 1;
                const rx = Math.max(6, Math.round(fr.w * 0.35 * sc));
                shadow(g, x, y, rx, hover);
                if (m.champion) ring(g, x, y, rx + 2, now);
                const af = cast.attack ? spriteOf(cast.attack) : null;
                const since = now - mf.atk;
                let name = cast.sprite, f = now / (1000 / (cast.fps ?? 8)) + mf.seed * 1.7;
                // The attack art plays its first half as the wind-up, the second half as the blow lands.
                if (af && since < MON_ATTACK_MS / 2) { name = cast.attack!; f = Math.min(af.n - 0.01, af.n / 2 + (since / (MON_ATTACK_MS / 2)) * (af.n / 2)); showsSwing = true; }
                else if (af && winding) { name = cast.attack!; f = (1 - Math.max(0, m.atk) / TELEGRAPH) * (af.n / 2); showsSwing = true; }
                b = drawSprite(g, name, f, x, y - hover, {
                    left: mf.left, flash: hit, scale: sc,
                    tint: m.champion ? "#ffc233" : m.lantern ? LANTERN_TINT : cast.tint,
                    strength: m.champion ? 0.3 : m.lantern ? 0.35 : cast.strength,
                });
            }
        }
        if (!b) {
            shadow(g, x, y, Math.round(10 * def.look.size), def.look.shape === "bird" ? 10 : 0);
            // The drawn shapes reach left; mirror them when the monster faces right.
            if (!mf.left) { g.save(); g.translate(x * 2, 0); g.scale(-1, 1); }
            drawMonster(g, def, x, y, hit, m.champion, now);
            if (!mf.left) g.restore();
            const hgt = monsterHeight(def);
            b = { x: x - 11, y: y - hgt, w: 22, h: hgt };
        }
        g.globalAlpha = 1;
        mf.h = Math.max(10, y - b.y);
        let top = b.y;
        if (def.boss || m.champion || now - mf.hit < BAR_MS) {
            const w = def.boss ? 30 : Math.max(14, Math.min(28, Math.round(b.w * 0.5)));
            bar(g, Math.round(x - w / 2), top - 4, w, 2, m.life / m.maxLife, m.champion ? "#ffc233" : m.lantern ? "#ff8a1f" : "#e5383b");
            top -= 5;
        }
        if (m.lantern) drawPumpkin(g, x, top - 3 + Math.round(Math.sin(now / 300 + mf.seed) * 1.5), now + mf.seed * 211);
        // No attack art: a blinking red mark says the blow is coming.
        if (winding && !showsSwing && Math.floor(now / 90) % 2 === 0) drawText(g, "!", x, top - 11, "#ff3b3b", "center");
    }

    private drawHero(state: GameState, fray: FrayState, sheet: Sheet, now: number, cx: number, cy: number): void {
        const g = this.g;
        const hero = fray.hero;
        const x = Math.round(hero.x - cx), y = Math.round(hero.y - cy);
        const left = hero.face < 0;
        const dead = fray.outcome === "fallen";
        const hc = HERO_CAST[state.hero.cls];
        const atk = now - this.heroAtk, hurt = now - this.heroHurt;
        shadow(g, x, y, 9, 0);
        let b: Box | null = null;
        if (hc && spriteOf(hc.idle)) {
            // Swings win over flinches: in a crowd the hero is hit all the time, so a hit
            // only washes the frame red; the hurt pose shows when nothing else does.
            const red = hurt < 70 ? { tint: "#ff2a2a", strength: 0.3 } : {};
            if (dead) b = drawSprite(g, hc.hurt, 99, x, y, { left, tint: "#1a1410", strength: 0.5 });
            else if (atk < HERO_ATTACK_MS) b = drawSprite(g, hc.attack, (atk / HERO_ATTACK_MS) * (spriteOf(hc.attack)?.n ?? 1), x, y, { left, ...red });
            else if (hero.moving) b = drawSprite(g, hc.run, now / 70, x, y, { left, ...red });
            else if (hurt < HURT_MS) b = drawSprite(g, hc.hurt, (hurt / HURT_MS) * (spriteOf(hc.hurt)?.n ?? 1), x, y, { left, ...red });
            else b = drawSprite(g, hc.idle, now / 160, x, y, { left });
        }
        if (!b) {
            const last = this.fx[this.fx.length - 1];
            let lunge = 0;
            if (last && now - last.t < 160 && (last.kind === "arc" || last.kind === "stab" || last.kind === "slam")) lunge = Math.sin((now - last.t) / 160 * Math.PI) * 5;
            const wItem = state.hero.equipment.weapon;
            const look = { cape: CLASSES[state.hero.cls]?.color ?? "#e2543b", weapon: wItem ? (BASES[wItem.base]?.kind ?? "sword") : "none", shield: !!state.hero.equipment.offhand };
            // The drawn hero faces right; mirror it for the left.
            const hx = x + Math.round(lunge) * (left ? -1 : 1);
            if (left) { g.save(); g.translate(hx * 2, 0); g.scale(-1, 1); }
            drawHeroShape(g, hx, y, look, hero.moving ? now : 0, hurt < 120, dead);
            if (left) g.restore();
            b = { x: x - 10, y: y - 31, w: 20, h: 31 };
        }
        // Sprite boxes carry padding; cap so numbers don't float far above a small head.
        this.heroTop = Math.max(18, Math.min(40, y - b.y));
        // Life (and energy shield) under the feet, where the eye already is.
        if (!dead && sheet.life > 0) {
            const h = fray.run.hero;
            bar(g, x - 10, y + 4, 20, 2, h.life / sheet.life, "#e5383b");
            if (sheet.es > 0) { g.fillStyle = "#8fd3ff"; g.fillRect(x - 10, y + 7, Math.round(20 * Math.max(0, Math.min(1, h.es / sheet.es))), 1); }
        }
    }

    private drawFx(f: Fx, now: number, hx: number, hy: number, cx: number, cy: number, face: number, projectile?: "arrow" | "fireball"): void {
        const g = this.g;
        const k = (now - f.t) / FX_MS;
        const chest = hy - 10;
        // The first target, or a step ahead of the hero when it has none.
        const tx = f.tx.length ? Math.round(f.tx[0]! - cx) : hx + face * 20;
        const ty = f.ty.length ? Math.round(f.ty[0]! - cy) : hy;
        g.lineWidth = 2;
        if (f.kind === "arc") {
            // A sweep toward the target, flattened onto the three-quarter plane.
            const ang = Math.atan2((ty - 8 - chest) / 0.7, tx - hx);
            g.save(); g.translate(hx, chest); g.scale(1, 0.7);
            g.strokeStyle = `rgba(255,255,255,${1 - k})`;
            g.beginPath(); g.arc(0, 0, 16 + k * 14, ang - 1.1, ang + 1.1); g.stroke();
            g.strokeStyle = `rgba(255,90,54,${1 - k})`;
            g.beginPath(); g.arc(0, 0, 12 + k * 14, ang - 1.0, ang + 1.0); g.stroke();
            g.restore();
        } else if (f.kind === "slam") {
            // A ground ring thrown a little toward the target side.
            const d = Math.hypot(tx - hx, ty - hy) || 1;
            const ox = hx + ((tx - hx) / d) * 10, oy = hy + ((ty - hy) / d) * 5;
            const rx = 8 + k * 36;
            g.strokeStyle = `rgba(255,194,51,${1 - k})`;
            g.beginPath(); g.ellipse(ox, oy, rx, rx * 0.5, 0, 0, Math.PI * 2); g.stroke();
            g.strokeStyle = `rgba(255,90,54,${(1 - k) * 0.6})`;
            g.beginPath(); g.ellipse(ox, oy, rx * 0.6, rx * 0.3, 0, 0, Math.PI * 2); g.stroke();
        } else if (f.kind === "stab") {
            const py = ty - 12;
            g.strokeStyle = `rgba(255,255,255,${1 - k})`;
            g.beginPath(); g.moveTo(tx - 7, py - 7); g.lineTo(tx + 7, py + 7); g.stroke();
            g.beginPath(); g.moveTo(tx + 7, py - 7); g.lineTo(tx - 7, py + 7); g.stroke();
        } else if (f.kind === "bolt") {
            const p = Math.min(1, (now - f.t) / BOLT_MS);
            const n = Math.max(1, f.tx.length);
            for (let j = 0; j < n; j++) {
                const ex = f.tx.length ? Math.round(f.tx[j]! - cx) : tx, ey = (f.ty.length ? Math.round(f.ty[j]! - cy) : ty) - 8;
                if (p >= 1) {
                    // Arrived: a small pop where it struck.
                    g.strokeStyle = `rgba(255,232,160,${1 - k})`;
                    g.beginPath(); g.arc(ex, ey, 2 + k * 6, 0, Math.PI * 2); g.stroke();
                    continue;
                }
                const x = hx + (ex - hx) * p, y = chest + (ey - chest) * p;
                if (projectile === "fireball" && spriteOf("fx.fireball")) drawSprite(g, "fx.fireball", now / 60, x, y + 12, { left: ex < hx });
                else if (projectile === "arrow") arrow(g, x, y, ex - hx, ey - chest);
                else if (spriteOf("fx.orb")) drawSprite(g, "fx.orb", now / 80, x, y + 6, { left: ex < hx });
                else { box(g, x - 2, y - 2, 5, 5, "#ffc233"); }
            }
        } else if (f.kind === "nova") {
            // A ring around the hero's feet, flat on the floor.
            const rx = 8 + k * 44;
            g.strokeStyle = `rgba(143,211,255,${1 - k})`;
            g.beginPath(); g.ellipse(hx, hy - 2, rx, rx * 0.5, 0, 0, Math.PI * 2); g.stroke();
            g.strokeStyle = `rgba(255,255,255,${(1 - k) * 0.5})`;
            g.beginPath(); g.ellipse(hx, hy - 2, rx * 0.7, rx * 0.35, 0, 0, Math.PI * 2); g.stroke();
        }
        g.lineWidth = 1;
    }

    /** The overlay: wave and kills, the boss plate, banners, hints and the end screens. No shake. */
    private hud(fray: FrayState, now: number, ui: { paused: boolean; leaveArmed: boolean }): void {
        const g = this.g, W = this.W, H = this.H;
        const run = fray.run;
        const wx = drawText(g, t("fray.wave", { n: Math.max(1, fray.wave), total: fray.waves }).toUpperCase(), 4, 4, "#ffffff");
        if (fray.bossUp) drawText(g, t("fray.boss").toUpperCase(), 4 + wx + 4, 4, "#ff5a36");
        drawText(g, t("fray.kills", { n: run.kills }).toUpperCase(), W - 4, 4, "#ffc233", "right");
        drawText(g, mmss(fray.t), W - 4, 14, "#ffffff", "right");

        // Boss plate: name over a life bar, under the top line.
        if (fray.bossUp) {
            for (const m of run.monsters) {
                if (m.life <= 0 || !MONSTERS[m.def]?.boss) continue;
                const bw = Math.min(160, W - 40), bx = Math.round(W / 2 - bw / 2);
                drawText(g, monsterName(m.def).toUpperCase(), W / 2, 24, "#ffffff", "center");
                bar(g, bx, 34, bw, 3, m.life / m.maxLife, "#e5383b");
                break;
            }
        }

        // Wave banner: in fast, holds, fades.
        const bk = (now - this.bannerAt) / BANNER_MS;
        if (this.banner && bk >= 0 && bk < 1 && fray.outcome === "fight") {
            const a = bk < 0.1 ? bk / 0.1 : bk > 0.65 ? (1 - bk) / 0.35 : 1;
            const text = this.banner.toUpperCase(), sc = fit(text, W - 8);
            const y = Math.round(H * 0.3);
            g.globalAlpha = a * 0.45; g.fillStyle = "#0a0a0e"; g.fillRect(0, y - 4, W, 9 * sc + 8);
            g.globalAlpha = a;
            drawBig(g, text, W / 2, y, this.bannerBoss ? "#ff5a36" : "#ffc233", sc);
            g.globalAlpha = 1;
        }

        // Bottom line: the leave prompt wins over the key hint.
        if (fray.outcome === "fight") {
            if (ui.leaveArmed) drawText(g, t("fray.leaveHint").toUpperCase(), W / 2, H - 11, Math.floor(now / 400) % 2 ? "#ffc233" : "#ffffff", "center");
            else if (fray.t < HINT_S) {
                g.globalAlpha = 0.6 * Math.min(1, HINT_S - fray.t);
                drawText(g, t("fray.keys").toUpperCase(), W / 2, H - 11, "#cfcfcf", "center");
                g.globalAlpha = 1;
            }
        }

        if (fray.outcome !== "fight") {
            if (!this.endAt) this.endAt = now;
            const a = Math.min(1, (now - this.endAt) / 400);
            g.globalAlpha = 0.65 * a; g.fillStyle = "#0a0a0e"; g.fillRect(0, 0, W, H);
            g.globalAlpha = a;
            const won = fray.outcome === "won";
            const title = t(won ? "fray.won" : "fray.fallen").toUpperCase(), sc = fit(title, W - 8);
            const y = Math.round(H / 2) - 22;
            drawBig(g, title, W / 2, y, won ? "#ffc233" : "#ff5a36", sc);
            drawText(g, `${t("fray.kills", { n: run.kills }).toUpperCase()} - ${mmss(fray.t)}`, W / 2, y + 9 * sc + 6, "#ffffff", "center");
            drawText(g, t("fray.back").toUpperCase(), W / 2, y + 9 * sc + 20, "#9aa0a6", "center");
            g.globalAlpha = 1;
        } else if (ui.paused) {
            g.globalAlpha = 0.55; g.fillStyle = "#0a0a0e"; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
            const text = t("fray.paused").toUpperCase();
            drawBig(g, text, W / 2, Math.round(H / 2) - 8, "#ffffff", fit(text, W - 8));
        }
    }

    /** The floor and its surroundings for a zone, cached until the zone or the margin changes. */
    private floorFor(zone: ZoneDef): HTMLCanvasElement {
        // A margin past the arena: the view's overhang when it is wider (or taller), plus room for shake.
        const mx = Math.max(0, Math.ceil((this.W - ARENA_W) / 2)) + 8;
        const my = Math.max(0, Math.ceil((this.H - ARENA_H) / 2)) + 8;
        if (this.floor && zone.id === this.floorZone && mx === this.floorMx && my === this.floorMy) return this.floor;
        this.floorZone = zone.id; this.floorMx = mx; this.floorMy = my;
        const fw = ARENA_W + mx * 2, fh = ARENA_H + my * 2;
        const c = this.floor ?? document.createElement("canvas");
        c.width = fw; c.height = fh;
        this.floor = c;
        const fg = c.getContext("2d")!;
        const pal = zone.palette;
        const seed = hashStr(zone.id);
        // Tile shades: a checker of lighter and darker diamonds, a quarter of them a touch off
        // so the floor isn't a perfect grid; dark seams between them.
        const shades = [rgb(shade(pal[1], 0.07)), rgb(shade(pal[1], 0.02)), rgb(shade(pal[1], -0.07)), rgb(shade(pal[1], -0.12))];
        const seam = rgb(shade(pal[1], -0.3));
        const out = rgb(shade(pal[0], -0.6));
        const edge = rgb(pal[2]);
        const wall = rgb(shade(pal[1], -0.55));
        const img = fg.createImageData(fw, fh), d = img.data;
        for (let y = 0; y < fh; y++) {
            const wy = y - my;
            for (let x = 0; x < fw; x++) {
                const wx = x - mx, p = (y * fw + x) * 4;
                let col: number[], f = 1;
                if (wx >= 0 && wy >= 0 && wx < ARENA_W && wy < ARENA_H) {
                    // Diamond lattice: a = x + 2y and b = x - 2y cut the floor into 32 x 16 diamonds;
                    // a seam where either crosses a multiple of 32 (two pixels wide, one tall: the pixel-art iso line).
                    const a = wx + 2 * wy, b = wx - 2 * wy + 4096;
                    if ((a & (TILE - 1)) < 2 || (b & (TILE - 1)) < 2) col = seam;
                    else {
                        const u = Math.floor(a / TILE), v = Math.floor(b / TILE);
                        col = shades[(((u + v) & 1) << 1) | ((hash2(u, v, seed) & 3) === 0 ? 1 : 0)]!;
                    }
                    // Depth: the far (top) rows a little darker, and a soft rim at the arena's edge.
                    // The whole floor sits a step darker than the zone ground so sprites and numbers read on it.
                    f = 0.76 + 0.1 * (wy / ARENA_H);
                    const e = Math.min(wx, wy, ARENA_W - 1 - wx, ARENA_H - 1 - wy);
                    if (e < 10) f *= 0.8 + 0.02 * e;
                } else if (wx >= -2 && wy >= -2 && wx < ARENA_W + 2 && wy < ARENA_H + 2) col = edge;
                // Below the front edge the arena shows a face, as if it were a raised slab.
                else if (wx >= -2 && wx < ARENA_W + 2 && wy >= ARENA_H + 2 && wy < ARENA_H + 8) col = wall;
                else col = out;
                d[p] = col[0]! * f; d[p + 1] = col[1]! * f; d[p + 2] = col[2]! * f; d[p + 3] = 255;
            }
        }
        fg.putImageData(img, 0, 0);
        this.props(fg, zone, seed, mx, my);
        return c;
    }

    /** Rocks, tufts and bones scattered from the zone id, so a zone's floor is always the same. */
    private props(fg: CanvasRenderingContext2D, zone: ZoneDef, seed: number, mx: number, my: number): void {
        const pal = zone.palette;
        let s = seed || 1;
        const next = () => (s = (Math.imul(s, 1103515245) + 12345) >>> 0) >>> 8;
        const rockD = shade(pal[1], -0.38), rockL = shade(pal[1], 0.18);
        const tuftA = shade(pal[1], 0.28), tuftB = shade(pal[2], -0.35);
        const bone = shade("#e9e4d4", -0.12);
        const n = Math.round((ARENA_W * ARENA_H) / 2600);
        for (let i = 0; i < n; i++) {
            const x = mx + 10 + (next() % (ARENA_W - 20)), y = my + 10 + (next() % (ARENA_H - 20));
            const kind = next() % 10;
            if (kind < 4) {
                const r = 2 + (next() % 3);
                fg.fillStyle = "rgba(0,0,0,0.28)"; fg.fillRect(x - r, y + 1, r * 2 + 2, 1);
                fg.fillStyle = rockD; fg.fillRect(x - r, y - r + 1, r * 2, r);
                fg.fillStyle = rockL; fg.fillRect(x - r + 1, y - r, r * 2 - 2, 1);
            } else if (kind < 8) {
                fg.fillStyle = kind & 1 ? tuftA : tuftB;
                fg.fillRect(x, y - 3, 1, 3); fg.fillRect(x - 2, y - 2, 1, 2); fg.fillRect(x + 2, y - 2, 1, 2);
            } else {
                fg.fillStyle = "rgba(0,0,0,0.22)"; fg.fillRect(x - 3, y + 1, 7, 1);
                fg.fillStyle = bone;
                fg.fillRect(x - 3, y, 6, 1); fg.fillRect(x - 4, y - 1, 2, 1); fg.fillRect(x + 2, y + 1, 2, 1);
                if (kind === 9) fg.fillRect(x + 4, y - 2, 3, 2); // a skull beside it
            }
        }
    }
}

/** Drops entries older than `ms`, in place (no new array every frame). */
function prune<T extends { t: number }>(a: T[], now: number, ms: number): void {
    let j = 0;
    for (let i = 0; i < a.length; i++) if (now - a[i]!.t < ms) a[j++] = a[i]!;
    a.length = j;
}

/** Text at `scale` times the font size, top-centre at x, y. */
function drawBig(g: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, scale: number): void {
    const s = textSprite(text, color);
    const w = s.width * scale, h = s.height * scale;
    g.drawImage(s, Math.round(x - w / 2), Math.round(y), w, h);
}

/** 2x when the text fits the width at that size, else 1x. */
const fit = (text: string, maxW: number): number => ((textWidth(text) + 2) * 2 <= maxW ? 2 : 1);

const mmss = (s: number): string => {
    const m = Math.floor(s / 60), r = Math.floor(s % 60);
    return `${m < 10 ? "0" : ""}${m}:${r < 10 ? "0" : ""}${r}`;
};

/** An arrow in flight along (dx, dy): a dark shaft with a light core, pixel by pixel. */
function arrow(g: CanvasRenderingContext2D, x: number, y: number, dx: number, dy: number): void {
    const l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
    g.fillStyle = "#111";
    for (let i = -6; i <= 5; i++) g.fillRect(Math.round(x + ux * i) - 1, Math.round(y + uy * i) - 1, 3, 3);
    g.fillStyle = "#ffe8a0";
    for (let i = -5; i <= 4; i++) g.fillRect(Math.round(x + ux * i), Math.round(y + uy * i), 1, 1);
}

/** A soft oval under a character, flat on the floor; fliers cast a smaller, fainter one. */
function shadow(g: CanvasRenderingContext2D, x: number, y: number, rx: number, hover: number): void {
    const r = Math.max(4, rx - hover / 3);
    g.fillStyle = hover ? "rgba(0,0,0,.18)" : "rgba(0,0,0,.32)";
    g.beginPath(); g.ellipse(x, y, r, Math.max(2, r * 0.4), 0, 0, Math.PI * 2); g.fill();
}

/** Champions stand in a pulsing gold ring. */
function ring(g: CanvasRenderingContext2D, x: number, y: number, rx: number, now: number): void {
    g.strokeStyle = `rgba(255,194,51,${0.55 + 0.35 * Math.sin(now / 180)})`;
    g.lineWidth = 1;
    g.beginPath(); g.ellipse(x, y, rx, Math.max(3, rx * 0.45), 0, 0, Math.PI * 2); g.stroke();
}

function bar(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, f: number, color: string): void {
    g.fillStyle = "#111"; g.fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle = "#3a3a3a"; g.fillRect(x, y, w, h);
    g.fillStyle = color; g.fillRect(x, y, Math.round(Math.max(0, Math.min(1, f)) * w), h);
}

function rgb(hex: string): number[] {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hashStr(s: string): number {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
}

function hash2(u: number, v: number, seed: number): number {
    let h = Math.imul(u, 374761393) ^ Math.imul(v, 668265263) ^ seed;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return (h ^ (h >>> 16)) >>> 0;
}

function fmtShort(n: number): string {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e4) return Math.round(n / 1e3) + "k";
    return Math.round(n).toString();
}

// ---- Fallback shapes while the atlas is missing (the same hand as battle.ts).

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
            box(g, x - 5 * s, y - 22 * s + bob, 10 * s, 8 * s, body);
            box(g, x - 6 * s, y - 14 * s + bob, 12 * s, 10 * s, dark);
            box(g, x - 5 * s, y - 4 * s, 3 * s, 4 * s, dark); box(g, x + 2 * s, y - 4 * s, 3 * s, 4 * s, dark);
            box(g, x - 9 * s, y - 13 * s + bob, 3 * s, 8 * s, body);
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

function drawHeroShape(g: CanvasRenderingContext2D, x: number, y: number, look: { cape: string; weapon: string; shield: boolean }, walk: number, hurt: boolean, dead: boolean): void {
    if (dead) { box(g, x - 10, y - 5, 20, 5, "#555"); return; }
    const step = walk ? Math.round(Math.sin(walk / 90) * 2) : 0;
    const skin = hurt ? "#ffd0c0" : "#f0c9a0";
    const armour = hurt ? "#e5a0a0" : "#6b7280";
    box(g, x - 7, y - 20, 4, 12, look.cape);                              // cape
    box(g, x - 3, y - 5, 3, 5 + step, armour); box(g, x + 1, y - 5, 3, 5 - step, armour);
    box(g, x - 4, y - 16, 9, 11, armour);                                 // torso
    box(g, x - 3, y - 23, 7, 7, skin);                                    // head
    box(g, x - 4, y - 25, 9, 3, armour);                                  // helm rim
    g.fillStyle = "#ff5a36"; g.fillRect(x, y - 13, 2, 3);                  // the ember
    g.fillStyle = "#111"; g.fillRect(x + 2, y - 21, 1, 2);                 // eye
    drawWeapon(g, x, y, look.weapon);
    if (look.shield && look.weapon !== "bow") box(g, x - 9, y - 16, 5, 8, "#8a5a2b");
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
