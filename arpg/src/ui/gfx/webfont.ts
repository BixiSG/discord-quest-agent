// Registers the game's pixel font ("Hollow Pixel", tools/make-font.ts) with the
// document. FontFace takes the bytes directly: nothing is fetched, so Discord's
// content security policy has nothing to block. Fonts added to document.fonts
// are visible inside shadow roots. Until it has loaded (or if it fails) the
// stylesheet falls back to Bahnschrift / Segoe UI.

import { PIXEL_FONT } from "./font.gen";

export const PIXEL_FAMILY = "Hollow Pixel";
let loading: Promise<boolean> | null = null;

export function loadPixelFont(): Promise<boolean> {
    return (loading ??= (async () => {
        try {
            let have = false;
            document.fonts.forEach(f => { if (f.family.replace(/"/g, "") === PIXEL_FAMILY) have = true; }); // an earlier injection
            if (have) return true;
            const bytes = Uint8Array.from(atob(PIXEL_FONT), c => c.charCodeAt(0));
            // One face for every weight, so bold text never gets a smeared synthetic bold.
            const face = new FontFace(PIXEL_FAMILY, bytes.buffer, { weight: "100 900" });
            await face.load();
            document.fonts.add(face);
            return true;
        } catch (e) {
            console.warn("[Hollowmarch] pixel font unavailable, using system fonts:", e);
            return false;
        }
    })());
}
