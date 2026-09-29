// Downloads the CC0 / public-domain art packs listed in assets/CREDITS.md into
// assets/.cache/ (git-ignored) and unpacks them, so `npm run assets` can
// rebuild the sprite atlas. Needs `tar` that reads zip files (Windows 10+,
// macOS) or `unzip` (Linux).
//   node tools/fetch-assets.mjs

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cache = join(root, "assets/.cache");
const BASE = "https://opengameart.org/sites/default/files/";
const ZIPS = {
    church: "gothicvania%20church%20files.zip",
    swamp: "gothicvania_swamp_files.zip",
    patreon: "%20gothicvania%20patreon%20collection.zip",
    cemetery: "gothicvania-cemetery-files_1.zip",
    forest: "parallax_forest_pack.zip",
    mountain: "parallax_mountain_pack.zip",
    crawl: "crawl-tiles%20Oct-5-2010.zip",
};
const FILES = { desert: ["rocky-far-mountains_0.png", "rocky-nowater-far_0.png", "rocky-nowater-mid_0.png", "rocky-nowater-close_0.png"] };

async function get(url, out) {
    if (existsSync(out)) return;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, Buffer.from(await res.arrayBuffer()));
    console.log(`fetched ${out.slice(root.length + 1)}`);
}
function unzip(zip, dir) {
    mkdirSync(dir, { recursive: true });
    try { execFileSync("tar", ["-xf", zip, "-C", dir], { stdio: "ignore" }); }
    catch { execFileSync("unzip", ["-oq", zip, "-d", dir], { stdio: "ignore" }); }
}

for (const [name, file] of Object.entries(ZIPS)) {
    const zip = join(cache, `${name}.zip`);
    await get(BASE + file, zip);
    if (!existsSync(join(cache, name))) unzip(zip, join(cache, name));
}
for (const [dir, list] of Object.entries(FILES)) for (const f of list) await get(BASE + f, join(cache, dir, f));
console.log("assets ready in assets/.cache");
