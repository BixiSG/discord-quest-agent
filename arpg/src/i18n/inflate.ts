// Raw DEFLATE (RFC 1951) decoder, after Joergen Ibsen's tinf: stored, fixed and
// dynamic Huffman blocks. The shipped build carries the ru/uk tables deflated
// (see build.mjs and pack.ts); the browser's DecompressionStream is async only,
// and the tables are read synchronously.

const LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
const CLORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

/** A canonical Huffman code: how many codes of each length, and the symbols in code order. */
interface Tree { counts: Uint16Array; symbols: Uint16Array }

function tree(lengths: ArrayLike<number>, from: number, n: number): Tree {
    const counts = new Uint16Array(16), symbols = new Uint16Array(n), offs = new Uint16Array(16);
    for (let i = 0; i < n; i++) counts[lengths[from + i]!]!++;
    counts[0] = 0;
    for (let i = 0, sum = 0; i < 16; i++) { offs[i] = sum; sum += counts[i]!; }
    for (let i = 0; i < n; i++) { const l = lengths[from + i]!; if (l) symbols[offs[l]!++] = i; }
    return { counts, symbols };
}

let fixed: [Tree, Tree] | undefined;
function fixedTrees(): [Tree, Tree] {
    if (fixed) return fixed;
    const l = new Uint8Array(288);
    l.fill(8, 0, 144); l.fill(9, 144, 256); l.fill(7, 256, 280); l.fill(8, 280, 288);
    return (fixed = [tree(l, 0, 288), tree(new Uint8Array(30).fill(5), 0, 30)]);
}

/** Inflates raw DEFLATE data (no zlib or gzip header). Throws on data it can't read. */
export function inflateRaw(src: Uint8Array): Uint8Array {
    let pos = 0, tag = 0, bits = 0;
    let out = new Uint8Array(Math.max(1024, src.length * 4)), len = 0;
    const bit = (): number => {
        if (!bits) { if (pos >= src.length) throw new Error("inflate: unexpected end of data"); tag = src[pos++]!; bits = 8; }
        const b = tag & 1; tag >>>= 1; bits--; return b;
    };
    const read = (n: number, base = 0): number => { let v = 0; for (let i = 0; i < n; i++) v |= bit() << i; return v + base; };
    const sym = (t: Tree): number => {
        let sum = 0, cur = 0, l = 0;
        do {
            cur = 2 * cur + bit();
            if (++l > 15) throw new Error("inflate: bad code");
            sum += t.counts[l]!; cur -= t.counts[l]!;
        } while (cur >= 0);
        return t.symbols[sum + cur]!;
    };
    const room = (n: number): void => {
        if (len + n <= out.length) return;
        const next = new Uint8Array(Math.max(out.length * 2, len + n));
        next.set(out.subarray(0, len)); out = next;
    };
    let last = 0;
    do {
        last = bit();
        const type = read(2);
        if (type === 0) {
            bits = 0;
            if (pos + 4 > src.length) throw new Error("inflate: unexpected end of data");
            const n = src[pos]! | (src[pos + 1]! << 8);
            if ((n ^ 0xffff) !== (src[pos + 2]! | (src[pos + 3]! << 8))) throw new Error("inflate: bad stored block");
            pos += 4;
            if (pos + n > src.length) throw new Error("inflate: unexpected end of data");
            room(n); out.set(src.subarray(pos, pos + n), len); len += n; pos += n;
            continue;
        }
        let lt: Tree, dt: Tree;
        if (type === 1) [lt, dt] = fixedTrees();
        else if (type === 2) {
            const hlit = read(5, 257), hdist = read(5, 1), hclen = read(4, 4);
            const cl = new Uint8Array(19);
            for (let i = 0; i < hclen; i++) cl[CLORDER[i]!] = read(3);
            const ct = tree(cl, 0, 19);
            const lens = new Uint8Array(hlit + hdist);
            for (let i = 0; i < hlit + hdist;) {
                const s = sym(ct);
                let v = 0, n = 1;
                if (s < 16) v = s;
                else if (s === 16) { if (!i) throw new Error("inflate: bad lengths"); v = lens[i - 1]!; n = read(2, 3); }
                else if (s === 17) n = read(3, 3);
                else n = read(7, 11);
                if (i + n > hlit + hdist) throw new Error("inflate: bad lengths");
                lens.fill(v, i, i + n); i += n;
            }
            lt = tree(lens, 0, hlit); dt = tree(lens, hlit, hdist);
        } else throw new Error("inflate: bad block type");
        for (;;) {
            let s = sym(lt);
            if (s < 256) { room(1); out[len++] = s; continue; }
            if (s === 256) break;
            s -= 257;
            if (s >= 29) throw new Error("inflate: bad length code");
            const n = read(LEXT[s]!, LBASE[s]!);
            const d = sym(dt);
            if (d >= 30) throw new Error("inflate: bad distance code");
            const dist = read(DEXT[d]!, DBASE[d]!);
            if (dist > len) throw new Error("inflate: distance too far back");
            room(n);
            for (let i = 0; i < n; i++, len++) out[len] = out[len - dist]!;
        }
    } while (!last);
    return out.slice(0, len);
}
