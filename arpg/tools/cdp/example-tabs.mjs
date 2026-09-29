// Example scenario: imports a bot save (dev/out/hm-70h.txt, from tools/make-save.ts)
// into dev/play.html, stages stones/echoes/shards, shoots the Market, Forge,
// Log and Menu tabs, then walks the relight -> dawn -> perk dialogs.
export default async ({ nav, ev, shot, sleep, click }) => {
    const lang = process.env.LANGX ?? "en";
    const R = `document.querySelector('#hollowmarch-root').shadowRoot`;
    const g = `__hollowmarch.game`;
    await nav(`http://127.0.0.1:8778/arpg/dev/play.html?reset=1&lang=${lang}`);
    await sleep(2000);
    await click("button.btn.hot");
    await sleep(1500);
    const text = await ev(`fetch('/dev/out/hm-70h.txt').then(r => r.text())`);
    console.log("import:", await ev(`${g}.ctx.importSave(${JSON.stringify(text)})`));
    await sleep(1000);
    await ev(`${R}.querySelectorAll('.modal .btn').forEach(b => b.click())`);
    for (let i = 0; i < 3 && !(await ev(`${R}.querySelector('.top').classList.contains('nostage')`)); i++) await click(".ctl.sz");
    // A hero with stones, sockets, echoes and two shards.
    await ev(`(() => { const s = ${g}.ctx.state;
        s.stones = { "ruby:4": 2, "emerald:3": 4, "diamond:2": 1, "sapphire:1": 3, "onyx:0": 5 };
        const w = s.hero.equipment.weapon; w.sockets = 2; w.stones = ["ruby:3", null];
        s.echoes = ["bell", "warden", "saltchild", "drownedsun"]; s.pinnacleKills = { drownedsun: 3, glasschoir: 1 };
        s.dust = 250000; ${g}.ctx.rerender(); })()`);
    const tabs = [["market", "r5-market"], ["forge", "r5-forge"], ["log", "r5-log"], ["menu", "r5-menu"]];
    for (const [v, name] of tabs) {
        await click(`.nav button[data-v="${v}"]`);
        await sleep(700);
        if (v === "forge") { await ev(`(() => { ${g}.ctx.sel = { uid: ${g}.ctx.state.hero.equipment.weapon.uid }; ${g}.ctx.rerender(); })()`); await sleep(400); await ev(`${R}.querySelector('.anvilcard').scrollIntoView({ block: 'start' })`); }
        if (v === "log") { await ev(`[...${R}.querySelectorAll('.chip')].pop().click()`); await sleep(400); }
        if (v === "menu") { await ev(`${R}.querySelector('.dawncard').scrollIntoView({ block: 'center' })`); }
        await sleep(300);
        await shot(`${name}-${lang}`);
    }
    // All three shards: relight dialog, then the dawn story, then the perk pick.
    await ev(`(() => { ${g}.ctx.state.pinnacleKills.ashenking = 1; ${g}.ctx.rerender(); })()`);
    await sleep(400);
    await ev(`${R}.querySelector('.dawncard').scrollIntoView({ block: 'center' })`);
    await ev(`[...${R}.querySelectorAll('.dawncard .btn.hot')].pop().click()`);
    await sleep(500);
    await shot(`r5-relight-${lang}`);
    await ev(`[...${R}.querySelectorAll('.modal .btn.hot')].pop().click()`);
    await sleep(700);
    console.log(await ev(`(() => { const s = ${g}.ctx.state; return { dawn: s.hero.dawn, level: s.hero.level, stash: s.stash.length, stones: s.stones, echoes: s.echoes.length }; })()`));
    await shot(`r5-dawn-${lang}`);
    await ev(`${R}.querySelector('.modal .btn').click()`);
    await sleep(500);
    await shot(`r5-perks-${lang}`);
    const menuBadge = await ev(`${R}.querySelector('.nav button[data-v="menu"] .badge').textContent`);
    console.log("menu badge:", menuBadge, "keys:", await ev(`[...${R}.querySelectorAll('.nav .key')].map(k => k.textContent).join("")`));
};
