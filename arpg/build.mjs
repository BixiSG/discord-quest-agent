// Bundles src/main.ts into one IIFE and fails on any non-ASCII byte: the
// launcher injects the file through PowerShell and CDP, which only round-trips
// ASCII safely. esbuild's default charset already escapes strings.
//
// Two outputs from one source:
//   dist/arpg.js         readable, for the harness, dev/play.html and debugging;
//   ../src/addons/arpg.js minified, the file that ships with the agent and is
//                         injected into every Discord start (Hollowmarch 1.7.0+:
//                         the launcher loads src/addons/*.js, the updater replaces src/).
// Both carry the ru/uk tables packed (base64 deflate-raw JSON, src/i18n/pack.ts):
// escaped Cyrillic costs six bytes a letter, which made them over half the build.
import { build, context } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes("--watch");
const SHIPPED = join(here, "../src/addons/arpg.js");
const LANGS = { ru: ["RU", "RU_GENDER"], uk: ["UK", "UK_GENDER"] };

/** Evaluates src/i18n/<lang>.ts in node and returns the packed module text that replaces it. */
async function packLang(lang) {
    const [table, gender] = LANGS[lang];
    const r = await build({ entryPoints: [join(here, `src/i18n/${lang}.ts`)], bundle: true, platform: "node", format: "esm", write: false, logLevel: "error" });
    const mod = await import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].contents).toString("base64")}`);
    const json = JSON.stringify({ t: mod[table], g: mod[gender] });
    const b64 = deflateRawSync(Buffer.from(json, "utf8"), { level: 9 }).toString("base64");
    return [
        `// Packed at build time from ${lang}.ts (build.mjs); see pack.ts.`,
        `import { lazyRecord, unpack } from "./pack";`,
        `let p;`,
        `const get = () => (p ??= unpack(${JSON.stringify(b64)}));`,
        `export const ${table} = lazyRecord(() => get().t);`,
        `export const ${gender} = lazyRecord(() => get().g);`,
        ``,
    ].join("\n");
}

const packLangs = {
    name: "pack-langs",
    setup(b) {
        b.onLoad({ filter: /[\\/]i18n[\\/](ru|uk)\.ts$/ }, async args => ({
            contents: await packLang(args.path.match(/(ru|uk)\.ts$/)[1]),
            loader: "js",
            resolveDir: dirname(args.path),
            watchFiles: [args.path],
        }));
    },
};

const opts = {
    entryPoints: ["src/main.ts"],
    bundle: true,
    format: "iife",
    target: "chrome120",
    outfile: "dist/arpg.js",
    charset: "ascii",
    legalComments: "none",
    plugins: [packLangs],
    banner: { js: "/* Hollowmarch - idle ARPG addon for Discord Quest Agent. Built file; edit arpg/src. */" },
    logLevel: "info",
};

function checkAscii(file) {
    const buf = readFileSync(file);
    const bad = buf.findIndex(b => b > 0x7e || (b < 0x20 && b !== 0x0a && b !== 0x0d && b !== 0x09));
    if (bad >= 0) { console.error(`${file}: non-ASCII byte at ${bad}`); process.exit(1); }
    console.log(`${relative(join(here, ".."), file)} ${(buf.length / 1024).toFixed(1)} KiB, ASCII ok`);
}

if (watch) {
    const ctx = await context(opts);
    await ctx.watch();
} else {
    await build(opts);
    checkAscii(join(here, opts.outfile));
    const min = await build({ ...opts, minify: true, write: false, logLevel: "warning" });
    writeFileSync(SHIPPED, min.outputFiles[0].contents);
    checkAscii(SHIPPED);
}
