// Shared content and state types. Content tables are plain objects keyed by id.

export const DAMAGE_TYPES = ["phys", "fire", "cold", "lightning", "chaos"] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];
export const ELEMENTS = ["fire", "cold", "lightning"] as const;
export type Element = (typeof ELEMENTS)[number];

export type ModKind = "flat" | "inc" | "more";

/**
 * Stat ids. Damage-type specific stats use a suffix: "addMin.fire",
 * "res.cold", "pen.lightning", "convert.fire" (share of phys converted).
 * "local.*" stats only exist on items and modify that item's own base.
 */
export type StatId =
    | "life" | "mana" | "energyShield" | "lifeRegen" | "lifeRegenPct" | "manaRegen"
    | "armour" | "evasion" | "block" | "str" | "dex" | "int" | "accuracy"
    | "damage" | "critChance" | "critMulti" | "attackSpeed" | "castSpeed"
    | "area" | "pierce" | "leech" | "flaskHeal" | "flaskCharges" | "moveSpeed"
    | "itemRarity" | "itemQuantity" | "xpGain" | "manaCost" | "dmgTaken"
    | "lifeOnKill" | "baseCrit" | "skillEffect"
    | `addMin.${DamageType}` | `addMax.${DamageType}` | `res.${DamageType}`
    | `maxRes.${DamageType}` | `pen.${DamageType}` | `convert.${DamageType}`
    | "local.addMin.phys" | "local.addMax.phys" | `local.addMin.${Element}` | `local.addMax.${Element}`
    | "local.physInc" | "local.attackSpeed" | "local.critChance"
    | "local.armour" | "local.evasion" | "local.energyShield" | "local.defInc";

export interface Mod {
    stat: StatId;
    kind: ModKind;
    value: number;
    /** Applies only when every tag is in the context (skill tags + damage type). */
    tags?: string[];
    /** Where it came from, for the character sheet breakdown. */
    src?: string;
}

export type Slot = "weapon" | "offhand" | "helmet" | "body" | "gloves" | "boots" | "belt" | "amulet" | "ring1" | "ring2";
export const SLOTS: readonly Slot[] = ["weapon", "offhand", "helmet", "body", "gloves", "boots", "belt", "amulet", "ring1", "ring2"];

export type Rarity = "plain" | "enchanted" | "rare" | "relic";

export interface Item {
    uid: number;
    base: string;
    ilvl: number;
    rarity: Rarity;
    /** Rare items get a generated two-word name; relics use their table name. */
    name?: string;
    affixes: AffixRoll[];
    /** Relic (unique) id. */
    relic?: string;
    /** Relic rolls, one per relic mod with a range. */
    relicRolls?: number[];
    /** Touched by crafting currency (salvages as plain). */
    crafted?: boolean;
}

export interface AffixRoll {
    id: string;
    tier: number;
    rolls: number[];
}
