// ARCHITECTURE.md rule 1: the core never touches the DOM, clocks or Math.random.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const files = (dir: string): string[] => readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith(".ts") ? [p] : [];
});

describe("core purity", () => {
    const banned = /\b(window|document|localStorage|indexedDB|Date\.now|new Date|Math\.random|setTimeout|setInterval|performance\.now|requestAnimationFrame)\b/;
    for (const f of files(join(__dirname, "../src/core"))) {
        it(f.split("src/")[1]!, () => {
            const src = readFileSync(f, "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
            expect(src.match(banned)?.[0] ?? null).toBeNull();
        });
    }
});
