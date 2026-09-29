// Save storage: IndexedDB (verified in Discord's Electron with a large quota),
// falling back to memory when it is unavailable. Two keys: "main" and
// "backup" (the previous good save, restored if "main" fails to load).

import type { SaveEnvelope } from "../core/save";

const DB = "hollowmarch", STORE = "saves";

export interface SaveStore {
    get(key: string): Promise<unknown>;
    put(key: string, value: SaveEnvelope): Promise<void>;
    del(key: string): Promise<void>;
    kind: "indexeddb" | "memory";
}

function req<T>(r: IDBRequest<T>): Promise<T> {
    return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}

export async function openStore(): Promise<SaveStore> {
    try {
        if (typeof indexedDB === "undefined") throw new Error("no indexedDB");
        const open = indexedDB.open(DB, 1);
        open.onupgradeneeded = () => { if (!open.result.objectStoreNames.contains(STORE)) open.result.createObjectStore(STORE); };
        const db = await req(open);
        const tx = (mode: IDBTransactionMode) => db.transaction(STORE, mode).objectStore(STORE);
        return {
            kind: "indexeddb",
            get: key => req(tx("readonly").get(key)),
            put: async (key, value) => { await req(tx("readwrite").put(value, key)); },
            del: async key => { await req(tx("readwrite").delete(key)); },
        };
    } catch (e) {
        console.warn("[Hollowmarch] IndexedDB unavailable, progress will not persist:", e);
        return memoryStore();
    }
}

export function memoryStore(): SaveStore {
    const m = new Map<string, unknown>();
    return {
        kind: "memory",
        get: async key => structuredClone(m.get(key)),
        put: async (key, value) => { m.set(key, structuredClone(value)); },
        del: async key => { m.delete(key); },
    };
}
