// Tiny DOM helpers. Text always goes through textContent (no innerHTML with
// data), and listeners through addEventListener (Discord's CSP blocks inline
// handlers).

type Child = Node | string | number | null | undefined | false;
export interface Props {
    class?: string;
    text?: string | number;
    title?: string;
    style?: string;
    attrs?: Record<string, string>;
    on?: Partial<{ [K in keyof HTMLElementEventMap]: (e: HTMLElementEventMap[K]) => void }>;
}

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props | null = null, ...children: Child[]): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag);
    if (props) {
        if (props.class) el.className = props.class;
        if (props.text !== undefined) el.textContent = String(props.text);
        if (props.title) el.title = props.title;
        if (props.style) el.setAttribute("style", props.style);
        if (props.attrs) for (const [k, v] of Object.entries(props.attrs)) el.setAttribute(k, v);
        if (props.on) for (const [k, fn] of Object.entries(props.on)) el.addEventListener(k, fn as EventListener);
    }
    for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(typeof c === "object" ? c : String(c));
    return el;
}

export const clear = (el: Element) => { while (el.firstChild) el.removeChild(el.firstChild); };

export function fmt(n: number): string {
    if (!isFinite(n)) return "-";
    const a = Math.abs(n);
    if (a >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (a >= 1e6) return (n / 1e6).toFixed(2) + "M";
    if (a >= 1e4) return (n / 1e3).toFixed(1) + "k";
    if (a >= 100 || Number.isInteger(n)) return Math.round(n).toString();
    if (a >= 10) return n.toFixed(1);
    return n.toFixed(2).replace(/\.?0+$/, "") || "0";
}

export function fmtDuration(ms: number): string {
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400), hh = Math.floor((s % 86400) / 3600), mm = Math.floor((s % 3600) / 60);
    if (d) return `${d}d ${hh}h`;
    if (hh) return `${hh}h ${mm}m`;
    if (mm) return `${mm}m`;
    return `${s}s`;
}

export const pct = (x: number, digits = 0) => (x * 100).toFixed(digits) + "%";
