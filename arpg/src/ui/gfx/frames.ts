// Pixel-art panel frames for CSS border-image: a 12x12 map drawn at 2x, so a
// slice of 8 image pixels is 4 art pixels: a stepped corner, a 2px ink ring
// and a 1px bevel. Generated per theme at startup (no image files), exposed
// to the stylesheet as --fr-<kind> custom properties.

// k ink, h bevel light, s bevel dark, f fill, . clear
const MAP = [
    "..kkkkkkkk..",
    ".kkkkkkkkkk.",
    "kkhhhhhhhhkk",
    "kkhffffffskk",
    "kkhffffffskk",
    "kkhffffffskk",
    "kkhffffffskk",
    "kkhffffffskk",
    "kkhffffffskk",
    "kksssssssskk",
    ".kkkkkkkkkk.",
    "..kkkkkkkk..",
];

interface Paint { k: string; h: string; s: string; f: string }

function draw(p: Paint): string {
    const c = document.createElement("canvas");
    c.width = 24; c.height = 24;
    const g = c.getContext("2d")!;
    MAP.forEach((row, y) => [...row].forEach((ch, x) => {
        const col = (p as unknown as Record<string, string>)[ch];
        if (!col) return;
        g.fillStyle = col; g.fillRect(x * 2, y * 2, 2, 2);
    }));
    return `url("${c.toDataURL("image/png")}")`;
}

export const RARITY_RING: Record<string, [string, string]> = {
    plain: ["#b9b2a6", "#6f685d"], enchanted: ["#8cc4ff", "#2f6fb8"], rare: ["#ffe27a", "#b88a00"], relic: ["#ffb055", "#b8560c"],
};

/** Custom properties for one theme: panels, recessed slots, plaques, buttons, rarity slots. */
export function frameVars(dark: boolean): Record<string, string> {
    const ink = dark ? "#050403" : "#1a1410";
    const card = dark ? "#30271f" : "#fffaf0";
    const paper2 = dark ? "#2d241c" : "#ecd9b0";
    const vars: Record<string, string> = {
        "--fr-card": draw({ k: ink, h: dark ? "#43372c" : "#ffffff", s: dark ? "#241c16" : "#e6d6b3", f: card }),
        "--fr-sunk": draw({ k: ink, h: dark ? "#120e0b" : "#cdb88f", s: dark ? "#3a2f25" : "#fff6e0", f: dark ? "#1b1511" : "#efe1c1" }),
        "--fr-plaque": draw({ k: ink, h: "#3a2f25", s: "#000000", f: "#1a1410" }),
        "--fr-gold": draw({ k: ink, h: "#ffe89a", s: "#c48a00", f: "#ffc233" }),
        "--fr-ember": draw({ k: ink, h: "#ffa184", s: "#b8361c", f: "#ff5a36" }),
        "--fr-alt": draw({ k: ink, h: dark ? "#4a3d31" : "#ffffff", s: dark ? "#1e1712" : "#d9c79f", f: paper2 }),
        "--fr-teal": draw({ k: ink, h: "#7fe3d6", s: "#0f7a6e", f: "#19b3a3" }),
    };
    for (const [r, [h, s]] of Object.entries(RARITY_RING)) vars[`--fr-${r}`] = draw({ k: ink, h, s, f: dark ? "#1b1511" : "#efe1c1" });
    vars["--fr-empty"] = draw({ k: ink, h: dark ? "#120e0b" : "#cdb88f", s: dark ? "#2a211a" : "#fff6e0", f: dark ? "#16110d" : "#e8d7b2" });
    return vars;
}
