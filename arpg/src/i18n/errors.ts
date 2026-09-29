// The core's action results and save errors are English strings (tests read
// them, and exports stay readable). The UI shows them through tErr(), which
// maps each one onto an "err.*" string of the tables, names inside them
// (a support, a sigil, a currency) translated by id.

import { CURRENCIES, PINNACLES, SKILLS, SUPPORTS } from "../core/data";
import { EN } from "./en";
import { t, tn } from "./index";
import { currencyName, sigilName, skillName, supportName } from "./names";

const idByName = (table: Record<string, { id: string; name: string }>, name: string): string | undefined => Object.values(table).find(x => x.name === name)?.id;

/** Messages without numbers or names, by their English text. */
const FIXED: Record<string, string> = Object.fromEntries(Object.entries(EN).filter(([k, v]) => k.startsWith("err.") && !v.includes("{")).map(([k, v]) => [v, k]));

const PATTERNS: [RegExp, (m: RegExpMatchArray) => string][] = [
    [/^needs (\d+) ember dust$/, m => t("err.needsDust", { n: m[1]! })],
    [/^needs (\d+) ember dust \(or spare orbs\)$/, m => t("err.needsDustOrbs", { n: m[1]! })],
    [/^needs level (\d+)$/, m => t("err.needsLevel", { n: m[1]! })],
    [/^(\w+): needs level (\d+)$/, m => t("err.slotNeedsLevel", { slot: t(`slot.${m[1]}`), n: m[2]! })],
    [/^(.+) needs level (\d+)$/, m => { const id = idByName(SUPPORTS, m[1]!); return t("err.supportNeedsLevel", { name: id ? supportName(id) : m[1]!, n: m[2]! }); }],
    [/^(.+) can't be used with this weapon$/, m => { const id = idByName(SKILLS, m[1]!); return t("err.cantUseWith", { skill: id ? skillName(id) : m[1]! }); }],
    [/^(.+) can't be used with no weapon$/, m => { const id = idByName(SKILLS, m[1]!); return t("err.cantUseUnarmed", { skill: id ? skillName(id) : m[1]! }); }],
    [/^(.+) does not support (.+)$/, m => {
        const sup = idByName(SUPPORTS, m[1]!), sk = idByName(SKILLS, m[2]!);
        return t("err.noSupport", { support: sup ? supportName(sup) : m[1]!, skill: sk ? skillName(sk) : m[2]! });
    }],
    [/^needs (\d+) (.+)s$/, m => {
        const pin = Object.values(PINNACLES).find(p => p.sigilName === m[2]);
        return pin ? t("err.needsSigils", { n: m[1]!, sigil: sigilName(pin.id) }) : m[0];
    }],
    [/^no (.+) left$/, m => { const id = idByName(CURRENCIES, m[1]!); return t("err.noneLeft", { cur: id ? currencyName(id) : m[1]! }); }],
    [/^already at (\d+)% quality$/, m => t("err.maxQuality", { n: m[1]! })],
    [/^needs (\d+) Graft$/, m => t("err.needsGraft", { n: m[1]! })],
    [/^no room for more than (\d+) sockets?$/, m => tn("err.socketCap", Number(m[1]), { n: m[1]! })],
    [/^save is from a newer version \((\d+)\)$/, m => t("err.saveNewer", { n: m[1]! })],
    [/^no migration from version (\d+)$/, m => t("err.saveNoMigration", { n: m[1]! })],
    // The rest of the save checks name a part of the state: one message, the detail kept as is.
    [/^(bad|missing|unknown) .+$|^relic (data|with) .+$/, m => t("err.saveBroken", { what: m[0] })],
];

/** A message from the core in the current language (unknown ones are shown as they are). */
export function tErr(msg: string): string {
    const k = FIXED[msg];
    if (k) return t(k);
    for (const [re, f] of PATTERNS) {
        const m = msg.match(re);
        if (m) return f(m);
    }
    return msg;
}
