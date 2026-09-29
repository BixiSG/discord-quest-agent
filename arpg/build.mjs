// Bundles src/main.ts into one IIFE at dist/arpg.js and fails on any non-ASCII
// byte: the launcher injects the file through PowerShell and CDP, which only
// round-trips ASCII safely. esbuild's default charset already escapes strings.
import { build } from "esbuild";
import { readFileSync } from "node:fs";

const watch = process.argv.includes("--watch");
const opts = {
    entryPoints: ["src/main.ts"],
    bundle: true,
    format: "iife",
    target: "chrome120",
    outfile: "dist/arpg.js",
    charset: "ascii",
    legalComments: "none",
    minify: process.argv.includes("--minify"),
    banner: { js: "/* Hollowmarch - idle ARPG addon for Discord Quest Agent. Built file; edit arpg/src. */" },
    logLevel: "info",
};
if (watch) {
    const { context } = await import("esbuild");
    const ctx = await context(opts);
    await ctx.watch();
} else {
    await build(opts);
    const buf = readFileSync(opts.outfile);
    const bad = buf.findIndex(b => b > 0x7e || (b < 0x20 && b !== 0x0a && b !== 0x0d && b !== 0x09));
    if (bad >= 0) { console.error(`dist/arpg.js: non-ASCII byte at ${bad}`); process.exit(1); }
    console.log(`dist/arpg.js ${(buf.length / 1024).toFixed(1)} KiB, ASCII ok`);
}
