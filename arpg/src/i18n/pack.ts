// The shipped build replaces ru.ts and uk.ts with packed modules (build.mjs):
// the table as base64 deflate-raw JSON, decoded the first time a string of that
// language is read. Escaped Cyrillic cost six bytes a letter; packed, both
// tables together are about a sixth of what they were, and a player who never
// switches language never decodes them.

import { inflateRaw } from "./inflate";

/** base64 deflate-raw UTF-8 JSON back to the value. */
export function unpack(b64: string): unknown {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return JSON.parse(new TextDecoder().decode(inflateRaw(bytes)));
}

/** A read-only record that is built on first touch (lookups, `in`, Object.keys/entries). */
export function lazyRecord<T>(make: () => Record<string, T>): Record<string, T> {
    let rec: Record<string, T> | undefined;
    const get = (): Record<string, T> => (rec ??= make());
    return new Proxy({} as Record<string, T>, {
        get: (_, k) => (typeof k === "string" && Object.hasOwn(get(), k) ? get()[k] : undefined),
        has: (_, k) => typeof k === "string" && Object.hasOwn(get(), k),
        ownKeys: () => Reflect.ownKeys(get()),
        getOwnPropertyDescriptor: (_, k) => {
            if (typeof k !== "string" || !Object.hasOwn(get(), k)) return undefined;
            return { value: get()[k], writable: false, enumerable: true, configurable: true };
        },
        set: () => false,
        defineProperty: () => false,
        deleteProperty: () => false,
    });
}
