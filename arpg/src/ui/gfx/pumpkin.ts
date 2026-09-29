// Hollow Night's jack-o'-lantern: a small pixel face carried over the heads of
// lantern-touched monsters and worn by the Pumpkin Wisp. Drawn in code like the
// UI glyphs; the candle inside flickers.
// Legend: k outline, o rind, d rib shadow, y candlelight, g stem.

const ART = [
    "....kkk....",
    "....kgk....",
    ".kkkkgkkkk.",
    "koodoooodok",
    "kooyodoyook",
    "koyyydyyyok",
    "kodoooooodk",
    "koyyyyyyyok",
    "kodoyoyodok",
    ".kkkkkkkkk.",
];
export const PUMPKIN_W = 11, PUMPKIN_H = ART.length;
const COLOR: Record<string, string> = { k: "#111111", o: "#ff7a1a", d: "#c4480c", g: "#3f7d2a" };

/** A jack-o'-lantern centred on `x`, bottom row at `y`, `scale` pixels per dot. */
export function drawPumpkin(g: CanvasRenderingContext2D, x: number, y: number, now: number, scale = 1): void {
    const light = Math.sin(now / 90) + Math.sin(now / 37) > 0.6 ? "#ffb000" : "#ffd84a";
    const left = Math.round(x - (PUMPKIN_W * scale) / 2), top = Math.round(y - PUMPKIN_H * scale);
    ART.forEach((row, r) => {
        for (let c = 0; c < row.length; c++) {
            const ch = row[c]!;
            if (ch === ".") continue;
            g.fillStyle = ch === "y" ? light : COLOR[ch]!;
            g.fillRect(left + c * scale, top + r * scale, scale, scale);
        }
    });
}
