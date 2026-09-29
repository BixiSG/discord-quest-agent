// Strings in three languages. English (en.ts) is the source: UI strings are
// written there, content strings (zones, items, monsters...) are generated
// from the data tables so the data stays the one place its English lives.
// ru.ts and uk.ts cover every key. A key missing in a language falls back to
// English (in tests, with setStrict(true), it throws instead).
//
// Pure: no DOM. The language is module state, set by the UI (the hub's
// language in Discord, ?lang= or the browser's standalone).
//
// Conventions in the tables:
//   {name}  placeholder, filled from params ({0}, {1} for affix rolls);
//   a|b|c   plural forms: en one|other, ru and uk one|few|many (tn);
//   m|f|n|p gendered forms of an adjective, picked by a noun's gender (form).

import { EN } from "./en";
import { RU, RU_GENDER } from "./ru";
import { UK, UK_GENDER } from "./uk";

export type Lang = "en" | "ru" | "uk";
export type Params = Record<string, string | number>;
/** Grammatical gender of a noun: masculine, feminine, neuter, plural-only. */
export type Gender = "m" | "f" | "n" | "p";

export const LANGS: readonly Lang[] = ["en", "ru", "uk"];
export const TABLES: Readonly<Record<Lang, Readonly<Record<string, string>>>> = { en: EN, ru: RU, uk: UK };
const GENDERS: Record<Lang, Readonly<Record<string, Gender>>> = { en: {}, ru: RU_GENDER, uk: UK_GENDER };

let current: Lang = "en";
let strict = false;

/** A language code ("ru-RU", "uk", "UA") reduced to one we have; anything else is English. */
export function normLang(code: unknown): Lang {
    const c = String(code ?? "").toLowerCase().split(/[-_]/)[0];
    return c === "ru" ? "ru" : c === "uk" || c === "ua" ? "uk" : "en";
}

/** Sets the language; returns true when it changed. */
export function setLang(code: unknown): boolean {
    const l = normLang(code);
    if (l === current) return false;
    current = l;
    return true;
}

export const lang = (): Lang => current;

/** Tests: a key missing in ru or uk throws instead of falling back to English. */
export function setStrict(on: boolean): void { strict = on; }

/** The raw table string for a key: the language's own, else English, else the key itself. */
export function raw(key: string, l: Lang = current): string {
    const s = TABLES[l][key];
    if (s !== undefined) return s;
    if (l !== "en" && strict) throw new Error(`missing ${l} string: ${key}`);
    return EN[key] ?? key;
}

export const has = (key: string, l: Lang = current): boolean => TABLES[l][key] !== undefined;

/** Fills {name} placeholders; unknown ones stay as they are. */
export function fill(s: string, params?: Params): string {
    if (!params) return s;
    return s.replace(/\{(\w+)\}/g, (m, k: string) => (params[k] !== undefined ? String(params[k]) : m));
}

export const tr = (l: Lang, key: string, params?: Params): string => fill(raw(key, l), params);
export const t = (key: string, params?: Params): string => tr(current, key, params);

/** Which plural form a count takes: en one|other; ru and uk one|few|many (fractions take "few"). */
export function pluralIndex(l: Lang, n: number): number {
    if (l === "en") return Math.abs(n) === 1 ? 0 : 1;
    if (!Number.isInteger(n)) return 1;
    const a = Math.abs(n), d = a % 10, dd = a % 100;
    if (d === 1 && dd !== 11) return 0;
    if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return 1;
    return 2;
}

/** A count-aware string: picks the plural form for `n`; {n} is the count unless params give one. */
export function trn(l: Lang, key: string, n: number, params?: Params): string {
    const forms = raw(key, l).split("|");
    return fill(forms[Math.min(pluralIndex(l, n), forms.length - 1)]!, { n, ...params });
}
export const tn = (key: string, n: number, params?: Params): string => trn(current, key, n, params);

/** The gendered form of an adjective ("m|f|n|p"); a string without forms is returned as is. */
export function form(s: string, g: Gender): string {
    if (!s.includes("|")) return s;
    const forms = s.split("|");
    return forms["mfnp".indexOf(g)] ?? forms[0]!;
}

/** The gender of an item base's name in a language (m when unknown or in English). */
export const genderOf = (base: string, l: Lang = current): Gender => GENDERS[l][base] ?? "m";

/** First letter up (Russian and Ukrainian lines built from lower-case parts). */
export const capFirst = (s: string): string => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
/** First letter down, unless the word looks like an acronym. */
export const lowFirst = (s: string): string => (s.length > 1 && s[1] === s[1]!.toLowerCase() ? s[0]!.toLowerCase() + s.slice(1) : s);
