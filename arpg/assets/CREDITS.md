# Art credits

Hollowmarch's code, data, story, UI glyphs, pixel font, HUD and sound are
original to this project (MIT). The character, monster, effect and background
art comes from the packs below, all CC0 or public domain: no attribution is
required, but they deserve it. `tools/pack-assets.mjs` cuts the frames the
game uses out of them (listed in `manifest.json`), adds a 1px black outline and
packs them into `src/ui/gfx/atlas.gen.ts`. The raw packs are not committed:
`node tools/fetch-assets.mjs` downloads them into `assets/.cache/`.

| Pack | Author | License (as stated in the pack) | Source |
|---|---|---|---|
| Gothicvania Church | Luis Zuno (ansimuz) | "Public domain and free to use on whatever you want" | https://opengameart.org/content/gothicvania-church-pack |
| Gothicvania Swamp | Luis Zuno (ansimuz) | "Public domain and free to use on whatever you want" | https://opengameart.org/content/gotthicvania-swamp |
| Gothicvania Patreon Collection | Luis Zuno (ansimuz) | "Public domain and free to use on whatever you want" | https://opengameart.org/content/gothicvania-patreons-collection |
| Gothicvania Cemetery | Luis Zuno (ansimuz) | "Public domain and free to use on whatever you want" | https://opengameart.org/content/gothicvania-cemetery-pack |
| Parallax Forest | Luis Zuno (ansimuz) | CC0 | https://opengameart.org/content/forest-background |
| Parallax Mountain at Dusk | Luis Zuno (ansimuz) | CC0 | https://opengameart.org/content/mountain-at-dusk-background |
| Rocky desert landscape | Emcee Flesher | CC0 | https://opengameart.org/content/rocky-desert-landscape-layered-looping |
| Dungeon Crawl 32x32 tiles | Dungeon Crawl Stone Soup tile artists (maintained by Chris Hamons) | CC0 | https://opengameart.org/content/dungeon-crawl-32x32-tiles |
| Gothicvania Town | Luis Zuno (ansimuz) | "Public domain and free to use on whatever you want" (artwork) | https://opengameart.org/content/gothicvania-town |
| Gothicvania Magic Pack 9 | Luis Zuno (ansimuz) | CC0 | https://opengameart.org/content/gothicvania-magic-pack-9 |

The Gothicvania packs also ship music by Pascal Belisle under a
credit-required license; none of it is used here.

Thank you, Luis Zuno: https://www.patreon.com/ansimuz
