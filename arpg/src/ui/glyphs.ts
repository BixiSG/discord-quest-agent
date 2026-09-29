// Pixel glyphs for the window chrome: tiny bitmaps drawn as crisp SVG rects,
// so the tabs and window buttons match the battle canvas. "#" is ink.

const SVG_NS = "http://www.w3.org/2000/svg";

const BITMAPS = {
    hero: [
        "..#####..",
        ".#######.",
        "##.....##",
        "##.#.#.##",
        "##.....##",
        ".#######.",
        "..#...#..",
        ".###.###.",
        "#########",
    ],
    gear: [
        ".......##",
        "......###",
        ".....###.",
        "....###..",
        "#..###...",
        "##.##....",
        ".###.....",
        ".####....",
        "##..#....",
    ],
    forge: [
        ".........",
        "#######..",
        "#########",
        ".#######.",
        "...###...",
        "...###...",
        "..#####..",
        ".#######.",
        ".........",
    ],
    skills: [
        "....#....",
        "...##....",
        "...###...",
        "..####.#.",
        ".#######.",
        ".###.###.",
        "###...###",
        "###...###",
        ".#######.",
    ],
    tree: [
        "###......",
        "###......",
        ".#.......",
        "..#...###",
        "...####.#",
        "......###",
        ".....#...",
        "....###..",
        "....###..",
    ],
    world: [
        "##.......",
        "######...",
        "########.",
        "######...",
        "##.......",
        "##.......",
        "##.......",
        "##.......",
        "####.....",
    ],
    atlas: [
        "....#....",
        "....#....",
        "...###...",
        "..#####..",
        "#########",
        "..#####..",
        "...###...",
        "....#....",
        "....#....",
    ],
    log: [
        "#######..",
        "#.....#..",
        "#.###.#..",
        "#.....#..",
        "#.####.##",
        "#......##",
        "#.###..##",
        "#......#.",
        "########.",
    ],
    menu: [
        ".........",
        "#########",
        "#########",
        ".........",
        "#########",
        "#########",
        ".........",
        "#########",
        "#########",
    ],
    min: [
        ".......",
        ".......",
        ".......",
        ".......",
        ".......",
        "#######",
        "#######",
    ],
    max: [
        "#######",
        "#######",
        "#.....#",
        "#.....#",
        "#.....#",
        "#.....#",
        "#######",
    ],
    restore: [
        "..#####",
        "..#####",
        "#####.#",
        "#####.#",
        "#...###",
        "#...#..",
        "#####..",
    ],
    close: [
        "##...##",
        "###.###",
        ".#####.",
        "..###..",
        ".#####.",
        "###.###",
        "##...##",
    ],
    sound: [
        "..#..#.",
        ".##...#",
        "###.#.#",
        "###.#.#",
        "###.#.#",
        ".##...#",
        "..#..#.",
    ],
    mute: [
        "..#....",
        ".##....",
        "###.#.#",
        "###..#.",
        "###.#.#",
        ".##....",
        "..#....",
    ],
    stage: [
        "#######",
        "#.....#",
        "#.#...#",
        "#.##..#",
        "#.###.#",
        "#.....#",
        "#######",
    ],
} as const;

export type GlyphName = keyof typeof BITMAPS;

/** An SVG of the named bitmap, `size` CSS pixels square, filled with currentColor. */
export function glyph(name: GlyphName, size = 16): SVGSVGElement {
    const rows = BITMAPS[name];
    const n = rows.length;
    let d = "";
    rows.forEach((row, y) => {
        // One rect per horizontal run keeps the path short.
        let x = 0;
        while (x < row.length) {
            if (row[x] !== "#") { x++; continue; }
            let end = x;
            while (end < row.length && row[end] === "#") end++;
            d += `M${x} ${y}h${end - x}v1h-${end - x}z`;
            x = end;
        }
    });
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${n} ${n}`);
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("shape-rendering", "crispEdges");
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    path.setAttribute("fill", "currentColor");
    svg.append(path);
    return svg;
}
