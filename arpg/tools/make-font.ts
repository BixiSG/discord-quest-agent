// Builds "Hollow Pixel", the game's bitmap font as a TrueType file, and writes
// src/ui/gfx/font.gen.ts (base64). Capitals, digits and most punctuation are
// the 5x7 glyphs the canvas text already uses (gfx/pixfont.ts); lowercase and
// the rest of printable ASCII are drawn here in the same hand. Every ink pixel
// becomes part of a square outline, so the font is pixel art at any size that
// is a whole multiple of 8px (1 font pixel = 1/8 em).
//
//   cd arpg && node tools/run-ts.mjs tools/make-font.ts     (npm run font)
//
// The file is loaded at runtime with new FontFace(name, bytes): no fetch, so
// Discord's content security policy has nothing to block.

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { GLYPHS } from "../src/ui/gfx/pixfont";

// run-ts bundles this into a temp folder, so paths go from the working directory (arpg/).
const OUT = join(process.cwd(), "src/ui/gfx/font.gen.ts");
export const FAMILY = "Hollow Pixel";
/** Font units per pixel; 8 pixels to the em. */
const P = 128, EM = 8 * P;
/** Rows 0-6 stand on the baseline (cap height 7); rows 7-8 hang below it. */
const ROWS = 9, BASE = 7;

