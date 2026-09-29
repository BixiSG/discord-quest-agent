// Dev helper: first frames of the given sprite specs side by side on a grey
// board (2x), to eyeball facing and scale before editing assets/manifest.json.
//   node tools/contact-sheet.mjs out.png "<file>|<frameW>|<frameH>" ...
import { readFileSync, writeFileSync } from "node:fs";
import pngjs from "pngjs";

const { PNG } = pngjs;
const [out, ...specs] = process.argv.slice(2);
const items = specs.map(s => {
    const [file, fw, fh] = s.split("|");
    const img = PNG.sync.read(readFileSync(file));
    return { img, w: Number(fw) || img.width, h: Number(fh) || img.height };
});
const S = 2, gap = 8;
const W = items.reduce((a, it) => a + it.w * S + gap, gap), H = Math.max(...items.map(it => it.h)) * S + gap * 2;
const board = new PNG({ width: W, height: H });
for (let i = 0; i < board.data.length; i += 4) { board.data[i] = 90; board.data[i + 1] = 90; board.data[i + 2] = 100; board.data[i + 3] = 255; }
let x0 = gap;
for (const it of items) {
    for (let y = 0; y < it.h * S; y++) for (let x = 0; x < it.w * S; x++) {
        const sx = Math.floor(x / S), sy = Math.floor(y / S);
        const si = (sy * it.img.width + sx) * 4, di = ((gap + y) * W + x0 + x) * 4;
        if (it.img.data[si + 3] < 24) continue;
        board.data.set(it.img.data.subarray(si, si + 3), di); board.data[di + 3] = 255;
    }
    x0 += it.w * S + gap;
}
writeFileSync(out, PNG.sync.write(board));
console.log(`${W}x${H}`);
