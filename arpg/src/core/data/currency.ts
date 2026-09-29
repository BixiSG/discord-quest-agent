// Crafting currency (GDD table). Effects live in crafting.ts, keyed by id.

export interface CurrencyDef {
    id: string;
    name: string;
    blurb: string;
    /** Ember dust at the forge. */
    cost: number;
    /** Relative drop weight. */
    drop: number;
    color: string;
}

const list: CurrencyDef[] = [
    { id: "kindling", name: "Kindling", blurb: "Turns a plain item enchanted.", cost: 5, drop: 1000, color: "#ff9a2e" },
    { id: "reshaper", name: "Reshaper", blurb: "Rerolls the affixes of an enchanted item.", cost: 8, drop: 900, color: "#5aa9ff" },
    { id: "graft", name: "Graft", blurb: "Adds an affix to an enchanted item with room for one.", cost: 12, drop: 500, color: "#3fbf5f" },
    { id: "crownseal", name: "Crown Seal", blurb: "Raises an enchanted item to rare and adds an affix.", cost: 40, drop: 200, color: "#ffd23f" },
    { id: "forgeheart", name: "Forgeheart", blurb: "Turns a plain item rare.", cost: 60, drop: 150, color: "#ff5a36" },
    { id: "tempest", name: "Tempest Shard", blurb: "Rerolls every affix of a rare item.", cost: 50, drop: 160, color: "#7fd1ff" },
    { id: "starfall", name: "Starfall", blurb: "Adds an affix to a rare item with room for one.", cost: 180, drop: 25, color: "#fff27a" },
    { id: "salt", name: "Salt of Undoing", blurb: "Strips every affix; the item becomes plain.", cost: 10, drop: 400, color: "#e9e4d4" },
    { id: "unmaker", name: "Unmaker", blurb: "Removes one random affix.", cost: 70, drop: 90, color: "#8b5cf6" },
    { id: "temper", name: "Temper Oil", blurb: "Rerolls the numbers, keeps the affixes.", cost: 30, drop: 250, color: "#c9a26b" },
];

export const CURRENCIES: Record<string, CurrencyDef> = Object.fromEntries(list.map(c => [c.id, c]));
export const CURRENCY_ORDER = list.map(c => c.id);