// x-height 5 (rows 2-6), ascenders to row 0, descenders to row 8.
const MORE: Record<string, string[]> = {
    a: ["....", "....", ".##.", "...#", ".###", "#..#", ".###"],
    b: ["#...", "#...", "###.", "#..#", "#..#", "#..#", "###."],
    c: ["....", "....", ".###", "#...", "#...", "#...", ".###"],
    d: ["...#", "...#", ".###", "#..#", "#..#", "#..#", ".###"],
    e: ["....", "....", ".##.", "#..#", "####", "#...", ".###"],
    f: [".##", "#..", "###", "#..", "#..", "#..", "#.."],
    g: ["....", "....", ".###", "#..#", "#..#", "#..#", ".###", "...#", ".##."],
    h: ["#...", "#...", "###.", "#..#", "#..#", "#..#", "#..#"],
    i: ["#", ".", "#", "#", "#", "#", "#"],
    j: ["..#", "...", "..#", "..#", "..#", "..#", "..#", "..#", "##."],
    k: ["#...", "#...", "#..#", "#.#.", "##..", "#.#.", "#..#"],
    l: ["#.", "#.", "#.", "#.", "#.", "#.", ".#"],
    m: [".....", ".....", "##.#.", "#.#.#", "#.#.#", "#.#.#", "#.#.#"],
    n: ["....", "....", "###.", "#..#", "#..#", "#..#", "#..#"],
    o: ["....", "....", ".##.", "#..#", "#..#", "#..#", ".##."],
    p: ["....", "....", "###.", "#..#", "#..#", "#..#", "###.", "#...", "#..."],
    q: ["....", "....", ".###", "#..#", "#..#", "#..#", ".###", "...#", "...#"],
    r: ["....", "....", "#.##", "##..", "#...", "#...", "#..."],
    s: ["....", "....", ".###", "#...", ".##.", "...#", "###."],
    t: ["...", ".#.", "###", ".#.", ".#.", ".#.", "..#"],
    u: ["....", "....", "#..#", "#..#", "#..#", "#..#", ".###"],
    v: [".....", ".....", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
    w: [".....", ".....", "#...#", "#...#", "#.#.#", "#.#.#", ".#.#."],
    x: ["....", "....", "#..#", "#..#", ".##.", "#..#", "#..#"],
    y: ["....", "....", "#..#", "#..#", "#..#", "#..#", ".###", "...#", ".##."],
    z: ["....", "....", "####", "...#", ".##.", "#...", "####"],
    ";": ["..", "##", "##", "..", "##", ".#", "#."],
    "\"": ["#.#", "#.#", "...", "...", "...", "...", "..."],
    "#": [".#.#.", ".#.#.", "#####", ".#.#.", "#####", ".#.#.", ".#.#."],
    "$": ["..#..", ".####", "#.#..", ".###.", "..#.#", "####.", "..#.."],
    "&": [".##..", "#..#.", "#.#..", ".#...", "#.#.#", "#..#.", ".##.#"],
    "*": [".....", "#.#.#", ".###.", "#####", ".###.", "#.#.#", "....."],
    "<": ["...#", "..#.", ".#..", "#...", ".#..", "..#.", "...#"],
    "=": ["....", "....", "####", "....", "####", "....", "...."],
    ">": ["#...", ".#..", "..#.", "...#", "..#.", ".#..", "#..."],
    "@": [".###.", "#...#", "#.###", "#.#.#", "#.###", "#....", ".###."],
    "[": ["##", "#.", "#.", "#.", "#.", "#.", "##"],
    "\\": ["#....", ".#...", ".#...", "..#..", "...#.", "...#.", "....#"],
    "]": ["##", ".#", ".#", ".#", ".#", ".#", "##"],
    "^": ["..#..", ".#.#.", "#...#", ".....", ".....", ".....", "....."],
    "_": ["....", "....", "....", "....", "....", "....", "....", "####"],
    "`": ["#.", ".#", "..", "..", "..", "..", ".."],
    "{": ["..#", ".#.", ".#.", "#..", ".#.", ".#.", "..#"],
    "|": ["#", "#", "#", "#", "#", "#", "#", "#"],
    "}": ["#..", ".#.", ".#.", "..#", ".#.", ".#.", "#.."],
    " ": ["..", "..", "..", "..", "..", "..", ".."],
};

interface Glyph { code: number; rows: string[]; adv: number; rects: [number, number, number, number][] }

function glyphFor(ch: string): string[] {
    const rows = MORE[ch] ?? GLYPHS[ch];
    if (!rows) throw new Error(`no glyph for ${JSON.stringify(ch)}`);
    const w = rows[0]!.length;
    if (rows.some(r => r.length !== w)) throw new Error(`ragged glyph ${JSON.stringify(ch)}`);
    return [...rows, ...Array(ROWS - rows.length).fill(".".repeat(w))];
}

/** Ink pixels as rectangles in font units: runs per row, merged down while identical. */
function rectsOf(rows: string[]): [number, number, number, number][] {
    const open = new Map<string, [number, number, number, number]>();
    const out: [number, number, number, number][] = [];
    rows.forEach((row, r) => {
        const runs: [number, number][] = [];
        for (let i = 0; i < row.length;) {
            if (row[i] !== "#") { i++; continue; }
            let e = i;
            while (e < row.length && row[e] === "#") e++;
            runs.push([i, e]); i = e;
        }
        const next = new Map<string, [number, number, number, number]>();
        for (const [a, b] of runs) {
            const k = `${a},${b}`;
            const top = (BASE - r) * P, bottom = (BASE - r - 1) * P;
            const prev = open.get(k);
            if (prev) { prev[1] = bottom; next.set(k, prev); open.delete(k); }
            else { const rect: [number, number, number, number] = [a * P, bottom, b * P, top]; out.push(rect); next.set(k, rect); }
        }
        open.clear();
        for (const [k, v] of next) open.set(k, v);
    });
    return out; // [x0, y0, x1, y1], y up from the baseline
}

const glyphs: Glyph[] = [];
for (let code = 32; code <= 126; code++) {
    const ch = String.fromCharCode(code);
    const rows = glyphFor(ch);
    const w = rows[0]!.length;
    glyphs.push({ code, rows, adv: (w + 1) * P, rects: rectsOf(rows) });
}
// .notdef: an empty box.
const notdef: Glyph = { code: -1, rows: [], adv: 5 * P, rects: [[0, 0, 4 * P, P], [0, 6 * P, 4 * P, 7 * P], [0, P, P, 6 * P], [3 * P, P, 4 * P, 6 * P]] };
const all = [notdef, ...glyphs];

// ---- TrueType tables -------------------------------------------------------

class W {
    private parts: number[] = [];
    u8(v: number) { this.parts.push(v & 255); return this; }
    u16(v: number) { this.parts.push((v >> 8) & 255, v & 255); return this; }
    i16(v: number) { return this.u16(v < 0 ? v + 65536 : v); }
    u32(v: number) { this.parts.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255); return this; }
    bytes(b: ArrayLike<number>) { for (let i = 0; i < b.length; i++) this.parts.push(b[i]! & 255); return this; }
    get length() { return this.parts.length; }
    done() { return Uint8Array.from(this.parts); }
}

