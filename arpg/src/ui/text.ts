// Human text for modifiers (passives, implicits, keystones).

import type { Mod } from "../core/types";

const NAMES: Record<string, string> = {
    life: "maximum life", mana: "maximum mana", energyShield: "maximum energy shield", lifeRegen: "life regenerated per second",
    lifeRegenPct: "% of life regenerated per second", manaRegen: "mana regenerated per second", armour: "armour", evasion: "evasion",
    block: "% chance to block", str: "Might", dex: "Grace", int: "Wit", accuracy: "accuracy", damage: "damage", critChance: "critical chance",
    critMulti: "% critical multiplier", attackSpeed: "attack speed", castSpeed: "cast speed", area: "area of effect", pierce: "projectile pierce",
    leech: "% of damage leeched as life", flaskHeal: "flask healing", flaskCharges: "flask charges gained", moveSpeed: "movement speed",
    itemRarity: "rarity of items found", itemQuantity: "quantity of items found", xpGain: "experience gained", manaCost: "mana cost",
    dmgTaken: "damage taken", lifeOnKill: "life gained per kill", baseCrit: "% base critical chance",
};
const TYPES: Record<string, string> = { phys: "physical", fire: "fire", cold: "cold", lightning: "lightning", chaos: "chaos" };

function statName(stat: string): string {
    const [head, t] = stat.split(".");
    if (t && head && TYPES[t]) {
        switch (head) {
            case "res": return `% ${TYPES[t]} resistance`;
            case "maxRes": return `% maximum ${TYPES[t]} resistance`;
            case "pen": return `% ${TYPES[t]} penetration`;
            case "convert": return `% of physical damage converted to ${TYPES[t]}`;
            case "addMin": return `minimum added ${TYPES[t]} damage`;
            case "addMax": return `maximum added ${TYPES[t]} damage`;
        }
    }
    return NAMES[stat] ?? stat;
}

export function modText(m: Mod): string {
    const tags = m.tags?.length ? ` (${m.tags.map(t => TYPES[t] ?? t).join(", ")})` : "";
    const name = statName(m.stat);
    if (m.kind === "inc") return `${Math.abs(m.value)}% ${m.value >= 0 ? "increased" : "reduced"} ${name}${tags}`;
    if (m.kind === "more") return `${Math.abs(m.value)}% ${m.value >= 0 ? "more" : "less"} ${name}${tags}`;
    const sign = m.value >= 0 ? "+" : "";
    return name.startsWith("%") ? `${sign}${m.value}${name}${tags}` : `${sign}${m.value} ${name}${tags}`;
}
