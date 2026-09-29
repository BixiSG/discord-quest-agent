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
    const ring = [];
    for (let i = 0; i < RING; i++) {
      const [name, mods] = RING_MODS[i % RING_MODS.length];
      const [x, y] = polar(R_RING, -90 + 360 / RING * i);
      ring.push(add({ id: `ring${i}`, name, kind: "ring", x, y, mods }));
    }
    ring.forEach((id, i) => link(id, ring[(i + 1) % RING]));
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
      link(prev, ring[ringIdx]);
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

  // src/ui/battle.ts
  var W = 320;
  var H = 120;
  var GROUND = 100;
  var HERO_X = 64;
  var Battle = class {
    canvas;
    g;
    fx = [];
    floats = [];
    flash = /* @__PURE__ */ new Map();
    dying = /* @__PURE__ */ new Map();
    packKey = "";
    heroHurt = 0;
    lastDraw = 0;
    travel = 0;
    /** Set by the app while it is catching up, so bursts of events don't pile up. */
    quiet = false;
    constructor() {
      this.canvas = document.createElement("canvas");
      this.canvas.width = W;
      this.canvas.height = H;
      this.g = this.canvas.getContext("2d");
    }
    positions(state) {
      const run = state.activity.run;
      if (!run) return [];
      const n = run.monsters.length;
      if (n === 1 && MONSTERS[run.monsters[0].def]?.boss) return [[236, GROUND]];
      return run.monsters.map((_, i) => {
        const row = Math.floor(i / 3), col = i % 3;
        return [178 + col * 44 + row * 22, GROUND - row * 12];
      });
    }
    /** Events to hand to advance() while online. */
    events(now, state) {
      return {
        heroUse: (kind, targets) => {
          if (!this.quiet) this.pushFx({ kind, t: now(), targets });
        },
        heroHit: (i, dmg, crit) => {
          if (this.quiet) return;
          const p = this.positions(state())[i];
          this.flash.set(i, now());
          if (p) this.pushFloat({ x: p[0], y: p[1] - 30, text: fmtShort(dmg), color: crit ? "#ffc233" : "#ffffff", t: now(), big: crit });
        },
        heroMiss: (i) => {
          if (this.quiet) return;
          const p = this.positions(state())[i];
          if (p) this.pushFloat({ x: p[0], y: p[1] - 30, text: "miss", color: "#9aa0a6", t: now(), big: false });
        },
        monsterHit: (_i, dmg, avoided) => {
          if (this.quiet) return;
          if (avoided) this.pushFloat({ x: HERO_X, y: GROUND - 34, text: avoided, color: "#7fd1ff", t: now(), big: false });
          else {
            this.heroHurt = now();
            this.pushFloat({ x: HERO_X - 6, y: GROUND - 34, text: fmtShort(dmg), color: "#ff5a36", t: now(), big: false });
          }
        },
        flask: () => {
          if (!this.quiet) this.pushFloat({ x: HERO_X, y: GROUND - 44, text: "+flask", color: "#3fbf5f", t: now(), big: false });
        },
        level: (l) => {
          if (!this.quiet) this.pushFloat({ x: HERO_X, y: GROUND - 52, text: "LEVEL " + l, color: "#ffc233", t: now(), big: true });
        }
      };
    }
    pushFx(f) {
      this.fx.push(f);
      if (this.fx.length > 12) this.fx.shift();
    }
    jitter = 0;
    pushFloat(f) {
      this.jitter = (this.jitter + 1) % 5;
      f.x += (this.jitter - 2) * 5;
      f.y -= this.jitter % 3 * 4;
      this.floats.push(f);
      if (this.floats.length > 24) this.floats.shift();
    }
    draw(state, sheet, now) {
      const g = this.g;
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
      }
      this.background(zone.palette, zone.id);
      const pos2 = this.positions(state);
      if (run && (run.phase === "fight" || run.phase === "dead")) {
        run.monsters.forEach((m4, i) => {
          const p = pos2[i];
          if (m4.life <= 0 && !this.dying.has(i)) this.dying.set(i, now);
          const died = this.dying.get(i);
          const fade = died ? 1 - (now - died) / 400 : 1;
          if (fade <= 0) return;
          const def2 = MONSTERS[m4.def];
          const hit = now - (this.flash.get(i) ?? -1e9) < 90;
          g.globalAlpha = Math.max(0, fade);
          drawMonster(g, def2, p[0], p[1] + (died ? (1 - fade) * 6 : 0), hit, m4.champion, now);
          g.globalAlpha = 1;
          if (!died) {
            const w2 = def2.boss ? 40 : 22;
            bar(g, p[0] - w2 / 2, p[1] - monsterHeight(def2) - 8, w2, 3, m4.life / m4.maxLife, m4.champion ? "#ffc233" : "#e5383b");
          }
        });
        const boss = run.monsters.find((m4) => MONSTERS[m4.def]?.boss && m4.life > 0);
        if (boss) {
          g.fillStyle = "#111";
          g.fillRect(90, 4, 140, 12);
          g.fillStyle = "#fff";
          g.font = "bold 8px monospace";
          g.textAlign = "center";
          g.fillText(MONSTERS[boss.def].name.toUpperCase(), 160, 13);
        }
      }
      const last = this.fx[this.fx.length - 1];
      let lunge = 0;
      if (last && now - last.t < 160 && (last.kind === "arc" || last.kind === "stab" || last.kind === "slam")) lunge = Math.sin((now - last.t) / 160 * Math.PI) * 14;
      const walking = run?.phase === "travel";
      const dead = run?.phase === "dead";
      const wItem = state.hero.equipment.weapon;
      const look = { cape: CLASSES[state.hero.cls]?.color ?? "#e2543b", weapon: wItem ? BASES[wItem.base]?.kind ?? "sword" : "none", shield: !!state.hero.equipment.offhand };
      drawHero(g, HERO_X + lunge, GROUND, look, walking ? now : 0, now - this.heroHurt < 120, dead);
      this.fx = this.fx.filter((f) => now - f.t < 350);
      for (const f of this.fx) this.drawFx(f, pos2, now);
      g.textAlign = "center";
      this.floats = this.floats.filter((f) => now - f.t < 800);
      for (const f of this.floats) {
        const k = (now - f.t) / 800;
        g.font = f.big ? "bold 10px monospace" : "bold 8px monospace";
        g.globalAlpha = 1 - k * k;
        const y = f.y - k * 16;
        g.fillStyle = "#111";
        g.fillText(f.text, f.x + 1, y + 1);
        g.fillStyle = f.color;
        g.fillText(f.text, f.x, y);
      }
      g.globalAlpha = 1;
      if (dead && run) {
        g.fillStyle = "rgba(10,10,14,0.6)";
        g.fillRect(0, 0, W, H);
        g.fillStyle = "#ff5a36";
        g.font = "bold 12px monospace";
        g.textAlign = "center";
        g.fillText("THE EMBER RELIGHTS", W / 2, 54);
        g.fillStyle = "#fff";
        g.font = "bold 8px monospace";
        g.fillText(`back in ${Math.max(0, run.timer).toFixed(0)}s`, W / 2, 68);
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
      g.fillStyle = pal[0];
      g.fillRect(0, 0, W, H);
      let s = 0;
      for (const c of seedStr) s = s * 31 + c.charCodeAt(0) >>> 0;
      g.fillStyle = pal[2];
      for (let i = 0; i < 14; i++) {
        s = s * 1103515245 + 12345 >>> 0;
        const x = s % W;
        s = s * 1103515245 + 12345 >>> 0;
        g.fillRect(x, s % 50 + 4, 1, 1);
      }
      hills(g, shade(pal[0], -0.25), 64, 18, this.travel * 0.3, 0.035);
      hills(g, shade(pal[1], -0.35), 82, 12, this.travel * 0.6, 0.06);
      g.fillStyle = pal[1];
      g.fillRect(0, GROUND, W, H - GROUND);
      g.fillStyle = "#111";
      g.fillRect(0, GROUND, W, 2);
      g.fillStyle = shade(pal[1], -0.2);
      for (let x = -(this.travel * 1.2 % 24); x < W; x += 24) g.fillRect(x, GROUND + 8, 10, 2);
    }
    drawFx(f, pos2, now) {
      const g = this.g;
      const k = (now - f.t) / 350;
      const targets = f.targets.map((i) => pos2[i]).filter((p) => !!p);
      g.lineWidth = 2;
      if (f.kind === "arc") {
        g.strokeStyle = `rgba(255,255,255,${1 - k})`;
        g.beginPath();
        g.arc(HERO_X + 14, GROUND - 14, 22 + k * 20, -1.1, 0.9);
        g.stroke();
        g.strokeStyle = `rgba(255,90,54,${1 - k})`;
        g.beginPath();
        g.arc(HERO_X + 14, GROUND - 14, 18 + k * 20, -1, 0.8);
        g.stroke();
      } else if (f.kind === "slam") {
        g.strokeStyle = `rgba(255,194,51,${1 - k})`;
        g.beginPath();
        g.ellipse(HERO_X + 30 + k * 60, GROUND, 10 + k * 90, 4 + k * 6, 0, Math.PI, 0);
        g.stroke();
      } else if (f.kind === "stab") {
        for (const p of targets.slice(0, 1)) {
          g.strokeStyle = `rgba(255,255,255,${1 - k})`;
          g.beginPath();
          g.moveTo(p[0] - 10, p[1] - 22);
          g.lineTo(p[0] + 10, p[1] - 8);
          g.stroke();
          g.beginPath();
          g.moveTo(p[0] + 10, p[1] - 22);
          g.lineTo(p[0] - 10, p[1] - 8);
          g.stroke();
        }
      } else if (f.kind === "bolt") {
        const end = targets[targets.length - 1] ?? [W - 20, GROUND - 14];
        const x = HERO_X + 10 + (end[0] - HERO_X - 10) * Math.min(1, k * 2), y = GROUND - 14 + (end[1] - 14 - GROUND + 14) * Math.min(1, k * 2);
        g.fillStyle = "#111";
        g.fillRect(x - 3, y - 3, 7, 7);
        g.fillStyle = "#ffc233";
        g.fillRect(x - 2, y - 2, 5, 5);
      } else if (f.kind === "nova") {
        g.strokeStyle = `rgba(143,211,255,${1 - k})`;
        g.beginPath();
        g.arc(HERO_X, GROUND - 12, 10 + k * 120, 0, Math.PI * 2);
        g.stroke();
      }
      g.lineWidth = 1;
    }
  };
  function hills(g, color, base, amp, off, freq) {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, GROUND);
    for (let x = 0; x <= W; x += 4) g.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin((x + off) * freq) * Math.cos((x + off) * freq * 0.37)));
    g.lineTo(W, GROUND);
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
.hm {
  --paper: #fff4dc; --paper2: #ffe3a8; --card: #ffffff; --text: #111111; --muted: #5b5446; --line: #111111;
  --ember: #ff5a36; --gold: #ffc233; --teal: #19b3a3; --blue: #3a7bff; --violet: #8b5cf6; --green: #3fbf5f; --red: #e5383b;
  --r-plain: #d8d8d8; --r-enchanted: #5aa9ff; --r-rare: #ffd23f; --r-relic: #ff8a1f;
  --sh: 4px 4px 0 var(--line);
  font: 13px/1.35 "Segoe UI", system-ui, -apple-system, sans-serif; color: var(--text);
}
.hm.dark { --paper: #2a2533; --paper2: #3a3346; --card: #342e40; --text: #f7f1e6; --muted: #bdb3a3; --line: #000000; }
.win {
  position: fixed; z-index: 10050; display: flex; flex-direction: column; min-width: 360px; min-height: 320px;
  background: var(--paper); border: 3px solid var(--line); box-shadow: 8px 8px 0 var(--line); overflow: hidden;
}
.bar { display: flex; align-items: center; gap: 8px; padding: 6px 8px; background: var(--ember); border-bottom: 3px solid var(--line); cursor: move; user-select: none; touch-action: none; }
.bar .logo { font-weight: 900; letter-spacing: 1px; font-size: 14px; color: #111; text-transform: uppercase; }
.bar .who { flex: 1; font-weight: 700; color: #111; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
button:focus-visible, select:focus-visible, input:focus-visible, textarea:focus-visible, .win:focus-visible { outline: 3px dashed var(--ember); outline-offset: 2px; }
.win:focus { outline: none; }
.x { cursor: pointer; background: var(--card); color: var(--text); border: 2px solid var(--line); width: 26px; height: 26px; font-weight: 900; box-shadow: 2px 2px 0 var(--line); }
.x:hover { background: var(--gold); color: #111; }
.grip { position: absolute; right: 0; bottom: 0; width: 18px; height: 18px; cursor: nwse-resize; touch-action: none;
  background: linear-gradient(135deg, transparent 50%, var(--line) 50%, var(--line) 60%, transparent 60%, transparent 70%, var(--line) 70%, var(--line) 80%, transparent 80%); }
.stage { position: relative; border-bottom: 3px solid var(--line); background: #111; flex: none; }
.stage canvas { display: block; width: 100%; height: 100%; image-rendering: pixelated; }
.hud { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 10px; padding: 6px 8px; border-bottom: 3px solid var(--line); background: var(--paper2); flex: none; }
.meter { position: relative; height: 16px; border: 2px solid var(--line); background: var(--card); overflow: hidden; }
.meter i { position: absolute; left: 0; top: 0; bottom: 0; }
.meter span { position: relative; font-size: 11px; font-weight: 800; padding-left: 4px; line-height: 12px; color: var(--text); text-shadow: 1px 1px 0 var(--paper); white-space: nowrap; }
.tabs { display: flex; gap: 0; border-bottom: 3px solid var(--line); background: var(--paper); flex: none; overflow-x: auto; }
.tabs button { flex: 1; min-width: 60px; padding: 6px 4px; background: transparent; border: 0; border-right: 3px solid var(--line); font-weight: 800; color: var(--text); cursor: pointer; font-size: 12px; text-transform: uppercase; }
.tabs button:last-child { border-right: 0; }
.tabs button.on { background: var(--gold); color: #111; }
.tabs button:hover:not(.on) { background: var(--paper2); }
.body { flex: 1; overflow: auto; padding: 10px; }
.row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.col { display: flex; flex-direction: column; gap: 8px; }
.grow { flex: 1; }
.card { background: var(--card); border: 3px solid var(--line); box-shadow: var(--sh); padding: 8px 10px; }
.card h3 { margin: 0 0 6px; font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: .5px; }
.btn { cursor: pointer; font: inherit; font-weight: 800; padding: 5px 10px; background: var(--gold); color: #111; border: 3px solid var(--line); box-shadow: 3px 3px 0 var(--line); }
.btn:hover { transform: translate(-1px, -1px); box-shadow: 4px 4px 0 var(--line); }
.btn:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 var(--line); }
.btn.alt { background: var(--card); color: var(--text); }
.btn.hot { background: var(--ember); color: #111; }
.btn:disabled { opacity: .45; cursor: default; transform: none; box-shadow: 3px 3px 0 var(--line); }
.tag { display: inline-block; font-size: 10px; font-weight: 800; padding: 1px 5px; border: 2px solid var(--line); background: var(--paper2); text-transform: uppercase; }
.muted { color: var(--muted); }
.num { font-variant-numeric: tabular-nums; font-family: "Cascadia Mono", Consolas, "Courier New", monospace; }
.kv { display: grid; grid-template-columns: 1fr auto; gap: 1px 12px; }
.kv > :nth-child(odd) { color: var(--muted); }
.kv > :nth-child(even) { text-align: right; font-weight: 700; }
.kv .click { cursor: pointer; text-decoration: underline dotted; }
.big { font-size: 22px; font-weight: 900; }
.grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
.slots { display: grid; grid-template-columns: repeat(4, 56px); gap: 6px; }
.cell { position: relative; width: 56px; height: 56px; border: 3px solid var(--line); background: var(--card); cursor: pointer; display: flex; align-items: center; justify-content: center; }
.cell canvas { width: 36px; height: 36px; image-rendering: pixelated; }
.cell .lbl { position: absolute; bottom: 1px; left: 2px; font-size: 9px; font-weight: 800; color: var(--muted); text-transform: uppercase; }
.cell.sel { outline: 3px solid var(--ember); outline-offset: 1px; }
.cell.plain { background: var(--r-plain); } .cell.enchanted { background: var(--r-enchanted); } .cell.rare { background: var(--r-rare); } .cell.relic { background: var(--r-relic); }
.cell.empty { background: repeating-linear-gradient(45deg, var(--paper), var(--paper) 6px, var(--paper2) 6px, var(--paper2) 12px); }
.stash { display: grid; grid-template-columns: repeat(auto-fill, 48px); gap: 4px; }
.stash .cell { width: 48px; height: 48px; }
.stash .cell canvas { width: 30px; height: 30px; }
.item { min-width: 220px; }
.item .name { font-weight: 900; font-size: 14px; padding: 4px 6px; border: 3px solid var(--line); margin: -8px -10px 6px; }
.item .name.plain { background: var(--r-plain); color: #111; } .item .name.enchanted { background: var(--r-enchanted); color: #111; }
.item .name.rare { background: var(--r-rare); color: #111; } .item .name.relic { background: var(--r-relic); color: #111; }
.item .aff { font-size: 12px; }
.item .aff b { font-size: 9px; color: var(--muted); margin-left: 4px; }
.item hr { border: 0; border-top: 2px dashed var(--line); margin: 6px 0; }
.up { color: var(--green); font-weight: 800; } .down { color: var(--red); font-weight: 800; }
.skill { display: flex; gap: 8px; align-items: flex-start; padding: 6px 8px; border: 3px solid var(--line); background: var(--card); cursor: pointer; box-shadow: 3px 3px 0 var(--line); }
.skill.on { background: var(--gold); color: #111; }
.skill.locked { opacity: .5; cursor: default; }
.skill .nm { font-weight: 900; }
.skill .ds { font-size: 11px; }
.zone { display: flex; gap: 8px; align-items: center; padding: 6px 8px; border: 3px solid var(--line); background: var(--card); cursor: pointer; margin-bottom: 6px; }
.zone.on { background: var(--teal); color: #111; }
.zone.locked { opacity: .45; cursor: default; }
.log div { padding: 2px 0; border-bottom: 1px dashed var(--muted); font-size: 12px; }
.modal { position: absolute; inset: 0; background: rgba(0,0,0,.45); display: flex; align-items: center; justify-content: center; z-index: 5; padding: 16px; }
.modal .card { max-width: 440px; width: 100%; max-height: 100%; overflow: auto; }
input[type=text], textarea, select { font: inherit; padding: 5px 7px; border: 3px solid var(--line); background: var(--card); color: var(--text); }
textarea { width: 100%; min-height: 70px; font-family: Consolas, monospace; font-size: 11px; }
label.chk { display: flex; gap: 6px; align-items: center; cursor: pointer; font-weight: 700; }
.toast { position: absolute; left: 50%; bottom: 14px; transform: translateX(-50%); background: var(--card); border: 3px solid var(--line); box-shadow: var(--sh); padding: 6px 12px; font-weight: 800; z-index: 6; pointer-events: none; }
.progress { height: 18px; border: 3px solid var(--line); background: var(--card); } .progress i { display: block; height: 100%; background: var(--teal); }
.story { font-style: italic; border-left: 6px solid var(--ember); padding-left: 8px; }
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
  var cache2 = /* @__PURE__ */ new Map();
  function iconFor(kind, slot) {
    const key = kind + ":" + slot;
    let c = cache2.get(key);
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
      cache2.set(key, c);
    }
    const out = document.createElement("canvas");
    out.width = 12;
    out.height = 12;
    out.getContext("2d").drawImage(c, 0, 0);
    return out;
  }

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
  function gearView(c) {
    const st = c.state;
    const eq = st.hero.equipment;
    const slots = h("div", { class: "slots" });
    for (const s of SLOTS) slots.append(itemCell(eq[s], s, c.sel.slot === s && c.sel.uid === void 0, () => {
      c.sel = { slot: s };
      c.rerender();
    }));
    const stash = h("div", { class: "stash" });
    const sorted = [...st.stash].sort((a, b) => RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity] || b.ilvl - a.ilvl);
    for (const it of sorted) stash.append(itemCell(it, null, c.sel.uid === it.uid, () => {
      c.sel = { uid: it.uid };
      c.rerender();
    }));
    for (let i = st.stash.length; i < st.stashCap; i++) stash.append(h("div", { class: "cell empty" }));
    const detail = h("div", { class: "col" });
    const selItem = c.sel.uid !== void 0 ? st.stash.find((x) => x.uid === c.sel.uid) : void 0;
    const selSlot = c.sel.slot;
    if (selItem) {
      const b = baseOf(selItem);
      const targets = slotsFor(b);
      detail.append(itemCard(selItem, c, { compareSlot: targets.length > 1 ? targets.find((t) => !eq[t]) ?? targets[0] : targets[0] }));
      const row = h("div", { class: "row" });
      for (const t of targets) {
        const err = canEquip(st, selItem, t);
        row.append(h("button", {
          class: "btn",
          text: targets.length > 1 ? `Equip (${t === "ring1" ? "left" : "right"})` : "Equip",
          attrs: err ? { disabled: "" } : {},
          title: err ?? "",
          on: { click: () => c.act((s) => {
            const e = equip(s, selItem.uid, t);
            if (!e) c.sel = { slot: t };
            return e;
          }) }
        }));
      }
      row.append(h("button", { class: "btn alt", text: `Salvage (+${salvageValue(selItem)} dust)`, on: { click: () => c.act((s) => {
        salvage(s, [selItem.uid]);
        c.sel = {};
      }) } }));
      detail.append(row);
    } else if (selSlot && eq[selSlot]) {
      detail.append(itemCard(eq[selSlot], c));
      detail.append(h("div", { class: "row" }, h("button", { class: "btn alt", text: "Unequip", on: { click: () => c.act((s) => unequip(s, selSlot)) } })));
    } else {
      detail.append(h("div", { class: "card muted", text: "Pick an item to see it here. Stash items show what equipping them would change." }));
    }
    const plainCount = st.stash.filter((x) => x.rarity === "plain").length;
    const enchCount = st.stash.filter((x) => x.rarity === "enchanted").length;
    const tools = h(
      "div",
      { class: "row" },
      h("span", { class: "tag", text: `Stash ${st.stash.length}/${st.stashCap}` }),
      h("span", { class: "tag", style: "background:var(--gold)", text: `Ember dust ${fmt(st.dust)}` }),
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
    return h(
      "div",
      { class: "col" },
      h(
        "div",
        { class: "row", style: "align-items:flex-start;gap:14px" },
        h("div", { class: "col" }, h("div", { class: "card" }, h("h3", { text: "Equipped" }), slots)),
        h("div", { class: "grow", style: "min-width:240px" }, detail)
      ),
      tools,
      h("div", { class: "card" }, h("h3", { text: "Stash" }), stash)
    );
  }
  function skillsView(c) {
    const hero = c.state.hero;
    const cur = c.sheet();
    const skills = h("div", { class: "col" });
    for (const s of Object.values(SKILLS)) {
      const locked = s.level > hero.level;
      const on = hero.skill === s.id;
      skills.append(h(
        "div",
        { class: `skill${on ? " on" : ""}${locked ? " locked" : ""}`, on: { click: () => {
          if (!locked && !on) c.act((st) => setSkill(st, s.id), `${s.name} selected`);
        } } },
        h(
          "div",
          { class: "grow" },
          h("div", { class: "nm", text: s.name }),
          h("div", { class: "ds", text: s.blurb }),
          h("div", { class: "row", style: "gap:4px;margin-top:3px" }, ...s.tags.map((t) => h("span", { class: "tag", text: t })))
        ),
        h("div", { class: "tag", text: locked ? `lvl ${s.level}` : on ? "active" : `${s.effectiveness}%` })
      ));
    }
    const slots = supportSlots(hero.level);
    const sups = h("div", { class: "col" });
    const active = hero.supports.slice(0, slots);
    for (const s of Object.values(SUPPORTS)) {
      const locked = s.level > hero.level;
      const on = active.includes(s.id);
      const fits = !s.requires.length || s.requires.some((t) => cur.skill.tags.includes(t));
      let delta = "";
      if (!locked && fits) {
        const next2 = on ? active.filter((x) => x !== s.id) : active.length < slots ? [...active, s.id] : null;
        if (next2) {
          const trial = { ...hero, supports: next2, rev: -1 };
          const sh = deriveTrial(c, trial);
          const d = sh.skill.packDps / Math.max(0.01, cur.skill.packDps) - 1;
          delta = `${d >= 0 ? "+" : ""}${(d * 100).toFixed(0)}% pack DPS`;
        }
      }
      sups.append(h(
        "div",
        { class: `skill${on ? " on" : ""}${locked || !fits ? " locked" : ""}`, on: { click: () => {
          if (locked || !fits) return;
          if (on) c.act((st) => setSupports(st, active.filter((x) => x !== s.id)));
          else if (active.length < slots) c.act((st) => setSupports(st, [...active, s.id]));
          else c.toast("All support slots are full");
        } } },
        h(
          "div",
          { class: "grow" },
          h("div", { class: "nm", text: s.name }),
          h("div", { class: "ds", text: s.blurb }),
          s.requires.length ? h("div", { class: "ds muted", text: `Needs: ${s.requires.join(" or ")}` }) : null
        ),
        h(
          "div",
          { class: "col", style: "align-items:flex-end;gap:2px" },
          h("div", { class: "tag", text: locked ? `lvl ${s.level}` : on ? "slotted" : fits ? "add" : "no fit" }),
          delta ? h("div", { class: delta.startsWith("+") ? "up" : "down", style: "font-size:11px", text: delta }) : null
        )
      ));
    }
    const next = [1, 1, 8, 18, 32].find((l) => l > hero.level);
    return h(
      "div",
      { class: "grid2" },
      h("div", { class: "card" }, h("h3", { text: "Main skill" }), skills),
      h("div", { class: "card" }, h("h3", { text: `Supports ${active.length}/${slots}${next ? ` (next slot at level ${next})` : ""}` }), sups)
    );
  }
  function deriveTrial(_c, hero) {
    return deriveSheet(hero);
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
  function logView(c) {
    const el = h("div", { class: "card log" }, h("h3", { text: "Chronicle" }));
    const kinds = { level: "LVL", loot: "LOOT", death: "DEATH", zone: "ROAD", boss: "BOSS", info: "..." };
    for (const e of [...c.state.log].reverse()) el.append(h("div", null, h("span", { class: "tag", style: "margin-right:6px", text: kinds[e.kind] ?? e.kind }), e.text));
    return el;
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
  var QUICK_KEY = "quicksave";
  var BACKUP_MS = 5 * 6e4;
  var AUTOSAVE_MS = 2e4;
  var REPORT_MIN_MS = 6e4;
  var STOP_EVENTS = ["keydown", "keyup", "keypress", "paste", "copy", "cut", "input"];
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
    hud;
    tabs;
    who;
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
    onUnload = () => {
      if (!this.state) return;
      this.kv.set(QUICK_KEY, wrap(this.state, Date.now()));
      void this.save();
    };
    onResize = () => this.refit();
    get isOpen() {
      return !!this.host;
    }
    async open() {
      if (this.host) {
        this.win.style.display = "";
        this.refit();
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
      this.state = null;
      this.hooks.onClose?.();
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
      const shell = h("div", { class: `hm${this.hooks.theme?.() === "dark" ? " dark" : ""}` });
      this.who = h("span", { class: "who" });
      const bar2 = h(
        "div",
        { class: "bar" },
        h("span", { class: "logo", text: "Hollowmarch" }),
        this.who,
        h("button", { class: "x", text: "x", title: "Close (progress keeps counting while closed)", on: { click: () => void this.close() } })
      );
      this.hud = h("div", { class: "hud" });
      this.tabs = h("div", { class: "tabs" });
      this.body = h("div", { class: "body" });
      const stage = h("div", { class: "stage" }, this.battle.canvas);
      const grip = h("div", { class: "grip" });
      this.win = h("div", { class: "win", attrs: { role: "dialog", "aria-label": "Hollowmarch" } }, bar2, stage, this.hud, this.tabs, this.body, grip);
      shell.append(this.win);
      this.root.append(shell);
      document.body.append(host);
      this.placeWindow(stage);
      this.dragger(bar2, (dx, dy, g) => {
        g.x += dx;
        g.y += dy;
      });
      this.dragger(grip, (dx, dy, g) => {
        g.w += dx;
        g.h += dy;
      });
      this.tabs.setAttribute("role", "tablist");
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
        const n = Number(e.key);
        if (n >= 1 && n <= VIEWS.length && !e.ctrlKey && !e.altKey && !e.metaKey) {
          this.tabs.children[n - 1]?.click();
          e.preventDefault();
        }
      });
      for (const v of VIEWS) {
        this.tabs.append(h("button", { text: v.label, attrs: { "data-v": v.id, role: "tab", "aria-selected": "false", title: `${v.label} (${VIEWS.indexOf(v) + 1})` }, on: { click: () => {
          this.view = v.id;
          this.sig = "";
          if (this.ctx) this.ctx.sel = {};
          this.renderTab(true);
          this.body.scrollTop = 0;
        } } }));
      }
    }
    geo = { x: 80, y: 60, w: 760, h: 620 };
    placeWindow(stage) {
      const g = this.kv.get(GEO_KEY);
      if (g && [g.x, g.y, g.w, g.h].every((v) => typeof v === "number" && Number.isFinite(v))) this.geo = { x: g.x, y: g.y, w: g.w, h: g.h };
      const fit = () => {
        const vw = window.innerWidth, vh = window.innerHeight;
        const g2 = this.geo;
        g2.w = Math.max(360, Math.min(g2.w, vw - 8));
        g2.h = Math.max(320, Math.min(g2.h, vh - 8));
        g2.x = Math.max(0, Math.min(g2.x, vw - g2.w));
        g2.y = Math.max(0, Math.min(g2.y, vh - g2.h));
        Object.assign(this.win.style, { left: g2.x + "px", top: g2.y + "px", width: g2.w + "px", height: g2.h + "px" });
        stage.style.height = Math.round(Math.min(g2.w * H / W, g2.h * 0.36)) + "px";
      };
      fit();
      this.refit = fit;
    }
    refit = () => {
    };
    dragger(handle, apply) {
      handle.addEventListener("pointerdown", (e) => {
        if (e.target.closest("button")) return;
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
      closeModal();
      this.busy = false;
      const report = rep.finish(s);
      if (away >= REPORT_MIN_MS) this.showReport(report);
      await this.save();
    }
    startLoop() {
      this.stopLoop();
      this.makeCtx();
      this.sig = "";
      this.renderTab(true);
      const ev = {
        ...this.battle.events(() => performance.now(), () => this.state),
        story: (text) => this.showStory(text),
        zone: (_from, to, why) => {
          if (why === "unlock") this.toast(`New road: ${ZONES[to]?.name ?? to}`);
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
        this.battle.draw(this.state, runSheet(this.state), performance.now());
        this.drawHud();
        this.renderTab(false);
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
          if (typeof err === "string") this.toast(err);
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
    renderTab(force) {
      if (!this.state || !this.ctx) return;
      if (!force) {
        const t = performance.now();
        if (t - this.lastSigCheck < 250) return;
        this.lastSigCheck = t;
      }
      const sig = this.view + ":" + viewSig(this.view, this.ctx);
      if (!force && sig === this.sig) return;
      this.sig = sig;
      for (const b of this.tabs.querySelectorAll("button")) {
        const on = b.getAttribute("data-v") === this.view;
        b.classList.toggle("on", on);
        b.setAttribute("aria-selected", String(on));
      }
      const top = this.body.scrollTop;
      clear(this.body);
      this.body.append(renderView(this.view, this.ctx));
      this.body.scrollTop = top;
    }
    hudEls = {};
    drawHud() {
      const s = this.state;
      const sh = runSheet(s);
      const run = s.activity.run;
      if (!this.hud.childElementCount) {
        for (const k of ["life", "es", "mana", "flask", "xp", "zone"]) {
          const fill = h("i"), text = h("span");
          this.hud.append(h("div", { class: "meter" }, fill, text));
          this.hudEls[k] = { fill, text };
        }
      }
      const set = (k, f, color, text) => {
        const e = this.hudEls[k];
        e.fill.style.width = (Math.max(0, Math.min(1, f)) * 100).toFixed(1) + "%";
        e.fill.style.background = color;
        if (e.text.textContent !== text) e.text.textContent = text;
      };
      const hh = run?.hero;
      const n = (x) => fmt(Math.floor(Math.max(0, x)));
      set("life", hh ? hh.life / sh.life : 1, "#e5383b", `Life ${n(hh?.life ?? sh.life)} / ${n(sh.life)}`);
      set("es", sh.es ? (hh?.es ?? sh.es) / sh.es : 0, "#7fd1ff", sh.es ? `Shield ${n(hh?.es ?? sh.es)} / ${n(sh.es)}` : "No energy shield");
      set("mana", hh ? hh.mana / sh.mana : 1, "#3a7bff", `Mana ${n(hh?.mana ?? sh.mana)} / ${n(sh.mana)}`);
      set("flask", (hh?.flask ?? 30) / 30, "#3fbf5f", `Flask ${Math.floor(hh?.flask ?? 30)} / 30`);
      const need = xpToNext(s.hero.level);
      set("xp", isFinite(need) ? s.hero.xp / need : 1, "#ffc233", `Level ${s.hero.level}  ${isFinite(need) ? (s.hero.xp / need * 100).toFixed(1) + "%" : "max"}`);
      const z = run ? runZone(s, run) : ZONES[s.activity.zone];
      const packs = run ? run.packs + (run.boss ? 1 : 0) : 1;
      set("zone", run ? run.pack / packs : 0, "#19b3a3", run?.map ? `${z.name} (L${z.level})  ${s.maps.length} maps left` : `${z.name} (L${z.level})  ${s.world.clears[z.id] ?? 0} clears`);
      const free = supportSlots(s.hero.level) > s.hero.supports.filter((id) => SUPPORTS[id] && SUPPORTS[id].level <= s.hero.level).length && Object.values(SUPPORTS).some((x) => x.level <= s.hero.level && !s.hero.supports.includes(x.id));
      const skillsTab = this.tabs.querySelector('[data-v="skills"]');
      if (skillsTab && skillsTab.textContent !== (free ? "Skills !" : "Skills")) skillsTab.textContent = free ? "Skills !" : "Skills";
      const who = `${s.hero.name}, level ${s.hero.level} ${CLASSES[s.hero.cls]?.name ?? ""}  |  ${fmt(sh.skill.packDps)} pack DPS`;
      if (this.who.textContent !== who) this.who.textContent = who;
    }
    toast(msg) {
      const t = h("div", { class: "toast", text: msg });
      this.win.append(t);
      setTimeout(() => t.remove(), 2200);
    }
    modal(content) {
      const m4 = h("div", { class: "modal", attrs: { role: "dialog", "aria-modal": "true" } }, content);
      this.win.append(m4);
      return () => m4.remove();
    }
    showCreation() {
      clear(this.body);
      clear(this.hud);
      this.hudEls = {};
      this.who.textContent = "A new Kindled";
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
