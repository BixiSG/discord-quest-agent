// 12x12 pixel icons for items, drawn once into small canvases and cached.
// Legend: . clear, k outline, a metal, b wood/leather, c accent, w shine.

const P: Record<string, string> = { k: "#111111", a: "#c9ced6", b: "#8a5a2b", c: "#ff5a36", w: "#ffffff", g: "#ffc233", t: "#19b3a3", v: "#8b5cf6" };

const ICONS: Record<string, string[]> = {
    sword: ["..........kk", ".........kwk", "........kwak", ".......kwak.", "......kwak..", ".....kwak...", "..k.kwak....", "..kkkak.....", "...kgk......", "..kbkkk.....", ".kbk..k.....", ".kk........."],
    axe: ["....kkkk....", "...kaaaak...", "..kwaaaak...", "..kwaakbk...", "...kkkbk....", ".....kbk....", "....kbk.....", "....kbk.....", "...kbk......", "...kbk......", "..kbk.......", "..kk........"],
    mace: [".....kkk....", "....kakak...", "...kawaaak..", "...kaaaaak..", "....kakak...", ".....kbk....", ".....kbk....", ".....kbk....", ".....kbk....", ".....kbk....", ".....kgk....", ".....kkk...."],
    dagger: ["............", "........kk..", ".......kwk..", "......kwak..", ".....kwak...", "....kwak....", "..k.kak.....", "..kkgk......", "...kbk......", "..kbk.......", "..kk........", "............"],
    greatsword: [".........kkk", "........kwak", ".......kwak.", "......kwak..", ".....kwak...", "....kwak....", "...kwak.....", ".kkkak......", ".kgggk......", "..kbk.......", ".kbk........", ".kk........."],
    greataxe: ["...kkkkk....", "..kaaaaak...", ".kwaaaaakk..", ".kwaaakbk...", "..kaaakbk...", "...kkkbk....", ".....kbk....", "....kbk.....", "....kbk.....", "...kbk......", "...kbk......", "...kk......."],
    staff: ["....kkk.....", "...kttk.....", "...ktwtk....", "....kttk....", "....kbk.....", "....kbk.....", "...kbk......", "...kbk......", "...kbk......", "..kbk.......", "..kbk.......", "..kk........"],
    bow: ["...kk.......", "...kbk......", "....kbk....k", "....kbk...kw", ".....kbk.kw.", ".....kbkkw..", ".....kbkw...", ".....kbk.w..", "....kbk...w.", "....kbk....w", "...kbk......", "...kk......."],
    wand: ["........kkk.", ".......kcwk.", ".......kcck.", "......kbkk..", ".....kbk....", "....kbk.....", "...kbk......", "..kbk.......", ".kbk........", ".kk.........", "............", "............"],
    shield: ["kkkkkkkkkkk.", "kaaaaaaaaak.", "kaccaaaccak.", "kacccccccak.", "kaacccccaak.", "kaaacccaaak.", "kaaaacaaaak.", ".kaaaaaaak..", "..kaaaaak...", "...kaaak....", "....kkk.....", "............"],
    buckler: ["............", "...kkkkk....", "..kbbbbbk...", ".kbbgggbbk..", ".kbgbbbgbk..", ".kbgbwbgbk..", ".kbgbbbgbk..", ".kbbgggbbk..", "..kbbbbbk...", "...kkkkk....", "............", "............"],
    focus: ["............", "....kkkk....", "...kvvvvk...", "..kvwvvvvk..", "..kvvvvvvk..", "..kvvvvvvk..", "...kvvvvk...", "....kkkk....", "...kgggk....", "..kgggggk...", "..kkkkkkk...", "............"],
    quiver: [".....k.k.k..", ".....kwkwk..", "....kbbbbk..", "....kbbbbk..", "...kbbcbk...", "...kbbcbk...", "..kbbcbk....", "..kbbbbk....", ".kbbbbk.....", ".kbbbk......", ".kkkk.......", "............"],
    helmet: ["............", "...kkkkkk...", "..kaaaaaak..", ".kawaaaaaak.", ".kaaaaaaaak.", ".kakkkkkkak.", ".kak....kak.", ".kak....kak.", ".kkk....kkk.", "............", "............", "............"],
    body: ["..kk....kk..", ".kaak..kaak.", "kaaaakkaaaak", "kaaaaaaaaaak", ".kkaaaaaakk.", "..kaaccaak..", "..kaaccaak..", "..kaaaaaak..", "..kaaaaaak..", "..kkkkkkkk..", "............", "............"],
    gloves: ["............", "..k.k.k.....", ".kakakak....", ".kakakakk...", ".kaaaaakak..", ".kaaaaaaak..", ".kaaaaaak...", ".kaaaaak....", ".kbbbbbk....", ".kkkkkkk....", "............", "............"],
    boots: ["............", "...kkkk.....", "...kaak.....", "...kaak.....", "...kaak.....", "...kaak.....", "...kaakkkk..", "...kaaaaaak.", "...kaaaaaak.", "...kkkkkkkk.", "............", "............"],
    belt: ["............", "............", "............", "kkkkkkkkkkkk", "kbbbbkkkbbbk", "kbbbbkgkbbbk", "kbbbbkkkbbbk", "kkkkkkkkkkkk", "............", "............", "............", "............"],
    amulet: ["..kkkkkkkk..", ".k........k.", ".k........k.", "..k......k..", "...k....k...", "....kkkk....", "...kggggk...", "..kgcccgk...", "..kgcwcgk...", "..kgcccgk...", "...kgggk....", "....kkk....."],
    ring: ["............", "....kkkk....", "...kcwcck...", "....kkkk....", "...kgggk....", "..kg...gk...", "..kg...gk...", "..kg...gk...", "...kgggk....", "....kkk.....", "............", "............"],
};
// Plate/leather/silk/brigand bodies share the slot art; tint by kind.
const KIND_TINT: Record<string, string> = { plate: "#c9ced6", leather: "#b07b45", silk: "#b9a4ff", brigand: "#8fa3a0" };

const cache = new Map<string, HTMLCanvasElement>();

export function iconFor(kind: string, slot: string): HTMLCanvasElement {
    const key = kind + ":" + slot;
    let c = cache.get(key);
    if (!c) {
        c = document.createElement("canvas");
        c.width = 12; c.height = 12;
        const g = c.getContext("2d")!;
        const art = ICONS[kind] ?? ICONS[slot === "ring1" || slot === "ring2" ? "ring" : slot] ?? ICONS.ring!;
        const tint = KIND_TINT[kind];
        art.forEach((row, y) => [...row].forEach((ch, x) => {
            if (ch === ".") return;
            g.fillStyle = ch === "a" && tint ? tint : P[ch] ?? "#f0f";
            g.fillRect(x, y, 1, 1);
        }));
        cache.set(key, c);
    }
    const out = document.createElement("canvas");
    out.width = 12; out.height = 12;
    out.getContext("2d")!.drawImage(c, 0, 0);
    return out;
}
