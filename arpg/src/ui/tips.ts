// The game's own tooltips. Anything in the game with a title (or data-tip)
// gets a pixel-framed tooltip instead of the browser's: on first hover the
// title moves to data-tip (so the native one never shows) and to
// aria-description (so screen readers keep it). Keyboard focus shows it too.
// Views keep writing plain `title`; nothing else needs to know.

/**
 * Hooks tooltips onto everything under `scope`; they are drawn inside `layer` (a positioned box).
 * `busy()` is true while one is up or about to be: a view shouldn't be rebuilt under it.
 */
export function installTips(scope: HTMLElement, layer: HTMLElement): { busy(): boolean } {
    let tip: HTMLDivElement | null = null;
    let owner: HTMLElement | null = null;
    let timer = 0;
    const hide = () => { clearTimeout(timer); tip?.remove(); tip = null; owner = null; };
    const find = (t: EventTarget | null) => (t instanceof Element ? t.closest<HTMLElement>("[title], [data-tip]") : null);
    const adopt = (el: HTMLElement): string => {
        const t = el.getAttribute("title");
        if (t !== null) {
            el.removeAttribute("title");
            if (t) { el.dataset.tip = t; if (!el.hasAttribute("aria-label")) el.setAttribute("aria-description", t); }
        }
        return el.dataset.tip ?? "";
    };
    const show = (el: HTMLElement, delay: number) => {
        const text = adopt(el);
        if (owner === el) return;
        hide();
        if (!text) return;
        owner = el;
        timer = window.setTimeout(() => {
            if (owner !== el || !el.isConnected) return;
            tip = document.createElement("div");
            tip.className = "htip";
            tip.setAttribute("role", "tooltip");
            tip.textContent = el.dataset.tip ?? text;
            layer.append(tip);
            // Under the element, centred on it, kept inside the layer; above it when there's no room below.
            const lr = layer.getBoundingClientRect(), er = el.getBoundingClientRect();
            const w = tip.offsetWidth, h = tip.offsetHeight;
            const x = Math.max(4, Math.min(er.left - lr.left + er.width / 2 - w / 2, lr.width - w - 4));
            let y = er.bottom - lr.top + 6;
            if (y + h > lr.height - 4) y = er.top - lr.top - h - 6;
            tip.style.left = Math.round(x) + "px";
            tip.style.top = Math.round(Math.max(4, y)) + "px";
        }, delay);
    };
    scope.addEventListener("pointerover", e => {
        const el = find(e.target);
        if (el && scope.contains(el)) show(el, 380);
        else hide();
    });
    scope.addEventListener("pointerout", e => { if (owner && !owner.contains(e.relatedTarget as Node | null)) hide(); });
    scope.addEventListener("pointerdown", hide);
    scope.addEventListener("wheel", hide, { passive: true });
    scope.addEventListener("focusin", e => {
        const t = e.target as HTMLElement;
        const el = find(t);
        if (el && t.matches(":focus-visible")) show(el, 200);
    });
    scope.addEventListener("focusout", hide);
    return { busy: () => !!owner && owner.isConnected };
}