const bbox = (g: Glyph) => g.rects.length
    ? [Math.min(...g.rects.map(r => r[0])), Math.min(...g.rects.map(r => r[1])), Math.max(...g.rects.map(r => r[2])), Math.max(...g.rects.map(r => r[3]))]
    : [0, 0, 0, 0];

// glyf + loca
const glyf = new W();
const loca: number[] = [];
let maxPoints = 0, maxContours = 0;
for (const g of all) {
    loca.push(glyf.length);
    if (!g.rects.length) continue;
    const [x0, y0, x1, y1] = bbox(g);
    glyf.i16(g.rects.length).i16(x0!).i16(y0!).i16(x1!).i16(y1!);
    g.rects.forEach((_, i) => glyf.u16(i * 4 + 3));
    glyf.u16(0); // no instructions
    // Each rectangle clockwise: bottom-left, top-left, top-right, bottom-right.
    const pts: [number, number][] = [];
    for (const [a, b, c, d] of g.rects) pts.push([a, b], [a, d], [c, d], [c, b]);
    const flags: number[] = [], xs = new W(), ys = new W();
    let px = 0, py = 0;
    for (const [x, y] of pts) {
        let f = 1; // on curve
        const dx = x - px, dy = y - py;
        if (dx === 0) f |= 0x10; else if (Math.abs(dx) < 256) { f |= 0x02 | (dx > 0 ? 0x10 : 0); xs.u8(Math.abs(dx)); } else xs.i16(dx);
        if (dy === 0) f |= 0x20; else if (Math.abs(dy) < 256) { f |= 0x04 | (dy > 0 ? 0x20 : 0); ys.u8(Math.abs(dy)); } else ys.i16(dy);
        flags.push(f); px = x; py = y;
    }
    glyf.bytes(flags).bytes(xs.done()).bytes(ys.done());
    while (glyf.length % 4) glyf.u8(0);
    maxPoints = Math.max(maxPoints, pts.length); maxContours = Math.max(maxContours, g.rects.length);
}
loca.push(glyf.length);
const locaT = new W(); for (const o of loca) locaT.u32(o);

const boxes = all.filter(g => g.rects.length).map(bbox);
const xMin = Math.min(...boxes.map(b => b[0]!)), yMin = Math.min(...boxes.map(b => b[1]!)), xMax = Math.max(...boxes.map(b => b[2]!)), yMax = Math.max(...boxes.map(b => b[3]!));
const ascender = EM, descender = -2 * P;
const advMax = Math.max(...all.map(g => g.adv));

const head = new W().u16(1).u16(0).u32(0x00010000).u32(0).u32(0x5f0f3cf5).u16(0x000b).u16(EM)
    .u32(0).u32(3818000000).u32(0).u32(3818000000) // created, modified (fixed: the build is reproducible)
    .i16(xMin).i16(yMin).i16(xMax).i16(yMax).u16(0).u16(8).i16(2).i16(1).i16(0);
const hhea = new W().u32(0x00010000).i16(ascender).i16(descender).i16(0).u16(advMax)
    .i16(Math.min(...boxes.map(b => b[0]!))).i16(Math.min(...all.filter(g => g.rects.length).map(g => g.adv - bbox(g)[2]!))).i16(xMax)
    .i16(1).i16(0).i16(0).i16(0).i16(0).i16(0).i16(0).i16(0).u16(all.length);
const maxp = new W().u32(0x00010000).u16(all.length).u16(maxPoints).u16(maxContours).u16(0).u16(0).u16(2)
    .u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0);
