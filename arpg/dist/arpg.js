/* Hollowmarch - idle ARPG addon for Discord Quest Agent. Built file; edit arpg/src. */
"use strict";
(() => {
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
    let h2 = 2166136261;
    for (const p of parts) {
      const sm = splitmix32((h2 ^ (p | 0)) >>> 0);
      h2 = (sm() ^ Math.imul(h2, 16777619)) >>> 0;
    }
    return h2 >>> 0;
  }
  var Rng = class {
    s;
    constructor(seed) {
      if (Array.isArray(seed)) {
        this.s = [seed[0] >>> 0, seed[1] >>> 0, seed[2] >>> 0, seed[3] >>> 0];
        return;
      }
      const sm = splitmix32(seed >>> 0);
      this.s = [sm(), sm(), sm(), sm()];
      for (let i = 0; i < 12; i++) this.u32();
    }
    /** Uniform uint32. */
    u32() {
      let [a, b, c, d] = this.s;
      const t = (a + b | 0) + d | 0;
      d = d + 1 | 0;
      a = b ^ b >>> 9;
      b = c + (c << 3) | 0;
      c = c << 21 | c >>> 11;
      c = c + t | 0;
      this.s = [a >>> 0, b >>> 0, c >>> 0, d >>> 0];
      return t >>> 0;
    }
    /** Uniform float in [0, 1). */
    next() {
      return this.u32() / 4294967296;
    }
    /** Uniform float in [lo, hi). */
    range(lo, hi) {
      return lo + (hi - lo) * this.next();
    }
    /** Uniform integer in [lo, hi] (inclusive). */
    int(lo, hi) {
      return lo + Math.floor(this.next() * (hi - lo + 1));
    }
    chance(p) {
      return p >= 1 || p > 0 && this.next() < p;
    }
    pick(arr) {
      if (!arr.length) throw new Error("pick from empty array");
      return arr[Math.floor(this.next() * arr.length)];
    }
    /** Weighted pick; returns undefined when every weight is zero. */
    weighted(arr, weight) {
      let total = 0;
      for (const x of arr) total += Math.max(0, weight(x));
      if (total <= 0) return void 0;
      let r3 = this.next() * total;
      for (const x of arr) {
        r3 -= Math.max(0, weight(x));
        if (r3 < 0) return x;
      }
      return arr[arr.length - 1];
    }
    state() {
      return [...this.s];
    }
  };

  // src/core/data/scaling.ts
  var MAX_LEVEL = 100;
  function monsterLife(level) {
    const l = level - 1;
    return 20 * Math.pow(1.085, l) * (1 + 0.03 * l);
  }
  function monsterDamage(level) {
    const l = level - 1;
    return 5 * Math.pow(1.055, l) * (1 + 0.02 * l);
  }
  function monsterDefence(level) {
    const l = level - 1;
    return 12 + 9 * l * Math.pow(1.03, l);
  }
  function monsterXp(level) {
    return 4 * Math.pow(level, 1.9) + 6;
  }
  function xpToNext(level) {
    if (level >= MAX_LEVEL) return Infinity;
    const late = level > 60 ? Math.pow(1.07, level - 60) : 1;
    return Math.round(3 * (80 * Math.pow(level, 2.8) + 120 * level) * late);
  }
  function xpPenalty(heroLevel, monsterLevel) {
    const safe = 3 + Math.floor(heroLevel / 16);
    const d = Math.abs(heroLevel - monsterLevel) - safe;
    return d <= 0 ? 1 : Math.pow(5 / (5 + d), 2.5);
  }
  function spellScale(level) {
    const l = level - 1;
    return Math.pow(1.06, l) * (1 + 0.015 * l);
  }
  function heroBaseLife(level, classLife) {
    return classLife + 20 * (level - 1);
  }
  function heroBaseMana(level) {
    return 40 + 6 * (level - 1);
  }
  function heroBaseAccuracy(level) {
    const l = level - 1;
    return 20 + 12 * l * Math.pow(1.03, l);
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
    },
    strider: {
      id: "strider",
      name: "Strider",
      blurb: "A lamplighter who walked the drowned roads for a living. Quick feet, a bow, and a good eye.",
      str: 12,
      dex: 24,
      int: 10,
      life: 62,
      startSkill: "twinshot",
      startWeapon: "bow1",
      startNode: "start_strider",
      color: "#19b3a3"
    },
    arcanist: {
      id: "arcanist",
      name: "Arcanist",
      blurb: "A chapel scholar who read the ember's writing before it burned him alive. Spells and a shield of light.",
      str: 10,
      dex: 12,
      int: 24,
      life: 46,
      startSkill: "emberbolt",
      startWeapon: "wand1",
      startNode: "start_arcanist",
      color: "#8b5cf6"
    }
  };

  // src/core/data/skills.ts
  var MELEE = ["sword", "axe", "mace", "greatsword", "greataxe", "dagger", "staff"];
  var BOW = ["bow"];
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
    },
    // ---- bow skills (Strider)
    twinshot: {
      id: "twinshot",
      name: "Twin Shot",
      kind: "attack",
      shape: "projectile",
      tags: ["attack", "projectile", "bow"],
      effectiveness: 80,
      targets: 1,
      manaCost: 4,
      level: 1,
      weapons: BOW,
      fx: "bolt",
      blurb: "Two arrows from one draw; each can pass through an enemy."
    },
    barbrain: {
      id: "barbrain",
      name: "Rain of Barbs",
      kind: "attack",
      shape: "area",
      tags: ["attack", "projectile", "area", "bow"],
      effectiveness: 70,
      targets: 4,
      manaCost: 7,
      level: 6,
      weapons: BOW,
      fx: "nova",
      blurb: "Arrows fired high that come down across the whole pack."
    },
    heartseeker: {
      id: "heartseeker",
      name: "Heartseeker",
      kind: "attack",
      shape: "single",
      tags: ["attack", "projectile", "bow", "strike"],
      effectiveness: 190,
      speedMult: 0.85,
      manaCost: 7,
      level: 10,
      weapons: BOW,
      fx: "bolt",
      blurb: "A slow aimed shot that finds the gaps in armour.",
      mods: [{ stat: "critChance", kind: "inc", value: 60, src: "Heartseeker" }, { stat: "critMulti", kind: "flat", value: 30, src: "Heartseeker" }]
    },
    stormvolley: {
      id: "stormvolley",
      name: "Storm Volley",
      kind: "attack",
      shape: "projectile",
      tags: ["attack", "projectile", "bow", "lightning"],
      effectiveness: 95,
      targets: 2,
      manaCost: 9,
      level: 18,
      weapons: BOW,
      fx: "bolt",
      blurb: "Charged arrows; half their physical damage becomes lightning.",
      mods: [{ stat: "convert.lightning", kind: "flat", value: 50, src: "Storm Volley" }]
    },
    skewer: {
      id: "skewer",
      name: "Skewer",
      kind: "attack",
      shape: "single",
      tags: ["attack", "melee", "strike"],
      effectiveness: 130,
      speedMult: 1.2,
      manaCost: 4,
      level: 4,
      weapons: ["dagger", "sword"],
      fx: "stab",
      blurb: "Fast stabs for when the pack is too close to shoot."
    },
    // ---- spells (Arcanist)
    emberbolt: {
      id: "emberbolt",
      name: "Ember Bolt",
      kind: "spell",
      shape: "projectile",
      tags: ["spell", "projectile", "fire"],
      effectiveness: 100,
      damage: { fire: [5, 9] },
      castTime: 0.75,
      crit: 6,
      targets: 0,
      manaCost: 5,
      level: 1,
      fx: "bolt",
      blurb: "A thrown coal of the dead sun."
    },
    frostring: {
      id: "frostring",
      name: "Rime Ring",
      kind: "spell",
      shape: "area",
      tags: ["spell", "area", "cold"],
      effectiveness: 70,
      damage: { cold: [4, 7] },
      castTime: 0.8,
      crit: 6,
      targets: 4,
      manaCost: 8,
      level: 4,
      fx: "nova",
      blurb: "A ring of frost bursts out from you and bites everything near."
    },
    chainspark: {
      id: "chainspark",
      name: "Chain Spark",
      kind: "spell",
      shape: "projectile",
      tags: ["spell", "projectile", "lightning"],
      effectiveness: 80,
      damage: { lightning: [1, 15] },
      castTime: 0.7,
      crit: 7,
      targets: 2,
      manaCost: 7,
      level: 8,
      fx: "bolt",
      blurb: "A spark that jumps from enemy to enemy."
    },
    glacial: {
      id: "glacial",
      name: "Glacial Lance",
      kind: "spell",
      shape: "single",
      tags: ["spell", "cold"],
      effectiveness: 150,
      damage: { cold: [12, 18] },
      castTime: 1,
      crit: 8,
      manaCost: 10,
      level: 12,
      fx: "stab",
      blurb: "A spear of old ice, slow to form and hard to survive."
    },
    hexbloom: {
      id: "hexbloom",
      name: "Hex Bloom",
      kind: "spell",
      shape: "area",
      tags: ["spell", "area", "chaos"],
      effectiveness: 80,
      damage: { chaos: [6, 10] },
      castTime: 0.9,
      crit: 5,
      targets: 3,
      manaCost: 11,
      level: 20,
      fx: "nova",
      blurb: "Rot flowers open in the pack. Few things resist it."
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
    },
    // ---- spell and projectile supports
    echo: {
      id: "echo",
      name: "Echoing Words",
      requires: ["spell"],
      level: 4,
      manaMult: 1.4,
      mods: [m("castSpeed", "more", 35), m("damage", "more", -12)],
      blurb: "35% more cast speed, 12% less damage."
    },
    potency: {
      id: "potency",
      name: "Potency",
      requires: ["spell"],
      level: 1,
      manaMult: 1.3,
      mods: [m("damage", "more", 30, ["spell"])],
      blurb: "30% more spell damage."
    },
    volley: {
      id: "volley",
      name: "Volley",
      requires: ["projectile"],
      level: 6,
      manaMult: 1.3,
      targets: 1,
      mods: [m("damage", "more", -10)],
      blurb: "One more projectile target, 10% less damage."
    },
    elemfocus: {
      id: "elemfocus",
      name: "Elemental Focus",
      requires: ["fire", "cold", "lightning"],
      level: 12,
      manaMult: 1.3,
      mods: [m("damage", "more", 30, ["elemental"])],
      blurb: "30% more elemental damage."
    },
    rot: {
      id: "rot",
      name: "Rot",
      requires: [],
      level: 22,
      manaMult: 1.3,
      mods: [m("convert.chaos", "flat", 25), m("damage", "more", 15, ["chaos"])],
      blurb: "25% of physical damage becomes chaos; 15% more chaos damage."
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
    for (const w2 of WEAPONS) {
      TIER_LEVELS.forEach((lvl, i) => {
        const avg = weaponAvg(lvl) * w2.dmg;
        const b = {
          id: `${w2.kind}${i + 1}`,
          name: w2.names[i],
          slot: "weapon",
          kind: w2.kind,
          level: lvl,
          weapon: { phys: [r(avg * (1 - w2.spread / 2)), r(avg * (1 + w2.spread / 2))], aps: w2.aps, crit: w2.crit, hands: w2.hands, ranged: !!w2.ranged }
        };
        const imp = w2.implicit?.(lvl);
        if (imp) b.implicit = imp;
        add(b);
      });
    }
    for (const a of ARMOURS) {
      TIER_LEVELS.forEach((lvl, i) => {
        const d = defence(lvl) * a.mult;
        const def2 = { armour: a.ar ? r(d * a.ar) : 0, evasion: a.ev ? r(d * a.ev) : 0, energyShield: a.es ? r(d * a.es) : 0 };
        if (a.block) def2.block = a.block;
        add({ id: `${a.kind}_${a.slot}${i + 1}`, name: a.names[i], slot: a.slot, kind: a.kind, level: lvl, defence: def2 });
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
  function slotsFor(b) {
    return b.slot === "ring" ? ["ring1", "ring2"] : [b.slot];
  }

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
    A("life", "prefix", "Hale", "life", [...DEF, ...JEWEL], 1e3, [{ stat: "life", kind: "flat" }], "+{0} to maximum life", [15], [210]),
    A("mana", "prefix", "Lucid", "mana", ["amulet", "ring", "helmet", "gloves", "caster", "focus"], 700, [{ stat: "mana", kind: "flat" }], "+{0} to maximum mana", [10], [90]),
    A("es", "prefix", "Shimmering", "es", ["es", "amulet", "belt"], 800, [{ stat: "energyShield", kind: "flat" }], "+{0} to maximum energy shield", [8], [120]),
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
  var RARE_NAMES_A = ["Grim", "Salt", "Hollow", "Tide", "Dusk", "Ember", "Gloom", "Wrack", "Brine", "Storm", "Ash", "Wither", "Lantern", "Glass", "Cinder", "Mourn", "Drift", "Bone", "Rust", "Omen"];
  var RARE_NAMES_B = ["Bite", "Song", "Ward", "Mark", "Coil", "Veil", "Fang", "Shell", "Grasp", "Knell", "Wake", "Spire", "Crest", "Wail", "Hook", "Bloom", "Scar", "Turn", "Keel", "Hush"];

  // src/core/data/monsters.ts
  var MONSTERS = {
    drowned: {
      id: "drowned",
      name: "Drowned Wretch",
      life: 1,
      damage: 1,
      speed: 0.9,
      split: { phys: 1 },
      armour: 0.6,
      evasion: 0.3,
      accuracy: 1,
      xp: 1,
      look: { shape: "tall", body: "#5f8f86", eye: "#f5e663", size: 1 }
    },
    crab: {
      id: "crab",
      name: "Shellback",
      life: 1.4,
      damage: 0.8,
      speed: 0.8,
      split: { phys: 1 },
      armour: 2.2,
      evasion: 0.2,
      accuracy: 0.9,
      xp: 1.1,
      look: { shape: "crab", body: "#d0643a", eye: "#111111", size: 0.9 }
    },
    gull: {
      id: "gull",
      name: "Bone Gull",
      life: 0.6,
      damage: 0.7,
      speed: 1.6,
      split: { phys: 1 },
      armour: 0.2,
      evasion: 2,
      accuracy: 1.2,
      xp: 0.9,
      look: { shape: "bird", body: "#e9e4d4", eye: "#d13b3b", size: 0.8 }
    },
    bogwitch: {
      id: "bogwitch",
      name: "Mire Hag",
      life: 0.8,
      damage: 1.2,
      speed: 0.6,
      split: { cold: 0.7, chaos: 0.3 },
      spell: true,
      armour: 0.3,
      evasion: 0.6,
      accuracy: 1,
      xp: 1.3,
      look: { shape: "robe", body: "#4a5a3a", eye: "#9ef26a", size: 1 }
    },
    eel: {
      id: "eel",
      name: "Lamp Eel",
      life: 0.9,
      damage: 1,
      speed: 1.1,
      split: { lightning: 0.8, phys: 0.2 },
      armour: 0.4,
      evasion: 1.2,
      accuracy: 1.1,
      xp: 1.1,
      res: { lightning: 40 },
      look: { shape: "blob", body: "#2f6fb8", eye: "#fff27a", size: 0.9 }
    },
    lampman: {
      id: "lampman",
      name: "Lanternless",
      life: 1.2,
      damage: 1.1,
      speed: 0.8,
      split: { fire: 0.6, phys: 0.4 },
      armour: 1,
      evasion: 0.5,
      accuracy: 1,
      xp: 1.2,
      res: { fire: 30 },
      look: { shape: "tall", body: "#3c3c46", eye: "#ff9a2e", size: 1.05 }
    },
    // ---- Act 2: the Glass Barrens
    scorpion: {
      id: "scorpion",
      name: "Glass Scorpion",
      life: 1.2,
      damage: 1,
      speed: 1,
      split: { phys: 0.7, chaos: 0.3 },
      armour: 1.8,
      evasion: 0.5,
      accuracy: 1.1,
      xp: 1.1,
      look: { shape: "crab", body: "#9fd8e8", eye: "#ff3b3b", size: 0.95 }
    },
    wraith: {
      id: "wraith",
      name: "Sand Wraith",
      life: 0.8,
      damage: 1.2,
      speed: 0.8,
      split: { fire: 0.5, phys: 0.5 },
      spell: true,
      armour: 0.3,
      evasion: 1.4,
      accuracy: 1,
      xp: 1.2,
      look: { shape: "robe", body: "#d9b56b", eye: "#ffffff", size: 1 }
    },
    jackal: {
      id: "jackal",
      name: "Mirage Jackal",
      life: 0.7,
      damage: 0.9,
      speed: 1.5,
      split: { phys: 1 },
      armour: 0.3,
      evasion: 1.8,
      accuracy: 1.2,
      xp: 0.9,
      look: { shape: "blob", body: "#c4884a", eye: "#fff27a", size: 0.8 }
    },
    bleached: {
      id: "bleached",
      name: "Bleached Pilgrim",
      life: 1.1,
      damage: 1,
      speed: 0.9,
      split: { phys: 0.6, lightning: 0.4 },
      armour: 1,
      evasion: 0.6,
      accuracy: 1,
      xp: 1.1,
      look: { shape: "tall", body: "#ece3cf", eye: "#3a9bff", size: 1 }
    },
    wasp: {
      id: "wasp",
      name: "Prism Wasp",
      life: 0.5,
      damage: 0.8,
      speed: 1.8,
      split: { lightning: 0.7, phys: 0.3 },
      armour: 0.2,
      evasion: 2.2,
      accuracy: 1.3,
      xp: 0.9,
      res: { lightning: 30 },
      look: { shape: "bird", body: "#b8f0ff", eye: "#ff5a36", size: 0.7 }
    },
    // ---- Act 3: the Sunfall
    hound: {
      id: "hound",
      name: "Ember Hound",
      life: 0.9,
      damage: 1.1,
      speed: 1.4,
      split: { fire: 0.6, phys: 0.4 },
      armour: 0.6,
      evasion: 1.2,
      accuracy: 1.2,
      xp: 1,
      res: { fire: 40 },
      look: { shape: "blob", body: "#e2543b", eye: "#ffe066", size: 0.9 }
    },
    ashwalker: {
      id: "ashwalker",
      name: "Ash Walker",
      life: 1.4,
      damage: 1.1,
      speed: 0.8,
      split: { phys: 0.5, fire: 0.5 },
      armour: 1.6,
      evasion: 0.4,
      accuracy: 1,
      xp: 1.2,
      res: { fire: 30 },
      look: { shape: "tall", body: "#5b5450", eye: "#ff9a2e", size: 1.1 }
    },
    cinderbat: {
      id: "cinderbat",
      name: "Cinder Bat",
      life: 0.5,
      damage: 0.8,
      speed: 1.9,
      split: { fire: 1 },
      armour: 0.2,
      evasion: 2,
      accuracy: 1.3,
      xp: 0.9,
      res: { fire: 50 },
      look: { shape: "bird", body: "#3c2f2f", eye: "#ff5a36", size: 0.75 }
    },
    magmacrab: {
      id: "magmacrab",
      name: "Magma Carapace",
      life: 1.8,
      damage: 0.9,
      speed: 0.7,
      split: { fire: 0.5, phys: 0.5 },
      armour: 2.6,
      evasion: 0.2,
      accuracy: 0.9,
      xp: 1.3,
      res: { fire: 50, cold: -20 },
      look: { shape: "crab", body: "#7a2e1f", eye: "#ffc233", size: 1.05 }
    },
    sunpriest: {
      id: "sunpriest",
      name: "Sunless Priest",
      life: 0.9,
      damage: 1.4,
      speed: 0.6,
      split: { fire: 0.4, chaos: 0.6 },
      spell: true,
      armour: 0.4,
      evasion: 0.7,
      accuracy: 1,
      xp: 1.4,
      res: { chaos: 30 },
      look: { shape: "robe", body: "#2b2233", eye: "#ffc233", size: 1.05 }
    },
    // ---- bosses
    tidewarden: {
      id: "tidewarden",
      name: "The Tide-Warden",
      boss: true,
      life: 25,
      damage: 2,
      speed: 0.7,
      split: { phys: 0.6, cold: 0.4 },
      armour: 1.5,
      evasion: 0.6,
      accuracy: 1.2,
      res: { cold: 40, fire: 20, lightning: 20, chaos: 20 },
      xp: 18,
      look: { shape: "giant", body: "#2c6f73", eye: "#dff7ff", size: 1.8 }
    },
    keeper: {
      id: "keeper",
      name: "Chapel Keeper",
      boss: true,
      life: 12,
      damage: 1.6,
      speed: 0.8,
      split: { phys: 0.5, chaos: 0.5 },
      armour: 1,
      evasion: 0.8,
      accuracy: 1.1,
      res: { chaos: 30, fire: 10, cold: 10, lightning: 10 },
      xp: 10,
      look: { shape: "robe", body: "#6b4a7a", eye: "#ffd84a", size: 1.5 }
    },
    drownedknight: {
      id: "drownedknight",
      name: "The Drowned Knight",
      boss: true,
      life: 14,
      damage: 1.7,
      speed: 0.9,
      split: { phys: 0.8, cold: 0.2 },
      armour: 2.2,
      evasion: 0.5,
      accuracy: 1.2,
      res: { cold: 30, fire: 15, lightning: 15, chaos: 15 },
      xp: 10,
      look: { shape: "tall", body: "#4f6d7a", eye: "#9ff3ff", size: 1.7 }
    },
    sandwright: {
      id: "sandwright",
      name: "The Sandwright",
      boss: true,
      life: 16,
      damage: 1.8,
      speed: 0.7,
      split: { phys: 0.6, fire: 0.4 },
      armour: 2,
      evasion: 0.4,
      accuracy: 1.1,
      res: { fire: 30, cold: 15, lightning: 15, chaos: 20 },
      xp: 12,
      look: { shape: "giant", body: "#c9a15a", eye: "#fff6d0", size: 1.6 }
    },
    mirrorwarden: {
      id: "mirrorwarden",
      name: "The Mirror Warden",
      boss: true,
      life: 18,
      damage: 1.9,
      speed: 0.9,
      split: { lightning: 0.5, phys: 0.5 },
      armour: 1,
      evasion: 1.5,
      accuracy: 1.3,
      res: { lightning: 40, fire: 25, cold: 25, chaos: 25 },
      xp: 14,
      look: { shape: "tall", body: "#a8e6f5", eye: "#ffffff", size: 1.7 }
    },
    glassregent: {
      id: "glassregent",
      name: "The Glass Regent",
      boss: true,
      life: 28,
      damage: 2.1,
      speed: 0.75,
      split: { lightning: 0.4, fire: 0.3, phys: 0.3 },
      armour: 1.4,
      evasion: 1,
      accuracy: 1.3,
      res: { lightning: 40, fire: 30, cold: 30, chaos: 25 },
      xp: 22,
      look: { shape: "robe", body: "#7fd1ff", eye: "#ffffff", size: 1.9 }
    },
    cindermatron: {
      id: "cindermatron",
      name: "The Cinder Matron",
      boss: true,
      life: 20,
      damage: 2,
      speed: 0.8,
      split: { fire: 0.7, chaos: 0.3 },
      armour: 1.2,
      evasion: 0.8,
      accuracy: 1.2,
      res: { fire: 50, cold: 20, lightning: 25, chaos: 30 },
      xp: 16,
      look: { shape: "robe", body: "#b0412a", eye: "#ffe066", size: 1.8 }
    },
    emberjudge: {
      id: "emberjudge",
      name: "The Ember Judge",
      boss: true,
      life: 22,
      damage: 2.1,
      speed: 0.85,
      split: { fire: 0.5, phys: 0.5 },
      armour: 2,
      evasion: 0.8,
      accuracy: 1.3,
      res: { fire: 40, cold: 30, lightning: 30, chaos: 30 },
      xp: 18,
      look: { shape: "tall", body: "#ff9a2e", eye: "#111111", size: 1.8 }
    },
    // ---- pinnacles
    p_drownedsun: {
      id: "p_drownedsun",
      name: "The Drowned Sun",
      boss: true,
      life: 70,
      damage: 2.6,
      speed: 0.8,
      split: { cold: 0.5, fire: 0.3, phys: 0.2 },
      armour: 1.5,
      evasion: 1,
      accuracy: 1.4,
      res: { fire: 40, cold: 50, lightning: 40, chaos: 40 },
      xp: 60,
      look: { shape: "giant", body: "#1f5a6a", eye: "#ffe066", size: 2.1 }
    },
    p_glasschoir: {
      id: "p_glasschoir",
      name: "The Glass Choir",
      boss: true,
      life: 80,
      damage: 2.8,
      speed: 1.1,
      split: { lightning: 0.6, phys: 0.4 },
      armour: 1,
      evasion: 2,
      accuracy: 1.5,
      res: { fire: 40, cold: 40, lightning: 55, chaos: 40 },
      xp: 70,
      look: { shape: "robe", body: "#c8f2ff", eye: "#ff5a36", size: 2.1 }
    },
    p_ashenking: {
      id: "p_ashenking",
      name: "The Ashen King",
      boss: true,
      life: 95,
      damage: 3,
      speed: 0.8,
      split: { fire: 0.5, phys: 0.3, chaos: 0.2 },
      armour: 2.4,
      evasion: 0.8,
      accuracy: 1.5,
      res: { fire: 55, cold: 40, lightning: 40, chaos: 45 },
      xp: 85,
      look: { shape: "giant", body: "#4a2a20", eye: "#ff3b1f", size: 2.2 }
    },
    p_hollowcrown: {
      id: "p_hollowcrown",
      name: "The Hollow Crown",
      boss: true,
      life: 130,
      damage: 3.3,
      speed: 0.9,
      split: { chaos: 0.6, cold: 0.2, lightning: 0.2 },
      armour: 2,
      evasion: 1.5,
      accuracy: 1.6,
      res: { fire: 50, cold: 50, lightning: 50, chaos: 60 },
      xp: 120,
      look: { shape: "robe", body: "#1a1422", eye: "#b9a4ff", size: 2.3 }
    },
    lastdawn: {
      id: "lastdawn",
      name: "The Last Dawn",
      boss: true,
      life: 34,
      damage: 2.3,
      speed: 0.7,
      split: { fire: 0.5, lightning: 0.2, chaos: 0.3 },
      armour: 1.6,
      evasion: 1,
      accuracy: 1.4,
      res: { fire: 50, cold: 35, lightning: 35, chaos: 35 },
      xp: 30,
      look: { shape: "giant", body: "#ffc233", eye: "#ff3b1f", size: 2 }
    }
  };

  // src/core/data/zones.ts
  var ACT_BOSS_POINTS = 2;
  var TRIAL_POINTS = 2;
  var ZONES = {
    a1_shore: {
      id: "a1_shore",
      act: 1,
      name: "The Weeping Shore",
      level: 1,
      packs: 6,
      packSize: [2, 4],
      monsters: ["drowned", "crab"],
      champion: 0.05,
      palette: ["#6e7f86", "#c9b98f", "#f5e663"],
      story: "You wake in the surf with an ember where your heart was. The tide gave you back. The shore is full of others it gave back worse."
    },
    a1_saltmire: {
      id: "a1_saltmire",
      act: 1,
      name: "Saltmire",
      level: 3,
      packs: 7,
      packSize: [3, 4],
      monsters: ["drowned", "bogwitch", "crab"],
      champion: 0.08,
      palette: ["#55665a", "#6f7351", "#9ef26a"],
      story: "The salt marsh hums. Something in the reeds is singing the drowned awake."
    },
    a1_chapel: {
      id: "a1_chapel",
      act: 1,
      name: "The Sunken Chapel",
      level: 5,
      packs: 7,
      packSize: [3, 5],
      monsters: ["drowned", "bogwitch", "lampman"],
      champion: 0.1,
      boss: "keeper",
      palette: ["#3d3a4a", "#5a5566", "#ffd84a"],
      story: "Half the chapel is under water. The keeper still rings the bell for a service no one attends."
    },
    a1_cliffs: {
      id: "a1_cliffs",
      act: 1,
      name: "Gullwrack Cliffs",
      level: 7,
      packs: 8,
      packSize: [3, 5],
      monsters: ["gull", "crab", "drowned"],
      champion: 0.1,
      palette: ["#8aa0ab", "#7b6d5d", "#e9e4d4"],
      story: "Bone gulls nest on the cliffs. They have learned that the Kindled do not stay dead, and they are patient."
    },
    a1_village: {
      id: "a1_village",
      act: 1,
      name: "Lanternless Village",
      level: 9,
      packs: 8,
      packSize: [3, 5],
      monsters: ["lampman", "drowned", "eel"],
      champion: 0.12,
      palette: ["#26262e", "#3e3a36", "#ff9a2e"],
      story: "Every lamp in the village went out the day the sun did. The villagers are still looking for a light."
    },
    a1_floodgate: {
      id: "a1_floodgate",
      act: 1,
      name: "The Floodgate",
      level: 11,
      packs: 9,
      packSize: [4, 5],
      monsters: ["eel", "bogwitch", "lampman", "crab"],
      champion: 0.14,
      palette: ["#2e4a57", "#4a5f66", "#6fd3ff"],
      story: "The great gate holds the sea back from the inland road. Someone has been opening it, a little every night."
    },
    a1_lock: {
      id: "a1_lock",
      act: 1,
      name: "The Tide-Warden's Lock",
      level: 13,
      packs: 5,
      packSize: [4, 6],
      monsters: ["eel", "drowned", "crab"],
      champion: 0.2,
      boss: "tidewarden",
      palette: ["#1f3b45", "#2c4f58", "#dff7ff"],
      story: "The Tide-Warden was sworn to keep the gate shut. Three hundred years underwater changed what it thinks the oath means.",
      bossText: "The Warden sinks. For the first time in three centuries, the gate stays shut on its own."
    },
    a1_trial: {
      id: "a1_trial",
      act: 1,
      name: "Trial of Salt",
      level: 11,
      packs: 4,
      packSize: [4, 5],
      monsters: ["drowned", "crab", "eel"],
      champion: 0.3,
      boss: "drownedknight",
      trial: true,
      palette: ["#2a3b44", "#8f9a93", "#9ff3ff"],
      story: "Under the chapel is a hall where the drowned order tested its knights. One of them never stopped testing.",
      bossText: "The Drowned Knight kneels and offers you its oath. Your ember takes it."
    },
    // ---- Act 2: the Glass Barrens
    a2_dunes: {
      id: "a2_dunes",
      act: 2,
      name: "The Glass Dunes",
      level: 15,
      packs: 8,
      packSize: [3, 5],
      monsters: ["jackal", "scorpion", "bleached"],
      champion: 0.12,
      palette: ["#f0c77a", "#e7b465", "#ffffff"],
      story: "Beyond the gate the sea gives way to sand, and the sand gives way to glass. The sun fell hot here."
    },
    a2_mirage: {
      id: "a2_mirage",
      act: 2,
      name: "Mirage Road",
      level: 17,
      packs: 8,
      packSize: [3, 5],
      monsters: ["jackal", "wraith", "wasp"],
      champion: 0.12,
      palette: ["#f4d9a0", "#d9a95b", "#7fd1ff"],
      story: "The road shows you towns that are not there. The things living in them are real enough."
    },
    a2_caravan: {
      id: "a2_caravan",
      act: 2,
      name: "The Last Caravan",
      level: 19,
      packs: 7,
      packSize: [4, 5],
      monsters: ["bleached", "wraith", "scorpion"],
      champion: 0.14,
      boss: "sandwright",
      palette: ["#d9a066", "#b3773f", "#fff27a"],
      story: "A caravan still crosses the Barrens, three hundred years late. Its master builds new wagons out of sand and old travellers.",
      bossText: "The Sandwright's wagons fall apart into dunes. The road ahead is clear."
    },
    a2_shards: {
      id: "a2_shards",
      act: 2,
      name: "The Shardfield",
      level: 21,
      packs: 9,
      packSize: [4, 5],
      monsters: ["wasp", "scorpion", "bleached"],
      champion: 0.14,
      palette: ["#bfe6f0", "#9ccfdc", "#ffffff"],
      story: "Here the glass stands up in blades taller than houses. The wind sings through them."
    },
    a2_oasis: {
      id: "a2_oasis",
      act: 2,
      name: "The Dry Oasis",
      level: 23,
      packs: 9,
      packSize: [4, 6],
      monsters: ["jackal", "wraith", "wasp", "bleached"],
      champion: 0.15,
      palette: ["#e8c48a", "#6f8f5a", "#6fd3ff"],
      story: "Pilgrims still kneel at a spring that dried up before their grandparents were born."
    },
    a2_spire: {
      id: "a2_spire",
      act: 2,
      name: "The Prism Spire",
      level: 25,
      packs: 9,
      packSize: [4, 6],
      monsters: ["wasp", "wraith", "scorpion"],
      champion: 0.16,
      palette: ["#a8d8ea", "#7aa9bd", "#ffc233"],
      story: "A tower grown from one crystal. The light inside it moves on its own."
    },
    a2_throne: {
      id: "a2_throne",
      act: 2,
      name: "The Regent's Throne",
      level: 27,
      packs: 6,
      packSize: [4, 6],
      monsters: ["bleached", "wasp", "wraith"],
      champion: 0.22,
      boss: "glassregent",
      palette: ["#8fc9de", "#5e8fa5", "#ffffff"],
      story: "The Regent ruled the Barrens in the sun's name. When the sun died, she simply kept ruling.",
      bossText: "The Regent shatters. In the pieces you can see where the sun came down: north, past the ash."
    },
    a2_trial: {
      id: "a2_trial",
      act: 2,
      name: "Trial of Glass",
      level: 23,
      packs: 4,
      packSize: [4, 6],
      monsters: ["wasp", "scorpion", "bleached"],
      champion: 0.3,
      boss: "mirrorwarden",
      trial: true,
      palette: ["#d0f0fa", "#a0c8d8", "#ff5a36"],
      story: "A maze of mirrors where every reflection fights back. The Warden inside has never seen its own face.",
      bossText: "The Mirror Warden breaks, and for a moment every reflection in the maze bows to you."
    },
    // ---- Act 3: the Sunfall
    a3_ashroad: {
      id: "a3_ashroad",
      act: 3,
      name: "The Ash Road",
      level: 29,
      packs: 9,
      packSize: [4, 5],
      monsters: ["ashwalker", "hound", "cinderbat"],
      champion: 0.15,
      palette: ["#5a5250", "#3f3836", "#ff9a2e"],
      story: "Ash falls like snow here, and never stops. The walkers on the road have been walking since the sun fell."
    },
    a3_emberwood: {
      id: "a3_emberwood",
      act: 3,
      name: "The Emberwood",
      level: 31,
      packs: 9,
      packSize: [4, 6],
      monsters: ["hound", "cinderbat", "sunpriest"],
      champion: 0.15,
      palette: ["#3b2a26", "#5e3a2a", "#ffc233"],
      story: "A forest that has been burning for three hundred years without burning down."
    },
    a3_rim: {
      id: "a3_rim",
      act: 3,
      name: "The Crater Rim",
      level: 33,
      packs: 8,
      packSize: [4, 6],
      monsters: ["magmacrab", "ashwalker", "hound"],
      champion: 0.17,
      boss: "cindermatron",
      palette: ["#6b3a2a", "#8a4a2a", "#ffe066"],
      story: "From the rim you can see it: a wound in the world, glowing. The Matron nests on its edge and raises embers like children.",
      bossText: "The Matron's brood scatters into sparks. The way down into the crater is open."
    },
    a3_molten: {
      id: "a3_molten",
      act: 3,
      name: "The Molten Steps",
      level: 35,
      packs: 10,
      packSize: [4, 6],
      monsters: ["magmacrab", "cinderbat", "sunpriest"],
      champion: 0.17,
      palette: ["#2e1a16", "#7a2e1f", "#ff5a36"],
      story: "Stairs cut into cooling rock lead down. Someone built them, which means someone wanted to go down there."
    },
    a3_bellcourt: {
      id: "a3_bellcourt",
      act: 3,
      name: "The Bell Court",
      level: 37,
      packs: 10,
      packSize: [4, 6],
      monsters: ["sunpriest", "ashwalker", "hound"],
      champion: 0.18,
      boss: "emberjudge",
      palette: ["#3c2f2f", "#6b5a4a", "#ffd84a"],
      story: "The priests of the dead sun hold court here and judge every ember that comes down the steps.",
      bossText: "The Judge's bell cracks. The court is adjourned for good."
    },
    a3_heart: {
      id: "a3_heart",
      act: 3,
      name: "The Heart of the Crater",
      level: 39,
      packs: 10,
      packSize: [5, 6],
      monsters: ["magmacrab", "sunpriest", "cinderbat", "hound"],
      champion: 0.2,
      palette: ["#1c1010", "#5a1f14", "#ffc233"],
      story: "Heat and light and a sound like breathing. Every ember in the March came from here."
    },
    a3_sunfall: {
      id: "a3_sunfall",
      act: 3,
      name: "The Sunfall",
      level: 41,
      packs: 6,
      packSize: [5, 6],
      monsters: ["sunpriest", "ashwalker", "hound"],
      champion: 0.25,
      boss: "lastdawn",
      palette: ["#120c0c", "#3a1a10", "#ffffff"],
      story: "At the bottom lies what is left of the sun. It is not dead. It is waiting for someone to carry it back up.",
      bossText: "The Last Dawn goes quiet in your hands. Past the crater, the Cinderlands stretch on forever. Maps will lead you there."
    },
    a3_trial: {
      id: "a3_trial",
      act: 3,
      name: "Trial of Embers",
      level: 36,
      packs: 4,
      packSize: [5, 6],
      monsters: ["hound", "magmacrab", "ashwalker"],
      champion: 0.3,
      boss: "emberjudge",
      trial: true,
      palette: ["#2a1410", "#6a2a1a", "#ffe066"],
      story: "The priests' old proving ground. Nobody has passed it since the fall.",
      bossText: "The proving fire dies down. Whatever you are becoming, the ember approves."
    }
  };
  var ACTS = [
    {
      id: 1,
      name: "The Drowned Road",
      zones: ["a1_shore", "a1_saltmire", "a1_chapel", "a1_cliffs", "a1_village", "a1_floodgate", "a1_lock"],
      trial: "a1_trial",
      intro: "The road inland starts under the sea.",
      outro: "The gate is shut and the road is dry. Beyond it, the light is wrong: too bright, too white. Glass."
    },
    {
      id: 2,
      name: "The Glass Barrens",
      zones: ["a2_dunes", "a2_mirage", "a2_caravan", "a2_shards", "a2_oasis", "a2_spire", "a2_throne"],
      trial: "a2_trial",
      intro: "Where the sun fell hottest, the desert turned to glass.",
      outro: "The Regent is gone and the Barrens are nobody's now. North, the sky is the colour of ash."
    },
    {
      id: 3,
      name: "The Sunfall",
      zones: ["a3_ashroad", "a3_emberwood", "a3_rim", "a3_molten", "a3_bellcourt", "a3_heart", "a3_sunfall"],
      trial: "a3_trial",
      intro: "The crater where the sun came down. Every ember started here.",
      outro: "You hold what is left of the sun. It is not enough to light the March. Not yet. The Cinderlands wait beyond the crater."
    }
  ];
  var ZONE_ORDER = ACTS.flatMap((a) => a.zones);
  var TRIAL_AFTER = { a1_trial: "a1_chapel", a2_trial: "a2_oasis", a3_trial: "a3_bellcourt" };

  // src/core/data/passives.ts
  var m2 = (stat, kind, value, tags) => tags ? { stat, kind, value, tags } : { stat, kind, value };
  var THEMES = {
    iron: {
      name: "Iron",
      small: [["Iron Skin", [m2("armour", "inc", 12)]], ["Thick Blood", [m2("life", "inc", 5)]]],
      notables: [["Bulwark Oath", [m2("armour", "inc", 30), m2("life", "inc", 8), m2("block", "flat", 3)]], ["Unbroken", [m2("life", "inc", 12), m2("lifeRegenPct", "flat", 1)]]]
    },
    blade: {
      name: "Blade",
      small: [["Honed Edge", [m2("damage", "inc", 10, ["melee"])]], ["Quick Hands", [m2("attackSpeed", "inc", 4)]]],
      notables: [["Butcher's Rhythm", [m2("damage", "inc", 25, ["melee"]), m2("attackSpeed", "inc", 8)]], ["Split Bone", [m2("damage", "inc", 30, ["phys"]), m2("critMulti", "flat", 15)]]]
    },
    ember: {
      name: "Ember",
      small: [["Kindle", [m2("damage", "inc", 12, ["fire"])]], ["Hearth Ward", [m2("res.fire", "flat", 8)]]],
      notables: [["Pyre Heart", [m2("damage", "inc", 30, ["fire"]), m2("pen.fire", "flat", 8)]], ["Cinder Skin", [m2("res.fire", "flat", 20), m2("maxRes.fire", "flat", 3), m2("life", "inc", 6)]]]
    },
    wind: {
      name: "Wind",
      small: [["Light Step", [m2("evasion", "inc", 12)]], ["Fleet", [m2("moveSpeed", "inc", 3)]]],
      notables: [["Gale Dancer", [m2("evasion", "inc", 35), m2("moveSpeed", "inc", 6)]], ["Afterimage", [m2("evasion", "inc", 25), m2("block", "flat", 4), m2("life", "inc", 6)]]]
    },
    arrow: {
      name: "Arrow",
      small: [["Fletching", [m2("damage", "inc", 10, ["projectile"])]], ["Keen Sight", [m2("critChance", "inc", 12)]]],
      notables: [["Deadeye", [m2("critChance", "inc", 40), m2("critMulti", "flat", 20)]], ["Barbed Volley", [m2("damage", "inc", 25, ["projectile"]), m2("pierce", "flat", 1)]]]
    },
    storm: {
      name: "Storm",
      small: [["Static", [m2("damage", "inc", 12, ["lightning"])]], ["Grounding", [m2("res.lightning", "flat", 8)]]],
      notables: [["Thunderhead", [m2("damage", "inc", 30, ["lightning"]), m2("pen.lightning", "flat", 8)]], ["Rod of the Squall", [m2("res.lightning", "flat", 20), m2("maxRes.lightning", "flat", 3), m2("attackSpeed", "inc", 5)]]]
    },
    aegis: {
      name: "Aegis",
      small: [["Shimmer", [m2("energyShield", "inc", 12)]], ["Focus", [m2("mana", "inc", 6)]]],
      notables: [["Mirror Mind", [m2("energyShield", "inc", 35), m2("mana", "inc", 10)]], ["Still Water", [m2("energyShield", "inc", 25), m2("manaRegen", "flat", 4), m2("life", "inc", 5)]]]
    },
    sorcery: {
      name: "Sorcery",
      small: [["Chant", [m2("damage", "inc", 10, ["spell"])]], ["Swift Words", [m2("castSpeed", "inc", 4)]]],
      notables: [["Grand Litany", [m2("damage", "inc", 28, ["spell"]), m2("castSpeed", "inc", 8)]], ["Fateweaver", [m2("critChance", "inc", 45, ["spell"]), m2("critMulti", "flat", 15)]]]
    },
    frost: {
      name: "Frost",
      small: [["Chill", [m2("damage", "inc", 12, ["cold"])]], ["Tide Ward", [m2("res.cold", "flat", 8)]]],
      notables: [["Heart of Winter", [m2("damage", "inc", 30, ["cold"]), m2("pen.cold", "flat", 8)]], ["Rime Coat", [m2("res.cold", "flat", 20), m2("maxRes.cold", "flat", 3), m2("energyShield", "inc", 8)]]]
    }
  };
  var TREE_CLASSES = [
    { cls: "vanguard", angle: -90, branches: [THEMES.iron, THEMES.blade, THEMES.ember] },
    { cls: "strider", angle: 30, branches: [THEMES.wind, THEMES.arrow, THEMES.storm] },
    { cls: "arcanist", angle: 150, branches: [THEMES.aegis, THEMES.sorcery, THEMES.frost] }
  ];
  var RING_MODS = [
    ["Vigour", [m2("life", "flat", 15), m2("life", "inc", 3)]],
    ["Prism", [m2("res.fire", "flat", 5), m2("res.cold", "flat", 5), m2("res.lightning", "flat", 5)]],
    ["Might", [m2("str", "flat", 10)]],
    ["Grace", [m2("dex", "flat", 10)]],
    ["Wit", [m2("int", "flat", 10)]],
    ["Ferocity", [m2("damage", "inc", 8)]]
  ];
  var KEYSTONES = [
    ["Glass Oath", [m2("damage", "more", 35), m2("life", "more", -30)], "Hit much harder. Break much easier."],
    ["Iron Vow", [m2("armour", "more", 60), m2("evasion", "more", -100), m2("attackSpeed", "more", -8)], "Armour swells; you no longer dodge."],
    ["Ember Blood", [m2("lifeRegenPct", "flat", 3), m2("res.fire", "flat", -30), m2("life", "more", 15)], "Burn hot and heal fast; fire hurts more."]
  ];
  var rad = (deg) => deg * Math.PI / 180;
  var polar = (r3, deg) => [Math.round(r3 * Math.cos(rad(deg))), Math.round(r3 * Math.sin(rad(deg)))];
  function build2() {
    const nodes = {};
    const add = (n) => {
      if (nodes[n.id]) throw new Error("dup node " + n.id);
      nodes[n.id] = { ...n, links: [] };
      return n.id;
    };
    const link = (a, b) => {
      nodes[a].links.push(b);
      nodes[b].links.push(a);
    };
    const RING = 18, R_RING = 130;
    const ring2 = [];
    for (let i = 0; i < RING; i++) {
      const [name, mods] = RING_MODS[i % RING_MODS.length];
      const [x, y] = polar(R_RING, -90 + 360 / RING * i);
      ring2.push(add({ id: `ring${i}`, name, kind: "ring", x, y, mods }));
    }
    ring2.forEach((id, i) => link(id, ring2[(i + 1) % RING]));
    const branchEnds = {};
    for (const c of TREE_CLASSES) {
      const [sx, sy] = polar(260, c.angle);
      const start = add({ id: `start_${c.cls}`, name: "Ember Seat", kind: "start", x: sx, y: sy, mods: [], cls: c.cls });
      let prev = start;
      for (let k = 0; k < 2; k++) {
        const [x, y] = polar(220 - 40 * (k + 1), c.angle);
        const id = add({ id: `${c.cls}_in${k}`, name: "Path of Embers", kind: "small", x, y, mods: [m2("life", "flat", 8)] });
        link(prev, id);
        prev = id;
      }
      const ringIdx = Math.round(((c.angle + 90) % 360 + 360) % 360 / (360 / RING)) % RING;
      link(prev, ring2[ringIdx]);
      branchEnds[c.cls] = [];
      c.branches.forEach((theme, b) => {
        const ang = c.angle + (b - 1) * 34;
        const path = [];
        let p = start;
        for (let k = 0; k < 9; k++) {
          const r3 = 320 + k * 58;
          const bend = ang + (b - 1) * k * 1.5;
          const [x, y] = polar(r3, bend);
          const notable = k === 4 || k === 8;
          const [name, mods] = notable ? theme.notables[k === 4 ? 0 : 1] : theme.small[k % 2];
          const id = add({ id: `${c.cls}_b${b}_${k}`, name, kind: notable ? "notable" : "small", x, y, mods });
          link(p, id);
          p = id;
          path.push(id);
        }
        branchEnds[c.cls].push(path);
      });
    }
    TREE_CLASSES.forEach((c, i) => {
      const next = TREE_CLASSES[(i + 1) % TREE_CLASSES.length];
      const from = branchEnds[c.cls][2][2], to = branchEnds[next.cls][0][2];
      const mid = c.angle + 60;
      let p = from;
      const bridge = [];
      for (let k = 0; k < 5; k++) {
        const [x, y] = polar(470, mid - 20 + k * 10);
        const [name2, mods2] = RING_MODS[(i * 5 + k) % RING_MODS.length];
        const id = add({ id: `bridge${i}_${k}`, name: name2, kind: "small", x, y, mods: mods2 });
        link(p, id);
        p = id;
        bridge.push(id);
      }
      link(p, to);
      const [name, mods] = KEYSTONES[i];
      const [kx0, ky0] = polar(580, mid);
      const pre = add({ id: `ks${i}_path`, name: "Threshold", kind: "small", x: kx0, y: ky0, mods: [m2("damage", "inc", 6)] });
      link(bridge[2], pre);
      const [kx, ky] = polar(680, mid);
      link(pre, add({ id: `keystone${i}`, name, kind: "keystone", x: kx, y: ky, mods }));
    });
    return nodes;
  }
  var PASSIVES = build2();
  var KEYSTONE_TEXT = Object.fromEntries(KEYSTONES.map(([n, , t]) => [n, t]));
  function passivePoints(level, bonus) {
    return level - 1 + bonus;
  }

  // src/core/data/currency.ts
  var list2 = [
    { id: "kindling", name: "Kindling", blurb: "Turns a plain item enchanted.", cost: 5, drop: 1e3, color: "#ff9a2e" },
    { id: "reshaper", name: "Reshaper", blurb: "Rerolls the affixes of an enchanted item.", cost: 8, drop: 900, color: "#5aa9ff" },
    { id: "graft", name: "Graft", blurb: "Adds an affix to an enchanted item with room for one.", cost: 12, drop: 500, color: "#3fbf5f" },
    { id: "crownseal", name: "Crown Seal", blurb: "Raises an enchanted item to rare and adds an affix.", cost: 40, drop: 200, color: "#ffd23f" },
    { id: "forgeheart", name: "Forgeheart", blurb: "Turns a plain item rare.", cost: 60, drop: 150, color: "#ff5a36" },
    { id: "tempest", name: "Tempest Shard", blurb: "Rerolls every affix of a rare item.", cost: 50, drop: 160, color: "#7fd1ff" },
    { id: "starfall", name: "Starfall", blurb: "Adds an affix to a rare item with room for one.", cost: 180, drop: 25, color: "#fff27a" },
    { id: "salt", name: "Salt of Undoing", blurb: "Strips every affix; the item becomes plain.", cost: 10, drop: 400, color: "#e9e4d4" },
    { id: "unmaker", name: "Unmaker", blurb: "Removes one random affix.", cost: 70, drop: 90, color: "#8b5cf6" },
    { id: "temper", name: "Temper Oil", blurb: "Rerolls the numbers, keeps the affixes.", cost: 30, drop: 250, color: "#c9a26b" }
  ];
  var CURRENCIES = Object.fromEntries(list2.map((c) => [c.id, c]));
  var CURRENCY_ORDER = list2.map((c) => c.id);

  // src/core/data/relics.ts
  var r2 = (stat, kind, range, text, tags) => tags ? { stat, kind, range, text, tags } : { stat, kind, range, text };
  var list3 = [
    {
      id: "tidebreaker",
      name: "The Tide's Refusal",
      base: "greatsword3",
      level: 16,
      weight: 100,
      flavour: "It was forged to hold the sea back. It still tries.",
      mods: [r2("local.physInc", "inc", [120, 160], "{0}% increased physical damage"), r2("res.cold", "flat", [20, 30], "+{0}% cold resistance"), r2("life", "flat", [40, 60], "+{0} to maximum life")]
    },
    {
      id: "lampwick",
      name: "Lampwick",
      base: "wand2",
      level: 8,
      weight: 100,
      flavour: "Still warm. Still waiting for someone to come home.",
      mods: [r2("damage", "inc", [40, 60], "{0}% increased spell damage", ["spell"]), r2("addMin.fire", "flat", [3, 5], "Adds {0} min fire damage to spells", ["spell"]), r2("addMax.fire", "flat", [9, 14], "Adds {0} max fire damage to spells", ["spell"]), r2("manaRegen", "flat", [3, 5], "{0} mana regenerated per second")]
    },
    {
      id: "gullfeather",
      name: "Gullfeather Stride",
      base: "leather_boots2",
      level: 8,
      weight: 100,
      flavour: "The gulls never land. Now neither do you.",
      mods: [r2("moveSpeed", "inc", [25, 35], "{0}% increased movement speed"), r2("local.evasion", "flat", [60, 90], "+{0} to evasion"), r2("dex", "flat", [15, 25], "+{0} to Grace")]
    },
    {
      id: "chapelbell",
      name: "The Keeper's Bell",
      base: "amulet_life",
      level: 12,
      weight: 80,
      flavour: "Rings for a service no one attends.",
      mods: [r2("life", "inc", [8, 12], "{0}% increased maximum life"), r2("lifeRegenPct", "flat", [1, 2], "Regenerate {0}% of life per second"), r2("res.chaos", "flat", [15, 25], "+{0}% chaos resistance")]
    },
    {
      id: "saltcrown",
      name: "Saltcrown",
      base: "plate_helmet3",
      level: 16,
      weight: 90,
      flavour: "Heavy with the sea. Heavier with the oath.",
      mods: [r2("local.defInc", "inc", [80, 120], "{0}% increased armour"), r2("res.fire", "flat", [15, 25], "+{0}% fire resistance"), r2("res.cold", "flat", [15, 25], "+{0}% cold resistance"), r2("res.lightning", "flat", [15, 25], "+{0}% lightning resistance")]
    },
    {
      id: "emberknot",
      name: "Emberknot",
      base: "ring_ember",
      level: 20,
      weight: 80,
      flavour: "Two coals that never quite touch.",
      mods: [r2("damage", "inc", [20, 30], "{0}% increased fire damage", ["fire"]), r2("convert.fire", "flat", [20, 30], "{0}% of physical damage converted to fire"), r2("res.cold", "flat", [-20, -10], "{0}% cold resistance")]
    },
    {
      id: "lastlight",
      name: "Last Light",
      base: "dagger8",
      level: 74,
      weight: 30,
      flavour: "The final ray of the March's sun, sharpened.",
      mods: [r2("local.physInc", "inc", [180, 240], "{0}% increased physical damage"), r2("local.critChance", "inc", [40, 60], "{0}% increased critical chance"), r2("critMulti", "flat", [30, 45], "+{0}% critical multiplier"), r2("leech", "flat", [2, 3], "{0}% of damage leeched as life")]
    },
    {
      id: "hollowheart",
      name: "Hollow Heart",
      base: "silk_body5",
      level: 38,
      weight: 60,
      flavour: "There is nothing in it. That is the point.",
      mods: [r2("local.defInc", "inc", [150, 200], "{0}% increased energy shield"), r2("energyShield", "inc", [10, 15], "{0}% increased maximum energy shield"), r2("life", "more", [-20, -20], "{0}% less maximum life")]
    },
    {
      id: "stormstring",
      name: "Stormstring",
      base: "bow4",
      level: 26,
      weight: 70,
      flavour: "It hums before the storm does.",
      mods: [r2("local.addMin.lightning", "flat", [2, 4], "Adds {0} min lightning damage"), r2("local.addMax.lightning", "flat", [60, 80], "Adds {0} max lightning damage"), r2("local.attackSpeed", "inc", [10, 15], "{0}% increased attack speed"), r2("pierce", "flat", [1, 1], "Projectiles pierce {0} more enemy")]
    },
    {
      id: "wardenseye",
      name: "Warden's Eye",
      base: "focus_offhand4",
      level: 26,
      weight: 70,
      flavour: "It watched the gate for three hundred years and never blinked.",
      mods: [r2("castSpeed", "inc", [12, 18], "{0}% increased cast speed"), r2("damage", "inc", [30, 40], "{0}% increased cold damage", ["cold"]), r2("pen.cold", "flat", [10, 15], "Hits ignore {0}% cold resistance")]
    }
  ];
  var RELICS = Object.fromEntries(list3.map((x) => [x.id, x]));

  // src/core/data/ascendancies.ts
  var m3 = (stat, kind, value, tags) => tags ? { stat, kind, value, tags } : { stat, kind, value };
  var list4 = [
    {
      id: "bastion",
      cls: "vanguard",
      name: "Bastion",
      color: "#9aa4b2",
      blurb: "The wall that walks. Hard to hurt, harder to kill.",
      nodes: [
        { id: "bastion_1", name: "Shield Wall", mods: [m3("block", "flat", 8), m3("armour", "inc", 30)] },
        { id: "bastion_2", name: "Oathbound", mods: [m3("life", "inc", 12)] },
        { id: "bastion_3", name: "Tidebreaker", mods: [m3("dmgTaken", "more", -10)] },
        { id: "bastion_4", name: "Salt in the Wound", mods: [m3("lifeRegenPct", "flat", 2)] },
        { id: "bastion_5", name: "Iron Answer", mods: [m3("damage", "more", 12), m3("armour", "more", 15)] },
        { id: "bastion_6", name: "Unmoved", mods: [m3("maxRes.fire", "flat", 3), m3("maxRes.cold", "flat", 3), m3("maxRes.lightning", "flat", 3)] }
      ]
    },
    {
      id: "reaver",
      cls: "vanguard",
      name: "Reaver",
      color: "#e2543b",
      blurb: "The ember wants blood. Give it some.",
      nodes: [
        { id: "reaver_1", name: "Red Harvest", mods: [m3("damage", "more", 15, ["melee"])] },
        { id: "reaver_2", name: "Thirst", mods: [m3("leech", "flat", 2), m3("lifeOnKill", "flat", 20)] },
        { id: "reaver_3", name: "Frenzy", mods: [m3("attackSpeed", "more", 12)] },
        { id: "reaver_4", name: "Executioner", mods: [m3("critChance", "inc", 60), m3("critMulti", "flat", 30)] },
        { id: "reaver_5", name: "Wide Butchery", mods: [m3("area", "inc", 35)] },
        { id: "reaver_6", name: "Blood for Ember", mods: [m3("damage", "more", 10), m3("life", "inc", 8)] }
      ]
    },
    {
      id: "windrunner",
      cls: "strider",
      name: "Windrunner",
      color: "#19b3a3",
      blurb: "Never where the blow lands.",
      nodes: [
        { id: "windrunner_1", name: "Slipstream", mods: [m3("evasion", "more", 25)] },
        { id: "windrunner_2", name: "Long Road", mods: [m3("moveSpeed", "inc", 20), m3("flaskCharges", "inc", 30)] },
        { id: "windrunner_3", name: "Arrowstorm", mods: [m3("damage", "more", 15, ["projectile"])] },
        { id: "windrunner_4", name: "Through and Through", mods: [m3("pierce", "flat", 2)] },
        { id: "windrunner_5", name: "Tailwind", mods: [m3("attackSpeed", "more", 10), m3("castSpeed", "more", 10)] },
        { id: "windrunner_6", name: "Gone", mods: [m3("block", "flat", 10), m3("life", "inc", 8)] }
      ]
    },
    {
      id: "stormcaller",
      cls: "strider",
      name: "Stormcaller",
      color: "#e0b800",
      blurb: "Carries the squall in a quiver.",
      nodes: [
        { id: "stormcaller_1", name: "Charged Air", mods: [m3("damage", "more", 18, ["lightning"])] },
        { id: "stormcaller_2", name: "Grounded", mods: [m3("res.lightning", "flat", 30), m3("maxRes.lightning", "flat", 5)] },
        { id: "stormcaller_3", name: "Split the Sky", mods: [m3("pen.lightning", "flat", 20)] },
        { id: "stormcaller_4", name: "Static Eye", mods: [m3("critChance", "inc", 70)] },
        { id: "stormcaller_5", name: "Thunderclap", mods: [m3("critMulti", "flat", 40)] },
        { id: "stormcaller_6", name: "Stormborn", mods: [m3("convert.lightning", "flat", 30), m3("damage", "more", 8)] }
      ]
    },
    {
      id: "lumen",
      cls: "arcanist",
      name: "Lumen",
      color: "#b9a4ff",
      blurb: "A lamp that learned to fight.",
      nodes: [
        { id: "lumen_1", name: "Halo", mods: [m3("energyShield", "more", 25)] },
        { id: "lumen_2", name: "Clear Mind", mods: [m3("manaRegen", "flat", 10), m3("manaCost", "inc", -20)] },
        { id: "lumen_3", name: "Litany of Light", mods: [m3("damage", "more", 15, ["spell"])] },
        { id: "lumen_4", name: "Quick Tongue", mods: [m3("castSpeed", "more", 12)] },
        { id: "lumen_5", name: "Radiance", mods: [m3("area", "inc", 30), m3("pierce", "flat", 1)] },
        { id: "lumen_6", name: "Undimmed", mods: [m3("dmgTaken", "more", -8), m3("energyShield", "inc", 20)] }
      ]
    },
    {
      id: "hexwright",
      cls: "arcanist",
      name: "Hexwright",
      color: "#8b5cf6",
      blurb: "Writes curses into the ember's margins.",
      nodes: [
        { id: "hexwright_1", name: "Blight Script", mods: [m3("damage", "more", 20, ["chaos"])] },
        { id: "hexwright_2", name: "Rime Script", mods: [m3("damage", "more", 15, ["cold"]), m3("pen.cold", "flat", 10)] },
        { id: "hexwright_3", name: "Hollow Ward", mods: [m3("res.chaos", "flat", 40)] },
        { id: "hexwright_4", name: "Unravel", mods: [m3("pen.fire", "flat", 12), m3("pen.lightning", "flat", 12), m3("pen.chaos", "flat", 12)] },
        { id: "hexwright_5", name: "Marked for Ruin", mods: [m3("critChance", "inc", 50), m3("damage", "more", 8)] },
        { id: "hexwright_6", name: "Last Word", mods: [m3("damage", "more", 12, ["spell"]), m3("life", "inc", 8)] }
      ]
    }
  ];
  var ASCENDANCIES = Object.fromEntries(list4.map((a) => [a.id, a]));
  var ASC_NODES = Object.fromEntries(list4.flatMap((a) => a.nodes.map((n) => [n.id, { ...n, asc: a.id }])));

  // src/core/data/maps.ts
  var MAX_TIER = 16;
  var MAP_BOSS_LIFE = 0.6;
  var MAP_BOSS_DAMAGE = 0.8;
  function mapLevel(tier) {
    return tier <= MAX_TIER ? 42 + tier * 2 : 74 + (tier - MAX_TIER);
  }
  function depthMult(tier) {
    return tier <= MAX_TIER ? 1 : Math.pow(1.06, tier - MAX_TIER);
  }
  var tierName = (tier) => tier === 0 ? "Outskirts" : tier <= MAX_TIER ? `Tier ${tier}` : `Depth ${tier - MAX_TIER}`;
  var MAP_AREAS = Object.fromEntries([
    ["cinderfield", "Cinderfield", ["ashwalker", "hound", "cinderbat"], "cindermatron", ["#4a3a36", "#6a4a3a", "#ffb35c"]],
    ["saltflats", "Salt Flats", ["crab", "scorpion", "bleached"], "sandwright", ["#d9d2c3", "#bfb5a0", "#ffffff"]],
    ["drownedspire", "Drowned Spire", ["drowned", "eel", "bogwitch"], "tidewarden", ["#1f3b45", "#335866", "#9ff3ff"]],
    ["glassmaze", "Glass Maze", ["wasp", "scorpion", "wraith"], "mirrorwarden", ["#b8e6f5", "#86b7c7", "#ff5a36"]],
    ["lanternrow", "Lantern Row", ["lampman", "drowned", "sunpriest"], "keeper", ["#26262e", "#3e3a36", "#ffd84a"]],
    ["bonecoast", "Bone Coast", ["gull", "crab", "drowned"], "drownedknight", ["#8aa0ab", "#cfc6b0", "#e9e4d4"]],
    ["ashcathedral", "Ash Cathedral", ["sunpriest", "ashwalker", "wraith"], "emberjudge", ["#2b2233", "#5b4a4a", "#ffc233"]],
    ["moltenweir", "Molten Weir", ["magmacrab", "hound", "eel"], "cindermatron", ["#2e1a16", "#7a2e1f", "#ff5a36"]],
    ["mirrorsea", "Mirror Sea", ["eel", "wasp", "jackal"], "glassregent", ["#6fb3cf", "#4d8aa3", "#ffffff"]],
    ["sunscar", "The Sunscar", ["hound", "sunpriest", "magmacrab", "cinderbat"], "lastdawn", ["#120c0c", "#3a1a10", "#ffe066"]]
  ].map(([id, name, monsters, boss, palette]) => [id, { id, name, monsters, boss, palette }]));
  var list5 = [
    { id: "hardy", text: "Monsters have 40% more life", life: 40, qty: 8, rarity: 10 },
    { id: "savage", text: "Monsters deal 30% more damage", damage: 30, qty: 8, rarity: 12 },
    { id: "frenzied", text: "Monsters attack 20% faster", speed: 20, qty: 7, rarity: 8 },
    { id: "searing", text: "Monsters deal 40% extra damage as fire", extra: ["fire", 0.4], qty: 7, rarity: 10 },
    { id: "freezing", text: "Monsters deal 40% extra damage as cold", extra: ["cold", 0.4], qty: 7, rarity: 10 },
    { id: "shocking", text: "Monsters deal 40% extra damage as lightning", extra: ["lightning", 0.4], qty: 7, rarity: 10 },
    { id: "rotting", text: "Monsters deal 25% extra damage as chaos", extra: ["chaos", 0.25], qty: 8, rarity: 10 },
    { id: "crowded", text: "40% more monster packs", packs: 40, qty: 12, rarity: 6 },
    { id: "parched", text: "You regenerate 60% less life", hero: [{ stat: "lifeRegen", kind: "more", value: -60 }, { stat: "lifeRegenPct", kind: "more", value: -60 }], qty: 6, rarity: 8 },
    { id: "exposed", text: "-12% to all maximum resistances", hero: ["fire", "cold", "lightning"].map((t) => ({ stat: `maxRes.${t}`, kind: "flat", value: -12 })), qty: 10, rarity: 12 },
    { id: "brittle", text: "You take 15% more damage", hero: [{ stat: "dmgTaken", kind: "more", value: 15 }], qty: 9, rarity: 10 },
    { id: "dulled", text: "You deal 15% less damage", hero: [{ stat: "damage", kind: "more", value: -15 }], qty: 9, rarity: 10 }
  ];
  var MAP_MODS = Object.fromEntries(list5.map((m4) => [m4.id, m4]));
  var emptyAtlas = () => ({ mapDrop: 0, quantity: 0, rarity: 0, currency: 0, packs: 0, xp: 0, modEffect: 0, fragments: 0, upgrade: 0, bossRelic: 0 });
  var ATLAS = Object.fromEntries([
    ["a_cart", "Cartographer", "20% increased map drop chance", { mapDrop: 20 }, []],
    ["a_cart2", "Surveyor", "25% increased map drop chance", { mapDrop: 25 }, ["a_cart"]],
    ["a_climb", "Ladder of Ash", "10% chance for dropped maps to be a tier higher", { upgrade: 10 }, ["a_cart"]],
    ["a_climb2", "Stair of Stars", "15% chance for dropped maps to be a tier higher", { upgrade: 15 }, ["a_climb"]],
    ["a_qty", "Plunder", "10% increased item quantity in maps", { quantity: 10 }, []],
    ["a_qty2", "Hoard", "15% increased item quantity in maps", { quantity: 15 }, ["a_qty"]],
    ["a_rar", "Gilded Paths", "25% increased item rarity in maps", { rarity: 25 }, ["a_qty"]],
    ["a_rar2", "Crowned Paths", "35% increased item rarity in maps", { rarity: 35 }, ["a_rar"]],
    ["a_cur", "Emberfall", "30% increased currency drops in maps", { currency: 30 }, ["a_qty"]],
    ["a_cur2", "Starfall Veins", "40% increased currency drops in maps", { currency: 40 }, ["a_cur"]],
    ["a_packs", "Teeming", "15% more monster packs in maps", { packs: 15 }, []],
    ["a_xp", "Hard Lessons", "15% increased experience in maps", { xp: 15 }, ["a_packs"]],
    ["a_xp2", "Harder Lessons", "20% increased experience in maps", { xp: 20 }, ["a_xp"]],
    ["a_mods", "Dangerous Ground", "30% increased rewards from map mods", { modEffect: 30 }, ["a_packs"]],
    ["a_mods2", "Deadly Ground", "40% increased rewards from map mods", { modEffect: 40 }, ["a_mods"]],
    ["a_frag", "Sigil Seeker", "40% increased sigil drop chance", { fragments: 40 }, ["a_mods"]],
    ["a_frag2", "Sigil Hunter", "60% increased sigil drop chance", { fragments: 60 }, ["a_frag"]],
    ["a_boss", "Relic Hunter", "Map bosses have a 6% chance to drop a relic", { bossRelic: 6 }, ["a_rar"]]
  ].map(([id, name, text, eff, requires]) => [id, { id, name, text, eff, requires }]));
  var PINNACLES = Object.fromEntries([
    ["drownedsun", "The Drowned Sun", "p_drownedsun", "tide_sigil", "Tide Sigil", 3, 80, 6, ["#0f2a33", "#1f4a55", "#ffe066"], "A second sun rose from the sea and never learned to shine."],
    ["glasschoir", "The Glass Choir", "p_glasschoir", "prism_sigil", "Prism Sigil", 3, 84, 10, ["#a8e6f5", "#6fa3b8", "#ffffff"], "A thousand shards singing one note. The note is your name."],
    ["ashenking", "The Ashen King", "p_ashenking", "ash_sigil", "Ash Sigil", 3, 88, 14, ["#1c1414", "#4a2a20", "#ff5a36"], "He was crowned the day the sun fell and has ruled the ash since."],
    ["hollowcrown", "The Hollow Crown", "p_hollowcrown", "hollow_sigil", "Hollow Sigil", 4, 96, 18, ["#0a0a0f", "#2a2233", "#b9a4ff"], "At the bottom of the Depths, the thing that ate the sun's light waits to be fed again."]
  ].map(([id, name, boss, sigil, sigilName, cost, level, minTier, palette, text]) => [id, { id, name, boss, sigil, sigilName, cost, level, minTier, palette, text }]));

  // src/core/stats.ts
  var StatBag = class _StatBag {
    by = /* @__PURE__ */ new Map();
    constructor(mods = []) {
      for (const m4 of mods) this.add(m4);
    }
    add(m4) {
      let list6 = this.by.get(m4.stat);
      if (!list6) this.by.set(m4.stat, list6 = []);
      list6.push(m4);
    }
    addAll(mods) {
      for (const m4 of mods) this.add(m4);
    }
    /** Every modifier for a stat (for breakdowns). */
    mods(stat) {
      return this.by.get(stat) ?? [];
    }
    static applies(m4, ctx) {
      if (!m4.tags || m4.tags.length === 0) return true;
      if (!ctx) return false;
      for (const t of m4.tags) if (!ctx.has(t)) return false;
      return true;
    }
    /** Sum of flat or inc values. */
    sum(stat, kind, ctx) {
      let s = 0;
      for (const m4 of this.by.get(stat) ?? []) if (m4.kind === kind && _StatBag.applies(m4, ctx)) s += m4.value;
      return s;
    }
    /** Product of (1 + more/100). */
    more(stat, ctx) {
      let p = 1;
      for (const m4 of this.by.get(stat) ?? []) if (m4.kind === "more" && _StatBag.applies(m4, ctx)) p *= 1 + m4.value / 100;
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

  // src/core/items.ts
  var MAX_AFFIXES = {
    plain: { prefix: 0, suffix: 0 },
    enchanted: { prefix: 1, suffix: 1 },
    rare: { prefix: 3, suffix: 3 },
    relic: { prefix: 0, suffix: 0 }
  };
  function baseOf(item) {
    const b = BASES[item.base];
    if (!b) throw new Error("unknown base " + item.base);
    return b;
  }
  function domainsOf(b) {
    const d = /* @__PURE__ */ new Set([b.slot, b.kind]);
    if (b.weapon) {
      d.add("weapon");
      d.add(b.weapon.ranged ? "ranged" : "melee");
      if (b.kind === "staff" || b.kind === "wand") d.add("caster");
    }
    if (b.defence) {
      if (b.defence.armour) d.add("ar");
      if (b.defence.evasion) d.add("ev");
      if (b.defence.energyShield) d.add("es");
    }
    return d;
  }
  function affixOf(a) {
    const def2 = AFFIXES[a.id];
    if (!def2) throw new Error("unknown affix " + a.id);
    return def2;
  }
  function countAffixes(item) {
    let prefix = 0, suffix = 0;
    for (const a of item.affixes) affixOf(a).type === "prefix" ? prefix++ : suffix++;
    return { prefix, suffix };
  }
  function eligibleAffixes(item, type) {
    const b = baseOf(item);
    const dom = domainsOf(b);
    const counts = countAffixes(item);
    const max = MAX_AFFIXES[item.rarity];
    const groups = new Set(item.affixes.map((a) => affixOf(a).group));
    return Object.values(AFFIXES).filter((a) => (!type || a.type === type) && counts[a.type] < max[a.type] && !groups.has(a.group) && a.tiers[0].ilvl <= item.ilvl && a.domains.some((x) => dom.has(x)));
  }
  function rollTier(rng, def2, ilvl) {
    const allowed = def2.tiers.map((t, i) => ({ t, i })).filter((x) => x.t.ilvl <= ilvl);
    const pick = rng.weighted(allowed, (x) => Math.pow(0.62, x.i)) ?? allowed[0];
    return { id: def2.id, tier: pick.i, rolls: pick.t.ranges.map(([lo, hi]) => rng.int(lo, hi)) };
  }
  function addRandomAffix(rng, item, type) {
    const pool = eligibleAffixes(item, type);
    const def2 = rng.weighted(pool, (a) => a.weight);
    if (!def2) return false;
    item.affixes.push(rollTier(rng, def2, item.ilvl));
    return true;
  }
  function rareName(rng) {
    return `${rng.pick(RARE_NAMES_A)} ${rng.pick(RARE_NAMES_B)}`;
  }
  function rollAffixes(rng, item) {
    item.affixes = [];
    if (item.rarity === "enchanted") {
      const n = rng.chance(0.55) ? 2 : 1;
      if (n === 2) {
        addRandomAffix(rng, item, "prefix");
        addRandomAffix(rng, item, "suffix");
      } else addRandomAffix(rng, item);
    } else if (item.rarity === "rare") {
      const n = rng.weighted([3, 4, 5, 6], (x) => [30, 40, 20, 10][x - 3]);
      for (let i = 0; i < n; i++) addRandomAffix(rng, item);
      item.name = rareName(rng);
    }
  }
  function pickRarity(rng, bonus = 0) {
    const m4 = 1 + bonus / 100;
    const rare = 0.08 * m4, ench = 0.35 * Math.sqrt(m4);
    const r3 = rng.next();
    if (r3 < rare) return "rare";
    if (r3 < rare + ench) return "enchanted";
    return "plain";
  }
  function pickBase(rng, ilvl, slots, maxBaseLevel = ilvl) {
    const pool = Object.values(BASES).filter((b2) => b2.level <= Math.min(ilvl, maxBaseLevel) && (!slots || slots.includes(b2.slot)));
    const b = rng.weighted(pool, (x) => (x.slot === "weapon" ? 0.7 : 1) * (ilvl - x.level < 14 ? 3 : 1));
    if (!b) throw new Error("no base for ilvl " + ilvl);
    return b;
  }
  function rollItem(rng, uid, ilvl, opts = {}) {
    const base = opts.base ? BASES[opts.base] : pickBase(rng, ilvl, opts.slots, opts.maxBaseLevel);
    if (!base) throw new Error("unknown base " + opts.base);
    const item = { uid, base: base.id, ilvl, rarity: opts.rarity ?? pickRarity(rng, opts.rarityBonus), affixes: [] };
    rollAffixes(rng, item);
    return item;
  }
  function relicOf(item) {
    return item.relic ? RELICS[item.relic] : void 0;
  }
  function rollRelic(rng, uid, ilvl) {
    const pool = Object.values(RELICS).filter((r3) => r3.level <= ilvl);
    const def2 = rng.weighted(pool, (r3) => r3.weight);
    if (!def2) return null;
    return { uid, base: def2.base, ilvl, rarity: "relic", affixes: [], relic: def2.id, relicRolls: def2.mods.map((m4) => rng.int(m4.range[0], m4.range[1])) };
  }
  function relicLines(item) {
    const def2 = relicOf(item);
    if (!def2) return [];
    return def2.mods.map((m4, i) => m4.text.replace("{0}", String(item.relicRolls?.[i] ?? m4.range[0])));
  }
  function rawMods(item) {
    const out = [];
    const b = baseOf(item);
    const src = itemLabel(item);
    for (const m4 of b.implicit ?? []) out.push({ ...m4, src });
    const relic = item.relic ? RELICS[item.relic] : void 0;
    if (relic) relic.mods.forEach((m4, i) => {
      const mod = { stat: m4.stat, kind: m4.kind, value: item.relicRolls?.[i] ?? m4.range[0], src };
      if (m4.tags) mod.tags = m4.tags;
      out.push(mod);
    });
    for (const a of item.affixes) {
      const def2 = affixOf(a);
      def2.mods.forEach((m4, i) => {
        const mod = { stat: m4.stat, kind: m4.kind, value: a.rolls[i] ?? 0, src };
        if (m4.tags) mod.tags = m4.tags;
        out.push(mod);
      });
    }
    return out;
  }
  function itemStats(item) {
    const b = baseOf(item);
    const mods = rawMods(item);
    const local = (stat) => mods.filter((m4) => m4.stat === stat).reduce((s, m4) => s + m4.value, 0);
    const out = { global: mods.filter((m4) => !m4.stat.startsWith("local.")) };
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
    if (item.relic) return RELICS[item.relic]?.name ?? b.name;
    if (item.rarity === "rare" && item.name) return item.name;
    if (item.rarity === "enchanted") {
      const p = item.affixes.find((a) => affixOf(a).type === "prefix");
      const s = item.affixes.find((a) => affixOf(a).type === "suffix");
      return [p ? affixOf(p).label : "", b.name, s ? affixOf(s).label : ""].filter(Boolean).join(" ");
    }
    return b.name;
  }
  function affixText(a) {
    const def2 = affixOf(a);
    return def2.text.replace(/\{(\d)\}/g, (_, i) => String(a.rolls[+i] ?? "?"));
  }
  function tierLabel(a) {
    return affixOf(a).tiers.length - a.tier;
  }
  function salvageValue(item) {
    const r3 = item.crafted ? 1 : { plain: 1, enchanted: 3, rare: 8, relic: 20 }[item.rarity];
    return Math.max(1, Math.round(r3 * (1 + item.ilvl / 10)));
  }
  function levelReq(item) {
    let req2 = baseOf(item).level;
    for (const a of item.affixes) req2 = Math.max(req2, Math.floor((affixOf(a).tiers[a.tier]?.ilvl ?? 1) * 0.8));
    return Math.min(req2, 90);
  }

  // src/core/passives.ts
  function startNode(hero) {
    return CLASSES[hero.cls].startNode;
  }
  function pointsLeft(hero) {
    return passivePoints(hero.level, hero.bonusPoints ?? 0) - hero.passives.length;
  }
  function passiveMods(hero) {
    const out = [];
    for (const id of hero.passives) {
      const n = PASSIVES[id];
      if (!n) continue;
      for (const md of n.mods) out.push({ ...md, src: n.name });
    }
    for (const id of hero.ascNodes ?? []) {
      const n = ASC_NODES[id];
      if (!n || n.asc !== hero.asc) continue;
      for (const md of n.mods) out.push({ ...md, src: n.name });
    }
    return out;
  }
  var ascPointsLeft = (hero) => (hero.ascPoints ?? 0) - (hero.ascNodes?.length ?? 0);
  function chooseAscendancy(state, id) {
    const a = ASCENDANCIES[id];
    if (!a || a.cls !== state.hero.cls) return "not for this calling";
    if (state.hero.asc) return "already chosen";
    if ((state.hero.ascPoints ?? 0) <= 0) return "complete a trial first";
    state.hero.asc = id;
    state.hero.rev++;
    return null;
  }
  function takeAscNode(state, id) {
    const hero = state.hero;
    const n = ASC_NODES[id];
    if (!n || n.asc !== hero.asc) return "not in your ascendancy";
    if (hero.ascNodes.includes(id)) return "already taken";
    if (ascPointsLeft(hero) <= 0) return "no ascendancy points";
    hero.ascNodes.push(id);
    hero.rev++;
    return null;
  }
  function canAllocate(hero, id) {
    const n = PASSIVES[id];
    if (!n) return "unknown node";
    if (n.kind === "start") return "start nodes are free";
    if (hero.passives.includes(id)) return "already allocated";
    if (pointsLeft(hero) <= 0) return "no points left";
    const start = startNode(hero);
    const have = new Set(hero.passives);
    if (!n.links.some((l) => l === start || have.has(l))) return "not connected";
    return null;
  }
  function allocate(state, id) {
    const err = canAllocate(state.hero, id);
    if (err) return err;
    state.hero.passives.push(id);
    state.hero.rev++;
    return null;
  }
  var refundCost = (hero) => 5 + hero.level * 2;
  function canRefund(hero, id) {
    if (!hero.passives.includes(id)) return false;
    const rest = new Set(hero.passives.filter((p) => p !== id));
    const start = startNode(hero);
    const seen = /* @__PURE__ */ new Set();
    const queue = [start];
    while (queue.length) {
      const cur = queue.pop();
      for (const l of PASSIVES[cur]?.links ?? []) if (rest.has(l) && !seen.has(l)) {
        seen.add(l);
        queue.push(l);
      }
    }
    return seen.size === rest.size;
  }
  function refund(state, id) {
    if (!canRefund(state.hero, id)) return "other nodes depend on it";
    const cost = refundCost(state.hero);
    if (state.dust < cost) return `needs ${cost} ember dust`;
    state.dust -= cost;
    state.hero.passives = state.hero.passives.filter((p) => p !== id);
    state.hero.rev++;
    return null;
  }

  // src/core/types.ts
  var DAMAGE_TYPES = ["phys", "fire", "cold", "lightning", "chaos"];
  var ELEMENTS = ["fire", "cold", "lightning"];
  var SLOTS = ["weapon", "offhand", "helmet", "body", "gloves", "boots", "belt", "amulet", "ring1", "ring2"];

  // src/core/character.ts
  var FIGHT_SHARE = 0.6;
  var UNARMED = { phys: [2, 5], aps: 1.2, crit: 5 };
  function supportSlots(level) {
    return SUPPORT_SLOT_LEVELS.filter((l) => l <= level).length;
  }
  function heroMods(hero, extra = []) {
    const cls = CLASSES[hero.cls];
    if (!cls) throw new Error("unknown class " + hero.cls);
    const mods = [...extra, ...passiveMods(hero)];
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
    const manaRegen = bag.flat("manaRegen") + mana * 0.07;
    const skill = calcSkill(hero, bag, problems, manaRegen);
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
  function calcSkill(hero, heroBag, problems, manaRegen) {
    const L = hero.level;
    let def2 = SKILLS[hero.skill];
    if (!def2 || def2.level > L) {
      problems.push("skill not available");
      def2 = SKILLS.crescent;
    }
    const weaponItem = hero.equipment.weapon;
    const wst = weaponItem && levelReq(weaponItem) <= L ? itemStats(weaponItem).weapon : void 0;
    const wkind = wst ? BASES[weaponItem.base].kind : "unarmed";
    let usable = true;
    if (def2.kind === "attack" && def2.weapons && def2.weapons.length && !def2.weapons.includes(wkind)) {
      problems.push(`${def2.name} can't be used with ${wst ? "this weapon" : "no weapon"}`);
      usable = false;
    }
    const bag = new StatBag();
    bag.addAll(allMods(heroBag));
    for (const m4 of def2.mods ?? []) bag.add(m4);
    const tags = /* @__PURE__ */ new Set([...def2.tags, def2.kind]);
    const slots = supportSlots(L);
    const used = [];
    let manaMult = 1, extraTargets = 0;
    for (const id of hero.supports.slice(0, slots)) {
      const sup = SUPPORTS[id];
      if (!sup || sup.level > L) continue;
      if (sup.requires.length && !sup.requires.some((t) => tags.has(t))) {
        problems.push(`${sup.name} does not support ${def2.name}`);
        continue;
      }
      used.push(id);
      for (const m4 of sup.mods) bag.add({ ...m4, src: sup.name });
      manaMult *= sup.manaMult;
      extraTargets += sup.targets ?? 0;
    }
    const eff = def2.effectiveness / 100 * (usable ? 1 : 0.5);
    const isSpell = def2.kind === "spell";
    const baseDmg = zeroRanges();
    let crit, speed;
    if (def2.kind === "attack") {
      const w2 = wst ?? { ...UNARMED, added: {} };
      baseDmg.phys = [w2.phys[0], w2.phys[1]];
      for (const t of ELEMENTS) {
        const a = w2.added[t];
        if (a) baseDmg[t] = [a[0], a[1]];
      }
      crit = w2.crit;
      speed = w2.aps * (def2.speedMult ?? 1);
    } else {
      const sc = spellScale(L);
      for (const t of DAMAGE_TYPES) {
        const d = def2.damage?.[t];
        if (d) baseDmg[t] = [d[0] * sc, d[1] * sc];
      }
      crit = def2.crit ?? 6;
      speed = 1 / (def2.castTime ?? 1);
    }
    const ctx = tagSet([...tags]);
    for (const t of DAMAGE_TYPES) {
      const c = tagSet([...tags, t]);
      const lo = bag.flat(`addMin.${t}`, c), hi = bag.flat(`addMax.${t}`, c);
      baseDmg[t] = isSpell ? [baseDmg[t][0] + lo * eff, baseDmg[t][1] + hi * eff] : [(baseDmg[t][0] + lo) * eff, (baseDmg[t][1] + hi) * eff];
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
    if (def2.kind === "attack") speed *= bag.incMult("attackSpeed", ctx) * bag.more("attackSpeed", ctx);
    else speed *= bag.incMult("castSpeed", ctx) * bag.more("castSpeed", ctx);
    const accuracy = Math.round(bag.calc("accuracy", heroBaseAccuracy(L), ctx));
    const hc = def2.kind === "spell" ? 1 : hitChance(accuracy, monsterDefence(L));
    let targets = 1;
    if (def2.shape === "area") targets = Math.max(1, Math.floor((def2.targets ?? 3) * bag.incMult("area", ctx))) + extraTargets;
    else if (def2.shape === "projectile") targets = 1 + (def2.targets ?? 0) + extraTargets + Math.floor(bag.flat("pierce", ctx));
    const manaCost = Math.round(def2.manaCost * (1 + 0.02 * (L - 1)) * manaMult * bag.incMult("manaCost") * 10) / 10;
    const pen = zeroes();
    for (const t of DAMAGE_TYPES) pen[t] = bag.flat(`pen.${t}`, ctx);
    let avgHit = 0;
    for (const t of DAMAGE_TYPES) avgHit += (hit[t][0] + hit[t][1]) / 2;
    const critFactor = 1 + critChance / 100 * (critMulti / 100 - 1);
    const sustain = manaCost > 0 ? manaRegen / manaCost / FIGHT_SHARE : Infinity;
    const dps = avgHit * critFactor * Math.min(speed, sustain) * hc;
    return {
      id: def2.id,
      name: def2.name,
      kind: def2.kind,
      shape: def2.shape,
      fx: def2.fx,
      tags: [...tags],
      hit,
      avgHit,
      critChance,
      critMulti,
      speed,
      sustain,
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

  // src/core/filter.ts
  var DEFAULT_FILTER = [
    { on: true, action: "keep", rarity: ["relic"] },
    { on: true, action: "salvage", rarity: ["plain", "enchanted"], behind: 10 },
    { on: false, action: "keep", rarity: ["rare"], minAffixes: 5 }
  ];
  function ruleMatches(r3, item, heroLevel) {
    const b = BASES[item.base];
    if (!b) return false;
    if (r3.rarity?.length && !r3.rarity.includes(item.rarity)) return false;
    if (r3.slots?.length && !r3.slots.includes(b.slot)) return false;
    if (r3.minIlvl && item.ilvl < r3.minIlvl) return false;
    if (r3.behind && b.level > heroLevel - r3.behind) return false;
    if (r3.minAffixes && item.affixes.length < r3.minAffixes) return false;
    if (r3.group && !item.affixes.some((a) => affixOf(a).group === r3.group)) return false;
    return true;
  }
  var RANK = { plain: 0, enchanted: 1, rare: 2, relic: 3 };
  function keepItem(state, item) {
    for (const r3 of state.settings.filter ?? []) if (r3.on && ruleMatches(r3, item, state.hero.level)) return r3.action === "keep";
    return RANK[item.rarity] >= RANK[state.settings.keep];
  }
  function describeRule(r3) {
    const parts = [];
    parts.push(r3.rarity?.length ? r3.rarity.join("/") : "any rarity");
    if (r3.slots?.length) parts.push(r3.slots.join("/"));
    if (r3.minIlvl) parts.push(`ilvl ${r3.minIlvl}+`);
    if (r3.behind) parts.push(`base ${r3.behind}+ levels behind`);
    if (r3.minAffixes) parts.push(`${r3.minAffixes}+ affixes`);
    if (r3.group) parts.push(`with ${r3.group}`);
    return `${r3.action === "keep" ? "Keep" : "Salvage"} ${parts.join(", ")}`;
  }

  // src/core/state.ts
  var newTotals = () => ({ kills: 0, deaths: 0, runs: 0, items: 0, salvaged: 0, dust: 0, simMs: 0 });

  // src/core/game.ts
  var RARITY_RANK = { plain: 0, enchanted: 1, rare: 2, relic: 3 };
  var LOG_MAX = 60;
  function newGame(opts) {
    const cls = CLASSES[opts.cls];
    if (!cls) throw new Error("unknown class " + opts.cls);
    const seed = opts.seed ?? hashSeed(opts.now, opts.name.length);
    const state = {
      seed,
      createdAt: opts.now,
      simTo: opts.now,
      hero: { name: opts.name, cls: cls.id, level: 1, xp: 0, skill: cls.startSkill, supports: [], equipment: {}, passives: [], bonusPoints: 0, ascNodes: [], ascPoints: 0, rev: 0 },
      stash: [],
      stashCap: 60,
      dust: 0,
      currency: {},
      world: { unlocked: ["a1_shore"], clears: {}, storySeen: [], rewards: [] },
      activity: { zone: "a1_shore", autoPush: true, runIndex: 0, streak: 0, deaths: 0, run: null, acc: 0, mode: "zone", mapTier: 0 },
      maps: [],
      mapCap: 40,
      atlas: { points: 0, nodes: [], tiers: [] },
      sigils: {},
      pinnacleKills: {},
      settings: { keep: "rare", autoEquip: true, filter: structuredClone(DEFAULT_FILTER) },
      totals: newTotals(),
      nextUid: 1,
      craftSeq: 0,
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
  function buildScore(s) {
    const off = Math.sqrt(Math.max(0.01, s.skill.dps) * Math.max(0.01, s.skill.packDps));
    const def2 = Math.pow(s.ehp.phys * s.ehp.fire * s.ehp.cold * s.ehp.lightning, 0.25);
    return Math.pow(off, 0.6) * Math.pow(def2, 0.4);
  }
  function canEquip(state, item, slot) {
    const b = baseOf(item);
    if (!slotsFor(b).includes(slot)) return "wrong slot";
    if (levelReq(item) > state.hero.level) return `needs level ${levelReq(item)}`;
    const w2 = state.hero.equipment.weapon;
    if (slot === "offhand" && w2) {
      const wb = baseOf(w2);
      if (wb.weapon?.hands === 2 && !(wb.kind === "bow" && b.kind === "quiver")) return "two-handed weapon";
    }
    if (b.kind === "quiver" && (!w2 || baseOf(w2).kind !== "bow")) return "needs a bow";
    return null;
  }
  function dropsOffhand(state, item, slot) {
    const off = state.hero.equipment.offhand;
    if (slot !== "weapon" || !off) return false;
    const b = baseOf(item), ob = baseOf(off);
    return b.weapon?.hands === 2 && !(b.kind === "bow" && ob.kind === "quiver") || ob.kind === "quiver" && b.kind !== "bow";
  }
  function displacedCount(state, item, slot) {
    return (state.hero.equipment[slot] ? 1 : 0) + (dropsOffhand(state, item, slot) ? 1 : 0);
  }
  function displacedItems(state, item, slot) {
    const eq = state.hero.equipment;
    const out = [];
    if (eq[slot]) out.push(eq[slot]);
    if (dropsOffhand(state, item, slot)) out.push(eq.offhand);
    return out;
  }
  var itemValue = (x) => RARITY_RANK[x.rarity] * 1e3 + x.ilvl;
  function equipWithRoom(state, item, slot) {
    const off = displacedItems(state, item, slot);
    const need = off.length - (state.stashCap - state.stash.length);
    const victims = [];
    if (need > 0) {
      const pool = [...state.stash, ...off].filter((x) => x.rarity !== "relic" && !x.crafted).sort((a, b) => itemValue(a) - itemValue(b));
      if (pool.length < need) return false;
      victims.push(...pool.slice(0, need));
    }
    putOn(state, item, slot);
    for (const v of victims) {
      const i = state.stash.indexOf(v);
      if (i >= 0) state.stash.splice(i, 1);
      salvageItem(state, v);
    }
    for (const o of off) if (!victims.includes(o)) state.stash.push(o);
    if (victims.length) pushLog(state, "loot", `Stash full: salvaged ${victims.map(itemLabel).join(", ")} to make room.`);
    return true;
  }
  function putOn(state, item, slot) {
    const eq = state.hero.equipment;
    const off = [];
    const prev = eq[slot];
    if (prev) off.push(prev);
    eq[slot] = item;
    const b = baseOf(item);
    if (slot === "weapon" && eq.offhand) {
      const ob = baseOf(eq.offhand);
      if (b.weapon?.hands === 2 && !(b.kind === "bow" && ob.kind === "quiver")) {
        off.push(eq.offhand);
        delete eq.offhand;
      } else if (ob.kind === "quiver" && b.kind !== "bow") {
        off.push(eq.offhand);
        delete eq.offhand;
      }
    }
    state.hero.rev++;
    return off;
  }
  function equip(state, uid, slot) {
    const i = state.stash.findIndex((x) => x.uid === uid);
    if (i < 0) return "not in stash";
    const item = state.stash[i];
    const target = slot ?? bestSlot(state, item);
    const err = canEquip(state, item, target);
    if (err) return err;
    if (state.stash.length - 1 + displacedCount(state, item, target) > state.stashCap) return "stash full";
    state.stash.splice(i, 1);
    state.stash.push(...putOn(state, item, target));
    return null;
  }
  function unequip(state, slot) {
    const it = state.hero.equipment[slot];
    if (!it) return null;
    if (state.stash.length >= state.stashCap) return "stash full";
    delete state.hero.equipment[slot];
    state.stash.push(it);
    state.hero.rev++;
    return null;
  }
  function bestSlot(state, item) {
    const slots = slotsFor(baseOf(item));
    return slots.find((s) => !state.hero.equipment[s]) ?? slots[0];
  }
  function trialSheet(state, item, slot) {
    if (canEquip(state, item, slot)) return null;
    const hero = structuredClone(state.hero);
    const trial = { ...state, hero };
    putOn(trial, item, slot);
    return deriveSheet(hero);
  }
  function upgradeSlot(state, item) {
    const now = buildScore(sheetOf(state));
    let best = null, bestScore = now * 1.02;
    for (const slot of slotsFor(baseOf(item))) {
      const sheet = trialSheet(state, item, slot);
      if (!sheet) continue;
      const score = buildScore(sheet);
      if (score > bestScore) {
        best = slot;
        bestScore = score;
      }
    }
    return best;
  }
  function receiveItem(state, item) {
    state.totals.items++;
    if (state.settings.autoEquip) {
      const slot = upgradeSlot(state, item);
      if (slot && equipWithRoom(state, item, slot)) {
        pushLog(state, "loot", `Equipped a new ${BASES[item.base].name}.`);
        return { kept: true, equipped: true };
      }
    }
    return { kept: stashOrSalvage(state, item), equipped: false };
  }
  function stashOrSalvage(state, item) {
    if (keepItem(state, item)) {
      if (state.stash.length < state.stashCap) {
        state.stash.push(item);
        return true;
      }
      if (!state.stashFull) {
        state.stashFull = true;
        pushLog(state, "loot", "Stash full: items the filter keeps are being salvaged.");
      }
    }
    salvageItem(state, item);
    return false;
  }
  function salvageItem(state, item) {
    const v = salvageValue(item);
    state.dust += v;
    state.totals.salvaged++;
    state.totals.dust += v;
  }
  function salvage(state, uids) {
    let n = 0;
    for (const uid of uids) {
      const i = state.stash.findIndex((x) => x.uid === uid);
      if (i < 0) continue;
      salvageItem(state, state.stash.splice(i, 1)[0]);
      n++;
    }
    if (n) state.stashFull = false;
    return n;
  }
  function setSkill(state, id) {
    const s = SKILLS[id];
    if (!s) return "unknown skill";
    if (s.level > state.hero.level) return `needs level ${s.level}`;
    state.hero.skill = id;
    state.hero.rev++;
    return null;
  }
  function setSupports(state, ids) {
    for (const id of ids) {
      const s = SUPPORTS[id];
      if (!s) return "unknown support";
      if (s.level > state.hero.level) return `${s.name} needs level ${s.level}`;
    }
    if (new Set(ids).size !== ids.length) return "duplicate support";
    state.hero.supports = [...ids];
    state.hero.rev++;
    return null;
  }
  function setZone(state, id) {
    if (!ZONES[id]) return "unknown zone";
    if (!state.world.unlocked.includes(id)) return "locked";
    const act = state.activity;
    if (act.zone === id && act.mode === "zone") return null;
    act.zone = id;
    act.mode = "zone";
    act.streak = 0;
    act.deaths = 0;
    if (act.run?.map) return null;
    act.runIndex++;
    act.run = null;
    return null;
  }

  // src/core/maps.ts
  var endgameOpen = (state) => !!state.world.clears.a3_sunfall;
  function atlasEffects(state) {
    const e = emptyAtlas();
    for (const id of state.atlas?.nodes ?? []) {
      const n = ATLAS[id];
      if (!n) continue;
      for (const [k, v] of Object.entries(n.eff)) e[k] += v ?? 0;
    }
    return e;
  }
  var atlasPointsLeft = (state) => state.atlas.points - state.atlas.nodes.length;
  function canTakeAtlas(state, id) {
    const n = ATLAS[id];
    if (!n) return "unknown node";
    if (state.atlas.nodes.includes(id)) return "already taken";
    if (atlasPointsLeft(state) <= 0) return "no atlas points";
    if (!n.requires.every((r3) => state.atlas.nodes.includes(r3))) return "take the node before it first";
    return null;
  }
  function takeAtlas(state, id) {
    const err = canTakeAtlas(state, id);
    if (err) return err;
    state.atlas.nodes.push(id);
    return null;
  }
  function setMapMode(state, on) {
    if (on && !endgameOpen(state)) return "clear the Sunfall first";
    const act = state.activity;
    if (act.mode === "map" === on) return null;
    act.mode = on ? "map" : "zone";
    act.streak = 0;
    act.deaths = 0;
    if (!act.run?.map) {
      act.runIndex++;
      act.run = null;
    }
    return null;
  }
  function setMapTier(state, tier) {
    if (!Number.isInteger(tier) || tier < 0) return "bad tier";
    state.activity.mapTier = tier;
    state.activity.autoCap = 0;
    state.activity.streak = 0;
    return null;
  }
  function queuePinnacle(state, id) {
    const p = PINNACLES[id];
    if (!p) return "unknown pinnacle";
    if ((state.sigils[p.sigil] ?? 0) < p.cost) return `needs ${p.cost} ${p.sigilName}s`;
    if (!endgameOpen(state)) return "clear the Sunfall first";
    state.activity.pinnacle = id;
    if (state.activity.mode !== "map") setMapMode(state, true);
    return null;
  }
  function rollMods(rng, n, keep = []) {
    const pool = Object.keys(MAP_MODS).filter((m4) => !keep.includes(m4));
    const out = [...keep];
    while (out.length < keep.length + n && pool.length) out.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
    return out;
  }
  function rollMap(rng, uid, tier) {
    const r3 = rng.next();
    const rarity = r3 < 0.1 ? "rare" : r3 < 0.4 ? "enchanted" : "plain";
    const n = rarity === "rare" ? rng.int(3, 4) : rarity === "enchanted" ? rng.int(1, 2) : 0;
    const area = rng.pick(Object.keys(MAP_AREAS).sort());
    return { uid, tier: Math.max(1, tier), area, mods: rollMods(rng, n), rarity };
  }
  function mapLabel(m4) {
    return `${MAP_AREAS[m4.area]?.name ?? m4.area} (${tierName(m4.tier)})`;
  }
  function craftMap(state, currency, uid) {
    const m4 = state.maps.find((x) => x.uid === uid);
    if (!m4) return "map not found";
    if (!CURRENCIES[currency]) return "unknown currency";
    if ((state.currency[currency] ?? 0) <= 0) return `no ${CURRENCIES[currency].name} left`;
    const rng = new Rng(hashSeed(state.seed, 7168368, state.craftSeq));
    switch (currency) {
      case "kindling":
        if (m4.rarity !== "plain") return "needs a plain map";
        m4.rarity = "enchanted";
        m4.mods = rollMods(rng, rng.int(1, 2));
        break;
      case "reshaper":
        if (m4.rarity !== "enchanted") return "needs an enchanted map";
        m4.mods = rollMods(rng, rng.int(1, 2));
        break;
      case "graft":
        if (m4.rarity !== "enchanted" || m4.mods.length >= 2) return "needs an enchanted map with one mod";
        m4.mods = rollMods(rng, 1, m4.mods);
        break;
      case "crownseal":
        if (m4.rarity !== "enchanted") return "needs an enchanted map";
        m4.rarity = "rare";
        m4.mods = rollMods(rng, 1, m4.mods);
        break;
      case "forgeheart":
        if (m4.rarity !== "plain") return "needs a plain map";
        m4.rarity = "rare";
        m4.mods = rollMods(rng, rng.int(3, 4));
        break;
      case "tempest":
        if (m4.rarity !== "rare") return "needs a rare map";
        m4.mods = rollMods(rng, rng.int(3, 4));
        break;
      case "starfall":
        if (m4.rarity !== "rare" || m4.mods.length >= 5) return "needs a rare map with room";
        m4.mods = rollMods(rng, 1, m4.mods);
        break;
      case "salt":
        if (m4.rarity === "plain") return "already plain";
        m4.rarity = "plain";
        m4.mods = [];
        break;
      default:
        return "does nothing to maps";
    }
    state.craftSeq++;
    state.currency[currency]--;
    return null;
  }
  function addMap(state, m4) {
    if (state.maps.length < state.mapCap) {
      state.maps.push(m4);
      return true;
    }
    let low = 0;
    state.maps.forEach((x, i) => {
      if (x.tier < state.maps[low].tier) low = i;
    });
    if (state.maps[low].tier >= m4.tier) return false;
    state.maps[low] = m4;
    return true;
  }
  function autoXpCap(state) {
    const act = state.activity;
    if (!act.autoPush || act.mapTier > 0 || state.hero.level >= MAX_LEVEL) return 0;
    let t = 1;
    while (mapLevel(t + 1) <= state.hero.level + 4) t++;
    return t;
  }
  function startMapRun(state) {
    const act = state.activity;
    const pin = act.pinnacle ? PINNACLES[act.pinnacle] : void 0;
    if (pin) {
      act.pinnacle = void 0;
      if ((state.sigils[pin.sigil] ?? 0) >= pin.cost) {
        state.sigils[pin.sigil] -= pin.cost;
        pushLog(state, "zone", `The way to ${pin.name} opens.`);
        return { tier: MAX_TIER, area: "sunscar", mods: [], level: pin.level, pinnacle: pin.id };
      }
    }
    if (state.maps.length) {
      const xpCap = autoXpCap(state);
      const caps = [act.mapTier, act.autoCap ?? 0, xpCap].filter((t) => t > 0);
      const want = caps.length ? Math.min(...caps) : 0;
      const sorted = [...state.maps].sort((a, b) => b.tier - a.tier || b.mods.length - a.mods.length || a.uid - b.uid);
      const pick = want > 0 ? sorted.find((m4) => m4.tier <= want) ?? sorted[sorted.length - 1] : sorted[0];
      state.maps.splice(state.maps.indexOf(pick), 1);
      return { tier: pick.tier, area: pick.area, mods: [...pick.mods], level: mapLevel(pick.tier) };
    }
    return { tier: 0, area: "cinderfield", mods: [], level: mapLevel(0) };
  }
  function mapZone(m4, atlas) {
    const area = MAP_AREAS[m4.area] ?? MAP_AREAS.cinderfield;
    if (m4.pinnacle) {
      const p = PINNACLES[m4.pinnacle];
      return { id: "map", act: 4, name: p.name, level: p.level, packs: 0, packSize: [0, 0], monsters: area.monsters, boss: p.boss, champion: 0, palette: p.palette };
    }
    const packs = m4.mods.reduce((s, id) => s + (MAP_MODS[id]?.packs ?? 0), 0) + atlas.packs;
    return {
      id: "map",
      act: 4,
      name: `${area.name} - ${tierName(m4.tier)}`,
      level: m4.level,
      packs: Math.round((m4.tier === 0 ? 6 : 8) * (1 + packs / 100)),
      packSize: [4, 6],
      monsters: area.monsters,
      ...m4.tier > 0 ? { boss: area.boss } : {},
      champion: 0.2,
      palette: area.palette
    };
  }
  var effCache = /* @__PURE__ */ new WeakMap();
  function mapEffects(m4, atlas) {
    const c = effCache.get(m4);
    if (c) return c;
    const depth = depthMult(m4.tier);
    const e = { life: depth, damage: depth, speed: 1, extra: [], hero: [], quantity: atlas.quantity, rarity: atlas.rarity };
    const reward = 1 + atlas.modEffect / 100;
    for (const id of m4.mods) {
      const d = MAP_MODS[id];
      if (!d) continue;
      if (d.life) e.life *= 1 + d.life / 100;
      if (d.damage) e.damage *= 1 + d.damage / 100;
      if (d.speed) e.speed *= 1 + d.speed / 100;
      if (d.extra) e.extra.push(d.extra);
      if (d.hero) e.hero.push(...d.hero.map((x) => ({ ...x, src: "Map" })));
      e.quantity += d.qty * reward;
      e.rarity += d.rarity * reward;
    }
    if (m4.tier > MAX_TIER) {
      e.quantity += (m4.tier - MAX_TIER) * 3;
      e.rarity += (m4.tier - MAX_TIER) * 4;
    }
    effCache.set(m4, e);
    return e;
  }
  function completeMap(state, m4) {
    if (m4.pinnacle) {
      const first = !state.pinnacleKills[m4.pinnacle];
      state.pinnacleKills[m4.pinnacle] = (state.pinnacleKills[m4.pinnacle] ?? 0) + 1;
      if (first) {
        state.atlas.points += 2;
        pushLog(state, "boss", `${PINNACLES[m4.pinnacle].name} is defeated: +2 atlas points.`);
      }
      return;
    }
    if (m4.tier > 0 && !state.atlas.tiers.includes(m4.tier)) {
      state.atlas.tiers.push(m4.tier);
      if (m4.tier <= MAX_TIER || (m4.tier - MAX_TIER) % 5 === 0) {
        state.atlas.points++;
        pushLog(state, "info", `${tierName(m4.tier)} completed for the first time: +1 atlas point.`);
      }
    }
  }
  function dropTier(rng, tier, atlas) {
    const base = Math.max(1, tier);
    return rng.chance((12 + atlas.upgrade) / 100) ? base + 1 : base;
  }

  // src/core/sim/engine.ts
  var STEP_MS = 100;
  var DT = STEP_MS / 1e3;
  var MAX_OFFLINE_MS = 24 * 36e5;
  var TRAVEL_S = 1.5;
  var RESPAWN_S = 6;
  var FLASK_MAX = 30;
  var FLASK_COST = 10;
  var FLASK_S = 2;
  var PUSH_LEVEL_MARGIN = 2;
  var MAP_DEATH_XP = 0.03;
  var flaskAmount = (level, sheet) => (40 + 14 * level) * sheet.flaskHeal;
  function newRun(state, sheet) {
    const act = state.activity;
    const map = act.mode === "map" ? startMapRun(state) : void 0;
    const z = map ? mapZone(map, atlasEffects(state)) : zoneOf(act.zone);
    const rng = new Rng(hashSeed(state.seed, act.runIndex));
    const run = {
      rng: rng.state(),
      zone: z.id,
      pack: 0,
      packs: z.packs,
      boss: !!z.boss,
      phase: "fight",
      timer: 0,
      monsters: [],
      hero: { life: sheet.life, es: sheet.es, mana: sheet.mana, flask: FLASK_MAX, flaskLeft: 0, flaskRate: 0, cd: 0.3, esDelay: 0 },
      kills: 0,
      xp: 0,
      elapsed: 0
    };
    if (map) run.map = map;
    const prev = act.run;
    if (prev && prev.zone === z.id) run.hero.flask = prev.hero.flask;
    spawnPack(run, z, rng, effectsOf(state, run));
    run.rng = rng.state();
    return run;
  }
  function zoneOf(id) {
    const z = ZONES[id];
    if (!z) throw new Error("unknown zone " + id);
    return z;
  }
  function runZone(state, run) {
    return run.map ? mapZone(run.map, atlasEffects(state)) : zoneOf(run.zone);
  }
  var effectsOf = (state, run) => run.map ? mapEffects(run.map, atlasEffects(state)) : null;
  var mapSheets = /* @__PURE__ */ new WeakMap();
  function runSheet(state) {
    const run = state.activity.run;
    const eff = run ? effectsOf(state, run) : null;
    if (!run?.map || !eff?.hero.length) return sheetOf(state);
    const c = mapSheets.get(run.map);
    if (c && c.rev === state.hero.rev) return c.sheet;
    const sheet = deriveSheet(state.hero, eff.hero);
    mapSheets.set(run.map, { rev: state.hero.rev, sheet });
    return sheet;
  }
  function makeMonster(def2, level, champion, rng, eff) {
    const d = MONSTERS[def2];
    const life = Math.round(monsterLife(level) * d.life * (champion ? 3 : 1) * (eff?.life ?? 1));
    return { def: def2, level, life, maxLife: life, champion, atk: rng.range(0.4, 1.4) / d.speed };
  }
  function spawnPack(run, z, rng, eff) {
    run.monsters = [];
    if (run.pack >= run.packs) {
      if (z.boss) {
        const b = makeMonster(z.boss, run.map?.pinnacle ? z.level : z.level + 1, false, rng, eff);
        if (run.map && !run.map.pinnacle) {
          b.life = b.maxLife = Math.round(b.maxLife * MAP_BOSS_LIFE);
        }
        run.monsters.push(b);
      }
      return;
    }
    const n = rng.int(z.packSize[0], z.packSize[1]);
    const champ = rng.chance(z.champion);
    for (let i = 0; i < n; i++) run.monsters.push(makeMonster(rng.pick(z.monsters), z.level, champ && i === 0, rng, eff));
  }
  function advance(state, now, ev = {}, maxSteps = Infinity) {
    if (now - state.simTo > MAX_OFFLINE_MS) state.simTo = now - MAX_OFFLINE_MS;
    let steps = 0;
    while (state.simTo + STEP_MS <= now) {
      if (steps >= maxSteps) return false;
      step(state, ev);
      state.simTo += STEP_MS;
      state.totals.simMs += STEP_MS;
      steps++;
    }
    return true;
  }
  function step(state, ev = {}) {
    if (!state.activity.run) state.activity.run = newRun(state, sheetOf(state));
    const run = state.activity.run;
    let sheet = runSheet(state);
    const rng = new Rng(run.rng);
    const h2 = run.hero;
    const z = runZone(state, run);
    const eff = effectsOf(state, run);
    run.elapsed += DT;
    h2.life = Math.min(sheet.life, h2.life + sheet.lifeRegen * DT);
    h2.mana = Math.min(sheet.mana, h2.mana + sheet.manaRegen * DT);
    if (h2.esDelay > 0) h2.esDelay -= DT;
    else h2.es = Math.min(sheet.es, h2.es + sheet.es * 0.2 * DT);
    h2.leech = Math.min(sheet.life * 0.1, (h2.leech ?? sheet.life * 0.1) + sheet.life * 0.1 * DT);
    if (h2.flaskLeft > 0) {
      h2.life = Math.min(sheet.life, h2.life + h2.flaskRate * DT);
      h2.flaskLeft -= DT;
    }
    switch (run.phase) {
      case "dead":
        run.timer -= DT;
        if (run.timer <= 0) {
          state.activity.runIndex++;
          state.activity.run = newRun(state, sheetOf(state));
        }
        break;
      case "travel":
        run.timer -= DT * sheet.moveSpeed;
        if (run.timer <= 0) {
          spawnPack(run, z, rng, eff);
          run.phase = run.monsters.length ? "fight" : "done";
        }
        break;
      case "done":
        finishRun(state, ev);
        return;
      case "fight": {
        h2.cd -= DT;
        if (h2.cd <= 0) {
          if (h2.mana >= sheet.skill.manaCost) {
            h2.mana -= sheet.skill.manaCost;
            sheet = heroAttack(state, run, sheet, rng, ev);
            h2.cd += 1 / Math.max(0.1, sheet.skill.speed);
          } else h2.cd = 0.2;
        }
        monstersAct(run, sheet, rng, ev, eff);
        if (h2.life <= 0) {
          heroDied(state, run, ev);
          break;
        }
        if (h2.flaskLeft <= 0 && h2.life < sheet.life * 0.5 && h2.flask >= FLASK_COST) {
          h2.flask -= FLASK_COST;
          h2.flaskLeft = FLASK_S;
          h2.flaskRate = flaskAmount(state.hero.level, sheet) / FLASK_S;
          ev.flask?.();
        }
        if (run.monsters.every((m4) => m4.life <= 0)) {
          run.pack++;
          const last = run.pack > run.packs || run.pack === run.packs && !run.boss;
          run.phase = last ? "done" : "travel";
          run.timer = TRAVEL_S;
        }
        break;
      }
    }
    if (state.activity.run === run) run.rng = rng.state();
  }
  function heroAttack(state, run, sheet, rng, ev) {
    const sk = sheet.skill;
    const alive = [];
    run.monsters.forEach((m4, i) => {
      if (m4.life > 0) alive.push(i);
    });
    const targets = alive.slice(0, sk.targets);
    ev.heroUse?.(sk.fx, targets);
    let dealt = 0;
    for (const i of targets) {
      const m4 = run.monsters[i];
      const d = MONSTERS[m4.def];
      if (sk.kind === "attack" && !rng.chance(hitChance(sk.accuracy, monsterDefence(m4.level) * d.evasion))) {
        ev.heroMiss?.(i);
        continue;
      }
      const crit = rng.chance(sk.critChance / 100);
      let dmg = 0;
      for (const t of DAMAGE_TYPES) {
        const [lo, hi] = sk.hit[t];
        if (hi <= 0) continue;
        let x = rng.range(lo, hi);
        if (crit) x *= sk.critMulti / 100;
        if (t === "phys") x *= 1 - armourReduction(monsterDefence(m4.level) * d.armour * 0.5, x);
        else x *= 1 - ((d.res?.[t] ?? 0) - sk.pen[t]) / 100;
        dmg += Math.max(0, x);
      }
      dmg = Math.max(1, dmg);
      m4.life -= dmg;
      dealt += dmg;
      ev.heroHit?.(i, dmg, crit);
      if (m4.life <= 0) sheet = onKill(state, run, m4, sheet, rng, ev);
    }
    if (sk.leech > 0 && dealt > 0) {
      const h2 = run.hero;
      const got = Math.min(dealt * sk.leech / 100, h2.leech ?? sheet.life * 0.1);
      h2.leech = (h2.leech ?? sheet.life * 0.1) - got;
      h2.life = Math.min(sheet.life, h2.life + got);
    }
    return sheet;
  }
  function monstersAct(run, sheet, rng, ev, eff) {
    const h2 = run.hero;
    run.monsters.forEach((m4, i) => {
      if (m4.life <= 0 || h2.life <= 0) return;
      const d = MONSTERS[m4.def];
      m4.atk -= DT;
      if (m4.atk > 0) return;
      m4.atk += rng.range(0.85, 1.15) / (d.speed * (eff?.speed ?? 1));
      if (!d.spell) {
        const evade = Math.min(0.75, 1 - hitChance(monsterDefence(m4.level) * d.accuracy, sheet.evasion));
        if (rng.chance(evade)) {
          ev.monsterHit?.(i, 0, "evade");
          return;
        }
      }
      if (rng.chance(sheet.block / 100)) {
        ev.monsterHit?.(i, 0, "block");
        return;
      }
      const mapBoss = d.boss && run.map && !run.map.pinnacle ? MAP_BOSS_DAMAGE : 1;
      const base = monsterDamage(m4.level) * d.damage * mapBoss * (m4.champion ? 1.5 : 1) * (eff?.damage ?? 1) * rng.range(0.8, 1.2);
      let dmg = 0;
      for (const t of DAMAGE_TYPES) {
        let share = d.split[t] ?? 0;
        if (eff) {
          for (const [et, es] of eff.extra) if (et === t) share += es;
        }
        if (!share) continue;
        let x = base * share;
        if (t === "phys") x *= 1 - armourReduction(sheet.armour, x);
        else x *= 1 - sheet.res[t] / 100;
        dmg += x;
      }
      dmg *= sheet.dmgTaken;
      const fromEs = Math.min(h2.es, dmg);
      h2.es -= fromEs;
      h2.life -= dmg - fromEs;
      h2.esDelay = 2;
      ev.monsterHit?.(i, dmg, null);
    });
  }
  function onKill(state, run, m4, sheet, rng, ev) {
    const d = MONSTERS[m4.def];
    const hero = state.hero;
    const atlas = run.map ? atlasEffects(state) : null;
    const eff = effectsOf(state, run);
    const xp = Math.round(monsterXp(m4.level) * d.xp * (m4.champion ? 3 : 1) * xpPenalty(hero.level, m4.level) * sheet.xpGain * (1 + (atlas?.xp ?? 0) / 100));
    run.kills++;
    run.xp += xp;
    state.totals.kills++;
    run.hero.flask = Math.min(FLASK_MAX, run.hero.flask + (d.boss ? 5 : 1) * sheet.flaskCharges);
    run.hero.life = Math.min(sheet.life, run.hero.life + sheet.lifeOnKill);
    ev.kill?.(m4, xp);
    let changed = gainXp(state, xp, ev);
    const qty = 1 + (sheet.quantity + (eff?.quantity ?? 0)) / 100;
    let drops = 0;
    if (d.boss) drops = 2 + (rng.chance(0.5 * qty) ? 1 : 0);
    else if (rng.chance((m4.champion ? 0.4 : 0.07) * qty)) drops = 1;
    for (let k = 0; k < drops; k++) {
      const bonus = sheet.rarity + (eff?.rarity ?? 0) + (m4.champion ? 100 : 0) + (d.boss ? 250 : 0);
      const opts = d.boss && k === 0 ? { rarity: "rare" } : { rarityBonus: bonus };
      const pin = run.map?.pinnacle && d.boss;
      const relicChance = pin && k === 0 ? 1 : (d.boss ? 0.04 + (atlas?.bossRelic ?? 0) / 100 : m4.champion ? 0.01 : 3e-3) * (1 + bonus / 200);
      const item = rng.chance(relicChance) && rollRelic(rng, state.nextUid, m4.level) || rollItem(rng, state.nextUid, m4.level, opts);
      state.nextUid++;
      const r3 = receiveItem(state, item);
      if (r3.equipped) changed = true;
      ev.loot?.(item, r3.kept, r3.equipped);
    }
    const cRolls = run.map?.pinnacle && d.boss ? 12 : d.boss ? 3 : 1;
    const cChance = (d.boss ? 0.6 : m4.champion ? 0.12 : 0.02) * qty * (1 + (atlas?.currency ?? 0) / 100);
    for (let k = 0; k < cRolls; k++) {
      if (!rng.chance(cChance)) continue;
      const cur = rng.weighted(CURRENCY_ORDER, (id) => CURRENCIES[id].drop);
      state.currency[cur] = (state.currency[cur] ?? 0) + 1;
      ev.currency?.(cur);
    }
    endgameDrops(state, run, m4, rng);
    if (d.boss) pushLog(state, "boss", `${d.name} falls.`);
    return changed ? runSheet(state) : sheet;
  }
  function endgameDrops(state, run, m4, rng) {
    const d = MONSTERS[m4.def];
    const inMap = !!run.map && !run.map.pinnacle;
    const act3 = !run.map && ZONES[run.zone]?.act === 3;
    if (!inMap && !act3) return;
    const atlas = atlasEffects(state);
    const tier = inMap ? run.map.tier : 0;
    const base = d.boss ? 0.6 : m4.champion ? 0.06 : 0.012;
    const chance = base * (act3 ? 0.25 : 1) * (1 + atlas.mapDrop / 100);
    if (rng.chance(chance)) {
      if (addMap(state, rollMap(rng, state.nextUid++, dropTier(rng, tier, atlas)))) state.totals.maps = (state.totals.maps ?? 0) + 1;
    }
    if (inMap && d.boss && tier > 0) {
      const eligible = Object.values(PINNACLES).filter((p) => tier >= p.minTier);
      if (eligible.length && rng.chance(0.15 * (1 + atlas.fragments / 100))) {
        const p = eligible[rng.int(0, eligible.length - 1)];
        state.sigils[p.sigil] = (state.sigils[p.sigil] ?? 0) + 1;
        pushLog(state, "loot", `Found a ${p.sigilName}.`);
      }
    }
  }
  function gainXp(state, xp, ev = {}) {
    const hero = state.hero;
    if (hero.level >= MAX_LEVEL) return false;
    hero.xp += xp;
    let up = false;
    while (hero.level < MAX_LEVEL && hero.xp >= xpToNext(hero.level)) {
      hero.xp -= xpToNext(hero.level);
      hero.level++;
      hero.rev++;
      up = true;
      pushLog(state, "level", `Reached level ${hero.level}.`);
      ev.level?.(hero.level);
    }
    if (hero.level >= MAX_LEVEL) hero.xp = 0;
    return up;
  }
  function heroDied(state, run, ev) {
    run.phase = "dead";
    run.timer = RESPAWN_S;
    run.hero.life = 0;
    state.totals.deaths++;
    const act = state.activity;
    act.streak = 0;
    act.deaths++;
    pushLog(state, "death", `Died in ${runZone(state, run).name}.`);
    ev.death?.(run.zone);
    if (run.map) {
      state.hero.xp = Math.max(0, state.hero.xp - MAP_DEATH_XP * xpToNext(state.hero.level));
      if (act.autoPush && act.deaths >= 3 && run.map.tier > 1 && !run.map.pinnacle) {
        act.autoCap = Math.min(act.autoCap || Infinity, run.map.tier - 1);
        act.deaths = 0;
        pushLog(state, "zone", `Too deep: running ${tierName(act.autoCap)} and below for now.`);
      }
      return;
    }
    if (act.autoPush && act.deaths >= 3 && ZONES[act.zone]?.trial) {
      const road = [...ZONE_ORDER].reverse().find((id) => state.world.unlocked.includes(id) && (state.world.clears[id] ?? 0) > 0) ?? ZONE_ORDER[0];
      ev.zone?.(act.zone, road, "retreat");
      pushLog(state, "zone", `Fell back to ${zoneOf(road).name}.`);
      act.zone = road;
      act.deaths = 0;
    } else if (act.autoPush && act.deaths >= 3) {
      const i = ZONE_ORDER.indexOf(act.zone);
      if (i > 0) {
        const to = ZONE_ORDER[i - 1];
        ev.zone?.(act.zone, to, "retreat");
        pushLog(state, "zone", `Fell back to ${zoneOf(to).name}.`);
        act.zone = to;
        act.deaths = 0;
      }
    }
  }
  function firstClear(state, zoneId, ev) {
    const z = zoneOf(zoneId);
    const hero = state.hero;
    if (z.bossText) {
      pushLog(state, "boss", z.bossText);
      ev.story?.(z.bossText);
    }
    void hero;
    const actDef = ACTS.find((a) => a.zones[a.zones.length - 1] === zoneId);
    if (actDef) ev.story?.(actDef.outro);
    reconcileRewards(state, ev);
  }
  function reconcileRewards(state, ev = {}) {
    const w2 = state.world, hero = state.hero;
    w2.rewards ??= [];
    const cleared = (z) => (w2.clears[z] ?? 0) > 0;
    for (const a of ACTS) {
      const key = `act:${a.id}`;
      if (cleared(a.zones[a.zones.length - 1]) && !w2.rewards.includes(key)) {
        w2.rewards.push(key);
        hero.bonusPoints = (hero.bonusPoints ?? 0) + ACT_BOSS_POINTS;
        hero.rev++;
        pushLog(state, "info", `Act ${a.id} complete: +${ACT_BOSS_POINTS} passive points.`);
      }
    }
    for (const [trial, after] of Object.entries(TRIAL_AFTER)) {
      if (cleared(after) && !w2.unlocked.includes(trial)) {
        w2.unlocked.push(trial);
        pushLog(state, "zone", `${zoneOf(trial).name} is open.`);
        ev.zone?.(after, trial, "unlock");
      }
      const key = `trial:${trial}`;
      if (cleared(trial) && !w2.rewards.includes(key)) {
        w2.rewards.push(key);
        hero.ascPoints = (hero.ascPoints ?? 0) + TRIAL_POINTS;
        hero.rev++;
        pushLog(state, "info", `${zoneOf(trial).name} passed: +${TRIAL_POINTS} ascendancy points.`);
      }
    }
    ZONE_ORDER.forEach((z, i) => {
      const next = ZONE_ORDER[i + 1];
      if (next && cleared(z) && !w2.unlocked.includes(next)) w2.unlocked.push(next);
    });
  }
  function tryTrial(state, ev) {
    const w2 = state.world, act = state.activity, L = state.hero.level;
    w2.trialTry ??= {};
    for (const a of ACTS) {
      const t = a.trial;
      if (!w2.unlocked.includes(t) || (w2.clears[t] ?? 0) > 0) continue;
      if (L < zoneOf(t).level + 2 || L < (w2.trialTry[t] ?? 0)) continue;
      w2.trialTry[t] = L + 3;
      ev.zone?.(act.zone, t, "push");
      pushLog(state, "zone", `Attempting ${zoneOf(t).name}.`);
      act.zone = t;
      act.streak = 0;
      act.deaths = 0;
      return true;
    }
    return false;
  }
  function finishRun(state, ev) {
    const act = state.activity;
    const run = act.run;
    state.totals.runs++;
    if (run.map) {
      completeMap(state, run.map);
      act.deaths = 0;
      act.streak++;
      if (act.autoCap && act.streak >= 5) {
        act.autoCap = 0;
        act.streak = 0;
      }
      ev.runDone?.(run.zone);
      act.runIndex++;
      act.run = newRun(state, sheetOf(state));
      return;
    }
    const first = !state.world.clears[run.zone];
    state.world.clears[run.zone] = (state.world.clears[run.zone] ?? 0) + 1;
    if (first) firstClear(state, run.zone, ev);
    act.streak++;
    act.deaths = 0;
    ev.runDone?.(run.zone);
    const i = ZONE_ORDER.indexOf(run.zone);
    const next = ZONE_ORDER[i + 1];
    if (next && !state.world.unlocked.includes(next)) {
      state.world.unlocked.push(next);
      pushLog(state, "zone", `${zoneOf(next).name} is open.`);
      ev.zone?.(run.zone, next, "unlock");
    }
    const z = zoneOf(run.zone);
    if (act.autoPush && z.trial && act.zone === run.zone) {
      const road = [...ZONE_ORDER].reverse().find((id) => state.world.unlocked.includes(id));
      if (road) {
        ev.zone?.(act.zone, road, "push");
        act.zone = road;
        act.streak = 0;
      }
    } else if (act.autoPush && act.zone === run.zone && tryTrial(state, ev)) {
    } else if (act.autoPush && next && state.world.unlocked.includes(next) && act.streak >= 3 && act.zone === run.zone && zoneOf(next).level <= state.hero.level + PUSH_LEVEL_MARGIN) {
      ev.zone?.(act.zone, next, "push");
      pushLog(state, "zone", `Pushed on to ${zoneOf(next).name}.`);
      act.zone = next;
      act.streak = 0;
    }
    act.runIndex++;
    act.run = newRun(state, sheetOf(state));
  }

  // src/core/sim/report.ts
  function startReport(state) {
    const report = {
      from: state.simTo,
      to: state.simTo,
      levelFrom: state.hero.level,
      levelTo: state.hero.level,
      xp: 0,
      runs: 0,
      kills: 0,
      bosses: 0,
      deaths: 0,
      kept: 0,
      salvaged: 0,
      dust: state.dust,
      equipped: [],
      best: [],
      zones: [],
      story: []
    };
    const events = {
      kill: (m4, xp) => {
        report.kills++;
        report.xp += xp;
        if (MONSTERS[m4.def]?.boss) report.bosses++;
      },
      death: () => {
        report.deaths++;
      },
      runDone: () => {
        report.runs++;
      },
      loot: (item, kept, equipped) => {
        if (equipped) report.equipped.push(itemLabel(item));
        else if (kept) report.kept++;
        else report.salvaged++;
        if (kept && (item.rarity === "rare" || item.rarity === "relic")) {
          report.best.push(item);
          if (report.best.length > 6) report.best.shift();
        }
      },
      zone: (_from, to, why) => {
        if (why === "unlock") report.zones.push(ZONES[to]?.name ?? to);
      },
      story: (text) => {
        report.story.push(text);
      }
    };
    return {
      report,
      events,
      finish(s) {
        report.to = s.simTo;
        report.levelTo = s.hero.level;
        report.dust = s.dust - report.dust;
        return report;
      }
    };
  }

  // src/core/save.ts
  var SAVE_VERSION = 4;
  var MIGRATIONS = {
    // v2 (P2): passive bonus points, loot filter rules, crafting counter.
    1: (s) => {
      s.hero.bonusPoints ??= 0;
      s.settings.filter ??= [
        { on: true, action: "keep", rarity: ["relic"] },
        { on: true, action: "salvage", rarity: ["plain", "enchanted"], behind: 10 },
        { on: false, action: "keep", rarity: ["rare"], minAffixes: 5 }
      ];
      s.craftSeq ??= 0;
      s.currency ??= {};
      return s;
    },
    // v3 (P3): ascendancy nodes and points.
    2: (s) => {
      s.hero.ascNodes ??= [];
      s.hero.ascPoints ??= 0;
      return s;
    },
    // v4 (P4): maps, atlas, sigils, pinnacles.
    3: (s) => {
      s.activity.mode ??= "zone";
      s.activity.mapTier ??= 0;
      s.maps ??= [];
      s.mapCap ??= 40;
      s.atlas ??= { points: 0, nodes: [], tiers: [] };
      s.sigils ??= {};
      s.pinnacleKills ??= {};
      const acts = [["a1_lock", "act:1"], ["a2_throne", "act:2"], ["a3_sunfall", "act:3"]];
      const trials = ["a1_trial", "a2_trial", "a3_trial"];
      const clears = s.world.clears ?? {};
      const actsDone = acts.filter(([z]) => clears[z] > 0).map(([, k]) => k);
      const trialsDone = trials.filter((z) => clears[z] > 0).map((z) => "trial:" + z);
      s.world.rewards ??= [...actsDone.slice(0, Math.floor((s.hero.bonusPoints ?? 0) / 2)), ...trialsDone.slice(0, Math.floor((s.hero.ascPoints ?? 0) / 2))];
      return s;
    }
  };
  var SaveError = class extends Error {
  };
  function wrap(state, savedAt) {
    return { game: "hollowmarch", v: SAVE_VERSION, savedAt, state };
  }
  function unwrap(raw, migrations = MIGRATIONS, target = SAVE_VERSION) {
    if (!raw || typeof raw !== "object") throw new SaveError("not a save");
    const env = raw;
    if (env.game !== "hollowmarch") throw new SaveError("not a Hollowmarch save");
    if (typeof env.v !== "number" || !Number.isInteger(env.v) || env.v < 1) throw new SaveError("bad save version");
    if (env.v > target) throw new SaveError(`save is from a newer version (${env.v})`);
    let state = env.state;
    for (let v = env.v; v < target; v++) {
      const m4 = migrations[v];
      if (!m4) throw new SaveError(`no migration from version ${v}`);
      state = m4(state);
    }
    return { game: "hollowmarch", v: target, savedAt: typeof env.savedAt === "number" ? env.savedAt : 0, state };
  }
  function exportText(env) {
    const json = JSON.stringify(env);
    const bytes = new TextEncoder().encode(json);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return "HM1:" + btoa(bin);
  }
  function importText(text) {
    const t = text.trim();
    if (!t.startsWith("HM1:")) throw new SaveError("not a Hollowmarch export");
    let bin;
    try {
      bin = atob(t.slice(4));
    } catch {
      throw new SaveError("export is damaged");
    }
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    try {
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw new SaveError("export is damaged");
    }
  }

  // src/core/validate.ts
  var num = (v, what, min = -Infinity, max = Infinity) => {
    if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) throw new SaveError(`bad ${what}`);
    return v;
  };
  var obj = (v, what) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) throw new SaveError(`missing ${what}`);
    return v;
  };
  function checkItem(it) {
    const i = obj(it, "item");
    num(i.uid, "item id");
    num(i.ilvl, "item level", 1, 1e3);
    if (!BASES[i.base]) throw new SaveError(`unknown item base ${String(i.base)}`);
    if (!["plain", "enchanted", "rare", "relic"].includes(i.rarity)) throw new SaveError("bad rarity");
    if (!Array.isArray(i.affixes)) throw new SaveError("bad affixes");
    for (const a of i.affixes) {
      const def2 = AFFIXES[a?.id];
      if (!def2 || !def2.tiers[a.tier] || !Array.isArray(a.rolls) || a.rolls.length !== def2.mods.length) throw new SaveError(`bad affix ${String(a?.id)}`);
      a.rolls.forEach((r3) => num(r3, "affix roll"));
    }
    for (const a of i.affixes) {
      const t = AFFIXES[a.id].tiers[a.tier];
      a.rolls = a.rolls.map((r3, k) => Math.min(t.ranges[k][1], Math.max(t.ranges[k][0], Math.round(r3))));
    }
    if (i.rarity === "relic") {
      const def2 = i.relic ? RELICS[i.relic] : void 0;
      if (!def2) throw new SaveError(`unknown relic ${String(i.relic)}`);
      if (!Array.isArray(i.relicRolls) || i.relicRolls.length !== def2.mods.length) throw new SaveError("bad relic rolls");
      i.relicRolls = i.relicRolls.map((r3, k) => {
        num(r3, "relic roll");
        const [lo, hi] = def2.mods[k].range;
        return Math.min(hi, Math.max(lo, Math.round(r3)));
      });
      if (i.affixes.length) throw new SaveError("relic with affixes");
    } else if (i.relic !== void 0 || i.relicRolls !== void 0) throw new SaveError("relic data on a non-relic item");
    return i;
  }
  var RARITIES = ["plain", "enchanted", "rare", "relic"];
  var strs = (v, ok) => Array.isArray(v) ? v.filter((x) => typeof x === "string" && (!ok || ok(x))) : void 0;
  var pos = (v) => typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : void 0;
  function cleanRule(v) {
    if (!v || typeof v !== "object") return null;
    const r3 = v;
    if (r3.action !== "keep" && r3.action !== "salvage") return null;
    const out = { on: r3.on !== false, action: r3.action };
    if (r3.rarity !== void 0) {
      const rarity = strs(r3.rarity, (s) => RARITIES.includes(s));
      if (!rarity?.length) return null;
      out.rarity = rarity;
    }
    if (r3.slots !== void 0) {
      const slots = strs(r3.slots);
      if (!slots?.length) return null;
      out.slots = slots;
    }
    const minIlvl = pos(r3.minIlvl);
    if (minIlvl) out.minIlvl = minIlvl;
    const behind = pos(r3.behind);
    if (behind) out.behind = behind;
    const minAffixes = pos(r3.minAffixes);
    if (minAffixes) out.minAffixes = minAffixes;
    if (typeof r3.group === "string") out.group = r3.group;
    return out;
  }
  function cleanPassives(hero) {
    const wanted = new Set(strs(hero.passives, (id) => !!PASSIVES[id] && PASSIVES[id].kind !== "start") ?? []);
    const start = CLASSES[hero.cls].startNode;
    const kept = [];
    const seen = /* @__PURE__ */ new Set([start]);
    const queue = [start];
    while (queue.length) {
      for (const l of PASSIVES[queue.shift()]?.links ?? []) {
        if (wanted.has(l) && !seen.has(l)) {
          seen.add(l);
          kept.push(l);
          queue.push(l);
        }
      }
    }
    return kept.slice(0, Math.max(0, passivePoints(hero.level, hero.bonusPoints)));
  }
  function validateState(raw) {
    const s = obj(raw, "state");
    num(s.seed, "seed");
    num(s.simTo, "time");
    num(s.nextUid, "item counter", 0);
    const hero = obj(s.hero, "hero");
    if (!CLASSES[hero.cls]) throw new SaveError(`unknown class ${String(hero.cls)}`);
    if (typeof hero.name !== "string") throw new SaveError("bad name");
    num(hero.level, "level", 1, 100);
    num(hero.xp, "xp", 0);
    num(hero.rev, "revision");
    hero.bonusPoints = typeof hero.bonusPoints === "number" && Number.isFinite(hero.bonusPoints) ? hero.bonusPoints : 0;
    if (!SKILLS[hero.skill]) hero.skill = CLASSES[hero.cls].startSkill;
    hero.supports = Array.isArray(hero.supports) ? hero.supports.filter((id) => SUPPORTS[id]) : [];
    hero.ascPoints = typeof hero.ascPoints === "number" && Number.isFinite(hero.ascPoints) ? hero.ascPoints : 0;
    if (hero.asc && (!ASCENDANCIES[hero.asc] || ASCENDANCIES[hero.asc].cls !== hero.cls)) delete hero.asc;
    hero.ascNodes = hero.asc && Array.isArray(hero.ascNodes) ? [...new Set(hero.ascNodes.filter((id) => ASC_NODES[id]?.asc === hero.asc))].slice(0, hero.ascPoints) : [];
    hero.passives = cleanPassives(hero);
    obj(hero.equipment, "equipment");
    for (const k of Object.keys(hero.equipment)) {
      if (!SLOTS.includes(k)) throw new SaveError(`bad slot ${k}`);
      checkItem(hero.equipment[k]);
    }
    if (!Array.isArray(s.stash)) throw new SaveError("bad stash");
    s.stash.forEach(checkItem);
    num(s.stashCap, "stash size", 1, 1e4);
    num(s.dust, "dust", 0);
    s.currency = s.currency && typeof s.currency === "object" ? s.currency : {};
    for (const [k, v] of Object.entries(s.currency)) if (typeof v !== "number" || !Number.isFinite(v) || v < 0) delete s.currency[k];
    const world = obj(s.world, "world");
    world.unlocked = Array.isArray(world.unlocked) ? world.unlocked.filter((z) => ZONES[z]) : [];
    if (!world.unlocked.length) world.unlocked = ["a1_shore"];
    world.clears = world.clears && typeof world.clears === "object" ? world.clears : {};
    world.storySeen = Array.isArray(world.storySeen) ? world.storySeen : [];
    world.rewards = strs(world.rewards) ?? [];
    world.trialTry = Object.fromEntries(Object.entries(world.trialTry && typeof world.trialTry === "object" ? world.trialTry : {}).filter(([k, v]) => ZONES[k]?.trial && typeof v === "number" && Number.isFinite(v)));
    const act = obj(s.activity, "activity");
    if (!ZONES[act.zone] || !world.unlocked.includes(act.zone)) {
      act.zone = world.unlocked[world.unlocked.length - 1];
      act.run = null;
    }
    if (act.run && (!act.run.map && !ZONES[act.run.zone] || !Array.isArray(act.run.monsters) || !act.run.hero || !Array.isArray(act.run.rng))) act.run = null;
    if (act.run && act.run.monsters.some((m4) => !m4 || !MONSTERS[m4.def])) act.run = null;
    num(act.runIndex, "run index", 0);
    act.streak = Number.isFinite(act.streak) ? act.streak : 0;
    act.deaths = Number.isFinite(act.deaths) ? act.deaths : 0;
    act.acc = 0;
    const set = obj(s.settings, "settings");
    if (!["plain", "enchanted", "rare"].includes(set.keep)) set.keep = "rare";
    set.autoEquip = set.autoEquip !== false;
    set.filter = Array.isArray(set.filter) ? set.filter.map(cleanRule).filter((r3) => !!r3) : structuredClone(DEFAULT_FILTER);
    if (act.mode !== "map" || !endgameOpen(s)) act.mode = "zone";
    if (!endgameOpen(s)) delete act.pinnacle;
    act.autoCap = Number.isInteger(act.autoCap) && act.autoCap > 0 ? act.autoCap : 0;
    act.mapTier = Number.isInteger(act.mapTier) && act.mapTier >= 0 ? act.mapTier : 0;
    if (act.pinnacle !== void 0 && !PINNACLES[act.pinnacle]) delete act.pinnacle;
    if (act.run?.map) {
      const m4 = act.run.map;
      if (!MAP_AREAS[m4.area] || !Array.isArray(m4.mods) || m4.mods.some((x) => !MAP_MODS[x]) || !Number.isFinite(m4.tier) || !Number.isFinite(m4.level) || m4.pinnacle !== void 0 && !PINNACLES[m4.pinnacle]) act.run = null;
    }
    s.maps = Array.isArray(s.maps) ? s.maps.filter((m4) => m4 && Number.isFinite(m4.uid) && Number.isInteger(m4.tier) && m4.tier >= 1 && MAP_AREAS[m4.area] && Array.isArray(m4.mods) && m4.mods.every((x) => MAP_MODS[x]) && ["plain", "enchanted", "rare"].includes(m4.rarity)) : [];
    s.mapCap = Number.isInteger(s.mapCap) && s.mapCap > 0 ? s.mapCap : 40;
    const atlas = s.atlas && typeof s.atlas === "object" ? s.atlas : { points: 0, nodes: [], tiers: [] };
    atlas.points = Number.isFinite(atlas.points) && atlas.points >= 0 ? atlas.points : 0;
    atlas.tiers = Array.isArray(atlas.tiers) ? [...new Set(atlas.tiers.filter((t) => Number.isInteger(t) && t >= 1))] : [];
    const nodes = [];
    for (const id of Array.isArray(atlas.nodes) ? atlas.nodes : []) {
      if (ATLAS[id] && !nodes.includes(id) && ATLAS[id].requires.every((r3) => nodes.includes(r3)) && nodes.length < atlas.points) nodes.push(id);
    }
    atlas.nodes = nodes;
    s.atlas = atlas;
    const counts = (o) => Object.fromEntries(Object.entries(o && typeof o === "object" ? o : {}).filter(([, v]) => typeof v === "number" && Number.isFinite(v) && v >= 0));
    s.sigils = counts(s.sigils);
    s.pinnacleKills = counts(s.pinnacleKills);
    s.totals = s.totals && typeof s.totals === "object" ? { ...newTotals(), ...s.totals } : newTotals();
    s.craftSeq = Number.isFinite(s.craftSeq) ? s.craftSeq : 0;
    s.log = Array.isArray(s.log) ? s.log.slice(-60) : [];
    reconcileRewards(s);
    return s;
  }

  // src/ui/gfx/pixfont.ts
  var G = {
    "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
    "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
    "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
    "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
    "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
    "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
    "6": ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."],
    "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
    "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
    "9": [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
    A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
    C: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
    D: ["###..", "#..#.", "#...#", "#...#", "#...#", "#..#.", "###.."],
    E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
    F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
    G: [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".####"],
    H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    I: [".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
    J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
    K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
    L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
    M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
    N: ["#...#", "#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#"],
    O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
    P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
    Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
    R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
    S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
    T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
    U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
    V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
    W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "#.#.#", ".#.#."],
    X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
    Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
    Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
    ".": ["..", "..", "..", "..", "..", "##", "##"],
    ",": ["..", "..", "..", "..", ".#", ".#", "#."],
    ":": ["..", "##", "##", "..", "##", "##", ".."],
    "/": ["....#", "...#.", "...#.", "..#..", ".#...", ".#...", "#...."],
    "%": ["##..#", "##.#.", "...#.", "..#..", ".#...", ".#.##", "#..##"],
    "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
    "-": ["....", "....", "....", "####", "....", "....", "...."],
    "!": ["#", "#", "#", "#", "#", ".", "#"],
    "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
    "'": ["#", "#", ".", ".", ".", ".", "."],
    "(": [".#", "#.", "#.", "#.", "#.", "#.", ".#"],
    ")": ["#.", ".#", ".#", ".#", ".#", ".#", "#."],
    "~": [".....", ".....", ".#..#", "#.##.", ".....", ".....", "....."],
    " ": ["...", "...", "...", "...", "...", "...", "..."]
  };
  var GLYPH_H = 7;
  var glyphOf = (ch) => G[ch] ?? G[ch.toUpperCase()] ?? G["?"];
  function textWidth(text) {
    let w2 = 0;
    for (const ch of text) w2 += glyphOf(ch)[0].length + 1;
    return Math.max(0, w2 - 1);
  }
  var cache2 = /* @__PURE__ */ new Map();
  function textSprite(text, color, outline = "#111111") {
    const key = `${color}|${outline}|${text}`;
    let c = cache2.get(key);
    if (c) {
      cache2.delete(key);
      cache2.set(key, c);
      return c;
    }
    const w2 = textWidth(text) + 2, h2 = GLYPH_H + 2;
    c = document.createElement("canvas");
    c.width = Math.max(1, w2);
    c.height = h2;
    const g = c.getContext("2d");
    const ink = (col, ox, oy) => {
      g.fillStyle = col;
      let x = 1;
      for (const ch of text) {
        const rows = glyphOf(ch);
        rows.forEach((row, y) => {
          let i = 0;
          while (i < row.length) {
            if (row[i] !== "#") {
              i++;
              continue;
            }
            let e = i;
            while (e < row.length && row[e] === "#") e++;
            g.fillRect(x + i + ox, 1 + y + oy, e - i, 1);
            i = e;
          }
        });
        x += rows[0].length + 1;
      }
    };
    if (outline) for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) ink(outline, ox, oy);
    ink(color, 0, 0);
    cache2.set(key, c);
    if (cache2.size > 300) cache2.delete(cache2.keys().next().value);
    return c;
  }
  function drawText(g, text, x, y, color, align = "left", outline = "#111111") {
    const s = textSprite(text, color, outline);
    const dx = align === "center" ? Math.round(x - s.width / 2) : align === "right" ? x - s.width : x;
    g.drawImage(s, dx, Math.round(y));
    return s.width;
  }

  // src/ui/gfx/atlas.gen.ts
  var FRAMES = {
    "boss.angel": { "x": 0, "y": 0, "w": 98, "h": 115, "n": 8, "ax": 49, "ay": 108, "f": 1 },
    "boss.angel.attack": { "x": 412, "y": 116, "w": 84, "h": 78, "n": 3, "ax": 43, "ay": 77, "f": 1 },
    "boss.beast": { "x": 662, "y": 277, "w": 49, "h": 56, "n": 6, "ax": 27, "ay": 55, "f": 1 },
    "boss.demon": { "x": 0, "y": 277, "w": 80, "h": 64, "n": 6, "ax": 30, "ay": 63, "f": 1 },
    "boss.knight": { "x": 180, "y": 552, "w": 60, "h": 47, "n": 4, "ax": 30, "ay": 46, "f": 1 },
    "boss.knight.attack": { "x": 0, "y": 601, "w": 74, "h": 45, "n": 5, "ax": 19, "ay": 44, "f": 1 },
    "boss.nightmare": { "x": 0, "y": 116, "w": 102, "h": 91, "n": 4, "ax": 43, "ay": 90, "f": 1 },
    "fx.blast": { "x": 384, "y": 398, "w": 41, "h": 51, "n": 6, "ax": 19, "ay": 49, "f": 0 },
    "fx.death": { "x": 0, "y": 208, "w": 77, "h": 68, "n": 9, "ax": 40, "ay": 67, "f": 0 },
    "fx.fireball": { "x": 928, "y": 734, "w": 25, "h": 25, "n": 3, "ax": 13, "ay": 24, "f": 0 },
    "fx.orb": { "x": 324, "y": 773, "w": 18, "h": 11, "n": 3, "ax": 7, "ay": 10, "f": 0 },
    "hero.arcanist.attack": { "x": 0, "y": 647, "w": 72, "h": 44, "n": 6, "ax": 17, "ay": 43, "f": 0 },
    "hero.arcanist.hurt": { "x": 628, "y": 647, "w": 39, "h": 43, "n": 2, "ax": 23, "ay": 42, "f": 0 },
    "hero.arcanist.idle": { "x": 704, "y": 552, "w": 25, "h": 46, "n": 4, "ax": 13, "ay": 45, "f": 0 },
    "hero.arcanist.run": { "x": 0, "y": 552, "w": 29, "h": 48, "n": 6, "ax": 12, "ay": 47, "f": 0 },
    "hero.strider.attack": { "x": 798, "y": 451, "w": 45, "h": 49, "n": 3, "ax": 11, "ay": 48, "f": 0 },
    "hero.strider.hurt": { "x": 670, "y": 342, "w": 46, "h": 52, "n": 2, "ax": 22, "ay": 51, "f": 0 },
    "hero.strider.idle": { "x": 0, "y": 502, "w": 33, "h": 49, "n": 6, "ax": 11, "ay": 48, "f": 0 },
    "hero.strider.run": { "x": 0, "y": 451, "w": 56, "h": 50, "n": 14, "ax": 29, "ay": 41, "f": 0 },
    "hero.vanguard.attack": { "x": 0, "y": 692, "w": 83, "h": 41, "n": 6, "ax": 31, "ay": 40, "f": 0 },
    "hero.vanguard.hurt": { "x": 504, "y": 692, "w": 37, "h": 41, "n": 3, "ax": 18, "ay": 40, "f": 0 },
    "hero.vanguard.idle": { "x": 708, "y": 647, "w": 31, "h": 43, "n": 4, "ax": 12, "ay": 42, "f": 0 },
    "hero.vanguard.run": { "x": 375, "y": 601, "w": 51, "h": 45, "n": 12, "ax": 43, "ay": 43, "f": 0 },
    "mon.flyer": { "x": 808, "y": 552, "w": 29, "h": 46, "n": 4, "ax": 19, "ay": 44, "f": 0 },
    "mon.gato": { "x": 0, "y": 734, "w": 87, "h": 38, "n": 4, "ax": 20, "ay": 37, "f": 1 },
    "mon.ghoul": { "x": 204, "y": 502, "w": 47, "h": 49, "n": 8, "ax": 32, "ay": 48, "f": 1 },
    "mon.hound": { "x": 352, "y": 734, "w": 47, "h": 28, "n": 12, "ax": 26, "ay": 27, "f": 1 },
    "mon.shade": { "x": 588, "y": 502, "w": 30, "h": 49, "n": 7, "ax": 14, "ay": 43, "f": 1 },
    "mon.shade.attack": { "x": 805, "y": 502, "w": 48, "h": 49, "n": 4, "ax": 24, "ay": 48, "f": 1 },
    "mon.skeleton": { "x": 424, "y": 552, "w": 34, "h": 47, "n": 8, "ax": 22, "ay": 46, "f": 1 },
    "mon.skull": { "x": 0, "y": 398, "w": 47, "h": 52, "n": 8, "ax": 24, "ay": 49, "f": 1 },
    "mon.skull2": { "x": 486, "y": 277, "w": 43, "h": 58, "n": 4, "ax": 23, "ay": 57, "f": 1 },
    "mon.spider": { "x": 196, "y": 773, "w": 31, "h": 21, "n": 4, "ax": 15, "ay": 20, "f": 0 },
    "mon.thing": { "x": 618, "y": 692, "w": 26, "h": 40, "n": 4, "ax": 15, "ay": 39, "f": 1 },
    "mon.wizard": { "x": 438, "y": 647, "w": 37, "h": 44, "n": 5, "ax": 21, "ay": 43, "f": 1 },
    "mon.wizard.attack": { "x": 0, "y": 342, "w": 66, "h": 55, "n": 10, "ax": 40, "ay": 54, "f": 1 },
    "mon.wolf": { "x": 0, "y": 773, "w": 48, "h": 23, "n": 4, "ax": 23, "ay": 21, "f": 0 },
    "mon.wraith": { "x": 636, "y": 398, "w": 31, "h": 51, "n": 4, "ax": 12, "ay": 50, "f": 0 }
  };
  var ATLAS_PNG = "data:image/png;base64,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";

  // src/ui/gfx/sprites.ts
  var img = null;
  var white = null;
  var loading = null;
  var tinted = /* @__PURE__ */ new Map();
  function loadSprites() {
    if (!ATLAS_PNG) return Promise.resolve();
    return loading ??= new Promise((resolve) => {
      const im = new Image();
      im.onload = () => {
        img = im;
        try {
          white = recolour(im, 0, 0, im.width, im.height, "#ffffff", 1);
        } catch {
          white = null;
        }
        resolve();
      };
      im.onerror = () => {
        console.warn("[Hollowmarch] sprite atlas failed to load; using drawn shapes");
        resolve();
      };
      im.src = ATLAS_PNG;
    });
  }
  var spriteOf = (name) => img && FRAMES[name] || null;
  function recolour(src, sx, sy, w2, h2, colour, strength) {
    const c = document.createElement("canvas");
    c.width = w2;
    c.height = h2;
    const g = c.getContext("2d");
    g.drawImage(src, sx, sy, w2, h2, 0, 0, w2, h2);
    g.globalCompositeOperation = "source-atop";
    g.globalAlpha = strength;
    g.fillStyle = colour;
    g.fillRect(0, 0, w2, h2);
    return c;
  }
  function drawSprite(g, name, f, x, y, o = {}) {
    const fr = spriteOf(name);
    if (!fr) return null;
    const i = (Math.floor(f) % fr.n + fr.n) % fr.n;
    const sx = fr.x + i * (fr.w + 1), s = o.scale ?? 1;
    const w2 = fr.w * s, h2 = fr.h * s;
    const flip = !!o.left !== (fr.f === 1);
    const dx = Math.round(x - (flip ? fr.w - fr.ax : fr.ax) * s), dy = Math.round(y - fr.ay * s);
    let src = img, rx = sx, ry = fr.y;
    if (o.flash && white) src = white;
    else if (o.tint) {
      const key = `${name}|${i}|${o.tint}|${o.strength ?? 0.4}`;
      let c = tinted.get(key);
      if (!c) {
        c = recolour(img, sx, fr.y, fr.w, fr.h, o.tint, o.strength ?? 0.4);
        tinted.set(key, c);
        if (tinted.size > 600) tinted.delete(tinted.keys().next().value);
      }
      src = c;
      rx = 0;
      ry = 0;
    }
    if (flip) {
      g.save();
      g.translate(dx + w2, dy);
      g.scale(-1, 1);
      g.drawImage(src, rx, ry, fr.w, fr.h, 0, 0, w2, h2);
      g.restore();
    } else g.drawImage(src, rx, ry, fr.w, fr.h, dx, dy, w2, h2);
    return { x: dx, y: dy, w: w2, h: h2 };
  }

  // src/ui/gfx/cast.ts
  var MONSTER_CAST = {
    // Act 1: the Drowned Road
    drowned: { sprite: "mon.thing", tint: "#5f8f86", strength: 0.25, fps: 6 },
    crab: { sprite: "mon.spider", tint: "#d0643a", strength: 0.45, fps: 10 },
    gull: { sprite: "mon.flyer", tint: "#e9e4d4", strength: 0.35, hover: 16, fps: 10 },
    bogwitch: { sprite: "mon.wizard", attack: "mon.wizard.attack", tint: "#4a5a3a", strength: 0.35, fps: 7 },
    eel: { sprite: "mon.shade", attack: "mon.shade.attack", tint: "#2f6fb8", strength: 0.45, hover: 4, fps: 8 },
    lampman: { sprite: "mon.ghoul", fps: 10 },
    // Act 2: the Glass Barrens
    scorpion: { sprite: "mon.spider", tint: "#9fe3ff", strength: 0.4, fps: 10 },
    wraith: { sprite: "mon.wraith", tint: "#d9b77a", strength: 0.45, hover: 6, fps: 6 },
    jackal: { sprite: "mon.wolf", tint: "#d9b77a", strength: 0.35, fps: 10 },
    bleached: { sprite: "mon.skeleton", fps: 8 },
    wasp: { sprite: "mon.skull2", tint: "#ffe066", strength: 0.45, hover: 18, fps: 8 },
    // Act 3: the Sunfall
    hound: { sprite: "mon.hound", fps: 12 },
    ashwalker: { sprite: "mon.ghoul", tint: "#3a3030", strength: 0.35, fps: 9 },
    cinderbat: { sprite: "mon.skull", hover: 14, fps: 10 },
    magmacrab: { sprite: "mon.gato", tint: "#ff5a36", strength: 0.35, fps: 7 },
    sunpriest: { sprite: "mon.wizard", attack: "mon.wizard.attack", tint: "#6b1f1f", strength: 0.3, fps: 7 },
    // Bosses and trials
    tidewarden: { sprite: "boss.nightmare", tint: "#2f6fb8", strength: 0.2, fps: 6 },
    keeper: { sprite: "boss.angel", attack: "boss.angel.attack", tint: "#3c2a52", strength: 0.35, hover: 6, fps: 8 },
    drownedknight: { sprite: "boss.knight", attack: "boss.knight.attack", tint: "#2f6f6a", strength: 0.35, fps: 6 },
    sandwright: { sprite: "boss.beast", tint: "#d9b77a", strength: 0.4, fps: 8 },
    mirrorwarden: { sprite: "boss.knight", attack: "boss.knight.attack", tint: "#9fe3ff", strength: 0.45, fps: 6 },
    glassregent: { sprite: "boss.angel", attack: "boss.angel.attack", tint: "#9fe3ff", strength: 0.35, hover: 6, fps: 8 },
    cindermatron: { sprite: "boss.beast", fps: 8 },
    emberjudge: { sprite: "boss.demon", tint: "#ff7a2e", strength: 0.25, fps: 7 },
    lastdawn: { sprite: "boss.demon", fps: 7 },
    // Pinnacles
    p_drownedsun: { sprite: "boss.nightmare", tint: "#0c2a66", strength: 0.35, fps: 6 },
    p_glasschoir: { sprite: "boss.angel", attack: "boss.angel.attack", tint: "#b9a4ff", strength: 0.4, hover: 6, fps: 8 },
    p_ashenking: { sprite: "boss.demon", tint: "#2a2020", strength: 0.35, fps: 7 },
    p_hollowcrown: { sprite: "boss.demon", tint: "#8b5cf6", strength: 0.4, fps: 7 }
  };
  var HERO_CAST = {
    vanguard: { idle: "hero.vanguard.idle", run: "hero.vanguard.run", attack: "hero.vanguard.attack", hurt: "hero.vanguard.hurt" },
    strider: { idle: "hero.strider.idle", run: "hero.strider.run", attack: "hero.strider.attack", hurt: "hero.strider.hurt", projectile: "arrow" },
    arcanist: { idle: "hero.arcanist.idle", run: "hero.arcanist.run", attack: "hero.arcanist.attack", hurt: "hero.arcanist.hurt", projectile: "fireball" }
  };

  // src/ui/battle.ts
  var W = 320;
  var H = 120;
  var HERO_ATTACK_MS = 380;
  var MON_ATTACK_MS = 520;
  var HURT_MS = 220;
  var DEATH_FX_MS = 540;
  var Battle = class {
    canvas;
    g;
    fx = [];
    floats = [];
    bursts = [];
    flash = /* @__PURE__ */ new Map();
    dying = /* @__PURE__ */ new Map();
    /** Monster index -> when it last attacked (for its attack animation). */
    monAtk = /* @__PURE__ */ new Map();
    packKey = "";
    heroHurt = 0;
    heroAtk = -1e9;
    shake = 0;
    shakeAmp = 0;
    lastDraw = 0;
    travel = 0;
    /** Set by the app while it is catching up, so bursts of events don't pile up. */
    quiet = false;
    W = W;
    H = H;
    get GROUND() {
      return this.H - 18;
    }
    get HERO_X() {
      return Math.round(Math.max(48, this.W * 0.2));
    }
    constructor() {
      this.canvas = document.createElement("canvas");
      this.canvas.width = W;
      this.canvas.height = H;
      this.g = this.canvas.getContext("2d");
      void loadSprites();
    }
    /** Logical size in scene pixels. */
    resize(w2, h2) {
      w2 = Math.max(200, Math.round(w2));
      h2 = Math.max(90, Math.round(h2));
      if (w2 === this.W && h2 === this.H) return;
      this.W = w2;
      this.H = h2;
      this.canvas.width = w2;
      this.canvas.height = h2;
    }
    positions(state) {
      const run = state.activity.run;
      if (!run) return [];
      const n = run.monsters.length, G2 = this.GROUND;
      if (n === 1 && MONSTERS[run.monsters[0].def]?.boss) return [[Math.round(this.W * 0.7), G2]];
      const x0 = Math.round(Math.max(this.HERO_X + 100, this.W * 0.52));
      const step2 = Math.round(Math.max(30, Math.min(64, (this.W - 40 - x0) / 3)));
      return run.monsters.map((_, i) => {
        const row = Math.floor(i / 3), col = i % 3;
        return [x0 + col * step2 + row * Math.round(step2 / 2), G2 - row * 10];
      });
    }
    /** Events to hand to advance() while online. */
    events(now, state) {
      return {
        heroUse: (kind, targets) => {
          if (this.quiet) return;
          this.heroAtk = now();
          this.pushFx({ kind, t: now(), targets });
        },
        heroHit: (i, dmg, crit) => {
          if (this.quiet) return;
          const p = this.positions(state())[i];
          this.flash.set(i, now());
          if (crit) this.kick(now(), 2);
          if (p) this.pushFloat({ x: p[0], y: p[1] - 44, text: fmtShort(dmg), color: crit ? "#ffc233" : "#ffffff", t: now(), big: crit });
        },
        heroMiss: (i) => {
          if (this.quiet) return;
          const p = this.positions(state())[i];
          if (p) this.pushFloat({ x: p[0], y: p[1] - 44, text: "miss", color: "#9aa0a6", t: now(), big: false });
        },
        monsterHit: (i, dmg, avoided) => {
          if (this.quiet) return;
          this.monAtk.set(i, now());
          if (avoided) this.pushFloat({ x: this.HERO_X, y: this.GROUND - 56, text: avoided, color: "#7fd1ff", t: now(), big: false });
          else {
            this.heroHurt = now();
            this.pushFloat({ x: this.HERO_X - 6, y: this.GROUND - 56, text: fmtShort(dmg), color: "#ff5a36", t: now(), big: false });
          }
        },
        flask: () => {
          if (!this.quiet) this.pushFloat({ x: this.HERO_X, y: this.GROUND - 66, text: "+flask", color: "#3fbf5f", t: now(), big: false });
        },
        level: (l) => {
          if (!this.quiet) {
            this.pushFloat({ x: this.HERO_X, y: this.GROUND - 74, text: "LEVEL " + l, color: "#ffc233", t: now(), big: true });
            this.kick(now(), 2);
          }
        }
      };
    }
    /** A short screen shake. */
    kick(t, amp) {
      this.shakeAmp = t - this.shake < 140 ? Math.max(amp, this.shakeAmp) : amp;
      this.shake = t;
    }
    pushFx(f) {
      this.fx.push(f);
      if (this.fx.length > 12) this.fx.shift();
    }
    jitter = 0;
    pushFloat(f) {
      this.jitter = (this.jitter + 1) % 5;
      f.x += (this.jitter - 2) * 11;
      f.y -= this.jitter % 3 * 7;
      this.floats.push(f);
      if (this.floats.length > 24) this.floats.shift();
    }
    draw(state, sheet, now) {
      const g = this.g;
      g.imageSmoothingEnabled = false;
      const run = state.activity.run;
      const zone = run ? runZone(state, run) : ZONES[state.activity.zone];
      const dt = this.lastDraw ? Math.min(100, now - this.lastDraw) : 16;
      this.lastDraw = now;
      if (run?.phase === "travel") this.travel += dt * 0.06;
      const key = `${state.activity.runIndex}:${run?.pack ?? 0}`;
      if (key !== this.packKey) {
        this.packKey = key;
        this.flash.clear();
        this.dying.clear();
        this.monAtk.clear();
      }
      g.save();
      if (now - this.shake < 140 && this.shakeAmp) g.translate(Math.round((Math.random() - 0.5) * this.shakeAmp * 2), Math.round((Math.random() - 0.5) * this.shakeAmp));
      this.background(zone.palette, zone.id);
      const pos2 = this.positions(state);
      const G2 = this.GROUND;
      if (run && (run.phase === "fight" || run.phase === "dead")) {
        const order = run.monsters.map((_, i) => i).sort((a, b) => pos2[a][1] - pos2[b][1]);
        for (const i of order) {
          const m4 = run.monsters[i], p = pos2[i];
          const def2 = MONSTERS[m4.def];
          if (m4.life <= 0 && !this.dying.has(i)) {
            this.dying.set(i, now);
            if (!this.quiet) this.bursts.push({ x: p[0], y: p[1], t: now, big: !!def2.boss });
          }
          const died = this.dying.get(i);
          const fade = died ? 1 - (now - died) / 160 : 1;
          if (fade <= 0) continue;
          const hit = now - (this.flash.get(i) ?? -1e9) < 80;
          const cast = MONSTER_CAST[m4.def];
          const hover = cast?.hover ? cast.hover + Math.round(Math.sin(now / 320 + i) * 2) : 0;
          g.globalAlpha = Math.max(0, fade);
          let box2 = null;
          if (cast) {
            const at = this.monAtk.get(i);
            const attacking = !!cast.attack && at !== void 0 && now - at < MON_ATTACK_MS && !died;
            const name = attacking ? cast.attack : cast.sprite;
            const fr = spriteOf(name);
            if (fr) {
              shadow(g, p[0], p[1], Math.max(10, Math.round(fr.w * 0.5)), hover);
              if (m4.champion) ring(g, p[0], p[1], Math.max(12, Math.round(fr.w * 0.55)), now);
              const f = attacking ? (now - at) / MON_ATTACK_MS * fr.n : now / (1e3 / (cast.fps ?? 8)) + i * 1.7;
              box2 = drawSprite(g, name, f, p[0], p[1] - hover, { left: true, flash: hit, tint: m4.champion ? "#ffc233" : cast.tint, strength: m4.champion ? 0.3 : cast.strength });
            }
          }
          if (!box2) {
            drawMonster(g, def2, p[0], p[1] + (died ? (1 - fade) * 6 : 0), hit, m4.champion, now);
            const hgt = monsterHeight(def2);
            box2 = { x: p[0] - 11, y: p[1] - hgt, w: 22, h: hgt };
          }
          g.globalAlpha = 1;
          if (!died && !def2.boss) {
            const w2 = Math.max(16, Math.min(40, Math.round(box2.w * 0.6)));
            bar(g, Math.round(p[0] - w2 / 2), box2.y - 5, w2, 2, m4.life / m4.maxLife, m4.champion ? "#ffc233" : "#e5383b");
          }
        }
        const boss = run.monsters.find((m4) => MONSTERS[m4.def]?.boss && m4.life > 0);
        if (boss) {
          const bw = Math.min(200, this.W - 120), bx = Math.round(this.W / 2 - bw / 2);
          g.fillStyle = "#111";
          g.fillRect(bx - 2, 3, bw + 4, 19);
          drawText(g, MONSTERS[boss.def].name.toUpperCase(), this.W / 2, 3, "#ffffff", "center");
          bar(g, bx, 15, bw, 4, boss.life / boss.maxLife, "#e5383b");
        }
      }
      const walking = run?.phase === "travel";
      const dead = run?.phase === "dead";
      const hc = HERO_CAST[state.hero.cls];
      let drew = false;
      if (hc && spriteOf(hc.idle)) {
        const hurt = now - this.heroHurt < HURT_MS;
        const atk = now - this.heroAtk;
        shadow(g, this.HERO_X, G2, 12, 0);
        const red = now - this.heroHurt < 70 ? { tint: "#ff2a2a", strength: 0.3 } : {};
        if (dead) drew = !!drawSprite(g, hc.hurt, 99, this.HERO_X, G2, { tint: "#1a1410", strength: 0.5 });
        else if (atk < HERO_ATTACK_MS && !walking) drew = !!drawSprite(g, hc.attack, atk / HERO_ATTACK_MS * (spriteOf(hc.attack)?.n ?? 1), this.HERO_X, G2, red);
        else if (walking) drew = !!drawSprite(g, hc.run, now / 70, this.HERO_X, G2);
        else if (hurt) drew = !!drawSprite(g, hc.hurt, (now - this.heroHurt) / HURT_MS * (spriteOf(hc.hurt)?.n ?? 1), this.HERO_X, G2, red);
        else drew = !!drawSprite(g, hc.idle, now / 160, this.HERO_X, G2);
      }
      if (!drew) {
        const last = this.fx[this.fx.length - 1];
        let lunge = 0;
        if (last && now - last.t < 160 && (last.kind === "arc" || last.kind === "stab" || last.kind === "slam")) lunge = Math.sin((now - last.t) / 160 * Math.PI) * 14;
        const wItem = state.hero.equipment.weapon;
        const look = { cape: CLASSES[state.hero.cls]?.color ?? "#e2543b", weapon: wItem ? BASES[wItem.base]?.kind ?? "sword" : "none", shield: !!state.hero.equipment.offhand };
        drawHero(g, this.HERO_X + lunge, G2, look, walking ? now : 0, now - this.heroHurt < 120, !!dead);
      }
      this.fx = this.fx.filter((f) => now - f.t < 350);
      for (const f of this.fx) this.drawFx(f, pos2, now, hc?.projectile);
      this.bursts = this.bursts.filter((b) => now - b.t < DEATH_FX_MS);
      for (const b of this.bursts) {
        const k = (now - b.t) / DEATH_FX_MS;
        drawSprite(g, "fx.death", k * (spriteOf("fx.death")?.n ?? 1), b.x, b.y + 4, { scale: b.big ? 2 : 1 });
      }
      this.floats = this.floats.filter((f) => now - f.t < 800);
      for (const f of this.floats) {
        const k = (now - f.t) / 800;
        g.globalAlpha = Math.max(0, 1 - k * k);
        const y = Math.round(f.y - k * 16 - (f.big && k < 0.15 ? 2 : 0));
        drawText(g, f.text.toUpperCase(), Math.round(f.x), y, f.color, "center");
      }
      g.globalAlpha = 1;
      g.restore();
      if (dead && run) {
        g.fillStyle = "rgba(10,10,14,0.6)";
        g.fillRect(0, 0, this.W, this.H);
        const cy = Math.round(this.H / 2) - 12;
        drawText(g, "THE EMBER RELIGHTS", this.W / 2, cy, "#ff5a36", "center");
        drawText(g, `BACK IN ${Math.max(0, run.timer).toFixed(0)}S`, this.W / 2, cy + 12, "#ffffff", "center");
      }
      if (run) {
        for (let i = 0; i < run.packs + (run.boss ? 1 : 0); i++) {
          const isBoss = run.boss && i === run.packs;
          g.fillStyle = "#111";
          g.fillRect(6 + i * 9, 6, 7, 7);
          g.fillStyle = i < run.pack ? "#19b3a3" : i === run.pack ? isBoss ? "#ff5a36" : "#ffc233" : "#555";
          g.fillRect(7 + i * 9, 7, 5, 5);
        }
      }
      void sheet;
    }
    background(pal, seedStr) {
      const g = this.g;
      const W2 = this.W, H2 = this.H, G2 = this.GROUND;
      g.fillStyle = pal[0];
      g.fillRect(0, 0, W2, H2);
      let s = 0;
      for (const c of seedStr) s = s * 31 + c.charCodeAt(0) >>> 0;
      g.fillStyle = pal[2];
      const sky = Math.max(20, G2 - 50);
      for (let i = 0; i < Math.round(W2 / 22); i++) {
        s = s * 1103515245 + 12345 >>> 0;
        const x = s % W2;
        s = s * 1103515245 + 12345 >>> 0;
        g.fillRect(x, s % sky + 4, 1, 1);
      }
      hills(g, W2, G2, shade(pal[0], -0.25), G2 - 40, 22, this.travel * 0.3, 0.03);
      hills(g, W2, G2, shade(pal[1], -0.35), G2 - 18, 12, this.travel * 0.6, 0.06);
      g.fillStyle = pal[1];
      g.fillRect(0, G2, W2, H2 - G2);
      g.fillStyle = "#111";
      g.fillRect(0, G2, W2, 2);
      g.fillStyle = shade(pal[1], -0.2);
      for (let x = -(this.travel * 1.2 % 24); x < W2; x += 24) g.fillRect(x, G2 + 8, 10, 2);
    }
    drawFx(f, pos2, now, projectile) {
      const g = this.g;
      const k = (now - f.t) / 350;
      const targets = f.targets.map((i) => pos2[i]).filter((p) => !!p);
      const HX = this.HERO_X, G2 = this.GROUND;
      g.lineWidth = 2;
      if (f.kind === "arc") {
        g.strokeStyle = `rgba(255,255,255,${1 - k})`;
        g.beginPath();
        g.arc(HX + 16, G2 - 20, 26 + k * 22, -1.1, 0.9);
        g.stroke();
        g.strokeStyle = `rgba(255,90,54,${1 - k})`;
        g.beginPath();
        g.arc(HX + 16, G2 - 20, 22 + k * 22, -1, 0.8);
        g.stroke();
      } else if (f.kind === "slam") {
        g.strokeStyle = `rgba(255,194,51,${1 - k})`;
        g.beginPath();
        g.ellipse(HX + 30 + k * 70, G2, 10 + k * 100, 4 + k * 6, 0, Math.PI, 0);
        g.stroke();
      } else if (f.kind === "stab") {
        for (const p of targets.slice(0, 1)) {
          g.strokeStyle = `rgba(255,255,255,${1 - k})`;
          g.beginPath();
          g.moveTo(p[0] - 10, p[1] - 30);
          g.lineTo(p[0] + 10, p[1] - 14);
          g.stroke();
          g.beginPath();
          g.moveTo(p[0] + 10, p[1] - 30);
          g.lineTo(p[0] - 10, p[1] - 14);
          g.stroke();
        }
      } else if (f.kind === "bolt") {
        const end = targets[targets.length - 1] ?? [this.W - 20, G2 - 20];
        const t = Math.min(1, k * 2);
        const x = HX + 14 + (end[0] - HX - 14) * t, y = G2 - 24 + (end[1] - 20 - G2 + 24) * t;
        if (projectile === "fireball" && spriteOf("fx.fireball")) drawSprite(g, "fx.fireball", now / 60, x, y + 12);
        else if (projectile === "arrow") {
          g.fillStyle = "#111";
          g.fillRect(Math.round(x) - 7, Math.round(y) - 1, 12, 3);
          g.fillStyle = "#ffe8a0";
          g.fillRect(Math.round(x) - 6, Math.round(y), 10, 1);
        } else if (spriteOf("fx.orb")) drawSprite(g, "fx.orb", now / 80, x, y + 6);
        else {
          g.fillStyle = "#111";
          g.fillRect(x - 3, y - 3, 7, 7);
          g.fillStyle = "#ffc233";
          g.fillRect(x - 2, y - 2, 5, 5);
        }
      } else if (f.kind === "nova") {
        g.strokeStyle = `rgba(143,211,255,${1 - k})`;
        g.beginPath();
        g.arc(HX, G2 - 16, 10 + k * 130, 0, Math.PI * 2);
        g.stroke();
      }
      g.lineWidth = 1;
    }
  };
  function shadow(g, x, y, rx, hover) {
    g.fillStyle = hover ? "rgba(0,0,0,.18)" : "rgba(0,0,0,.32)";
    g.beginPath();
    g.ellipse(x, y, Math.max(4, rx - hover / 3), 2.5, 0, 0, Math.PI * 2);
    g.fill();
  }
  function ring(g, x, y, rx, now) {
    g.strokeStyle = `rgba(255,194,51,${0.55 + 0.35 * Math.sin(now / 180)})`;
    g.lineWidth = 1;
    g.beginPath();
    g.ellipse(x, y, rx, 4, 0, 0, Math.PI * 2);
    g.stroke();
  }
  function hills(g, w2, ground, color, base, amp, off, freq) {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, ground);
    for (let x = 0; x <= w2 + 4; x += 4) g.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin((x + off) * freq) * Math.cos((x + off) * freq * 0.37)));
    g.lineTo(w2, ground);
    g.closePath();
    g.fill();
  }
  function bar(g, x, y, w2, h2, f, color) {
    g.fillStyle = "#111";
    g.fillRect(x - 1, y - 1, w2 + 2, h2 + 2);
    g.fillStyle = "#3a3a3a";
    g.fillRect(x, y, w2, h2);
    g.fillStyle = color;
    g.fillRect(x, y, Math.max(0, Math.min(1, f)) * w2, h2);
  }
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = (c) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
    return "#" + [n >> 16 & 255, n >> 8 & 255, n & 255].map(f).map((c) => c.toString(16).padStart(2, "0")).join("");
  }
  var monsterHeight = (d) => Math.round((d.look.shape === "crab" ? 12 : d.look.shape === "bird" ? 14 : d.look.shape === "blob" ? 14 : 22) * d.look.size);
  function box(g, x, y, w2, h2, c) {
    g.fillStyle = "#111";
    g.fillRect(Math.round(x) - 1, Math.round(y) - 1, Math.round(w2) + 2, Math.round(h2) + 2);
    g.fillStyle = c;
    g.fillRect(Math.round(x), Math.round(y), Math.round(w2), Math.round(h2));
  }
  function drawMonster(g, d, x, y, hit, champ, now) {
    const s = d.look.size;
    const body = hit ? "#ffffff" : d.look.body;
    const dark = hit ? "#dddddd" : shade(d.look.body, -0.3);
    const bob = Math.round(Math.sin(now / 260 + x) * 1);
    if (champ) {
      g.fillStyle = "rgba(255,194,51,0.35)";
      g.fillRect(x - 14 * s, y - 26 * s, 28 * s, 28 * s);
    }
    switch (d.look.shape) {
      case "tall": {
        box(g, x - 5 * s, y - 22 * s + bob, 10 * s, 8 * s, body);
        box(g, x - 6 * s, y - 14 * s + bob, 12 * s, 10 * s, dark);
        box(g, x - 5 * s, y - 4 * s, 3 * s, 4 * s, dark);
        box(g, x + 2 * s, y - 4 * s, 3 * s, 4 * s, dark);
        box(g, x - 9 * s, y - 13 * s + bob, 3 * s, 8 * s, body);
        g.fillStyle = d.look.eye;
        g.fillRect(x - 4 * s, y - 19 * s + bob, 2, 2);
        g.fillRect(x - 1 * s, y - 19 * s + bob, 2, 2);
        break;
      }
      case "crab": {
        box(g, x - 9 * s, y - 9 * s + bob, 18 * s, 7 * s, body);
        box(g, x - 13 * s, y - 13 * s, 5 * s, 4 * s, dark);
        box(g, x + 8 * s, y - 13 * s, 5 * s, 4 * s, dark);
        for (let i = 0; i < 3; i++) {
          g.fillStyle = "#111";
          g.fillRect(x - 8 * s + i * 7 * s, y - 2, 2, 2);
        }
        g.fillStyle = d.look.eye;
        g.fillRect(x - 3 * s, y - 12 * s + bob, 2, 3);
        g.fillRect(x + 2 * s, y - 12 * s + bob, 2, 3);
        break;
      }
      case "bird": {
        const flap = Math.sin(now / 90 + x) > 0 ? -4 : 2;
        const yy = y - 18 * s + bob * 3;
        box(g, x - 5 * s, yy, 10 * s, 6 * s, body);
        box(g, x - 13 * s, yy + flap, 8 * s, 3, dark);
        box(g, x + 5 * s, yy + flap, 8 * s, 3, dark);
        box(g, x - 8 * s, yy + 2, 3, 2, "#ffc233");
        g.fillStyle = d.look.eye;
        g.fillRect(x - 3 * s, yy + 1, 2, 2);
        break;
      }
      case "robe": {
        box(g, x - 4 * s, y - 22 * s + bob, 8 * s, 7 * s, dark);
        g.fillStyle = "#111";
        g.beginPath();
        g.moveTo(x - 9 * s, y);
        g.lineTo(x, y - 17 * s + bob);
        g.lineTo(x + 9 * s, y);
        g.closePath();
        g.fill();
        g.fillStyle = body;
        g.beginPath();
        g.moveTo(x - 8 * s, y - 1);
        g.lineTo(x, y - 15 * s + bob);
        g.lineTo(x + 8 * s, y - 1);
        g.closePath();
        g.fill();
        g.fillStyle = d.look.eye;
        g.fillRect(x - 2 * s, y - 19 * s + bob, 2, 2);
        g.fillRect(x + 1 * s, y - 19 * s + bob, 2, 2);
        break;
      }
      case "blob": {
        box(g, x - 8 * s, y - 12 * s + bob, 16 * s, 12 * s + -bob, body);
        box(g, x - 4 * s, y - 16 * s + bob, 8 * s, 4 * s, dark);
        g.fillStyle = d.look.eye;
        g.fillRect(x - 5 * s, y - 9 * s + bob, 3, 3);
        g.fillRect(x + 2 * s, y - 9 * s + bob, 3, 3);
        break;
      }
      case "giant": {
        box(g, x - 7 * s, y - 34 * s + bob, 14 * s, 10 * s, dark);
        box(g, x - 11 * s, y - 24 * s + bob, 22 * s, 16 * s, body);
        box(g, x - 16 * s, y - 24 * s + bob, 5 * s, 14 * s, dark);
        box(g, x + 11 * s, y - 24 * s + bob, 5 * s, 14 * s, dark);
        box(g, x - 8 * s, y - 8 * s, 6 * s, 8 * s, dark);
        box(g, x + 2 * s, y - 8 * s, 6 * s, 8 * s, dark);
        g.fillStyle = d.look.eye;
        g.fillRect(x - 4 * s, y - 30 * s + bob, 3, 2);
        g.fillRect(x + 2 * s, y - 30 * s + bob, 3, 2);
        break;
      }
    }
  }
  function drawHero(g, x, y, look, walk, hurt, dead) {
    if (dead) {
      box(g, x - 10, y - 5, 20, 5, "#555");
      return;
    }
    const color = look.cape;
    const step2 = walk ? Math.round(Math.sin(walk / 90) * 2) : 0;
    const skin = hurt ? "#ffd0c0" : "#f0c9a0";
    const armour = hurt ? "#e5a0a0" : "#6b7280";
    box(g, x - 7, y - 20, 4, 12, color);
    box(g, x - 3, y - 5, 3, 5 + step2, armour);
    box(g, x + 1, y - 5, 3, 5 - step2, armour);
    box(g, x - 4, y - 16, 9, 11, armour);
    box(g, x - 3, y - 23, 7, 7, skin);
    box(g, x - 4, y - 25, 9, 3, armour);
    g.fillStyle = "#ff5a36";
    g.fillRect(x, y - 13, 2, 3);
    g.fillStyle = "#111";
    g.fillRect(x + 2, y - 21, 1, 2);
    drawWeapon(g, x, y, look.weapon);
    if (look.shield && look.weapon !== "bow") box(g, x - 9, y - 16, 5, 8, "#8a5a2b");
  }
  function drawWeapon(g, x, y, kind) {
    switch (kind) {
      case "bow":
        g.strokeStyle = "#111";
        g.lineWidth = 3;
        g.beginPath();
        g.arc(x + 5, y - 15, 9, -1.2, 1.2);
        g.stroke();
        g.strokeStyle = "#8a5a2b";
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(x + 5, y - 15, 9, -1.2, 1.2);
        g.stroke();
        g.fillStyle = "#e9e4d4";
        g.fillRect(x + 8, y - 23, 1, 16);
        g.lineWidth = 1;
        break;
      case "staff":
        box(g, x + 6, y - 28, 2, 26, "#8a5a2b");
        box(g, x + 5, y - 31, 4, 4, "#19b3a3");
        break;
      case "wand":
        box(g, x + 6, y - 20, 2, 10, "#8a5a2b");
        box(g, x + 5, y - 23, 4, 3, "#ff5a36");
        break;
      case "axe":
      case "greataxe":
        box(g, x + 6, y - 26, 2, 16, "#8a5a2b");
        box(g, x + 8, y - 26, kind === "greataxe" ? 6 : 4, 6, "#c9ced6");
        break;
      case "mace":
        box(g, x + 6, y - 22, 2, 12, "#8a5a2b");
        box(g, x + 4, y - 26, 6, 5, "#9aa4b2");
        break;
      case "dagger":
        box(g, x + 6, y - 18, 2, 8, "#c9ced6");
        box(g, x + 4, y - 11, 6, 2, "#ffc233");
        break;
      case "none":
        break;
      default:
        box(g, x + 6, y - (kind === "greatsword" ? 30 : 24), kind === "greatsword" ? 3 : 2, kind === "greatsword" ? 20 : 14, "#c9ced6");
        box(g, x + 4, y - 11, 6, 2, "#ffc233");
    }
  }
  function fmtShort(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e4) return Math.round(n / 1e3) + "k";
    return Math.round(n).toString();
  }

  // src/ui/css.ts
  var CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
[hidden] { display: none !important; }
.hm {
  --paper: #f6ecd6; --paper2: #ecd9b0; --card: #fffaf0; --nav: #efe1c1; --text: #1a1410; --muted: #6b5d4b; --line: #1a1410; --ink: #1a1410;
  --ember: #ff5a36; --gold: #ffc233; --teal: #19b3a3; --blue: #3a7bff; --violet: #8b5cf6; --green: #3fbf5f; --red: #e5383b;
  --r-plain: #d8d2c6; --r-enchanted: #5aa9ff; --r-rare: #ffd23f; --r-relic: #ff8a1f;
  --sh: 4px 4px 0 var(--line);
  --display: Bahnschrift, "DIN Alternate", "Arial Narrow", "Segoe UI", sans-serif;
  --body: "Segoe UI", system-ui, -apple-system, sans-serif;
  --mono: "Cascadia Mono", Consolas, "Courier New", monospace;
  font: 13px/1.4 var(--body); color: var(--text);
}
.hm.dark { --paper: #221b15; --paper2: #2d241c; --card: #30271f; --nav: #1a1410; --text: #f3e7d3; --muted: #b5a48b; --line: #050403;
  --r-plain: #8f877b; }
.cap { font-family: var(--display); font-stretch: condensed; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }

/* ---- frame ---- */
.win {
  position: fixed; z-index: 10050; display: grid; grid-template-rows: auto auto auto minmax(0, 1fr);
  min-width: 380px; min-height: 340px; background: var(--paper); border: 3px solid var(--line);
  box-shadow: 8px 8px 0 var(--line); overflow: hidden; container: win / inline-size;
}
.win:focus { outline: none; }
.win.flash { animation: flash .5s cubic-bezier(.2,.8,.3,1); }
@keyframes flash { 0% { box-shadow: 8px 8px 0 var(--line), 0 0 0 6px var(--gold); } 100% { box-shadow: 8px 8px 0 var(--line), 0 0 0 0 var(--gold); } }
.bar { display: flex; align-items: center; gap: 10px; height: 34px; padding-right: 5px; background: var(--ember); color: #1a1410;
  border-bottom: 3px solid var(--line); cursor: move; user-select: none; touch-action: none; }
.logo { align-self: stretch; display: flex; align-items: center; padding: 0 11px; background: #1a1410; color: var(--ember);
  font: 700 16px/1 var(--display); font-stretch: condensed; letter-spacing: 2.5px; text-transform: uppercase; }
.who { flex: 1; min-width: 0; display: flex; align-items: baseline; gap: 9px; white-space: nowrap; overflow: hidden; }
.who b { font: 700 15px/1 var(--display); font-stretch: condensed; text-transform: uppercase; letter-spacing: .6px; }
.who span { font-weight: 600; font-size: 12px; overflow: hidden; text-overflow: ellipsis; }
.ctls { display: flex; gap: 5px; }
.ctl { width: 26px; height: 24px; padding: 0; display: grid; place-items: center; cursor: pointer; background: #fff4dc; color: #1a1410;
  border: 2px solid #1a1410; box-shadow: 2px 2px 0 #1a1410; }
.ctl:hover { background: var(--gold); }
.ctl.x:hover { background: #1a1410; color: var(--ember); }
.ctl:active { transform: translate(2px, 2px); box-shadow: none; }
button:focus-visible, select:focus-visible, input:focus-visible, textarea:focus-visible, .win:focus-visible { outline: 3px dashed var(--ember); outline-offset: 2px; }
.grip { position: absolute; right: 0; bottom: 0; width: 18px; height: 18px; cursor: nwse-resize; touch-action: none; z-index: 4;
  background: linear-gradient(135deg, transparent 50%, var(--line) 50%, var(--line) 60%, transparent 60%, transparent 70%, var(--line) 70%, var(--line) 80%, transparent 80%); }
.win.max .grip { display: none; }

/* stage + HUD */
.top { border-bottom: 3px solid var(--line); }
.stage { position: relative; background: #111; overflow: hidden; min-height: 60px; }
.stage canvas { position: absolute; left: 0; top: 0; image-rendering: pixelated; display: block; }
.top.nostage { display: none; }
.hudw { background: #1a1410; border-bottom: 3px solid var(--line); line-height: 0; overflow: hidden; }
.hudw canvas { display: block; image-rendering: pixelated; }

/* nav rail + content */
.main { display: grid; grid-template-columns: 124px minmax(0, 1fr); min-height: 0; }
.nav { display: flex; flex-direction: column; background: var(--nav); border-right: 3px solid var(--line); overflow: auto; scrollbar-width: none; }
.nav button { position: relative; display: grid; grid-template-columns: 16px 1fr auto; align-items: center; gap: 8px; padding: 8px 10px 8px 12px;
  background: transparent; color: var(--text); border: 0; border-bottom: 2px solid var(--line); cursor: pointer; text-align: left;
  font: 700 14px/1 var(--display); font-stretch: condensed; letter-spacing: 1.2px; text-transform: uppercase; }
.nav button svg { opacity: .8; }
.nav button .key { font: 700 10px/1 var(--mono); color: var(--muted); }
.nav button:hover:not(.on) { background: var(--paper2); }
.nav button.on { background: var(--gold); color: #1a1410; box-shadow: inset 5px 0 0 #1a1410; }
.nav button.on svg { opacity: 1; } .nav button.on .key { color: #1a1410; }
.nav .badge { position: absolute; right: 26px; top: 50%; transform: translateY(-50%); min-width: 17px; height: 15px; padding: 0 3px; background: var(--ember); color: #1a1410;
  border: 2px solid var(--line); font: 800 9px/11px var(--mono); text-align: center; }
.body { overflow: auto; padding: 14px 16px 22px; min-width: 0; position: relative; scrollbar-width: thin; scrollbar-color: var(--line) transparent; }
.body::-webkit-scrollbar { width: 12px; } .body::-webkit-scrollbar-thumb { background: var(--line); border: 3px solid var(--paper); }
.win.creating .top, .win.creating .hudw, .win.creating .nav { display: none; }
.win.creating .main { grid-template-columns: 1fr; }

/* mini mode: a strip that keeps playing */
.minibox { display: none; }
.win.mini { grid-template-rows: auto auto; min-width: 0; min-height: 0; box-shadow: 6px 6px 0 var(--line); }
.win.mini .top, .win.mini .main, .win.mini .grip, .win.mini .who span, .win.mini .ctl.sz, .win.mini .ctl.mx { display: none; }
.win.mini .logo { font-size: 13px; letter-spacing: 1.5px; padding: 0 8px; }
.win.mini .hudw { border-bottom: 0; }
.win.mini .minibox:has(.mlast:empty) { display: none; }
.win.mini .minibox { display: block; padding: 5px 9px 6px; background: var(--paper2); }
.minibox .mlast { font-size: 11px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.minibox .mlast:empty { display: none; }

/* one column when the window is narrow */
@container win (max-width: 640px) {
  .main { grid-template-columns: 1fr; grid-template-rows: auto minmax(0, 1fr); }
  .nav { flex-direction: row; border-right: 0; border-bottom: 3px solid var(--line); overflow-x: auto; }
  .nav button { flex: 1 0 auto; grid-template-columns: auto; justify-items: center; padding: 8px 10px; border-bottom: 0; border-right: 2px solid var(--line); }
  .nav button .lbl, .nav button .key { display: none; }
  .nav button.on { box-shadow: inset 0 -5px 0 #1a1410; }
  .nav .badge { right: 1px; top: 1px; transform: none; min-width: 15px; }
}

/* toasts */
.toasts { position: absolute; left: 136px; bottom: 14px; display: flex; flex-direction: column; gap: 6px; z-index: 6; pointer-events: none; max-width: calc(100% - 160px); }
.win.mini .toasts, .win.creating .toasts { left: 10px; max-width: calc(100% - 20px); }
@container win (max-width: 640px) { .toasts { left: 12px; max-width: calc(100% - 24px); } }
.toast { background: var(--card); color: var(--text); border: 3px solid var(--line); box-shadow: 4px 4px 0 var(--line); padding: 6px 11px;
  font: 700 13px/1.2 var(--display); font-stretch: condensed; text-transform: uppercase; letter-spacing: .6px; animation: tin .22s cubic-bezier(.2,.8,.3,1); }
.toast.out { animation: tout .22s ease forwards; }
.toast.t-rare { background: var(--r-rare); color: #1a1410; } .toast.t-relic { background: var(--r-relic); color: #1a1410; }
.toast.t-enchanted { background: var(--r-enchanted); color: #1a1410; } .toast.t-level { background: #1a1410; color: var(--gold); }
.toast.t-road { background: var(--teal); color: #1a1410; } .toast.t-err { background: var(--ember); color: #1a1410; }
@keyframes tin { from { transform: translateX(-14px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes tout { to { transform: translateX(-14px); opacity: 0; } }

/* ---- content ---- */
.row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.col { display: flex; flex-direction: column; gap: 8px; }
.grow { flex: 1; }
.card { background: var(--card); border: 3px solid var(--line); box-shadow: var(--sh); padding: 9px 11px; min-width: 0; }
.card h3 { margin: 0 0 7px; font: 700 13px/1.1 var(--display); font-stretch: condensed; text-transform: uppercase; letter-spacing: 1.4px; }
.card > h3:first-child { margin: -9px -11px 9px; padding: 7px 11px 6px; background: var(--paper2); border-bottom: 3px solid var(--line); }
.btn { cursor: pointer; font: 700 13px/1 var(--display); font-stretch: condensed; text-transform: uppercase; letter-spacing: .9px; padding: 7px 12px 6px;
  background: var(--gold); color: #1a1410; border: 3px solid var(--line); box-shadow: 3px 3px 0 var(--line); }
.btn:hover { transform: translate(-1px, -1px); box-shadow: 4px 4px 0 var(--line); }
.btn:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 var(--line); }
.btn.alt { background: var(--card); color: var(--text); }
.btn.hot { background: var(--ember); color: #1a1410; }
.btn:disabled { opacity: .45; cursor: default; transform: none; box-shadow: 3px 3px 0 var(--line); }
.x { cursor: pointer; background: var(--card); color: var(--text); border: 2px solid var(--line); width: 24px; height: 24px; font-weight: 900; box-shadow: 2px 2px 0 var(--line); padding: 0; }
.x:hover { background: var(--gold); color: #1a1410; }
.tag { display: inline-block; font: 700 11px/1.3 var(--display); font-stretch: condensed; letter-spacing: .8px; padding: 1px 6px; border: 2px solid var(--line); background: var(--paper2); text-transform: uppercase; }
.muted { color: var(--muted); }
.num { font-variant-numeric: tabular-nums; font-family: var(--mono); }
.kv { display: grid; grid-template-columns: 1fr auto; gap: 0 12px; }
.kv > * { padding: 2px 0; border-bottom: 1px dashed color-mix(in srgb, var(--line) 18%, transparent); }
.kv > :nth-child(odd) { color: var(--muted); }
.kv > :nth-child(even) { text-align: right; font-weight: 700; }
.kv .click { cursor: pointer; text-decoration: underline dotted; text-underline-offset: 3px; }
.kv .click:hover { color: var(--text); }
.big { font: 700 26px/1 var(--display); font-stretch: condensed; letter-spacing: .5px; }
.grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 14px; align-items: start; }
.slots { display: grid; grid-template-columns: repeat(4, 56px); gap: 6px; }
.cell { position: relative; width: 56px; height: 56px; border: 3px solid var(--line); background: var(--card); cursor: pointer; display: flex; align-items: center; justify-content: center; }
.cell:hover { transform: translate(-1px, -1px); box-shadow: 3px 3px 0 var(--line); }
.cell canvas { width: 36px; height: 36px; image-rendering: pixelated; }
.cell .lbl { position: absolute; bottom: 1px; left: 3px; font: 700 9px/1 var(--display); font-stretch: condensed; letter-spacing: .5px; color: var(--muted); text-transform: uppercase; }
.cell.sel { outline: 3px solid var(--ember); outline-offset: 1px; }
.cell.plain { background: var(--r-plain); } .cell.enchanted { background: var(--r-enchanted); } .cell.rare { background: var(--r-rare); } .cell.relic { background: var(--r-relic); }
.cell.plain .lbl, .cell.enchanted .lbl, .cell.rare .lbl, .cell.relic .lbl { color: #1a1410; }
.cell.empty { cursor: default; background: repeating-linear-gradient(45deg, var(--paper), var(--paper) 6px, var(--paper2) 6px, var(--paper2) 12px); }
.cell.empty:hover { transform: none; box-shadow: none; }
.stash { display: grid; grid-template-columns: repeat(auto-fill, 48px); gap: 5px; }
.stash .cell { width: 48px; height: 48px; }
.stash .cell canvas { width: 30px; height: 30px; }
.item { min-width: 220px; }
.item .name { font: 700 15px/1.15 var(--display); font-stretch: condensed; letter-spacing: .4px; padding: 6px 9px 5px; border-bottom: 3px solid var(--line); margin: -9px -11px 7px; }
.item .name.plain { background: var(--r-plain); color: #1a1410; } .item .name.enchanted { background: var(--r-enchanted); color: #1a1410; }
.item .name.rare { background: var(--r-rare); color: #1a1410; } .item .name.relic { background: var(--r-relic); color: #1a1410; }
.item .aff { font-size: 12px; }
.item .aff b { font: 700 9px var(--mono); color: var(--muted); margin-left: 5px; }
.item hr { border: 0; border-top: 2px dashed var(--line); margin: 7px 0; }
.up { color: var(--green); font-weight: 800; } .down { color: var(--red); font-weight: 800; }
.hm.dark .up { color: #6fe08a; } .hm.dark .down { color: #ff6b6d; }
.skill { display: flex; gap: 8px; align-items: flex-start; padding: 7px 9px; border: 3px solid var(--line); background: var(--card); cursor: pointer; box-shadow: 3px 3px 0 var(--line); }
.skill:hover:not(.locked):not(.on) { background: var(--paper2); }
.skill.on { background: var(--gold); color: #1a1410; }
.skill.on .muted { color: #4d4030; }
.skill.locked { opacity: .5; cursor: default; }
.skill .nm { font: 700 15px/1.1 var(--display); font-stretch: condensed; letter-spacing: .4px; text-transform: uppercase; }
.skill .ds { font-size: 11.5px; }
.zone { display: flex; gap: 8px; align-items: center; padding: 7px 9px; border: 3px solid var(--line); background: var(--card); cursor: pointer; margin-bottom: 6px; }
.zone:hover:not(.locked):not(.on) { background: var(--paper2); }
.zone.on { background: var(--teal); color: #1a1410; }
.zone.on .muted { color: #16433e; }
.zone.locked { opacity: .45; cursor: default; }
.log .entry { display: flex; gap: 8px; align-items: baseline; padding: 4px 0; border-bottom: 1px dashed color-mix(in srgb, var(--line) 25%, transparent); font-size: 12px; }
.log .entry .tag { flex: none; min-width: 52px; text-align: center; }
.log .when { flex: none; font-size: 10.5px; }

/* section headers outside cards, flat lists, chips */
.sec { display: flex; align-items: baseline; gap: 8px; margin: 0 0 7px; font: 700 14px/1 var(--display); font-stretch: condensed; text-transform: uppercase; letter-spacing: 1.5px; }
.sec .muted { font: 600 11px/1 var(--body); text-transform: none; letter-spacing: 0; }
.card h3.split { display: flex; justify-content: space-between; align-items: baseline; }
.card h3.split .num { font-size: 12px; letter-spacing: 0; }
.list { background: var(--card); border: 3px solid var(--line); box-shadow: var(--sh); }
.li { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 3px 12px; padding: 8px 10px; border-bottom: 2px solid var(--line); cursor: pointer; }
.li:last-child { border-bottom: 0; }
.li:hover:not(.locked):not(.on), .li:focus-visible { background: var(--paper2); outline: none; }
.li.on { background: var(--gold); color: #1a1410; cursor: default; }
.li.on .tag { border-color: #1a1410; }
.li.locked { cursor: default; opacity: .5; }
.li .nm { font: 700 15px/1.1 var(--display); font-stretch: condensed; text-transform: uppercase; letter-spacing: .4px; }
.li .meta { grid-column: 2; grid-row: 1 / span 3; display: flex; align-items: flex-start; justify-content: flex-end; text-align: right; }
.li .ds { grid-column: 1; font-size: 11.5px; }
.li .tags { grid-column: 1; display: flex; gap: 4px; flex-wrap: wrap; margin-top: 2px; }
.li .tags .tag { font-size: 10px; padding: 0 5px; }
.delta { font: 700 12px/1 var(--mono); }
.li.on .up { color: #146b2c; } .li.on .down { color: #9e1d1f; }
.chips { display: flex; gap: 4px; flex-wrap: wrap; }
.chip { font: 700 12px/1 var(--display); font-stretch: condensed; text-transform: uppercase; letter-spacing: .8px; padding: 5px 8px 4px;
  border: 2px solid var(--line); background: var(--card); color: var(--text); cursor: pointer; }
.chip:hover:not(.on) { background: var(--paper2); }
.chip.on { background: var(--text); color: var(--paper); }
.chip b { font: 700 10px/1 var(--mono); margin-left: 5px; opacity: .75; }

/* gear: equipped and stash on the left, the picked item stays in view on the right */
.gear { display: grid; grid-template-columns: minmax(0, 1fr) minmax(250px, 330px); gap: 14px; align-items: start; }
.gear .side { position: sticky; top: 0; }
.gear select { padding: 3px 6px; font-size: 12px; }
@container win (max-width: 820px) { .gear { grid-template-columns: 1fr; } .gear .side { position: static; } }
.cell.upg::after { content: ""; position: absolute; right: -3px; top: -3px; border-style: solid; border-width: 0 14px 14px 0; border-color: transparent var(--green) transparent transparent; }
.cell.upg::before { content: ""; position: absolute; right: -3px; top: -3px; border-style: solid; border-width: 0 17px 17px 0; border-color: transparent var(--line) transparent transparent; }
.cell.req canvas { opacity: .4; }
.cell.req { filter: saturate(.4); }
.hint h3 { margin-bottom: 7px; }
.modal { position: absolute; inset: 0; background: rgba(26, 20, 16, .55); display: flex; align-items: center; justify-content: center; z-index: 5; padding: 16px; }
.modal .card { max-width: 460px; width: 100%; max-height: 100%; overflow: auto; animation: pop .2s cubic-bezier(.2,.8,.3,1); }
@keyframes pop { from { transform: translateY(8px); opacity: 0; } to { transform: none; opacity: 1; } }
input[type=text], textarea, select { font: inherit; padding: 5px 7px; border: 3px solid var(--line); background: var(--card); color: var(--text); }
textarea { width: 100%; min-height: 70px; font-family: var(--mono); font-size: 11px; }
label.chk { display: flex; gap: 6px; align-items: center; cursor: pointer; font-weight: 700; }
input[type=checkbox] { accent-color: var(--ember); width: 15px; height: 15px; }
.progress { height: 18px; border: 3px solid var(--line); background: var(--card); } .progress i { display: block; height: 100%; background: var(--teal); }
.story { font-style: italic; border-left: 6px solid var(--ember); padding-left: 9px; }
@media (prefers-reduced-motion: reduce) { .hm *, .hm *::before, .hm *::after { animation: none !important; transition: none !important; } }
`;

  // src/ui/dom.ts
  function h(tag, props = null, ...children) {
    const el = document.createElement(tag);
    if (props) {
      if (props.class) el.className = props.class;
      if (props.text !== void 0) el.textContent = String(props.text);
      if (props.title) el.title = props.title;
      if (props.style) el.setAttribute("style", props.style);
      if (props.attrs) for (const [k, v] of Object.entries(props.attrs)) el.setAttribute(k, v);
      if (props.on) for (const [k, fn] of Object.entries(props.on)) el.addEventListener(k, fn);
    }
    for (const c of children) if (c !== null && c !== void 0 && c !== false) el.append(typeof c === "object" ? c : String(c));
    return el;
  }
  var clear = (el) => {
    while (el.firstChild) el.removeChild(el.firstChild);
  };
  function fmt(n) {
    if (!isFinite(n)) return "-";
    const a = Math.abs(n);
    if (a >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (a >= 1e6) return (n / 1e6).toFixed(2) + "M";
    if (a >= 1e4) return (n / 1e3).toFixed(1) + "k";
    if (a >= 100 || Number.isInteger(n)) return Math.round(n).toString();
    if (a >= 10) return n.toFixed(1);
    return n.toFixed(2).replace(/\.?0+$/, "") || "0";
  }
  function fmtDuration(ms) {
    const s = Math.floor(ms / 1e3);
    const d = Math.floor(s / 86400), hh = Math.floor(s % 86400 / 3600), mm = Math.floor(s % 3600 / 60);
    if (d) return `${d}d ${hh}h`;
    if (hh) return `${hh}h ${mm}m`;
    if (mm) return `${mm}m`;
    return `${s}s`;
  }
  var pct = (x, digits = 0) => (x * 100).toFixed(digits) + "%";

  // src/ui/glyphs.ts
  var SVG_NS = "http://www.w3.org/2000/svg";
  var BITMAPS = {
    hero: [
      "..#####..",
      ".#######.",
      "##.....##",
      "##.#.#.##",
      "##.....##",
      ".#######.",
      "..#...#..",
      ".###.###.",
      "#########"
    ],
    gear: [
      ".......##",
      "......###",
      ".....###.",
      "....###..",
      "#..###...",
      "##.##....",
      ".###.....",
      ".####....",
      "##..#...."
    ],
    forge: [
      ".........",
      "#######..",
      "#########",
      ".#######.",
      "...###...",
      "...###...",
      "..#####..",
      ".#######.",
      "........."
    ],
    skills: [
      "....#....",
      "...##....",
      "...###...",
      "..####.#.",
      ".#######.",
      ".###.###.",
      "###...###",
      "###...###",
      ".#######."
    ],
    tree: [
      "###......",
      "###......",
      ".#.......",
      "..#...###",
      "...####.#",
      "......###",
      ".....#...",
      "....###..",
      "....###.."
    ],
    world: [
      "##.......",
      "######...",
      "########.",
      "######...",
      "##.......",
      "##.......",
      "##.......",
      "##.......",
      "####....."
    ],
    atlas: [
      "....#....",
      "....#....",
      "...###...",
      "..#####..",
      "#########",
      "..#####..",
      "...###...",
      "....#....",
      "....#...."
    ],
    log: [
      "#######..",
      "#.....#..",
      "#.###.#..",
      "#.....#..",
      "#.####.##",
      "#......##",
      "#.###..##",
      "#......#.",
      "########."
    ],
    menu: [
      ".........",
      "#########",
      "#########",
      ".........",
      "#########",
      "#########",
      ".........",
      "#########",
      "#########"
    ],
    min: [
      ".......",
      ".......",
      ".......",
      ".......",
      ".......",
      "#######",
      "#######"
    ],
    max: [
      "#######",
      "#######",
      "#.....#",
      "#.....#",
      "#.....#",
      "#.....#",
      "#######"
    ],
    restore: [
      "..#####",
      "..#####",
      "#####.#",
      "#####.#",
      "#...###",
      "#...#..",
      "#####.."
    ],
    close: [
      "##...##",
      "###.###",
      ".#####.",
      "..###..",
      ".#####.",
      "###.###",
      "##...##"
    ],
    sound: [
      "..#..#.",
      ".##...#",
      "###.#.#",
      "###.#.#",
      "###.#.#",
      ".##...#",
      "..#..#."
    ],
    mute: [
      "..#....",
      ".##....",
      "###.#.#",
      "###..#.",
      "###.#.#",
      ".##....",
      "..#...."
    ],
    stage: [
      "#######",
      "#.....#",
      "#.#...#",
      "#.##..#",
      "#.###.#",
      "#.....#",
      "#######"
    ]
  };
  function glyph(name, size = 16) {
    const rows = BITMAPS[name];
    const n = rows.length;
    let d = "";
    rows.forEach((row, y) => {
      let x = 0;
      while (x < row.length) {
        if (row[x] !== "#") {
          x++;
          continue;
        }
        let end = x;
        while (end < row.length && row[end] === "#") end++;
        d += `M${x} ${y}h${end - x}v1h-${end - x}z`;
        x = end;
      }
    });
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${n} ${n}`);
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("shape-rendering", "crispEdges");
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    path.setAttribute("fill", "currentColor");
    svg.append(path);
    return svg;
  }

  // src/ui/icons.ts
  var P = { k: "#111111", a: "#c9ced6", b: "#8a5a2b", c: "#ff5a36", w: "#ffffff", g: "#ffc233", t: "#19b3a3", v: "#8b5cf6" };
  var ICONS = {
    sword: ["..........kk", ".........kwk", "........kwak", ".......kwak.", "......kwak..", ".....kwak...", "..k.kwak....", "..kkkak.....", "...kgk......", "..kbkkk.....", ".kbk..k.....", ".kk........."],
    axe: ["....kkkk....", "...kaaaak...", "..kwaaaak...", "..kwaakbk...", "...kkkbk....", ".....kbk....", "....kbk.....", "....kbk.....", "...kbk......", "...kbk......", "..kbk.......", "..kk........"],
    mace: [".....kkk....", "....kakak...", "...kawaaak..", "...kaaaaak..", "....kakak...", ".....kbk....", ".....kbk....", ".....kbk....", ".....kbk....", ".....kbk....", ".....kgk....", ".....kkk...."],
    dagger: ["............", "........kk..", ".......kwk..", "......kwak..", ".....kwak...", "....kwak....", "..k.kak.....", "..kkgk......", "...kbk......", "..kbk.......", "..kk........", "............"],
    greatsword: [".........kkk", "........kwak", ".......kwak.", "......kwak..", ".....kwak...", "....kwak....", "...kwak.....", ".kkkak......", ".kgggk......", "..kbk.......", ".kbk........", ".kk........."],
    greataxe: ["...kkkkk....", "..kaaaaak...", ".kwaaaaakk..", ".kwaaakbk...", "..kaaakbk...", "...kkkbk....", ".....kbk....", "....kbk.....", "....kbk.....", "...kbk......", "...kbk......", "...kk......."],
    staff: ["....kkk.....", "...kttk.....", "...ktwtk....", "....kttk....", "....kbk.....", "....kbk.....", "...kbk......", "...kbk......", "...kbk......", "..kbk.......", "..kbk.......", "..kk........"],
    bow: ["...kk.......", "...kbk......", "....kbk....k", "....kbk...kw", ".....kbk.kw.", ".....kbkkw..", ".....kbkw...", ".....kbk.w..", "....kbk...w.", "....kbk....w", "...kbk......", "...kk......."],
    wand: ["........kkk.", ".......kcwk.", ".......kcck.", "......kbkk..", ".....kbk....", "....kbk.....", "...kbk......", "..kbk.......", ".kbk........", ".kk.........", "............", "............"],
    shield: ["kkkkkkkkkkk.", "kaaaaaaaaak.", "kaccaaaccak.", "kacccccccak.", "kaacccccaak.", "kaaacccaaak.", "kaaaacaaaak.", ".kaaaaaaak..", "..kaaaaak...", "...kaaak....", "....kkk.....", "............"],
    buckler: ["............", "...kkkkk....", "..kbbbbbk...", ".kbbgggbbk..", ".kbgbbbgbk..", ".kbgbwbgbk..", ".kbgbbbgbk..", ".kbbgggbbk..", "..kbbbbbk...", "...kkkkk....", "............", "............"],
    focus: ["............", "....kkkk....", "...kvvvvk...", "..kvwvvvvk..", "..kvvvvvvk..", "..kvvvvvvk..", "...kvvvvk...", "....kkkk....", "...kgggk....", "..kgggggk...", "..kkkkkkk...", "............"],
    quiver: [".....k.k.k..", ".....kwkwk..", "....kbbbbk..", "....kbbbbk..", "...kbbcbk...", "...kbbcbk...", "..kbbcbk....", "..kbbbbk....", ".kbbbbk.....", ".kbbbk......", ".kkkk.......", "............"],
    helmet: ["............", "...kkkkkk...", "..kaaaaaak..", ".kawaaaaaak.", ".kaaaaaaaak.", ".kakkkkkkak.", ".kak....kak.", ".kak....kak.", ".kkk....kkk.", "............", "............", "............"],
    body: ["..kk....kk..", ".kaak..kaak.", "kaaaakkaaaak", "kaaaaaaaaaak", ".kkaaaaaakk.", "..kaaccaak..", "..kaaccaak..", "..kaaaaaak..", "..kaaaaaak..", "..kkkkkkkk..", "............", "............"],
    gloves: ["............", "..k.k.k.....", ".kakakak....", ".kakakakk...", ".kaaaaakak..", ".kaaaaaaak..", ".kaaaaaak...", ".kaaaaak....", ".kbbbbbk....", ".kkkkkkk....", "............", "............"],
    boots: ["............", "...kkkk.....", "...kaak.....", "...kaak.....", "...kaak.....", "...kaak.....", "...kaakkkk..", "...kaaaaaak.", "...kaaaaaak.", "...kkkkkkkk.", "............", "............"],
    belt: ["............", "............", "............", "kkkkkkkkkkkk", "kbbbbkkkbbbk", "kbbbbkgkbbbk", "kbbbbkkkbbbk", "kkkkkkkkkkkk", "............", "............", "............", "............"],
    amulet: ["..kkkkkkkk..", ".k........k.", ".k........k.", "..k......k..", "...k....k...", "....kkkk....", "...kggggk...", "..kgcccgk...", "..kgcwcgk...", "..kgcccgk...", "...kgggk....", "....kkk....."],
    ring: ["............", "....kkkk....", "...kcwcck...", "....kkkk....", "...kgggk....", "..kg...gk...", "..kg...gk...", "..kg...gk...", "...kgggk....", "....kkk.....", "............", "............"]
  };
  var KIND_TINT = { plate: "#c9ced6", leather: "#b07b45", silk: "#b9a4ff", brigand: "#8fa3a0" };
  var cache3 = /* @__PURE__ */ new Map();
  function iconFor(kind, slot) {
    const key = kind + ":" + slot;
    let c = cache3.get(key);
    if (!c) {
      c = document.createElement("canvas");
      c.width = 12;
      c.height = 12;
      const g = c.getContext("2d");
      const art = ICONS[kind] ?? ICONS[slot === "ring1" || slot === "ring2" ? "ring" : slot] ?? ICONS.ring;
      const tint = KIND_TINT[kind];
      art.forEach((row, y) => [...row].forEach((ch, x) => {
        if (ch === ".") return;
        g.fillStyle = ch === "a" && tint ? tint : P[ch] ?? "#f0f";
        g.fillRect(x, y, 1, 1);
      }));
      cache3.set(key, c);
    }
    const out = document.createElement("canvas");
    out.width = 12;
    out.height = 12;
    out.getContext("2d").drawImage(c, 0, 0);
    return out;
  }

  // src/ui/hud.ts
  var HUD_H = 44;
  var INK = "#1a1410";
  var CREAM = "#f3e7d3";
  var GOLD = "#ffc233";
  var Hud = class {
    canvas;
    g;
    w = 320;
    constructor() {
      this.canvas = document.createElement("canvas");
      this.canvas.height = HUD_H;
      this.g = this.canvas.getContext("2d");
    }
    /** Logical width in HUD pixels (the CSS width divided by the pixel scale). */
    resize(w2) {
      w2 = Math.max(200, Math.round(w2));
      if (w2 === this.w && this.canvas.width === w2) return;
      this.w = w2;
      this.canvas.width = w2;
    }
    draw(d, now) {
      const g = this.g, W2 = this.w;
      g.imageSmoothingEnabled = false;
      g.fillStyle = INK;
      g.fillRect(0, 0, W2, HUD_H);
      g.fillStyle = "#241c16";
      g.fillRect(44, 10, W2 - 88, HUD_H - 12);
      g.fillStyle = "#2f251d";
      for (let x = 50; x < W2 - 50; x += 12) g.fillRect(x, HUD_H - 4, 2, 2);
      const bx = 46, bw = W2 - 92, by = 2;
      g.fillStyle = "#000";
      g.fillRect(bx - 1, by - 1, bw + 2, 7);
      g.fillStyle = "#3a2f25";
      g.fillRect(bx, by, bw, 5);
      g.fillStyle = GOLD;
      g.fillRect(bx, by, Math.round(bw * clamp01(d.xpFrac)), 5);
      g.fillStyle = "#fff0b8";
      g.fillRect(bx, by, Math.round(bw * clamp01(d.xpFrac)), 1);
      g.fillStyle = "#000";
      for (let i = 1; i < 10; i++) g.fillRect(bx + Math.round(bw * i / 10), by, 1, 5);
      this.globe(22, 24, 19, d.lifeMax ? d.life / d.lifeMax : 0, d.dead ? "#5a2a2a" : "#e5383b", "#9e1d1f", "#ff8a8c", now, 0);
      if (d.esMax > 0) this.ring(22, 24, 21, d.es / d.esMax, "#7fd1ff");
      this.globe(W2 - 22, 24, 19, d.manaMax ? d.mana / d.manaMax : 0, "#3a7bff", "#1f47a8", "#9dbbff", now, 1.7);
      const lifeTxt = fmt(Math.floor(Math.max(0, d.life)));
      drawText(g, lifeTxt, 22, 20, CREAM, "center");
      drawText(g, fmt(Math.floor(Math.max(0, d.mana))), W2 - 22, 20, CREAM, "center");
      if (d.esMax > 0 && d.es > 0) drawText(g, fmt(Math.floor(d.es)), 22, 30, "#bfe9ff", "center");
      const cx = Math.round(W2 / 2), row = 12;
      this.flask(cx - 36, row, d.flaskMax ? d.flask / d.flaskMax : 0);
      this.skill(cx - 14, row, d);
      this.level(cx + 18, row, d.level);
      const leftRoom = cx - 40 - 48, rightRoom = W2 - 48 - (cx + 50);
      if (leftRoom >= 60) {
        const z = fit(d.zone.toUpperCase(), leftRoom - 4);
        drawText(g, z, 48, 13, CREAM);
        drawText(g, `AREA ${d.zoneLevel}`, 48, 24, "#b5a48b");
        drawText(g, `${fmt(d.packDps)} DPS`, 48, 33, GOLD);
      }
      if (rightRoom >= 60) {
        const rx = W2 - 48;
        drawText(g, `${Math.floor(d.xpFrac * 100)}% XP`, rx, 13, GOLD, "right");
        if (d.eta) drawText(g, fit(d.eta.toUpperCase(), rightRoom - 4), rx, 24, "#b5a48b", "right");
      }
    }
    /** A glass globe: black rim, liquid to `f` with a moving surface, a highlight. */
    globe(cx, cy, r3, f, col, deep, surf, now, phase) {
      const g = this.g;
      f = clamp01(f);
      const top = cy - r3, level = cy + r3 - Math.round(2 * r3 * f);
      for (let y = -r3 - 2; y <= r3 + 2; y++) {
        const half = Math.floor(Math.sqrt(Math.max(0, (r3 + 2) * (r3 + 2) - y * y)));
        g.fillStyle = "#000";
        g.fillRect(cx - half, cy + y, half * 2 + 1, 1);
      }
      for (let y = -r3; y <= r3; y++) {
        const half = Math.floor(Math.sqrt(Math.max(0, r3 * r3 - y * y)));
        if (!half) continue;
        const py = cy + y;
        g.fillStyle = "#2a211b";
        g.fillRect(cx - half, py, half * 2 + 1, 1);
        for (let x = -half; x <= half; x++) {
          const wave = f > 0 && f < 1 ? Math.round(Math.sin((x + now / 180 + phase * 10) * 0.35) * 1.2) : 0;
          const surface = level + wave;
          if (py < surface) continue;
          g.fillStyle = py === surface ? surf : py > cy + r3 * 0.45 ? deep : col;
          g.fillRect(cx + x, py, 1, 1);
        }
      }
      g.fillStyle = "rgba(255,255,255,.55)";
      g.fillRect(cx - r3 + 5, top + 6, 2, 5);
      g.fillRect(cx - r3 + 7, top + 4, 3, 2);
    }
    /** Energy shield: a pale ring around the life globe, filled clockwise from the bottom. */
    ring(cx, cy, r3, f, col) {
      const g = this.g;
      f = clamp01(f);
      g.fillStyle = col;
      for (let y = -r3 - 1; y <= r3 + 1; y++) for (let x = -r3 - 1; x <= r3 + 1; x++) {
        const d = Math.sqrt(x * x + y * y);
        if (d < r3 - 0.5 || d > r3 + 1.2) continue;
        const a = (Math.atan2(x, y) + Math.PI) / (2 * Math.PI);
        if (1 - a <= f) g.fillRect(cx + x, cy + y, 1, 1);
      }
    }
    box(x, y, w2, h2, bg) {
      const g = this.g;
      g.fillStyle = "#000";
      g.fillRect(x - 1, y - 1, w2 + 2, h2 + 2);
      g.fillStyle = bg;
      g.fillRect(x, y, w2, h2);
      g.fillStyle = "rgba(255,255,255,.12)";
      g.fillRect(x, y, w2, 1);
    }
    flask(x, y, f) {
      const g = this.g;
      this.box(x, y, 18, 28, "#2a211b");
      g.fillStyle = "#000";
      g.fillRect(x + 6, y + 3, 6, 5);
      g.fillRect(x + 3, y + 8, 12, 17);
      g.fillStyle = "#4a3a2e";
      g.fillRect(x + 7, y + 4, 4, 3);
      g.fillRect(x + 4, y + 9, 10, 15);
      const h2 = Math.round(15 * clamp01(f));
      g.fillStyle = "#3fbf5f";
      g.fillRect(x + 4, y + 24 - h2, 10, h2);
      if (h2) {
        g.fillStyle = "#9df0b2";
        g.fillRect(x + 4, y + 24 - h2, 10, 1);
      }
      g.fillStyle = "#8a5a2b";
      g.fillRect(x + 7, y + 2, 4, 2);
    }
    skill(x, y, d) {
      const g = this.g;
      this.box(x, y, 28, 28, d.spell ? "#3b2a52" : "#4a2a1f");
      const icon = iconFor(d.weaponKind ?? (d.spell ? "focus" : "sword"), "weapon");
      g.drawImage(icon, x + 2, y + 2, 24, 24);
      const left = 1 - clamp01(d.ready);
      if (left > 0.02) {
        g.fillStyle = "rgba(10,8,6,.62)";
        for (let py = 0; py < 28; py++) for (let px = 0; px < 28; px++) {
          const a = (Math.atan2(px - 13.5, -(py - 13.5)) + 2 * Math.PI) % (2 * Math.PI) / (2 * Math.PI);
          if (a >= 1 - left) g.fillRect(x + px, y + py, 1, 1);
        }
      } else {
        g.fillStyle = GOLD;
        g.fillRect(x, y + 27, 28, 1);
      }
    }
    level(x, y, lv) {
      this.box(x, y, 28, 28, INK);
      const g = this.g;
      g.fillStyle = GOLD;
      g.fillRect(x, y, 28, 2);
      g.fillRect(x, y + 26, 28, 2);
      drawText(g, "LV", x + 14, y + 4, "#b5a48b", "center");
      drawText(g, String(lv), x + 14, y + 14, GOLD, "center");
    }
  };
  var clamp01 = (v) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
  function fit(text, max) {
    if (textWidth(text) + 2 <= max) return text;
    let t = text;
    while (t.length > 1 && textWidth(t + ".") + 2 > max) t = t.slice(0, -1);
    return t.trimEnd() + ".";
  }

  // src/ui/sfx.ts
  var GAP = { hit: 70, crit: 90, kill: 60, hurt: 110, flask: 300, click: 40 };
  var Sound = class {
    constructor(settings) {
      this.settings = settings;
    }
    settings;
    ctx = null;
    master = null;
    noise = null;
    last = /* @__PURE__ */ new Map();
    /** Needs a user gesture on some platforms: call from a click (opening the window). */
    unlock() {
      if (!this.settings.on) return;
      try {
        if (!this.ctx) {
          const AC = window.AudioContext ?? window.webkitAudioContext;
          if (!AC) return;
          this.ctx = new AC();
          this.master = this.ctx.createGain();
          this.master.connect(this.ctx.destination);
          const n = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.5, this.ctx.sampleRate);
          const d = n.getChannelData(0);
          for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
          this.noise = n;
        }
        if (this.ctx.state === "suspended") void this.ctx.resume();
        this.master.gain.value = this.settings.volume * 0.5;
      } catch {
        this.ctx = null;
      }
    }
    set(on, volume = this.settings.volume) {
      this.settings = { on, volume: Math.max(0, Math.min(1, volume)) };
      if (on) this.unlock();
      if (this.master) this.master.gain.value = on ? this.settings.volume * 0.5 : 0;
    }
    close() {
      void this.ctx?.close().catch(() => {
      });
      this.ctx = null;
      this.master = null;
    }
    play(s) {
      if (!this.settings.on || !this.ctx || !this.master || this.ctx.state !== "running") return;
      const now = performance.now(), gap = GAP[s] ?? 0;
      if (gap && now - (this.last.get(s) ?? -1e9) < gap) return;
      this.last.set(s, now);
      const t = this.ctx.currentTime + 5e-3;
      switch (s) {
        case "hit":
          this.tone("square", 220, 90, t, 0.06, 0.18);
          this.hiss(t, 0.04, 0.12, 2400);
          break;
        case "crit":
          this.tone("square", 520, 140, t, 0.1, 0.22);
          this.hiss(t, 0.08, 0.2, 5e3);
          this.tone("triangle", 1040, 780, t, 0.08, 0.1);
          break;
        case "kill":
          this.tone("triangle", 150, 50, t, 0.14, 0.3);
          this.hiss(t, 0.1, 0.12, 900);
          break;
        case "hurt":
          this.tone("sawtooth", 140, 70, t, 0.1, 0.16);
          break;
        case "flask":
          [440, 560, 700].forEach((f, i) => this.tone("sine", f, f * 1.2, t + i * 0.05, 0.06, 0.14));
          break;
        case "loot1":
          [660, 880].forEach((f, i) => this.tone("triangle", f, f, t + i * 0.07, 0.09, 0.18));
          break;
        case "loot2":
          [784, 988, 1319].forEach((f, i) => this.tone("square", f, f, t + i * 0.07, 0.1, 0.12));
          break;
        case "loot3":
          [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone("square", f, f, t + i * 0.07, 0.14, 0.13));
          this.hiss(t + 0.3, 0.5, 0.06, 7e3);
          break;
        case "level":
          [392, 523, 659, 784, 1047].forEach((f, i) => {
            this.tone("square", f, f, t + i * 0.09, 0.16, 0.14);
            this.tone("triangle", f / 2, f / 2, t + i * 0.09, 0.16, 0.12);
          });
          break;
        case "death":
          this.tone("sawtooth", 330, 55, t, 0.9, 0.2);
          this.hiss(t, 0.5, 0.1, 600);
          break;
        case "boss":
          this.tone("sawtooth", 55, 50, t, 1.1, 0.25);
          this.tone("square", 82, 80, t + 0.05, 0.9, 0.12);
          break;
        case "click":
          this.tone("square", 1200, 900, t, 0.025, 0.06);
          break;
      }
    }
    env(t, dur, peak) {
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(1e-4, t);
      g.gain.exponentialRampToValueAtTime(peak, t + Math.min(0.01, dur / 4));
      g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
      g.connect(this.master);
      return g;
    }
    tone(type, f0, f1, t, dur, peak) {
      const o = this.ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      o.connect(this.env(t, dur, peak));
      o.start(t);
      o.stop(t + dur + 0.02);
    }
    hiss(t, dur, peak, cutoff) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noise;
      const f = this.ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = cutoff;
      src.connect(f);
      f.connect(this.env(t, dur, peak));
      src.start(t);
      src.stop(t + dur + 0.02);
    }
  };

  // src/ui/text.ts
  var NAMES = {
    life: "maximum life",
    mana: "maximum mana",
    energyShield: "maximum energy shield",
    lifeRegen: "life regenerated per second",
    lifeRegenPct: "% of life regenerated per second",
    manaRegen: "mana regenerated per second",
    armour: "armour",
    evasion: "evasion",
    block: "% chance to block",
    str: "Might",
    dex: "Grace",
    int: "Wit",
    accuracy: "accuracy",
    damage: "damage",
    critChance: "critical chance",
    critMulti: "% critical multiplier",
    attackSpeed: "attack speed",
    castSpeed: "cast speed",
    area: "area of effect",
    pierce: "projectile pierce",
    leech: "% of damage leeched as life",
    flaskHeal: "flask healing",
    flaskCharges: "flask charges gained",
    moveSpeed: "movement speed",
    itemRarity: "rarity of items found",
    itemQuantity: "quantity of items found",
    xpGain: "experience gained",
    manaCost: "mana cost",
    dmgTaken: "damage taken",
    lifeOnKill: "life gained per kill",
    baseCrit: "% base critical chance"
  };
  var TYPES = { phys: "physical", fire: "fire", cold: "cold", lightning: "lightning", chaos: "chaos" };
  function statName(stat) {
    const [head, t] = stat.split(".");
    if (t && head && TYPES[t]) {
      switch (head) {
        case "res":
          return `% ${TYPES[t]} resistance`;
        case "maxRes":
          return `% maximum ${TYPES[t]} resistance`;
        case "pen":
          return `% ${TYPES[t]} penetration`;
        case "convert":
          return `% of physical damage converted to ${TYPES[t]}`;
        case "addMin":
          return `minimum added ${TYPES[t]} damage`;
        case "addMax":
          return `maximum added ${TYPES[t]} damage`;
      }
    }
    return NAMES[stat] ?? stat;
  }
  function modText(m4) {
    const tags = m4.tags?.length ? ` (${m4.tags.map((t) => TYPES[t] ?? t).join(", ")})` : "";
    const name = statName(m4.stat);
    if (m4.kind === "inc") return `${Math.abs(m4.value)}% ${m4.value >= 0 ? "increased" : "reduced"} ${name}${tags}`;
    if (m4.kind === "more") return `${Math.abs(m4.value)}% ${m4.value >= 0 ? "more" : "less"} ${name}${tags}`;
    const sign = m4.value >= 0 ? "+" : "";
    return name.startsWith("%") ? `${sign}${m4.value}${name}${tags}` : `${sign}${m4.value} ${name}${tags}`;
  }

  // src/core/crafting.ts
  var hasRoom = (item) => {
    const c = countAffixes(item), m4 = MAX_AFFIXES[item.rarity];
    return c.prefix < m4.prefix || c.suffix < m4.suffix;
  };
  var EFFECTS = {
    kindling: (it, rng) => {
      if (it.rarity !== "plain") return "needs a plain item";
      it.rarity = "enchanted";
      rollAffixes(rng, it);
      return null;
    },
    reshaper: (it, rng) => {
      if (it.rarity !== "enchanted") return "needs an enchanted item";
      rollAffixes(rng, it);
      return null;
    },
    graft: (it, rng) => {
      if (it.rarity !== "enchanted") return "needs an enchanted item";
      if (!hasRoom(it) || !eligibleAffixes(it).length) return "no room for another affix";
      addRandomAffix(rng, it);
      return null;
    },
    crownseal: (it, rng) => {
      if (it.rarity !== "enchanted") return "needs an enchanted item";
      it.rarity = "rare";
      it.name = rareName(rng);
      addRandomAffix(rng, it);
      return null;
    },
    forgeheart: (it, rng) => {
      if (it.rarity !== "plain") return "needs a plain item";
      it.rarity = "rare";
      rollAffixes(rng, it);
      return null;
    },
    tempest: (it, rng) => {
      if (it.rarity !== "rare") return "needs a rare item";
      const name = it.name;
      rollAffixes(rng, it);
      if (name) it.name = name;
      return null;
    },
    starfall: (it, rng) => {
      if (it.rarity !== "rare") return "needs a rare item";
      if (!hasRoom(it) || !eligibleAffixes(it).length) return "no room for another affix";
      addRandomAffix(rng, it);
      return null;
    },
    salt: (it) => {
      if (it.rarity === "relic") return "relics can't be undone";
      if (it.rarity === "plain") return "already plain";
      it.rarity = "plain";
      it.affixes = [];
      delete it.name;
      return null;
    },
    unmaker: (it, rng) => {
      if (it.rarity !== "enchanted" && it.rarity !== "rare") return "needs an enchanted or rare item";
      if (!it.affixes.length) return "no affixes";
      it.affixes.splice(rng.int(0, it.affixes.length - 1), 1);
      return null;
    },
    temper: (it, rng) => {
      if (it.rarity === "relic") {
        return "relics can't be tempered";
      }
      if (!it.affixes.length) return "no affixes";
      for (const a of it.affixes) {
        const t = affixOf(a).tiers[a.tier];
        if (t) a.rolls = t.ranges.map(([lo, hi]) => rng.int(lo, hi));
      }
      return null;
    }
  };
  function findItem(state, uid) {
    const s = state.stash.find((x) => x.uid === uid);
    if (s) return { item: s };
    for (const slot of SLOTS) {
      const it = state.hero.equipment[slot];
      if (it?.uid === uid) return { item: it, slot };
    }
    return null;
  }
  function applyCurrency(state, currency, uid) {
    const eff = EFFECTS[currency];
    if (!eff || !CURRENCIES[currency]) return "unknown currency";
    if ((state.currency[currency] ?? 0) <= 0) return `no ${CURRENCIES[currency].name} left`;
    const found = findItem(state, uid);
    if (!found) return "item not found";
    const copy = structuredClone(found.item);
    const rng = new Rng(hashSeed(state.seed, 25458, state.craftSeq));
    const err = eff(copy, rng);
    if (err) return err;
    state.craftSeq++;
    copy.crafted = true;
    Object.assign(found.item, copy);
    if (!copy.name) delete found.item.name;
    state.currency[currency]--;
    if (found.slot) state.hero.rev++;
    return null;
  }
  function maxIlvl(state) {
    const zones = state.world.unlocked.map((z) => ZONES[z]?.level ?? 1);
    const maps = (state.atlas?.tiers ?? []).map((t) => mapLevel(t + 1));
    return Math.max(1, Math.min(state.hero.level + 2, Math.max(...zones, ...maps)));
  }
  var forgeCost = (state) => Math.round(40 + 6 * state.hero.level);
  function forgeRare(state, slot) {
    const cost = forgeCost(state);
    if (state.dust < cost) return { err: `needs ${cost} ember dust` };
    const slots = slot === "ring1" || slot === "ring2" ? ["ring"] : [slot];
    const rng = new Rng(hashSeed(state.seed, 1718579815, state.craftSeq));
    let item;
    try {
      item = rollItem(rng, state.nextUid, maxIlvl(state), { rarity: "rare", slots, maxBaseLevel: state.hero.level });
    } catch {
      return { err: "nothing to forge for that slot" };
    }
    item.crafted = true;
    const upgrade = state.settings.autoEquip && upgradeSlot(state, item);
    if (!upgrade && state.stash.length >= state.stashCap) return { err: "stash full" };
    state.nextUid++;
    state.craftSeq++;
    state.dust -= cost;
    if (upgrade) {
      const r3 = receiveItem(state, item);
      if (r3.equipped) return { err: null, item, equipped: true };
    }
    if (state.stash.length < state.stashCap) state.stash.push(item);
    return { err: null, item, equipped: false };
  }
  function buyCurrency(state, currency, n = 1) {
    const def2 = CURRENCIES[currency];
    if (!def2) return "unknown currency";
    const cost = def2.cost * n;
    if (state.dust < cost) return `needs ${cost} ember dust`;
    state.dust -= cost;
    state.currency[currency] = (state.currency[currency] ?? 0) + n;
    return null;
  }

  // src/ui/forge.ts
  var SLOT_NAMES = { weapon: "Weapon", offhand: "Off-hand", helmet: "Helm", body: "Body", gloves: "Gloves", boots: "Boots", belt: "Belt", amulet: "Amulet", ring1: "Ring", ring2: "Ring 2" };
  function forgeView(c) {
    const st = c.state;
    const items = [...SLOTS.map((s) => st.hero.equipment[s]).filter((x) => !!x), ...st.stash];
    const picker = h("div", { class: "stash" });
    for (const it of items) {
      const eq = SLOTS.some((s) => st.hero.equipment[s]?.uid === it.uid);
      const cell = h("div", {
        class: `cell ${it.rarity}${c.sel.uid === it.uid ? " sel" : ""}`,
        title: itemLabel(it) + (eq ? " (equipped)" : ""),
        on: { click: () => {
          c.sel = { uid: it.uid };
          c.rerender();
        } }
      }, iconFor(baseOf(it).kind, baseOf(it).slot));
      if (eq) cell.append(h("span", { class: "lbl", text: "worn" }));
      picker.append(cell);
    }
    const found = c.sel.uid !== void 0 ? findItem(st, c.sel.uid) : null;
    const target = found ? itemCard(found.item, null) : h("div", { class: "card muted", text: "Pick an item to work on." });
    const bench = h("div", { class: "col", style: "gap:6px" });
    for (const id of CURRENCY_ORDER) {
      const def2 = CURRENCIES[id];
      const have = st.currency[id] ?? 0;
      bench.append(h(
        "div",
        { class: "skill", style: "cursor:default;align-items:center" },
        h("div", { style: `width:14px;height:14px;border:2px solid #111;background:${def2.color};flex:none` }),
        h("div", { class: "grow" }, h("div", { class: "nm", text: `${def2.name} x${have}` }), h("div", { class: "ds", text: def2.blurb })),
        h("button", { class: "btn", text: "Use", attrs: have > 0 && found ? {} : { disabled: "" }, on: { click: () => c.act((s) => applyCurrency(s, id, c.sel.uid), `${def2.name} used`) } }),
        h("button", { class: "btn alt", text: `Buy ${def2.cost}`, title: "Costs ember dust", attrs: st.dust >= def2.cost ? {} : { disabled: "" }, on: { click: () => c.act((s) => buyCurrency(s, id)) } })
      ));
    }
    const cost = forgeCost(st);
    const smith = h("div", { class: "row", style: "gap:4px" });
    for (const slot of SLOTS) {
      smith.append(h("button", {
        class: "btn alt",
        text: SLOT_NAMES[slot],
        attrs: st.dust >= cost ? {} : { disabled: "" },
        on: { click: () => c.act((s) => {
          const r3 = forgeRare(s, slot);
          if (!r3.err && r3.item) c.sel = { uid: r3.item.uid };
          return r3.err;
        }, "Forged a rare") }
      }));
    }
    return h(
      "div",
      { class: "col" },
      h(
        "div",
        { class: "card col" },
        h("h3", { text: `Forge a rare (${fmt(cost)} dust, item level ${maxIlvl(st)})` }),
        h("div", { class: "muted", style: "font-size:11px", text: "A random rare for the slot, at the highest item level you have reached. Upgrades are worn at once." }),
        smith
      ),
      h(
        "div",
        { class: "row" },
        h("span", { class: "tag", style: "background:var(--gold)", text: `Ember dust ${fmt(st.dust)}` }),
        h("span", { class: "muted", style: "font-size:11px", text: "Currency drops from champions and bosses; the forge sells it for dust." })
      ),
      h(
        "div",
        { class: "row", style: "align-items:flex-start;gap:12px" },
        h("div", { class: "col grow", style: "min-width:250px" }, target, h("div", { class: "card" }, h("h3", { text: "Items" }), picker)),
        h("div", { class: "card", style: "flex:1;min-width:260px" }, h("h3", { text: "Currency" }), bench)
      )
    );
  }

  // src/ui/tree.ts
  var cam = { x: 0, y: 0, z: 0.55, centred: "" };
  var COLORS = { line: "#111111", taken: "#ffc233", open: "#ffffff", locked: "#9a917f", ring: "#19b3a3", keystone: "#ff5a36", notable: "#8b5cf6" };
  function treeView(c) {
    const hero = c.state.hero;
    const canvas = h("canvas", { style: "width:100%;height:460px;display:block;cursor:grab;background:#fff4dc;border:3px solid #111;touch-action:none" });
    const info = h("div", { class: "card", style: "min-height:92px" });
    const pts = pointsLeft(hero);
    const head = h(
      "div",
      { class: "row" },
      h("span", { class: "tag", style: pts > 0 ? "background:var(--gold)" : "", text: `${pts} point${pts === 1 ? "" : "s"} left` }),
      h("span", { class: "tag", text: `${hero.passives.length} taken` }),
      h("span", { class: "muted", style: "font-size:11px", text: "Drag to pan, wheel to zoom. Lit nodes can be taken." }),
      h("span", { class: "grow" }),
      h("button", { class: "btn alt", text: "-", on: { click: () => zoom(0.8) } }),
      h("button", { class: "btn alt", text: "+", on: { click: () => zoom(1.25) } }),
      h("button", { class: "btn alt", text: "Centre", on: { click: () => {
        cam.centred = "";
        centre();
        draw();
      } } })
    );
    const taken = new Set(hero.passives);
    const start = PASSIVES[`start_${hero.cls}`];
    const isOpen = (n) => !taken.has(n.id) && n.kind !== "start" && n.links.some((l) => l === start.id || taken.has(l));
    let hover = null;
    let selected = null;
    const centre = () => {
      if (cam.centred === hero.cls) return;
      cam.x = -start.x * 0.6;
      cam.y = -start.y * 0.6;
      cam.z = 0.55;
      cam.centred = hero.cls;
    };
    centre();
    const toScreen = (n, w2, hh) => [w2 / 2 + (n.x + cam.x) * cam.z, hh / 2 + (n.y + cam.y) * cam.z];
    const radius = (n) => (n.kind === "keystone" ? 16 : n.kind === "notable" ? 12 : n.kind === "start" ? 14 : 7) * Math.max(0.6, cam.z);
    function draw() {
      const dpr = window.devicePixelRatio || 1;
      const w2 = canvas.clientWidth || 600, hh = canvas.clientHeight || 460;
      if (canvas.width !== Math.round(w2 * dpr)) {
        canvas.width = Math.round(w2 * dpr);
        canvas.height = Math.round(hh * dpr);
      }
      const g = canvas.getContext("2d");
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = "#fff4dc";
      g.fillRect(0, 0, w2, hh);
      for (const n of Object.values(PASSIVES)) {
        const [x1, y1] = toScreen(n, w2, hh);
        for (const l of n.links) {
          if (l < n.id) continue;
          const m4 = PASSIVES[l];
          const [x2, y2] = toScreen(m4, w2, hh);
          const on = (taken.has(n.id) || n.id === start.id) && (taken.has(l) || l === start.id);
          g.strokeStyle = on ? "#ff5a36" : "#b9ad95";
          g.lineWidth = on ? 5 : 3;
          g.beginPath();
          g.moveTo(x1, y1);
          g.lineTo(x2, y2);
          g.stroke();
        }
      }
      for (const n of Object.values(PASSIVES)) {
        const [x, y] = toScreen(n, w2, hh);
        if (x < -30 || y < -30 || x > w2 + 30 || y > hh + 30) continue;
        const r3 = radius(n);
        const own = taken.has(n.id) || n.id === start.id;
        const open = isOpen(n);
        let fill = own ? COLORS.taken : open ? COLORS.open : COLORS.locked;
        if (!own && n.kind === "keystone") fill = open ? "#ffb3a3" : "#c98b7f";
        g.fillStyle = COLORS.line;
        if (n.kind === "notable" || n.kind === "keystone") {
          g.fillRect(x - r3 - 2, y - r3 - 2, 2 * r3 + 4, 2 * r3 + 4);
          g.fillStyle = fill;
          g.fillRect(x - r3, y - r3, 2 * r3, 2 * r3);
        } else {
          g.beginPath();
          g.arc(x, y, r3 + 2, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = fill;
          g.beginPath();
          g.arc(x, y, r3, 0, Math.PI * 2);
          g.fill();
        }
        if (n.kind === "ring" && !own) {
          g.fillStyle = COLORS.ring;
          g.beginPath();
          g.arc(x, y, r3 * 0.45, 0, Math.PI * 2);
          g.fill();
        }
        if (n.kind === "start") {
          g.fillStyle = n.cls === hero.cls ? "#ff5a36" : "#9a917f";
          g.beginPath();
          g.arc(x, y, r3 * 0.55, 0, Math.PI * 2);
          g.fill();
        }
        if (n === hover || n === selected) {
          g.strokeStyle = "#ff5a36";
          g.lineWidth = 3;
          g.strokeRect(x - r3 - 5, y - r3 - 5, 2 * r3 + 10, 2 * r3 + 10);
        }
        if ((n.kind === "notable" || n.kind === "keystone" || n.kind === "start") && cam.z > 0.45) {
          g.font = "bold 11px Segoe UI, sans-serif";
          g.textAlign = "center";
          const label = n.kind === "start" ? (n.cls ?? "").toUpperCase() : n.name;
          g.fillStyle = "#fff4dc";
          g.fillText(label, x + 1, y + r3 + 15);
          g.fillStyle = "#111";
          g.fillText(label, x, y + r3 + 14);
        }
      }
    }
    function showInfo(n) {
      info.replaceChildren();
      if (!n) {
        info.append(h("div", { class: "muted", text: "Hover a node to read it." }));
        return;
      }
      const own = taken.has(n.id);
      info.append(h("h3", { text: `${n.name}${n.kind === "notable" ? " (notable)" : n.kind === "keystone" ? " (keystone)" : ""}` }));
      for (const m4 of n.mods) info.append(h("div", { text: modText(m4) }));
      if (n.kind === "keystone" && KEYSTONE_TEXT[n.name]) info.append(h("div", { class: "muted", style: "font-style:italic", text: KEYSTONE_TEXT[n.name] }));
      if (n.kind === "start") info.append(h("div", { class: "muted", text: n.cls === hero.cls ? "Your ember seat." : "Another calling starts here." }));
      const row = h("div", { class: "row", style: "margin-top:6px" });
      if (own) {
        const ok = canRefund(hero, n.id);
        row.append(h("button", {
          class: "btn alt",
          text: `Refund (${refundCost(hero)} dust)`,
          attrs: ok ? {} : { disabled: "" },
          title: ok ? "" : "Other taken nodes depend on it",
          on: { click: () => c.act((s) => refund(s, n.id)) }
        }));
      } else if (n.kind !== "start") {
        const err = canAllocate(hero, n.id);
        row.append(h("button", { class: "btn", text: "Take", attrs: err ? { disabled: "" } : {}, title: err ?? "", on: { click: () => c.act((s) => allocate(s, n.id)) } }));
        if (err) row.append(h("span", { class: "muted", text: err }));
      }
      info.append(row);
    }
    const pick = (ev) => {
      const rect = canvas.getBoundingClientRect();
      const mx = ev.clientX - rect.left, my = ev.clientY - rect.top;
      let best = null, bd = Infinity;
      for (const n of Object.values(PASSIVES)) {
        const [x, y] = toScreen(n, rect.width, rect.height);
        const d = Math.hypot(x - mx, y - my);
        if (d < radius(n) + 6 && d < bd) {
          best = n;
          bd = d;
        }
      }
      return best;
    };
    let drag = null;
    canvas.addEventListener("pointerdown", (e) => {
      drag = { x: e.clientX, y: e.clientY, moved: 0 };
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = "grabbing";
    });
    canvas.addEventListener("pointermove", (e) => {
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        drag.moved += Math.abs(dx) + Math.abs(dy);
        cam.x += dx / cam.z;
        cam.y += dy / cam.z;
        drag.x = e.clientX;
        drag.y = e.clientY;
        draw();
        return;
      }
      const n = pick(e);
      if (n !== hover) {
        hover = n;
        showInfo(n ?? selected);
        draw();
        canvas.style.cursor = n ? "pointer" : "grab";
      }
    });
    canvas.addEventListener("pointerup", (e) => {
      const wasClick = drag && drag.moved < 6;
      drag = null;
      canvas.style.cursor = "grab";
      if (!wasClick) return;
      const n = pick(e);
      selected = n;
      if (n && isOpen(n) && !canAllocate(hero, n.id)) {
        c.act((s) => allocate(s, n.id));
        return;
      }
      showInfo(n);
      draw();
    });
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      zoom(e.deltaY < 0 ? 1.12 : 0.89);
    }, { passive: false });
    function zoom(f) {
      cam.z = Math.max(0.25, Math.min(1.6, cam.z * f));
      draw();
    }
    showInfo(null);
    const asc = ascCard(c);
    requestAnimationFrame(draw);
    return h("div", { class: "col" }, head, canvas, info, asc);
  }
  function ascCard(c) {
    const hero = c.state.hero;
    const card = h("div", { class: "card col" });
    const left = ascPointsLeft(hero);
    card.append(h("h3", { text: `Ascendancy${hero.asc ? `: ${ASCENDANCIES[hero.asc].name}` : ""} (${left} point${left === 1 ? "" : "s"} left)` }));
    if (!hero.asc) {
      card.append(h("div", { class: "muted", text: hero.ascPoints > 0 ? "Choose your path. This is permanent for this hero." : "Pass a Trial (the first opens in Act 1 after the Sunken Chapel) to earn ascendancy points." }));
      const row = h("div", { class: "grid2" });
      for (const a2 of Object.values(ASCENDANCIES).filter((x) => x.cls === hero.cls)) {
        row.append(h(
          "div",
          { class: "skill", style: `border-left:10px solid ${a2.color}` },
          h(
            "div",
            { class: "grow" },
            h("div", { class: "nm", text: a2.name }),
            h("div", { class: "ds", text: a2.blurb }),
            ...a2.nodes.map((n) => h("div", { class: "ds muted", text: `${n.name}: ${n.mods.map(modText).join(", ")}` })),
            h("button", {
              class: "btn",
              style: "margin-top:6px",
              text: `Become ${a2.name}`,
              attrs: hero.ascPoints > 0 ? {} : { disabled: "" },
              on: { click: () => c.act((s) => chooseAscendancy(s, a2.id)) }
            })
          )
        ));
      }
      card.append(row);
      return card;
    }
    const a = ASCENDANCIES[hero.asc];
    const grid = h("div", { class: "grid2" });
    for (const n of a.nodes) {
      const own = hero.ascNodes.includes(n.id);
      grid.append(h(
        "div",
        { class: `skill${own ? " on" : ""}`, on: { click: () => {
          if (!own) c.act((s) => takeAscNode(s, n.id));
        } } },
        h("div", { class: "grow" }, h("div", { class: "nm", text: n.name }), ...n.mods.map((md) => h("div", { class: "ds", text: modText(md) }))),
        h("div", { class: "tag", text: own ? "taken" : left > 0 ? "take" : "locked" })
      ));
    }
    card.append(grid);
    return card;
  }

  // src/ui/atlas.ts
  var MAP_CRAFTS = ["kindling", "reshaper", "graft", "crownseal", "forgeheart", "tempest", "starfall", "salt"];
  var RCOLOR = { plain: "var(--r-plain)", enchanted: "var(--r-enchanted)", rare: "var(--r-rare)" };
  function atlasSig(c) {
    const s = c.state;
    return `${endgameOpen(s)}:${s.activity.mode}:${s.activity.mapTier}:${s.activity.autoCap}:${s.activity.pinnacle}:${s.maps.length}:${s.maps[s.maps.length - 1]?.uid}:${s.atlas.points}:${s.atlas.nodes.length}:${JSON.stringify(s.sigils)}:${c.sel.uid}:${s.craftSeq}`;
  }
  function atlasView(c) {
    const st = c.state;
    if (!endgameOpen(st)) {
      return h(
        "div",
        { class: "card col" },
        h("h3", { text: "The Cinderlands" }),
        h("div", { class: "story", text: "Past the crater the land is all ember and ash, and it never ends. Clear the Sunfall to walk it." }),
        h("div", { class: "muted", text: "Maps also drop in Act 3 once you get there; keep them for later." }),
        h("div", { class: "tag", text: `${st.maps.length} maps collected` })
      );
    }
    const root = h("div", { class: "col" });
    const mode = h("input", { attrs: { type: "checkbox" } });
    mode.checked = st.activity.mode === "map";
    mode.addEventListener("change", () => c.act((s) => setMapMode(s, mode.checked)));
    const tiers = [.../* @__PURE__ */ new Set([...st.maps.map((m4) => m4.tier), ...st.activity.mapTier ? [st.activity.mapTier] : []])].sort((a, b) => a - b);
    const tierSel = h("select");
    tierSel.append(h("option", { text: "Highest tier first", attrs: { value: "0" } }));
    for (const t of tiers) tierSel.append(h("option", { text: `${tierName(t)} and below${st.maps.some((m4) => m4.tier === t) ? "" : " (none in stash)"}`, attrs: { value: String(t) } }));
    tierSel.value = String(st.activity.mapTier);
    tierSel.addEventListener("change", () => c.act((s) => setMapTier(s, +tierSel.value)));
    const deepest = Math.max(0, ...st.atlas.tiers);
    root.append(h(
      "div",
      { class: "card col" },
      h("h3", { text: "The map device" }),
      h("label", { class: "chk" }, mode, "Run maps instead of story zones (no maps left: the Outskirts, which drop Tier 1 maps)"),
      h(
        "div",
        { class: "row" },
        "Order",
        tierSel,
        h("span", { class: "tag", text: `${st.maps.length}/${st.mapCap} maps` }),
        h("span", { class: "tag", text: `Deepest: ${deepest ? tierName(deepest) : "none"}` }),
        autoXpCap(st) ? h("span", { class: "tag", title: "Auto-push keeps to tiers within 4 levels of the hero for experience", text: `XP cap: ${tierName(autoXpCap(st))}` }) : null,
        st.activity.autoCap ? h("span", { class: "tag", style: "background:var(--ember)", text: `Auto-push cap: ${tierName(st.activity.autoCap)}` }) : null
      ),
      tierChips(st.atlas.tiers),
      h("div", { class: "muted", style: "font-size:11px", text: `Dying in a map loses it and ${MAP_DEATH_XP * 100}% of a level's experience. Mods make maps harder and richer.` })
    ));
    const list6 = h("div", { class: "col", style: "gap:4px" });
    const maps = [...st.maps].sort((a, b) => b.tier - a.tier || b.mods.length - a.mods.length);
    for (const m4 of maps.slice(0, 40)) {
      const on = c.sel.uid === m4.uid;
      list6.append(h(
        "div",
        { class: `zone${on ? " on" : ""}`, style: "margin:0", on: { click: () => {
          c.sel = { uid: m4.uid };
          c.rerender();
        } } },
        h("div", { class: "tag", style: `background:${RCOLOR[m4.rarity]}`, text: tierName(m4.tier) }),
        h(
          "div",
          { class: "grow" },
          h("div", { style: "font-weight:800", text: mapLabel(m4) }),
          m4.mods.length ? h("div", { class: "muted", style: "font-size:11px", text: m4.mods.map((id) => MAP_MODS[id]?.text ?? id).join(" / ") }) : null
        )
      ));
    }
    if (!maps.length) list6.append(h("div", { class: "muted", text: "No maps yet. The Outskirts and Act 3 drop them." }));
    const sel = st.maps.find((m4) => m4.uid === c.sel.uid);
    const bench = h("div", { class: "row", style: "gap:4px" });
    if (sel) {
      for (const id of MAP_CRAFTS) {
        const have = st.currency[id] ?? 0;
        bench.append(h("button", {
          class: "btn alt",
          text: `${CURRENCIES[id].name} (${have})`,
          title: CURRENCIES[id].blurb,
          attrs: have ? {} : { disabled: "" },
          on: { click: () => c.act((s) => craftMap(s, id, sel.uid)) }
        }));
      }
    }
    root.append(h(
      "div",
      { class: "card col" },
      h("h3", { text: "Maps" }),
      list6,
      sel ? h("div", { class: "col" }, h("div", { class: "muted", text: `Craft ${mapLabel(sel)}:` }), bench) : null
    ));
    const left = atlasPointsLeft(st);
    const grid = h("div", { class: "grid2" });
    for (const n of Object.values(ATLAS)) {
      const own = st.atlas.nodes.includes(n.id);
      const err = own ? null : canTakeAtlas(st, n.id);
      const locked = !own && !!err && err !== "no atlas points";
      grid.append(h(
        "div",
        { class: `skill${own ? " on" : ""}${locked ? " locked" : ""}`, on: { click: () => {
          if (!own && !err) c.act((s) => takeAtlas(s, n.id));
        } } },
        h(
          "div",
          { class: "grow" },
          h("div", { class: "nm", text: n.name }),
          h("div", { class: "ds", text: n.text }),
          n.requires.length ? h("div", { class: "ds muted", text: `After: ${n.requires.map((r3) => ATLAS[r3]?.name ?? r3).join(", ")}` }) : null
        ),
        h("div", { class: "tag", text: own ? "taken" : err ? locked ? "locked" : "no points" : "take" })
      ));
    }
    root.append(h(
      "div",
      { class: "card col" },
      h("h3", { text: `Atlas (${left} point${left === 1 ? "" : "s"} left)` }),
      h("div", { class: "muted", style: "font-size:11px", text: `First clears of tiers 1-${MAX_TIER} give a point each, every fifth Depth one more, pinnacles two.` }),
      grid
    ));
    const pins = h("div", { class: "grid2" });
    for (const p of Object.values(PINNACLES)) {
      const have = st.sigils[p.sigil] ?? 0;
      const queued = st.activity.pinnacle === p.id;
      pins.append(h(
        "div",
        { class: "skill", style: "cursor:default" },
        h(
          "div",
          { class: "grow" },
          h("div", { class: "nm", text: p.name }),
          h("div", { class: "ds", text: p.text }),
          h("div", { class: "ds muted", text: `Level ${p.level}. ${p.sigilName}s drop from map bosses at ${tierName(p.minTier)}+. Kills: ${st.pinnacleKills[p.id] ?? 0}.` }),
          h("button", {
            class: "btn hot",
            style: "margin-top:6px",
            text: queued ? "Next run" : `Challenge (${have}/${p.cost})`,
            attrs: have >= p.cost && !queued ? {} : { disabled: "" },
            on: { click: () => c.act((s) => queuePinnacle(s, p.id), `${p.name} is next`) }
          })
        )
      ));
    }
    root.append(h("div", { class: "card col" }, h("h3", { text: "Pinnacles" }), pins));
    return root;
  }
  function tierChips(done) {
    const row = h("div", { class: "row", style: "gap:3px" });
    for (let t = 1; t <= MAX_TIER; t++) row.append(h("span", { class: "tag", style: done.includes(t) ? "background:var(--teal)" : "opacity:.5", text: String(t) }));
    return row;
  }

  // src/ui/views.ts
  var VIEWS = [
    { id: "hero", label: "Hero" },
    { id: "gear", label: "Gear" },
    { id: "forge", label: "Forge" },
    { id: "skills", label: "Skills" },
    { id: "tree", label: "Tree" },
    { id: "world", label: "World" },
    { id: "atlas", label: "Atlas" },
    { id: "log", label: "Log" },
    { id: "menu", label: "Menu" }
  ];
  function viewSig(id, c) {
    const s = c.state;
    switch (id) {
      case "hero":
        return `${s.hero.rev}`;
      case "gear":
        return `${s.hero.rev}:${s.stash.length}:${s.stash[s.stash.length - 1]?.uid ?? 0}:${s.dust}:${c.sel.uid}:${c.sel.slot}`;
      case "forge":
        return `${s.hero.rev}:${s.stash.length}:${s.dust}:${JSON.stringify(s.currency)}:${c.sel.uid}:${s.craftSeq}`;
      case "skills":
        return `${s.hero.rev}:${s.hero.level}`;
      case "tree":
        return `${s.hero.rev}:${s.hero.level}:${s.dust >= 5 + s.hero.level * 2}:${s.hero.ascPoints}`;
      case "world":
        return `${s.activity.zone}:${s.world.unlocked.length}:${s.activity.autoPush}:${Object.values(s.world.clears).reduce((a, b) => a + b, 0)}`;
      case "atlas":
        return atlasSig(c);
      case "log":
        return `${s.log.length}:${s.log[s.log.length - 1]?.t ?? 0}`;
      case "menu":
        return `${s.settings.keep}:${s.settings.autoEquip}:${JSON.stringify(s.settings.filter)}`;
    }
  }
  function renderView(id, c) {
    switch (id) {
      case "hero":
        return heroView(c);
      case "gear":
        return gearView(c);
      case "forge":
        return forgeView(c);
      case "tree":
        return treeView(c);
      case "skills":
        return skillsView(c);
      case "world":
        return worldView(c);
      case "atlas":
        return atlasView(c);
      case "log":
        return logView(c);
      case "menu":
        return menuView(c);
    }
  }
  var TYPE_COLOR = { phys: "#8d8d8d", fire: "#ff5a36", cold: "#3a9bff", lightning: "#e0b800", chaos: "#8b5cf6" };
  var TYPE_NAME = { phys: "Physical", fire: "Fire", cold: "Cold", lightning: "Lightning", chaos: "Chaos" };
  function kv(rows) {
    const el = h("div", { class: "kv" });
    for (const [k, v, click] of rows) {
      const key = h("div", { text: k });
      const val = typeof v === "string" ? h("div", { class: "num", text: v }) : v;
      if (click) {
        key.classList.add("click");
        key.addEventListener("click", click);
      }
      el.append(key, val);
    }
    return el;
  }
  function heroView(c) {
    const s = c.sheet();
    const hero = c.state.hero;
    const sk = s.skill;
    const critFactor = 1 + sk.critChance / 100 * (sk.critMulti / 100 - 1);
    const breakdown = (stat, title) => () => {
      const mods = s.bag.mods(stat);
      const list6 = h("div", { class: "kv" });
      for (const m4 of mods) list6.append(h("div", { text: m4.src ?? "?" }), h("div", { class: "num", text: `${m4.kind === "flat" ? "+" : ""}${m4.value}${m4.kind === "flat" ? "" : "% " + m4.kind}${m4.tags ? " [" + m4.tags.join(",") + "]" : ""}` }));
      if (!mods.length) list6.append(h("div", { text: "No modifiers" }), h("div"));
      const close = c.modal(h("div", { class: "card" }, h("h3", { text: title }), list6, h("div", { style: "margin-top:8px" }, h("button", { class: "btn", text: "Close", on: { click: () => close() } }))));
    };
    const off = h(
      "div",
      { class: "card" },
      h("h3", { text: `Offence: ${sk.name}` }),
      h("div", { class: "row" }, h("div", { class: "big num", text: fmt(sk.dps) }), h("div", { class: "muted", text: "DPS single target" })),
      h("div", { class: "row", style: "margin-bottom:6px" }, h("div", { class: "big num", text: fmt(sk.packDps) }), h("div", { class: "muted", text: `vs packs (${sk.targets} target${sk.targets > 1 ? "s" : ""})` })),
      kv([
        ["Average hit", fmt(sk.avgHit), breakdown("damage", "Damage modifiers")],
        ...DAMAGE_TYPES.filter((t) => sk.hit[t][1] > 0).map((t) => [`  ${TYPE_NAME[t]}`, `${fmt(sk.hit[t][0])}-${fmt(sk.hit[t][1])}`]),
        ["Critical chance", `${sk.critChance.toFixed(1)}%`, breakdown("critChance", "Critical chance")],
        ["Critical multiplier", `${sk.critMulti.toFixed(0)}%`, breakdown("critMulti", "Critical multiplier")],
        ["x Crit factor", critFactor.toFixed(2)],
        [sk.kind === "attack" ? "Attacks per second" : "Casts per second", sk.speed.toFixed(2), breakdown(sk.kind === "attack" ? "attackSpeed" : "castSpeed", "Speed")],
        ...sk.kind === "attack" ? [["Hit chance (vs same level)", pct(sk.hitChance), breakdown("accuracy", "Accuracy")]] : [],
        ["Mana cost", fmt(sk.manaCost)],
        ...sk.sustain < sk.speed ? [["Mana-limited to", `${sk.sustain.toFixed(2)}/s`]] : [],
        ...sk.leech ? [["Life leech", `${sk.leech}%`]] : []
      ]),
      h("div", { class: "muted", style: "margin-top:6px;font-size:11px", text: `DPS = ${fmt(sk.avgHit)} hit x ${critFactor.toFixed(2)} crit x ${Math.min(sk.speed, sk.sustain).toFixed(2)}/s${sk.sustain < sk.speed ? " (mana-limited)" : ""}${sk.kind === "attack" ? ` x ${pct(sk.hitChance)} hit` : ""}` })
    );
    const pool = s.life + s.es;
    const def2 = h(
      "div",
      { class: "card" },
      h("h3", { text: "Defence" }),
      kv([
        ["Life", fmt(s.life), breakdown("life", "Life")],
        ["Energy shield", fmt(s.es), breakdown("energyShield", "Energy shield")],
        ["Mana", fmt(s.mana), breakdown("mana", "Mana")],
        ["Armour", fmt(s.armour), breakdown("armour", "Armour")],
        ["Evasion", fmt(s.evasion), breakdown("evasion", "Evasion")],
        ["Block", `${s.block.toFixed(0)}%`, breakdown("block", "Block")],
        ["Life regen", `${fmt(s.lifeRegen)}/s`, breakdown("lifeRegen", "Life regeneration")],
        ...["fire", "cold", "lightning", "chaos"].map((t) => [`${TYPE_NAME[t]} res`, h("div", { class: "num", style: s.res[t] < 0 ? "color:var(--red)" : "", text: `${s.res[t]}%${s.resRaw[t] > s.maxRes[t] ? ` (${s.resRaw[t]})` : ""}` }), breakdown(`res.${t}`, `${TYPE_NAME[t]} resistance`)])
      ]),
      h("h3", { style: "margin-top:8px", text: `Effective HP (pool ${fmt(pool)})` }),
      ehpBars(s)
    );
    const xpNeed = xpToNext(hero.level);
    const info = h(
      "div",
      { class: "card" },
      h("h3", { text: `${hero.name} - ${CLASSES[hero.cls]?.name ?? hero.cls}` }),
      kv([
        ["Level", String(hero.level)],
        ["Experience", isFinite(xpNeed) ? `${fmt(hero.xp)} / ${fmt(xpNeed)}` : "max"],
        ["Might / Grace / Wit", `${s.str} / ${s.dex} / ${s.int}`],
        ["Movement speed", pct(s.moveSpeed)],
        ["Item rarity", `+${s.rarity}%`],
        ["Flask healing", pct(s.flaskHeal)],
        ["Build score", fmt(buildScore(s))]
      ]),
      ...s.problems.map((p) => h("div", { class: "tag", style: "background:var(--ember);margin-top:4px", text: p })),
      h("div", { class: "muted", style: "margin-top:6px;font-size:11px", text: "Click an underlined stat for where it comes from." })
    );
    return h("div", { class: "grid2" }, off, def2, info);
  }
  function ehpBars(s) {
    const max = Math.max(...DAMAGE_TYPES.map((t) => s.ehp[t]));
    const el = h("div", { class: "col", style: "gap:3px" });
    for (const t of DAMAGE_TYPES) {
      const m4 = h("div", { class: "meter", title: t === "phys" ? "Against a typical hit: armour, evasion and block" : "Resistance and block" });
      m4.append(h("i", { style: `width:${s.ehp[t] / max * 100}%;background:${TYPE_COLOR[t]}` }), h("span", { text: `${TYPE_NAME[t]} ${fmt(s.ehp[t])}` }));
      el.append(m4);
    }
    return el;
  }
  var SLOT_LABEL = { weapon: "Weapon", offhand: "Off-hand", helmet: "Helm", body: "Body", gloves: "Gloves", boots: "Boots", belt: "Belt", amulet: "Amulet", ring1: "Ring", ring2: "Ring" };
  function itemCell(item, slot, selected, onClick) {
    const cell = h("div", { class: `cell ${item ? item.rarity : "empty"}${selected ? " sel" : ""}`, title: item ? itemLabel(item) : slot ? SLOT_LABEL[slot] : "", on: { click: onClick } });
    if (item) cell.append(iconFor(baseOf(item).kind, baseOf(item).slot));
    if (slot) cell.append(h("span", { class: "lbl", text: SLOT_LABEL[slot] }));
    return cell;
  }
  function itemCard(item, c, opts = {}) {
    const b = baseOf(item);
    const st = itemStats(item);
    const card = h("div", { class: "card item" }, h("div", { class: `name ${item.rarity}`, text: itemLabel(item) }));
    const lines = [];
    if (item.rarity === "rare" || item.rarity === "relic") lines.push(b.name);
    card.append(h("div", { class: "muted", text: `${[...lines, b.kind === b.slot ? "" : b.kind].filter(Boolean).join(" - ")}  ilvl ${item.ilvl}, needs level ${levelReq(item)}` }));
    if (st.weapon) {
      const w2 = st.weapon;
      const rows = [["Physical", `${w2.phys[0]}-${w2.phys[1]}`]];
      for (const [t, r3] of Object.entries(w2.added)) rows.push([TYPE_NAME[t], `${r3[0]}-${r3[1]}`]);
      rows.push(["Attacks per second", w2.aps.toFixed(2)], ["Critical chance", `${w2.crit.toFixed(1)}%`], ["Hands", String(w2.hands)]);
      card.append(kv(rows));
    }
    if (st.defence) {
      const d = st.defence;
      const rows = [];
      if (d.armour) rows.push(["Armour", String(d.armour)]);
      if (d.evasion) rows.push(["Evasion", String(d.evasion)]);
      if (d.energyShield) rows.push(["Energy shield", String(d.energyShield)]);
      if (d.block) rows.push(["Block", `${d.block}%`]);
      card.append(kv(rows));
    }
    if (b.implicit?.length) {
      card.append(h("hr"));
      for (const m4 of b.implicit) card.append(h("div", { class: "aff", text: modText(m4) }));
    }
    if (item.affixes.length) {
      card.append(h("hr"));
      const sorted = [...item.affixes].sort((a, z) => affixOf(a).type === affixOf(z).type ? 0 : affixOf(a).type === "prefix" ? -1 : 1);
      for (const a of sorted) card.append(h("div", { class: "aff" }, affixText(a), h("b", { text: `${affixOf(a).type === "prefix" ? "P" : "S"} T${tierLabel(a)}` })));
    }
    const relic = relicOf(item);
    if (relic) {
      card.append(h("hr"));
      for (const l of relicLines(item)) card.append(h("div", { class: "aff", text: l }));
      card.append(h("div", { class: "muted", style: "font-style:italic;margin-top:4px", text: relic.flavour }));
    }
    if (c && opts.compareSlot !== void 0) {
      const slot = opts.compareSlot ?? slotsFor(b).find((s) => !c.state.hero.equipment[s]) ?? slotsFor(b)[0];
      const trial = trialSheet(c.state, item, slot);
      if (trial) {
        card.append(h("hr"), compareRows(c.sheet(), trial));
      } else {
        card.append(h("hr"), h("div", { class: "down", text: canEquip(c.state, item, slot) ?? "can't equip" }));
      }
    }
    return card;
  }
  function compareRows(now, next) {
    const rows = [
      ["DPS", now.skill.dps, next.skill.dps],
      ["Pack DPS", now.skill.packDps, next.skill.packDps],
      ["Life", now.life, next.life],
      ["Energy shield", now.es, next.es],
      ["EHP physical", now.ehp.phys, next.ehp.phys],
      ["EHP elemental", (now.ehp.fire + now.ehp.cold + now.ehp.lightning) / 3, (next.ehp.fire + next.ehp.cold + next.ehp.lightning) / 3]
    ];
    const el = h("div", { class: "kv" });
    for (const [k, a, b] of rows) {
      if (Math.abs(b - a) < 5e-3 * Math.max(1, a)) continue;
      const d = b - a;
      el.append(h("div", { text: k }), h("div", { class: `num ${d > 0 ? "up" : "down"}`, text: `${d > 0 ? "+" : ""}${fmt(d)} (${a > 0 ? (d > 0 ? "+" : "") + (d / a * 100).toFixed(0) + "%" : "new"})` }));
    }
    const sa = buildScore(now), sb = buildScore(next);
    el.append(h("div", { text: "Build score" }), h("div", { class: `num ${sb >= sa ? "up" : "down"}`, text: `${sb >= sa ? "+" : ""}${sa > 0 ? ((sb - sa) / sa * 100).toFixed(1) : "0"}%` }));
    return el;
  }
  var gearOpts = { filter: "all", sort: "rarity" };
  var SLOT_GROUP = { weapon: "weapons", offhand: "weapons", helmet: "armour", body: "armour", gloves: "armour", boots: "armour", belt: "jewellery", amulet: "jewellery", ring: "jewellery" };
  var SLOT_ORDER = ["weapon", "offhand", "helmet", "body", "gloves", "boots", "belt", "amulet", "ring"];
  var upgradeCache = { rev: -1, level: -1, map: /* @__PURE__ */ new Map() };
  function upgradeOf(st, item) {
    if (upgradeCache.rev !== st.hero.rev || upgradeCache.level !== st.hero.level) upgradeCache = { rev: st.hero.rev, level: st.hero.level, map: /* @__PURE__ */ new Map() };
    let v = upgradeCache.map.get(item.uid);
    if (v === void 0) {
      v = upgradeSlot(st, item);
      upgradeCache.map.set(item.uid, v);
    }
    return v;
  }
  function chips(opts, cur, pick) {
    const el = h("div", { class: "chips", attrs: { role: "radiogroup" } });
    for (const [v, label, n] of opts) {
      el.append(h(
        "button",
        { class: `chip${v === cur ? " on" : ""}`, attrs: { role: "radio", "aria-checked": String(v === cur) }, on: { click: () => pick(v) } },
        label,
        n !== void 0 ? h("b", { text: String(n) }) : null
      ));
    }
    return el;
  }
  function gearView(c) {
    const st = c.state;
    const eq = st.hero.equipment;
    const slots = h("div", { class: "slots" });
    for (const s of SLOTS) slots.append(itemCell(eq[s], s, c.sel.slot === s && c.sel.uid === void 0, () => {
      c.sel = { slot: s };
      c.rerender();
    }));
    const ups = new Set(st.stash.filter((it) => upgradeOf(st, it)).map((it) => it.uid));
    const groupOf = (it) => SLOT_GROUP[baseOf(it).slot] ?? "all";
    const count = (f) => f === "all" ? st.stash.length : f === "upgrades" ? ups.size : st.stash.filter((it) => groupOf(it) === f).length;
    const shown = st.stash.filter((it) => gearOpts.filter === "all" || (gearOpts.filter === "upgrades" ? ups.has(it.uid) : groupOf(it) === gearOpts.filter));
    const byRarity = (a, b) => RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity] || b.ilvl - a.ilvl;
    shown.sort(gearOpts.sort === "level" ? (a, b) => b.ilvl - a.ilvl || byRarity(a, b) : gearOpts.sort === "slot" ? (a, b) => SLOT_ORDER.indexOf(baseOf(a).slot) - SLOT_ORDER.indexOf(baseOf(b).slot) || byRarity(a, b) : byRarity);
    const stash = h("div", { class: "stash" });
    for (const it of shown) {
      const cell = itemCell(it, null, c.sel.uid === it.uid, () => {
        c.sel = { uid: it.uid };
        c.rerender();
      });
      if (ups.has(it.uid)) {
        cell.classList.add("upg");
        cell.title += "  (upgrade)";
      } else if (levelReq(it) > st.hero.level) {
        cell.classList.add("req");
        cell.title += `  (needs level ${levelReq(it)})`;
      }
      stash.append(cell);
    }
    if (gearOpts.filter === "all") for (let i = st.stash.length; i < st.stashCap; i++) stash.append(h("div", { class: "cell empty" }));
    else if (!shown.length) stash.append(h("div", { class: "muted", style: "grid-column:1/-1;padding:6px 0", text: gearOpts.filter === "upgrades" ? "Nothing in the stash beats what is equipped." : "None of these in the stash." }));
    const sort = h("select", { attrs: { "aria-label": "Sort the stash" } });
    for (const [v, label] of [["rarity", "Sort: rarity"], ["level", "Sort: item level"], ["slot", "Sort: slot"]]) {
      const o = h("option", { text: label, attrs: { value: v } });
      if (gearOpts.sort === v) o.selected = true;
      sort.append(o);
    }
    sort.addEventListener("change", () => {
      gearOpts.sort = sort.value;
      c.rerender();
    });
    const full = st.stash.length >= st.stashCap;
    const stashCard = h(
      "div",
      { class: "card" },
      h("h3", { class: "split" }, h("span", { text: "Stash" }), h("span", { class: `num${full ? " down" : ""}`, text: `${st.stash.length} / ${st.stashCap}` })),
      h(
        "div",
        { class: "row", style: "margin-bottom:8px;justify-content:space-between" },
        chips(
          [["all", "All", count("all")], ["upgrades", "Upgrades", count("upgrades")], ["weapons", "Weapons", count("weapons")], ["armour", "Armour", count("armour")], ["jewellery", "Jewellery", count("jewellery")]],
          gearOpts.filter,
          (v) => {
            gearOpts.filter = v;
            c.rerender();
          }
        ),
        sort
      ),
      stash
    );
    const plainCount = st.stash.filter((x) => x.rarity === "plain").length;
    const enchCount = st.stash.filter((x) => x.rarity === "enchanted").length;
    const tools = h(
      "div",
      { class: "row" },
      h("span", { class: "tag", style: "background:var(--gold);color:#1a1410", text: `Ember dust ${fmt(st.dust)}` }),
      h("button", {
        class: "btn alt",
        text: `Salvage plain (${plainCount})`,
        attrs: plainCount ? {} : { disabled: "" },
        on: { click: () => c.act((s) => {
          salvage(s, s.stash.filter((x) => x.rarity === "plain").map((x) => x.uid));
          c.sel = {};
        }) }
      }),
      h("button", {
        class: "btn alt",
        text: `Salvage enchanted (${enchCount})`,
        attrs: enchCount ? {} : { disabled: "" },
        on: { click: () => c.act((s) => {
          salvage(s, s.stash.filter((x) => x.rarity === "enchanted").map((x) => x.uid));
          c.sel = {};
        }) }
      })
    );
    const detail = h("div", { class: "col side" });
    const selItem = c.sel.uid !== void 0 ? st.stash.find((x) => x.uid === c.sel.uid) : void 0;
    const selSlot = c.sel.slot;
    if (selItem) {
      const targets = slotsFor(baseOf(selItem));
      const cmp = upgradeOf(st, selItem) ?? (targets.length > 1 ? targets.find((t) => !eq[t]) ?? targets[0] : targets[0]);
      detail.append(itemCard(selItem, c, { compareSlot: cmp }));
      const row = h("div", { class: "row" });
      targets.forEach((t, i) => {
        const err = canEquip(st, selItem, t);
        row.append(h("button", {
          class: "btn",
          text: targets.length > 1 ? `Equip ${t === "ring1" ? "left" : "right"}` : "Equip",
          attrs: { ...err ? { disabled: "" } : {}, ...i === 0 ? { "data-key": "e" } : {} },
          title: err ?? (i === 0 ? "Equip (E)" : ""),
          on: { click: () => c.act((s) => {
            const e = equip(s, selItem.uid, t);
            if (!e) c.sel = { slot: t };
            return e;
          }) }
        }));
      });
      row.append(h("button", {
        class: "btn alt",
        text: `Salvage +${salvageValue(selItem)}`,
        title: "Salvage into ember dust (S)",
        attrs: { "data-key": "s" },
        on: { click: () => c.act((s) => {
          salvage(s, [selItem.uid]);
          c.sel = {};
        }) }
      }));
      detail.append(row);
      const worn = eq[cmp];
      if (worn) detail.append(h("div", { class: "sec", style: "margin-top:6px", text: `Now in ${SLOT_LABEL[cmp].toLowerCase()} slot` }), itemCard(worn, null));
    } else if (selSlot && eq[selSlot]) {
      detail.append(itemCard(eq[selSlot], c));
      detail.append(h("div", { class: "row" }, h("button", { class: "btn alt", text: "Unequip", on: { click: () => c.act((s) => unequip(s, selSlot)) } })));
    } else {
      detail.append(h(
        "div",
        { class: "card hint" },
        h("h3", { text: "Pick an item" }),
        h("div", { class: "muted", text: "Stash items show what equipping them would change. A green corner marks an upgrade; faded ones need a higher level." }),
        h("div", { class: "muted", style: "margin-top:6px", text: "Keys: E equips the picked item, S salvages it." })
      ));
    }
    return h(
      "div",
      { class: "gear" },
      h("div", { class: "col" }, h("div", { class: "card" }, h("h3", { text: "Equipped" }), slots), stashCard, tools),
      detail
    );
  }
  var pctDelta = (a, b) => b / Math.max(0.01, a) - 1;
  var fmtPct = (d) => `${d >= 0 ? "+" : ""}${(d * 100).toFixed(Math.abs(d) < 0.1 ? 1 : 0)}%`;
  function skillsView(c) {
    const hero = c.state.hero;
    const cur = c.sheet();
    const skills = h("div", { class: "list" });
    for (const s of Object.values(SKILLS)) {
      const locked = s.level > hero.level;
      const on = hero.skill === s.id;
      let meta;
      if (locked) meta = h("span", { class: "tag", text: `level ${s.level}` });
      else if (on) meta = h("span", { class: "tag", style: "background:#1a1410;color:var(--gold)", text: `${fmt(cur.skill.packDps)} dps` });
      else {
        const sh = deriveSheet({ ...hero, skill: s.id, rev: -1 });
        const d = pctDelta(cur.skill.packDps, sh.skill.packDps);
        meta = h(
          "span",
          { class: "col", style: "gap:1px;align-items:flex-end" },
          h("span", { class: "num", style: "font-weight:700", text: fmt(sh.skill.packDps) }),
          h("span", { class: `delta ${d >= 0 ? "up" : "down"}`, text: fmtPct(d) })
        );
      }
      skills.append(h(
        "div",
        {
          class: `li${on ? " on" : ""}${locked ? " locked" : ""}`,
          attrs: { role: "button", tabindex: locked || on ? "-1" : "0" },
          title: locked ? `Unlocks at level ${s.level}` : on ? "Your main skill" : "Pack DPS with your current gear and supports",
          on: { click: () => {
            if (!locked && !on) c.act((st) => setSkill(st, s.id), `${s.name} selected`);
          } }
        },
        h("div", { class: "nm", text: s.name }),
        h("div", { class: "meta" }, meta),
        h("div", { class: "ds", text: s.blurb }),
        h("div", { class: "tags" }, ...s.tags.map((t) => h("span", { class: "tag", text: t })), h("span", { class: "tag", text: `${s.effectiveness}% eff.` }))
      ));
    }
    const slots = supportSlots(hero.level);
    const active = hero.supports.slice(0, slots);
    const full = active.length >= slots;
    const trial = (ids) => deriveSheet({ ...hero, supports: ids, rev: -1 }).skill.packDps;
    const rows = Object.values(SUPPORTS).map((s) => {
      const locked = s.level > hero.level;
      const on = active.includes(s.id);
      const fits = !s.requires.length || s.requires.some((t) => cur.skill.tags.includes(t));
      let d = null, swap;
      if (!locked && fits) {
        if (on) d = pctDelta(cur.skill.packDps, trial(active.filter((x) => x !== s.id)));
        else if (!full) d = pctDelta(cur.skill.packDps, trial([...active, s.id]));
        else for (const out of active) {
          const v = pctDelta(cur.skill.packDps, trial(active.map((x) => x === out ? s.id : x)));
          if (d === null || v > d) {
            d = v;
            swap = out;
          }
        }
      }
      return { s, on, locked, fits, d, swap };
    });
    const rank = (r3) => r3.on ? 0 : r3.locked ? 3 : r3.fits ? 1 : 2;
    rows.sort((a, b) => rank(a) - rank(b) || (a.on ? (a.d ?? 0) - (b.d ?? 0) : (b.d ?? -9) - (a.d ?? -9)) || a.s.level - b.s.level);
    const sups = h("div", { class: "list" });
    for (const r3 of rows) {
      const { s, on, locked, fits, d, swap } = r3;
      let meta, tip;
      if (locked) {
        meta = h("span", { class: "tag", text: `level ${s.level}` });
        tip = `Unlocks at level ${s.level}`;
      } else if (!fits) {
        meta = h("span", { class: "tag", text: "no fit" });
        tip = `Needs a ${s.requires.join(" or ")} skill`;
      } else if (on) {
        meta = h("span", { class: "col", style: "gap:1px;align-items:flex-end" }, h("span", { class: "tag", text: "slotted" }), h("span", { class: `delta ${(d ?? 0) <= 0 ? "up" : "down"}`, text: `worth ${fmtPct(-(d ?? 0))}` }));
        tip = `Click to remove: ${fmtPct(d ?? 0)} pack DPS`;
      } else {
        const good = (d ?? 0) > 0;
        meta = h(
          "span",
          { class: "col", style: "gap:1px;align-items:flex-end" },
          h("span", { class: `delta ${good ? "up" : "down"}`, text: fmtPct(d ?? 0) }),
          swap ? h("span", { class: "muted", style: "font-size:10.5px", text: `for ${SUPPORTS[swap]?.name ?? swap}` }) : null
        );
        tip = swap ? `Click to swap out ${SUPPORTS[swap]?.name}: ${fmtPct(d ?? 0)} pack DPS` : `Click to add: ${fmtPct(d ?? 0)} pack DPS`;
      }
      sups.append(h(
        "div",
        { class: `li${on ? " on" : ""}${locked || !fits ? " locked" : ""}`, attrs: { role: "button", tabindex: locked || !fits ? "-1" : "0" }, title: tip, on: { click: () => {
          if (locked || !fits) return;
          if (on) c.act((st) => setSupports(st, active.filter((x) => x !== s.id)), `${s.name} removed`);
          else if (!full) c.act((st) => setSupports(st, [...active, s.id]), `${s.name} added`);
          else if (swap) c.act((st) => setSupports(st, active.map((x) => x === swap ? s.id : x)), `${SUPPORTS[swap]?.name} swapped for ${s.name}`);
        } } },
        h("div", { class: "nm", text: s.name }),
        h("div", { class: "meta" }, meta),
        h("div", { class: "ds", text: s.blurb + (s.requires.length ? `  Needs: ${s.requires.join(" or ")}.` : "") })
      ));
    }
    const next = [1, 1, 8, 18, 32].find((l) => l > hero.level);
    return h(
      "div",
      { class: "grid2" },
      h("div", null, h("div", { class: "sec", text: "Main skill" }), skills),
      h("div", null, h(
        "div",
        { class: "sec" },
        "Supports ",
        h("span", { class: "num", text: `${active.length}/${slots}` }),
        next ? h("span", { class: "muted", text: `next slot at level ${next}` }) : null
      ), sups)
    );
  }
  function worldView(c) {
    const st = c.state;
    const root = h("div", { class: "col" });
    root.append(h(
      "div",
      { class: "row" },
      h(
        "label",
        { class: "chk" },
        (() => {
          const i = h("input", { attrs: { type: "checkbox" } });
          i.checked = st.activity.autoPush;
          i.addEventListener("change", () => c.act((s) => {
            s.activity.autoPush = i.checked;
          }));
          return i;
        })(),
        "Auto-push: move on after 3 clean clears, fall back after 3 deaths"
      )
    ));
    for (const act of ACTS) {
      if (!act.zones.some((z) => st.world.unlocked.includes(z))) continue;
      const done = !!st.world.clears[act.zones[act.zones.length - 1]];
      const card = h("div", { class: "card" }, h("h3", { text: `Act ${act.id}: ${act.name}` }), h("div", { class: "story muted", style: "margin-bottom:8px", text: done ? act.outro : act.intro }));
      for (const id of [...act.zones, act.trial]) {
        const z = ZONES[id];
        const open = st.world.unlocked.includes(id);
        const on = st.activity.zone === id;
        const clears = st.world.clears[id] ?? 0;
        const row = h(
          "div",
          { class: `zone${on ? " on" : ""}${open ? "" : " locked"}`, on: { click: () => {
            if (open && !on) c.act((s) => setZone(s, id), `Travelling to ${z.name}`);
          } } },
          h("div", { class: "tag", text: `L${z.level}` }),
          h("div", { class: "grow" }, h("div", { style: "font-weight:800", text: z.name }), open && z.story ? h("div", { class: "muted", style: "font-size:11px", text: z.story }) : null),
          z.trial ? h("div", { class: "tag", style: "background:var(--violet);color:#fff", text: "trial" }) : z.boss ? h("div", { class: "tag", style: "background:var(--ember)", text: "boss" }) : null,
          h("div", { class: "tag", text: open ? `${clears} clears` : "locked" })
        );
        card.append(row);
      }
      root.append(card);
    }
    return root;
  }
  var LOG_KINDS = { level: ["Level", "var(--gold)"], loot: ["Loot", "var(--r-enchanted)"], death: ["Death", "var(--ember)"], zone: ["Road", "var(--teal)"], boss: ["Boss", "var(--violet)"], info: ["Note", "var(--paper2)"] };
  var logFilter = "all";
  function logView(c) {
    const log = c.state.log;
    const n = (k) => log.filter((e) => e.kind === k).length;
    const filter = chips(
      [["all", "All", log.length], ...Object.entries(LOG_KINDS).filter(([k]) => n(k)).map(([k, [label]]) => [k, label, n(k)])],
      logFilter,
      (v) => {
        logFilter = v;
        c.rerender();
      }
    );
    const el = h("div", { class: "card log" }, h("h3", { text: "Chronicle" }), h("div", { style: "margin-bottom:8px" }, filter));
    const now = Date.now();
    for (const e of [...log].reverse()) {
      if (logFilter !== "all" && e.kind !== logFilter) continue;
      const [label, color] = LOG_KINDS[e.kind] ?? [e.kind, "var(--paper2)"];
      el.append(h(
        "div",
        { class: "entry" },
        h("span", { class: "tag", style: `background:${color};color:#1a1410`, text: label }),
        h("span", { class: "grow", text: e.text }),
        h("span", { class: "muted num when", text: e.t > 1e12 ? `${fmtAgo(now - e.t)}` : "" })
      ));
    }
    return el;
  }
  function fmtAgo(ms) {
    if (ms < 6e4) return "now";
    const m4 = Math.floor(ms / 6e4);
    if (m4 < 60) return `${m4}m`;
    const hh = Math.floor(m4 / 60);
    return hh < 48 ? `${hh}h` : `${Math.floor(hh / 24)}d`;
  }
  function menuView(c) {
    const st = c.state;
    const keep = h("select");
    for (const [v, label] of [["plain", "Keep everything"], ["enchanted", "Keep enchanted and better"], ["rare", "Keep rares only"]]) {
      const o = h("option", { text: label, attrs: { value: v } });
      if (st.settings.keep === v) o.selected = true;
      keep.append(o);
    }
    keep.addEventListener("change", () => c.act((s) => {
      s.settings.keep = keep.value;
    }));
    const auto = h("input", { attrs: { type: "checkbox" } });
    auto.checked = st.settings.autoEquip;
    auto.addEventListener("change", () => c.act((s) => {
      s.settings.autoEquip = auto.checked;
    }));
    const out = h("textarea", { attrs: { readonly: "", placeholder: "Press Export" } });
    const inp = h("textarea", { attrs: { placeholder: "Paste an HM1: export here" } });
    const t = st.totals;
    return h(
      "div",
      { class: "grid2" },
      h(
        "div",
        { class: "card col" },
        h("h3", { text: "Loot" }),
        h("label", { class: "chk" }, auto, "Equip upgrades automatically"),
        filterEditor(c),
        h("div", { class: "row" }, "Otherwise", keep),
        h("div", { class: "muted", style: "font-size:11px", text: "Rules run top to bottom; the first match decides. Salvaged items become ember dust." })
      ),
      h(
        "div",
        { class: "card col" },
        h("h3", { text: "Save" }),
        h("div", { class: "muted", style: "font-size:11px", text: `Saved in ${c.storeKind === "indexeddb" ? "this Discord profile (IndexedDB)" : "memory only: export to keep it"}.` }),
        h(
          "div",
          { class: "row" },
          h("button", { class: "btn", text: "Export", on: { click: () => {
            out.value = c.exportSave();
            out.select();
          } } }),
          h("button", { class: "btn alt", text: "Copy", on: { click: () => {
            out.select();
            void navigator.clipboard?.writeText(out.value).then(() => c.toast("Copied"), () => c.toast("Select and copy it by hand"));
          } } })
        ),
        out,
        inp,
        h("div", { class: "row" }, h("button", { class: "btn alt", text: "Import", on: { click: () => {
          void c.importSave(inp.value).then((e) => c.toast(e ?? "Save loaded"));
        } } }))
      ),
      h("div", { class: "card" }, h("h3", { text: "Totals" }), kv([
        ["Runs", fmt(t.runs)],
        ["Kills", fmt(t.kills)],
        ["Deaths", fmt(t.deaths)],
        ["Items found", fmt(t.items)],
        ["Salvaged", fmt(t.salvaged)],
        ["Time simulated", `${(t.simMs / 36e5).toFixed(1)} h`]
      ])),
      h(
        "div",
        { class: "card col" },
        h("h3", { text: "Danger" }),
        h("button", { class: "btn hot", text: "Start a new hero", on: { click: () => {
          const close = c.modal(h(
            "div",
            { class: "card col" },
            h("h3", { text: "Start over?" }),
            h("div", { text: "This deletes the current hero. Export first if you want to keep it." }),
            h(
              "div",
              { class: "row" },
              h("button", { class: "btn hot", text: "Delete and start over", on: { click: () => {
                close();
                c.resetGame();
              } } }),
              h("button", { class: "btn alt", text: "Cancel", on: { click: () => close() } })
            )
          ));
        } } })
      )
    );
  }
  function filterEditor(c) {
    const rules = c.state.settings.filter;
    const box2 = h("div", { class: "col", style: "gap:4px" });
    const edit = (fn) => c.act((s) => {
      fn(s.settings.filter);
    });
    rules.forEach((r3, i) => {
      const on = h("input", { attrs: { type: "checkbox" } });
      on.checked = r3.on;
      on.addEventListener("change", () => edit((rs) => {
        rs[i].on = on.checked;
      }));
      box2.append(h(
        "div",
        { class: "row", style: "gap:4px;flex-wrap:nowrap" },
        on,
        h("span", { class: "grow", style: `font-size:12px;${r3.on ? "" : "opacity:.5"}`, text: describeRule(r3) }),
        h("button", { class: "x", text: "^", title: "Move up", on: { click: () => edit((rs) => {
          if (i > 0) [rs[i - 1], rs[i]] = [rs[i], rs[i - 1]];
        }) } }),
        h("button", { class: "x", text: "x", title: "Delete", on: { click: () => edit((rs) => {
          rs.splice(i, 1);
        }) } })
      ));
    });
    const action = h("select");
    for (const a of ["keep", "salvage"]) action.append(h("option", { text: a, attrs: { value: a } }));
    const rarity = h("select");
    for (const [v, t] of [["", "any rarity"], ["plain", "plain"], ["enchanted", "enchanted"], ["rare", "rare"], ["relic", "relic"]]) rarity.append(h("option", { text: t, attrs: { value: v } }));
    const slot = h("select");
    for (const v of ["", "weapon", "offhand", "helmet", "body", "gloves", "boots", "belt", "amulet", "ring"]) slot.append(h("option", { text: v || "any slot", attrs: { value: v } }));
    const minAff = h("select");
    for (const v of ["0", "3", "4", "5", "6"]) minAff.append(h("option", { text: v === "0" ? "any affixes" : `${v}+ affixes`, attrs: { value: v } }));
    box2.append(h(
      "div",
      { class: "row", style: "gap:4px" },
      action,
      rarity,
      slot,
      minAff,
      h("button", { class: "btn alt", text: "Add rule", on: { click: () => edit((rs) => {
        const r3 = { on: true, action: action.value };
        if (rarity.value) r3.rarity = [rarity.value];
        if (slot.value) r3.slots = [slot.value];
        if (+minAff.value) r3.minAffixes = +minAff.value;
        rs.push(r3);
      }) } }),
      h("button", { class: "btn alt", text: "Reset", on: { click: () => edit((rs) => {
        rs.splice(0, rs.length, ...structuredClone(DEFAULT_FILTER));
      }) } })
    ));
    return box2;
  }
  function creationView(onStart) {
    const name = h("input", { attrs: { type: "text", maxlength: "20", value: "Ashling", "aria-label": "Hero name" } });
    let cls = Object.keys(CLASSES)[0];
    const list6 = h("div", { class: "col" });
    const draw = () => {
      clear(list6);
      for (const k of Object.values(CLASSES)) list6.append(h(
        "div",
        { class: `skill${k.id === cls ? " on" : ""}`, on: { click: () => {
          cls = k.id;
          draw();
        } } },
        h(
          "div",
          { class: "grow" },
          h("div", { class: "nm", text: k.name }),
          h("div", { class: "ds", text: k.blurb }),
          h("div", { class: "ds muted", text: `Might ${k.str} / Grace ${k.dex} / Wit ${k.int}. Starts with ${SKILLS[k.startSkill].name} and a ${BASES[k.startWeapon].name}.` })
        )
      ));
    };
    draw();
    return h(
      "div",
      { class: "col", style: "max-width:520px;margin:0 auto" },
      h("div", { class: "card story", text: "The sun of the March went out three hundred years ago. What is left of it fell as embers, and whoever holds one does not stay dead." }),
      h(
        "div",
        { class: "card col" },
        h("h3", { text: "Name your Kindled" }),
        name,
        h("h3", { text: "Choose a calling" }),
        list6,
        h("button", { class: "btn hot", text: "Wake up", on: { click: () => onStart(name.value.replace(/[^\x20-\x7e]/g, "").trim().slice(0, 20) || "Ashling", cls) } })
      )
    );
  }

  // src/ui/app.ts
  var GEO_KEY = "window";
  var UI_KEY = "frame";
  var QUICK_KEY = "quicksave";
  var BACKUP_MS = 5 * 6e4;
  var AUTOSAVE_MS = 2e4;
  var REPORT_MIN_MS = 6e4;
  var MINI_W = 320;
  var XP_WINDOW_MS = 10 * 6e4;
  var STAGE_FRAC = { l: 0.42, m: 0.28 };
  var STAGE_NEXT = { m: "l", l: "off", off: "m" };
  var STAGE_TITLE = { m: "Battle view: normal (click for large)", l: "Battle view: large (click to hide)", off: "Battle view: hidden (click to show)" };
  var STOP_EVENTS = ["keydown", "keyup", "keypress", "paste", "copy", "cut", "input"];
  var NAV_GLYPH = { hero: "hero", gear: "gear", forge: "forge", skills: "skills", tree: "tree", world: "world", atlas: "atlas", log: "log", menu: "menu" };
  var GameWindow = class _GameWindow {
    constructor(store2, kv2, hooks = {}) {
      this.store = store2;
      this.kv = kv2;
      this.hooks = hooks;
    }
    store;
    kv;
    hooks;
    host = null;
    root;
    win;
    body;
    top;
    stage;
    stageBtn;
    soundBtn;
    hudWrap;
    hud = new Hud();
    sound = new Sound({ on: true, volume: 0.35 });
    /** When the hero last swung or cast (performance.now()), for the skill slot's cooldown sweep. */
    lastUse = 0;
    nav;
    who;
    miniBtn;
    maxBtn;
    miniBox;
    toasts;
    battle = new Battle();
    state = null;
    view = "hero";
    sig = "";
    timer = null;
    raf = null;
    lastSave = 0;
    lastBackup = 0;
    busy = false;
    ctx;
    stopKeys = null;
    frame = { stage: "m", mini: false, max: false, sound: true, volume: 0.35 };
    xpLog = [];
    lastEvent = "";
    onUnload = () => {
      if (!this.state) return;
      this.kv.set(QUICK_KEY, wrap(this.state, Date.now()));
      void this.save();
    };
    onResize = () => this.refit();
    get isOpen() {
      return !!this.host;
    }
    get isMini() {
      return this.frame.mini;
    }
    async open() {
      if (this.host) {
        this.win.style.display = "";
        this.refit();
        this.win.focus();
        this.flash();
        return;
      }
      this.build();
      window.addEventListener("pagehide", this.onUnload);
      window.addEventListener("resize", this.onResize);
      const loaded = await this.load();
      if (!this.host) return;
      if (!loaded) {
        this.showCreation();
        return;
      }
      await this.catchUp();
      this.startLoop();
    }
    async close() {
      if (!this.host) return;
      this.stopLoop();
      await this.save();
      window.removeEventListener("pagehide", this.onUnload);
      window.removeEventListener("resize", this.onResize);
      if (this.stopKeys) for (const k of STOP_EVENTS) this.host.removeEventListener(k, this.stopKeys);
      this.host.remove();
      this.host = null;
      this.sound.close();
      this.state = null;
      this.hooks.onClose?.();
    }
    /** Like a taskbar button: opens the game, or folds it to mini mode and back. */
    async toggle() {
      if (!this.host) {
        await this.open();
        return;
      }
      this.setMini(!this.frame.mini);
    }
    // ---- frame ----------------------------------------------------------------
    build() {
      const host = document.createElement("div");
      host.id = "hollowmarch-root";
      this.host = host;
      this.root = host.attachShadow({ mode: "open" });
      const style = document.createElement("style");
      style.textContent = CSS;
      this.root.append(style);
      this.stopKeys = (e) => e.stopPropagation();
      for (const k of STOP_EVENTS) host.addEventListener(k, this.stopKeys);
      const f = this.kv.get(UI_KEY);
      if (f && typeof f === "object") {
        if (f.stage === "l" || f.stage === "m" || f.stage === "off") this.frame.stage = f.stage;
        this.frame.mini = f.mini === true;
        this.frame.max = f.max === true;
        this.frame.sound = f.sound !== false;
        if (typeof f.volume === "number" && f.volume >= 0 && f.volume <= 1) this.frame.volume = f.volume;
      }
      this.sound.set(this.frame.sound, this.frame.volume);
      const shell = h("div", { class: `hm${this.hooks.theme?.() === "dark" ? " dark" : ""}` });
      const ctl = (g, title, fn, cls = "") => {
        const b = h("button", { class: `ctl ${cls}`, title, attrs: { "aria-label": title }, on: { click: fn } }, glyph(g, 12));
        return b;
      };
      this.who = h("span", { class: "who" });
      this.stageBtn = ctl("stage", STAGE_TITLE.m, () => this.setStage(STAGE_NEXT[this.frame.stage]), "sz");
      this.miniBtn = ctl("min", "Mini mode: keeps playing in a small strip", () => this.setMini(!this.frame.mini));
      this.maxBtn = ctl("max", "Maximize (double-click the title)", () => this.setMax(!this.frame.max), "mx");
      this.soundBtn = ctl("sound", "Sound on (click to mute)", () => this.setSound(!this.frame.sound), "snd");
      const bar2 = h(
        "div",
        { class: "bar" },
        h("span", { class: "logo", text: "Hollowmarch" }),
        this.who,
        h("span", { class: "ctls" }, this.soundBtn, this.stageBtn, this.miniBtn, this.maxBtn, ctl("close", "Close (the road keeps going; it is replayed on open)", () => void this.close(), "x"))
      );
      bar2.addEventListener("dblclick", (e) => {
        if (!e.target.closest("button")) this.setMax(!this.frame.max);
      });
      this.stage = h("div", { class: "stage" }, this.battle.canvas);
      this.top = h("div", { class: "top" }, this.stage);
      this.hudWrap = h("div", { class: "hudw", attrs: { role: "img", "aria-label": "Hero status" } }, this.hud.canvas);
      this.nav = h("div", { class: "nav", attrs: { role: "tablist", "aria-label": "Game sections" } });
      VIEWS.forEach((v, i) => {
        this.nav.append(h("button", { attrs: { "data-v": v.id, role: "tab", "aria-selected": "false", title: `${v.label} (${i + 1})` }, on: { click: () => {
          this.view = v.id;
          this.sig = "";
          if (this.ctx) this.ctx.sel = {};
          this.renderTab(true);
          this.body.scrollTop = 0;
        } } }, glyph(NAV_GLYPH[v.id], 16), h("span", { class: "lbl", text: v.label }), h("span", { class: "key", text: String(i + 1) }), h("span", { class: "badge", attrs: { hidden: "" } })));
      });
      this.body = h("div", { class: "body", attrs: { role: "tabpanel" } });
      const main = h("div", { class: "main" }, this.nav, this.body);
      this.miniBox = h("div", { class: "minibox" }, h("div", { class: "mlast" }));
      this.toasts = h("div", { class: "toasts", attrs: { "aria-live": "polite" } });
      const grip = h("div", { class: "grip", attrs: { "aria-hidden": "true" } });
      this.win = h("div", { class: "win", attrs: { role: "dialog", "aria-label": "Hollowmarch" } }, bar2, this.top, this.hudWrap, main, this.miniBox, this.toasts, grip);
      shell.append(this.win);
      this.root.append(shell);
      document.body.append(host);
      this.placeWindow();
      this.dragger(bar2, (dx, dy, g) => {
        g.x += dx;
        g.y += dy;
      });
      this.dragger(grip, (dx, dy, g) => {
        g.w += dx;
        g.h += dy;
      });
      this.win.tabIndex = -1;
      this.win.addEventListener("keydown", (e) => {
        const t = e.target;
        if (t.closest("input, textarea, select")) return;
        if (e.key === "Escape") {
          const modals = this.win.querySelectorAll(".modal");
          const top = modals[modals.length - 1];
          if (top && !top.querySelector(".progress")) {
            top.remove();
            e.preventDefault();
          }
          return;
        }
        if (e.ctrlKey || e.altKey || e.metaKey || this.frame.mini || this.win.querySelector(".modal")) return;
        const n = Number(e.key);
        if (n >= 1 && n <= VIEWS.length) {
          this.nav.children[n - 1]?.click();
          e.preventDefault();
          return;
        }
        const k = e.key.length === 1 ? e.key.toLowerCase() : "";
        const hot = k && /^[a-z]$/.test(k) ? this.body.querySelector(`[data-key="${k}"]:not([disabled])`) : null;
        if (hot) {
          hot.click();
          e.preventDefault();
        }
      });
      this.applyFrame();
    }
    geo = { x: 80, y: 60, w: 900, h: 660 };
    placeWindow() {
      const g = this.kv.get(GEO_KEY);
      if (g && [g.x, g.y, g.w, g.h].every((v) => typeof v === "number" && Number.isFinite(v))) this.geo = { x: g.x, y: g.y, w: g.w, h: g.h };
      else {
        this.geo.w = Math.min(920, window.innerWidth - 48);
        this.geo.h = Math.min(700, window.innerHeight - 72);
        this.geo.x = Math.max(8, Math.round((window.innerWidth - this.geo.w) / 2));
        this.geo.y = Math.max(40, Math.round((window.innerHeight - this.geo.h) / 2));
      }
      const fit2 = () => {
        const vw = window.innerWidth, vh = window.innerHeight;
        const g2 = this.geo;
        g2.w = Math.max(380, Math.min(g2.w, vw - 8));
        g2.h = Math.max(340, Math.min(g2.h, vh - 8));
        g2.x = Math.max(0, Math.min(g2.x, vw - (this.frame.mini ? MINI_W : g2.w)));
        g2.y = Math.max(0, Math.min(g2.y, vh - (this.frame.mini ? 120 : g2.h)));
        const hudAt = (cssW, scale) => {
          this.hud.resize(cssW / scale);
          this.hud.canvas.style.width = cssW + "px";
          this.hud.canvas.style.height = HUD_H * scale + "px";
        };
        if (this.frame.mini) {
          Object.assign(this.win.style, { left: g2.x + "px", top: g2.y + "px", width: MINI_W + "px", height: "" });
          hudAt(MINI_W - 6, 1);
          return;
        }
        const box2 = this.frame.max ? { x: 8, y: 8, w: vw - 16, h: vh - 16 } : g2;
        Object.assign(this.win.style, { left: box2.x + "px", top: box2.y + "px", width: box2.w + "px", height: box2.h + "px" });
        const inner = box2.w - 6;
        hudAt(inner, inner >= 1180 ? 3 : inner >= 520 ? 2 : 1);
        if (this.frame.stage === "off") {
          this.stage.style.height = "";
          return;
        }
        const stageH = Math.round(Math.min(inner * 0.5, box2.h * STAGE_FRAC[this.frame.stage]));
        const sc = Math.max(1, Math.round(stageH / 160));
        this.stage.style.height = stageH + "px";
        this.battle.resize(Math.ceil(inner / sc), Math.ceil(stageH / sc));
        Object.assign(this.battle.canvas.style, { width: this.battle.canvas.width * sc + "px", height: this.battle.canvas.height * sc + "px" });
      };
      fit2();
      this.refit = fit2;
    }
    refit = () => {
    };
    applyFrame() {
      const f = this.frame;
      this.win.classList.toggle("mini", f.mini);
      this.win.classList.toggle("max", f.max && !f.mini);
      this.top.classList.toggle("nostage", f.stage === "off");
      this.stageBtn.title = STAGE_TITLE[f.stage];
      this.stageBtn.setAttribute("aria-label", STAGE_TITLE[f.stage]);
      const setGlyph = (b, g, title) => {
        b.replaceChildren(glyph(g, 12));
        b.title = title;
        b.setAttribute("aria-label", title);
      };
      setGlyph(this.miniBtn, f.mini ? "max" : "min", f.mini ? "Back to the full window" : "Mini mode: keeps playing in a small strip");
      setGlyph(this.maxBtn, f.max ? "restore" : "max", f.max ? "Restore size (double-click the title)" : "Maximize (double-click the title)");
      setGlyph(this.soundBtn, f.sound ? "sound" : "mute", f.sound ? "Sound on (click to mute)" : "Sound off (click to unmute)");
      this.refit();
    }
    saveFrame() {
      this.kv.set(UI_KEY, { ...this.frame });
    }
    setMini(on) {
      this.frame.mini = on;
      this.saveFrame();
      this.applyFrame();
      if (!on) {
        this.sig = "";
        this.renderTab(true);
      }
    }
    setMax(on) {
      if (this.frame.mini) return;
      this.frame.max = on;
      this.saveFrame();
      this.applyFrame();
    }
    setStage(s) {
      this.frame.stage = s;
      this.saveFrame();
      this.applyFrame();
    }
    setSound(on) {
      this.frame.sound = on;
      this.saveFrame();
      this.sound.set(on, this.frame.volume);
      this.applyFrame();
      if (on) this.sound.play("click");
    }
    /** A short pulse on the frame, so a click on the launcher visibly finds the window. */
    flash() {
      this.win.classList.remove("flash");
      void this.win.offsetWidth;
      this.win.classList.add("flash");
    }
    dragger(handle, apply) {
      handle.addEventListener("pointerdown", (e) => {
        if (e.target.closest("button") || e.button !== 0) return;
        if (this.frame.max && handle !== this.win.querySelector(".grip")) {
          this.frame.max = false;
          this.saveFrame();
          this.applyFrame();
        }
        if (this.frame.max) return;
        e.preventDefault();
        handle.setPointerCapture(e.pointerId);
        let lx = e.clientX, ly = e.clientY;
        const move = (ev) => {
          apply(ev.clientX - lx, ev.clientY - ly, this.geo);
          lx = ev.clientX;
          ly = ev.clientY;
          this.refit();
        };
        const up = () => {
          handle.removeEventListener("pointermove", move);
          handle.removeEventListener("pointerup", up);
          handle.removeEventListener("pointercancel", up);
          this.kv.set(GEO_KEY, this.geo);
        };
        handle.addEventListener("pointermove", move);
        handle.addEventListener("pointerup", up);
        handle.addEventListener("pointercancel", up);
      });
    }
    // ---- persistence --------------------------------------------------------
    /** Unwraps, migrates and validates; the state is only used when it can produce a stat sheet. */
    static accept(raw) {
      const env = unwrap(raw);
      env.state = validateState(env.state);
      sheetOf(env.state);
      return env;
    }
    async load() {
      let quick = null;
      try {
        const q = this.kv.get(QUICK_KEY);
        if (q) quick = _GameWindow.accept(q);
      } catch (e) {
        console.warn("[Hollowmarch] quick save unusable:", e);
      }
      for (const key of ["main", "backup"]) {
        try {
          const raw = await this.store.get(key);
          if (!raw) continue;
          const env = _GameWindow.accept(raw);
          this.state = quick && quick.savedAt > env.savedAt ? quick.state : env.state;
          this.lastBackup = Date.now();
          return true;
        } catch (e) {
          console.warn(`[Hollowmarch] save "${key}" unusable:`, e);
        }
      }
      if (quick) {
        this.state = quick.state;
        return true;
      }
      return false;
    }
    async save() {
      const s = this.state;
      if (!s) return;
      this.lastSave = Date.now();
      try {
        if (Date.now() - this.lastBackup > BACKUP_MS) {
          const prev = await this.store.get("main");
          if (prev) await this.store.put("backup", prev);
          this.lastBackup = Date.now();
        }
        await this.store.put("main", wrap(s, Date.now()));
        if (this.kv.get(QUICK_KEY)) this.kv.del(QUICK_KEY);
      } catch (e) {
        console.warn("[Hollowmarch] save failed:", e);
      }
      this.hooks.summary?.(summaryOf(s));
    }
    // ---- catch-up and loop --------------------------------------------------
    async catchUp() {
      const s = this.state;
      const away = Date.now() - s.simTo;
      if (away < STEP_MS) return;
      this.busy = true;
      const rep = startReport(s);
      const bar2 = h("i", { style: "width:0%" });
      const label = h("div", { class: "muted", text: "" });
      const closeModal = away > 2e3 ? this.modal(h("div", { class: "card col" }, h("h3", { text: "While you were away" }), label, h("div", { class: "progress" }, bar2))) : () => {
      };
      const from = s.simTo, target = Date.now();
      this.battle.quiet = true;
      while (!advance(s, target, rep.events, 25e3)) {
        const f = (s.simTo - from) / Math.max(1, target - from);
        bar2.style.width = (f * 100).toFixed(1) + "%";
        label.textContent = `Replaying ${fmtDuration(target - from)}... ${(f * 100).toFixed(0)}%`;
        await new Promise((r3) => setTimeout(r3, 0));
        if (!this.host) return;
      }
      this.battle.quiet = false;
      this.xpLog = [];
      closeModal();
      this.busy = false;
      const report = rep.finish(s);
      if (away >= REPORT_MIN_MS) this.showReport(report);
      await this.save();
    }
    startLoop() {
      this.stopLoop();
      this.win.classList.remove("creating");
      this.makeCtx();
      this.sig = "";
      this.renderTab(true);
      const be = this.battle.events(() => performance.now(), () => this.state);
      const sfx = (x, loud = false) => {
        if (!this.battle.quiet && (loud || !this.frame.mini)) this.sound.play(x);
      };
      const ev = {
        ...be,
        heroUse: (fx, targets) => {
          this.lastUse = performance.now();
          be.heroUse?.(fx, targets);
        },
        heroHit: (i, dmg, crit) => {
          be.heroHit?.(i, dmg, crit);
          sfx(crit ? "crit" : "hit");
        },
        monsterHit: (i, dmg, avoided) => {
          be.monsterHit?.(i, dmg, avoided);
          if (!avoided) sfx("hurt");
        },
        flask: () => {
          be.flask?.();
          sfx("flask");
        },
        story: (text) => this.showStory(text),
        zone: (_from, to, why) => {
          if (why === "unlock") this.toast(`New road: ${ZONES[to]?.name ?? to}`, "road");
        },
        kill: (_m, xp) => {
          if (xp > 0) this.xpLog.push([Date.now(), xp]);
          sfx("kill");
        },
        level: (l) => {
          be.level?.(l);
          this.toast(`Level ${l}`, "level");
          this.lastEvent = `Reached level ${l}`;
          sfx("level", true);
        },
        loot: (item, kept, equipped) => {
          if (!kept) return;
          if (item.rarity !== "plain") sfx(item.rarity === "enchanted" ? "loot1" : item.rarity === "rare" ? "loot2" : "loot3", item.rarity !== "enchanted");
          const name = itemLabel(item);
          if (equipped) {
            this.toast(`Equipped: ${name}`, item.rarity);
            this.lastEvent = `Equipped ${name}`;
          } else if (item.rarity === "rare" || item.rarity === "relic") {
            this.toast(`${item.rarity === "relic" ? "Relic" : "Rare"}: ${name}`, item.rarity);
            this.lastEvent = `Found ${name}`;
          }
        },
        death: () => {
          this.lastEvent = "Died. The ember relights.";
          sfx("death");
        }
      };
      this.timer = window.setInterval(() => {
        if (!this.state || this.busy) return;
        if (Date.now() - this.state.simTo > 3e4) {
          void this.catchUp();
          return;
        }
        advance(this.state, Date.now(), ev, 50);
        if (Date.now() - this.lastSave > AUTOSAVE_MS) void this.save();
      }, STEP_MS);
      const frame = () => {
        this.raf = requestAnimationFrame(frame);
        if (!this.state || document.hidden) return;
        if (!this.frame.mini && this.frame.stage !== "off") this.battle.draw(this.state, runSheet(this.state), performance.now());
        this.drawHud();
        if (!this.frame.mini) this.renderTab(false);
      };
      this.raf = requestAnimationFrame(frame);
    }
    stopLoop() {
      if (this.timer !== null) clearInterval(this.timer);
      if (this.raf !== null) cancelAnimationFrame(this.raf);
      this.timer = this.raf = null;
    }
    // ---- UI -----------------------------------------------------------------
    makeCtx() {
      const self = this;
      this.ctx = {
        get state() {
          return self.state;
        },
        sheet: () => sheetOf(this.state),
        act: (fn, ok) => {
          const err = fn(this.state);
          if (typeof err === "string") this.toast(err, "err");
          else if (ok) this.toast(ok);
          this.sig = "";
          this.renderTab(true);
          void this.save();
        },
        toast: (m4) => this.toast(m4),
        modal: (el) => this.modal(el),
        sel: {},
        rerender: () => {
          this.sig = "";
          this.renderTab(true);
        },
        exportSave: () => exportText(wrap(this.state, Date.now())),
        importSave: async (text) => {
          try {
            const env = _GameWindow.accept(importText(text));
            await this.save();
            this.lastBackup = 0;
            this.state = env.state;
            this.ctx.sel = {};
            await this.catchUp();
            await this.save();
            this.sig = "";
            this.renderTab(true);
            return null;
          } catch (e) {
            return e instanceof SaveError ? e.message : "could not read that save";
          }
        },
        resetGame: () => {
          this.stopLoop();
          this.state = null;
          this.kv.del(QUICK_KEY);
          void this.store.del("main").then(() => this.store.del("backup")).then(() => this.showCreation());
        },
        storeKind: this.store.kind
      };
    }
    lastSigCheck = 0;
    supportHint = { rev: -1, level: -1, gain: false };
    renderTab(force) {
      if (!this.state || !this.ctx) return;
      if (!force) {
        const t = performance.now();
        if (t - this.lastSigCheck < 250) return;
        this.lastSigCheck = t;
      }
      this.updateBadges();
      const sig = this.view + ":" + viewSig(this.view, this.ctx);
      if (!force && sig === this.sig) return;
      this.sig = sig;
      for (const b of this.nav.querySelectorAll("button")) {
        const on = b.getAttribute("data-v") === this.view;
        b.classList.toggle("on", on);
        b.setAttribute("aria-selected", String(on));
      }
      const top = this.body.scrollTop;
      clear(this.body);
      this.body.append(renderView(this.view, this.ctx));
      this.body.scrollTop = top;
    }
    /** Small counters on the tabs: things waiting for a decision. */
    updateBadges() {
      const s = this.state;
      const hero = s.hero;
      if (this.supportHint.rev !== hero.rev || this.supportHint.level !== hero.level) {
        const slots = supportSlots(hero.level);
        const active = hero.supports.filter((id) => SUPPORTS[id] && SUPPORTS[id].level <= hero.level).slice(0, slots);
        let gain = false;
        if (active.length < slots) {
          const cur = sheetOf(s).skill;
          for (const x of Object.values(SUPPORTS)) {
            if (x.level > hero.level || active.includes(x.id) || x.requires.length && !x.requires.some((t) => cur.tags.includes(t))) continue;
            if (deriveSheet({ ...hero, supports: [...active, x.id], rev: -1 }).skill.packDps > cur.packDps * 1.005) {
              gain = true;
              break;
            }
          }
        }
        this.supportHint = { rev: hero.rev, level: hero.level, gain };
      }
      const freeSupport = this.supportHint.gain;
      const tree = Math.max(0, pointsLeft(hero)) + Math.max(0, ascPointsLeft(hero));
      const atlas = Math.max(0, atlasPointsLeft(s));
      const marks = {
        skills: freeSupport ? ["!", "A free support slot would add damage"] : void 0,
        tree: tree ? [String(tree), `${tree} passive point${tree > 1 ? "s" : ""} to spend`] : void 0,
        atlas: atlas ? [String(atlas), `${atlas} atlas point${atlas > 1 ? "s" : ""} to spend`] : void 0,
        gear: s.stashFull || s.stash.length >= s.stashCap ? ["!", "Stash is full: drops are being salvaged"] : void 0
      };
      for (const b of this.nav.children) {
        const id = b.getAttribute("data-v");
        const badge = b.querySelector(".badge");
        const m4 = marks[id];
        const text = m4?.[0] ?? "";
        if (badge.textContent !== text) {
          badge.textContent = text;
          badge.toggleAttribute("hidden", !m4);
          badge.title = m4?.[1] ?? "";
        }
      }
    }
    whereKey = "";
    ariaAt = 0;
    drawHud() {
      const s = this.state;
      const sh = runSheet(s);
      const run = s.activity.run;
      const hh = run?.hero;
      const need = xpToNext(s.hero.level);
      const xpF = isFinite(need) ? s.hero.xp / need : 1;
      const eta = this.eta(need - s.hero.xp);
      const z = run ? runZone(s, run) : ZONES[s.activity.zone];
      const speed = Math.max(0.05, Math.min(sh.skill.speed, sh.skill.sustain));
      const w2 = s.hero.equipment.weapon;
      const now = performance.now();
      const life = hh?.life ?? sh.life, mana = hh?.mana ?? sh.mana, es = hh?.es ?? sh.es;
      this.hud.draw({
        life,
        lifeMax: sh.life,
        es,
        esMax: sh.es,
        mana,
        manaMax: sh.mana,
        flask: hh?.flask ?? 30,
        flaskMax: 30,
        level: s.hero.level,
        xpFrac: xpF,
        eta: eta.replace(/^~/, "~ "),
        ready: run?.phase === "fight" ? (now - this.lastUse) / (1e3 / speed) : 1,
        skillName: sh.skill.name,
        weaponKind: w2 ? baseOf(w2).kind : null,
        spell: sh.skill.kind !== "attack",
        zone: z.name,
        zoneLevel: z.level,
        packDps: sh.skill.packDps,
        dead: run?.phase === "dead"
      }, now);
      const wk = `${z.id}|${z.palette.join()}`;
      if (wk !== this.whereKey) {
        this.whereKey = wk;
        const [sky, ground] = z.palette;
        this.stage.style.background = `linear-gradient(to bottom, ${sky} 0 83.4%, #111 83.4% 85%, ${ground} 85% 100%)`;
      }
      const cls = CLASSES[s.hero.cls]?.name ?? "";
      const who = `${s.hero.name}|${s.hero.level}|${cls}`;
      if (this.who.dataset.k !== who) {
        this.who.dataset.k = who;
        this.who.replaceChildren(h("b", { text: s.hero.name }), h("span", { text: `Level ${s.hero.level} ${cls}` }));
      }
      if (now - this.ariaAt > 1e3) {
        this.ariaAt = now;
        const n = (x) => fmt(Math.floor(Math.max(0, x)));
        const label = `Life ${n(life)} of ${n(sh.life)}${sh.es ? `, energy shield ${n(es)} of ${n(sh.es)}` : ""}, mana ${n(mana)} of ${n(sh.mana)}, flask ${Math.floor(hh?.flask ?? 30)} of 30. Level ${s.hero.level}, ${(xpF * 100).toFixed(1)}% experience${eta ? ` (${eta})` : ""}. ${z.name}, area level ${z.level}. ${fmt(sh.skill.packDps)} pack DPS.`;
        this.hudWrap.setAttribute("aria-label", label);
        this.hudWrap.title = label;
        const last = this.miniBox.firstElementChild;
        if (last.textContent !== this.lastEvent) last.textContent = this.lastEvent;
      }
    }
    /** "~12m to go" from the kill XP of the last few minutes; blank until there is enough to go on. */
    eta(left) {
      const now = Date.now();
      while (this.xpLog.length && now - this.xpLog[0][0] > XP_WINDOW_MS) this.xpLog.shift();
      if (!isFinite(left) || this.xpLog.length < 3) return "";
      const span = Math.max(3e4, now - this.xpLog[0][0]);
      const rate = this.xpLog.reduce((a, [, x]) => a + x, 0) / span;
      if (rate <= 0) return "";
      return `~${fmtDuration(left / rate)} to level`;
    }
    toast(msg, kind = "") {
      const t = h("div", { class: `toast${kind ? " t-" + kind : ""}`, text: msg });
      this.toasts.prepend(t);
      while (this.toasts.childElementCount > 4) this.toasts.lastElementChild.remove();
      setTimeout(() => {
        t.classList.add("out");
        setTimeout(() => t.remove(), 220);
      }, kind === "err" ? 3200 : 2600);
    }
    modal(content) {
      const m4 = h("div", { class: "modal", attrs: { role: "dialog", "aria-modal": "true" } }, content);
      this.win.append(m4);
      return () => m4.remove();
    }
    showCreation() {
      clear(this.body);
      this.win.classList.add("creating");
      if (this.frame.mini) this.setMini(false);
      this.who.dataset.k = "";
      this.who.replaceChildren(h("b", { text: "A new Kindled" }));
      let started = false;
      this.body.append(creationView(async (name, cls) => {
        if (started) return;
        started = true;
        this.state = newGame({ name, cls, now: Date.now(), seed: Math.random() * 2 ** 32 >>> 0 });
        await this.save();
        this.startLoop();
      }));
    }
    storyBox = null;
    /** One story window at a time: later beats are added to the open one. */
    showStory(text) {
      if (this.storyBox?.isConnected) {
        this.storyBox.append(h("div", { class: "story", style: "margin-top:6px", text }));
        return;
      }
      const box2 = h("div", { class: "col" }, h("div", { class: "story", text }));
      const card = h("div", { class: "card col" }, h("h3", { text: "The road remembers" }), box2);
      const close = this.modal(card);
      this.storyBox = box2;
      card.append(h("button", { class: "btn", text: "Onward", on: { click: () => {
        close();
        this.storyBox = null;
      } } }));
    }
    showReport(r3) {
      const rows = [
        ["Time away", fmtDuration(r3.to - r3.from)],
        ["Runs cleared", fmt(r3.runs)],
        ["Monsters slain", fmt(r3.kills)],
        ["Bosses", fmt(r3.bosses)],
        ["Deaths", fmt(r3.deaths)],
        ["Levels", r3.levelTo > r3.levelFrom ? `${r3.levelFrom} -> ${r3.levelTo}` : `${r3.levelTo} (no change)`],
        ["Experience", fmt(r3.xp)],
        ["Items kept", fmt(r3.kept)],
        ["Salvaged", fmt(r3.salvaged)],
        ["Ember dust", `+${fmt(r3.dust)}`]
      ];
      const kvEl = h("div", { class: "kv" });
      for (const [k, v] of rows) kvEl.append(h("div", { text: k }), h("div", { class: "num", text: v }));
      const card = h("div", { class: "card col" }, h("h3", { text: "While you were away" }), kvEl);
      for (const t of r3.story.slice(-3)) card.append(h("div", { class: "story", text: t }));
      if (r3.zones.length) card.append(h("div", { class: "tag", style: "background:var(--teal)", text: `New roads: ${r3.zones.join(", ")}` }));
      if (r3.equipped.length) card.append(h("div", { class: "tag", style: "background:var(--gold)", text: `Equipped: ${r3.equipped.slice(-4).join(", ")}` }));
      if (r3.best.length) {
        const best = r3.best[r3.best.length - 1];
        card.append(h("div", { class: "muted", text: "Best find:" }), itemCard(best, null));
      }
      const close = this.modal(card);
      card.append(h("button", { class: "btn", text: "Back to it", on: { click: () => close() } }));
    }
  };
  function summaryOf(s) {
    const need = xpToNext(s.hero.level);
    const run = s.activity.run;
    return { name: s.hero.name, cls: s.hero.cls, level: s.hero.level, zone: run ? runZone(s, run).name : ZONES[s.activity.zone]?.name ?? s.activity.zone, savedAt: Date.now(), xpFrac: isFinite(need) ? s.hero.xp / need : 1 };
  }

  // src/ui/card.ts
  var CARD_CSS = `
:host { all: initial; display: block; }
.c { font: 13px/1.35 "Segoe UI", system-ui, sans-serif; color: #111; background: #fff4dc; border: 3px solid #111; box-shadow: 5px 5px 0 #111; margin: 8px 10px 14px 4px; }
.top { background: #ff5a36; border-bottom: 3px solid #111; padding: 6px 10px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; display: flex; justify-content: space-between; }
.in { padding: 10px; display: flex; flex-direction: column; gap: 8px; }
.hero { font-weight: 900; font-size: 16px; }
.muted { color: #5b5446; font-size: 12px; }
.xp { height: 10px; border: 2px solid #111; background: #fff; } .xp i { display: block; height: 100%; background: #ffc233; }
button { cursor: pointer; font: inherit; font-weight: 900; padding: 8px 12px; background: #ffc233; color: #111; border: 3px solid #111; box-shadow: 3px 3px 0 #111; text-transform: uppercase; }
button:hover { transform: translate(-1px,-1px); box-shadow: 4px 4px 0 #111; }
button:active { transform: translate(2px,2px); box-shadow: 1px 1px 0 #111; }
.dark .c { background: #2a2533; color: #f7f1e6; } .dark .muted { color: #bdb3a3; }
`;
  function mountCard(el, api, summary, isOpen, onOpen) {
    const holder = document.createElement("div");
    const root = holder.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = CARD_CSS;
    root.append(style);
    const wrap2 = h("div", { class: api.theme() === "dark" ? "dark" : "" });
    const inner = h("div", { class: "in" });
    const c = h("div", { class: "c" }, h("div", { class: "top" }, h("span", { text: api.t("title") }), h("span", { text: "idle arpg" })), inner);
    if (summary) {
      const zone = ZONES[summary.zone]?.name ?? summary.zone;
      inner.append(
        h("div", { class: "hero", text: `${summary.name}` }),
        h("div", { class: "muted", text: api.t("card.line", { level: summary.level, cls: CLASSES[summary.cls]?.name ?? summary.cls, zone }) }),
        h("div", { class: "xp" }, h("i", { style: `width:${Math.round(summary.xpFrac * 100)}%` })),
        h("div", { class: "muted", text: api.t("card.away", { time: fmtDuration(Math.max(0, Date.now() - summary.savedAt)) }) })
      );
    } else {
      inner.append(h("div", { text: api.t("card.new") }));
    }
    inner.append(h("button", { text: isOpen ? api.t("card.focus") : summary ? api.t("card.play") : api.t("card.start"), on: { click: onOpen } }));
    inner.append(h("div", { class: "muted", text: api.t("card.hint") }));
    wrap2.append(c);
    root.append(wrap2);
    el.append(holder);
    return { unmount() {
      holder.remove();
    } };
  }

  // src/platform/store.ts
  var DB = "hollowmarch";
  var STORE = "saves";
  function req(r3) {
    return new Promise((res, rej) => {
      r3.onsuccess = () => res(r3.result);
      r3.onerror = () => rej(r3.error);
    });
  }
  async function openStore() {
    try {
      if (typeof indexedDB === "undefined") throw new Error("no indexedDB");
      const open = indexedDB.open(DB, 1);
      open.onupgradeneeded = () => {
        if (!open.result.objectStoreNames.contains(STORE)) open.result.createObjectStore(STORE);
      };
      const db = await req(open);
      const tx = (mode) => db.transaction(STORE, mode).objectStore(STORE);
      return {
        kind: "indexeddb",
        get: (key) => req(tx("readonly").get(key)),
        put: async (key, value) => {
          await req(tx("readwrite").put(value, key));
        },
        del: async (key) => {
          await req(tx("readwrite").delete(key));
        }
      };
    } catch (e) {
      console.warn("[Hollowmarch] IndexedDB unavailable, progress will not persist:", e);
      return memoryStore();
    }
  }
  function memoryStore() {
    const m4 = /* @__PURE__ */ new Map();
    return {
      kind: "memory",
      get: async (key) => structuredClone(m4.get(key)),
      put: async (key, value) => {
        m4.set(key, structuredClone(value));
      },
      del: async (key) => {
        m4.delete(key);
      }
    };
  }

  // src/platform/kv.ts
  function localKV(prefix = "hollowmarch.") {
    let ls = null;
    try {
      ls = window.localStorage;
      ls.getItem("x");
    } catch {
      ls = null;
    }
    const mem = /* @__PURE__ */ new Map();
    const read = (k) => {
      try {
        return ls ? ls.getItem(prefix + k) : mem.get(k) ?? null;
      } catch {
        return null;
      }
    };
    return {
      get(k) {
        const raw = read(k);
        if (raw === null) return null;
        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      },
      set(k, v) {
        const raw = JSON.stringify(v);
        try {
          if (ls) ls.setItem(prefix + k, raw);
          else mem.set(k, raw);
        } catch {
        }
      },
      del(k) {
        try {
          if (ls) ls.removeItem(prefix + k);
          else mem.delete(k);
        } catch {
        }
      }
    };
  }
  function hubKV(api) {
    const all = () => {
      const o = api.load();
      return o && typeof o === "object" ? { ...o } : {};
    };
    const kv2 = (o) => o.kv && typeof o.kv === "object" ? { ...o.kv } : {};
    return {
      get(k) {
        return kv2(all())[k] ?? null;
      },
      set(k, v) {
        const o = all();
        const m4 = kv2(o);
        m4[k] = v;
        o.kv = m4;
        api.save(o);
      },
      del(k) {
        const o = all();
        const m4 = kv2(o);
        delete m4[k];
        o.kv = m4;
        api.save(o);
      }
    };
  }

  // src/main.ts
  var ID = "arpg";
  var ICON = "M12 1.5c1.7 3.1 4.6 4.9 4.6 8.9a4.6 4.6 0 0 1-9.2 0c0-1.9.8-3.2 1.9-4.3.2 1.4.9 2.4 2.2 2.8-.6-2.6-.2-5 .5-7.4ZM4 17h16v2.5H4ZM7 21h10v1.5H7Z";
  var STRINGS = {
    "arpg.title": "Hollowmarch",
    "arpg.desc": "An idle action RPG. Build a hero, it fights on its own; time away is replayed when you come back.",
    "arpg.card.line": "Level {level} {cls} in {zone}",
    "arpg.card.away": "Last seen {time} ago. The road kept going.",
    "arpg.card.new": "The sun went out. You woke up anyway.",
    "arpg.card.play": "Open the game",
    "arpg.card.start": "Start a hero",
    "arpg.card.focus": "Game is open",
    "arpg.card.hint": "Opens in its own window. Nothing runs while it is closed; progress is replayed on open."
  };
  var storePromise = null;
  var game = null;
  var opening = null;
  var w = window;
  var standalone = !(w.__questAgent || w.__questAgentAddons);
  var hub = null;
  var refreshCard = null;
  var store = () => storePromise ??= openStore();
  function openGame() {
    return opening ??= doOpen().finally(() => {
      opening = null;
    });
  }
  var generation = 0;
  async function doOpen() {
    const gen = generation;
    if (!game) {
      const st = await store();
      if (gen !== generation) return;
      const kv2 = hub ? hubKV(hub) : localKV();
      game = new GameWindow(st, kv2, {
        summary: (s) => {
          if (hub) {
            const o = hub.load() ?? {};
            hub.save({ ...o, summary: s });
          }
          refreshCard?.();
        },
        theme: () => hub?.theme() === "light" ? "light" : hub ? "dark" : "light",
        onClose: () => {
          refreshCard?.();
          if (standalone) showOpener();
        }
      });
    }
    await game.open();
    refreshCard?.();
  }
  var def = {
    id: ID,
    version: 1,
    icon: ICON,
    strings: STRINGS,
    init(api) {
      hub = api;
      generation++;
    },
    /** The hub's title-bar button works like a taskbar button: opens the game, then folds it to mini mode and back. */
    launch(api) {
      hub = api;
      if (game?.isOpen) void game.toggle();
      else void openGame();
    },
    mount(el, api) {
      hub = api;
      let view = null;
      const draw = () => {
        view?.unmount();
        const o = api.load();
        const saved = o?.summary ?? (o && typeof o.level === "number" ? o : null);
        view = mountCard(el, api, saved && typeof saved.level === "number" ? saved : null, !!game?.isOpen, () => void openGame());
      };
      draw();
      refreshCard = draw;
      return { unmount() {
        view?.unmount();
        if (refreshCard === draw) refreshCard = null;
      } };
    },
    destroy() {
      const g = game, gen = ++generation;
      game = null;
      void (g ? g.close() : Promise.resolve()).finally(() => {
        if (gen === generation) {
          hub = null;
          refreshCard = null;
        }
      });
    }
  };
  function showOpener() {
    const b = document.createElement("button");
    b.textContent = "Open Hollowmarch";
    b.setAttribute("style", "position:fixed;left:16px;bottom:16px;z-index:10049;font:900 14px Segoe UI,sans-serif;padding:10px 16px;background:#ffc233;border:3px solid #111;box-shadow:4px 4px 0 #111;cursor:pointer");
    b.addEventListener("click", () => {
      b.remove();
      void openGame();
    });
    document.body.append(b);
  }
  if (!standalone) {
    const queue = w.__questAgentAddons ?? (w.__questAgentAddons = []);
    queue.push(def);
  } else {
    void openGame();
  }
  w.__hollowmarch = { open: openGame, close: () => game?.close(), get game() {
    return game;
  } };
})();
