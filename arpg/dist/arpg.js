/* Hollowmarch - idle ARPG addon for Discord Quest Agent. Built file; edit arpg/src. */
"use strict";
(() => {
  // src/core/stats.ts
  var StatBag = class _StatBag {
    by = /* @__PURE__ */ new Map();
    constructor(mods = []) {
      for (const m2 of mods) this.add(m2);
    }
    add(m2) {
      let list2 = this.by.get(m2.stat);
      if (!list2) this.by.set(m2.stat, list2 = []);
      list2.push(m2);
    }
    addAll(mods) {
      for (const m2 of mods) this.add(m2);
    }
    /** Every modifier for a stat (for breakdowns). */
    mods(stat) {
      return this.by.get(stat) ?? [];
    }
    static applies(m2, ctx) {
      if (!m2.tags || m2.tags.length === 0) return true;
      if (!ctx) return false;
      for (const t of m2.tags) if (!ctx.has(t)) return false;
      return true;
    }
    /** Sum of flat or inc values. */
    sum(stat, kind, ctx) {
      let s = 0;
      for (const m2 of this.by.get(stat) ?? []) if (m2.kind === kind && _StatBag.applies(m2, ctx)) s += m2.value;
      return s;
    }
    /** Product of (1 + more/100). */
    more(stat, ctx) {
      let p = 1;
      for (const m2 of this.by.get(stat) ?? []) if (m2.kind === "more" && _StatBag.applies(m2, ctx)) p *= 1 + m2.value / 100;
      return p;
    }
    flat(stat, ctx) {
      return this.sum(stat, "flat", ctx);
    }
    inc(stat, ctx) {
      return this.sum(stat, "inc", ctx);
    }
    /** Increase multiplier (1 + inc/100), floored at zero. */
    incMult(stat, ctx) {
      return Math.max(0, 1 + this.inc(stat, ctx) / 100);
    }
    /** Full formula. */
    calc(stat, base = 0, ctx) {
      return (base + this.flat(stat, ctx)) * this.incMult(stat, ctx) * this.more(stat, ctx);
    }
  };
  var tagSet = (...groups) => {
    const s = /* @__PURE__ */ new Set();
    for (const g of groups) if (g) for (const t of g) s.add(t);
    return s;
  };

  // src/core/data/scaling.ts
  function monsterDamage(level) {
    const l = level - 1;
    return 5 * Math.pow(1.06, l) * (1 + 0.02 * l);
  }
  function monsterDefence(level) {
    const l = level - 1;
    return 12 + 9 * l * Math.pow(1.03, l);
  }
  function spellScale(level) {
    const l = level - 1;
    return Math.pow(1.075, l) * (1 + 0.025 * l);
  }
  function heroBaseLife(level, classLife) {
    return classLife + 12 * (level - 1);
  }
  function heroBaseMana(level) {
    return 40 + 6 * (level - 1);
  }
  function heroBaseAccuracy(level) {
    return 20 + 10 * (level - 1);
  }

  // src/core/data/classes.ts
  var CLASSES = {
    vanguard: {
      id: "vanguard",
      name: "Vanguard",
      blurb: "A drowned soldier who still remembers the shield wall. Heavy blows, heavy armour.",
      str: 24,
      dex: 12,
      int: 10,
      life: 60,
      startSkill: "crescent",
      startWeapon: "sword1",
      startNode: "start_vanguard",
      color: "#e2543b"
    }
  };

  // src/core/data/skills.ts
  var MELEE = ["sword", "axe", "mace", "greatsword", "greataxe", "dagger", "staff"];
  var SKILLS = {
    crescent: {
      id: "crescent",
      name: "Crescent Swing",
      kind: "attack",
      shape: "area",
      tags: ["attack", "melee", "area"],
      effectiveness: 100,
      targets: 3,
      manaCost: 4,
      level: 1,
      weapons: MELEE,
      fx: "arc",
      blurb: "A wide swing that hits up to three enemies in front of you."
    },
    sunder: {
      id: "sunder",
      name: "Sunder",
      kind: "attack",
      shape: "single",
      tags: ["attack", "melee", "strike"],
      effectiveness: 185,
      speedMult: 0.9,
      manaCost: 6,
      level: 4,
      weapons: MELEE,
      fx: "stab",
      blurb: "One crushing blow at a single enemy. Slow, heavy, good against bosses.",
      mods: [{ stat: "critChance", kind: "inc", value: 25, src: "Sunder" }]
    },
    hatchet: {
      id: "hatchet",
      name: "Hatchet Toss",
      kind: "attack",
      shape: "projectile",
      tags: ["attack", "projectile"],
      effectiveness: 90,
      targets: 1,
      manaCost: 5,
      level: 8,
      weapons: ["sword", "axe", "mace", "dagger"],
      fx: "bolt",
      blurb: "Throws a spinning copy of your weapon that passes through one enemy."
    },
    quake: {
      id: "quake",
      name: "Quake Stomp",
      kind: "attack",
      shape: "area",
      tags: ["attack", "melee", "area", "slam"],
      effectiveness: 150,
      speedMult: 0.72,
      targets: 5,
      manaCost: 9,
      level: 12,
      weapons: MELEE,
      fx: "slam",
      blurb: "Stamps the ground so hard the whole pack feels it."
    },
    cinderwake: {
      id: "cinderwake",
      name: "Cinderwake",
      kind: "attack",
      shape: "area",
      tags: ["attack", "melee", "area", "fire"],
      effectiveness: 115,
      targets: 3,
      manaCost: 8,
      level: 18,
      weapons: MELEE,
      fx: "arc",
      blurb: "A burning arc. Half of its physical damage becomes fire.",
      mods: [{ stat: "convert.fire", kind: "flat", value: 50, src: "Cinderwake" }]
    }
  };

  // src/core/data/supports.ts
  var m = (stat, kind, value, tags) => tags ? { stat, kind, value, tags } : { stat, kind, value };
  var SUPPORTS = {
    heavyhand: {
      id: "heavyhand",
      name: "Heavy Hand",
      requires: ["attack"],
      level: 1,
      manaMult: 1.3,
      mods: [m("damage", "more", 35), m("attackSpeed", "more", -10)],
      blurb: "35% more damage, 10% less attack speed."
    },
    quicken: {
      id: "quicken",
      name: "Quicken",
      requires: [],
      level: 1,
      manaMult: 1.2,
      mods: [m("attackSpeed", "more", 22), m("castSpeed", "more", 22), m("damage", "more", -8)],
      blurb: "22% more attack and cast speed, 8% less damage."
    },
    widesweep: {
      id: "widesweep",
      name: "Wide Sweep",
      requires: ["area"],
      level: 4,
      manaMult: 1.3,
      mods: [m("area", "inc", 50), m("damage", "more", -10)],
      blurb: "50% increased area of effect, 10% less damage."
    },
    bloodthirst: {
      id: "bloodthirst",
      name: "Bloodthirst",
      requires: ["attack"],
      level: 6,
      manaMult: 1.2,
      mods: [m("leech", "flat", 3), m("damage", "more", 5)],
      blurb: "3% of damage leeched as life, 5% more damage."
    },
    passthrough: {
      id: "passthrough",
      name: "Passthrough",
      requires: ["projectile"],
      level: 8,
      manaMult: 1.3,
      targets: 2,
      mods: [m("damage", "more", -15)],
      blurb: "Pierces two more enemies, 15% less damage."
    },
    emberedge: {
      id: "emberedge",
      name: "Ember Edge",
      requires: ["attack"],
      level: 10,
      manaMult: 1.2,
      mods: [m("convert.fire", "flat", 50), m("damage", "more", 20, ["fire"])],
      blurb: "Converts 50% of physical damage to fire; 20% more fire damage."
    },
    keeneye: {
      id: "keeneye",
      name: "Keen Eye",
      requires: [],
      level: 14,
      manaMult: 1.2,
      mods: [m("critChance", "inc", 90), m("critMulti", "flat", 25)],
      blurb: "90% increased critical chance, +25% critical multiplier."
    },
    ruthless: {
      id: "ruthless",
      name: "Ruthless",
      requires: ["melee"],
      level: 20,
      manaMult: 1.4,
      mods: [m("damage", "more", 30, ["melee"]), m("damage", "more", 20, ["phys"])],
      blurb: "30% more melee damage, 20% more physical damage."
    },
    fracture: {
      id: "fracture",
      name: "Fracture",
      requires: ["attack"],
      level: 26,
      manaMult: 1.3,
      mods: [m("pen.fire", "flat", 15), m("pen.cold", "flat", 15), m("pen.lightning", "flat", 15), m("damage", "more", 10, ["elemental"])],
      blurb: "Hits ignore 15% of elemental resistances; 10% more elemental damage."
    }
  };
  var SUPPORT_SLOT_LEVELS = [1, 1, 8, 18, 32];

  // src/core/data/bases.ts
  var TIER_LEVELS = [1, 8, 16, 26, 38, 50, 62, 74];
  var weaponAvg = (lvl) => (4 + 0.9 * lvl) * Math.pow(1.018, lvl);
  var defence = (lvl) => (8 + 2.6 * lvl) * Math.pow(1.02, lvl);
  var WEAPONS = [
    {
      kind: "sword",
      hands: 1,
      aps: 1.5,
      crit: 5,
      dmg: 1,
      spread: 0.45,
      names: ["Rusted Blade", "Ferry Sabre", "Tidesteel Blade", "Reedcutter", "Glasscut Sabre", "Lantern Blade", "Sunforged Blade", "Emberheart Edge"],
      implicit: () => [{ stat: "accuracy", kind: "flat", value: 40 }]
    },
    {
      kind: "axe",
      hands: 1,
      aps: 1.35,
      crit: 5,
      dmg: 1.12,
      spread: 0.6,
      names: ["Driftwood Hatchet", "Bearded Axe", "Netmender Axe", "Keelsplitter", "Saltcrust Axe", "Dunebiter", "Sunset Cleaver", "Ashen Reaver"]
    },
    {
      kind: "mace",
      hands: 1,
      aps: 1.25,
      crit: 5,
      dmg: 1.2,
      spread: 0.3,
      names: ["Knotted Club", "Anchor Mace", "Barnacle Maul", "Bellwright Mace", "Glass Morningstar", "Pilgrim Flail", "Dawnhammer", "Cinder Sceptre"]
    },
    {
      kind: "dagger",
      hands: 1,
      aps: 1.7,
      crit: 7,
      dmg: 0.8,
      spread: 0.7,
      names: ["Gutting Knife", "Scaler", "Eelbone Dirk", "Mistkiss Dagger", "Glass Stiletto", "Oath Knife", "Sunshard Kris", "Last Light"],
      implicit: () => [{ stat: "critChance", kind: "inc", value: 30 }]
    },
    {
      kind: "greatsword",
      hands: 2,
      aps: 1.25,
      crit: 5,
      dmg: 2,
      spread: 0.45,
      names: ["Bent Zweihander", "Harbour Greatsword", "Tidebreaker", "Seawall Blade", "Glass Colossus", "Oathkeeper", "Sunfall Greatsword", "Worldember"],
      implicit: () => [{ stat: "accuracy", kind: "flat", value: 80 }]
    },
    {
      kind: "greataxe",
      hands: 2,
      aps: 1.12,
      crit: 5,
      dmg: 2.3,
      spread: 0.6,
      names: ["Woodsplitter", "Whaler Axe", "Leviathan Axe", "Wreckbreaker", "Dune Executioner", "Pyre Axe", "Horizon Cleaver", "Endember Axe"]
    },
    {
      kind: "staff",
      hands: 2,
      aps: 1.2,
      crit: 6,
      dmg: 1.7,
      spread: 0.4,
      names: ["Crooked Staff", "Tidecaller Staff", "Coral Staff", "Lighthouse Staff", "Mirage Staff", "Eclipse Staff", "Solar Staff", "Ember Crozier"],
      implicit: (lvl) => [{ stat: "damage", kind: "inc", value: 10 + Math.round(lvl / 3), tags: ["spell"] }]
    },
    {
      kind: "bow",
      hands: 2,
      aps: 1.3,
      crit: 6,
      dmg: 1.55,
      spread: 0.55,
      ranged: true,
      names: ["Fishing Bow", "Gull Bow", "Reed Longbow", "Cliff Bow", "Glasswing Bow", "Storm Bow", "Dawnstring", "Emberflight"]
    },
    {
      kind: "wand",
      hands: 1,
      aps: 1.4,
      crit: 7,
      dmg: 0.75,
      spread: 0.5,
      ranged: true,
      names: ["Driftwood Wand", "Candle Wand", "Pearl Wand", "Lantern Wand", "Prism Wand", "Omen Wand", "Corona Wand", "Ember Wand"],
      implicit: (lvl) => [{ stat: "damage", kind: "inc", value: 8 + Math.round(lvl / 4), tags: ["spell"] }]
    }
  ];
  var PLATE = ["Dented", "Harbour", "Barnacled", "Seawall", "Glass", "Pilgrim", "Dawnforged", "Ember"];
  var LEATHER = ["Patched", "Sealskin", "Oiled", "Cliffrunner", "Sandstrider", "Duskstalker", "Horizon", "Ashwalker"];
  var SILK = ["Frayed", "Chapel", "Tidewoven", "Lantern", "Mirage", "Eclipse", "Solar", "Kindled"];
  var ARMOURS = [];
  var armourSet = (slot, mult, noun) => {
    ARMOURS.push({ kind: "plate", slot, mult, ar: 1.4, ev: 0, es: 0, names: PLATE.map((p) => `${p} ${noun[0]}`) });
    ARMOURS.push({ kind: "leather", slot, mult, ar: 0, ev: 1.4, es: 0, names: LEATHER.map((p) => `${p} ${noun[1]}`) });
    ARMOURS.push({ kind: "silk", slot, mult, ar: 0, ev: 0, es: 0.3, names: SILK.map((p) => `${p} ${noun[2]}`) });
    ARMOURS.push({ kind: "brigand", slot, mult, ar: 0.8, ev: 0.8, es: 0, names: PLATE.map((_, i) => `${LEATHER[i]} ${noun[3]}`) });
  };
  var NOUNS = {
    body: ["Cuirass", "Jerkin", "Robe", "Brigandine"],
    helmet: ["Helm", "Hood", "Circlet", "Sallet"],
    gloves: ["Gauntlets", "Gloves", "Wraps", "Bracers"],
    boots: ["Greaves", "Boots", "Slippers", "Treads"]
  };
  armourSet("body", 1, NOUNS.body);
  armourSet("helmet", 0.55, NOUNS.helmet);
  armourSet("gloves", 0.42, NOUNS.gloves);
  armourSet("boots", 0.42, NOUNS.boots);
  ARMOURS.push({ kind: "shield", slot: "offhand", mult: 0.8, ar: 1.4, ev: 0, es: 0, block: 22, names: PLATE.map((p) => `${p} Tower Shield`) });
  ARMOURS.push({ kind: "buckler", slot: "offhand", mult: 0.6, ar: 0, ev: 1.4, es: 0, block: 16, names: LEATHER.map((p) => `${p} Buckler`) });
  ARMOURS.push({ kind: "focus", slot: "offhand", mult: 0.6, ar: 0, ev: 0, es: 0.3, names: SILK.map((p) => `${p} Focus`) });
  var r = (x) => Math.max(1, Math.round(x));
  function build() {
    const out = {};
    const add = (b) => {
      if (out[b.id]) throw new Error("duplicate base " + b.id);
      out[b.id] = b;
    };
    for (const w of WEAPONS) {
      TIER_LEVELS.forEach((lvl, i) => {
        const avg = weaponAvg(lvl) * w.dmg;
        const b = {
          id: `${w.kind}${i + 1}`,
          name: w.names[i],
          slot: "weapon",
          kind: w.kind,
          level: lvl,
          weapon: { phys: [r(avg * (1 - w.spread / 2)), r(avg * (1 + w.spread / 2))], aps: w.aps, crit: w.crit, hands: w.hands, ranged: !!w.ranged }
        };
        const imp = w.implicit?.(lvl);
        if (imp) b.implicit = imp;
        add(b);
      });
    }
    for (const a of ARMOURS) {
      TIER_LEVELS.forEach((lvl, i) => {
        const d = defence(lvl) * a.mult;
        const def = { armour: a.ar ? r(d * a.ar) : 0, evasion: a.ev ? r(d * a.ev) : 0, energyShield: a.es ? r(d * a.es) : 0 };
        if (a.block) def.block = a.block;
        add({ id: `${a.kind}_${a.slot}${i + 1}`, name: a.names[i], slot: a.slot, kind: a.kind, level: lvl, defence: def });
      });
    }
    const QUIVERS = ["Frayed Quiver", "Gull Quiver", "Reed Quiver", "Cliff Quiver", "Glass Quiver", "Storm Quiver", "Dawn Quiver", "Ember Quiver"];
    TIER_LEVELS.forEach((lvl, i) => add({
      id: `quiver${i + 1}`,
      name: QUIVERS[i],
      slot: "offhand",
      kind: "quiver",
      level: lvl,
      implicit: [{ stat: "damage", kind: "inc", value: 10 + 2 * i, tags: ["projectile"] }]
    }));
    const JEWELS = [
      ["amulet_might", "amulet", "Iron Torc", 1, [{ stat: "str", kind: "flat", value: 20 }]],
      ["amulet_grace", "amulet", "Shell Pendant", 1, [{ stat: "dex", kind: "flat", value: 20 }]],
      ["amulet_wit", "amulet", "Pearl Locket", 1, [{ stat: "int", kind: "flat", value: 20 }]],
      ["amulet_life", "amulet", "Coral Charm", 12, [{ stat: "lifeRegen", kind: "flat", value: 4 }]],
      ["amulet_ember", "amulet", "Ember Reliquary", 40, [{ stat: "damage", kind: "inc", value: 12 }]],
      ["ring_iron", "ring", "Iron Band", 1, [{ stat: "life", kind: "flat", value: 15 }]],
      ["ring_tide", "ring", "Tide Ring", 5, [{ stat: "res.cold", kind: "flat", value: 15 }]],
      ["ring_ember", "ring", "Coal Ring", 5, [{ stat: "res.fire", kind: "flat", value: 15 }]],
      ["ring_storm", "ring", "Storm Ring", 5, [{ stat: "res.lightning", kind: "flat", value: 15 }]],
      ["ring_mana", "ring", "Moonstone Ring", 10, [{ stat: "mana", kind: "flat", value: 25 }]],
      ["ring_glass", "ring", "Glass Ring", 30, [{ stat: "addMin.phys", kind: "flat", value: 2, tags: ["attack"] }, { stat: "addMax.phys", kind: "flat", value: 5, tags: ["attack"] }]],
      ["ring_void", "ring", "Hollow Ring", 45, [{ stat: "res.chaos", kind: "flat", value: 13 }]],
      ["belt_rope", "belt", "Rope Belt", 1, [{ stat: "life", kind: "flat", value: 20 }]],
      ["belt_leather", "belt", "Tanner Belt", 10, [{ stat: "armour", kind: "flat", value: 60 }]],
      ["belt_chain", "belt", "Chain Belt", 25, [{ stat: "energyShield", kind: "flat", value: 20 }]],
      ["belt_plate", "belt", "Plated Sash", 45, [{ stat: "flaskHeal", kind: "inc", value: 25 }]]
    ];
    for (const [id, slot, name, level, implicit] of JEWELS) add({ id, name, slot, kind: slot, level, implicit });
    return out;
  }
  var BASES = build();

  // src/core/data/affixes.ts
  var AFFIX_ILVLS = [1, 11, 22, 34, 46, 58, 70, 82];
  function ladder(first, last, opts = {}) {
    const curve = opts.curve ?? 1.3, ratio = opts.ratio ?? 0.8;
    const ilvls = AFFIX_ILVLS.slice(opts.from ?? 0, (opts.from ?? 0) + (opts.count ?? AFFIX_ILVLS.length));
    const n = ilvls.length;
    return ilvls.map((ilvl, i) => {
      const f = n === 1 ? 1 : Math.pow(i / (n - 1), curve);
      return {
        ilvl,
        ranges: first.map((a, k) => {
          const hi = Math.max(1, Math.round(a + (last[k] - a) * f));
          return [Math.max(1, Math.round(hi * ratio)), hi];
        })
      };
    });
  }
  var A = (id, type, label, group, domains, weight, mods, text, first, last, opts) => ({ id, type, label, group, domains, weight, mods, text, tiers: ladder(first, last, opts) });
  var DEF = ["body", "helmet", "gloves", "boots", "shield", "buckler", "focus"];
  var JEWEL = ["amulet", "ring", "belt"];
  var CASTER = ["caster"];
  var list = [
    // ---- prefixes: life and defences
    A("life", "prefix", "Hale", "life", [...DEF, ...JEWEL], 1e3, [{ stat: "life", kind: "flat" }], "+{0} to maximum life", [12], [150]),
    A("mana", "prefix", "Lucid", "mana", ["amulet", "ring", "helmet", "gloves", "caster", "focus"], 700, [{ stat: "mana", kind: "flat" }], "+{0} to maximum mana", [10], [90]),
    A("es", "prefix", "Shimmering", "es", ["es", "amulet", "belt"], 800, [{ stat: "energyShield", kind: "flat" }], "+{0} to maximum energy shield", [6], [90]),
    A("ar_local", "prefix", "Tempered", "defFlat", ["ar"], 900, [{ stat: "local.armour", kind: "flat" }], "+{0} to armour", [10], [260]),
    A("ev_local", "prefix", "Slippery", "defFlat", ["ev"], 900, [{ stat: "local.evasion", kind: "flat" }], "+{0} to evasion", [10], [260]),
    A("es_local", "prefix", "Glowing", "defFlat", ["es"], 900, [{ stat: "local.energyShield", kind: "flat" }], "+{0} to energy shield (local)", [4], [60]),
    A("def_inc", "prefix", "Reinforced", "defInc", DEF, 900, [{ stat: "local.defInc", kind: "inc" }], "{0}% increased defences", [12], [100], { curve: 1 }),
    A("armour_belt", "prefix", "Studded", "armourFlat", ["belt"], 600, [{ stat: "armour", kind: "flat" }], "+{0} to armour", [15], [320]),
    // ---- prefixes: weapon damage (local)
    A("phys_local", "prefix", "Honed", "physInc", ["weapon"], 1e3, [{ stat: "local.physInc", kind: "inc" }], "{0}% increased physical damage", [20], [170], { curve: 1 }),
    A(
      "phys_add_local",
      "prefix",
      "Jagged",
      "physAdd",
      ["weapon"],
      1e3,
      [{ stat: "local.addMin.phys", kind: "flat" }, { stat: "local.addMax.phys", kind: "flat" }],
      "Adds {0} to {1} physical damage",
      [1, 3],
      [28, 50]
    ),
    A(
      "fire_add_local",
      "prefix",
      "Smouldering",
      "fireAdd",
      ["weapon"],
      600,
      [{ stat: "local.addMin.fire", kind: "flat" }, { stat: "local.addMax.fire", kind: "flat" }],
      "Adds {0} to {1} fire damage",
      [2, 4],
      [40, 70]
    ),
    A(
      "cold_add_local",
      "prefix",
      "Rimed",
      "coldAdd",
      ["weapon"],
      600,
      [{ stat: "local.addMin.cold", kind: "flat" }, { stat: "local.addMax.cold", kind: "flat" }],
      "Adds {0} to {1} cold damage",
      [2, 4],
      [36, 64]
    ),
    A(
      "light_add_local",
      "prefix",
      "Crackling",
      "lightAdd",
      ["weapon"],
      600,
      [{ stat: "local.addMin.lightning", kind: "flat" }, { stat: "local.addMax.lightning", kind: "flat" }],
      "Adds {0} to {1} lightning damage",
      [1, 6],
      [8, 110]
    ),
    A("spell_inc", "prefix", "Chanting", "spellInc", [...CASTER, "focus", "amulet"], 900, [{ stat: "damage", kind: "inc", tags: ["spell"] }], "{0}% increased spell damage", [10], [90], { curve: 1 }),
    A(
      "spell_fire",
      "prefix",
      "Kindled",
      "spellAdd",
      CASTER,
      500,
      [{ stat: "addMin.fire", kind: "flat", tags: ["spell"] }, { stat: "addMax.fire", kind: "flat", tags: ["spell"] }],
      "Adds {0} to {1} fire damage to spells",
      [1, 3],
      [22, 40]
    ),
    A(
      "spell_light",
      "prefix",
      "Stormborn",
      "spellAdd",
      CASTER,
      500,
      [{ stat: "addMin.lightning", kind: "flat", tags: ["spell"] }, { stat: "addMax.lightning", kind: "flat", tags: ["spell"] }],
      "Adds {0} to {1} lightning damage to spells",
      [1, 4],
      [5, 60]
    ),
    // ---- prefixes: global damage on jewellery/gloves/quivers
    A(
      "atk_phys",
      "prefix",
      "Barbed",
      "atkPhys",
      ["ring", "gloves", "quiver", "amulet"],
      600,
      [{ stat: "addMin.phys", kind: "flat", tags: ["attack"] }, { stat: "addMax.phys", kind: "flat", tags: ["attack"] }],
      "Adds {0} to {1} physical damage to attacks",
      [1, 2],
      [9, 16],
      { count: 6 }
    ),
    A(
      "atk_fire",
      "prefix",
      "Scorching",
      "atkFire",
      ["ring", "gloves", "quiver", "amulet"],
      500,
      [{ stat: "addMin.fire", kind: "flat", tags: ["attack"] }, { stat: "addMax.fire", kind: "flat", tags: ["attack"] }],
      "Adds {0} to {1} fire damage to attacks",
      [1, 3],
      [14, 24],
      { count: 6 }
    ),
    A("ele_inc", "prefix", "Prismatic", "eleInc", ["amulet", "ring", "focus", "quiver"], 600, [{ stat: "damage", kind: "inc", tags: ["elemental"] }], "{0}% increased elemental damage", [6], [36], { curve: 1 }),
    A("phys_inc", "prefix", "Brutal", "physGlobal", ["amulet", "belt"], 500, [{ stat: "damage", kind: "inc", tags: ["phys"] }], "{0}% increased physical damage", [6], [34], { curve: 1 }),
    // ---- suffixes: attributes, resistances
    A("str", "suffix", "of the Ox", "str", [...DEF, ...JEWEL, "weapon"], 800, [{ stat: "str", kind: "flat" }], "+{0} to Might", [5], [55], { curve: 1 }),
    A("dex", "suffix", "of the Heron", "dex", [...DEF, ...JEWEL, "weapon", "quiver"], 800, [{ stat: "dex", kind: "flat" }], "+{0} to Grace", [5], [55], { curve: 1 }),
    A("int", "suffix", "of the Owl", "int", [...DEF, ...JEWEL, "weapon"], 800, [{ stat: "int", kind: "flat" }], "+{0} to Wit", [5], [55], { curve: 1 }),
    A("res_fire", "suffix", "of the Hearth", "resFire", [...DEF, ...JEWEL, "quiver"], 1e3, [{ stat: "res.fire", kind: "flat" }], "+{0}% fire resistance", [8], [46], { curve: 1 }),
    A("res_cold", "suffix", "of the Tide", "resCold", [...DEF, ...JEWEL, "quiver"], 1e3, [{ stat: "res.cold", kind: "flat" }], "+{0}% cold resistance", [8], [46], { curve: 1 }),
    A("res_light", "suffix", "of the Squall", "resLight", [...DEF, ...JEWEL, "quiver"], 1e3, [{ stat: "res.lightning", kind: "flat" }], "+{0}% lightning resistance", [8], [46], { curve: 1 }),
    A("res_chaos", "suffix", "of the Hollow", "resChaos", [...DEF, ...JEWEL], 300, [{ stat: "res.chaos", kind: "flat" }], "+{0}% chaos resistance", [5], [35], { curve: 1, from: 2, count: 6 }),
    // ---- suffixes: offence
    A("aspd_local", "suffix", "of Haste", "aspd", ["weapon"], 800, [{ stat: "local.attackSpeed", kind: "inc" }], "{0}% increased attack speed", [5], [27], { curve: 1 }),
    A("aspd", "suffix", "of Hurry", "aspdGlobal", ["gloves", "quiver", "ring", "amulet"], 500, [{ stat: "attackSpeed", kind: "inc" }], "{0}% increased attack speed", [4], [16], { curve: 1, count: 6 }),
    A("cspd", "suffix", "of Chanting", "cspd", [...CASTER, "amulet", "ring", "focus"], 600, [{ stat: "castSpeed", kind: "inc" }], "{0}% increased cast speed", [5], [28], { curve: 1 }),
    A("crit_local", "suffix", "of Precision", "crit", ["weapon"], 700, [{ stat: "local.critChance", kind: "inc" }], "{0}% increased critical chance", [10], [38], { curve: 1 }),
    A("crit", "suffix", "of Omens", "critGlobal", ["amulet", "ring", "helmet", "quiver", "focus"], 600, [{ stat: "critChance", kind: "inc" }], "{0}% increased critical chance", [8], [38], { curve: 1 }),
    A("critmulti", "suffix", "of Ruin", "critMulti", ["weapon", "amulet", "quiver", "gloves"], 500, [{ stat: "critMulti", kind: "flat" }], "+{0}% critical multiplier", [8], [38], { curve: 1 }),
    A("accuracy", "suffix", "of the Hawk", "accuracy", ["weapon", "helmet", "gloves", "ring", "amulet", "quiver"], 700, [{ stat: "accuracy", kind: "flat" }], "+{0} to accuracy", [20], [420]),
    A("leech", "suffix", "of the Leech", "leech", ["gloves", "ring", "amulet", "weapon"], 400, [{ stat: "leech", kind: "flat" }], "{0}% of attack damage leeched as life", [1], [3], { curve: 1, from: 1, count: 5, ratio: 1 }),
    A("area", "suffix", "of Reach", "area", ["amulet", "helmet", "gloves"], 300, [{ stat: "area", kind: "inc" }], "{0}% increased area of effect", [6], [20], { curve: 1, from: 2, count: 6 }),
    // ---- suffixes: sustain and utility
    A("regen", "suffix", "of Mending", "regen", [...DEF, ...JEWEL], 700, [{ stat: "lifeRegen", kind: "flat" }], "{0} life regenerated per second", [1], [45]),
    A("mana_regen", "suffix", "of Clarity", "manaRegen", ["amulet", "ring", "helmet", "caster", "focus"], 500, [{ stat: "manaRegen", kind: "flat" }], "{0} mana regenerated per second", [1], [14]),
    A("flask", "suffix", "of the Well", "flask", ["belt", "gloves"], 500, [{ stat: "flaskHeal", kind: "inc" }], "{0}% increased flask healing", [8], [40], { curve: 1, count: 6 }),
    A("block", "suffix", "of the Wall", "block", ["shield", "buckler"], 600, [{ stat: "block", kind: "flat" }], "+{0}% chance to block", [2], [8], { curve: 1, count: 6 }),
    A("move", "suffix", "of the Road", "move", ["boots"], 800, [{ stat: "moveSpeed", kind: "inc" }], "{0}% increased movement speed", [8], [30], { curve: 1, count: 6 }),
    A("rarity", "suffix", "of Plunder", "rarity", ["ring", "amulet", "helmet", "boots"], 500, [{ stat: "itemRarity", kind: "inc" }], "{0}% increased rarity of items found", [6], [26], { curve: 1, count: 6 }),
    A("life_kill", "suffix", "of the Vulture", "lifeOnKill", ["weapon", "ring", "gloves"], 400, [{ stat: "lifeOnKill", kind: "flat" }], "{0} life gained per kill", [3], [60])
  ];
  var AFFIXES = Object.fromEntries(list.map((a) => [a.id, a]));
  if (Object.keys(AFFIXES).length !== list.length) throw new Error("duplicate affix id");

  // src/core/data/zones.ts
  var ACTS = [
    {
      id: 1,
      name: "The Drowned Road",
      zones: ["a1_shore", "a1_saltmire", "a1_chapel", "a1_cliffs", "a1_village", "a1_floodgate", "a1_lock"],
      intro: "The road inland starts under the sea."
    }
  ];
  var ZONE_ORDER = ACTS.flatMap((a) => a.zones);

  // src/core/items.ts
  function baseOf(item) {
    const b = BASES[item.base];
    if (!b) throw new Error("unknown base " + item.base);
    return b;
  }
  function affixOf(a) {
    const def = AFFIXES[a.id];
    if (!def) throw new Error("unknown affix " + a.id);
    return def;
  }
  function rawMods(item) {
    const out = [];
    const b = baseOf(item);
    const src = itemLabel(item);
    for (const m2 of b.implicit ?? []) out.push({ ...m2, src });
    for (const a of item.affixes) {
      const def = affixOf(a);
      def.mods.forEach((m2, i) => {
        const mod = { stat: m2.stat, kind: m2.kind, value: a.rolls[i] ?? 0, src };
        if (m2.tags) mod.tags = m2.tags;
        out.push(mod);
      });
    }
    return out;
  }
  function itemStats(item) {
    const b = baseOf(item);
    const mods = rawMods(item);
    const local = (stat) => mods.filter((m2) => m2.stat === stat).reduce((s, m2) => s + m2.value, 0);
    const out = { global: mods.filter((m2) => !m2.stat.startsWith("local.")) };
    if (b.weapon) {
      const inc = 1 + local("local.physInc") / 100;
      const added = {};
      for (const t of ["fire", "cold", "lightning"]) {
        const lo = local(`local.addMin.${t}`), hi = local(`local.addMax.${t}`);
        if (lo || hi) added[t] = [lo, hi];
      }
      out.weapon = {
        ...b.weapon,
        phys: [Math.round((b.weapon.phys[0] + local("local.addMin.phys")) * inc), Math.round((b.weapon.phys[1] + local("local.addMax.phys")) * inc)],
        aps: Math.round(b.weapon.aps * (1 + local("local.attackSpeed") / 100) * 100) / 100,
        crit: Math.round(b.weapon.crit * (1 + local("local.critChance") / 100) * 100) / 100,
        added
      };
    }
    if (b.defence) {
      const inc = 1 + local("local.defInc") / 100;
      const d = b.defence;
      out.defence = {
        armour: Math.round((d.armour + local("local.armour")) * inc),
        evasion: Math.round((d.evasion + local("local.evasion")) * inc),
        energyShield: Math.round((d.energyShield + local("local.energyShield")) * inc)
      };
      if (d.block) out.defence.block = d.block;
    }
    return out;
  }
  function itemLabel(item) {
    const b = baseOf(item);
    if (item.rarity === "rare" && item.name) return item.name;
    if (item.rarity === "enchanted") {
      const p = item.affixes.find((a) => affixOf(a).type === "prefix");
      const s = item.affixes.find((a) => affixOf(a).type === "suffix");
      return [p ? affixOf(p).label : "", b.name, s ? affixOf(s).label : ""].filter(Boolean).join(" ");
    }
    return b.name;
  }
  function levelReq(item) {
    let req = baseOf(item).level;
    for (const a of item.affixes) req = Math.max(req, Math.floor((affixOf(a).tiers[a.tier]?.ilvl ?? 1) * 0.8));
    return Math.min(req, 90);
  }

  // src/core/types.ts
  var DAMAGE_TYPES = ["phys", "fire", "cold", "lightning", "chaos"];
  var ELEMENTS = ["fire", "cold", "lightning"];
  var SLOTS = ["weapon", "offhand", "helmet", "body", "gloves", "boots", "belt", "amulet", "ring1", "ring2"];

  // src/core/character.ts
  var UNARMED = { phys: [2, 5], aps: 1.2, crit: 5 };
  function supportSlots(level) {
    return SUPPORT_SLOT_LEVELS.filter((l) => l <= level).length;
  }
  function heroMods(hero, extra = []) {
    const cls = CLASSES[hero.cls];
    if (!cls) throw new Error("unknown class " + hero.cls);
    const mods = [...extra];
    let armour = 0, evasion = 0, es = 0, block = 0;
    const problems = [];
    mods.push({ stat: "str", kind: "flat", value: cls.str, src: cls.name });
    mods.push({ stat: "dex", kind: "flat", value: cls.dex, src: cls.name });
    mods.push({ stat: "int", kind: "flat", value: cls.int, src: cls.name });
    for (const slot of SLOTS) {
      const it = hero.equipment[slot];
      if (!it) continue;
      if (levelReq(it) > hero.level) {
        problems.push(`${slot}: needs level ${levelReq(it)}`);
        continue;
      }
      const st = itemStats(it);
      mods.push(...st.global);
      if (st.defence) {
        armour += st.defence.armour;
        evasion += st.defence.evasion;
        es += st.defence.energyShield;
        block += st.defence.block ?? 0;
      }
    }
    return { mods, armour, evasion, es, block, problems };
  }
  function zeroes() {
    return { phys: 0, fire: 0, cold: 0, lightning: 0, chaos: 0 };
  }
  function zeroRanges() {
    return { phys: [0, 0], fire: [0, 0], cold: [0, 0], lightning: [0, 0], chaos: [0, 0] };
  }
  function armourReduction(armour, hit) {
    if (hit <= 0) return 0;
    return Math.min(0.85, armour / (armour + 8 * hit));
  }
  function hitChance(acc, eva) {
    if (acc + eva <= 0) return 1;
    return Math.min(1, Math.max(0.05, 1.5 * acc / (acc + eva)));
  }
  function deriveSheet(hero, extra = []) {
    const base = heroMods(hero, extra);
    const bag = new StatBag(base.mods);
    const problems = [...base.problems];
    const cls = CLASSES[hero.cls];
    const L = hero.level;
    const str = Math.round(bag.calc("str")), dex = Math.round(bag.calc("dex")), int = Math.round(bag.calc("int"));
    bag.add({ stat: "life", kind: "flat", value: Math.floor(str / 2), src: "Might" });
    bag.add({ stat: "damage", kind: "inc", value: Math.floor(str / 5), tags: ["melee", "phys"], src: "Might" });
    bag.add({ stat: "accuracy", kind: "flat", value: dex * 2, src: "Grace" });
    bag.add({ stat: "evasion", kind: "inc", value: Math.floor(dex / 5), src: "Grace" });
    bag.add({ stat: "mana", kind: "flat", value: Math.floor(int / 2), src: "Wit" });
    bag.add({ stat: "energyShield", kind: "inc", value: Math.floor(int / 5), src: "Wit" });
    const life = Math.max(1, Math.round(bag.calc("life", heroBaseLife(L, cls.life))));
    const mana = Math.max(1, Math.round(bag.calc("mana", heroBaseMana(L))));
    const es = Math.round(bag.calc("energyShield", base.es));
    const armour = Math.round(bag.calc("armour", base.armour));
    const evasion = Math.round(bag.calc("evasion", base.evasion + 15 + 3 * L));
    const block = Math.min(50, bag.calc("block", base.block));
    const maxRes = zeroes(), res = zeroes(), resRaw = zeroes();
    for (const t of DAMAGE_TYPES) {
      maxRes[t] = Math.min(90, 75 + bag.flat(`maxRes.${t}`));
      resRaw[t] = Math.round(bag.flat(`res.${t}`));
      res[t] = Math.min(maxRes[t], resRaw[t]);
    }
    const lifeRegen = bag.flat("lifeRegen") + life * bag.flat("lifeRegenPct") / 100;
    const manaRegen = bag.flat("manaRegen") + mana * 0.02;
    const skill = calcSkill(hero, bag, problems);
    const ref = monsterDamage(L) * 1.5;
    const pool = life + es;
    const evade = 1 - Math.max(0.25, hitChance(monsterDefence(L), evasion));
    const blk = block / 100;
    const dmgTaken = bag.incMult("dmgTaken") * bag.more("dmgTaken");
    const ehp = zeroes();
    for (const t of DAMAGE_TYPES) {
      const through = t === "phys" ? (1 - armourReduction(armour, ref)) * (1 - evade) : 1 - res[t] / 100;
      ehp[t] = Math.round(pool / Math.max(0.01, through * (1 - blk) * dmgTaken));
    }
    return {
      level: L,
      str,
      dex,
      int,
      life,
      mana,
      es,
      lifeRegen,
      manaRegen,
      armour,
      evasion,
      block,
      res,
      resRaw,
      maxRes,
      moveSpeed: bag.incMult("moveSpeed"),
      flaskHeal: bag.incMult("flaskHeal"),
      flaskCharges: bag.incMult("flaskCharges"),
      lifeOnKill: bag.flat("lifeOnKill"),
      rarity: bag.inc("itemRarity"),
      quantity: bag.inc("itemQuantity"),
      xpGain: bag.incMult("xpGain"),
      dmgTaken,
      skill,
      ehp,
      problems,
      bag
    };
  }
  function calcSkill(hero, heroBag, problems) {
    const L = hero.level;
    let def = SKILLS[hero.skill];
    if (!def || def.level > L) {
      problems.push("skill not available");
      def = SKILLS.crescent;
    }
    const weaponItem = hero.equipment.weapon;
    const wst = weaponItem && levelReq(weaponItem) <= L ? itemStats(weaponItem).weapon : void 0;
    const wkind = wst ? BASES[weaponItem.base].kind : "unarmed";
    let usable = true;
    if (def.kind === "attack" && def.weapons && def.weapons.length && !def.weapons.includes(wkind)) {
      problems.push(`${def.name} can't be used with ${wst ? "this weapon" : "no weapon"}`);
      usable = false;
    }
    const bag = new StatBag();
    bag.addAll(allMods(heroBag));
    for (const m2 of def.mods ?? []) bag.add(m2);
    const tags = /* @__PURE__ */ new Set([...def.tags, def.kind]);
    const slots = supportSlots(L);
    const used = [];
    let manaMult = 1, extraTargets = 0;
    for (const id of hero.supports.slice(0, slots)) {
      const sup = SUPPORTS[id];
      if (!sup || sup.level > L) continue;
      if (sup.requires.length && !sup.requires.some((t) => tags.has(t))) {
        problems.push(`${sup.name} does not support ${def.name}`);
        continue;
      }
      used.push(id);
      for (const m2 of sup.mods) bag.add({ ...m2, src: sup.name });
      manaMult *= sup.manaMult;
      extraTargets += sup.targets ?? 0;
    }
    const eff = def.effectiveness / 100 * (usable ? 1 : 0.5);
    const baseDmg = zeroRanges();
    let crit, speed;
    if (def.kind === "attack") {
      const w = wst ?? { ...UNARMED, added: {} };
      baseDmg.phys = [w.phys[0], w.phys[1]];
      for (const t of ELEMENTS) {
        const a = w.added[t];
        if (a) baseDmg[t] = [a[0], a[1]];
      }
      crit = w.crit;
      speed = w.aps * (def.speedMult ?? 1);
    } else {
      const sc = spellScale(L);
      for (const t of DAMAGE_TYPES) {
        const d = def.damage?.[t];
        if (d) baseDmg[t] = [d[0] * sc, d[1] * sc];
      }
      crit = def.crit ?? 6;
      speed = 1 / (def.castTime ?? 1);
    }
    const ctx = tagSet([...tags]);
    for (const t of DAMAGE_TYPES) {
      const c = tagSet([...tags, t]);
      baseDmg[t] = [(baseDmg[t][0] + bag.flat(`addMin.${t}`, c)) * eff, (baseDmg[t][1] + bag.flat(`addMax.${t}`, c)) * eff];
    }
    const conv = zeroes();
    let convTotal = 0;
    for (const t of ELEMENTS) {
      conv[t] = Math.max(0, bag.flat(`convert.${t}`, ctx));
      convTotal += conv[t];
    }
    conv.chaos = Math.max(0, bag.flat("convert.chaos", ctx));
    convTotal += conv.chaos;
    const scale = convTotal > 100 ? 100 / convTotal : 1;
    const hit = zeroRanges();
    const addPortion = (dest, types, lo, hi) => {
      if (lo <= 0 && hi <= 0) return;
      const c = tagSet([...tags], types);
      if (types.some((x) => x === "fire" || x === "cold" || x === "lightning")) c.add("elemental");
      const mult = bag.incMult("damage", c) * bag.more("damage", c);
      hit[dest][0] += lo * mult;
      hit[dest][1] += hi * mult;
    };
    const physKeep = 1 - Math.min(1, convTotal * scale / 100);
    addPortion("phys", ["phys"], baseDmg.phys[0] * physKeep, baseDmg.phys[1] * physKeep);
    for (const t of ["fire", "cold", "lightning", "chaos"]) {
      const share = conv[t] * scale / 100;
      if (share > 0) addPortion(t, ["phys", t], baseDmg.phys[0] * share, baseDmg.phys[1] * share);
      addPortion(t, [t], baseDmg[t][0], baseDmg[t][1]);
    }
    for (const t of DAMAGE_TYPES) hit[t] = [Math.round(hit[t][0] * 10) / 10, Math.round(hit[t][1] * 10) / 10];
    const critChance = Math.min(95, (crit + bag.flat("baseCrit", ctx)) * bag.incMult("critChance", ctx) * bag.more("critChance", ctx));
    const critMulti = 150 + bag.flat("critMulti", ctx);
    if (def.kind === "attack") speed *= bag.incMult("attackSpeed", ctx) * bag.more("attackSpeed", ctx);
    else speed *= bag.incMult("castSpeed", ctx) * bag.more("castSpeed", ctx);
    const accuracy = Math.round(bag.calc("accuracy", heroBaseAccuracy(L), ctx));
    const hc = def.kind === "spell" ? 1 : hitChance(accuracy, monsterDefence(L));
    let targets = 1;
    if (def.shape === "area") targets = Math.max(1, Math.floor((def.targets ?? 3) * bag.incMult("area", ctx))) + extraTargets;
    else if (def.shape === "projectile") targets = 1 + (def.targets ?? 0) + extraTargets + Math.floor(bag.flat("pierce", ctx));
    const manaCost = Math.round(def.manaCost * (1 + 0.04 * (L - 1)) * manaMult * bag.incMult("manaCost") * 10) / 10;
    const pen = zeroes();
    for (const t of DAMAGE_TYPES) pen[t] = bag.flat(`pen.${t}`, ctx);
    let avgHit = 0;
    for (const t of DAMAGE_TYPES) avgHit += (hit[t][0] + hit[t][1]) / 2;
    const critFactor = 1 + critChance / 100 * (critMulti / 100 - 1);
    const dps = avgHit * critFactor * speed * hc;
    return {
      id: def.id,
      name: def.name,
      kind: def.kind,
      shape: def.shape,
      fx: def.fx,
      tags: [...tags],
      hit,
      avgHit,
      critChance,
      critMulti,
      speed,
      hitChance: hc,
      accuracy,
      targets,
      manaCost,
      leech: Math.min(20, bag.flat("leech", ctx)),
      pen,
      dps,
      packDps: dps * targets,
      supports: used
    };
  }
  function allMods(bag) {
    const out = [];
    for (const stat of STAT_KEYS) out.push(...bag.mods(stat));
    return out;
  }
  var STAT_KEYS = [
    "damage",
    "critChance",
    "critMulti",
    "attackSpeed",
    "castSpeed",
    "area",
    "pierce",
    "leech",
    "accuracy",
    "manaCost",
    "baseCrit",
    "skillEffect",
    ...DAMAGE_TYPES.flatMap((t) => [`addMin.${t}`, `addMax.${t}`, `pen.${t}`, `convert.${t}`])
  ];

  // src/core/rng.ts
  function splitmix32(a) {
    return () => {
      a = a + 2654435769 | 0;
      let t = a ^ a >>> 16;
      t = Math.imul(t, 569420461);
      t ^= t >>> 15;
      t = Math.imul(t, 1935289751);
      t ^= t >>> 15;
      return t >>> 0;
    };
  }
  function hashSeed(...parts) {
    let h = 2166136261;
    for (const p of parts) {
      const sm = splitmix32((h ^ (p | 0)) >>> 0);
      h = (sm() ^ Math.imul(h, 16777619)) >>> 0;
    }
    return h >>> 0;
  }

  // src/core/state.ts
  var newTotals = () => ({ kills: 0, deaths: 0, runs: 0, items: 0, salvaged: 0, dust: 0, simMs: 0 });

  // src/core/game.ts
  var LOG_MAX = 60;
  function newGame(opts) {
    const cls = CLASSES[opts.cls];
    if (!cls) throw new Error("unknown class " + opts.cls);
    const seed = opts.seed ?? hashSeed(opts.now, opts.name.length);
    const state = {
      seed,
      createdAt: opts.now,
      simTo: opts.now,
      hero: { name: opts.name, cls: cls.id, level: 1, xp: 0, skill: cls.startSkill, supports: [], equipment: {}, passives: [], rev: 0 },
      stash: [],
      stashCap: 60,
      dust: 0,
      currency: {},
      world: { unlocked: ["a1_shore"], clears: {}, storySeen: [] },
      activity: { zone: "a1_shore", autoPush: true, runIndex: 0, streak: 0, deaths: 0, run: null, acc: 0 },
      settings: { keep: "enchanted", autoEquip: true },
      totals: newTotals(),
      nextUid: 1,
      log: []
    };
    state.hero.equipment.weapon = { uid: state.nextUid++, base: cls.startWeapon, ilvl: 1, rarity: "plain", affixes: [] };
    pushLog(state, "info", `${opts.name} wakes on the shore.`);
    return state;
  }
  var cache = /* @__PURE__ */ new WeakMap();
  function sheetOf(state) {
    const c = cache.get(state.hero);
    if (c && c.rev === state.hero.rev) return c.sheet;
    const sheet = deriveSheet(state.hero);
    cache.set(state.hero, { rev: state.hero.rev, sheet });
    return sheet;
  }
  function pushLog(state, kind, text) {
    state.log.push({ t: state.simTo, kind, text });
    if (state.log.length > LOG_MAX) state.log.splice(0, state.log.length - LOG_MAX);
  }

  // src/main.ts
  globalThis.__hollowmarch = { newGame, sheetOf };
})();