const hmtx = new W(); for (const g of all) hmtx.u16(g.adv).i16(g.rects.length ? bbox(g)[0]! : 0);
const avg = Math.round(glyphs.reduce((s, g) => s + g.adv, 0) / glyphs.length);
const os2 = new W().u16(4).i16(avg).u16(400).u16(5).u16(0)
    .i16(5 * P).i16(5 * P).i16(0).i16(P).i16(5 * P).i16(5 * P).i16(0).i16(4 * P) // sub/superscript
    .i16(P).i16(3 * P).i16(0) // strikeout size/position, family class
    .bytes(new Array(10).fill(0)).u32(1).u32(0).u32(0).u32(0).bytes([78, 79, 78, 69]) // "NONE"
    .u16(0x0040).u16(32).u16(126).i16(ascender).i16(descender).i16(0).u16(ascender).u16(-descender)
    .u32(1).u32(0).i16(5 * P).i16(7 * P).u16(0).u16(32).u16(1);
// cmap: one format-4 segment 32..126 (glyph = code - 31) and the 0xFFFF terminator.
const sub = new W().u16(4).u16(32).u16(0).u16(4).u16(4).u16(1).u16(0)
    .u16(126).u16(0xffff).u16(0).u16(32).u16(0xffff).i16(-31).i16(1).u16(0).u16(0);
const cmap = new W().u16(0).u16(1).u16(3).u16(1).u32(12).bytes(sub.done());
// name
const names: [number, string][] = [[1, FAMILY], [2, "Regular"], [3, `${FAMILY} Regular`], [4, FAMILY], [5, "Version 1.0"], [6, "HollowPixel-Regular"]];
const strs = names.map(([, s]) => [...s].flatMap(ch => [0, ch.charCodeAt(0)]));
const name = new W().u16(0).u16(names.length).u16(6 + names.length * 12);
let off = 0;
names.forEach(([id], i) => { name.u16(3).u16(1).u16(0x409).u16(id).u16(strs[i]!.length).u16(off); off += strs[i]!.length; });
for (const s of strs) name.bytes(s);
const post = new W().u32(0x00030000).u32(0).i16(-P).i16(P).u32(0).u32(0).u32(0).u32(0).u32(0);

// ---- file ------------------------------------------------------------------

const tables: [string, Uint8Array][] = ([
    ["OS/2", os2], ["cmap", cmap], ["glyf", glyf], ["head", head], ["hhea", hhea], ["hmtx", hmtx], ["loca", locaT], ["maxp", maxp], ["name", name], ["post", post],
] as [string, W][]).map(([t, w]) => [t, w.done()]);
const sum = (b: Uint8Array) => { let s = 0; for (let i = 0; i < b.length; i += 4) s = (s + (((b[i] ?? 0) << 24) | ((b[i + 1] ?? 0) << 16) | ((b[i + 2] ?? 0) << 8) | (b[i + 3] ?? 0))) >>> 0; return s; };
const n = tables.length, pow = 2 ** Math.floor(Math.log2(n));
const dir = new W().u32(0x00010000).u16(n).u16(pow * 16).u16(Math.log2(pow)).u16(n * 16 - pow * 16);
let at = 12 + n * 16;
const body: number[] = [];
let headAt = 0;
for (const [tag, data] of tables) {
    dir.bytes([...tag].map(c => c.charCodeAt(0))).u32(sum(data)).u32(at).u32(data.length);
    if (tag === "head") headAt = at;
    const padded = data.length + ((4 - (data.length % 4)) % 4);
    for (let i = 0; i < padded; i++) body.push(data[i] ?? 0);
    at += padded;
}
const font = Uint8Array.from([...dir.done(), ...body]);
const adj = (0xb1b0afba - sum(font)) >>> 0;
font[headAt + 8] = adj >>> 24; font[headAt + 9] = (adj >>> 16) & 255; font[headAt + 10] = (adj >>> 8) & 255; font[headAt + 11] = adj & 255;

const b64 = Buffer.from(font).toString("base64");
writeFileSync(OUT, "// Generated by tools/make-font.ts from the bitmap glyphs (gfx/pixfont.ts plus lowercase). Do not edit.\n"
    + `/** "${FAMILY}": printable ASCII, 8 pixels to the em. TrueType, base64. */\n`
    + `export const PIXEL_FONT = "${b64}";\n`);
console.log(`${FAMILY}: ${all.length} glyphs, ${font.length} bytes, ${(b64.length / 1024).toFixed(1)} KiB base64`);
