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
      life: 50,
      damage: 1.6,
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
      life: 46,
      damage: 1.1,
      speed: 0.8,
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
      life: 40,
      damage: 1,
      speed: 0.75,
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
      life: 90,
      damage: 1.6,
      speed: 0.8,
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
    },
    // ---- round 3: every slot family, levels 25-76 ----
    {
      id: "pilgrimsknot",
      name: "Pilgrim's Knot",
      base: "belt_chain",
      level: 25,
      weight: 80,
      flavour: "Tied once for every shrine that never answered.",
      mods: [r2("life", "flat", [50, 70], "+{0} to maximum life"), r2("flaskHeal", "inc", [30, 50], "{0}% increased flask healing"), r2("flaskCharges", "inc", [20, 30], "{0}% increased flask charges gained")]
    },
    {
      id: "brineclutch",
      name: "Brineclutch",
      base: "leather_gloves4",
      level: 26,
      weight: 70,
      flavour: "Wet to the wrist. Always.",
      mods: [r2("attackSpeed", "inc", [10, 15], "{0}% increased attack speed"), r2("lifeOnKill", "flat", [8, 15], "{0} life gained on kill"), r2("res.cold", "flat", [20, 30], "+{0}% cold resistance")]
    },
    {
      id: "tidecaller",
      name: "Tidecaller's Loop",
      base: "ring_tide",
      level: 30,
      weight: 70,
      flavour: "Turn it once and the floor is wet.",
      mods: [r2("addMin.cold", "flat", [4, 7], "Adds {0} min cold damage to attacks", ["attack"]), r2("addMax.cold", "flat", [12, 18], "Adds {0} max cold damage to attacks", ["attack"]), r2("res.cold", "flat", [20, 30], "+{0}% cold resistance"), r2("mana", "flat", [30, 40], "+{0} to maximum mana")]
    },
    {
      id: "bellwright",
      name: "The Bellwright's Toll",
      base: "mace5",
      level: 38,
      weight: 60,
      flavour: "Every blow rings. Something always answers.",
      mods: [r2("local.physInc", "inc", [140, 180], "{0}% increased physical damage"), r2("area", "inc", [20, 30], "{0}% increased area of effect"), r2("str", "flat", [20, 30], "+{0} to Might")]
    },
    {
      id: "glassveil",
      name: "Glassveil",
      base: "silk_helmet5",
      level: 38,
      weight: 60,
      flavour: "You see the barrens as the barrens see you: in pieces.",
      mods: [r2("local.defInc", "inc", [100, 140], "{0}% increased energy shield"), r2("castSpeed", "inc", [8, 12], "{0}% increased cast speed"), r2("mana", "flat", [40, 60], "+{0} to maximum mana"), r2("res.lightning", "flat", [20, 30], "+{0}% lightning resistance")]
    },
    {
      id: "hollowcrown",
      name: "The Hollow Crown",
      base: "amulet_ember",
      level: 40,
      weight: 45,
      flavour: "Every king of the March wore it. None of them for long.",
      mods: [r2("str", "flat", [12, 18], "+{0} to Might"), r2("dex", "flat", [12, 18], "+{0} to Grace"), r2("int", "flat", [12, 18], "+{0} to Wit"), r2("res.chaos", "flat", [15, 20], "+{0}% chaos resistance"), r2("itemRarity", "inc", [15, 25], "{0}% increased rarity of items found")]
    },
    {
      id: "lanternheart",
      name: "Lanternheart",
      base: "ring_glass",
      level: 45,
      weight: 50,
      flavour: "It burns from the inside, and so will you.",
      mods: [r2("lifeRegenPct", "flat", [1, 2], "Regenerate {0}% of life per second"), r2("life", "inc", [6, 10], "{0}% increased maximum life"), r2("res.fire", "flat", [-15, -10], "{0}% fire resistance")]
    },
    {
      id: "dunestrider",
      name: "Dunestrider Wraps",
      base: "leather_boots6",
      level: 50,
      weight: 55,
      flavour: "The sand forgets your steps before you finish them.",
      mods: [r2("moveSpeed", "inc", [25, 35], "{0}% increased movement speed"), r2("local.evasion", "flat", [150, 220], "+{0} to evasion"), r2("res.fire", "flat", [25, 35], "+{0}% fire resistance"), r2("dex", "flat", [20, 30], "+{0} to Grace")]
    },
    {
      id: "laststand",
      name: "Warden's Last Stand",
      base: "shield_offhand6",
      level: 50,
      weight: 50,
      flavour: "The gate fell. The shield did not.",
      mods: [r2("local.defInc", "inc", [120, 160], "{0}% increased armour"), r2("block", "flat", [5, 8], "+{0}% chance to block"), r2("life", "flat", [60, 90], "+{0} to maximum life"), r2("res.chaos", "flat", [20, 30], "+{0}% chaos resistance")]
    },
    {
      id: "sunshard",
      name: "Sunshard Quiver",
      base: "quiver6",
      level: 50,
      weight: 55,
      flavour: "Each arrow a splinter of the fallen sun.",
      mods: [r2("addMin.fire", "flat", [8, 12], "Adds {0} min fire damage to attacks", ["attack"]), r2("addMax.fire", "flat", [20, 30], "Adds {0} max fire damage to attacks", ["attack"]), r2("pierce", "flat", [1, 1], "Projectiles pierce {0} more enemy"), r2("critChance", "inc", [20, 30], "{0}% increased critical chance")]
    },
    {
      id: "saltwedding",
      name: "Salt Wedding Band",
      base: "ring_void",
      level: 55,
      weight: 40,
      flavour: "Promised to the sea. The sea keeps its promises.",
      mods: [r2("itemQuantity", "inc", [8, 12], "{0}% increased quantity of items found"), r2("itemRarity", "inc", [20, 30], "{0}% increased rarity of items found"), r2("xpGain", "inc", [5, 8], "{0}% increased experience gained")]
    },
    {
      id: "voidsinger",
      name: "Voidsinger",
      base: "wand7",
      level: 62,
      weight: 35,
      flavour: "It hums the note the world stopped on.",
      mods: [r2("damage", "inc", [70, 100], "{0}% increased spell damage", ["spell"]), r2("critChance", "inc", [30, 50], "{0}% increased spell critical chance", ["spell"]), r2("manaCost", "inc", [20, 30], "{0}% increased mana cost")]
    },
    {
      id: "cinderoath",
      name: "The Cinder Oath",
      base: "staff7",
      level: 62,
      weight: 35,
      flavour: "Sworn in ash. Kept in fire.",
      mods: [r2("addMin.fire", "flat", [20, 30], "Adds {0} min fire damage to spells", ["spell"]), r2("addMax.fire", "flat", [45, 65], "Adds {0} max fire damage to spells", ["spell"]), r2("damage", "inc", [40, 60], "{0}% increased fire damage", ["fire"]), r2("pen.fire", "flat", [10, 15], "Hits ignore {0}% fire resistance"), r2("res.cold", "flat", [-20, -10], "{0}% cold resistance")]
    },
    {
      id: "drownedheart",
      name: "Heart of the Drowned",
      base: "plate_body7",
      level: 62,
      weight: 35,
      flavour: "It stopped beating long ago. It stopped sinking just now.",
      mods: [r2("local.defInc", "inc", [160, 220], "{0}% increased armour"), r2("life", "inc", [8, 12], "{0}% increased maximum life"), r2("maxRes.cold", "flat", [3, 4], "+{0}% maximum cold resistance"), r2("lifeRegen", "flat", [20, 35], "{0} life regenerated per second")]
    },
    {
      id: "worldbreaker",
      name: "Worldbreaker",
      base: "greataxe8",
      level: 74,
      weight: 25,
      flavour: "The March cracked once. This is what cracked it.",
      mods: [r2("local.physInc", "inc", [200, 260], "{0}% increased physical damage"), r2("critMulti", "flat", [40, 60], "+{0}% critical multiplier"), r2("area", "inc", [25, 35], "{0}% increased area of effect"), r2("leech", "flat", [1, 2], "{0}% of damage leeched as life")]
    },
    {
      id: "lastember",
      name: "The Last Ember",
      base: "amulet_ember",
      level: 76,
      weight: 20,
      flavour: "When it goes out, so does the March.",
      mods: [r2("damage", "inc", [25, 35], "{0}% increased damage"), r2("attackSpeed", "inc", [8, 10], "{0}% increased attack speed"), r2("castSpeed", "inc", [8, 10], "{0}% increased cast speed"), r2("life", "inc", [8, 10], "{0}% increased maximum life")]
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

  // src/core/data/companions.ts
  var COMPANION_MAX_LEVEL = 20;
  var bondFor = (level) => 120 * (level - 1) * (level - 1) + 180 * (level - 1);
  var DUPLICATE_BOND = 4e3;
  function companionLevel(bond) {
    let l = 1;
    while (l < COMPANION_MAX_LEVEL && bond >= bondFor(l + 1)) l++;
    return l;
  }
  var list6 = [
    {
      id: "saltcrab",
      name: "Salt Crab",
      blurb: "It found you on the shore and decided you were its rock.",
      where: "Act 1: the Tide-Warden",
      level: 1,
      bonus: { stat: "armour", kind: "inc", per: 2, text: "{0}% increased armour" },
      sprite: "mon.spider",
      tint: "#e0703a",
      strength: 0.5,
      fps: 9
    },
    {
      id: "bogimp",
      name: "Bog Imp",
      blurb: "Steals shiny things. Mostly for you.",
      where: "Bosses from level 10",
      level: 10,
      bonus: { stat: "itemQuantity", kind: "inc", per: 0.5, text: "{0}% increased quantity of items found" },
      sprite: "mon.flyer",
      hover: 8,
      fps: 10,
      scale: 0.5
    },
    {
      id: "lanternwisp",
      name: "Lantern Wisp",
      blurb: "A flame that forgot which lamp it belonged to.",
      where: "Bosses from level 14",
      level: 14,
      bonus: { stat: "itemRarity", kind: "inc", per: 1.5, text: "{0}% increased rarity of items found" },
      sprite: "fx.orb",
      tint: "#ffd84a",
      strength: 0.35,
      hover: 14,
      fps: 10
    },
    {
      id: "dunepup",
      name: "Dune Pup",
      blurb: "Runs ahead, runs back, runs ahead again.",
      where: "Act 2: the Glass Regent",
      level: 20,
      bonus: { stat: "moveSpeed", kind: "inc", per: 1, text: "{0}% increased movement speed" },
      sprite: "mon.wolf",
      tint: "#e0bf7f",
      strength: 0.35,
      fps: 11,
      scale: 0.5
    },
    {
      id: "prismlynx",
      name: "Prism Lynx",
      blurb: "It watches the weak spot until you see it too.",
      where: "Bosses from level 24",
      level: 24,
      bonus: { stat: "critChance", kind: "inc", per: 2, text: "{0}% increased critical chance" },
      sprite: "mon.gato",
      tint: "#9fe3ff",
      strength: 0.45,
      fps: 8,
      scale: 0.5
    },
    {
      id: "drowned",
      name: "Little Drowned",
      blurb: "It does not breathe. It does keep you breathing.",
      where: "Bosses from level 30",
      level: 30,
      bonus: { stat: "life", kind: "inc", per: 0.5, text: "{0}% increased maximum life" },
      sprite: "mon.thing",
      tint: "#5fb3a6",
      strength: 0.3,
      fps: 6,
      scale: 0.5
    },
    {
      id: "ashpup",
      name: "Ash Pup",
      blurb: "Born in the Sunfall. Still warm.",
      where: "Act 3: the Last Dawn",
      level: 40,
      bonus: { stat: "attackSpeed", kind: "inc", per: 0.5, text: "{0}% increased attack speed" },
      sprite: "mon.hound",
      fps: 12,
      scale: 0.5
    },
    {
      id: "cinderskull",
      name: "Cinder Skull",
      blurb: "A head that kept burning after the rest of it stopped.",
      where: "Bosses from level 45",
      level: 45,
      bonus: { stat: "castSpeed", kind: "inc", per: 0.5, text: "{0}% increased cast speed" },
      sprite: "mon.skull",
      hover: 10,
      fps: 10,
      scale: 0.5
    },
    {
      id: "whisperskull",
      name: "Whispering Skull",
      blurb: "It tells you what the dead learned. Some of it is useful.",
      where: "Map bosses",
      level: 50,
      bonus: { stat: "xpGain", kind: "inc", per: 0.5, text: "{0}% increased experience gained" },
      sprite: "mon.skull2",
      tint: "#b9a4ff",
      strength: 0.4,
      hover: 8,
      fps: 8,
      scale: 0.5
    }
  ];
  var COMPANIONS = Object.fromEntries(list6.map((c) => [c.id, c]));
  var COMPANION_ORDER = list6.map((c) => c.id);
  var ACT_COMPANION = { 1: "saltcrab", 2: "dunepup", 3: "ashpup" };
  function companionMod(id, level) {
    const c = COMPANIONS[id];
    if (!c) return null;
    const mod = { stat: c.bonus.stat, kind: c.bonus.kind, value: Math.round(c.bonus.per * level * 10) / 10, src: `Companion: ${c.name}` };
    if (c.bonus.tags) mod.tags = c.bonus.tags;
    return mod;
  }
  var companionText = (id, level) => {
    const m4 = companionMod(id, level);
    return m4 ? COMPANIONS[id].bonus.text.replace("{0}", String(m4.value)) : "";
  };

  // src/core/data/stones.ts
  var STONE_TIERS = ["Chipped", "Flawed", "Clear", "Flawless", "Radiant"];
  var STONE_TIER_LEVEL = [1, 20, 38, 55, 70];
  var e = (mods, values, text) => ({ mods, values, text });
  var DMG = [10, 16, 24, 34, 46];
  var RES = [6, 9, 12, 16, 20];
  var list7 = [
    { id: "ruby", name: "Ruby", color: "#e5383b", effects: {
      weapon: e([{ stat: "damage", kind: "inc", tags: ["fire"] }], DMG, "{0}% increased fire damage"),
      armour: e([{ stat: "res.fire", kind: "flat" }], RES, "+{0}% fire resistance"),
      jewel: e([{ stat: "life", kind: "flat" }], [12, 24, 40, 60, 85], "+{0} to maximum life")
    } },
    { id: "sapphire", name: "Sapphire", color: "#3a7bff", effects: {
      weapon: e([{ stat: "damage", kind: "inc", tags: ["cold"] }], DMG, "{0}% increased cold damage"),
      armour: e([{ stat: "res.cold", kind: "flat" }], RES, "+{0}% cold resistance"),
      jewel: e([{ stat: "manaRegen", kind: "flat" }], [1, 2, 3, 5, 7], "{0} mana regenerated per second")
    } },
    { id: "topaz", name: "Topaz", color: "#e0b800", effects: {
      weapon: e([{ stat: "damage", kind: "inc", tags: ["lightning"] }], DMG, "{0}% increased lightning damage"),
      armour: e([{ stat: "res.lightning", kind: "flat" }], RES, "+{0}% lightning resistance"),
      jewel: e([{ stat: "itemRarity", kind: "inc" }], [4, 7, 10, 14, 18], "{0}% increased rarity of items found")
    } },
    { id: "emerald", name: "Emerald", color: "#2f9e4f", effects: {
      weapon: e([{ stat: "critChance", kind: "inc" }], [8, 13, 19, 26, 34], "{0}% increased critical chance"),
      armour: e([{ stat: "evasion", kind: "inc" }], [6, 10, 15, 21, 28], "{0}% increased evasion"),
      jewel: e([{ stat: "dex", kind: "flat" }], [4, 8, 12, 17, 23], "+{0} to Grace")
    } },
    { id: "onyx", name: "Onyx", color: "#6b5a7a", effects: {
      weapon: e([{ stat: "pen.fire", kind: "flat" }, { stat: "pen.cold", kind: "flat" }, { stat: "pen.lightning", kind: "flat" }], [2, 3, 5, 7, 9], "Hits ignore {0}% elemental resistance"),
      armour: e([{ stat: "res.chaos", kind: "flat" }], [5, 8, 11, 15, 19], "+{0}% chaos resistance"),
      jewel: e([{ stat: "leech", kind: "flat" }], [0.4, 0.6, 0.9, 1.2, 1.6], "{0}% of damage leeched as life")
    } },
    { id: "diamond", name: "Diamond", color: "#dff6ff", effects: {
      weapon: e([{ stat: "attackSpeed", kind: "inc" }, { stat: "castSpeed", kind: "inc" }], [3, 5, 7, 9, 12], "{0}% increased attack and cast speed"),
      armour: e([{ stat: "armour", kind: "inc" }, { stat: "energyShield", kind: "inc" }], [6, 10, 15, 21, 28], "{0}% increased armour and energy shield"),
      jewel: e([{ stat: "res.fire", kind: "flat" }, { stat: "res.cold", kind: "flat" }, { stat: "res.lightning", kind: "flat" }], [3, 4, 6, 8, 10], "+{0}% to all elemental resistances")
    } }
  ];
  var STONES = Object.fromEntries(list7.map((s) => [s.id, s]));
  var STONE_ORDER = list7.map((s) => s.id);
  var stoneKey = (id, tier) => `${id}:${tier}`;
  function parseStone(key) {
    const [id, t] = key.split(":");
    const tier = Number(t);
    return id && STONES[id] && Number.isInteger(tier) && tier >= 0 && tier < STONE_TIERS.length ? { id, tier } : null;
  }
  function stoneMods(key, place, src) {
    const p = parseStone(key);
    if (!p) return [];
    const eff = STONES[p.id].effects[place];
    return eff.mods.map((m4) => {
      const mod = { stat: m4.stat, kind: m4.kind, value: eff.values[p.tier], ...src ? { src } : {} };
      if (m4.tags) mod.tags = m4.tags;
      return mod;
    });
  }

  // src/core/data/echoes.ts
  var list8 = [
    {
      id: "bell",
      who: "The bell keeper",
      text: "Every evening I rang the sun down, and every morning it came back up the hill. The last evening I rang and rang. The rope wore through my hands. I am still ringing. Someone has to be ready when it answers."
    },
    {
      id: "saltchild",
      who: "A child of Saltmire",
      text: "Mother said the tide gives back what it takes. It gave her back on the fourth day. She sat by the fire and didn't feel it. I stopped asking her to come to bed."
    },
    {
      id: "warden",
      who: "The Tide-Warden",
      text: "The order was to hold the gate until the light returned. Nobody said what to do if it didn't. So I held it. The sea was patient. So was I. Only one of us was dead."
    },
    {
      id: "lamplighter",
      who: "A lamplighter",
      text: "I lit the road from the shore to the chapel so the dead could find their way home. In the twelfth year the oil ran out. They still walk it in the dark. They know it by heart now."
    },
    {
      id: "sandwright",
      who: "The Sandwright",
      text: "Glass remembers light. I built towers to hold the last noon, mirror on mirror, so the Barrens would never be dark. They held it for a year. Then the light got bored of us and went looking for the sun."
    },
    {
      id: "regent",
      who: "The Glass Regent",
      text: "The Choir offered a bargain: a song that would keep the glass warm forever. The price was every voice in the Barrens but theirs. I thought it was a fair trade. I was the only one they let keep a mouth, so I could say yes."
    },
    {
      id: "judge",
      who: "The Ember Judge",
      text: "When the embers fell someone had to decide who deserved to wake. I weighed them: the brave, the kind, the useful. The embers did not care for my scales. They woke whoever they landed on. I have been judging the embers ever since."
    },
    {
      id: "matron",
      who: "The Cinder Matron",
      text: "My hounds were pups when the sun came down. They were cold, so I let them sleep in the crater. Now they are made of it. They still come when I whistle. They still bite what comes near the fire."
    },
    {
      id: "drownedsun",
      who: "The Drowned Sun",
      pinnacle: "drownedsun",
      text: "They could not bring the sun back, so the Warden's people made one. They sank the light of a thousand lamps into the sea and pulled up something round and bright and cold. It rose. It did not warm anything. It has been rising ever since, and I am what it rises through."
    },
    {
      id: "glasschoir",
      who: "The Glass Choir",
      pinnacle: "glasschoir",
      text: "We are the last noon, broken into a thousand pieces, each singing the note it heard as the sun fell. Together we are almost the sound of daylight. Almost. Every voice we take gets us closer."
    },
    {
      id: "ashenking",
      who: "The Ashen King",
      pinnacle: "ashenking",
      text: "I was crowned at the moment the sun hit the ground. I swore to rule until it rose again, and I have kept every oath I ever made. Do you understand what you are asking, Kindled? To end my reign you must keep my promise for me."
    },
    {
      id: "hollowcrown",
      who: "The Hollow Crown",
      pinnacle: "hollowcrown",
      text: "Before the March had kings it had me: a crown waiting for a head. The sun sat on my brow for a thousand years and I was full. Then I was hungry. I ate the light because it was there, as the tide takes the shore. You carry a spark of it in your chest. I can smell it."
    }
  ];
  var ECHOES = Object.fromEntries(list8.map((e2) => [e2.id, e2]));
  var ECHO_ORDER = list8.map((e2) => e2.id);
  var MAP_ECHOES = list8.filter((e2) => !e2.pinnacle).map((e2) => e2.id);
  var ECHOES_PER_POINT = 3;

  // src/core/data/dawn.ts
  var DAWN_PERKS = [
    { id: "firstlight", name: "First Light", text: "20% increased experience gained", mods: [{ stat: "xpGain", kind: "inc", value: 20 }] },
    { id: "brightember", name: "Bright Ember", text: "15% increased damage", mods: [{ stat: "damage", kind: "inc", value: 15 }] },
    { id: "steadyflame", name: "Steady Flame", text: "10% increased maximum life", mods: [{ stat: "life", kind: "inc", value: 10 }] },
    { id: "keeneye", name: "Keen Eye", text: "30% increased rarity of items found", mods: [{ stat: "itemRarity", kind: "inc", value: 30 }] },
    { id: "oldroads", name: "Old Roads", text: "25% increased movement speed", mods: [{ stat: "moveSpeed", kind: "inc", value: 25 }] },
    { id: "warmhands", name: "Warm Hands", text: "25% more ember dust from salvage" },
    { id: "longmemory", name: "Long Memory", text: "Companions gain twice the bond" },
    { id: "deeppockets", name: "Deep Pockets", text: "20 more stash slots, and room for 20 more" },
    { id: "stonefinder", name: "Stonefinder", text: "Ember stones drop 50% more often" },
    { id: "tradersmark", name: "Trader's Mark", text: "The Wandering Market charges 20% less" }
  ];
  var DAWN_PERK = Object.fromEntries(DAWN_PERKS.map((p) => [p.id, p]));
  var DAWN_XP = 10;
  var DAWN_DUST = 10;
  var DAWN_TOUGHER = 15;
  var DAWN_RICHER = 20;
  var ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  var dawnName = (n) => `Dawn ${ROMAN[n] ?? n}`;

  // src/core/stats.ts
  var StatBag = class _StatBag {
    by = /* @__PURE__ */ new Map();
    constructor(mods = []) {
      for (const m4 of mods) this.add(m4);
    }
    add(m4) {
      let list9 = this.by.get(m4.stat);
      if (!list9) this.by.set(m4.stat, list9 = []);
      list9.push(m4);
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
    if (item.stones) {
      const place = placeOf(item);
      for (const k of item.stones) if (k) out.push(...stoneMods(k, place, src));
    }
    return out;
  }
  function placeOf(item) {
    const b = baseOf(item);
    if (b.slot === "ring" || b.slot === "amulet" || b.slot === "belt") return "jewel";
    if (b.slot === "weapon" || b.kind === "quiver" || b.kind === "focus") return "weapon";
    return "armour";
  }
  function itemStats(item) {
    const b = baseOf(item);
    const mods = rawMods(item);
    const local = (stat) => mods.filter((m4) => m4.stat === stat).reduce((s, m4) => s + m4.value, 0);
    const out = { global: mods.filter((m4) => !m4.stat.startsWith("local.")) };
    if (b.weapon) {
      const inc = 1 + (local("local.physInc") + (item.quality ?? 0)) / 100;
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
      const inc = 1 + (local("local.defInc") + (item.quality ?? 0)) / 100;
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
  function dawnMods(hero) {
    const d = hero.dawn;
    if (!d?.level) return [];
    const out = [{ stat: "xpGain", kind: "inc", value: DAWN_XP * d.level, src: dawnName(d.level) }];
    for (const id of d.perks) for (const m4 of DAWN_PERK[id]?.mods ?? []) out.push({ ...m4, src: DAWN_PERK[id].name });
    return out;
  }
  function petMods(hero) {
    const m4 = hero.pet ? companionMod(hero.pet.id, hero.pet.level) : null;
    return m4 ? [m4] : [];
  }
  function heroMods(hero, extra = []) {
    const cls = CLASSES[hero.cls];
    if (!cls) throw new Error("unknown class " + hero.cls);
    const mods = [...extra, ...passiveMods(hero), ...petMods(hero), ...dawnMods(hero)];
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

  // src/core/sockets.ts
  function socketCap(item) {
    const b = baseOf(item);
    if (placeOf(item) === "jewel") return 1;
    if (b.slot === "body" || b.weapon?.hands === 2) return 3;
    return 2;
  }
  function fitStones(item) {
    const n = item.sockets ?? 0;
    if (!n) {
      delete item.sockets;
      delete item.stones;
      return;
    }
    const s = (item.stones ?? []).slice(0, n);
    while (s.length < n) s.push(null);
    item.stones = s;
  }
  function rollSockets(rng, item) {
    const r3 = rng.next();
    const n = Math.min(socketCap(item), r3 < 0.55 ? 0 : r3 < 0.88 ? 1 : 2);
    if (n) {
      item.sockets = n;
      fitStones(item);
    }
  }
  function returnStones(state, item) {
    for (const k of item.stones ?? []) if (k) addStone(state, k, 1);
    if (item.stones) item.stones = item.stones.map(() => null);
  }
  function addStone(state, key, n) {
    state.stones ??= {};
    const v = (state.stones[key] ?? 0) + n;
    if (v > 0) state.stones[key] = v;
    else delete state.stones[key];
  }
  function rollStone(rng, level) {
    let tier = 0;
    while (tier + 1 < STONE_TIERS.length - 1 && STONE_TIER_LEVEL[tier + 1] <= level) tier++;
    if (tier > 0 && rng.chance(0.3)) tier--;
    return stoneKey(rng.pick(STONE_ORDER), tier);
  }
  function findItem(state, uid) {
    const s = state.stash.find((x) => x.uid === uid) ?? state.relics.find((x) => x.uid === uid);
    if (s) return { item: s };
    for (const slot of SLOTS) {
      const it = state.hero.equipment[slot];
      if (it?.uid === uid) return { item: it, slot };
    }
    return null;
  }
  function setStone(state, uid, i, key) {
    const f = findItem(state, uid);
    if (!f) return "item not found";
    const it = f.item;
    if (!it.sockets || i < 0 || i >= it.sockets) return "no such socket";
    fitStones(it);
    if (key !== null) {
      if (!parseStone(key)) return "unknown stone";
      if ((state.stones?.[key] ?? 0) <= 0) return "none in the pouch";
      addStone(state, key, -1);
    }
    const old = it.stones[i];
    if (old) addStone(state, old, 1);
    it.stones[i] = key;
    if (f.slot) state.hero.rev++;
    return null;
  }
  function autoSetStones(state) {
    if (!state.stones || !Object.keys(state.stones).length) return 0;
    let n = 0;
    for (const slot of SLOTS) {
      const it = state.hero.equipment[slot];
      if (!it?.sockets) continue;
      fitStones(it);
      for (let i = 0; i < it.sockets; i++) {
        const cur = it.stones[i];
        const curP = cur ? parseStone(cur) : null;
        const keys = Object.keys(state.stones).filter((k) => (state.stones[k] ?? 0) > 0 && (!curP || parseStone(k)?.id === curP.id && parseStone(k).tier > curP.tier));
        if (!keys.length) continue;
        let best = null, bestScore = buildScore(sheetOf(state));
        for (const k of keys) {
          const hero = structuredClone(state.hero);
          hero.equipment[slot].stones[i] = k;
          const sc = buildScore(deriveSheet(hero));
          if (sc > bestScore * 1.001 || curP && !best) {
            best = k;
            bestScore = Math.max(bestScore, sc);
          }
        }
        if (best) {
          setStone(state, it.uid, i, best);
          n++;
        }
      }
    }
    return n;
  }

  // src/core/echoes.ts
  function grantEcho(s, id) {
    if (!ECHOES[id]) return false;
    s.echoes ??= [];
    if (s.echoes.includes(id)) return false;
    s.echoes.push(id);
    const earned = Math.floor(s.echoes.length / ECHOES_PER_POINT);
    s.world.rewards ??= [];
    for (let k = 1; k <= earned; k++) {
      const key = `echo:${k}`;
      if (!s.world.rewards.includes(key)) {
        s.world.rewards.push(key);
        s.atlas.points++;
      }
    }
    return true;
  }
  function rollMapEcho(s, rng) {
    const unfound = MAP_ECHOES.filter((id2) => !(s.echoes ?? []).includes(id2));
    if (!unfound.length || !rng.chance(0.03)) return null;
    const id = rng.pick(unfound);
    grantEcho(s, id);
    return id;
  }
  function pinnacleEcho(s, pinnacle) {
    const e2 = Object.values(ECHOES).find((x) => x.pinnacle === pinnacle);
    return e2 && grantEcho(s, e2.id) ? e2.id : null;
  }

  // src/core/dawn.ts
  var dawnOf = (s) => s.hero.dawn?.level ?? 0;
  var hasPerk = (s, id) => !!s.hero.dawn?.perks.includes(id);
  var wrapped = /* @__PURE__ */ new WeakMap();
  function dawnEffects(s, key, base) {
    const d = dawnOf(s);
    if (!d) return base;
    const c = wrapped.get(key);
    if (c && c.dawn === d && c.base === base) return c.eff;
    const b = base ?? { life: 1, damage: 1, speed: 1, extra: [], hero: [], quantity: 0, rarity: 0 };
    const eff = {
      ...b,
      life: b.life * (1 + DAWN_TOUGHER * d / 100),
      damage: b.damage * (1 + DAWN_TOUGHER * d / 100),
      quantity: b.quantity + DAWN_RICHER * d,
      rarity: b.rarity + DAWN_RICHER * d
    };
    wrapped.set(key, { dawn: d, base, eff });
    return eff;
  }

  // src/core/filter.ts
  var DEFAULT_FILTER = [
    { on: true, action: "keep", rarity: ["relic"] },
    { on: true, action: "salvage", rarity: ["plain", "enchanted"], behind: 10 },
    { on: false, action: "keep", rarity: ["rare"], minAffixes: 5 }
  ];
  var FILTER_PRESETS = [
    { id: "starter", name: "Starter", blurb: "Keep relics; salvage plain and enchanted items 10+ levels behind.", rules: DEFAULT_FILTER },
    { id: "lean", name: "Lean", blurb: "Keep relics and rares; salvage every plain and enchanted item.", rules: [
      { on: true, action: "keep", rarity: ["relic"] },
      { on: true, action: "salvage", rarity: ["plain", "enchanted"] }
    ] },
    { id: "endgame", name: "Endgame", blurb: "Only rares with 5+ affixes and relics; everything else becomes dust.", rules: [
      { on: true, action: "keep", rarity: ["relic"] },
      { on: true, action: "keep", rarity: ["rare"], minAffixes: 5 },
      { on: true, action: "salvage", rarity: ["plain", "enchanted", "rare"] }
    ] },
    { id: "resists", name: "Resist hunter", blurb: "Endgame, but also keep any rare jewellery with a resistance.", rules: [
      { on: true, action: "keep", rarity: ["relic"] },
      { on: true, action: "keep", rarity: ["rare"], slots: ["ring", "amulet", "belt"], group: "resFire" },
      { on: true, action: "keep", rarity: ["rare"], slots: ["ring", "amulet", "belt"], group: "resCold" },
      { on: true, action: "keep", rarity: ["rare"], slots: ["ring", "amulet", "belt"], group: "resLight" },
      { on: true, action: "keep", rarity: ["rare"], minAffixes: 5 },
      { on: true, action: "salvage", rarity: ["plain", "enchanted", "rare"] }
    ] }
  ];
  var GROUP_NAMES = {
    aspd: "attack speed (weapon)",
    aspdGlobal: "attack speed",
    crit: "critical chance (weapon)",
    critGlobal: "critical chance",
    physInc: "physical damage (weapon)",
    physGlobal: "physical damage",
    defFlat: "armour, evasion or shield (local)",
    armourFlat: "armour (belt)",
    spellAdd: "added damage to spells",
    fireAdd: "added fire damage (weapon)",
    coldAdd: "added cold damage (weapon)",
    lightAdd: "added lightning damage (weapon)",
    physAdd: "added physical damage (weapon)",
    defInc: "defences",
    leech: "life leech"
  };
  function groupLabel(group) {
    if (GROUP_NAMES[group]) return GROUP_NAMES[group];
    const a = Object.values(AFFIXES).find((x) => x.group === group);
    if (!a) return group;
    return a.text.replace(/\{\d\}/g, "").replace(/^Adds\s+to\s+/i, "added ").replace(/[+%]/g, "").replace(/\s+/g, " ").trim().replace(/^(to|increased)\s+/i, "").replace(/^maximum\s+/i, "maximum ");
  }
  var AFFIX_GROUPS = () => [...new Set(Object.values(AFFIXES).map((a) => a.group))].map((group) => ({ group, label: groupLabel(group) })).sort((a, b) => a.label.localeCompare(b.label));
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
    if (r3.group) parts.push(`with ${groupLabel(r3.group)}`);
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
      settings: { keep: "rare", autoEquip: true, filter: structuredClone(DEFAULT_FILTER), upkeep: true, autoStones: true },
      relics: [],
      codex: {},
      contracts: { list: [], seq: 0, done: 0 },
      companions: {},
      blessings: {},
      shrine: { keep: [], orbs: true },
      stones: {},
      market: { seq: 0, rolledAt: 0, refreshes: 0, pedlar: [], jeweller: [] },
      echoes: [],
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
  function displacedItems(state, item, slot) {
    const eq = state.hero.equipment;
    const out = [];
    if (eq[slot]) out.push(eq[slot]);
    if (dropsOffhand(state, item, slot)) out.push(eq.offhand);
    return out;
  }
  function stashWorth(item, heroLevel = Infinity) {
    const far = Math.max(0, levelReq(item) - heroLevel - 2);
    return (item.ilvl + baseOf(item).level) / 2 + 12 * RARITY_RANK[item.rarity] + 2 * item.affixes.length + (item.quality ?? 0) - 3 * far;
  }
  var guarded = (x) => !!x.locked;
  var upgradeMemo = /* @__PURE__ */ new WeakMap();
  function isUpgrade(state, item) {
    let m4 = upgradeMemo.get(state.hero);
    if (!m4 || m4.rev !== state.hero.rev || m4.level !== state.hero.level) {
      m4 = { rev: state.hero.rev, level: state.hero.level, map: /* @__PURE__ */ new Map() };
      upgradeMemo.set(state.hero, m4);
    }
    let v = m4.map.get(item.uid);
    if (v === void 0) {
      v = upgradeSlot(state, item) !== null;
      m4.map.set(item.uid, v);
    }
    return v;
  }
  function upkeepVictims(state, n, below = Infinity) {
    const L = state.hero.level;
    const pool = state.stash.filter((x) => !guarded(x) && stashWorth(x, L) < below).sort((a, b) => stashWorth(a, L) - stashWorth(b, L) || a.uid - b.uid);
    const out = [];
    for (const x of pool) {
      if (out.length >= n) break;
      if (!isUpgrade(state, x)) out.push(x);
    }
    return out.length >= n ? out : [];
  }
  function takeOut(state, x) {
    let i = state.stash.indexOf(x);
    if (i >= 0) {
      state.stash.splice(i, 1);
      return;
    }
    i = state.relics.indexOf(x);
    if (i >= 0) state.relics.splice(i, 1);
  }
  function giveUp(state, x) {
    takeOut(state, x);
    salvageItem(state, x);
    state.totals.swapped = (state.totals.swapped ?? 0) + 1;
  }
  function relicRollScore(item) {
    const def2 = item.relic ? RELICS[item.relic] : void 0;
    if (!def2) return 0;
    let sum = 0, n = 0;
    def2.mods.forEach((m4, i) => {
      const [lo, hi] = m4.range;
      if (hi === lo) return;
      sum += ((item.relicRolls?.[i] ?? lo) - lo) / (hi - lo);
      n++;
    });
    return n ? sum / n : 1;
  }
  function caseLoser(state, item) {
    const old = state.relics.find((x) => x.relic === item.relic);
    if (!old) return null;
    return relicRollScore(item) > relicRollScore(old) ? old : item;
  }
  function toCase(state, item) {
    const loser = caseLoser(state, item);
    if (loser === item) return item;
    if (loser) state.relics.splice(state.relics.indexOf(loser), 1);
    state.relics.push(item);
    return loser;
  }
  function leftOver(state, x) {
    if (x.locked && state.stash.length < state.stashCap) state.stash.push(x);
    else salvageItem(state, x);
  }
  function equipWithRoom(state, item, slot) {
    const off = displacedItems(state, item, slot);
    const keep = off.flatMap((o) => {
      if (!o.relic) return o.locked ? [o] : [];
      const l = caseLoser(state, o);
      return l?.locked ? [l] : [];
    });
    const need = keep.length - (state.stashCap - state.stash.length);
    const victims = need > 0 ? upkeepVictims(state, need) : [];
    if (need > 0 && victims.length < need) return false;
    putOn(state, item, slot);
    for (const v of victims) giveUp(state, v);
    for (const o of off) {
      if (o.relic) {
        const l = toCase(state, o);
        if (l) leftOver(state, l);
      } else if (o.locked) state.stash.push(o);
      else stashOrSalvage(state, o);
    }
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
  function ownedItem(state, uid) {
    return state.stash.find((x) => x.uid === uid) ?? state.relics.find((x) => x.uid === uid);
  }
  function equip(state, uid, slot) {
    const item = ownedItem(state, uid);
    if (!item) return "not in stash";
    const target = slot ?? bestSlot(state, item);
    const err = canEquip(state, item, target);
    if (err) return err;
    const fromStash = state.stash.includes(item);
    takeOut(state, item);
    const off = displacedItems(state, item, target);
    const toStash = off.filter((o) => !o.relic || caseLoser(state, o)).length;
    if (state.stash.length + toStash > state.stashCap) {
      (fromStash ? state.stash : state.relics).push(item);
      return "stash full";
    }
    for (const o of putOn(state, item, target)) {
      const l = o.relic ? toCase(state, o) : o;
      if (l) state.stash.push(l);
    }
    return null;
  }
  function unequip(state, slot) {
    const it = state.hero.equipment[slot];
    if (!it) return null;
    if ((!it.relic || caseLoser(state, it)) && state.stash.length >= state.stashCap) return "stash full";
    delete state.hero.equipment[slot];
    const l = it.relic ? toCase(state, it) : it;
    if (l) state.stash.push(l);
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
    if (item.relic) state.codex[item.relic] = (state.codex[item.relic] ?? 0) + 1;
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
      if (item.relic) {
        const loser = caseLoser(state, item);
        if (loser !== item && !(loser?.locked && state.stash.length >= state.stashCap)) {
          toCase(state, item);
          if (loser) leftOver(state, loser);
          return true;
        }
      } else {
        if (state.stash.length < state.stashCap) {
          state.stash.push(item);
          return true;
        }
        const v = state.settings.upkeep ? upkeepVictims(state, 1)[0] : void 0;
        if (v && stashWorth(v, state.hero.level) < stashWorth(item, state.hero.level)) {
          giveUp(state, v);
          state.stash.push(item);
          state.stashFull = false;
          return true;
        }
        if (!v && !state.stashFull) {
          state.stashFull = true;
          pushLog(state, "loot", "Stash full: items the filter keeps are being salvaged.");
        }
      }
    }
    salvageItem(state, item);
    return false;
  }
  function salvageItem(state, item) {
    returnStones(state, item);
    const d = dawnOf(state);
    const v = Math.round(salvageValue(item) * (1 + DAWN_DUST * d / 100) * (hasPerk(state, "warmhands") ? 1.25 : 1));
    state.dust += v;
    state.totals.salvaged++;
    state.totals.dust += v;
  }
  function salvage(state, uids) {
    let n = 0;
    for (const uid of uids) {
      const it = ownedItem(state, uid);
      if (!it || it.locked) continue;
      takeOut(state, it);
      salvageItem(state, it);
      n++;
    }
    if (n) state.stashFull = false;
    return n;
  }
  function setLocked(state, uid, on) {
    const it = ownedItem(state, uid) ?? SLOTS.map((s) => state.hero.equipment[s]).find((x) => x?.uid === uid);
    if (!it) return "item not found";
    if (on) it.locked = true;
    else delete it.locked;
    return null;
  }
  function outdatedItems(state) {
    return state.stash.filter((x) => !guarded(x) && baseOf(x).level <= state.hero.level - 10 && !isUpgrade(state, x));
  }
  function equipUpgrades(state, only) {
    let n = 0;
    for (let round = 0; round < SLOTS.length; round++) {
      const now = buildScore(sheetOf(state));
      let best = null;
      for (const item of [...state.stash, ...state.relics]) {
        if (only && !only(item)) continue;
        for (const slot of slotsFor(baseOf(item))) {
          const sheet = trialSheet(state, item, slot);
          if (!sheet) continue;
          const score = buildScore(sheet);
          if (score > now * 1.02 && (!best || score > best.score)) best = { item, slot, score };
        }
      }
      if (!best) break;
      const home = state.stash.includes(best.item) ? state.stash : state.relics;
      takeOut(state, best.item);
      if (!equipWithRoom(state, best.item, best.slot)) {
        home.push(best.item);
        break;
      }
      pushLog(state, "loot", `Equipped ${itemLabel(best.item)} from the ${home === state.stash ? "stash" : "relic case"}.`);
      n++;
    }
    return n;
  }
  var STASH_BASE = 60;
  var STASH_STEP = 10;
  var STASH_MAX = 150;
  function stashRoomCost(state) {
    const extra = hasPerk(state, "deeppockets") ? 20 : 0;
    if (state.stashCap >= STASH_MAX + extra) return null;
    const bought = Math.max(0, Math.round((state.stashCap - STASH_BASE - extra) / STASH_STEP));
    return Math.round(250 * Math.pow(2.2, bought) / 10) * 10;
  }
  function buyStashRoom(state) {
    const cost = stashRoomCost(state);
    if (cost === null) return "the stash is as big as it gets";
    if (state.dust < cost) return `needs ${cost} ember dust`;
    state.dust -= cost;
    state.stashCap = Math.min(STASH_MAX + (hasPerk(state, "deeppockets") ? 20 : 0), state.stashCap + STASH_STEP);
    state.stashFull = false;
    return null;
  }
  var codexRarity = (state) => Object.keys(state.codex ?? {}).length;
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
    const e2 = emptyAtlas();
    for (const id of state.atlas?.nodes ?? []) {
      const n = ATLAS[id];
      if (!n) continue;
      for (const [k, v] of Object.entries(n.eff)) e2[k] += v ?? 0;
    }
    return e2;
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
      const tier = want > 0 ? Math.min(pick.tier, want) : pick.tier;
      return { tier, area: pick.area, mods: [...pick.mods], level: mapLevel(tier) };
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
    const e2 = { life: depth, damage: depth, speed: 1, extra: [], hero: [], quantity: atlas.quantity, rarity: atlas.rarity };
    const reward = 1 + atlas.modEffect / 100;
    for (const id of m4.mods) {
      const d = MAP_MODS[id];
      if (!d) continue;
      if (d.life) e2.life *= 1 + d.life / 100;
      if (d.damage) e2.damage *= 1 + d.damage / 100;
      if (d.speed) e2.speed *= 1 + d.speed / 100;
      if (d.extra) e2.extra.push(d.extra);
      if (d.hero) e2.hero.push(...d.hero.map((x) => ({ ...x, src: "Map" })));
      e2.quantity += d.qty * reward;
      e2.rarity += d.rarity * reward;
    }
    if (m4.tier > MAX_TIER) {
      e2.quantity += (m4.tier - MAX_TIER) * 3;
      e2.rarity += (m4.tier - MAX_TIER) * 4;
    }
    effCache.set(m4, e2);
    return e2;
  }
  function completeMap(state, m4) {
    if (m4.pinnacle) {
      const first = !state.pinnacleKills[m4.pinnacle];
      state.pinnacleKills[m4.pinnacle] = (state.pinnacleKills[m4.pinnacle] ?? 0) + 1;
      if (first) {
        state.atlas.points += 2;
        pushLog(state, "boss", `${PINNACLES[m4.pinnacle].name} is defeated: +2 atlas points.`);
      }
      pinnacleEcho(state, m4.pinnacle);
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
  function findItem2(state, uid) {
    const s = state.stash.find((x) => x.uid === uid) ?? state.relics.find((x) => x.uid === uid);
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
    const found = findItem2(state, uid);
    if (!found) return "item not found";
    const copy2 = structuredClone(found.item);
    const rng = new Rng(hashSeed(state.seed, 25458, state.craftSeq));
    const err = eff(copy2, rng);
    if (err) return err;
    state.craftSeq++;
    copy2.crafted = true;
    copy2.locked = true;
    Object.assign(found.item, copy2);
    if (!copy2.name) delete found.item.name;
    state.currency[currency]--;
    if (found.slot) state.hero.rev++;
    return null;
  }
  var REROLLS = ["reshaper", "tempest", "temper"];
  function craftUntilUpgrade(state, currency, uid, tries = 20) {
    if (!REROLLS.includes(currency)) return { err: "only rerolls repeat", used: 0, upgrade: false };
    if (!state.stash.some((x) => x.uid === uid) && !state.relics.some((x) => x.uid === uid)) return { err: "only stash items", used: 0, upgrade: false };
    let used = 0;
    for (; used < tries; ) {
      const err = applyCurrency(state, currency, uid);
      if (err) return { err: used ? null : err, used, upgrade: false };
      used++;
      const it = findItem2(state, uid).item;
      if (upgradeSlot(state, it)) return { err: null, used, upgrade: true };
    }
    return { err: null, used, upgrade: false };
  }
  var MAX_QUALITY = 20;
  function honeCost(item) {
    const b = baseOf(item);
    if (!b.weapon && !b.defence) return null;
    const q = item.quality ?? 0;
    if (q >= MAX_QUALITY) return null;
    return Math.round((20 + item.ilvl * 2) * (1 + q * 0.5));
  }
  function hone(state, uid) {
    const found = findItem2(state, uid);
    if (!found) return "item not found";
    const b = baseOf(found.item);
    if (!b.weapon && !b.defence) return "only weapons and armour take quality";
    const cost = honeCost(found.item);
    if (cost === null) return `already at ${MAX_QUALITY}% quality`;
    if (state.dust < cost) return `needs ${cost} ember dust`;
    state.dust -= cost;
    found.item.quality = (found.item.quality ?? 0) + 1;
    found.item.locked = true;
    if (found.slot) state.hero.rev++;
    return null;
  }
  var BENCH_GRAFTS = 3;
  var benchDust = (item) => 10 + item.ilvl * 3;
  function benchOptions(item) {
    if (item.rarity !== "enchanted" && item.rarity !== "rare") return [];
    const copy2 = structuredClone(item);
    copy2.affixes = copy2.affixes.filter((a) => !a.bench);
    return eligibleAffixes(copy2);
  }
  function benchCraft(state, uid, affixId) {
    const found = findItem2(state, uid);
    if (!found) return "item not found";
    const item = found.item;
    if (item.rarity !== "enchanted" && item.rarity !== "rare") return "needs an enchanted or rare item";
    const def2 = AFFIXES[affixId];
    if (!def2 || !benchOptions(item).some((a) => a.id === affixId)) return "that affix doesn't fit";
    if ((state.currency.graft ?? 0) < BENCH_GRAFTS) return `needs ${BENCH_GRAFTS} Graft`;
    const dust = benchDust(item);
    if (state.dust < dust) return `needs ${dust} ember dust`;
    const rng = new Rng(hashSeed(state.seed, 1650814563, state.craftSeq));
    const roll = rollTier(rng, def2, item.ilvl);
    item.affixes = [...item.affixes.filter((a) => !a.bench), { ...roll, bench: true }];
    state.currency.graft -= BENCH_GRAFTS;
    state.dust -= dust;
    state.craftSeq++;
    item.crafted = true;
    item.locked = true;
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
  function forgeUntilUpgrade(state, slot, tries = 10) {
    const slots = slot === "ring1" || slot === "ring2" ? ["ring"] : [slot];
    let made = 0;
    for (; made < tries; ) {
      const cost = forgeCost(state);
      if (state.dust < cost) return { err: made ? null : `needs ${cost} ember dust`, made };
      const rng = new Rng(hashSeed(state.seed, 1718579815, state.craftSeq));
      let item;
      try {
        item = rollItem(rng, state.nextUid, maxIlvl(state), { rarity: "rare", slots, maxBaseLevel: state.hero.level });
      } catch {
        return { err: "nothing to forge for that slot", made };
      }
      item.crafted = true;
      state.nextUid++;
      state.craftSeq++;
      state.dust -= cost;
      made++;
      if (upgradeSlot(state, item)) {
        const r3 = receiveItem(state, item);
        if (r3.equipped) return { err: null, made, item };
      }
      const v = salvageValue(item);
      state.dust += v;
      state.totals.salvaged++;
    }
    return { err: null, made };
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

  // src/core/companions.ts
  function grantCompanion(state, id) {
    const def2 = COMPANIONS[id];
    if (!def2) return false;
    state.companions ??= {};
    const owned = state.companions[id] !== void 0;
    if (!owned) {
      state.companions[id] = 0;
      pushLog(state, "loot", `A ${def2.name} joins you.`);
      if (!state.hero.pet) setCompanion(state, id);
      return true;
    }
    addBond(state, id, DUPLICATE_BOND);
    pushLog(state, "loot", `Another ${def2.name}: your ${def2.name} grows closer.`);
    return false;
  }
  function setCompanion(state, id) {
    if (id === null) {
      if (state.hero.pet) {
        delete state.hero.pet;
        state.hero.rev++;
      }
      return null;
    }
    if (!COMPANIONS[id]) return "unknown companion";
    if (state.companions?.[id] === void 0) return "not found yet";
    state.hero.pet = { id, level: companionLevel(state.companions[id]) };
    state.hero.rev++;
    return null;
  }
  function addBond(state, id, n) {
    const bond = (state.companions[id] ?? 0) + n;
    state.companions[id] = bond;
    const pet = state.hero.pet;
    if (!pet || pet.id !== id || pet.level >= COMPANION_MAX_LEVEL || bond < bondFor(pet.level + 1)) return false;
    pet.level = companionLevel(bond);
    state.hero.rev++;
    pushLog(state, "level", `${COMPANIONS[id].name} reached level ${pet.level}.`);
    return true;
  }
  function petKill(state) {
    const pet = state.hero.pet;
    return pet ? addBond(state, pet.id, hasPerk(state, "longmemory") ? 2 : 1) : false;
  }
  function rollCompanionDrop(state, rng, level, chance) {
    if (!rng.chance(chance)) return null;
    const pool = COMPANION_ORDER.filter((id2) => COMPANIONS[id2].level <= level);
    if (!pool.length) return null;
    const unfound = pool.filter((id2) => state.companions?.[id2] === void 0);
    const id = unfound.length && rng.chance(0.7) ? rng.pick(unfound) : rng.pick(pool);
    grantCompanion(state, id);
    return id;
  }
  var missingCompanions = (state, level) => COMPANION_ORDER.filter((id) => COMPANIONS[id].level <= level && state.companions?.[id] === void 0);

  // src/core/contracts.ts
  var BOARD_SIZE = 3;
  var KIND_TEXT = {
    kills: (c) => `Slay ${c.target} monsters`,
    champions: (c) => `Slay ${c.target} champions`,
    bosses: (c) => `Defeat ${c.target} bosses`,
    runs: (c) => `Clear ${c.target} runs on the road`,
    maps: (c) => `Complete ${c.target} maps of tier ${c.tier ?? 1} or deeper`,
    rares: (c) => `Find ${c.target} rare items`
  };
  var contractText = (c) => KIND_TEXT[c.kind](c);
  var contractDust = (s, c) => Math.max(c.dust, Math.round((60 + 25 * s.hero.level) * 0.9));
  function rewardText(c, s) {
    const parts = [`${s ? contractDust(s, c) : c.dust} dust`];
    if (c.currency) parts.push(`${c.currency[1]} ${CURRENCIES[c.currency[0]]?.name ?? c.currency[0]}`);
    if (c.extra === "relic") parts.push("a relic not in your codex");
    if (c.extra === "companion") parts.push("a companion you haven't met");
    if (c.extra === "maps") parts.push("3 maps");
    if (c.extra === "sigil") parts.push("a sigil");
    return parts.join(", ");
  }
  var deepest = (s) => Math.max(1, ...s.atlas?.tiers ?? []);
  function missingRelics(s) {
    const ilvl = maxIlvl(s);
    return Object.values(RELICS).filter((r3) => r3.level <= ilvl && !s.codex[r3.id]).map((r3) => r3.id);
  }
  function rollContract(s, rng) {
    const L = s.hero.level;
    const endgame = endgameOpen(s);
    const taken = new Set(s.contracts.list.map((c2) => c2.kind));
    const kinds = ["kills", "champions", "bosses", endgame ? "maps" : "runs", "rares"].filter((k) => !taken.has(k));
    const kind = rng.pick(kinds.length ? kinds : ["kills"]);
    const SIZE = { kills: 1800, champions: 80, bosses: 24, runs: 36, maps: 40, rares: 12 + Math.round(L * 0.9) };
    const size = SIZE[kind];
    const target = Math.max(3, Math.round(size * (0.8 + rng.next() * 0.4)));
    const c = { kind, target, n: 0, dust: Math.round((60 + 25 * L) * (0.9 + rng.next() * 0.3)) };
    if (kind === "maps") c.tier = Math.max(1, Math.min(MAX_TIER, deepest(s) - 2));
    const cur = rng.weighted(CURRENCY_ORDER, (id) => 1 / Math.sqrt(CURRENCIES[id].drop));
    const rare = CURRENCIES[cur].drop < 200;
    c.currency = [cur, rare ? 1 + Math.floor(rng.next() * 3) : 3 + Math.floor(rng.next() * 6)];
    const r3 = rng.next();
    if (r3 < 0.3 && missingRelics(s).length) c.extra = "relic";
    else if (r3 < 0.4 && missingCompanions(s, maxIlvl(s)).length) c.extra = "companion";
    else if (r3 < 0.5 && endgame) c.extra = rng.chance(0.5) && deepest(s) >= 6 ? "sigil" : "maps";
    return c;
  }
  function ensureContracts(s) {
    s.contracts ??= { list: [], seq: 0, done: 0 };
    while (s.contracts.list.length < BOARD_SIZE) {
      const rng = new Rng(hashSeed(s.seed, 1668247156, s.contracts.seq++));
      s.contracts.list.push(rollContract(s, rng));
    }
  }
  function contractEvent(s, kind, tier = 0) {
    const b = s.contracts;
    if (!b) return;
    for (const c of b.list) {
      if (c.kind !== kind || c.n >= c.target) continue;
      if (kind === "maps" && tier < (c.tier ?? 1)) continue;
      c.n++;
      if (c.n >= c.target) pushLog(s, "info", `Contract done: ${contractText(c)}. Claim it on the World tab.`);
    }
  }
  var claimable = (s) => s.contracts?.list.filter((c) => c.n >= c.target).length ?? 0;
  function claimContract(s, i) {
    const c = s.contracts?.list[i];
    if (!c) return "no such contract";
    if (c.n < c.target) return "not finished yet";
    const rng = new Rng(hashSeed(s.seed, 1668047209, s.contracts.done));
    const dust = contractDust(s, c);
    s.dust += dust;
    if (c.currency) s.currency[c.currency[0]] = (s.currency[c.currency[0]] ?? 0) + c.currency[1];
    if (c.extra === "relic") {
      const pool = missingRelics(s);
      const id = pool.length ? rng.pick(pool) : null;
      const def2 = id ? RELICS[id] : void 0;
      if (def2) {
        const item = { uid: s.nextUid++, base: def2.base, ilvl: Math.max(def2.level, maxIlvl(s)), rarity: "relic", affixes: [], relic: def2.id, relicRolls: def2.mods.map((m4) => rng.int(m4.range[0], m4.range[1])) };
        receiveItem(s, item);
        pushLog(s, "loot", `Contract reward: ${def2.name}.`);
      } else s.dust += dust;
    }
    if (c.extra === "companion") {
      const pool = missingCompanions(s, maxIlvl(s));
      if (pool.length) grantCompanion(s, rng.pick(pool));
      else s.dust += dust;
    }
    if (c.extra === "maps") for (let k = 0; k < 3; k++) addMap(s, rollMap(rng, s.nextUid++, Math.min(MAX_TIER, deepest(s))));
    if (c.extra === "sigil") {
      const open = Object.values(PINNACLES).filter((p2) => deepest(s) >= p2.minTier);
      const p = open.length ? rng.pick(open) : void 0;
      if (p) s.sigils[p.sigil] = (s.sigils[p.sigil] ?? 0) + 1;
      else s.dust += dust;
    }
    s.contracts.list.splice(i, 1);
    s.contracts.done++;
    ensureContracts(s);
    s.contracts.list.splice(i, 0, s.contracts.list.pop());
    return null;
  }
  var rerollCost = (s) => 20 + 10 * s.hero.level;
  function rerollContract(s, i) {
    const c = s.contracts?.list[i];
    if (!c) return "no such contract";
    if (c.n >= c.target) return "claim it instead";
    const cost = rerollCost(s);
    if (s.dust < cost) return `needs ${cost} ember dust`;
    s.dust -= cost;
    s.contracts.list.splice(i, 1);
    ensureContracts(s);
    s.contracts.list.splice(i, 0, s.contracts.list.pop());
    return null;
  }
  function cleanContracts(s) {
    const raw = s.contracts;
    const b = raw && typeof raw === "object" ? raw : { list: [], seq: 0, done: 0 };
    const kinds = Object.keys(KIND_TEXT);
    const ok = (v, min = 0) => typeof v === "number" && Number.isFinite(v) && v >= min;
    b.list = (Array.isArray(b.list) ? b.list : []).filter((c) => c && kinds.includes(c.kind) && ok(c.target, 1) && ok(c.n) && ok(c.dust)).slice(0, BOARD_SIZE).map((c) => {
      const out = { kind: c.kind, target: Math.round(c.target), n: Math.min(Math.round(c.n), Math.round(c.target)), dust: Math.round(c.dust) };
      if (c.kind === "maps") out.tier = ok(c.tier, 1) ? Math.round(c.tier) : 1;
      if (Array.isArray(c.currency) && CURRENCIES[c.currency[0]] && ok(c.currency[1], 1)) out.currency = [c.currency[0], Math.round(c.currency[1])];
      if (c.extra === "relic" || c.extra === "companion" || c.extra === "maps" || c.extra === "sigil") out.extra = c.extra;
      return out;
    });
    b.seq = ok(b.seq) ? Math.round(b.seq) : 0;
    b.done = ok(b.done) ? Math.round(b.done) : 0;
    s.contracts = b;
    ensureContracts(s);
  }

  // src/core/shrine.ts
  var BLESSINGS = [
    { id: "insight", name: "Insight", text: "{0}% more experience", value: 20 },
    { id: "fortune", name: "Fortune", text: "{0}% increased item rarity", value: 40 },
    { id: "plenty", name: "Plenty", text: "{0}% increased item quantity", value: 15 },
    { id: "hoard", name: "Hoard", text: "{0}% more currency found", value: 30 }
  ];
  var BLESSING = Object.fromEntries(BLESSINGS.map((b) => [b.id, b]));
  var BLESSING_MS = 36e5;
  var ORB_RESERVE = 50;
  var blessingCost = (s) => Math.round((100 + 25 * Math.pow(s.hero.level, 1.3)) / 10) * 10;
  function blessing(s, id) {
    const until = s.blessings?.[id] ?? 0;
    return until > s.simTo ? BLESSING[id]?.value ?? 0 : 0;
  }
  function spareOrbValue(s) {
    let v = 0;
    for (const id of CURRENCY_ORDER) v += Math.max(0, (s.currency[id] ?? 0) - ORB_RESERVE) * CURRENCIES[id].cost;
    return v;
  }
  function pay(s, cost, orbs) {
    if ((orbs ? spareOrbValue(s) : 0) + s.dust < cost) return false;
    let left = cost;
    if (orbs) {
      const kinds = CURRENCY_ORDER.filter((id) => (s.currency[id] ?? 0) > ORB_RESERVE).sort((a, b) => (s.currency[b] ?? 0) - (s.currency[a] ?? 0));
      for (const id of kinds) {
        const price = CURRENCIES[id].cost;
        const n = Math.min((s.currency[id] ?? 0) - ORB_RESERVE, Math.ceil(left / price));
        if (n <= 0) continue;
        s.currency[id] -= n;
        left -= n * price;
        if (left <= 0) break;
      }
    }
    if (left > 0) s.dust -= left;
    return true;
  }
  function bless(s, id, orbs = s.shrine?.orbs ?? true) {
    if (!BLESSING[id]) return "unknown blessing";
    const cost = blessingCost(s);
    if (!pay(s, cost, orbs)) return `needs ${cost} ember dust${orbs ? " (or spare orbs)" : ""}`;
    s.blessings ??= {};
    s.blessings[id] = Math.max(s.simTo, s.blessings[id] ?? 0) + BLESSING_MS;
    return null;
  }
  function tickShrine(s) {
    const keep = s.shrine?.keep;
    if (!keep?.length) return;
    for (const id of keep) if ((s.blessings?.[id] ?? 0) <= s.simTo) bless(s, id);
  }
  function setKeep(s, id, on) {
    s.shrine ??= { keep: [], orbs: true };
    s.shrine.keep = on ? [.../* @__PURE__ */ new Set([...s.shrine.keep, id])] : s.shrine.keep.filter((x) => x !== id);
  }

  // src/core/market.ts
  var ROTATION_MS = 2 * 36e5;
  var GEAR_OFFERS = 6;
  var STONE_OFFERS = 5;
  var STONE_PRICE = [120, 450, 1500, 4500, 12e3];
  var marketOpen = (s) => !!s.world.clears.a1_lock;
  var OFFER_SLOTS = ["weapon", "offhand", "helmet", "body", "gloves", "boots", "belt", "amulet", "ring"];
  var discount = (s) => hasPerk(s, "tradersmark") ? 0.8 : 1;
  function gearPrice(s, it) {
    const base = forgeCost(s) * discount(s);
    if (it.relic) return Math.round(base * 50 / 10) * 10;
    return Math.round(base * (3 + 1.5 * it.affixes.length) * (1 + 0.25 * (it.sockets ?? 0)) / 10) * 10;
  }
  function weakSlots(s) {
    const eq = s.hero.equipment;
    return [...SLOTS].sort((a, b) => (eq[a] ? stashWorth(eq[a]) : -1) - (eq[b] ? stashWorth(eq[b]) : -1)).map((slot) => slot === "ring1" || slot === "ring2" ? "ring" : slot);
  }
  function rollStock(s) {
    const m4 = s.market;
    const rng = new Rng(hashSeed(s.seed, 7170932, m4.seq++));
    const ilvl = maxIlvl(s);
    const weak = weakSlots(s);
    const pedlar = [];
    for (let i = 0; i < GEAR_OFFERS; i++) {
      const group = i < 2 ? weak[i] : rng.pick(OFFER_SLOTS);
      let item;
      try {
        item = rollItem(rng, s.nextUid, ilvl, { rarity: "rare", slots: [group], maxBaseLevel: s.hero.level });
      } catch {
        continue;
      }
      s.nextUid++;
      if (i === GEAR_OFFERS - 1) {
        item.sockets = Math.min(socketCap(item), rng.chance(0.4) ? 2 : 1);
        fitStones(item);
      } else rollSockets(rng, item);
      pedlar.push({ item, price: gearPrice(s, item) });
    }
    const missing = Object.values(RELICS).filter((r3) => r3.level <= ilvl && !s.codex[r3.id]);
    if (missing.length && rng.chance(0.25) && pedlar.length) {
      const def2 = rng.pick(missing);
      const item = { uid: s.nextUid++, base: def2.base, ilvl, rarity: "relic", affixes: [], relic: def2.id, relicRolls: def2.mods.map((x) => rng.int(x.range[0], x.range[1])) };
      pedlar[pedlar.length - 2] = { item, price: gearPrice(s, item) };
    }
    const jeweller = [];
    for (let i = 0; i < STONE_OFFERS; i++) {
      const key = rollStone(rng, ilvl);
      jeweller.push({ key, price: Math.round(STONE_PRICE[parseStone(key).tier] * discount(s)) });
    }
    m4.pedlar = pedlar;
    m4.jeweller = jeweller;
  }
  function tickMarket(s) {
    if (!marketOpen(s)) return;
    s.market ??= { seq: 0, rolledAt: 0, refreshes: 0, pedlar: [], jeweller: [] };
    if (s.market.pedlar.length && s.simTo < s.market.rolledAt + ROTATION_MS) return;
    s.market.rolledAt = s.simTo;
    s.market.refreshes = 0;
    rollStock(s);
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
  var MAP_FAILS = 2;
  var MAP_CLEAN = 8;
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
  var effectsOf = (state, run) => dawnEffects(state, run, run.map ? mapEffects(run.map, atlasEffects(state)) : null);
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
    if ((state.contracts?.list.length ?? 0) < BOARD_SIZE) ensureContracts(state);
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
    let changed0 = false;
    const eff = effectsOf(state, run);
    const xp = Math.round(monsterXp(m4.level) * d.xp * (m4.champion ? 3 : 1) * xpPenalty(hero.level, m4.level) * sheet.xpGain * (1 + (atlas?.xp ?? 0) / 100) * (1 + blessing(state, "insight") / 100));
    run.kills++;
    run.xp += xp;
    state.totals.kills++;
    run.hero.flask = Math.min(FLASK_MAX, run.hero.flask + (d.boss ? 5 : 1) * sheet.flaskCharges);
    run.hero.life = Math.min(sheet.life, run.hero.life + sheet.lifeOnKill);
    ev.kill?.(m4, xp);
    if (petKill(state)) changed0 = true;
    contractEvent(state, "kills");
    if (m4.champion) contractEvent(state, "champions");
    if (d.boss) contractEvent(state, "bosses");
    let changed = gainXp(state, xp, ev) || changed0;
    const qty = 1 + (sheet.quantity + (eff?.quantity ?? 0) + blessing(state, "plenty")) / 100;
    let drops = 0;
    if (d.boss) drops = 2 + (rng.chance(0.5 * qty) ? 1 : 0);
    else if (rng.chance((m4.champion ? 0.4 : 0.07) * qty)) drops = 1;
    for (let k = 0; k < drops; k++) {
      const bonus = sheet.rarity + codexRarity(state) + blessing(state, "fortune") + (eff?.rarity ?? 0) + (m4.champion ? 100 : 0) + (d.boss ? 250 : 0);
      const opts = d.boss && k === 0 ? { rarity: "rare" } : { rarityBonus: bonus };
      const pin = run.map?.pinnacle && d.boss;
      const relicChance = pin && k === 0 ? 1 : (d.boss ? 0.04 + (atlas?.bossRelic ?? 0) / 100 : m4.champion ? 0.01 : 3e-3) * (1 + bonus / 200);
      const item = rng.chance(relicChance) && rollRelic(rng, state.nextUid, m4.level) || rollItem(rng, state.nextUid, m4.level, opts);
      state.nextUid++;
      if (item.rarity === "rare") {
        contractEvent(state, "rares");
        rollSockets(rng, item);
      }
      const r3 = receiveItem(state, item);
      if (r3.equipped) changed = true;
      ev.loot?.(item, r3.kept, r3.equipped);
    }
    const cRolls = run.map?.pinnacle && d.boss ? 12 : d.boss ? 3 : 1;
    const cChance = (d.boss ? 0.6 : m4.champion ? 0.12 : 0.02) * qty * (1 + (atlas?.currency ?? 0) / 100) * (1 + blessing(state, "hoard") / 100);
    for (let k = 0; k < cRolls; k++) {
      if (!rng.chance(cChance)) continue;
      const cur = rng.weighted(CURRENCY_ORDER, (id) => CURRENCIES[id].drop);
      state.currency[cur] = (state.currency[cur] ?? 0) + 1;
      ev.currency?.(cur);
    }
    if (rng.chance((d.boss ? 0.03 : m4.champion ? 4e-3 : 4e-4) * qty * (hasPerk(state, "stonefinder") ? 1.5 : 1))) {
      const key = rollStone(rng, m4.level);
      addStone(state, key, 1);
      ev.stone?.(key);
      if (state.settings.autoStones && autoSetStones(state)) changed = true;
    }
    endgameDrops(state, run, m4, rng, ev);
    if (d.boss) {
      const had = { ...state.companions };
      const pet = rollCompanionDrop(state, rng, m4.level, run.map?.pinnacle ? 0.15 : run.map ? 4e-3 : 3e-3);
      if (pet) {
        ev.companion?.(pet, had[pet] === void 0);
        changed = true;
      }
      pushLog(state, "boss", `${d.name} falls.`);
    }
    return changed ? runSheet(state) : sheet;
  }
  function endgameDrops(state, run, m4, rng, ev = {}) {
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
    if (inMap && d.boss) {
      const echo = rollMapEcho(state, rng);
      if (echo) ev.echo?.(echo);
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
      if (state.activity.capBackoff) state.activity.capBackoff = 0;
      pushLog(state, "level", `Reached level ${hero.level}.`);
      ev.level?.(hero.level);
    }
    if (hero.level >= MAX_LEVEL) hero.xp = 0;
    if (up && state.settings.autoEquip) equipUpgrades(state);
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
      if (act.autoPush && act.deaths >= MAP_FAILS && run.map.tier > 1 && !run.map.pinnacle) {
        act.autoCap = Math.min(act.autoCap || Infinity, run.map.tier - 1);
        act.deaths = 0;
        act.capBackoff = Math.min(3, (act.capBackoff ?? 0) + 1);
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
      const petKey = `pet:act${a.id}`, pet = ACT_COMPANION[a.id];
      if (pet && cleared(a.zones[a.zones.length - 1]) && !w2.rewards.includes(petKey)) {
        w2.rewards.push(petKey);
        state.companions ??= {};
        const isNew = state.companions[pet] === void 0;
        grantCompanion(state, pet);
        ev.companion?.(pet, isNew);
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
    for (const id of Object.keys(state.pinnacleKills ?? {})) if ((state.pinnacleKills[id] ?? 0) > 0) pinnacleEcho(state, id);
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
    tickShrine(state);
    tickMarket(state);
    if (state.settings.autoStones && autoSetStones(state)) {
    }
    const run = act.run;
    state.totals.runs++;
    if (run.map) {
      completeMap(state, run.map);
      if (!run.map.pinnacle) contractEvent(state, "maps", run.map.tier);
      act.streak++;
      if (act.streak >= MAP_CLEAN) act.deaths = 0;
      if (act.autoCap && act.streak >= MAP_CLEAN << (act.capBackoff ?? 0)) {
        act.autoCap++;
        act.streak = 0;
        if (act.autoCap > Math.max(0, ...state.maps.map((m4) => m4.tier))) act.autoCap = 0;
        else pushLog(state, "zone", `Pushing deeper: ${tierName(act.autoCap)} and below.`);
      }
      ev.runDone?.(run.zone);
      act.runIndex++;
      act.run = newRun(state, sheetOf(state));
      return;
    }
    contractEvent(state, "runs");
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
      swapped: state.totals.swapped ?? 0,
      newRelics: [],
      newCompanions: [],
      dust: state.dust,
      equipped: [],
      best: [],
      zones: [],
      story: []
    };
    const seen = new Set(Object.keys(state.codex ?? {}));
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
        if (item.relic && !seen.has(item.relic)) {
          seen.add(item.relic);
          report.newRelics.push(itemLabel(item));
        }
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
      },
      companion: (id, isNew) => {
        if (isNew) report.newCompanions.push(COMPANIONS[id]?.name ?? id);
      }
    };
    return {
      report,
      events,
      finish(s) {
        report.to = s.simTo;
        report.levelTo = s.hero.level;
        report.dust = s.dust - report.dust;
        report.swapped = (s.totals.swapped ?? 0) - report.swapped;
        return report;
      }
    };
  }

  // src/core/save.ts
  var SAVE_VERSION = 7;
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
    },
    // v5 (round 3): stash upkeep, item locks, the relic codex (seeded with the relics owned) and
    // the relic case: stash relics move there; validateState keeps the best copy of each and
    // puts the rest back in the stash.
    4: (s) => {
      s.settings.upkeep ??= true;
      s.stashFull = false;
      s.codex ??= {};
      const owned = [...s.stash ?? [], ...Object.values(s.hero?.equipment ?? {})];
      for (const it of owned) if (it?.relic && !s.codex[it.relic]) s.codex[it.relic] = 1;
      s.relics ??= [];
      if (Array.isArray(s.stash)) {
        s.relics.push(...s.stash.filter((it) => it?.rarity === "relic"));
        s.stash = s.stash.filter((it) => it?.rarity !== "relic");
      }
      return s;
    },
    // v6 (round 4): companions (act companions are granted by reconcileRewards on load), the shrine.
    5: (s) => {
      s.companions ??= {};
      s.blessings ??= {};
      s.shrine ??= { keep: [], orbs: true };
      return s;
    },
    // v7 (round 5): the stone pouch, auto-set, the Wandering Market (rolled on first use), echoes
    // (pinnacles already beaten give theirs through reconcileRewards on load).
    6: (s) => {
      s.stones ??= {};
      s.settings.autoStones ??= true;
      s.market ??= { seq: 0, rolledAt: 0, refreshes: 0, pedlar: [], jeweller: [] };
      s.echoes ??= [];
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
    if (i.locked !== true) delete i.locked;
    if (i.sockets !== void 0 || i.stones !== void 0) {
      const n = Number.isInteger(i.sockets) ? Math.max(0, Math.min(socketCap(i), i.sockets)) : 0;
      i.sockets = n;
      i.stones = Array.isArray(i.stones) ? i.stones.map((k) => typeof k === "string" && parseStone(k) ? k : null) : [];
      fitStones(i);
    }
    if (i.quality !== void 0) {
      const q = Number.isFinite(i.quality) ? Math.max(0, Math.min(20, Math.round(i.quality))) : 0;
      if (q) i.quality = q;
      else delete i.quality;
    }
    let benched = false;
    for (const a of i.affixes) {
      if (a.bench !== true) {
        delete a.bench;
        continue;
      }
      if (benched) delete a.bench;
      benched = true;
    }
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
    if (hero.dawn) {
      const lvl = Number.isInteger(hero.dawn.level) && hero.dawn.level > 0 ? Math.min(99, hero.dawn.level) : 0;
      if (!lvl) delete hero.dawn;
      else hero.dawn = { level: lvl, perks: [...new Set(strs(hero.dawn.perks, (id) => !!DAWN_PERK[id]) ?? [])].slice(0, lvl) };
    }
    hero.passives = cleanPassives(hero);
    obj(hero.equipment, "equipment");
    for (const k of Object.keys(hero.equipment)) {
      if (!SLOTS.includes(k)) throw new SaveError(`bad slot ${k}`);
      checkItem(hero.equipment[k]);
    }
    if (!Array.isArray(s.stash)) throw new SaveError("bad stash");
    s.stash.forEach(checkItem);
    const inCase = Array.isArray(s.relics) ? s.relics : [];
    inCase.forEach(checkItem);
    s.relics = [];
    for (const it of inCase) {
      if (it.rarity !== "relic") {
        s.stash.push(it);
        continue;
      }
      const old = s.relics.find((x) => x.relic === it.relic);
      if (!old) s.relics.push(it);
      else if (relicRollScore(it) > relicRollScore(old)) {
        s.relics[s.relics.indexOf(old)] = it;
        s.stash.push(old);
      } else s.stash.push(it);
    }
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
    set.upkeep = set.upkeep !== false;
    set.autoStones = set.autoStones !== false;
    if (act.mode !== "map" || !endgameOpen(s)) act.mode = "zone";
    if (!endgameOpen(s)) delete act.pinnacle;
    act.autoCap = Number.isInteger(act.autoCap) && act.autoCap > 0 ? act.autoCap : 0;
    act.capBackoff = Number.isInteger(act.capBackoff) ? Math.max(0, Math.min(3, act.capBackoff)) : 0;
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
    s.companions = Object.fromEntries(Object.entries(counts(s.companions)).filter(([k]) => COMPANIONS[k]).map(([k, v]) => [k, Math.floor(v)]));
    if (hero.pet && (!hero.pet.id || s.companions[hero.pet.id] === void 0)) delete hero.pet;
    else if (hero.pet) hero.pet = { id: hero.pet.id, level: companionLevel(s.companions[hero.pet.id]) };
    s.echoes = [...new Set(strs(s.echoes, (id) => !!ECHOES[id]) ?? [])];
    s.stones = Object.fromEntries(Object.entries(counts(s.stones)).filter(([k, v]) => parseStone(k) && v >= 1).map(([k, v]) => [k, Math.floor(v)]));
    const mk = s.market && typeof s.market === "object" ? s.market : {};
    const okGear = (o) => {
      try {
        const x = o;
        checkItem(x.item);
        return Number.isFinite(x.price) && x.price > 0;
      } catch {
        return false;
      }
    };
    s.market = {
      seq: Number.isInteger(mk.seq) && mk.seq >= 0 ? mk.seq : 0,
      rolledAt: Number.isFinite(mk.rolledAt) ? mk.rolledAt : 0,
      refreshes: Number.isInteger(mk.refreshes) && mk.refreshes >= 0 ? mk.refreshes : 0,
      pedlar: Array.isArray(mk.pedlar) && mk.pedlar.every(okGear) ? mk.pedlar.map((o) => ({ item: o.item, price: o.price, ...o.sold ? { sold: true } : {} })) : [],
      jeweller: Array.isArray(mk.jeweller) && mk.jeweller.every((o) => o && parseStone(o.key) && Number.isFinite(o.price)) ? mk.jeweller.map((o) => ({ key: o.key, price: o.price, ...o.sold ? { sold: true } : {} })) : []
    };
    s.blessings = Object.fromEntries(Object.entries(counts(s.blessings)).filter(([k]) => BLESSING[k]));
    const shr = s.shrine && typeof s.shrine === "object" ? s.shrine : { keep: [], orbs: true };
    s.shrine = { keep: [...new Set(strs(shr.keep, (k) => !!BLESSING[k]) ?? [])], orbs: shr.orbs !== false };
    s.codex = Object.fromEntries(Object.entries(counts(s.codex)).filter(([k, v]) => RELICS[k] && v >= 1).map(([k, v]) => [k, Math.round(v)]));
    s.totals = s.totals && typeof s.totals === "object" ? { ...newTotals(), ...s.totals } : newTotals();
    s.craftSeq = Number.isFinite(s.craftSeq) ? s.craftSeq : 0;
    s.log = Array.isArray(s.log) ? s.log.slice(-60) : [];
    reconcileRewards(s);
    cleanContracts(s);
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
            let e2 = i;
            while (e2 < row.length && row[e2] === "#") e2++;
            g.fillRect(x + i + ox, 1 + y + oy, e2 - i, 1);
            i = e2;
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
    "bg.castle.0": { "x": 0, "y": 1081, "w": 480, "h": 152, "n": 1, "ax": 240, "ay": 152, "f": 0 },
    "bg.cemetery.0": { "x": 209, "y": 0, "w": 384, "h": 224, "n": 1, "ax": 192, "ay": 224, "f": 0 },
    "bg.cemetery.1": { "x": 0, "y": 257, "w": 192, "h": 179, "n": 1, "ax": 96, "ay": 179, "f": 0 },
    "bg.cemetery.2": { "x": 0, "y": 1385, "w": 384, "h": 123, "n": 1, "ax": 192, "ay": 123, "f": 0 },
    "bg.desert.0": { "x": 481, "y": 1081, "w": 320, "h": 150, "n": 1, "ax": 160, "ay": 150, "f": 0 },
    "bg.desert.1": { "x": 0, "y": 1234, "w": 320, "h": 150, "n": 1, "ax": 160, "ay": 150, "f": 0 },
    "bg.desert.2": { "x": 321, "y": 1234, "w": 320, "h": 150, "n": 1, "ax": 160, "ay": 150, "f": 0 },
    "bg.desert.3": { "x": 642, "y": 1234, "w": 320, "h": 150, "n": 1, "ax": 160, "ay": 150, "f": 0 },
    "bg.dusk.0": { "x": 193, "y": 257, "w": 272, "h": 160, "n": 1, "ax": 136, "ay": 160, "f": 0 },
    "bg.dusk.1": { "x": 466, "y": 257, "w": 272, "h": 160, "n": 1, "ax": 136, "ay": 160, "f": 0 },
    "bg.dusk.2": { "x": 0, "y": 437, "w": 544, "h": 160, "n": 1, "ax": 272, "ay": 160, "f": 0 },
    "bg.dusk.3": { "x": 0, "y": 598, "w": 544, "h": 160, "n": 1, "ax": 272, "ay": 160, "f": 0 },
    "bg.dusk.4": { "x": 0, "y": 759, "w": 544, "h": 160, "n": 1, "ax": 286, "ay": 160, "f": 0 },
    "bg.forest.0": { "x": 545, "y": 759, "w": 272, "h": 160, "n": 1, "ax": 136, "ay": 160, "f": 0 },
    "bg.forest.1": { "x": 0, "y": 920, "w": 272, "h": 160, "n": 1, "ax": 136, "ay": 160, "f": 0 },
    "bg.forest.2": { "x": 273, "y": 920, "w": 272, "h": 160, "n": 1, "ax": 136, "ay": 160, "f": 0 },
    "bg.swamp.0": { "x": 0, "y": 0, "w": 208, "h": 256, "n": 1, "ax": 104, "ay": 256, "f": 0 },
    "bg.swamp.1": { "x": 594, "y": 0, "w": 288, "h": 208, "n": 1, "ax": 175, "ay": 208, "f": 0 },
    "boss.angel": { "x": 0, "y": 1509, "w": 98, "h": 115, "n": 8, "ax": 49, "ay": 108, "f": 1 },
    "boss.angel.attack": { "x": 412, "y": 1625, "w": 84, "h": 78, "n": 3, "ax": 43, "ay": 77, "f": 1 },
    "boss.beast": { "x": 662, "y": 1786, "w": 49, "h": 56, "n": 6, "ax": 27, "ay": 55, "f": 1 },
    "boss.demon": { "x": 0, "y": 1786, "w": 80, "h": 64, "n": 6, "ax": 30, "ay": 63, "f": 1 },
    "boss.knight": { "x": 180, "y": 2061, "w": 60, "h": 47, "n": 4, "ax": 30, "ay": 46, "f": 1 },
    "boss.knight.attack": { "x": 0, "y": 2110, "w": 74, "h": 45, "n": 5, "ax": 19, "ay": 44, "f": 1 },
    "boss.nightmare": { "x": 0, "y": 1625, "w": 102, "h": 91, "n": 4, "ax": 43, "ay": 90, "f": 1 },
    "cur.crownseal": { "x": 352, "y": 2243, "w": 34, "h": 34, "n": 1, "ax": 16, "ay": 33, "f": 0 },
    "cur.forgeheart": { "x": 387, "y": 2243, "w": 34, "h": 34, "n": 1, "ax": 19, "ay": 29, "f": 0 },
    "cur.graft": { "x": 422, "y": 2243, "w": 34, "h": 34, "n": 1, "ax": 19, "ay": 29, "f": 0 },
    "cur.kindling": { "x": 457, "y": 2243, "w": 34, "h": 34, "n": 1, "ax": 18, "ay": 28, "f": 0 },
    "cur.reshaper": { "x": 492, "y": 2243, "w": 34, "h": 34, "n": 1, "ax": 19, "ay": 29, "f": 0 },
    "cur.salt": { "x": 527, "y": 2243, "w": 34, "h": 34, "n": 1, "ax": 12, "ay": 32, "f": 0 },
    "cur.starfall": { "x": 562, "y": 2243, "w": 34, "h": 34, "n": 1, "ax": 19, "ay": 29, "f": 0 },
    "cur.temper": { "x": 597, "y": 2243, "w": 34, "h": 34, "n": 1, "ax": 16, "ay": 30, "f": 0 },
    "cur.tempest": { "x": 632, "y": 2243, "w": 34, "h": 34, "n": 1, "ax": 19, "ay": 30, "f": 0 },
    "cur.unmaker": { "x": 667, "y": 2243, "w": 34, "h": 34, "n": 1, "ax": 16, "ay": 30, "f": 0 },
    "fx.blast": { "x": 384, "y": 1907, "w": 41, "h": 51, "n": 6, "ax": 19, "ay": 49, "f": 0 },
    "fx.death": { "x": 0, "y": 1717, "w": 77, "h": 68, "n": 9, "ax": 40, "ay": 67, "f": 0 },
    "fx.fireball": { "x": 576, "y": 2387, "w": 25, "h": 25, "n": 3, "ax": 13, "ay": 24, "f": 0 },
    "fx.orb": { "x": 0, "y": 2416, "w": 18, "h": 11, "n": 3, "ax": 7, "ay": 10, "f": 0 },
    "hero.arcanist.attack": { "x": 0, "y": 2156, "w": 72, "h": 44, "n": 6, "ax": 17, "ay": 43, "f": 0 },
    "hero.arcanist.hurt": { "x": 628, "y": 2156, "w": 39, "h": 43, "n": 2, "ax": 23, "ay": 42, "f": 0 },
    "hero.arcanist.idle": { "x": 704, "y": 2061, "w": 25, "h": 46, "n": 4, "ax": 13, "ay": 45, "f": 0 },
    "hero.arcanist.run": { "x": 0, "y": 2061, "w": 29, "h": 48, "n": 6, "ax": 12, "ay": 47, "f": 0 },
    "hero.strider.attack": { "x": 798, "y": 1960, "w": 45, "h": 49, "n": 3, "ax": 11, "ay": 48, "f": 0 },
    "hero.strider.hurt": { "x": 670, "y": 1851, "w": 46, "h": 52, "n": 2, "ax": 22, "ay": 51, "f": 0 },
    "hero.strider.idle": { "x": 0, "y": 2011, "w": 33, "h": 49, "n": 6, "ax": 11, "ay": 48, "f": 0 },
    "hero.strider.run": { "x": 0, "y": 1960, "w": 56, "h": 50, "n": 14, "ax": 29, "ay": 41, "f": 0 },
    "hero.vanguard.attack": { "x": 0, "y": 2201, "w": 83, "h": 41, "n": 6, "ax": 31, "ay": 40, "f": 0 },
    "hero.vanguard.hurt": { "x": 504, "y": 2201, "w": 37, "h": 41, "n": 3, "ax": 18, "ay": 40, "f": 0 },
    "hero.vanguard.idle": { "x": 708, "y": 2156, "w": 31, "h": 43, "n": 4, "ax": 12, "ay": 42, "f": 0 },
    "hero.vanguard.run": { "x": 375, "y": 2110, "w": 51, "h": 45, "n": 12, "ax": 43, "ay": 43, "f": 0 },
    "ico.amulet.0": { "x": 702, "y": 2243, "w": 34, "h": 34, "n": 1, "ax": 17, "ay": 32, "f": 0 },
    "ico.amulet.1": { "x": 737, "y": 2243, "w": 34, "h": 34, "n": 1, "ax": 20, "ay": 33, "f": 0 },
    "ico.amulet.2": { "x": 772, "y": 2243, "w": 34, "h": 34, "n": 1, "ax": 17, "ay": 32, "f": 0 },
    "ico.amulet.3": { "x": 807, "y": 2243, "w": 34, "h": 34, "n": 1, "ax": 21, "ay": 32, "f": 0 },
    "ico.axe.0": { "x": 842, "y": 2243, "w": 34, "h": 34, "n": 1, "ax": 14, "ay": 25, "f": 0 },
    "ico.axe.1": { "x": 877, "y": 2243, "w": 34, "h": 34, "n": 1, "ax": 6, "ay": 27, "f": 0 },
    "ico.axe.2": { "x": 912, "y": 2243, "w": 34, "h": 34, "n": 1, "ax": 5, "ay": 30, "f": 0 },
    "ico.axe.3": { "x": 947, "y": 2243, "w": 34, "h": 34, "n": 1, "ax": 6, "ay": 27, "f": 0 },
    "ico.body.brigand.0": { "x": 982, "y": 2243, "w": 34, "h": 34, "n": 1, "ax": 17, "ay": 32, "f": 0 },
    "ico.body.brigand.1": { "x": 0, "y": 2282, "w": 34, "h": 34, "n": 1, "ax": 17, "ay": 32, "f": 0 },
    "ico.body.brigand.2": { "x": 35, "y": 2282, "w": 34, "h": 34, "n": 1, "ax": 18, "ay": 33, "f": 0 },
    "ico.body.brigand.3": { "x": 70, "y": 2282, "w": 34, "h": 34, "n": 1, "ax": 19, "ay": 31, "f": 0 },
    "ico.body.leather.0": { "x": 105, "y": 2282, "w": 34, "h": 34, "n": 1, "ax": 15, "ay": 31, "f": 0 },
    "ico.body.leather.1": { "x": 140, "y": 2282, "w": 34, "h": 34, "n": 1, "ax": 17, "ay": 31, "f": 0 },
    "ico.body.leather.2": { "x": 175, "y": 2282, "w": 34, "h": 34, "n": 1, "ax": 16, "ay": 33, "f": 0 },
    "ico.body.leather.3": { "x": 210, "y": 2282, "w": 34, "h": 34, "n": 1, "ax": 19, "ay": 29, "f": 0 },
    "ico.body.plate.0": { "x": 245, "y": 2282, "w": 34, "h": 34, "n": 1, "ax": 16, "ay": 32, "f": 0 },
    "ico.body.plate.1": { "x": 280, "y": 2282, "w": 34, "h": 34, "n": 1, "ax": 17, "ay": 32, "f": 0 },
    "ico.body.plate.2": { "x": 315, "y": 2282, "w": 34, "h": 34, "n": 1, "ax": 16, "ay": 32, "f": 0 },
    "ico.body.plate.3": { "x": 350, "y": 2282, "w": 34, "h": 34, "n": 1, "ax": 16, "ay": 32, "f": 0 },
    "ico.body.silk.0": { "x": 385, "y": 2282, "w": 34, "h": 34, "n": 1, "ax": 17, "ay": 30, "f": 0 },
    "ico.body.silk.1": { "x": 420, "y": 2282, "w": 34, "h": 34, "n": 1, "ax": 17, "ay": 30, "f": 0 },
    "ico.body.silk.2": { "x": 455, "y": 2282, "w": 34, "h": 34, "n": 1, "ax": 20, "ay": 32, "f": 0 },
    "ico.boots.0": { "x": 490, "y": 2282, "w": 34, "h": 34, "n": 1, "ax": 19, "ay": 32, "f": 0 },
    "ico.boots.1": { "x": 525, "y": 2282, "w": 34, "h": 34, "n": 1, "ax": 16, "ay": 32, "f": 0 },
    "ico.boots.2": { "x": 560, "y": 2282, "w": 34, "h": 34, "n": 1, "ax": 16, "ay": 33, "f": 0 },
    "ico.boots.3": { "x": 595, "y": 2282, "w": 34, "h": 34, "n": 1, "ax": 17, "ay": 33, "f": 0 },
    "ico.bow.0": { "x": 630, "y": 2282, "w": 34, "h": 34, "n": 1, "ax": 19, "ay": 33, "f": 0 },
    "ico.bow.1": { "x": 665, "y": 2282, "w": 34, "h": 34, "n": 1, "ax": 19, "ay": 33, "f": 0 },
    "ico.bow.2": { "x": 700, "y": 2282, "w": 34, "h": 34, "n": 1, "ax": 13, "ay": 32, "f": 0 },
    "ico.bow.3": { "x": 735, "y": 2282, "w": 34, "h": 34, "n": 1, "ax": 11, "ay": 31, "f": 0 },
    "ico.buckler.0": { "x": 770, "y": 2282, "w": 34, "h": 34, "n": 1, "ax": 18, "ay": 27, "f": 0 },
    "ico.buckler.1": { "x": 805, "y": 2282, "w": 34, "h": 34, "n": 1, "ax": 18, "ay": 27, "f": 0 },
    "ico.buckler.2": { "x": 840, "y": 2282, "w": 34, "h": 34, "n": 1, "ax": 18, "ay": 32, "f": 0 },
    "ico.buckler.3": { "x": 875, "y": 2282, "w": 34, "h": 34, "n": 1, "ax": 18, "ay": 28, "f": 0 },
    "ico.dagger.0": { "x": 910, "y": 2282, "w": 34, "h": 34, "n": 1, "ax": 13, "ay": 25, "f": 0 },
    "ico.dagger.1": { "x": 945, "y": 2282, "w": 34, "h": 34, "n": 1, "ax": 13, "ay": 25, "f": 0 },
    "ico.dagger.2": { "x": 980, "y": 2282, "w": 34, "h": 34, "n": 1, "ax": 16, "ay": 23, "f": 0 },
    "ico.dagger.3": { "x": 0, "y": 2317, "w": 34, "h": 34, "n": 1, "ax": 9, "ay": 32, "f": 0 },
    "ico.focus.0": { "x": 35, "y": 2317, "w": 34, "h": 34, "n": 1, "ax": 19, "ay": 31, "f": 0 },
    "ico.focus.1": { "x": 70, "y": 2317, "w": 34, "h": 34, "n": 1, "ax": 19, "ay": 29, "f": 0 },
    "ico.focus.2": { "x": 105, "y": 2317, "w": 34, "h": 34, "n": 1, "ax": 20, "ay": 31, "f": 0 },
    "ico.focus.3": { "x": 140, "y": 2317, "w": 34, "h": 34, "n": 1, "ax": 20, "ay": 33, "f": 0 },
    "ico.gloves.0": { "x": 175, "y": 2317, "w": 34, "h": 34, "n": 1, "ax": 16, "ay": 33, "f": 0 },
    "ico.gloves.1": { "x": 210, "y": 2317, "w": 34, "h": 34, "n": 1, "ax": 16, "ay": 33, "f": 0 },
    "ico.gloves.2": { "x": 245, "y": 2317, "w": 34, "h": 34, "n": 1, "ax": 17, "ay": 33, "f": 0 },
    "ico.gloves.3": { "x": 280, "y": 2317, "w": 34, "h": 34, "n": 1, "ax": 11, "ay": 33, "f": 0 },
    "ico.greataxe.0": { "x": 315, "y": 2317, "w": 34, "h": 34, "n": 1, "ax": 5, "ay": 33, "f": 0 },
    "ico.greataxe.1": { "x": 350, "y": 2317, "w": 34, "h": 34, "n": 1, "ax": 5, "ay": 33, "f": 0 },
    "ico.greataxe.2": { "x": 385, "y": 2317, "w": 34, "h": 34, "n": 1, "ax": 6, "ay": 33, "f": 0 },
    "ico.greataxe.3": { "x": 420, "y": 2317, "w": 34, "h": 34, "n": 1, "ax": 5, "ay": 33, "f": 0 },
    "ico.greatsword.0": { "x": 455, "y": 2317, "w": 34, "h": 34, "n": 1, "ax": 5, "ay": 33, "f": 0 },
    "ico.greatsword.1": { "x": 490, "y": 2317, "w": 34, "h": 34, "n": 1, "ax": 4, "ay": 33, "f": 0 },
    "ico.greatsword.2": { "x": 525, "y": 2317, "w": 34, "h": 34, "n": 1, "ax": 9, "ay": 33, "f": 0 },
    "ico.greatsword.3": { "x": 560, "y": 2317, "w": 34, "h": 34, "n": 1, "ax": 9, "ay": 33, "f": 0 },
    "ico.helmet.brigand.0": { "x": 595, "y": 2317, "w": 34, "h": 34, "n": 1, "ax": 16, "ay": 33, "f": 0 },
    "ico.helmet.brigand.1": { "x": 630, "y": 2317, "w": 34, "h": 34, "n": 1, "ax": 17, "ay": 32, "f": 0 },
    "ico.helmet.leather.0": { "x": 665, "y": 2317, "w": 34, "h": 34, "n": 1, "ax": 16, "ay": 26, "f": 0 },
    "ico.helmet.plate.0": { "x": 700, "y": 2317, "w": 34, "h": 34, "n": 1, "ax": 16, "ay": 33, "f": 0 },
    "ico.helmet.plate.1": { "x": 735, "y": 2317, "w": 34, "h": 34, "n": 1, "ax": 17, "ay": 32, "f": 0 },
    "ico.helmet.plate.2": { "x": 770, "y": 2317, "w": 34, "h": 34, "n": 1, "ax": 18, "ay": 33, "f": 0 },
    "ico.helmet.plate.3": { "x": 805, "y": 2317, "w": 34, "h": 34, "n": 1, "ax": 16, "ay": 29, "f": 0 },
    "ico.helmet.silk.0": { "x": 840, "y": 2317, "w": 34, "h": 34, "n": 1, "ax": 18, "ay": 29, "f": 0 },
    "ico.helmet.silk.1": { "x": 875, "y": 2317, "w": 34, "h": 34, "n": 1, "ax": 18, "ay": 29, "f": 0 },
    "ico.mace.0": { "x": 910, "y": 2317, "w": 34, "h": 34, "n": 1, "ax": 9, "ay": 30, "f": 0 },
    "ico.mace.1": { "x": 945, "y": 2317, "w": 34, "h": 34, "n": 1, "ax": 9, "ay": 33, "f": 0 },
    "ico.mace.2": { "x": 980, "y": 2317, "w": 34, "h": 34, "n": 1, "ax": 12, "ay": 32, "f": 0 },
    "ico.mace.3": { "x": 0, "y": 2352, "w": 34, "h": 34, "n": 1, "ax": 8, "ay": 33, "f": 0 },
    "ico.ring.0": { "x": 35, "y": 2352, "w": 34, "h": 34, "n": 1, "ax": 16, "ay": 26, "f": 0 },
    "ico.ring.1": { "x": 70, "y": 2352, "w": 34, "h": 34, "n": 1, "ax": 16, "ay": 26, "f": 0 },
    "ico.ring.2": { "x": 105, "y": 2352, "w": 34, "h": 34, "n": 1, "ax": 16, "ay": 26, "f": 0 },
    "ico.ring.3": { "x": 140, "y": 2352, "w": 34, "h": 34, "n": 1, "ax": 16, "ay": 26, "f": 0 },
    "ico.shield.0": { "x": 175, "y": 2352, "w": 34, "h": 34, "n": 1, "ax": 8, "ay": 31, "f": 0 },
    "ico.shield.1": { "x": 210, "y": 2352, "w": 34, "h": 34, "n": 1, "ax": 19, "ay": 32, "f": 0 },
    "ico.shield.2": { "x": 245, "y": 2352, "w": 34, "h": 34, "n": 1, "ax": 13, "ay": 33, "f": 0 },
    "ico.shield.3": { "x": 280, "y": 2352, "w": 34, "h": 34, "n": 1, "ax": 17, "ay": 33, "f": 0 },
    "ico.staff.0": { "x": 315, "y": 2352, "w": 34, "h": 34, "n": 1, "ax": 4, "ay": 33, "f": 0 },
    "ico.staff.1": { "x": 350, "y": 2352, "w": 34, "h": 34, "n": 1, "ax": 6, "ay": 32, "f": 0 },
    "ico.staff.2": { "x": 385, "y": 2352, "w": 34, "h": 34, "n": 1, "ax": 5, "ay": 32, "f": 0 },
    "ico.staff.3": { "x": 420, "y": 2352, "w": 34, "h": 34, "n": 1, "ax": 4, "ay": 32, "f": 0 },
    "ico.sword.0": { "x": 455, "y": 2352, "w": 34, "h": 34, "n": 1, "ax": 10, "ay": 28, "f": 0 },
    "ico.sword.1": { "x": 490, "y": 2352, "w": 34, "h": 34, "n": 1, "ax": 9, "ay": 32, "f": 0 },
    "ico.sword.2": { "x": 525, "y": 2352, "w": 34, "h": 34, "n": 1, "ax": 8, "ay": 32, "f": 0 },
    "ico.sword.3": { "x": 560, "y": 2352, "w": 34, "h": 34, "n": 1, "ax": 8, "ay": 33, "f": 0 },
    "ico.wand.0": { "x": 595, "y": 2352, "w": 34, "h": 34, "n": 1, "ax": 6, "ay": 29, "f": 0 },
    "ico.wand.1": { "x": 630, "y": 2352, "w": 34, "h": 34, "n": 1, "ax": 6, "ay": 29, "f": 0 },
    "ico.wand.2": { "x": 665, "y": 2352, "w": 34, "h": 34, "n": 1, "ax": 8, "ay": 28, "f": 0 },
    "ico.wand.3": { "x": 700, "y": 2352, "w": 34, "h": 34, "n": 1, "ax": 6, "ay": 29, "f": 0 },
    "mon.flyer": { "x": 808, "y": 2061, "w": 29, "h": 46, "n": 4, "ax": 19, "ay": 44, "f": 0 },
    "mon.gato": { "x": 0, "y": 2243, "w": 87, "h": 38, "n": 4, "ax": 20, "ay": 37, "f": 1 },
    "mon.ghoul": { "x": 204, "y": 2011, "w": 47, "h": 49, "n": 8, "ax": 32, "ay": 48, "f": 1 },
    "mon.hound": { "x": 0, "y": 2387, "w": 47, "h": 28, "n": 12, "ax": 26, "ay": 27, "f": 1 },
    "mon.shade": { "x": 588, "y": 2011, "w": 30, "h": 49, "n": 7, "ax": 14, "ay": 43, "f": 1 },
    "mon.shade.attack": { "x": 805, "y": 2011, "w": 48, "h": 49, "n": 4, "ax": 24, "ay": 48, "f": 1 },
    "mon.skeleton": { "x": 424, "y": 2061, "w": 34, "h": 47, "n": 8, "ax": 22, "ay": 46, "f": 1 },
    "mon.skull": { "x": 0, "y": 1907, "w": 47, "h": 52, "n": 8, "ax": 24, "ay": 49, "f": 1 },
    "mon.skull2": { "x": 486, "y": 1786, "w": 43, "h": 58, "n": 4, "ax": 23, "ay": 57, "f": 1 },
    "mon.spider": { "x": 850, "y": 2387, "w": 31, "h": 21, "n": 4, "ax": 15, "ay": 20, "f": 0 },
    "mon.thing": { "x": 618, "y": 2201, "w": 26, "h": 40, "n": 4, "ax": 15, "ay": 39, "f": 1 },
    "mon.wizard": { "x": 438, "y": 2156, "w": 37, "h": 44, "n": 5, "ax": 21, "ay": 43, "f": 1 },
    "mon.wizard.attack": { "x": 0, "y": 1851, "w": 66, "h": 55, "n": 10, "ax": 40, "ay": 54, "f": 1 },
    "mon.wolf": { "x": 654, "y": 2387, "w": 48, "h": 23, "n": 4, "ax": 23, "ay": 21, "f": 0 },
    "mon.wraith": { "x": 636, "y": 1907, "w": 31, "h": 51, "n": 4, "ax": 12, "ay": 50, "f": 0 }
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
    const w2 = Math.round(fr.w * s), h2 = Math.round(fr.h * s);
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
  function tileLayer(g, name, w2, bottom, offset) {
    const fr = spriteOf(name);
    if (!fr) return null;
    const top = Math.round(bottom - fr.h);
    let x = -((Math.round(offset) % fr.w + fr.w) % fr.w);
    for (; x < w2; x += fr.w) g.drawImage(img, fr.x, fr.y, fr.w, fr.h, x, top, fr.w, fr.h);
    return top;
  }
  function spriteCanvas(name, f = 0) {
    const fr = spriteOf(name);
    if (!fr) return null;
    const c = document.createElement("canvas");
    c.width = fr.w;
    c.height = fr.h;
    c.getContext("2d").drawImage(img, fr.x + f * (fr.w + 1), fr.y, fr.w, fr.h, 0, 0, fr.w, fr.h);
    return c;
  }

  // src/ui/gfx/scenes.ts
  var SETS = {
    swamp: { sky: "#2a2b17", ground: "#1d1f10", edge: "#3f4a1c", layers: [{ sprite: "bg.swamp.0", parallax: 0.15, drop: 18 }, { sprite: "bg.swamp.1", parallax: 0.5, drop: 18 }] },
    cemetery: { sky: "#240a2c", ground: "#140a1c", edge: "#3b2352", layers: [{ sprite: "bg.cemetery.0", parallax: 0.03, drop: 40 }, { sprite: "bg.cemetery.1", parallax: 0.18, drop: 72 }, { sprite: "bg.cemetery.2", parallax: 0.45, drop: 6 }] },
    forest: { sky: "#b8792f", ground: "#2a1d14", edge: "#6b4a26", layers: [{ sprite: "bg.forest.0", parallax: 0.1, drop: 4 }, { sprite: "bg.forest.1", parallax: 0.3, drop: 4 }, { sprite: "bg.forest.2", parallax: 0.6, drop: 6 }] },
    dusk: { sky: "#8a5f8a", ground: "#20182a", edge: "#4a3552", layers: [{ sprite: "bg.dusk.0", parallax: 0.02, drop: 10 }, { sprite: "bg.dusk.1", parallax: 0.08, drop: 4 }, { sprite: "bg.dusk.2", parallax: 0.18, drop: 4 }, { sprite: "bg.dusk.3", parallax: 0.35, drop: 4 }, { sprite: "bg.dusk.4", parallax: 0.65, drop: 8 }] },
    castle: { sky: "#101f26", ground: "#0c171c", edge: "#284a4a", layers: [{ sprite: "bg.castle.0", parallax: 0.2, drop: 14 }] },
    desert: { sky: "#e8b48a", ground: "#6e2a28", edge: "#a8584a", layers: [{ sprite: "bg.desert.0", parallax: 0.05, drop: 16 }, { sprite: "bg.desert.1", parallax: 0.15, drop: 16 }, { sprite: "bg.desert.2", parallax: 0.3, drop: 16 }, { sprite: "bg.desert.3", parallax: 0.55, drop: 16 }] }
  };
  var ZONE_SET = {
    a1_shore: "swamp",
    a1_saltmire: "swamp",
    a1_chapel: "castle",
    a1_cliffs: "dusk",
    a1_village: "cemetery",
    a1_floodgate: "swamp",
    a1_lock: "castle",
    a1_trial: "cemetery",
    a2_dunes: "desert",
    a2_mirage: "desert",
    a2_caravan: "desert",
    a2_shards: "desert",
    a2_oasis: "desert",
    a2_spire: "castle",
    a2_throne: "castle",
    a2_trial: "desert",
    a3_ashroad: "dusk",
    a3_emberwood: "forest",
    a3_rim: "dusk",
    a3_molten: "desert",
    a3_bellcourt: "castle",
    a3_heart: "dusk",
    a3_sunfall: "cemetery",
    a3_trial: "castle"
  };
  var ROTATION = ["swamp", "cemetery", "forest", "dusk", "desert", "castle"];
  function setFor(zoneId, name) {
    const id = ZONE_SET[zoneId];
    if (id) return SETS[id];
    let h2 = 0;
    for (const c of name) h2 = h2 * 31 + c.charCodeAt(0) >>> 0;
    return SETS[ROTATION[h2 % ROTATION.length]];
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
      h2 = Math.max(72, Math.round(h2));
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
      this.background(zone);
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
      const pet = state.hero.pet ? COMPANIONS[state.hero.pet.id] : void 0;
      if (pet && spriteOf(pet.sprite)) {
        const px = this.HERO_X - 24;
        const since = now - this.heroAtk;
        const hop = !walking && !dead && since < 260 ? Math.round(Math.sin(since / 260 * Math.PI) * 4) : 0;
        const lift = (pet.hover ?? 0) + (pet.hover ? Math.round(Math.sin(now / 320) * 2) : 0);
        shadow(g, px, G2, pet.hover ? 5 : 7, pet.hover ?? 0);
        const fps = (pet.fps ?? 8) * (walking ? 1.5 : 1);
        drawSprite(
          g,
          pet.sprite,
          dead ? 0 : now * fps / 1e3,
          px,
          G2 - lift - hop,
          { scale: pet.scale ?? 1, ...dead ? { tint: "#1a1410", strength: 0.5 } : pet.tint ? { tint: pet.tint, strength: pet.strength ?? 0.4 } : {} }
        );
      }
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
    background(zone) {
      const g = this.g;
      const W2 = this.W, H2 = this.H, G2 = this.GROUND, pal = zone.palette, seedStr = zone.id;
      const set = setFor(zone.id, zone.name);
      if (spriteOf(set.layers[0].sprite)) {
        g.fillStyle = set.sky;
        g.fillRect(0, 0, W2, H2);
        const road = this.travel * 5;
        for (const l of set.layers) tileLayer(g, l.sprite, W2, G2 + (l.drop ?? 0), road * l.parallax);
        g.globalAlpha = 0.12;
        g.fillStyle = pal[0];
        g.fillRect(0, 0, W2, G2);
        g.globalAlpha = 1;
        g.fillStyle = set.ground;
        g.fillRect(0, G2, W2, H2 - G2);
        g.fillStyle = set.edge;
        g.fillRect(0, G2, W2, 1);
        g.fillStyle = "#111";
        g.fillRect(0, G2 + 1, W2, 1);
        g.fillStyle = set.edge;
        for (let x = -(this.travel * 1.2 % 24); x < W2; x += 24) g.fillRect(Math.round(x), G2 + 8, 10, 1);
        return;
      }
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
  /* "Hollow Pixel" (gfx/webfont.ts): 8 font pixels to the em, so sizes stay at 8/12/16/24px. */
  --display: "Hollow Pixel", Bahnschrift, "DIN Alternate", "Arial Narrow", "Segoe UI", sans-serif;
  --body: "Hollow Pixel", "Segoe UI", system-ui, -apple-system, sans-serif;
  --mono: "Hollow Pixel", "Cascadia Mono", Consolas, "Courier New", monospace;
  font: 12px/1.5 var(--body); color: var(--text); font-synthesis: none;
}
.hm.dark { --paper: #221b15; --paper2: #2d241c; --card: #30271f; --nav: #1a1410; --text: #f3e7d3; --muted: #b5a48b; --line: #050403;
  --r-plain: #8f877b; }
.cap { font-family: var(--display); font-stretch: condensed; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }

/* ---- frame ---- */
.win {
  position: fixed; z-index: 10050; display: grid; grid-template-rows: auto auto auto minmax(0, 1fr); grid-template-columns: minmax(0, 1fr);
  min-width: 380px; min-height: 340px; background: var(--paper); border: 3px solid var(--line);
  box-shadow: 8px 8px 0 var(--line); overflow: hidden; container: win / inline-size;
}
.win:focus { outline: none; }
.win.flash { animation: flash .5s cubic-bezier(.2,.8,.3,1); }
@keyframes flash { 0% { box-shadow: 8px 8px 0 var(--line), 0 0 0 6px var(--gold); } 100% { box-shadow: 8px 8px 0 var(--line), 0 0 0 0 var(--gold); } }
.bar { display: flex; align-items: center; gap: 10px; height: 34px; padding-right: 5px; background: var(--ember); color: #1a1410;
  border-bottom: 3px solid var(--line); cursor: move; user-select: none; touch-action: none; }
.logo { align-self: stretch; display: flex; align-items: center; padding: 0 11px; background: #1a1410; color: var(--ember);
  font: 700 16px/1 var(--display); font-stretch: condensed; letter-spacing: 3px; text-transform: uppercase; }
.who { flex: 1; min-width: 0; display: flex; align-items: baseline; gap: 9px; white-space: nowrap; overflow: hidden; }
.who b { font: 700 16px/1 var(--display); font-stretch: condensed; text-transform: uppercase; letter-spacing: 1px; }
.who span { font-weight: 600; font-size: 12px; overflow: hidden; text-overflow: ellipsis; }
.ctls { display: flex; gap: 5px; }
.ctl { width: 26px; height: 24px; padding: 0; display: grid; place-items: center; cursor: pointer; background: #fff4dc; color: #1a1410;
  border: 2px solid #1a1410; box-shadow: 2px 2px 0 #1a1410; }
.ctl:hover { background: var(--gold); }
.ctl.x:hover { background: #1a1410; color: var(--ember); }
.ctl.snd.off { background: #1a1410; color: var(--ember); }
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
.main { display: grid; grid-template-columns: 142px minmax(0, 1fr); min-height: 0; }
.nav { display: flex; flex-direction: column; background: var(--nav); border-right: 3px solid var(--line); overflow: auto; scrollbar-width: none; }
.nav button { position: relative; display: grid; grid-template-columns: 16px 1fr auto; align-items: center; gap: 8px; padding: 8px 10px 8px 12px;
  background: transparent; color: var(--text); border: 0; border-bottom: 2px solid var(--line); cursor: pointer; text-align: left;
  font: 700 16px/1 var(--display); font-stretch: condensed; letter-spacing: 1px; text-transform: uppercase; }
.nav button svg { opacity: .8; }
.nav button .key { font: 700 8px/1 var(--mono); color: var(--muted); }
.nav button:hover:not(.on) { background: var(--paper2); }
.nav button.on { background: var(--gold); color: #1a1410; box-shadow: inset 5px 0 0 #1a1410; }
.nav button.on svg { opacity: 1; } .nav button.on .key { color: #1a1410; }
.nav .badge { position: absolute; right: 26px; top: 50%; transform: translateY(-50%); min-width: 17px; height: 15px; padding: 0 3px; background: var(--ember); color: #1a1410;
  border: 2px solid var(--line); font: 800 8px/11px var(--mono); text-align: center; }
.body { overflow: auto; padding: 14px 16px 22px; min-width: 0; position: relative; scrollbar-width: thin; scrollbar-color: var(--line) transparent; }
.body::-webkit-scrollbar { width: 12px; } .body::-webkit-scrollbar-thumb { background: var(--line); border: 3px solid var(--paper); }
.win.creating .top, .win.creating .hudw, .win.creating .nav, .win.creating .ctl.sz, .win.creating .ctl.mn { display: none; }
.win.creating .main { grid-template-columns: 1fr; }

/* mini mode: the battle itself, a strip that keeps playing; tiny buttons over it, no title bar */
.minibox { display: none; }
.win.mini { grid-template-rows: auto auto; min-width: 0; min-height: 0; box-shadow: 6px 6px 0 var(--line); }
.win.mini .main, .win.mini .grip, .win.mini .toasts, .win.mini .logo, .win.mini .who, .win.mini .ctl.sz, .win.mini .ctl.mx { display: none; }
.win.mini .bar { position: absolute; top: 4px; right: 4px; z-index: 4; height: auto; padding: 0; background: none; border: 0; cursor: default; }
.win.mini .ctls { gap: 3px; opacity: .6; transition: opacity .12s; }
.win.mini:hover .ctls, .win.mini .ctls:focus-within { opacity: 1; }
.win.mini .ctl { width: 20px; height: 18px; box-shadow: 1px 1px 0 #1a1410; }
.win.mini .top, .win.mini .top.nostage { display: block; }
.win.mini .stage { min-height: 0; cursor: move; touch-action: none; }
.win.mini .hudw { border-bottom: 0; }
.win.mini .minibox { display: flex; flex-direction: column; align-items: stretch; gap: 3px; position: absolute; left: 4px; right: 4px; bottom: 4px; z-index: 3; }
.minibox .mlast { display: none; }
.minibox .mlast.ping { display: block; align-self: flex-start; max-width: 100%; padding: 3px 6px; background: rgba(10, 8, 6, .85); color: #f3e7d3;
  font: 700 12px/1.1 var(--display); font-stretch: condensed; letter-spacing: 1px; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  border-left: 4px solid var(--gold); animation: tin .22s cubic-bezier(.2,.8,.3,1); }
.minibox .mlast.t-relic { border-left-color: var(--r-relic); } .minibox .mlast.t-rare { border-left-color: var(--r-rare); }
.minibox .mlast.t-road { border-left-color: var(--teal); } .minibox .mlast.t-err { border-left-color: var(--ember); }
/* dialogs wait hidden while the window is a strip; this row brings the window back for them */
.win.mini > .modal { display: none; }
.mnote { display: flex; align-items: center; gap: 7px; width: 100%; min-height: 30px; padding: 0 4px; cursor: pointer; text-align: left; color: #1a1410;
  border: 6px solid transparent; border-image: var(--fr-gold) 8 fill / 6px; background: none; filter: drop-shadow(2px 2px 0 var(--line)); font: inherit; }
.mnote:hover { filter: drop-shadow(2px 2px 0 var(--line)) brightness(1.08); }
.mnote b { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 700 12px/1 var(--display); font-stretch: condensed; letter-spacing: 1px; text-transform: uppercase; }
.mnote span { flex: none; font: 700 8px/1 var(--mono); text-transform: uppercase; }
.mprog { display: grid; gap: 3px; padding: 3px 5px 4px; background: rgba(10, 8, 6, .85); }
.mprog span { font: 700 8px/1.1 var(--mono); color: #f3e7d3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mprog .progress { height: 9px; border-width: 2px; }

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
.toasts { position: absolute; left: 154px; bottom: 14px; display: flex; flex-direction: column; gap: 6px; z-index: 6; pointer-events: none; max-width: calc(100% - 178px); }
.win.mini .toasts, .win.creating .toasts { left: 10px; max-width: calc(100% - 20px); }
@container win (max-width: 640px) { .toasts { left: 12px; max-width: calc(100% - 24px); } }
.toast { background: var(--card); color: var(--text); border: 3px solid var(--line); box-shadow: 4px 4px 0 var(--line); padding: 6px 11px;
  font: 700 12px/1.2 var(--display); font-stretch: condensed; text-transform: uppercase; letter-spacing: 1px; animation: tin .22s cubic-bezier(.2,.8,.3,1); }
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
.card h3 { margin: 0 0 7px; font: 700 12px/1.1 var(--display); font-stretch: condensed; text-transform: uppercase; letter-spacing: 1px; }
.card > h3:first-child { margin: -9px -11px 9px; padding: 7px 11px 6px; background: var(--paper2); border-bottom: 3px solid var(--line); }
.btn { cursor: pointer; font: 700 12px/1 var(--display); font-stretch: condensed; text-transform: uppercase; letter-spacing: 1px; padding: 7px 12px 6px;
  background: var(--gold); color: #1a1410; border: 3px solid var(--line); box-shadow: 3px 3px 0 var(--line); }
.btn:hover { transform: translate(-1px, -1px); box-shadow: 4px 4px 0 var(--line); }
.btn:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 var(--line); }
.btn.alt { background: var(--card); color: var(--text); }
.btn.hot { background: var(--ember); color: #1a1410; }
.btn:disabled { opacity: .45; cursor: default; transform: none; box-shadow: 3px 3px 0 var(--line); }
.x { cursor: pointer; background: var(--card); color: var(--text); border: 2px solid var(--line); width: 24px; height: 24px; font-weight: 900; box-shadow: 2px 2px 0 var(--line); padding: 0; }
.x:hover { background: var(--gold); color: #1a1410; }
.tag { display: inline-block; font: 700 12px/1.3 var(--display); font-stretch: condensed; letter-spacing: 1px; padding: 1px 6px; border: 2px solid var(--line); background: var(--paper2); text-transform: uppercase; }
.muted { color: var(--muted); }
.num { font-variant-numeric: tabular-nums; font-family: var(--mono); }
.kv { display: grid; grid-template-columns: 1fr auto; gap: 0 12px; }
.kv > * { padding: 2px 0; border-bottom: 1px dashed color-mix(in srgb, var(--line) 18%, transparent); }
.kv > :nth-child(odd) { color: var(--muted); }
.kv > :nth-child(even) { text-align: right; font-weight: 700; }
.kv .click { cursor: pointer; text-decoration: underline dotted; text-underline-offset: 3px; }
.kv .click:hover { color: var(--text); }
.big { font: 700 24px/1 var(--display); font-stretch: condensed; letter-spacing: 1px; }
.grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; align-items: start; }
.slots { display: grid; grid-template-columns: repeat(4, 56px); gap: 6px; }
.cell { position: relative; width: 56px; height: 56px; border: 3px solid var(--line); background: var(--card); cursor: pointer; display: flex; align-items: center; justify-content: center; }
.cell:hover { transform: translate(-1px, -1px); box-shadow: 3px 3px 0 var(--line); }
.cell canvas { width: 36px; height: 36px; image-rendering: pixelated; }
.cell .lbl { position: absolute; bottom: 1px; left: 3px; font: 700 8px/1 var(--display); font-stretch: condensed; letter-spacing: 1px; color: var(--muted); text-transform: uppercase; }
.cell.sel { outline: 3px solid var(--ember); outline-offset: 1px; }
.cell.plain { background: var(--r-plain); } .cell.enchanted { background: var(--r-enchanted); } .cell.rare { background: var(--r-rare); } .cell.relic { background: var(--r-relic); }
.cell.plain .lbl, .cell.enchanted .lbl, .cell.rare .lbl, .cell.relic .lbl { color: #1a1410; }
.cell.empty { cursor: default; background: repeating-linear-gradient(45deg, var(--paper), var(--paper) 6px, var(--paper2) 6px, var(--paper2) 12px); }
.cell.empty:hover { transform: none; box-shadow: none; }
.stash { display: grid; grid-template-columns: repeat(auto-fill, 48px); gap: 5px; }
.stash .cell { width: 48px; height: 48px; }
.stash .cell canvas { width: 30px; height: 30px; }
.item { min-width: 220px; }
.item .name { font: 700 16px/1.15 var(--display); font-stretch: condensed; letter-spacing: 0; padding: 6px 9px 5px; border-bottom: 3px solid var(--line); margin: -9px -11px 7px; }
.item .name.plain { background: var(--r-plain); color: #1a1410; } .item .name.enchanted { background: var(--r-enchanted); color: #1a1410; }
.item .name.rare { background: var(--r-rare); color: #1a1410; } .item .name.relic { background: var(--r-relic); color: #1a1410; }
.item .aff { font-size: 12px; }
.item .aff b { font: 700 8px var(--mono); color: var(--muted); margin-left: 5px; }
.item hr { border: 0; border-top: 2px dashed var(--line); margin: 7px 0; }
.up { color: var(--green); font-weight: 800; } .down { color: var(--red); font-weight: 800; }
.hm.dark .up { color: #6fe08a; } .hm.dark .down { color: #ff6b6d; }
.skill { display: flex; gap: 8px; align-items: flex-start; padding: 7px 9px; border: 3px solid var(--line); background: var(--card); cursor: pointer; box-shadow: 3px 3px 0 var(--line); }
.skill:hover:not(.locked):not(.on) { background: var(--paper2); }
.skill.on { background: var(--gold); color: #1a1410; }
.skill.on .muted { color: #4d4030; }
.skill.locked { opacity: .5; cursor: default; }
.skill .nm { font: 700 16px/1.1 var(--display); font-stretch: condensed; letter-spacing: 0; text-transform: uppercase; }
.skill .ds { font-size: 12px; }
.zone { display: flex; gap: 8px; align-items: center; padding: 7px 9px; border: 3px solid var(--line); background: var(--card); cursor: pointer; margin-bottom: 6px; }
.zone:hover:not(.locked):not(.on) { background: var(--paper2); }
.zone.on { background: var(--teal); color: #1a1410; }
.zone.on .muted { color: #16433e; }
.zone.locked { opacity: .45; cursor: default; }
.log .entry { display: flex; gap: 8px; align-items: baseline; padding: 4px 0; border-bottom: 1px dashed color-mix(in srgb, var(--line) 25%, transparent); font-size: 12px; }
.log .entry .tag { flex: none; min-width: 52px; text-align: center; }
.log .when { flex: none; font-size: 8px; }

/* section headers outside cards, flat lists, chips */
.sec { display: flex; align-items: baseline; gap: 8px; margin: 0 0 7px; font: 700 16px/1 var(--display); font-stretch: condensed; text-transform: uppercase; letter-spacing: 2px; }
.sec .muted { font: 600 12px/1 var(--body); text-transform: none; letter-spacing: 0; }
.card h3.split { display: flex; flex-wrap: wrap; gap: 4px 12px; justify-content: space-between; align-items: baseline; }
.card h3.split .num { font-size: 12px; letter-spacing: 0; }
.list { background: var(--card); border: 3px solid var(--line); box-shadow: var(--sh); }
.li { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 3px 12px; padding: 8px 10px; border-bottom: 2px solid var(--line); cursor: pointer; }
.li:last-child { border-bottom: 0; }
.li:hover:not(.locked):not(.on), .li:focus-visible { background: var(--paper2); outline: none; }
.li.on { background: var(--gold); color: #1a1410; cursor: default; }
.li.on .tag { border-color: #1a1410; }
.li.locked { cursor: default; opacity: .5; }
.li .nm { font: 700 16px/1.1 var(--display); font-stretch: condensed; text-transform: uppercase; letter-spacing: 0; }
.li .meta { grid-column: 2; grid-row: 1 / span 3; display: flex; align-items: flex-start; justify-content: flex-end; text-align: right; }
.li .ds { grid-column: 1; font-size: 12px; }
.li .tags { grid-column: 1; display: flex; gap: 4px; flex-wrap: wrap; margin-top: 2px; }
.li .tags .tag { font-size: 8px; padding: 0 5px; }
.delta { font: 700 12px/1 var(--mono); }
.li.on .up { color: #146b2c; } .li.on .down { color: #9e1d1f; }
.chips { display: flex; gap: 4px; flex-wrap: wrap; }
.chip { font: 700 12px/1 var(--display); font-stretch: condensed; text-transform: uppercase; letter-spacing: 1px; padding: 5px 8px 4px;
  border: 2px solid var(--line); background: var(--card); color: var(--text); cursor: pointer; }
.chip:hover:not(.on) { background: var(--paper2); }
.chip.on { background: var(--text); color: var(--paper); }
.chip b { font: 700 8px/1 var(--mono); margin-left: 5px; opacity: .75; }

/* gear: equipped and stash on the left, the picked item stays in view on the right */
.gear { display: grid; grid-template-columns: minmax(0, auto) minmax(0, 1fr); gap: 14px; align-items: start; }
.gear select { padding: 3px 6px; font-size: 12px; }
@container win (max-width: 760px) { .gear { grid-template-columns: 1fr; } }
.gpop { position: absolute; z-index: 7; width: 300px; max-width: calc(100% - 12px); animation: tipin .12s ease-out; }
.gpop .popx { position: absolute; right: 6px; top: 6px; width: 22px; height: 22px; z-index: 1; }
.gpop .item .name { padding-right: 32px; }
.popacts { margin-top: 8px; padding-top: 8px; border-top: 2px dashed color-mix(in srgb, var(--line) 50%, transparent); }
.info { width: 22px; height: 22px; padding: 0; cursor: help; border: 2px solid currentColor; background: none; color: inherit; font: 700 12px/1 var(--mono); align-self: center; }
.info:hover, .info:focus-visible { background: var(--gold); color: #1a1410; border-color: #1a1410; }
.cell.upg::after { content: ""; position: absolute; right: -3px; top: -3px; border-style: solid; border-width: 0 14px 14px 0; border-color: transparent var(--green) transparent transparent; }
.cell.upg::before { content: ""; position: absolute; right: -3px; top: -3px; border-style: solid; border-width: 0 17px 17px 0; border-color: transparent var(--line) transparent transparent; }
.cell.req canvas { opacity: .4; }
.cell.req { filter: saturate(.4); }
.hint h3 { margin-bottom: 7px; }
.modal { position: absolute; inset: 0; background: rgba(26, 20, 16, .55); display: flex; align-items: center; justify-content: center; z-index: 5; padding: 16px; }
.modal > .card { max-width: 460px; width: 100%; max-height: 100%; overflow: auto; animation: pop .2s cubic-bezier(.2,.8,.3,1); }
@keyframes pop { from { transform: translateY(8px); opacity: 0; } to { transform: none; opacity: 1; } }
input[type=text], textarea, select { font: inherit; padding: 5px 7px; border: 3px solid var(--line); background: var(--card); color: var(--text); }
textarea { width: 100%; min-height: 70px; font-family: var(--mono); font-size: 12px; }
label.chk { display: flex; gap: 6px; align-items: center; cursor: pointer; font-weight: 700; }
input[type=checkbox] { accent-color: var(--ember); width: 15px; height: 15px; }
.progress { height: 18px; border: 3px solid var(--line); background: var(--card); } .progress i { display: block; height: 100%; background: var(--teal); }
.story { font-style: italic; border-left: 6px solid var(--ember); padding-left: 9px; }

/* ---- pixel frames: border-image art from gfx/frames.ts, pixel type from gfx/pix.ts ---- */
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.pxc { display: block; image-rendering: pixelated; }
.card, .list { border: 8px solid transparent; border-image: var(--fr-card) 8 fill / 8px; background: none; box-shadow: none;
  filter: drop-shadow(4px 4px 0 var(--line)); padding: 3px 5px 5px; }
.hm.dark .card, .hm.dark .list { filter: drop-shadow(4px 4px 0 #000); }
.card > h3:first-child { margin: -3px -5px 10px; padding: 6px 8px; background: #1a1410; color: #ffc233; border: 0;
  clip-path: polygon(0 2px, 2px 2px, 2px 0, calc(100% - 2px) 0, calc(100% - 2px) 2px, 100% 2px, 100% calc(100% - 2px), calc(100% - 2px) calc(100% - 2px), calc(100% - 2px) 100%, 2px 100%, 2px calc(100% - 2px), 0 calc(100% - 2px)); }
.card > h3:first-child .num { color: #b5a48b; }
.card h3 { color: var(--text); }
.card h3 .pxc, .sec .pxc { display: inline-block; vertical-align: middle; }
.item .name { margin: -3px -5px 8px; border: 0; clip-path: polygon(0 2px, 2px 2px, 2px 0, calc(100% - 2px) 0, calc(100% - 2px) 2px, 100% 2px, 100% 100%, 0 100%); }
.btn { border: 8px solid transparent; border-image: var(--fr-gold) 8 fill / 8px; background: none; box-shadow: none; padding: 1px 5px;
  filter: drop-shadow(3px 3px 0 var(--line)); min-height: 34px; display: inline-flex; align-items: center; justify-content: center; }
.hm.dark .btn { filter: drop-shadow(3px 3px 0 #000); }
.btn:hover { transform: translate(-1px, -1px); box-shadow: none; filter: drop-shadow(4px 4px 0 var(--line)) brightness(1.06); }
.btn:active { transform: translate(2px, 2px); box-shadow: none; filter: drop-shadow(1px 1px 0 var(--line)); }
.btn.alt { border-image-source: var(--fr-alt); background: none; }
.btn.hot { border-image-source: var(--fr-ember); background: none; }
.btn:disabled { opacity: .45; box-shadow: none; filter: none; }
.cell { border: 8px solid transparent; border-image: var(--fr-sunk) 8 fill / 8px; background: none; }
.cell:hover { box-shadow: none; filter: brightness(1.12); }
.cell.plain { border-image-source: var(--fr-plain); background: none; } .cell.enchanted { border-image-source: var(--fr-enchanted); background: none; }
.cell.rare { border-image-source: var(--fr-rare); background: none; } .cell.relic { border-image-source: var(--fr-relic); background: none; }
.cell.rare, .cell.relic { filter: drop-shadow(0 0 3px color-mix(in srgb, var(--r-rare) 55%, transparent)); }
.cell.relic { filter: drop-shadow(0 0 4px color-mix(in srgb, var(--r-relic) 70%, transparent)); }
.cell.empty { border-image-source: var(--fr-empty); background: none; }
.cell .lbl { bottom: -1px; left: 0; color: var(--muted); }
.cell.plain .lbl, .cell.enchanted .lbl, .cell.rare .lbl, .cell.relic .lbl { display: none; }
.cell canvas.ic { width: auto; height: auto; }
.cell.upg::after { right: -5px; top: -5px; } .cell.upg::before { right: -5px; top: -5px; }
.stash { grid-template-columns: repeat(auto-fill, 52px); gap: 3px; }
.stash .cell { width: 52px; height: 52px; }
.skill, .zone { border: 8px solid transparent; border-image: var(--fr-alt) 8 fill / 8px; background: none; box-shadow: none; padding: 1px 3px; }
.skill:hover:not(.locked):not(.on), .zone:hover:not(.locked):not(.on) { background: none; filter: brightness(1.05); }
.skill.on { border-image-source: var(--fr-gold); background: none; }
.zone.on { border-image-source: var(--fr-teal); background: none; }
.li { border-bottom: 2px solid var(--line); }
.list { padding: 0; }
.li.on { background: #ffc233; }

/* paper doll, tooltips, drag and drop */
.doll { display: grid; grid-template-columns: 56px minmax(112px, 1fr) 56px; grid-template-rows: repeat(5, 56px); gap: 6px 10px; max-width: 330px;
  grid-template-areas: "helmet fig amulet" "weapon fig offhand" "body fig gloves" "ring1 fig ring2" "belt fig boots"; margin: 0 auto; }
.doll [data-slot="weapon"] { grid-area: weapon; } .doll [data-slot="offhand"] { grid-area: offhand; } .doll [data-slot="helmet"] { grid-area: helmet; }
.doll [data-slot="body"] { grid-area: body; } .doll [data-slot="gloves"] { grid-area: gloves; } .doll [data-slot="boots"] { grid-area: boots; }
.doll [data-slot="belt"] { grid-area: belt; } .doll [data-slot="amulet"] { grid-area: amulet; } .doll [data-slot="ring1"] { grid-area: ring1; } .doll [data-slot="ring2"] { grid-area: ring2; }
.doll .fig { grid-area: fig; position: relative; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 14px;
  border: 8px solid transparent; border-image: var(--fr-sunk) 8 fill / 8px; overflow: hidden; }
.doll .fig::after { content: ""; position: absolute; left: 18%; right: 18%; bottom: 10px; height: 6px; background: rgba(0,0,0,.35); border-radius: 50%; }
.doll .fig::before { content: ""; position: absolute; inset: 0; background: repeating-linear-gradient(0deg, transparent 0 6px, rgba(0,0,0,.05) 6px 7px); }
.figart { image-rendering: pixelated; position: relative; z-index: 1; }
.tip { position: absolute; z-index: 8; pointer-events: none; max-width: 560px; animation: tipin .12s ease-out; }
.tip .card { margin: 0; }
.tipcols { display: flex; gap: 10px; align-items: flex-start; }
.tipcols > * { width: 250px; }
.tiplbl { font: 700 12px/1 var(--display); font-stretch: condensed; text-transform: uppercase; letter-spacing: 2px; color: var(--muted); padding-left: 2px; }
@keyframes tipin { from { opacity: 0; transform: translateY(3px); } }
.cell[draggable="true"] { cursor: grab; }
.gear.dragging .cell.drop-ok { outline: 2px dashed var(--teal); outline-offset: 1px; }
.cell.over, .stash.over { filter: brightness(1.35) drop-shadow(0 0 4px var(--teal)); }
.gear.dragging .anvil { outline: 2px dashed var(--ember); outline-offset: 2px; }
.anvil { display: inline-flex; align-items: center; gap: 6px; padding: 2px 8px; min-height: 34px; color: var(--text);
  border: 8px solid transparent; border-image: var(--fr-sunk) 8 fill / 8px; font: 700 12px/1 var(--display); font-stretch: condensed; text-transform: uppercase; letter-spacing: 1px; }
.anvil.over { filter: brightness(1.3) drop-shadow(0 0 5px var(--ember)); color: var(--ember); }
.nav button { grid-template-columns: 16px auto 1fr auto; }
.nav .badge { position: static; transform: none; order: 3; justify-self: end; margin-right: 6px; }
.nav button .key { order: 4; }
.nav button .lbl { order: 2; } .nav button svg { order: 1; }

/* hero: a character sheet */
.sheet { display: grid; grid-template-columns: minmax(0, 330px) minmax(0, 1fr) minmax(0, 300px); gap: 14px; align-items: start; }
@container win (max-width: 1100px) { .sheet { grid-template-columns: minmax(0, 330px) minmax(0, 1fr); } .sheet > :last-child { grid-column: 1 / -1; } }
@container win (max-width: 760px) { .sheet { grid-template-columns: 1fr; } }
.portrait-frame { position: relative; line-height: 0; border: 8px solid transparent; border-image: var(--fr-sunk) 8 fill / 8px; }
.portrait { image-rendering: pixelated; max-width: 100%; height: auto !important; }
.where-tag { position: absolute; left: 6px; bottom: 6px; line-height: 1.2; padding: 2px 6px; background: rgba(10,8,6,.78); color: #f3e7d3;
  font: 700 12px/1.2 var(--display); font-stretch: condensed; letter-spacing: 1px; text-transform: uppercase; }
.tag.lv { background: #1a1410; color: #ffc233; border-color: #1a1410; } .tag.asc { background: var(--violet); color: #fff; }
.xpbar { height: 8px; margin: 8px 0 4px; background: #1a1410; border: 2px solid var(--line); } .xpbar i { display: block; height: 100%; background: #ffc233; }
.attrs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 8px; }
.attr { display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto; column-gap: 6px; align-items: center; padding: 4px 6px;
  border: 8px solid transparent; border-image: var(--fr-alt) 8 fill / 8px; }
.attr svg { grid-row: 1 / span 2; } .attr b { font-size: 16px; line-height: 1; } .attr span { font: 700 8px/1 var(--display); font-stretch: condensed; letter-spacing: 1px; text-transform: uppercase; color: var(--muted); }
.attr.might svg { color: #e5383b; } .attr.grace svg { color: #3fbf5f; } .attr.wit svg { color: #3a7bff; }
.bigrow { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
.bigstat { flex: 1 1 150px; display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; background: #1a1410; color: #f3e7d3;
  clip-path: polygon(0 3px, 3px 3px, 3px 0, calc(100% - 3px) 0, calc(100% - 3px) 3px, 100% 3px, 100% calc(100% - 3px), calc(100% - 3px) calc(100% - 3px), calc(100% - 3px) 100%, 3px 100%, 3px calc(100% - 3px), 0 calc(100% - 3px)); }
.bigstat b { display: block; font: 700 12px/1 var(--display); font-stretch: condensed; letter-spacing: 1px; text-transform: uppercase; }
.bigstat span { font-size: 12px; color: #b5a48b; }
.formula { display: flex; flex-wrap: wrap; align-items: stretch; gap: 4px; margin-bottom: 10px; }
.fchip { display: flex; flex-direction: column; gap: 2px; padding: 4px 8px; min-width: 56px; text-align: left; font: inherit; color: var(--text); cursor: default;
  border: 8px solid transparent; border-image: var(--fr-alt) 8 fill / 8px; margin: -4px 0; }
button.fchip { cursor: pointer; } button.fchip:hover { filter: brightness(1.08); }
.fchip span { font: 700 8px/1 var(--display); font-stretch: condensed; letter-spacing: 1px; text-transform: uppercase; color: var(--muted); }
.fchip b { font-size: 16px; line-height: 1.1; }
.fchip.total { border-image-source: var(--fr-gold); color: #1a1410; } .fchip.total span { color: #4d4030; }
.fop { align-self: center; font: 700 16px/1 var(--mono); color: var(--muted); padding: 0 1px; }
.resrow { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.res { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 6px 2px 4px; font: inherit; color: var(--text); cursor: pointer;
  border: 8px solid transparent; border-image: var(--fr-sunk) 8 fill / 8px; }
.res b { font-size: 16px; } .res span { font-size: 8px; color: var(--muted); text-align: center; }
.res.fire svg { color: #ff5a36; } .res.cold svg { color: #3a9bff; } .res.lightning svg { color: #e0b800; } .res.chaos svg { color: #8b5cf6; }
.res.neg b { color: var(--red); } .res.cap b { color: var(--green); } .hm.dark .res.cap b { color: #6fe08a; }
.res:hover, .stat:hover { filter: brightness(1.1); }
.tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 10px; }
.stat { display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto; column-gap: 6px; align-items: center; text-align: left; padding: 4px 6px;
  font: inherit; color: var(--text); cursor: pointer; border: 8px solid transparent; border-image: var(--fr-alt) 8 fill / 8px; }
.stat svg { grid-row: 1 / span 2; } .stat b { font-size: 16px; line-height: 1.05; } .stat span { font: 700 8px/1 var(--display); font-stretch: condensed; letter-spacing: 1px; text-transform: uppercase; color: var(--muted); }
.stat.heart svg { color: #e5383b; } .stat.esorb svg { color: #7fd1ff; } .stat.regen svg { color: #3fbf5f; } .stat.armour svg { color: #9aa4b2; } .stat.evasion svg { color: #19b3a3; } .stat.block svg { color: #ffc233; }
.sub { font: 700 12px/1.2 var(--display); font-stretch: condensed; letter-spacing: 1px; text-transform: uppercase; color: var(--muted); margin: 2px 0 6px; }

.meter { position: relative; height: 18px; background: #1a1410; border: 2px solid var(--line); overflow: hidden; }
.meter i { position: absolute; left: 0; top: 0; bottom: 0; }
.meter span { position: relative; display: block; padding-left: 6px; font: 700 12px/14px var(--mono); color: #f3e7d3; text-shadow: 1px 1px 0 #000; white-space: nowrap; }
.tiles { grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); }
.stat, .attr { min-width: 0; } .stat b, .stat span, .attr b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* world: each act is a road of stops with their scenery */
.toggle { display: flex; align-items: center; gap: 10px; padding: 4px 8px; text-align: left; font: inherit; color: var(--text); cursor: pointer;
  border: 8px solid transparent; border-image: var(--fr-alt) 8 fill / 8px; align-self: flex-start; }
.toggle i { flex: none; position: relative; width: 38px; height: 20px; background: #1a1410; border: 2px solid var(--line); }
.toggle i::after { content: ""; position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; background: #6b5d4b; transition: left .12s; }
.toggle.on i::after { left: 20px; background: #19b3a3; }
.toggle b { display: block; font: 700 12px/1.1 var(--display); font-stretch: condensed; text-transform: uppercase; letter-spacing: 1px; }
.toggle small { color: var(--muted); font-size: 12px; }
.act .story { margin-bottom: 12px; }
.road { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 0; }
.path { width: 18px; height: 4px; background: repeating-linear-gradient(90deg, var(--line) 0 4px, transparent 4px 7px); }
.path.dim { opacity: .35; }
.stop { width: 132px; display: flex; flex-direction: column; gap: 4px; padding: 3px; text-align: left; font: inherit; color: var(--text); cursor: pointer;
  border: 8px solid transparent; border-image: var(--fr-alt) 8 fill / 8px; }
.stop:hover:not(.locked):not(.here) { filter: brightness(1.07); transform: translateY(-1px); }
.stop.here { border-image-source: var(--fr-teal); color: #1a1410; }
.stop.here .meta span:not(.tag) { color: #16433e; }
.stop.locked { cursor: default; opacity: .6; }
.stop.locked .thumb { filter: grayscale(1) brightness(.45); }
.stop .pic { position: relative; line-height: 0; border: 2px solid var(--line); background: #1a1410; }
.stop .thumb { width: 100%; image-rendering: pixelated; }
.stop b { font: 700 12px/1.15 var(--display); font-stretch: condensed; letter-spacing: 0; text-transform: uppercase; }
.stop .meta { display: flex; align-items: center; gap: 5px; font-size: 8px; color: var(--muted); }
.num-badge { position: absolute; left: 0; top: 0; min-width: 16px; padding: 2px 3px; background: #1a1410; color: #ffc233; font: 700 8px/1 var(--mono); text-align: center; line-height: 12px; }
.flag { position: absolute; right: 0; top: 0; padding: 2px 5px; font: 700 8px/12px var(--display); font-stretch: condensed; letter-spacing: 1px; text-transform: uppercase; color: #1a1410; }
.flag.boss { background: var(--ember); } .flag.trial { background: var(--violet); color: #fff; }
.hero-mark { position: absolute; left: 50%; bottom: 4px; transform: translateX(-50%); image-rendering: pixelated; }
.lock { position: absolute; inset: 0; display: grid; place-items: center; color: #f3e7d3; }
.trialrow { display: flex; align-items: center; gap: 10px; margin-top: 10px; padding-top: 10px; border-top: 2px dashed color-mix(in srgb, var(--line) 40%, transparent); }
.stop.trial:not(.here) { border-image-source: var(--fr-sunk); }

/* skills: the socket bar */
.links { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 0; }
.links { flex-wrap: nowrap; }
@container win (max-width: 640px) { .links { flex-wrap: wrap; } }
.link { flex: 0 1 18px; min-width: 8px; height: 6px; background: #1a1410; border-top: 2px solid #6b5d4b; }
.hm.dark .link { background: #000; border-top-color: #4a3d31; }
.link.off { opacity: .3; }
.sock { flex: 1 1 0; min-width: 66px; max-width: 104px; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 6px 2px 4px; font: inherit; color: var(--text);
  border: 8px solid transparent; border-image: var(--fr-sunk) 8 fill / 8px; }
button.sock { cursor: pointer; } button.sock:hover { filter: brightness(1.12); }
.sock.main { flex-grow: 1.3; max-width: 128px; border-image-source: var(--fr-gold); color: #1a1410; }
.sock b { font: 700 12px/1.15 var(--display); letter-spacing: 1px; text-transform: uppercase; text-align: center; max-width: 100%; overflow-wrap: anywhere; }
.sock.main b { font-size: 12px; }
.sock.empty b, .sock.locked b { color: var(--muted); }
.sock.locked { opacity: .55; }
.gem { position: relative; display: inline-block; line-height: 0; filter: drop-shadow(1px 1px 0 #1a1410) drop-shadow(-1px -1px 0 #1a1410); }
.gem .shine { position: absolute; inset: 0; color: #ffffff; opacity: .75; }
.hole { color: var(--muted); line-height: 0; }
.li .nm { display: flex; align-items: center; gap: 6px; }
.li.locked .gem { filter: grayscale(1); }

/* forge: rack, anvil, shelf */
.smithy { display: grid; grid-template-columns: minmax(0, 1fr) minmax(250px, 320px) minmax(260px, 1fr); gap: 14px; align-items: start; }
@container win (max-width: 1080px) { .smithy { grid-template-columns: minmax(0, 1fr) minmax(250px, 1fr); } .smithy > :last-child { grid-column: 1 / -1; } }
@container win (max-width: 700px) { .smithy { grid-template-columns: 1fr; } }
.cell .worn { position: absolute; left: -2px; bottom: -3px; padding: 0 3px; background: #1a1410; color: #ffc233; font: 700 8px/12px var(--display); font-stretch: condensed; letter-spacing: 1px; text-transform: uppercase; }
.anvil-plate { display: grid; place-items: center; height: 96px; margin-bottom: 10px; border: 8px solid transparent; border-image: var(--fr-sunk) 8 fill / 8px;
  background: radial-gradient(ellipse at 50% 100%, rgba(255,120,40,.35), transparent 70%); color: var(--muted); }
.anvil-plate.rare, .anvil-plate.relic { background: radial-gradient(ellipse at 50% 100%, rgba(255,194,51,.45), transparent 70%); }
.anvil-art { width: 68px !important; height: 68px !important; image-rendering: pixelated; filter: drop-shadow(0 3px 0 rgba(0,0,0,.4)); }
.anvilcard .item { filter: none; }
.shelf { display: flex; flex-direction: column; gap: 6px; }
.cur { display: grid; grid-template-columns: auto 1fr auto; gap: 8px; align-items: center; padding: 2px 4px; border: 8px solid transparent; border-image: var(--fr-alt) 8 fill / 8px; }
.cur.none .orb canvas { filter: grayscale(.8) brightness(.8); }
.cur b { display: block; font: 700 12px/1.1 var(--display); font-stretch: condensed; letter-spacing: 1px; text-transform: uppercase; }
.cur .grow span { font-size: 12px; color: var(--muted); }
.orb { position: relative; width: 38px; height: 38px; display: grid; place-items: center; }
.orb canvas { image-rendering: pixelated; }
.orb .count { position: absolute; right: -6px; bottom: -4px; min-width: 18px; padding: 0 3px; background: #1a1410; color: #ffc233; font-size: 8px; line-height: 14px; text-align: center; }
.btn.small { min-height: 28px; padding: 0 4px; }
.treecv { border: 8px solid transparent; border-image: var(--fr-sunk) 8 fill / 8px; box-sizing: border-box; }
.treewrap { position: relative; }
.treepop { position: absolute; z-index: 3; width: 260px; max-width: calc(100% - 16px); pointer-events: none; animation: tipin .12s ease-out; }
.treepop.pinned { pointer-events: auto; }
.treepop h3 { font-size: 12px; }
.smith { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.dust { display: flex; align-items: center; gap: 6px; padding: 4px 10px; background: #1a1410; color: #ffc233; }
.dust b { font-size: 16px; } .dust span { font: 700 12px/1 var(--display); font-stretch: condensed; letter-spacing: 1px; text-transform: uppercase; color: #b5a48b; }

/* atlas */
.ladder { display: flex; gap: 2px; flex-wrap: wrap; }
.rung { width: 26px; height: 26px; display: grid; place-items: center; background: #1a1410; color: #6b5d4b; font: 700 12px/1 var(--mono); border: 2px solid var(--line); }
.rung.done { background: var(--teal); color: #1a1410; }
.zone.map { gap: 10px; }
.mthumb { flex: none; width: 84px; height: 44px; image-rendering: pixelated; border: 2px solid var(--line); }
.zone.map b { font: 700 12px/1.1 var(--display); font-stretch: condensed; letter-spacing: 0; text-transform: uppercase; }
.pinnacle { align-items: stretch; }
.pin-frame { flex: none; width: 92px; display: grid; place-items: end center; padding: 4px; border: 2px solid var(--line); overflow: hidden; }
.pin-art { image-rendering: pixelated; max-width: 84px; max-height: 90px; object-fit: contain; }

/* the game's own tooltips (tips.ts) */
.htip { position: absolute; z-index: 20; max-width: 300px; padding: 3px 6px; pointer-events: none; white-space: pre-line;
  color: #f3e7d3; font: 12px/1.45 var(--body); border: 6px solid transparent; border-image: var(--fr-plaque) 8 fill / 6px;
  filter: drop-shadow(3px 3px 0 #000); animation: tipin .1s ease-out; }

/* states: notes, warnings, locked things */
.tag { color: var(--text); }
.li.on .tag, .skill.on .tag, .zone.on .tag, .stop.here .tag { background: #1a1410; color: #ffc233; border-color: #1a1410; }
.tag.done, .tag.teal { background: var(--teal); color: #1a1410; } .tag.here, .tag.gold { background: var(--gold); color: #1a1410; } .tag.ember { background: var(--ember); color: #1a1410; }
.note { display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: #1a1410; color: #f3e7d3; font-size: 12px; border-left: 6px solid var(--teal); }
.note svg { color: var(--teal); flex: none; }
.warnbar { display: flex; align-items: center; gap: 8px; margin: -2px 0 8px; padding: 5px 8px; background: var(--ember); color: #1a1410; font-size: 12px; font-weight: 700; }
.warnbar svg { flex: none; }
.card > h3 .num.full { color: var(--ember); }
.stash-note { grid-column: 1 / -1; padding: 4px 0 6px; font-size: 12px; }
.cell.blocked, .cell.only { cursor: default; }
.cell.blocked { border-image-source: var(--fr-empty); background: repeating-linear-gradient(135deg, transparent 0 5px, color-mix(in srgb, var(--line) 22%, transparent) 5px 7px); background-clip: padding-box; }
.cell.blocked .lbl, .cell.only .lbl { display: block; color: var(--muted); }
.cell[role="button"]:focus-visible { outline: 3px dashed var(--ember); outline-offset: 1px; }
.x:disabled { opacity: .35; cursor: default; }
.x:disabled:hover { background: var(--card); color: var(--text); }
.act.folded .row { flex-wrap: nowrap; }
.act.folded .muted { font-size: 12px; }
.atlas-locked { gap: 10px; }
.gate { position: relative; line-height: 0; border: 2px solid var(--line); background: #1a1410; }
.gate-pic { display: block; width: 100%; height: auto; max-height: 150px; object-fit: cover; image-rendering: pixelated; filter: saturate(.55) brightness(.9); }
.gate .lock { color: #ffc233; }
.gate-acts { display: flex; gap: 6px; flex-wrap: wrap; }

/* creation: three callings in their scenery */
.create { max-width: 840px; margin: 0 auto; display: flex; flex-direction: column; gap: 12px; }
.create .sec { margin: 4px 0 0; }
.callings { display: grid; grid-template-columns: repeat(auto-fit, minmax(236px, 1fr)); gap: 12px; }
.calling { display: flex; flex-direction: column; gap: 6px; padding: 3px 3px 6px; text-align: left; font: inherit; color: var(--text); cursor: pointer; min-width: 0;
  border: 8px solid transparent; border-image: var(--fr-alt) 8 fill / 8px; filter: drop-shadow(3px 3px 0 var(--line)); }
.hm.dark .calling { filter: drop-shadow(3px 3px 0 #000); }
.calling:hover:not(.on) { filter: drop-shadow(3px 3px 0 var(--line)) brightness(1.08); }
.calling.on { border-image-source: var(--fr-gold); color: #1a1410; }
.calling.on .muted { color: #4d4030; }
.cpic { position: relative; display: block; line-height: 0; border: 2px solid var(--line); background: #1a1410; overflow: hidden; }
.cscene { width: 100%; aspect-ratio: 120 / 84; image-rendering: pixelated; }
.calling:not(.on) .cscene { filter: saturate(.5) brightness(.7); }
.cpick { position: absolute; left: 0; top: 0; padding: 3px 6px; background: #1a1410; color: #ffc233; line-height: 1; font: 700 12px/1 var(--display); font-stretch: condensed; letter-spacing: 1px; text-transform: uppercase; }
.cname { display: block; padding: 2px 2px 0; font: 700 16px/1 var(--display); font-stretch: condensed; letter-spacing: 2px; text-transform: uppercase; border-left: 6px solid var(--cc); padding-left: 7px; }
.cattrs { display: flex; gap: 10px; padding: 0 2px; }
.cattr { display: inline-flex; align-items: center; gap: 4px; } .cattr b { font-size: 16px; } .cattr small { font: 700 8px/1 var(--display); font-stretch: condensed; letter-spacing: 1px; text-transform: uppercase; opacity: .75; }
.cattr.might svg { color: #e5383b; } .cattr.grace svg { color: #2f9e4f; } .cattr.wit svg { color: #3a7bff; }
.calling .ds { padding: 0 2px; font-size: 12px; }
.namebar { flex-wrap: nowrap; } .namebar input { flex: 1; min-width: 0; font-size: 16px; } .namebar .btn { flex: none; }

/* log: a journal with a pixel mark per kind */
.log { background-image: repeating-linear-gradient(0deg, transparent 0 23px, color-mix(in srgb, var(--line) 10%, transparent) 23px 24px); }
.log .entry { border-bottom: 0; min-height: 24px; align-items: center; }
.log .lg { flex: none; width: 22px; height: 22px; display: grid; place-items: center; color: #1a1410; border: 2px solid var(--line); }
.log .entry.k-death .grow { color: var(--red); } .hm.dark .log .entry.k-death .grow { color: #ff8a8c; }
.log .entry.k-level .grow, .log .entry.k-boss .grow { font-weight: 700; }
/* narrow window, after the rules above it overrides: every tab fits the icon row, sockets keep their names */
@container win (max-width: 640px) {
  .nav button { display: flex; justify-content: center; align-items: center; flex: 1 1 0; min-width: 0; padding: 9px 0; }
  .nav .badge { position: absolute; right: 1px; top: 1px; margin: 0; min-width: 14px; height: 13px; line-height: 9px; }
  .sock { min-width: 84px; }
}
.portrait-frame { text-align: center; }
/* round 3: locks, marks, the relic codex, the forge's hone and bench */
.cell .lockb { position: absolute; left: -4px; top: -4px; width: 15px; height: 15px; display: grid; place-items: center; background: #1a1410; color: #ffc233; border: 1px solid #ffc233; z-index: 1; }
.cell.mark { outline: 3px dashed var(--ember); outline-offset: 1px; }
.cell.mark canvas { opacity: .55; }
.stash.codex .cell { cursor: default; }
.stash.codex .cell.relic { cursor: pointer; }
.cell.ghost, .cell.unknown { border-image-source: var(--fr-empty); }
.cell.ghost canvas { filter: grayscale(1) brightness(.75); opacity: .6; }
.cell.ghost .cnt { position: absolute; right: -2px; bottom: -3px; padding: 0 3px; background: #1a1410; color: #e6d9b8; font: 700 8px/12px var(--mono); }
.cell.unknown .q { font: 700 20px/1 var(--display); color: var(--muted); opacity: .6; }
.tools { gap: 6px; flex-wrap: wrap; }
.tag.q { background: var(--teal); color: #1a1410; } .tag.lk { background: #1a1410; color: #ffc233; border-color: #1a1410; display: inline-flex; align-items: center; gap: 3px; }
.aff.bench { color: var(--teal); } .hm.dark .aff.bench { color: #6fe0cf; }
.work { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; padding-top: 10px; border-top: 2px dashed color-mix(in srgb, var(--line) 50%, transparent); }
.work .wrow { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.work .wrow > b { min-width: 48px; font: 700 12px/1 var(--display); font-stretch: condensed; letter-spacing: 1px; text-transform: uppercase; }
.work select { flex: 1 1 140px; min-width: 0; }
.qbar { flex: 1 1 80px; height: 8px; border: 2px solid var(--line); background: var(--paper2); position: relative; }
.qbar i { position: absolute; inset: 0 auto 0 0; background: var(--teal); }
/* worn items in item lists: a gold frame and tag; hover links between the doll and the stash */
.cell.wornc::after { content: ""; position: absolute; inset: -6px; border: 2px solid #ffc233; box-shadow: 0 0 6px rgba(255,194,51,.55); pointer-events: none; }
.cell.wornc .worn { background: #ffc233; color: #1a1410; border: 1px solid #1a1410; z-index: 1; white-space: nowrap; }
.gridsep { grid-column: 1 / -1; display: flex; align-items: center; gap: 6px; padding: 4px 0 2px; font: 700 12px/1 var(--display); font-stretch: condensed; letter-spacing: 1px; text-transform: uppercase; color: var(--muted); }
.gridsep::after { content: ""; flex: 1; border-bottom: 2px dashed color-mix(in srgb, var(--line) 40%, transparent); }
.doll .cell.cmp { outline: 3px solid #ffc233; outline-offset: 1px; animation: cmpglow .9s ease-in-out infinite alternate; }
@keyframes cmpglow { from { outline-color: #ffc233; } to { outline-color: #ff8a3a; } }
.gear.slotpick .stash .cell[data-uid]:not(.fits) { opacity: .3; }
.gear.slotpick .stash .cell.fits { outline: 2px solid var(--teal); outline-offset: 1px; }
/* companions (Hero tab) */
.pet-now { display: flex; gap: 12px; align-items: center; margin-bottom: 10px; }
.pet-stage { flex: none; width: 104px; height: 104px; display: grid; place-items: end center; padding-bottom: 8px; border: 8px solid transparent; border-image: var(--fr-sunk) 8 fill / 8px; background: radial-gradient(ellipse at 50% 85%, rgba(255,194,51,.25), transparent 65%); }
.petart { image-rendering: pixelated; }
.pet-stage .petart { max-width: 84px; max-height: 84px; object-fit: contain; }
.pet-bonus { font-weight: 700; color: var(--teal); } .hm.dark .pet-bonus { color: #6fe0cf; }
.pet-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 6px; }
.pet { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 4px 2px 5px; min-width: 0; font: inherit; color: var(--text); text-align: center; cursor: pointer;
  border: 8px solid transparent; border-image: var(--fr-alt) 8 fill / 8px; }
.pet .pic { height: 40px; display: grid; place-items: end center; }
.pet .pic .petart { max-height: 40px; max-width: 64px; width: auto !important; height: auto !important; }
.pet b { font-size: 12px; line-height: 1.1; } .pet span:last-child { font-size: 11px; color: var(--muted); }
.pet.on { border-image-source: var(--fr-gold); color: #1a1410; cursor: default; } .pet.on span:last-child { color: #4d4030; }
.pet.unknown { cursor: default; opacity: .6; } .pet.unknown .q { font: 700 22px/1 var(--display); color: var(--muted); }
.pet:hover:not(.on):not(.unknown) { filter: brightness(1.08); }
.scout { margin-top: 4px; padding: 2px 6px; display: inline-block; font: 700 12px/1.3 var(--display); font-stretch: condensed; letter-spacing: 1px; text-transform: uppercase; border: 2px solid var(--line); }
.scout.ok { background: var(--green); color: #1a1410; } .scout.mid { background: var(--gold); color: #1a1410; } .scout.bad { background: var(--ember); color: #1a1410; }
.contracts { display: flex; flex-direction: column; gap: 6px; }
.contract { display: flex; align-items: center; gap: 10px; padding: 4px 6px; border: 8px solid transparent; border-image: var(--fr-alt) 8 fill / 8px; }
.contract.done { border-image-source: var(--fr-gold); color: #1a1410; }
.contract.done .muted { color: #4d4030; }
.contract .cg { flex: none; width: 26px; height: 26px; display: grid; place-items: center; background: #1a1410; color: #ffc233; border: 2px solid var(--line); }
.contract .meter { height: 14px; } .contract .meter i { background: var(--teal); } .contract.done .meter i { background: var(--gold); } .contract .meter span { font-size: 11px; line-height: 10px; }
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
    heart: [".##...##.", "####.####", "#########", "#########", ".#######.", "..#####..", "...###...", "....#....", "........."],
    esorb: ["..#####..", ".#.....#.", "#..##...#", "#.#.....#", "#.......#", "#.......#", "#.......#", ".#.....#.", "..#####.."],
    armour: ["##.....##", "###...###", "#########", "#########", ".#######.", ".###.###.", ".#######.", "..#####..", "...###..."],
    evasion: ["......###", "....####.", "...####..", "..####...", ".####....", "####.....", "###......", "##.......", "#........"],
    block: ["#########", "#.......#", "#.#####.#", "#.#####.#", "#.#####.#", ".#.###.#.", ".#.....#.", "..#...#..", "...###..."],
    regen: ["...###...", "...###...", "...###...", "#########", "#########", "#########", "...###...", "...###...", "...###..."],
    cold: ["....#....", ".#..#..#.", "..#.#.#..", "...###...", "#########", "...###...", "..#.#.#..", ".#..#..#.", "....#...."],
    lightning: [".....###.", "....###..", "...###...", "..######.", ".######..", "....##...", "...##....", "..##.....", ".##......"],
    chaos: ["..#####..", ".#######.", "##.###.##", "##.###.##", "#########", ".#######.", "..#.#.#..", "..#####..", "........."],
    might: [".##.##...", "#########", "#########", "#########", "#########", ".#######.", "..#####..", "..#####..", "..#####.."],
    grace: ["......##.", ".....###.", "....####.", "...####..", "..####...", ".####....", ".##......", "#........", "#........"],
    wit: [".........", "..#####..", ".#.....#.", "#..###..#", "#..#.#..#", "#..###..#", ".#.....#.", "..#####..", "........."],
    gem: ["....#....", "...###...", "..#####..", ".#######.", "#########", ".#######.", "..#####..", "...###...", "....#...."],
    gemshine: [".........", "...#.....", "..#......", ".#.......", ".........", ".........", ".........", ".........", "........."],
    lock: ["..###..", ".#...#.", ".#...#.", "#######", "###.###", "###.###", "#######"],
    socket: ["..#####..", ".#.....#.", "#.......#", "#.......#", "#.......#", "#.......#", "#.......#", ".#.....#.", "..#####.."],
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

  // src/ui/gfx/frames.ts
  var MAP = [
    "..kkkkkkkk..",
    ".kkkkkkkkkk.",
    "kkhhhhhhhhkk",
    "kkhffffffskk",
    "kkhffffffskk",
    "kkhffffffskk",
    "kkhffffffskk",
    "kkhffffffskk",
    "kkhffffffskk",
    "kksssssssskk",
    ".kkkkkkkkkk.",
    "..kkkkkkkk.."
  ];
  function draw(p) {
    const c = document.createElement("canvas");
    c.width = 24;
    c.height = 24;
    const g = c.getContext("2d");
    MAP.forEach((row, y) => [...row].forEach((ch, x) => {
      const col = p[ch];
      if (!col) return;
      g.fillStyle = col;
      g.fillRect(x * 2, y * 2, 2, 2);
    }));
    return `url("${c.toDataURL("image/png")}")`;
  }
  var RARITY_RING = {
    plain: ["#b9b2a6", "#6f685d"],
    enchanted: ["#8cc4ff", "#2f6fb8"],
    rare: ["#ffe27a", "#b88a00"],
    relic: ["#ffb055", "#b8560c"]
  };
  function frameVars(dark) {
    const ink = dark ? "#050403" : "#1a1410";
    const card = dark ? "#30271f" : "#fffaf0";
    const paper2 = dark ? "#2d241c" : "#ecd9b0";
    const vars = {
      "--fr-card": draw({ k: ink, h: dark ? "#43372c" : "#ffffff", s: dark ? "#241c16" : "#e6d6b3", f: card }),
      "--fr-sunk": draw({ k: ink, h: dark ? "#120e0b" : "#cdb88f", s: dark ? "#3a2f25" : "#fff6e0", f: dark ? "#1b1511" : "#efe1c1" }),
      "--fr-plaque": draw({ k: ink, h: "#3a2f25", s: "#000000", f: "#1a1410" }),
      "--fr-gold": draw({ k: ink, h: "#ffe89a", s: "#c48a00", f: "#ffc233" }),
      "--fr-ember": draw({ k: ink, h: "#ffa184", s: "#b8361c", f: "#ff5a36" }),
      "--fr-alt": draw({ k: ink, h: dark ? "#4a3d31" : "#ffffff", s: dark ? "#1e1712" : "#d9c79f", f: paper2 }),
      "--fr-teal": draw({ k: ink, h: "#7fe3d6", s: "#0f7a6e", f: "#19b3a3" })
    };
    for (const [r3, [h2, s]] of Object.entries(RARITY_RING)) vars[`--fr-${r3}`] = draw({ k: ink, h: h2, s, f: dark ? "#1b1511" : "#efe1c1" });
    vars["--fr-empty"] = draw({ k: ink, h: dark ? "#120e0b" : "#cdb88f", s: dark ? "#2a211a" : "#fff6e0", f: dark ? "#16110d" : "#e8d7b2" });
    return vars;
  }

  // src/ui/gfx/pix.ts
  var DRAWABLE = /^[A-Z0-9 .,:/%+\-!?'()~]+$/;
  var SELECTOR = "h3:not(.split), h3.split > span, .btn, .sec, .nav .lbl, .plaque";
  function pixText(text, colour, scale = 3, outline = "") {
    const src = textSprite(text.toUpperCase(), colour, outline);
    const c = document.createElement("canvas");
    c.width = src.width;
    c.height = src.height;
    c.getContext("2d").drawImage(src, 0, 0);
    c.className = "pxc";
    c.style.width = src.width * scale + "px";
    c.style.height = src.height * scale + "px";
    c.setAttribute("aria-hidden", "true");
    return c;
  }
  function pixelize(root) {
    for (const el of root.querySelectorAll(SELECTOR)) {
      if (el.dataset.px !== void 0) continue;
      el.dataset.px = "";
      if ([...el.childNodes].some((n) => n.nodeType === 1)) continue;
      const text = (el.textContent ?? "").trim().toUpperCase().replace(/\s+/g, " ");
      if (!text || !DRAWABLE.test(text)) continue;
      const colour = getComputedStyle(el).color || "#1a1410";
      const src = textSprite(text, colour, "");
      const c = document.createElement("canvas");
      c.width = src.width;
      c.height = src.height;
      c.getContext("2d").drawImage(src, 0, 0);
      c.className = "pxc";
      c.style.width = src.width * 2 + "px";
      c.style.height = src.height * 2 + "px";
      c.setAttribute("aria-hidden", "true");
      const sr = document.createElement("span");
      sr.className = "sr";
      sr.textContent = el.textContent ?? "";
      el.replaceChildren(c, sr);
    }
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
      if (d.dead) {
        drawText(g, "DEAD", 22, 17, "#ff8a8c", "center");
        drawText(g, `${Math.max(0, Math.ceil(d.respawn ?? 0))}S`, 22, 27, CREAM, "center");
      } else drawText(g, fmt(Math.floor(Math.max(0, d.life))), 22, 20, CREAM, "center");
      drawText(g, fmt(Math.floor(Math.max(0, d.mana))), W2 - 22, 20, CREAM, "center");
      if (!d.dead && d.esMax > 0 && d.es > 0) drawText(g, fmt(Math.floor(d.es)), 22, 30, "#bfe9ff", "center");
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
      if (on) {
        this.unlock();
        return;
      }
      if (this.master) {
        this.master.gain.cancelScheduledValues(0);
        this.master.gain.value = 0;
      }
      if (this.ctx?.state === "running") void this.ctx.suspend().catch(() => {
      });
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

  // src/ui/tips.ts
  function installTips(scope, layer) {
    let tip = null;
    let owner = null;
    let timer = 0;
    const hide = () => {
      clearTimeout(timer);
      tip?.remove();
      tip = null;
      owner = null;
    };
    const find = (t) => t instanceof Element ? t.closest("[title], [data-tip]") : null;
    const adopt = (el) => {
      const t = el.getAttribute("title");
      if (t !== null) {
        el.removeAttribute("title");
        if (t) {
          el.dataset.tip = t;
          if (!el.hasAttribute("aria-label")) el.setAttribute("aria-description", t);
        }
      }
      return el.dataset.tip ?? "";
    };
    const show = (el, delay) => {
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
        const lr = layer.getBoundingClientRect(), er = el.getBoundingClientRect();
        const w2 = tip.offsetWidth, h2 = tip.offsetHeight;
        const x = Math.max(4, Math.min(er.left - lr.left + er.width / 2 - w2 / 2, lr.width - w2 - 4));
        let y = er.bottom - lr.top + 6;
        if (y + h2 > lr.height - 4) y = er.top - lr.top - h2 - 6;
        tip.style.left = Math.round(x) + "px";
        tip.style.top = Math.round(Math.max(4, y)) + "px";
      }, delay);
    };
    scope.addEventListener("pointerover", (e2) => {
      const el = find(e2.target);
      if (el && scope.contains(el)) show(el, 380);
      else hide();
    });
    scope.addEventListener("pointerout", (e2) => {
      if (owner && !owner.contains(e2.relatedTarget)) hide();
    });
    scope.addEventListener("pointerdown", hide);
    scope.addEventListener("wheel", hide, { passive: true });
    scope.addEventListener("focusin", (e2) => {
      const t = e2.target;
      const el = find(t);
      if (el && t.matches(":focus-visible")) show(el, 200);
    });
    scope.addEventListener("focusout", hide);
    return { busy: () => !!owner && owner.isConnected };
  }

  // src/ui/gfx/font.gen.ts
  var PIXEL_FONT = "AAEAAAAKAIAAAwAgT1MvMmGcXKIAAACsAAAAYGNtYXAADACxAAABDAAAACxnbHlmaWmO/AAAATgAABvMaGVhZCjDYH4AAB0EAAAANmhoZWEGggLhAAAdPAAAACRobXR49YABAAAAHWAAAAGAbG9jYQAFZkgAAB7gAAABhG1heHAAbAAuAAAgZAAAACBuYW1lEJ0ovgAAIIQAAADwcG9zdP+DAIAAACF0AAAAIAAEAo8BkAAFAAACgAKAAAAAgAKAAoAAAAIAAIABgAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAABOT05FAEAAIAB+BAD/AAAABAABAAAAAAEAAAAAAoADgAAAACAAAQAAAAEAAwABAAAADAAEACAAAAAEAAQAAQAAAH7//wAAACD////hAAEAAAAAAAQAAAAAAgADgAADAAcACwAPAAAxNSEVATUhFQERMxEhETMRAgD+AAIA/gCAAQCAgIADAICA/YACgP2AAoD9gAACAAAAAACAA4AAAwAHAAARETMRAzUzFYCAgAEAAoD9gP8AgIAAAAAAAgAAAoABgAOAAAMABwAAEREzETMRMxGAgIACgAEA/wABAP8AAAAAAAgAAAAAAoADgAADAAcACwAPABMAFwAbAB8AABMRMxEzETMRBTUhFQU1MxUzNTMVBTUhFQERMxEzETMRgICAgP4AAoD+AICAgP4AAoD+AICAgAKAAQD/AAEA/wCAgICAgICAgICAgP8AAQD/AAEA/wAAAAAACQAAAAACgAOAAAMABwALAA8AEwAXABsAHwAjAAABNTMVBTUhFQU1MxUzNTMVBTUhFQU1MxUzNTMVBTUhFQU1MxUBAID/AAIA/YCAgID/AAGA/wCAgID9gAIA/wCAAwCAgICAgICAgICAgICAgICAgICAgICAgIAABwAAAAACgAOAAAMABwALAA8AEwAXABsAABERIRElNTMVAREzEQU1MxUBETMRFxEhESE1MxUBAAEAgP8AgP8AgP8AgIABAP2AgAKAAQD/AICAgP8AAQD/AICAgP8AAQD/AIABAP8AgIAAAAAACwAAAAACgAOAAAMABwALAA8AEwAXABsAHwAjACcAKwAAEzUhFQERMxElNTMVBTUzFQU1MxUBETMRNzUzFTM1MxUFNTMVBTUhFTM1MxWAAQD+gIABAID/AID/AID/AICAgICA/wCA/oABAICAAwCAgP8AAQD/AICAgICAgICAgP8AAQD/AICAgICAgICAgICAgIAAAAEAAAKAAIADgAADAAARETMRgAKAAQD/AAAAAAADAAAAAAEAA4AAAwAHAAsAABM1MxUBETMRFTUzFYCA/wCAgAMAgID9gAKA/YCAgIAAAAAAAwAAAAABAAOAAAMABwALAAARNTMVEREzEQU1MxWAgP8AgAMAgID9gAKA/YCAgIAACQAAAIACgAMAAAMABwALAA8AEwAXABsAHwAjAAARNTMVMzUzFTM1MxUFNSEVBTUhFQU1IRUFNTMVMzUzFTM1MxWAgICAgP4AAYD+AAKA/gABgP4AgICAgIACgICAgICAgICAgICAgICAgICAgICAgIAAAAADAAAAgAKAAwAAAwAHAAsAAAERMxEFNSEVAREzEQEAgP6AAoD+gIACAAEA/wCAgID/AAEA/wAAAAIAAAAAAQABgAADAAcAADcRMxEFNTMVgID/AICAAQD/AICAgAAAAAABAAABgAIAAgAAAwAAETUhFQIAAYCAgAABAAAAAAEAAQAAAwAAMREhEQEAAQD/AAAFAAAAAAKAA4AAAwAHAAsADwATAAABNTMVAREzEQU1MxUBETMRBTUzFQIAgP8AgP8AgP8AgP8AgAMAgID/AAEA/wCAgID/AAEA/wCAgIAAAAkAAAAAAoADgAADAAcACwAPABMAFwAbAB8AIwAAEzUhFQERMxEBNTMVBTUhFQU1MxUTETMRJTUhFQU1MxUVNSEVgAGA/gCAAYCA/wABAP6AgICA/YABAP8AgAGAAwCAgP6AAYD+gAEAgICAgICAgID/AAGA/oCAgICAgICAgIAABACAAAACAAOAAAMABwALAA8AAAE1MxUFNSEVAxEzEQU1IRUBAID/AAEAgID/AAGAAwCAgICAgP4AAgD+AICAgAAAAAAHAAAAAAKAA4AAAwAHAAsADwATABcAGwAAEzUhFQU1MxUFETMRBTUzFQU1MxUFNTMVBTUhFYABgP4AgAGAgP8AgP8AgP8AgP8AAoADAICAgICAgAEA/wCAgICAgICAgICAgIAABQAAAAACgAOAAAMABwALAA8AEwAAETUhFRERMxEFNSEVEREzEQU1IRUCAID+AAGAgP2AAgADAICA/wABAP8AgICA/wABAP8AgICAAAcAAAAAAoADgAADAAcACwAPABMAFwAbAAABNTMVBTUhFQU1MxUXETMRITUzFQc1IRUBETMRAYCA/wABAP6AgICA/gCAgAKA/wCAAwCAgICAgICAgIABAP8AgICAgID/AAEA/wAAAAAABgAAAAACgAOAAAMABwALAA8AEwAXAAARNSEVBTUzFQc1IRURETMRITUzFRU1IRUCgP2AgIACAID9gIABgAMAgICAgICAgID+gAGA/oCAgICAgAAABwAAAAACgAOAAAMABwALAA8AEwAXABsAAAE1IRUFNTMVBTUzFQc1IRUBETMRIREzEQU1IRUBAAEA/oCA/wCAgAIA/gCAAYCA/gABgAMAgICAgICAgICAgID/AAEA/wABAP8AgICAAAAFAAAAAAKAA4AAAwAHAAsADwATAAARNSEVBzUzFQU1MxUFNTMVAREzEQKAgID/AID/AID/AIADAICAgICAgICAgICA/oABgP6AAAAABwAAAAACgAOAAAMABwALAA8AEwAXABsAABM1IRUBETMRIREzEQU1IRUBETMRIREzEQU1IRWAAYD+AIABgID+AAGA/gCAAYCA/gABgAMAgID/AAEA/wABAP8AgICA/wABAP8AAQD/AICAgAAABwAAAAACgAOAAAMABwALAA8AEwAXABsAABM1IRUBETMRIREzEQU1IRUHNTMVBTUzFQU1IRWAAYD+AIABgID+AAIAgID/AID+gAEAAwCAgP8AAQD/AAEA/wCAgICAgICAgICAgIAAAAACAAAAgAEAAwAAAwAHAAARESERAREhEQEA/wABAAIAAQD/AP6AAQD/AAAAAAQAAAAAAQADAAADAAcACwAPAAARESERATUhFQc1MxUFNTMVAQD/AAEAgID/AIACAAEA/wD/AICAgICAgICAAAAHAAAAAAIAA4AAAwAHAAsADwATABcAGwAAATUzFQU1MxUFNTMVBTUzFRU1MxUVNTMVFTUzFQGAgP8AgP8AgP8AgICAgAMAgICAgICAgICAgICAgICAgICAgIAAAAIAAAEAAgACgAADAAcAABE1IRUBNSEVAgD+AAIAAgCAgP8AgIAAAAAHAAAAAAIAA4AAAwAHAAsADwATABcAGwAAETUzFRU1MxUVNTMVFTUzFQU1MxUFNTMVBTUzFYCAgID/AID/AID/AIADAICAgICAgICAgICAgICAgICAgICAAAAAAAYAAAAAAoADgAADAAcACwAPABMAFwAAEzUhFQU1MxUFETMRBTUzFQU1MxUDNTMVgAGA/gCAAYCA/wCA/wCAgIADAICAgICAgAEA/wCAgICAgID/AICAAAAIAAAAAAKAA4AAAwAHAAsADwATABcAGwAfAAATNSEVAREzEQE1MxUFNSEVBTUzFTM1MxUFNSEVATUhFYABgP4AgAGAgP6AAYD+gICAgP6AAYD+AAGAAwCAgP2AAoD9gAIAgICAgICAgICAgICAgP8AgIAAAAYAAAAAAoADgAADAAcACwAPABMAFwAAEzUhFQERMxEhETMRBTUhFQERMxEhETMRgAGA/gCAAYCA/YACgP2AgAGAgAMAgID/AAEA/wABAP8AgICA/oABgP6AAYD+gAAAAAcAAAAAAoADgAADAAcACwAPABMAFwAbAAARNSEVAREzESERMxEFNSEVAREzESERMxEFNSEVAgD+AIABgID9gAIA/gCAAYCA/YACAAMAgID/AAEA/wABAP8AgICA/wABAP8AAQD/AICAgAAAAAUAAAAAAoADgAADAAcACwAPABMAABM1IRUBETMRATUzFQM1MxUFNSEVgAGA/gCAAYCAgID+AAGAAwCAgP2AAoD9gAIAgID+AICAgICAAAAABgAAAAACgAOAAAMABwALAA8AEwAXAAARNSEVAREzEQE1MxURETMRBTUzFQU1IRUBgP6AgAEAgID/AID+AAGAAwCAgP2AAoD9gAIAgID+gAGA/oCAgICAgIAAAAAFAAAAAAKAA4AAAwAHAAsADwATAAARNSEVAREzEQc1IRUBETMRBzUhFQKA/YCAgAIA/gCAgAKAAwCAgP8AAQD/AICAgP8AAQD/AICAgAAAAAQAAAAAAoADgAADAAcACwAPAAARNSEVAREzEQc1IRUBETMRAoD9gICAAgD+AIADAICA/wABAP8AgICA/oABgP6AAAAABgAAAAACgAOAAAMABwALAA8AEwAXAAATNSEVAREzEQE1MxUBNSEVAxEzEQU1IRWAAYD+AIABgID+gAGAgID+AAIAAwCAgP2AAoD9gAIAgID/AICA/wABAP8AgICAAAAABQAAAAACgAOAAAMABwALAA8AEwAAEREzESERMxEFNSEVAREzESERMxGAAYCA/YACgP2AgAGAgAIAAYD+gAGA/oCAgID+gAGA/oABgP6AAAADAIAAAAIAA4AAAwAHAAsAABM1IRUBETMRBTUhFYABgP8AgP8AAYADAICA/YACgP2AgICAAAAAAAQAAAAAAoADgAADAAcACwAPAAABNSEVAREzESE1MxUVNSEVAQABgP8AgP4AgAEAAwCAgP2AAoD9gICAgICAAAAJAAAAAAKAA4AAAwAHAAsADwATABcAGwAfACMAABERMxEBNTMVBTUzFQU1MxUFNSEVAREzERM1MxUVNTMVFTUzFYABgID/AID/AID+gAEA/wCAgICAgAIAAYD+gAEAgICAgICAgICAgID+gAGA/oABAICAgICAgICAAAAAAgAAAAACgAOAAAMABwAANREzEQc1IRWAgAKAgAMA/QCAgIAABwAAAAACgAOAAAMABwALAA8AEwAXABsAABE1MxUhNTMVBTUhFTM1IRUBETMRExEzERMRMxGAAYCA/YABAIABAP2AgICAgIADAICAgICAgICAgP2AAoD9gAGAAQD/AP6AAoD9gAAAAAAHAAAAAAKAA4AAAwAHAAsADwATABcAGwAAEREzEQERMxElNSEVAREzERM1MxUVNSEVAxEzEYABgID9gAEA/wCAgIABAICAAoABAP8A/wACAP4AgICA/gACAP4AAYCAgICAgP8AAQD/AAAAAAAEAAAAAAKAA4AAAwAHAAsADwAAEzUhFQERMxEhETMRBTUhFYABgP4AgAGAgP4AAYADAICA/YACgP2AAoD9gICAgAAAAAUAAAAAAoADgAADAAcACwAPABMAABE1IRUBETMRIREzEQU1IRUBETMRAgD+AIABgID9gAIA/gCAAwCAgP8AAQD/AAEA/wCAgID+gAGA/oAABwAAAAACgAOAAAMABwALAA8AEwAXABsAABM1IRUBETMRJREzESE1MxUVNTMVBTUhFTM1MxWAAYD+AIABgID+gICA/oABAICAAwCAgP2AAoD9gIACAP4AgICAgICAgICAgAAAAAgAAAAAAoADgAADAAcACwAPABMAFwAbAB8AABE1IRUBETMRIREzEQU1IRUBETMREzUzFRU1MxUVNTMVAgD+AIABgID9gAIA/gCAgICAgAMAgID/AAEA/wABAP8AgICA/oABgP6AAQCAgICAgICAgAAFAAAAAAKAA4AAAwAHAAsADwATAAATNSEVAREzERU1IRURETMRBTUhFYACAP2AgAGAgP2AAgADAICA/wABAP8AgICA/wABAP8AgICAAAAAAAIAAAAAAoADgAADAAcAABE1IRUBETMRAoD+gIADAICA/QADAP0AAAADAAAAAAKAA4AAAwAHAAsAADURMxEhETMRBTUhFYABgID+AAGAgAMA/QADAP0AgICAAAAABQAAAAACgAOAAAMABwALAA8AEwAAEREzESERMxEFNTMVMzUzFQU1MxWAAYCA/gCAgID/AIABAAKA/YACgP2AgICAgICAgIAABQAAAAACgAOAAAMABwALAA8AEwAANREzESERMxEhETMRBTUzFTM1MxWAAYCA/oCA/wCAgICAAwD9AAMA/QABgP6AgICAgIAACQAAAAACgAOAAAMABwALAA8AEwAXABsAHwAjAAARETMRIREzEQU1MxUzNTMVBTUzFQU1MxUzNTMVAREzESERMxGAAYCA/gCAgID/AID/AICAgP4AgAGAgAKAAQD/AAEA/wCAgICAgICAgICAgICA/wABAP8AAQD/AAAAAAUAAAAAAoADgAADAAcACwAPABMAABERMxEhETMRBTUzFTM1MxUBETMRgAGAgP4AgICA/wCAAoABAP8AAQD/AICAgICA/gACAP4AAAAHAAAAAAKAA4AAAwAHAAsADwATABcAGwAAETUhFQc1MxUFNTMVBTUzFQU1MxUFNTMVBzUhFQKAgID/AID/AID/AID/AICAAoADAICAgICAgICAgICAgICAgICAgICAAAADAAAAAAEAA4AAAwAHAAsAABE1IRUBETMRBzUhFQEA/wCAgAEAAwCAgP2AAoD9gICAgAAABQAAAAACgAOAAAMABwALAA8AEwAAETUzFRERMxEVNTMVEREzERU1MxWAgICAgAMAgID/AAEA/wCAgID/AAEA/wCAgIAAAAAAAwAAAAABAAOAAAMABwALAAARNSEVAxEzEQU1IRUBAICA/wABAAMAgID9gAKA/YCAgIAAAAUAAAIAAoADgAADAAcACwAPABMAAAE1MxUFNTMVMzUzFQU1MxUhNTMVAQCA/wCAgID+AIABgIADAICAgICAgICAgICAgAAAAAEAAP+AAgAAAAADAAAVNSEVAgCAgIAAAAIAAAKAAQADgAADAAcAABE1MxUVNTMVgIADAICAgICAAAAAAAYAAAAAAgACgAADAAcACwAPABMAFwAAEzUhFRU1MxUFNSEVBTUzFSE1MxUFNSEVgAEAgP6AAYD+AIABAID+gAGAAgCAgICAgICAgICAgICAgICAAAUAAAAAAgADgAADAAcACwAPABMAABERMxEHNSEVAREzESERMxEFNSEVgIABgP6AgAEAgP4AAYACgAEA/wCAgID+gAGA/oABgP6AgICAAAAAAwAAAAACAAKAAAMABwALAAATNSEVAREzERU1IRWAAYD+AIABgAIAgID+gAGA/oCAgIAAAAUAAAAAAgADgAADAAcACwAPABMAAAERMxEFNSEVAREzESERMxEFNSEVAYCA/oABgP4AgAEAgP6AAYACgAEA/wCAgID+gAGA/oABgP6AgICAAAAAAAYAAAAAAgACgAADAAcACwAPABMAFwAAEzUhFQU1MxUhNTMVBTUhFQU1MxUVNSEVgAEA/oCAAQCA/gACAP4AgAGAAgCAgICAgICAgICAgICAgICAAAQAAAAAAYADgAADAAcACwAPAAATNSEVBTUzFQc1IRUBETMRgAEA/oCAgAGA/oCAAwCAgICAgICAgP4AAgD+AAAGAAD/AAIAAoAAAwAHAAsADwATABcAABM1IRUBETMRIREzEQU1IRUHNTMVBTUhFYABgP4AgAEAgP6AAYCAgP6AAQACAICA/oABgP6AAYD+gICAgICAgICAgAAAAAQAAAAAAgADgAADAAcACwAPAAARETMRBzUhFQERMxEhETMRgIABgP6AgAEAgAKAAQD/AICAgP4AAgD+AAIA/gAAAAAAAgAAAAAAgAOAAAMABwAAETUzFQMRMxGAgIADAICA/QACgP2AAAAAAAMAAP8AAYADgAADAAcACwAAATUzFQMRMxEFNSEVAQCAgID+gAEAAwCAgPyAAwD9AICAgAAHAAAAAAIAA4AAAwAHAAsADwATABcAGwAAEREzESU1MxUFNTMVBTUhFQERMxE3NTMVFTUzFYABAID/AID+gAEA/wCAgICAAYACAP4AgICAgICAgICA/wABAP8AgICAgICAAAAAAgAAAAABAAOAAAMABwAANREzERU1MxWAgIADAP0AgICAAAAABQAAAAACgAKAAAMABwALAA8AEwAAETUhFTM1MxUBETMRMxEzETMRMxEBAICA/gCAgICAgAIAgICAgP4AAgD+AAIA/gACAP4AAAAAAAMAAAAAAgACgAADAAcACwAAETUhFQERMxEhETMRAYD+gIABAIACAICA/gACAP4AAgD+AAAEAAAAAAIAAoAAAwAHAAsADwAAEzUhFQERMxEhETMRBTUhFYABAP6AgAEAgP6AAQACAICA/oABgP6AAYD+gICAgAAAAAUAAP8AAgACgAADAAcACwAPABMAABE1IRUBETMRIREzEQU1IRUBETMRAYD+gIABAID+AAGA/oCAAgCAgP6AAYD+gAGA/oCAgID/AAEA/wAABQAA/wACAAKAAAMABwALAA8AEwAAEzUhFQERMxEhETMRBTUhFQMRMxGAAYD+AIABAID+gAGAgIACAICA/oABgP6AAYD+gICAgP8AAQD/AAAEAAAAAAIAAoAAAwAHAAsADwAAETUzFTM1IRUFNSEVAREzEYCAAQD+AAEA/wCAAgCAgICAgICA/oABgP6AAAAABQAAAAACAAKAAAMABwALAA8AEwAAEzUhFQU1MxUVNSEVFTUzFQU1IRWAAYD+AIABAID+AAGAAgCAgICAgICAgICAgICAgAAABAAAAAABgAMAAAMABwALAA8AABM1MxUFNSEVAREzERU1MxWAgP8AAYD/AICAAoCAgICAgP6AAYD+gICAgAAAAAMAAAAAAgACgAADAAcACwAANREzESERMxEFNSEVgAEAgP6AAYCAAgD+AAIA/gCAgIAAAAAFAAAAAAKAAoAAAwAHAAsADwATAAARETMRIREzEQU1MxUzNTMVBTUzFYABgID+AICAgP8AgAEAAYD+gAGA/oCAgICAgICAgAAFAAAAAAKAAoAAAwAHAAsADwATAAA1ETMRIREzESERMxEFNTMVMzUzFYABgID+gID/AICAgIACAP4AAgD+AAEA/wCAgICAgAAFAAAAAAIAAoAAAwAHAAsADwATAAARETMRIREzEQU1IRUBETMRIREzEYABAID+gAEA/oCAAQCAAYABAP8AAQD/AICAgP8AAQD/AAEA/wAAAAUAAP8AAgACgAADAAcACwAPABMAADURMxEhETMRBTUhFQc1MxUFNSEVgAEAgP6AAYCAgP6AAQCAAgD+AAIA/gCAgICAgICAgIAAAAAFAAAAAAIAAoAAAwAHAAsADwATAAARNSEVBzUzFQU1IRUFNTMVBzUhFQIAgID+gAEA/oCAgAIAAgCAgICAgICAgICAgICAgAAFAAAAAAGAA4AAAwAHAAsADwATAAABNTMVAREzEQU1MxURETMRFTUzFQEAgP8AgP8AgICAAwCAgP8AAQD/AICAgP8AAQD/AICAgAAAAQAA/4AAgAOAAAMAABURMxGAgAQA/AAABQAAAAABgAOAAAMABwALAA8AEwAAETUzFRERMxEVNTMVAREzEQU1MxWAgID/AID/AIADAICA/wABAP8AgICA/wABAP8AgICAAAAAAAQAAAGAAoACgAADAAcACwAPAAATNTMVITUzFQU1MxUzNSEVgIABAID9gICAAQACAICAgICAgICAgAAAAAEAAAABAACkxe+1Xw889QALBAAAAAAA45IOgAAAAADjkg6AAAD/AAKAA4AAAAAIAAIAAQAAAAAAAQAABAD/AAAAAwAAAACAAoAAAQAAAAAAAAAAAAAAAAAAAGACgAAAAYAAAAEAAAACAAAAAwAAAAMAAAADAAAAAwAAAAEAAAABgAAAAYAAAAMAAAADAAAAAYAAAAKAAAABgAAAAwAAAAMAAAADAACAAwAAAAMAAAADAAAAAwAAAAMAAAADAAAAAwAAAAMAAAABgAAAAYAAAAKAAAACgAAAAoAAAAMAAAADAAAAAwAAAAMAAAADAAAAAwAAAAMAAAADAAAAAwAAAAMAAAADAACAAwAAAAMAAAADAAAAAwAAAAMAAAADAAAAAwAAAAMAAAADAAAAAwAAAAMAAAADAAAAAwAAAAMAAAADAAAAAwAAAAMAAAABgAAAAwAAAAGAAAADAAAAAoAAAAGAAAACgAAAAoAAAAKAAAACgAAAAoAAAAIAAAACgAAAAoAAAAEAAAACAAAAAoAAAAGAAAADAAAAAoAAAAKAAAACgAAAAoAAAAKAAAACgAAAAgAAAAKAAAADAAAAAwAAAAKAAAACgAAAAoAAAAIAAAABAAAAAgAAAAMAAAAAAAAAAAAAQAAAAEAAAABoAAAAkAAAAQQAAAF8AAAB6AAAAnwAAAKYAAACzAAAAvwAAANwAAADqAAAA9AAAAPoAAAEAAAABFAAAATQAAAFFAAABXgAAAXEAAAGLAAABoAAAAboAAAHNAAAB6AAAAgIAAAINAAACHQAAAjQAAAI+AAACVQAAAmsAAAKIAAACoAAAArsAAALPAAAC5gAAAvoAAAMLAAADIwAAAzcAAANFAAADVQAAA3QAAAN9AAADlwAAA7IAAAPDAAAD1wAAA/AAAAQMAAAEIAAABCoAAAQ3AAAESQAABFsAAAR6AAAEjQAABKUAAASyAAAExAAABNEAAATjAAAE6QAABPIAAAUHAAAFGwAABSgAAAU9AAAFUgAABWIAAAV5AAAFigAABZQAAAWhAAAFugAABcMAAAXWAAAF4wAABfQAAAYIAAAGHAAABiwAAAY+AAAGTgAABlsAAAZtAAAGfwAABpMAAAamAAAGuAAABssAAAbRAAAG5AAABvMAAEAAABgACwACwAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAGAE4AAwABBAkAAQAYAAAAAwABBAkAAgAOABgAAwABBAkAAwAoACYAAwABBAkABAAYAE4AAwABBAkABQAWAGYAAwABBAkABgAmAHwASABvAGwAbABvAHcAIABQAGkAeABlAGwAUgBlAGcAdQBsAGEAcgBIAG8AbABsAG8AdwAgAFAAaQB4AGUAbAAgAFIAZQBnAHUAbABhAHIASABvAGwAbABvAHcAIABQAGkAeABlAGwAVgBlAHIAcwBpAG8AbgAgADEALgAwAEgAbwBsAGwAbwB3AFAAaQB4AGUAbAAtAFIAZQBnAHUAbABhAHIAAwAAAAAAAP+AAIAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";

  // src/ui/gfx/webfont.ts
  var PIXEL_FAMILY = "Hollow Pixel";
  var loading2 = null;
  function loadPixelFont() {
    return loading2 ??= (async () => {
      try {
        let have = false;
        document.fonts.forEach((f) => {
          if (f.family.replace(/"/g, "") === PIXEL_FAMILY) have = true;
        });
        if (have) return true;
        const bytes = Uint8Array.from(atob(PIXEL_FONT), (c) => c.charCodeAt(0));
        const face = new FontFace(PIXEL_FAMILY, bytes.buffer, { weight: "100 900" });
        await face.load();
        document.fonts.add(face);
        return true;
      } catch (e2) {
        console.warn("[Hollowmarch] pixel font unavailable, using system fonts:", e2);
        return false;
      }
    })();
  }

  // src/ui/gfx/itemart.ts
  function iconName(item) {
    const b = baseOf(item);
    const family = b.slot === "helmet" || b.slot === "body" ? `${b.slot}.${b.kind}` : b.slot === "gloves" || b.slot === "boots" || b.slot === "amulet" || b.slot === "ring" ? b.slot : b.kind;
    let tier = 0;
    for (let i = 0; i < TIER_LEVELS.length; i++) if (b.level >= TIER_LEVELS[i]) tier = i;
    for (let v = Math.floor(tier / 2); v >= 0; v--) if (spriteOf(`ico.${family}.${v}`)) return `ico.${family}.${v}`;
    return null;
  }
  function itemIcon(item) {
    const name = iconName(item);
    const c = name ? spriteCanvas(name) : null;
    if (c) {
      c.classList.add("ic");
      return c;
    }
    const b = baseOf(item);
    return iconFor(b.kind, b.slot);
  }

  // src/ui/gfx/portrait.ts
  var cache4 = /* @__PURE__ */ new Map();
  function paint(zone, w2, h2, cls) {
    const c = document.createElement("canvas");
    c.width = w2;
    c.height = h2;
    const g = c.getContext("2d");
    g.imageSmoothingEnabled = false;
    const G2 = h2 - Math.max(6, Math.round(h2 * 0.12));
    const set = setFor(zone.id, zone.name);
    g.fillStyle = set.sky;
    g.fillRect(0, 0, w2, h2);
    set.layers.forEach((l, i) => tileLayer(g, l.sprite, w2, G2 + (l.drop ?? 0), 40 + i * 37 + zone.id.length * 13 % 60));
    g.globalAlpha = 0.12;
    g.fillStyle = zone.palette[0];
    g.fillRect(0, 0, w2, G2);
    g.globalAlpha = 1;
    g.fillStyle = set.ground;
    g.fillRect(0, G2, w2, h2 - G2);
    g.fillStyle = set.edge;
    g.fillRect(0, G2, w2, 1);
    g.fillStyle = "#111";
    g.fillRect(0, G2 + 1, w2, 1);
    const hc = cls ? HERO_CAST[cls] : null;
    if (hc && spriteOf(hc.idle)) {
      g.fillStyle = "rgba(0,0,0,.35)";
      g.beginPath();
      g.ellipse(w2 / 2, G2, 14, 3, 0, 0, Math.PI * 2);
      g.fill();
      drawSprite(g, hc.idle, 0, Math.round(w2 / 2), G2);
    }
    return c;
  }
  function copy(src) {
    const c = document.createElement("canvas");
    c.width = src.width;
    c.height = src.height;
    c.getContext("2d").drawImage(src, 0, 0);
    return c;
  }
  function portrait(zone, cls, w2 = 150, h2 = 112) {
    return paint(zone, w2, h2, cls);
  }
  function scenery(zone, w2, h2) {
    const key = `${zone.id}|${zone.name}|${w2}x${h2}`;
    let c = cache4.get(key);
    if (!c) {
      c = paint(zone, w2, h2, null);
      if (spriteOf(setFor(zone.id, zone.name).layers[0].sprite)) cache4.set(key, c);
    }
    return copy(c);
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

  // src/ui/forge.ts
  var SLOT_NAMES = { weapon: "Weapon", offhand: "Off-hand", helmet: "Helm", body: "Body", gloves: "Gloves", boots: "Boots", belt: "Belt", amulet: "Amulet", ring1: "Ring", ring2: "Ring 2" };
  var forgeOpts = { until: false };
  function forgeView(c) {
    const st = c.state;
    const rack = h("div", { class: "stash" });
    const cellFor = (it) => {
      const cell = h("div", {
        class: `cell ${it.rarity}${c.sel.uid === it.uid ? " sel" : ""}`,
        attrs: { "aria-label": itemLabel(it), role: "button", tabindex: "0" },
        on: { click: () => {
          c.sel = { uid: it.uid };
          c.rerender();
        } }
      }, itemIcon(it));
      withTip(cell, c, () => itemCard(it, null));
      if (it.locked) cell.append(h("span", { class: "lockb", attrs: { "aria-hidden": "true" } }, glyph("lock", 9)));
      return cell;
    };
    const group = (label, list9, worn = false) => {
      if (!list9.length) return;
      rack.append(h("div", { class: "gridsep", text: `${label} (${list9.length})` }));
      for (const it of list9) {
        const cell = cellFor(it);
        if (worn) markWorn(cell, SLOTS.find((s) => st.hero.equipment[s] === it));
        rack.append(cell);
      }
    };
    group("Worn", SLOTS.map((s) => st.hero.equipment[s]).filter((x) => !!x), true);
    group("Stash", st.stash);
    group("Relic case", st.relics);
    const found = c.sel.uid !== void 0 ? findItem2(st, c.sel.uid) : null;
    const inStash = !!found && !found.slot;
    const anvil = h("div", { class: "card anvilcard" }, h("h3", { text: "On the anvil" }));
    if (found) {
      const it = found.item;
      const big = itemIcon(it);
      big.classList.add("anvil-art");
      anvil.append(h("div", { class: `anvil-plate ${it.rarity}` }, big), itemCard(it, null));
      const work = h("div", { class: "work" });
      const hc = honeCost(it);
      const q = it.quality ?? 0;
      const canHone = hc !== null || q >= MAX_QUALITY;
      if (canHone) work.append(h(
        "div",
        { class: "wrow" },
        h("b", { text: "Hone" }),
        h("div", { class: "qbar", title: `${q}% / ${MAX_QUALITY}% quality` }, h("i", { style: `width:${q / MAX_QUALITY * 100}%` })),
        h("span", { class: "num", text: `${q}%` }),
        h("button", {
          class: "btn small",
          text: hc === null ? "Max" : `+1% for ${fmt(hc)}`,
          attrs: { "data-key": "h", ...hc === null || st.dust < hc ? { disabled: "" } : {} },
          title: hc === null ? "Fully honed" : `Each point of quality is 1% increased ${baseOf(it).weapon ? "physical damage" : "defences"} on the item itself (H)`,
          on: { click: () => c.act((s) => hone(s, it.uid)) }
        })
      ));
      const opts = benchOptions(it);
      if (it.rarity === "enchanted" || it.rarity === "rare") {
        const pick = h("select", { attrs: { "aria-label": "Affix to add at the bench" } });
        const benched = it.affixes.find((a) => a.bench);
        for (const a of opts.sort((x, y) => x.type === y.type ? x.text.localeCompare(y.text) : x.type === "prefix" ? -1 : 1)) {
          pick.append(h("option", { text: `${a.type === "prefix" ? "P" : "S"}: ${a.text.replace(/\{\d\}/g, "#")}`, attrs: { value: a.id } }));
        }
        const dust2 = benchDust(it), grafts = st.currency.graft ?? 0;
        const ok = opts.length > 0 && grafts >= BENCH_GRAFTS && st.dust >= dust2;
        work.append(h(
          "div",
          { class: "wrow" },
          h("b", { text: "Bench" }),
          opts.length ? pick : h("span", { class: "muted grow", text: "No room for another affix." }),
          h("button", {
            class: "btn small",
            text: `${benched ? "Replace" : "Add"}: ${BENCH_GRAFTS} Graft + ${fmt(dust2)}`,
            attrs: ok ? {} : { disabled: "" },
            title: `Adds the chosen affix at a random tier the item level allows.${benched ? " Replaces the affix benched before." : ""} You have ${grafts} Graft.`,
            on: { click: () => c.act((s) => benchCraft(s, it.uid, pick.value), "Benched") }
          })
        ));
      }
      work.append(h(
        "div",
        { class: "wrow" },
        h("b", { text: "Keep" }),
        h("span", { class: "muted grow", style: "font-size:12px", text: it.locked ? "Locked: upkeep and bulk salvage leave it alone." : "Unlocked: upkeep may swap it for a better drop." }),
        h("button", { class: "btn alt small", text: it.locked ? "Unlock" : "Lock", attrs: { "data-key": "l" }, on: { click: () => c.act((s) => setLocked(s, it.uid, !it.locked)) } })
      ));
      anvil.append(work);
    } else anvil.append(h("div", { class: "anvil-plate empty" }, glyph("forge", 44)), h("div", { class: "muted", style: "text-align:center", text: "Pick an item from the rack to work on it." }));
    const shelf = h("div", { class: "shelf" });
    for (const id of CURRENCY_ORDER) {
      const def2 = CURRENCIES[id];
      const have = st.currency[id] ?? 0;
      const art = spriteCanvas(`cur.${id}`) ?? h("span", { style: `display:block;width:24px;height:24px;background:${def2.color};border:2px solid #111` });
      const reroll = REROLLS.includes(id);
      const buy = (e2) => {
        const n = e2.shiftKey ? 10 : 1;
        c.act((s) => buyCurrency(s, id, n), n > 1 ? `Bought ${n} ${def2.name}` : void 0);
      };
      shelf.append(h(
        "div",
        { class: `cur${have ? "" : " none"}` },
        h("div", { class: "orb" }, art, h("span", { class: "count num", text: have > 999 ? "999+" : String(have) })),
        h("div", { class: "grow" }, h("b", { text: def2.name }), h("span", { text: def2.blurb })),
        h(
          "div",
          { class: "col", style: "gap:4px" },
          h("button", {
            class: "btn small",
            text: "Use",
            attrs: have > 0 && found ? {} : { disabled: "" },
            title: found ? `Use on ${itemLabel(found.item)}` : "Pick an item first",
            on: { click: () => c.act((s) => applyCurrency(s, id, c.sel.uid), `${def2.name} used`) }
          }),
          reroll ? h("button", {
            class: "btn small",
            text: "Until upgrade",
            attrs: have > 0 && inStash ? {} : { disabled: "" },
            title: inStash ? `Use ${def2.name} again and again (up to 20) until ${itemLabel(found.item)} beats what you wear` : "Pick a stash item first",
            on: { click: () => c.act((s) => {
              const r3 = craftUntilUpgrade(s, id, c.sel.uid, 20);
              if (!r3.err) c.toast(r3.upgrade ? `Upgrade after ${r3.used} ${def2.name}` : `No upgrade after ${r3.used} ${def2.name}`);
              return r3.err;
            }) }
          }) : null,
          h("button", {
            class: "btn alt small",
            text: `Buy ${def2.cost}`,
            title: `Costs ${def2.cost} ember dust; shift-click buys 10`,
            attrs: st.dust >= def2.cost ? {} : { disabled: "" },
            on: { click: buy }
          })
        )
      ));
    }
    const cost = forgeCost(st);
    const smith = h("div", { class: "smith" });
    for (const slot of SLOTS) {
      smith.append(h("button", {
        class: "btn alt small",
        text: SLOT_NAMES[slot],
        title: st.dust >= cost ? forgeOpts.until ? `Forge rares for the ${SLOT_NAMES[slot].toLowerCase()} slot until one beats what you wear (up to 10 at ${fmt(cost)} dust each; misses are salvaged)` : `Forge a rare ${SLOT_NAMES[slot].toLowerCase()} for ${fmt(cost)} dust` : `Needs ${fmt(cost)} ember dust`,
        attrs: st.dust >= cost ? {} : { disabled: "" },
        on: { click: () => c.act((s) => {
          if (forgeOpts.until) {
            const r4 = forgeUntilUpgrade(s, slot, 10);
            if (!r4.err) c.toast(r4.item ? `Forged ${r4.made}: wearing ${itemLabel(r4.item)}` : `Forged ${r4.made}, none better than what you wear`);
            return r4.err;
          }
          const r3 = forgeRare(s, slot);
          if (!r3.err && r3.item) c.sel = { uid: r3.item.uid };
          return r3.err;
        }, forgeOpts.until ? void 0 : "Forged a rare") }
      }));
    }
    const until = h(
      "button",
      { class: `toggle${forgeOpts.until ? " on" : ""}`, attrs: { role: "switch", "aria-checked": String(forgeOpts.until) }, on: { click: () => {
        forgeOpts.until = !forgeOpts.until;
        c.rerender();
      } } },
      h("i"),
      h("span", null, h("b", { text: "Until upgrade" }), h("small", { text: "Up to 10 rares, stop at the first worth wearing; misses become dust." }))
    );
    const dust = h("div", { class: "dust" }, glyph("forge", 20), h("b", { class: "num", text: fmt(st.dust) }), h("span", { text: "ember dust" }));
    return h(
      "div",
      { class: "col", style: "gap:14px" },
      h(
        "div",
        { class: "card" },
        h("h3", { class: "split" }, h("span", { text: "Forge a rare" }), h("span", { class: "num", text: `${fmt(cost)} dust / item level ${maxIlvl(st)}` })),
        h(
          "div",
          { class: "row", style: "align-items:center;gap:12px" },
          dust,
          h("div", { class: "muted grow", style: "font-size:12px", text: "A random rare for the slot at the highest item level you have reached. Upgrades are worn at once. Currency drops from champions and bosses; the shelf sells it for dust." }),
          until
        ),
        smith,
        st.dust < cost ? h(
          "div",
          { class: "note", style: "margin-top:10px" },
          glyph("forge", 16),
          h("span", { text: `${fmt(cost - st.dust)} more ember dust for a rare. Salvaging drops on the Gear tab (or a loot rule that salvages) makes dust.` })
        ) : null
      ),
      h(
        "div",
        { class: "smithy" },
        h("div", { class: "card" }, h("h3", { text: "Rack" }), rack),
        anvil,
        h("div", { class: "card" }, h("h3", { text: "Currency" }), shelf)
      )
    );
  }

  // src/ui/tree.ts
  var cam = { x: 0, y: 0, z: 0.55, centred: "" };
  var STARS = (() => {
    let seed = 7;
    const r3 = () => (seed = seed * 1103515245 + 12345 >>> 0) / 4294967296;
    return Array.from({ length: 260 }, () => [r3() * 3200 - 1600, r3() * 2400 - 1200, r3()]);
  })();
  function treeView(c) {
    const hero = c.state.hero;
    const canvas = h("canvas", { class: "treecv", style: "width:100%;height:460px;display:block;cursor:grab;touch-action:none" });
    const info = h("div", { class: "card treepop", attrs: { hidden: "", role: "status" } });
    const wrap2 = h("div", { class: "treewrap" }, canvas, info);
    const pts = pointsLeft(hero);
    const head = h(
      "div",
      { class: "row" },
      h("span", { class: `tag${pts > 0 ? " gold" : ""}`, text: `${pts} point${pts === 1 ? "" : "s"} left` }),
      h("span", { class: "tag", text: `${hero.passives.length} taken` }),
      h("span", { class: "muted", style: "font-size:12px", text: "Drag to pan, wheel to zoom. Click a lit node to take it, any node to pin its card." }),
      h("span", { class: "grow" }),
      h("button", { class: "btn alt", text: "-", on: { click: () => zoom(0.8) } }),
      h("button", { class: "btn alt", text: "+", on: { click: () => zoom(1.25) } }),
      h("button", { class: "btn alt", text: "Centre", on: { click: () => {
        cam.centred = "";
        centre();
        draw2();
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
    function draw2() {
      const dpr = window.devicePixelRatio || 1;
      const w2 = canvas.clientWidth || 600, hh = canvas.clientHeight || 460;
      if (canvas.width !== Math.round(w2 * dpr)) {
        canvas.width = Math.round(w2 * dpr);
        canvas.height = Math.round(hh * dpr);
      }
      const g = canvas.getContext("2d");
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.imageSmoothingEnabled = false;
      g.fillStyle = "#120e0b";
      g.fillRect(0, 0, w2, hh);
      for (const [sx, sy, b] of STARS) {
        const x = Math.round(w2 / 2 + (sx + cam.x * 0.5) * cam.z * 0.8), y = Math.round(hh / 2 + (sy + cam.y * 0.5) * cam.z * 0.8);
        if (x < 0 || y < 0 || x > w2 || y > hh) continue;
        g.fillStyle = b > 0.8 ? "#fff0b8" : b > 0.5 ? "#8a7a64" : "#4a3d31";
        g.fillRect(x, y, b > 0.9 ? 2 : 1, b > 0.9 ? 2 : 1);
      }
      for (const n of Object.values(PASSIVES)) {
        const [x1, y1] = toScreen(n, w2, hh);
        for (const l of n.links) {
          if (l < n.id) continue;
          const m4 = PASSIVES[l];
          const [x2, y2] = toScreen(m4, w2, hh);
          const on = (taken.has(n.id) || n.id === start.id) && (taken.has(l) || l === start.id);
          g.lineCap = "square";
          g.strokeStyle = on ? "#ff5a36" : "#3a2f25";
          g.lineWidth = on ? 6 : 4;
          g.beginPath();
          g.moveTo(x1, y1);
          g.lineTo(x2, y2);
          g.stroke();
          if (on) {
            g.strokeStyle = "#ffc233";
            g.lineWidth = 2;
            g.beginPath();
            g.moveTo(x1, y1);
            g.lineTo(x2, y2);
            g.stroke();
          }
        }
      }
      const gem = (x, y, r3, fill, edge) => {
        r3 = Math.round(r3);
        x = Math.round(x);
        y = Math.round(y);
        g.fillStyle = edge;
        for (let i = -r3 - 2; i <= r3 + 2; i++) {
          const span = r3 + 2 - Math.abs(i);
          g.fillRect(x - span, y + i, span * 2 + 1, 1);
        }
        g.fillStyle = fill;
        for (let i = -r3; i <= r3; i++) {
          const span = r3 - Math.abs(i);
          g.fillRect(x - span, y + i, span * 2 + 1, 1);
        }
        g.fillStyle = "rgba(255,255,255,.55)";
        g.fillRect(x - Math.round(r3 / 2), y - Math.round(r3 / 2), Math.max(1, Math.round(r3 / 3)), Math.max(1, Math.round(r3 / 3)));
      };
      for (const n of Object.values(PASSIVES)) {
        const [x, y] = toScreen(n, w2, hh);
        if (x < -30 || y < -30 || x > w2 + 30 || y > hh + 30) continue;
        const r3 = radius(n);
        const own = taken.has(n.id) || n.id === start.id;
        const open = isOpen(n);
        let fill = own ? "#ffc233" : open ? "#f3e7d3" : "#4a3d31";
        if (n.kind === "keystone") fill = own ? "#ff5a36" : open ? "#ffb3a3" : "#5a3328";
        if (n.kind === "notable" && !own) fill = open ? "#c9b6ff" : "#3d3052";
        if (open && !own) gem(x, y, r3 + 3, "rgba(255,194,51,.25)", "rgba(255,194,51,.12)");
        gem(x, y, r3, fill, "#000000");
        if (n.kind === "ring" && !own) {
          g.fillStyle = "#19b3a3";
          g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
        }
        if (n.kind === "start") gem(x, y, r3 * 0.5, n.cls === hero.cls ? "#ff5a36" : "#6b5d4b", "#000000");
        if (n === hover || n === selected) {
          g.strokeStyle = "#ff5a36";
          g.lineWidth = 2;
          g.strokeRect(Math.round(x - r3 - 6), Math.round(y - r3 - 6), Math.round(2 * r3 + 12), Math.round(2 * r3 + 12));
        }
        if ((n.kind === "notable" || n.kind === "keystone" || n.kind === "start") && cam.z > 0.45) {
          const label = n.kind === "start" ? (n.cls ?? "").toUpperCase() : n.name.toUpperCase();
          const t = textSprite(label, own ? "#ffc233" : "#e6d9b8", "#000000");
          g.drawImage(t, Math.round(x - t.width), Math.round(y + r3 + 6), t.width * 2, t.height * 2);
        }
      }
    }
    function showInfo(n) {
      info.replaceChildren();
      info.hidden = !n;
      if (!n) return;
      const pinned = n === selected;
      info.classList.toggle("pinned", pinned);
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
      if (pinned) info.append(row);
      else if (!own && n.kind !== "start") info.append(h("div", { class: "muted", style: "margin-top:4px;font-size:12px", text: canAllocate(hero, n.id) ?? "Click to take it." }));
      else if (own) info.append(h("div", { class: "muted", style: "margin-top:4px;font-size:12px", text: "Click to pin it (refund)." }));
      pixelize(info);
      place(n);
    }
    function place(n) {
      const w2 = canvas.clientWidth, hh = canvas.clientHeight;
      const [x, y] = toScreen(n, w2, hh);
      const r3 = radius(n) + 14, bw = info.offsetWidth, bh = info.offsetHeight, pad = canvas.clientLeft + 6;
      let left = x + r3 + pad;
      if (left + bw > w2 - 4) left = x - r3 - bw + pad;
      left = Math.max(pad, Math.min(left, w2 - bw));
      const top = Math.max(pad, Math.min(y - bh / 2 + pad, hh - bh));
      info.style.left = Math.round(left) + "px";
      info.style.top = Math.round(top) + "px";
    }
    const pick = (ev) => {
      const rect = canvas.getBoundingClientRect();
      const mx = ev.clientX - rect.left - canvas.clientLeft, my = ev.clientY - rect.top - canvas.clientTop;
      let best = null, bd = Infinity;
      for (const n of Object.values(PASSIVES)) {
        const [x, y] = toScreen(n, canvas.clientWidth, canvas.clientHeight);
        const d = Math.hypot(x - mx, y - my);
        if (d < radius(n) + 6 && d < bd) {
          best = n;
          bd = d;
        }
      }
      return best;
    };
    let drag2 = null;
    canvas.addEventListener("pointerdown", (e2) => {
      drag2 = { x: e2.clientX, y: e2.clientY, moved: 0 };
      canvas.setPointerCapture(e2.pointerId);
      canvas.style.cursor = "grabbing";
    });
    canvas.addEventListener("pointermove", (e2) => {
      if (drag2) {
        const dx = e2.clientX - drag2.x, dy = e2.clientY - drag2.y;
        drag2.moved += Math.abs(dx) + Math.abs(dy);
        cam.x += dx / cam.z;
        cam.y += dy / cam.z;
        drag2.x = e2.clientX;
        drag2.y = e2.clientY;
        draw2();
        const shown = hover ?? selected;
        if (shown && !info.hidden) place(shown);
        return;
      }
      const n = pick(e2);
      if (n !== hover) {
        hover = n;
        showInfo(n ?? selected);
        draw2();
        canvas.style.cursor = n ? "pointer" : "grab";
      }
    });
    canvas.addEventListener("pointerup", (e2) => {
      const wasClick = drag2 && drag2.moved < 6;
      drag2 = null;
      canvas.style.cursor = "grab";
      if (!wasClick) return;
      const n = pick(e2);
      selected = n;
      if (n && isOpen(n) && !canAllocate(hero, n.id)) {
        c.act((s) => allocate(s, n.id));
        return;
      }
      showInfo(n);
      draw2();
    });
    canvas.addEventListener("pointerleave", () => {
      if (!drag2 && hover) {
        hover = null;
        showInfo(selected);
        draw2();
      }
    });
    canvas.addEventListener("wheel", (e2) => {
      e2.preventDefault();
      zoom(e2.deltaY < 0 ? 1.12 : 0.89);
    }, { passive: false });
    function zoom(f) {
      cam.z = Math.max(0.25, Math.min(1.6, cam.z * f));
      draw2();
      const n = hover ?? selected;
      if (n && !info.hidden) place(n);
    }
    showInfo(null);
    const asc = ascCard(c);
    const fitHeight = () => {
      const body = canvas.closest(".body");
      if (!body) return;
      const want = Math.max(320, Math.round(body.clientHeight - head.offsetHeight - 44));
      if (Math.abs(canvas.clientHeight - want) > 2) canvas.style.height = want + "px";
      draw2();
    };
    requestAnimationFrame(() => {
      fitHeight();
      const body = canvas.closest(".body");
      if (!body) return;
      const ro = new ResizeObserver(() => {
        if (!canvas.isConnected) {
          ro.disconnect();
          return;
        }
        fitHeight();
      });
      ro.observe(body);
    });
    return h("div", { class: "col" }, head, wrap2, asc);
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
          { class: "skill" },
          h("span", { style: `flex:none;width:12px;align-self:stretch;background:${a2.color};border:2px solid #1a1410` }),
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

  // src/core/scout.ts
  var LIMIT_S = 15 * 60;
  function scoutPinnacle(state, id, trials = 5) {
    const p = PINNACLES[id];
    if (!p) return { wins: 0, trials: 0, seconds: 0 };
    let wins = 0, secs = 0;
    for (let i = 0; i < trials; i++) {
      const s = structuredClone(state);
      s.sigils[p.sigil] = p.cost;
      s.activity.pinnacle = id;
      s.activity.mode = "map";
      s.activity.run = null;
      s.activity.autoPush = false;
      s.activity.runIndex = state.activity.runIndex + 1e3 + i * 7919;
      let result = null;
      const ev = { death: () => {
        result ??= "loss";
      }, runDone: () => {
        result ??= "win";
      } };
      const t0 = s.simTo;
      for (let k = 0; k < LIMIT_S * (1e3 / STEP_MS) && !result; k++) {
        step(s, ev);
        s.simTo += STEP_MS;
      }
      if (result === "win") {
        wins++;
        secs += (s.simTo - t0) / 1e3;
      }
    }
    return { wins, trials, seconds: wins ? Math.round(secs / wins) : 0 };
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
      const gate = ZONES.a3_sunfall;
      const pic = scenery(gate, 240, 80);
      pic.className = "gate-pic";
      const acts = h("div", { class: "gate-acts" }, ...ACTS.map((a) => {
        const done = !!st.world.clears[a.zones[a.zones.length - 1]];
        const here = a.zones.includes(st.activity.zone) || a.trial === st.activity.zone;
        return h("span", { class: `tag${done ? " done" : here ? " here" : ""}`, text: `Act ${a.id}${done ? ": cleared" : here ? ": here" : ""}` });
      }));
      return h(
        "div",
        { class: "card col atlas-locked" },
        h("h3", { text: "The Cinderlands" }),
        h("div", { class: "gate" }, pic, h("span", { class: "lock" }, glyph("block", 22))),
        h("div", { class: "story", text: "Past the crater the land is all ember and ash, and it never ends. Clear the Sunfall to walk it." }),
        h(
          "div",
          { class: "row" },
          h("span", { class: "sub", style: "margin:0", text: "Opens after" }),
          h("b", { text: `${gate.name} (area level ${gate.level})` }),
          h("span", { class: "muted", text: `the hero is level ${st.hero.level}` })
        ),
        acts,
        h("div", { class: "sub", style: "margin:4px 0 0", text: `Then ${MAX_TIER} map tiers and the endless Depths` }),
        tierChips([]),
        h("div", { class: "muted", text: st.maps.length ? `${st.maps.length} map${st.maps.length === 1 ? "" : "s"} already found and kept for later.` : "Maps start to drop in Act 3; they are kept for later." })
      );
    }
    const root = h("div", { class: "col" });
    const onMaps = st.activity.mode === "map";
    const mode = h(
      "button",
      { class: `toggle${onMaps ? " on" : ""}`, attrs: { role: "switch", "aria-checked": String(onMaps) }, on: { click: () => c.act((s) => setMapMode(s, !onMaps)) } },
      h("i"),
      h("span", null, h("b", { text: "Run maps" }), h("small", { text: "Instead of story zones. With no maps left: the Outskirts, which drop Tier 1 maps." }))
    );
    const tiers = [.../* @__PURE__ */ new Set([...st.maps.map((m4) => m4.tier), ...st.activity.mapTier ? [st.activity.mapTier] : []])].sort((a, b) => a - b);
    const tierSel = h("select");
    tierSel.append(h("option", { text: "Highest tier first", attrs: { value: "0" } }));
    for (const t of tiers) tierSel.append(h("option", { text: `${tierName(t)} and below${st.maps.some((m4) => m4.tier === t) ? "" : " (none in stash)"}`, attrs: { value: String(t) } }));
    tierSel.value = String(st.activity.mapTier);
    tierSel.addEventListener("change", () => c.act((s) => setMapTier(s, +tierSel.value)));
    const deepest2 = Math.max(0, ...st.atlas.tiers);
    root.append(h(
      "div",
      { class: "card col" },
      h("h3", { text: "The map device" }),
      mode,
      h(
        "div",
        { class: "row" },
        "Order",
        tierSel,
        h("span", { class: "tag", text: `${st.maps.length}/${st.mapCap} maps` }),
        h("span", { class: "tag", text: `Deepest: ${deepest2 ? tierName(deepest2) : "none"}` }),
        autoXpCap(st) ? h("span", { class: "tag", title: "Auto-push keeps to tiers within 4 levels of the hero for experience", text: `XP cap: ${tierName(autoXpCap(st))}` }) : null,
        st.activity.autoCap ? h("span", { class: "tag ember", text: `Auto-push cap: ${tierName(st.activity.autoCap)}` }) : null
      ),
      tierChips(st.atlas.tiers),
      h("div", { class: "muted", style: "font-size:12px", text: `Dying in a map loses it and ${MAP_DEATH_XP * 100}% of a level's experience. Mods make maps harder and richer.` })
    ));
    const list9 = h("div", { class: "col", style: "gap:4px" });
    const maps = [...st.maps].sort((a, b) => b.tier - a.tier || b.mods.length - a.mods.length);
    for (const m4 of maps.slice(0, 40)) {
      const on = c.sel.uid === m4.uid;
      const area = MAP_AREAS[m4.area];
      const thumb = area ? scenery({ id: "map", name: area.name, palette: area.palette }, 84, 44) : null;
      if (thumb) thumb.className = "mthumb";
      list9.append(h(
        "div",
        { class: `zone map${on ? " on" : ""}`, style: "margin:0", on: { click: () => {
          c.sel = { uid: m4.uid };
          c.rerender();
        } } },
        thumb,
        h(
          "div",
          { class: "grow" },
          h("div", { class: "row", style: "gap:6px" }, h("span", { class: "tag", style: `background:${RCOLOR[m4.rarity]};color:#1a1410`, text: tierName(m4.tier) }), h("b", { text: mapLabel(m4) })),
          m4.mods.length ? h("div", { class: "muted", style: "font-size:12px;margin-top:2px", text: m4.mods.map((id) => MAP_MODS[id]?.text ?? id).join(" / ") }) : null
        )
      ));
    }
    if (!maps.length) list9.append(h("div", { class: "muted", text: "No maps yet. The Outskirts and Act 3 drop them." }));
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
      list9,
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
      h("div", { class: "muted", style: "font-size:12px", text: `First clears of tiers 1-${MAX_TIER} give a point each, every fifth Depth one more, pinnacles two.` }),
      grid
    ));
    const pins = h("div", { class: "grid2" });
    for (const p of Object.values(PINNACLES)) {
      const have = st.sigils[p.sigil] ?? 0;
      const queued = st.activity.pinnacle === p.id;
      const cast = MONSTER_CAST[p.boss];
      const art = cast ? spriteCanvas(cast.sprite) : null;
      if (art) art.className = "pin-art";
      pins.append(h(
        "div",
        { class: "skill pinnacle", style: "cursor:default" },
        art ? h("div", { class: "pin-frame", style: `background:${p.palette[0]}` }, art) : null,
        h(
          "div",
          { class: "grow" },
          h("div", { class: "nm", text: p.name }),
          h("div", { class: "ds", text: p.text }),
          h("div", { class: "ds muted", text: `Level ${p.level}. ${p.sigilName}s drop from map bosses at ${tierName(p.minTier)}+. Kills: ${st.pinnacleKills[p.id] ?? 0}.` }),
          scoutLine(c, p.id),
          h(
            "div",
            { class: "row", style: "margin-top:6px;gap:6px" },
            h("button", {
              class: "btn hot",
              text: queued ? "Next run" : `Challenge (${have}/${p.cost})`,
              attrs: have >= p.cost && !queued ? {} : { disabled: "" },
              on: { click: () => c.act((s) => queuePinnacle(s, p.id), `${p.name} is next`) }
            }),
            h("button", {
              class: "btn alt",
              text: "Scout",
              title: "Fight it five times on a copy of your hero (nothing is spent) to see the odds",
              on: { click: () => {
                scouted.set(scoutKey(st, p.id), scoutPinnacle(st, p.id, 5));
                c.rerender();
              } }
            })
          )
        )
      ));
    }
    root.append(h("div", { class: "card col" }, h("h3", { text: "Pinnacles" }), pins));
    return root;
  }
  var scouted = /* @__PURE__ */ new Map();
  var scoutKey = (st, id) => `${id}:${st.hero.rev}:${st.hero.level}`;
  function scoutLine(c, id) {
    const r3 = scouted.get(scoutKey(c.state, id));
    if (!r3) return null;
    const odds = r3.wins / Math.max(1, r3.trials);
    const verdict = odds >= 0.8 ? "ready" : odds >= 0.4 ? "risky" : "not yet";
    return h("div", { class: `scout ${odds >= 0.8 ? "ok" : odds >= 0.4 ? "mid" : "bad"}`, text: `Scouted: won ${r3.wins} of ${r3.trials}${r3.wins ? `, about ${r3.seconds} s each` : ""} - ${verdict}` });
  }
  function tierChips(done) {
    const row = h("div", { class: "ladder", attrs: { "aria-label": `Tiers cleared: ${done.length} of ${MAX_TIER}` } });
    for (let t = 1; t <= MAX_TIER; t++) row.append(h("span", { class: `rung${done.includes(t) ? " done" : ""}`, title: `${tierName(t)}${done.includes(t) ? ": cleared" : ""}`, text: String(t) }));
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
        return `${s.hero.rev}:${s.hero.level}:${s.activity.run ? runZone(s, s.activity.run).name : s.activity.zone}:${Object.keys(s.companions).length}:${s.hero.pet ? Math.floor((s.companions[s.hero.pet.id] ?? 0) / 100) : -1}`;
      case "gear":
        return `${s.hero.rev}:${s.stash.length}:${s.stash[s.stash.length - 1]?.uid ?? 0}:${s.dust}:${c.sel.uid}:${c.sel.slot}:${gearSig(s)}`;
      case "forge":
        return `${s.hero.rev}:${s.stash.length}:${s.dust}:${JSON.stringify(s.currency)}:${c.sel.uid}:${s.craftSeq}:${gearSig(s)}`;
      case "skills":
        return `${s.hero.rev}:${s.hero.level}`;
      case "tree":
        return `${s.hero.rev}:${s.hero.level}:${s.dust >= 5 + s.hero.level * 2}:${s.hero.ascPoints}`;
      case "world":
        return `${s.activity.mode}:${s.activity.zone}:${s.world.unlocked.length}:${s.activity.autoPush}:${Object.values(s.world.clears).reduce((a, b) => a + b, 0)}:${s.contracts.list.map((x) => `${x.kind}${x.n}/${x.target}`).join(",")}:${s.dust >= rerollCost(s)}:${shrineSig(s)}`;
      case "atlas":
        return atlasSig(c);
      case "log":
        return `${s.log.length}:${s.log[s.log.length - 1]?.t ?? 0}`;
      case "menu":
        return `${s.settings.keep}:${s.settings.autoEquip}:${s.settings.upkeep}:${JSON.stringify(s.settings.filter)}`;
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
    const st = c.state;
    const hero = st.hero;
    const sk = s.skill;
    const critFactor = 1 + sk.critChance / 100 * (sk.critMulti / 100 - 1);
    const breakdown = (stat, title) => () => {
      const mods = s.bag.mods(stat);
      const list9 = h("div", { class: "kv" });
      for (const m4 of mods) list9.append(h("div", { text: m4.src ?? "?" }), h("div", { class: "num", text: `${m4.kind === "flat" ? "+" : ""}${m4.value}${m4.kind === "flat" ? "" : "% " + m4.kind}${m4.tags ? " [" + m4.tags.join(",") + "]" : ""}` }));
      if (!mods.length) list9.append(h("div", { text: "No modifiers" }), h("div"));
      const close = c.modal(h("div", { class: "card" }, h("h3", { text: title }), list9, h("div", { style: "margin-top:8px" }, h("button", { class: "btn", text: "Close", on: { click: () => close() } }))));
    };
    const run = st.activity.run;
    const zone = run ? runZone(st, run) : ZONES[st.activity.zone];
    const por = portrait(zone, hero.cls);
    por.className = "portrait";
    por.style.width = por.width * 2 + "px";
    por.style.height = por.height * 2 + "px";
    const asc = hero.asc ? ASCENDANCIES[hero.asc]?.name : null;
    const xpNeed = xpToNext(hero.level);
    const xpF = isFinite(xpNeed) ? hero.xp / xpNeed : 1;
    const who = h(
      "div",
      { class: "card sheet-who" },
      h("h3", { text: hero.name }),
      h("div", { class: "portrait-frame" }, por, h("div", { class: "where-tag", text: zone.name })),
      h(
        "div",
        { class: "row", style: "gap:5px;margin-top:8px" },
        h("span", { class: "tag lv", text: `Level ${hero.level}` }),
        h("span", { class: "tag", text: CLASSES[hero.cls]?.name ?? hero.cls }),
        asc ? h("span", { class: "tag asc", text: asc }) : null
      ),
      h("div", { class: "xpbar", title: isFinite(xpNeed) ? `${fmt(hero.xp)} / ${fmt(xpNeed)} experience` : "max level" }, h("i", { style: `width:${(xpF * 100).toFixed(1)}%` })),
      h("div", { class: "attrs" }, ...[["might", "Might", s.str], ["grace", "Grace", s.dex], ["wit", "Wit", s.int]].map(([g, label, v]) => h("div", { class: `attr ${g}`, title: label }, glyph(g, 18), h("b", { class: "num", text: String(v) }), h("span", { text: label })))),
      ...s.problems.map((p) => h("div", { class: "tag", style: "background:var(--ember);color:#1a1410;margin-top:6px;white-space:normal", text: p }))
    );
    const rate = Math.min(sk.speed, sk.sustain);
    const chip = (label, value, click, total = false) => h(click ? "button" : "div", { class: `fchip${total ? " total" : ""}`, on: click ? { click } : {} }, h("span", { text: label }), h("b", { class: "num", text: value }));
    const op = (t) => h("span", { class: "fop", text: t });
    const formula = h(
      "div",
      { class: "formula" },
      chip("Hit", fmt(sk.avgHit), breakdown("damage", "Damage modifiers")),
      op("x"),
      chip("Crit", critFactor.toFixed(2), breakdown("critChance", "Critical chance")),
      op("x"),
      chip(sk.kind === "attack" ? "Attacks" : "Casts", `${rate.toFixed(2)}/s`, breakdown(sk.kind === "attack" ? "attackSpeed" : "castSpeed", "Speed")),
      ...sk.kind === "attack" ? [op("x"), chip("Hit chance", pct(sk.hitChance), breakdown("accuracy", "Accuracy"))] : [],
      op("="),
      chip("DPS", fmt(sk.dps), void 0, true)
    );
    const big = (label, value, colour, note) => h("div", { class: "bigstat" }, pixText(value, colour, 4), h("div", null, h("b", { text: label }), h("span", { text: note })));
    const off = h(
      "div",
      { class: "card" },
      h("h3", { text: `Offence - ${sk.name}` }),
      h("div", { class: "bigrow" }, big("Single target", fmt(sk.dps), "#ffc233", "damage per second"), big("Against packs", fmt(sk.packDps), "#ff8a5c", `${sk.targets} target${sk.targets > 1 ? "s" : ""} hit`)),
      formula,
      kv([
        ...DAMAGE_TYPES.filter((t) => sk.hit[t][1] > 0).map((t) => [`${TYPE_NAME[t]} damage`, `${fmt(sk.hit[t][0])}-${fmt(sk.hit[t][1])}`]),
        ["Critical chance", `${sk.critChance.toFixed(1)}%`, breakdown("critChance", "Critical chance")],
        ["Critical multiplier", `${sk.critMulti.toFixed(0)}%`, breakdown("critMulti", "Critical multiplier")],
        ["Mana cost", fmt(sk.manaCost)],
        ...sk.sustain < sk.speed ? [["Mana-limited to", `${sk.sustain.toFixed(2)}/s`]] : [],
        ...sk.leech ? [["Life leech", `${sk.leech}%`]] : []
      ])
    );
    const RES_GLYPH = { fire: "skills", cold: "cold", lightning: "lightning", chaos: "chaos" };
    const res = h(
      "div",
      { class: "card" },
      h("h3", { text: "Resistances" }),
      h("div", { class: "resrow" }, ...["fire", "cold", "lightning", "chaos"].map((t) => {
        const v = s.res[t], raw = s.resRaw[t], max = s.maxRes[t];
        return h(
          "button",
          { class: `res ${t}${v < 0 ? " neg" : ""}${v >= max ? " cap" : ""}`, title: `${TYPE_NAME[t]} resistance - click for where it comes from`, on: { click: breakdown(`res.${t}`, `${TYPE_NAME[t]} resistance`) } },
          glyph(RES_GLYPH[t], 22),
          h("b", { class: "num", text: `${v}%` }),
          h("span", { text: raw > max ? `over cap (${raw})` : `max ${max}` })
        );
      }))
    );
    const tile = (g, label, value, stat) => h("button", { class: `stat ${g}`, title: `${label} - click for where it comes from`, on: { click: breakdown(stat, label) } }, glyph(g, 18), h("b", { class: "num", text: value }), h("span", { text: label }));
    const pool = s.life + s.es;
    const def2 = h(
      "div",
      { class: "card" },
      h("h3", { text: "Defence" }),
      h(
        "div",
        { class: "tiles" },
        tile("heart", "Life", fmt(s.life), "life"),
        tile("esorb", "Energy shield", fmt(s.es), "energyShield"),
        tile("regen", "Life regen", `${fmt(s.lifeRegen)}/s`, "lifeRegen"),
        tile("armour", "Armour", fmt(s.armour), "armour"),
        tile("evasion", "Evasion", fmt(s.evasion), "evasion"),
        tile("block", "Block", `${s.block.toFixed(0)}%`, "block")
      ),
      h("div", { class: "sub" }, `Effective HP against each type (pool ${fmt(pool)})`),
      ehpBars(s),
      kv([["Movement speed", pct(s.moveSpeed)], ["Item rarity", codexRarity(st) ? `+${s.rarity + codexRarity(st)}% (codex +${codexRarity(st)}%)` : `+${s.rarity}%`], ["Flask healing", pct(s.flaskHeal)], ["Build score", fmt(buildScore(s))]])
    );
    return h("div", { class: "sheet" }, h("div", { class: "col", style: "gap:14px" }, who, companionCard(c)), h("div", { class: "col", style: "gap:14px" }, off, res), def2);
  }
  function petArt(def2, size = 1) {
    const fr = spriteOf(def2.sprite);
    if (!fr) return h("span", { class: "q", text: "?" });
    const cv = h("canvas", { class: "petart", attrs: { width: String(fr.w), height: String(fr.h), "aria-hidden": "true" } });
    const g = cv.getContext("2d");
    g.imageSmoothingEnabled = false;
    drawSprite(g, def2.sprite, 0, fr.f === 1 ? fr.w - fr.ax : fr.ax, fr.ay, def2.tint ? { tint: def2.tint, strength: def2.strength ?? 0.4 } : {});
    cv.style.width = fr.w * size + "px";
    cv.style.height = fr.h * size + "px";
    return cv;
  }
  function companionCard(c) {
    const st = c.state;
    const pet = st.hero.pet;
    const owned = COMPANION_ORDER.filter((id) => st.companions[id] !== void 0);
    const card = h("div", { class: "card pets" }, h("h3", { class: "split" }, h("span", { text: "Companion" }), h("span", { class: "num", text: `${owned.length} / ${COMPANION_ORDER.length} found` })));
    if (pet && COMPANIONS[pet.id]) {
      const def2 = COMPANIONS[pet.id];
      const bond = st.companions[pet.id] ?? 0;
      const max = pet.level >= COMPANION_MAX_LEVEL;
      const lo = bondFor(pet.level), hi = bondFor(pet.level + 1);
      card.append(h(
        "div",
        { class: "pet-now" },
        h("div", { class: "pet-stage" }, petArt(def2, 2)),
        h(
          "div",
          { class: "col grow", style: "gap:4px;min-width:0" },
          h("div", { class: "row", style: "gap:6px" }, h("b", { text: def2.name }), h("span", { class: "tag lv", text: `Level ${pet.level}` })),
          h("span", { class: "pet-bonus", text: companionText(pet.id, pet.level) }),
          h("div", { class: "xpbar", title: max ? "Fully bonded" : `${fmt(bond - lo)} / ${fmt(hi - lo)} bond: every kill while it is out` }, h("i", { style: `width:${max ? 100 : Math.min(100, (bond - lo) / (hi - lo) * 100).toFixed(1)}%` })),
          h("span", { class: "muted", style: "font-size:12px;font-style:italic", text: def2.blurb })
        )
      ));
    } else {
      card.append(h("div", { class: "muted", style: "font-size:12px;margin-bottom:6px", text: owned.length ? "No companion out: pick one below." : "No companion yet. The Tide-Warden guards the first one; bosses sometimes bring others." }));
    }
    const grid = h("div", { class: "pet-grid" });
    for (const id of COMPANION_ORDER) {
      const def2 = COMPANIONS[id];
      const has = st.companions[id] !== void 0;
      const out = pet?.id === id;
      const lvl = has ? companionLevel(st.companions[id]) : 0;
      const tile = h(
        has ? "button" : "div",
        {
          class: `pet${out ? " on" : ""}${has ? "" : " unknown"}`,
          attrs: has ? { "aria-pressed": String(out), "aria-label": `${def2.name}, level ${lvl}` } : { role: "img", "aria-label": `Not found yet: ${def2.where}` },
          on: has && !out ? { click: () => c.act((s) => setCompanion(s, id), `${def2.name} walks with you`) } : {}
        },
        h("span", { class: "pic" }, has ? petArt(def2, 1) : h("span", { class: "q", text: "?" })),
        h("b", { text: has ? def2.name : "Unknown" }),
        h("span", { text: has ? `Lv ${lvl}${out ? " - out" : ""}` : def2.where })
      );
      tile.dataset.tip = has ? `${def2.name}, level ${lvl}: ${companionText(id, lvl)}.${out ? " At your side now." : " Click to send it out."}` : `Not found yet. ${def2.where}.`;
      grid.append(tile);
    }
    card.append(grid);
    return card;
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
    const cell = h("div", {
      class: `cell ${item ? item.rarity : "empty"}${selected ? " sel" : ""}`,
      attrs: { "aria-label": item ? itemLabel(item) : slot ? `${SLOT_LABEL[slot]}: empty` : "empty", ...item || slot ? { role: "button", tabindex: "0" } : {}, ...selected ? { "aria-pressed": "true" } : {} },
      on: { click: onClick }
    });
    if (item) cell.append(itemIcon(item));
    if (slot) {
      cell.dataset.slot = slot;
      cell.append(h("span", { class: "lbl", text: SLOT_LABEL[slot] }));
    }
    return cell;
  }
  var tipEl = null;
  function hideTip() {
    tipEl?.remove();
    tipEl = null;
  }
  function showTip(anchor, content) {
    hideTip();
    const body = anchor.closest(".body");
    if (!body || !anchor.isConnected) return;
    tipEl = h("div", { class: "tip", attrs: { role: "tooltip" } }, content);
    body.append(tipEl);
    placeBeside(tipEl, anchor, body);
  }
  function withTip(cell, c, make) {
    let t = null;
    const show = () => {
      c.hold = true;
      t = window.setTimeout(() => {
        if (!drag && !cell.classList.contains("sel")) showTip(cell, make());
      }, 130);
    };
    const hide = () => {
      if (t !== null) clearTimeout(t);
      hideTip();
      if (!drag) c.hold = false;
    };
    cell.addEventListener("mouseenter", show);
    cell.addEventListener("mouseleave", hide);
    cell.addEventListener("focus", () => {
      if (cell.matches(":focus-visible")) show();
    });
    cell.addEventListener("blur", hide);
  }
  var drag = null;
  function itemCard(item, c, opts = {}) {
    const b = baseOf(item);
    const st = itemStats(item);
    const card = h("div", { class: "card item" }, h("div", { class: `name ${item.rarity}`, text: itemLabel(item) }));
    const lines = [];
    if (item.rarity === "rare" || item.rarity === "relic") lines.push(b.name);
    card.append(h("div", { class: "muted", text: `${[...lines, b.kind === b.slot ? "" : b.kind].filter(Boolean).join(" - ")}  ilvl ${item.ilvl}, needs level ${levelReq(item)}` }));
    if (item.quality || item.locked) card.append(h(
      "div",
      { class: "row", style: "gap:4px;margin-top:3px" },
      item.quality ? h("span", { class: "tag q", text: `Quality +${item.quality}%` }) : null,
      item.locked ? h("span", { class: "tag lk" }, glyph("lock", 9), " Locked") : null
    ));
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
      for (const a of sorted) card.append(h("div", { class: `aff${a.bench ? " bench" : ""}`, title: a.bench ? "Added at the bench" : "" }, affixText(a), h("b", { text: `${a.bench ? "Bench " : ""}${affixOf(a).type === "prefix" ? "P" : "S"} T${tierLabel(a)}` })));
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
  var gearOpts = { filter: "all", sort: "rarity", marks: /* @__PURE__ */ new Set() };
  var SLOT_GROUP = { weapon: "weapons", offhand: "weapons", helmet: "armour", body: "armour", gloves: "armour", boots: "armour", belt: "jewellery", amulet: "jewellery", ring: "jewellery" };
  var SLOT_ORDER = ["weapon", "offhand", "helmet", "body", "gloves", "boots", "belt", "amulet", "ring"];
  function gearSig(s) {
    let locks = 0;
    for (const x of s.stash) if (x.locked) locks++;
    for (const x of s.relics) if (x.locked) locks++;
    for (const k of SLOTS) if (s.hero.equipment[k]?.locked) locks++;
    return `${s.stashCap}:${s.relics.length}:${s.relics[s.relics.length - 1]?.uid ?? 0}:${locks}:${gearOpts.marks.size}:${Object.keys(s.codex).length}:${s.settings.upkeep}:${s.stashFull ?? false}`;
  }
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
  var lockBadge = () => h("span", { class: "lockb", attrs: { "aria-hidden": "true" } }, glyph("lock", 9));
  function markWorn(cell, slot) {
    cell.classList.add("wornc");
    cell.append(h("span", { class: "worn", text: "worn" }));
    cell.setAttribute("aria-label", `${cell.getAttribute("aria-label") ?? ""} (worn${slot ? ", " + SLOT_LABEL[slot].toLowerCase() : ""})`);
    return cell;
  }
  var gridSep = (text) => h("div", { class: "gridsep", text });
  function gearView(c) {
    const st = c.state;
    const eq = st.hero.equipment;
    hideTip();
    drag = null;
    c.hold = false;
    const root = h("div", { class: "gear" });
    const endDrag = () => {
      drag = null;
      c.hold = false;
      root.classList.remove("dragging");
      root.querySelectorAll(".drop-ok, .over").forEach((e2) => e2.classList.remove("drop-ok", "over"));
    };
    for (const uid of [...gearOpts.marks]) if (!st.stash.some((x) => x.uid === uid)) gearOpts.marks.delete(uid);
    const doll = h("div", { class: "doll" });
    const hc = HERO_CAST[st.hero.cls];
    const fig = h("div", { class: "fig" });
    const art = hc ? spriteCanvas(hc.idle) : null;
    if (art) {
      art.className = "figart";
      art.style.width = art.width * 3 + "px";
      art.style.height = art.height * 3 + "px";
      fig.append(art);
    }
    doll.append(fig);
    const wb = eq.weapon ? baseOf(eq.weapon) : null;
    for (const s of SLOTS) {
      const it = eq[s];
      const cell = itemCell(it, s, c.sel.slot === s && c.sel.uid === void 0, () => {
        c.sel = { slot: s };
        c.rerender();
      });
      if (s === "offhand" && !it && wb?.weapon?.hands === 2) {
        const bow = wb.kind === "bow";
        cell.classList.add(bow ? "only" : "blocked");
        cell.querySelector(".lbl").textContent = bow ? "Quiver" : "2-hand";
        cell.title = bow ? "Only a quiver fits beside a bow" : `${wb.name} takes both hands`;
        cell.setAttribute("aria-label", `Off-hand: ${cell.title}`);
        if (!bow) cell.tabIndex = -1;
      }
      cell.addEventListener("mouseenter", () => {
        if (drag) return;
        root.classList.add("slotpick");
        for (const el of root.querySelectorAll(".stash .cell[data-uid]")) {
          const x = ownedItem(st, Number(el.dataset.uid));
          el.classList.toggle("fits", !!x && slotsFor(baseOf(x)).includes(s));
        }
      });
      cell.addEventListener("mouseleave", () => {
        root.classList.remove("slotpick");
        root.querySelectorAll(".fits").forEach((e2) => e2.classList.remove("fits"));
      });
      if (it) {
        if (it.locked) cell.append(lockBadge());
        withTip(cell, c, () => itemCard(it, c));
        cell.draggable = true;
        cell.addEventListener("dragstart", (e2) => {
          drag = { slot: s };
          c.hold = true;
          hideTip();
          root.classList.add("dragging");
          e2.dataTransfer?.setData("text/plain", "slot:" + s);
          if (e2.dataTransfer) e2.dataTransfer.effectAllowed = "move";
        });
        cell.addEventListener("dragend", endDrag);
      }
      cell.addEventListener("dragover", (e2) => {
        const it2 = drag?.uid !== void 0 ? ownedItem(st, drag.uid) : void 0;
        if (it2 && slotsFor(baseOf(it2)).includes(s) && !canEquip(st, it2, s)) {
          e2.preventDefault();
          cell.classList.add("over");
        }
      });
      cell.addEventListener("dragleave", () => cell.classList.remove("over"));
      cell.addEventListener("drop", (e2) => {
        e2.preventDefault();
        const uid = drag?.uid;
        endDrag();
        if (uid !== void 0) c.act((x) => {
          const err = equip(x, uid, s);
          if (!err) c.sel = { slot: s };
          return err;
        });
      });
      doll.append(cell);
    }
    const ownedCell = (it, markable) => {
      const cell = itemCell(it, null, c.sel.uid === it.uid, () => {
        c.sel = { uid: it.uid };
        c.rerender();
      });
      if (markable) {
        cell.addEventListener("click", (e2) => {
          if (!e2.shiftKey && !e2.ctrlKey && !e2.metaKey) return;
          e2.stopImmediatePropagation();
          if (it.locked) {
            c.toast("Locked items can't be marked for salvage");
            return;
          }
          if (gearOpts.marks.has(it.uid)) gearOpts.marks.delete(it.uid);
          else gearOpts.marks.add(it.uid);
          c.rerender();
        }, { capture: true });
        if (gearOpts.marks.has(it.uid)) cell.classList.add("mark");
      }
      cell.dataset.uid = String(it.uid);
      cell.addEventListener("mouseenter", () => {
        if (drag) return;
        const targets = slotsFor(baseOf(it));
        const cmp = upgradeOf(st, it) ?? targets.find((t) => !eq[t]) ?? targets[0];
        root.querySelector(`.doll [data-slot="${cmp}"]`)?.classList.add("cmp");
      });
      cell.addEventListener("mouseleave", () => root.querySelectorAll(".doll .cmp").forEach((e2) => e2.classList.remove("cmp")));
      if (it.locked) cell.append(lockBadge());
      if (upgradeOf(st, it)) cell.classList.add("upg");
      else if (levelReq(it) > st.hero.level) cell.classList.add("req");
      withTip(cell, c, () => {
        const targets = slotsFor(baseOf(it));
        const cmp = upgradeOf(st, it) ?? targets.find((t) => !eq[t]) ?? targets[0];
        const worn = eq[cmp];
        return h(
          "div",
          { class: "tipcols" },
          itemCard(it, c, { compareSlot: cmp }),
          worn ? h("div", { class: "col", style: "gap:4px" }, h("div", { class: "tiplbl", text: "Equipped" }), itemCard(worn, null)) : null
        );
      });
      cell.draggable = true;
      cell.addEventListener("dragstart", (e2) => {
        drag = { uid: it.uid };
        c.hold = true;
        hideTip();
        root.classList.add("dragging");
        for (const t of slotsFor(baseOf(it))) if (!canEquip(st, it, t)) root.querySelector(`.doll [data-slot="${t}"]`)?.classList.add("drop-ok");
        e2.dataTransfer?.setData("text/plain", "stash:" + it.uid);
        if (e2.dataTransfer) e2.dataTransfer.effectAllowed = "move";
      });
      cell.addEventListener("dragend", endDrag);
      return cell;
    };
    const ups = new Set(st.stash.filter((it) => upgradeOf(st, it)).map((it) => it.uid));
    const caseUps = st.relics.filter((it) => upgradeOf(st, it)).length;
    const groupOf = (it) => SLOT_GROUP[baseOf(it).slot] ?? "all";
    const count = (f) => f === "all" ? st.stash.length : f === "upgrades" ? ups.size : f === "relics" ? st.relics.length : st.stash.filter((it) => groupOf(it) === f).length;
    const relicsTab = gearOpts.filter === "relics";
    const grid = h("div", { class: `stash${relicsTab ? " codex" : ""}` });
    if (relicsTab) {
      const worn = new Map(SLOTS.map((s) => eq[s]).filter((x) => !!x?.relic).map((x) => [x.relic, x]));
      for (const def2 of Object.values(RELICS).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))) {
        const own = st.relics.find((x) => x.relic === def2.id);
        const seen = st.codex[def2.id] ?? 0;
        if (own) {
          grid.append(ownedCell(own, false));
          continue;
        }
        const w2 = worn.get(def2.id);
        if (w2) {
          const ws = SLOTS.find((s) => eq[s] === w2);
          const cell = markWorn(itemCell(w2, null, false, () => {
            c.sel = { slot: ws };
            c.rerender();
          }), ws);
          withTip(cell, c, () => itemCard(w2, null));
          grid.append(cell);
          continue;
        }
        const ghost = h("div", { class: `cell ${seen ? "ghost" : "unknown"}`, attrs: { role: "img", "aria-label": seen ? `${def2.name}: found ${seen}, none kept` : "A relic not found yet" } });
        if (seen) ghost.append(itemIcon({ uid: -1, base: def2.base, ilvl: def2.level, rarity: "relic", affixes: [], relic: def2.id }), h("span", { class: "cnt num", text: `x${seen}` }));
        else ghost.append(h("span", { class: "q", text: "?" }));
        withTip(ghost, c, () => h(
          "div",
          { class: "card item" },
          h("div", { class: "name relic", text: seen ? def2.name : "Unknown relic" }),
          h("div", { class: "muted", text: seen ? `Found ${seen} time${seen === 1 ? "" : "s"}; none kept. Relics that roll better replace the case's copy.` : `Drops from monsters of level ${def2.level} and up.` }),
          seen ? h("div", { class: "muted", style: "font-style:italic;margin-top:4px", text: def2.flavour }) : null
        ));
        grid.append(ghost);
      }
    } else {
      const shown = st.stash.filter((it) => gearOpts.filter === "all" || (gearOpts.filter === "upgrades" ? ups.has(it.uid) : groupOf(it) === gearOpts.filter));
      const byRarity = (a, b) => RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity] || b.ilvl - a.ilvl;
      shown.sort(gearOpts.sort === "level" ? (a, b) => b.ilvl - a.ilvl || byRarity(a, b) : gearOpts.sort === "slot" ? (a, b) => SLOT_ORDER.indexOf(baseOf(a).slot) - SLOT_ORDER.indexOf(baseOf(b).slot) || byRarity(a, b) : byRarity);
      const grouped = gearOpts.filter !== "all" && gearOpts.filter !== "upgrades";
      const worn = grouped ? SLOTS.filter((s) => eq[s] && groupOf(eq[s]) === gearOpts.filter) : [];
      if (worn.length) {
        grid.append(gridSep("Worn"));
        for (const s of worn) {
          const w2 = eq[s];
          const cell = markWorn(itemCell(w2, null, c.sel.slot === s && c.sel.uid === void 0, () => {
            c.sel = { slot: s };
            c.rerender();
          }), s);
          if (w2.locked) cell.append(lockBadge());
          withTip(cell, c, () => itemCard(w2, c));
          grid.append(cell);
        }
        grid.append(gridSep(`In the stash (${shown.length})`));
      }
      for (const it of shown) grid.append(ownedCell(it, true));
      if (gearOpts.filter === "all") for (let i = st.stash.length; i < st.stashCap; i++) grid.append(h("div", { class: "cell empty" }));
      if (!st.stash.length) grid.prepend(h("div", { class: "muted stash-note", text: "The stash is empty. Drops the loot filter keeps land here." }));
      else if (!shown.length) grid.append(h("div", { class: "muted", style: "grid-column:1/-1;padding:6px 0", text: gearOpts.filter === "upgrades" ? "Nothing in the stash beats what is equipped." : "None of these in the stash." }));
    }
    grid.addEventListener("dragover", (e2) => {
      if (drag?.slot) {
        e2.preventDefault();
        grid.classList.add("over");
      }
    });
    grid.addEventListener("dragleave", () => grid.classList.remove("over"));
    grid.addEventListener("drop", (e2) => {
      e2.preventDefault();
      const s = drag?.slot;
      endDrag();
      if (s) c.act((x) => unequip(x, s));
    });
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
    const room = stashRoomCost(st);
    const roomBtn = room === null ? null : h("button", {
      class: "btn alt small",
      text: `+${STASH_STEP} slots`,
      attrs: st.dust >= room ? {} : { disabled: "" },
      title: `Ten more stash slots for ${fmt(room)} ember dust (up to ${STASH_MAX})`,
      on: { click: () => c.act(buyStashRoom, `Stash: ${st.stashCap + STASH_STEP} slots`) }
    });
    const found = Object.keys(st.codex).length, total = Object.keys(RELICS).length;
    const head = relicsTab ? h("h3", { class: "split" }, h("span", { text: "Relic codex" }), h("span", { class: "num", title: "Every different relic found adds 1% item rarity", text: `${found} / ${total} found, +${codexRarity(st)}% rarity` })) : h("h3", { class: "split" }, h("span", { text: "Stash" }), h("span", { class: "row", style: "gap:6px" }, roomBtn, h("span", { class: `num${full ? " full" : ""}`, text: `${st.stash.length} / ${st.stashCap}` })));
    const note = relicsTab ? h("div", { class: "muted", style: "font-size:12px;margin-bottom:8px", text: "The relic case keeps the best-rolled copy of every relic, outside the stash. Drag one onto a slot to wear it." }) : st.stashFull ? h(
      "div",
      { class: "warnbar", attrs: { role: "status" } },
      glyph("forge", 14),
      h("span", { text: st.settings.upkeep ? "Stash full of locked items and upgrades: new keepers are salvaged. Unlock, salvage or buy room." : "Stash full: new drops are salvaged into dust. Salvage, buy room, or switch on upkeep (Menu)." })
    ) : full && st.settings.upkeep ? h(
      "div",
      { class: "note", style: "margin-bottom:8px" },
      glyph("forge", 14),
      h("span", { text: "Stash full: upkeep swaps the least-worth unlocked item for each better keeper. Lock what you want to keep." })
    ) : null;
    const stashCard = h(
      "div",
      { class: "card" },
      head,
      note,
      h(
        "div",
        { class: "row", style: "margin-bottom:8px;justify-content:space-between" },
        chips(
          [["all", "All", count("all")], ["upgrades", "Upgrades", count("upgrades")], ["weapons", "Weapons", count("weapons")], ["armour", "Armour", count("armour")], ["jewellery", "Jewellery", count("jewellery")], ["relics", "Relics", count("relics")]],
          gearOpts.filter,
          (v) => {
            gearOpts.filter = v;
            c.sel = {};
            c.rerender();
          }
        ),
        relicsTab ? null : sort
      ),
      grid
    );
    const free = (xs) => xs.filter((x) => !x.locked);
    const plain = free(st.stash.filter((x) => x.rarity === "plain")), ench = free(st.stash.filter((x) => x.rarity === "enchanted"));
    const old = outdatedItems(st);
    const marked = st.stash.filter((x) => gearOpts.marks.has(x.uid));
    const bulk = (label, xs, title, key) => h("button", {
      class: "btn alt small",
      text: `${label} (${xs.length})`,
      title,
      attrs: { ...xs.length ? {} : { disabled: "" }, ...key ? { "data-key": key } : {} },
      on: { click: () => c.act((s) => {
        const n = salvage(s, xs.map((x) => x.uid));
        for (const x of xs) gearOpts.marks.delete(x.uid);
        c.sel = {};
        c.toast(`Salvaged ${n} for dust`);
      }) }
    });
    const anvil = h("div", { class: "anvil", title: "Drop a stash item here to salvage it", attrs: { "aria-label": "Salvage: drop a stash item here" } }, glyph("forge", 18), h("span", { text: "Salvage" }));
    anvil.addEventListener("dragover", (e2) => {
      if (drag?.uid !== void 0) {
        e2.preventDefault();
        anvil.classList.add("over");
      }
    });
    anvil.addEventListener("dragleave", () => anvil.classList.remove("over"));
    anvil.addEventListener("drop", (e2) => {
      e2.preventDefault();
      const uid = drag?.uid;
      endDrag();
      if (uid !== void 0) c.act((x) => {
        if (!salvage(x, [uid])) return "locked items can't be salvaged";
        c.sel = {};
      });
    });
    const upCount = ups.size + caseUps;
    const tools = h(
      "div",
      { class: "row tools" },
      anvil,
      h("span", { class: "tag", style: "background:var(--gold);color:#1a1410", text: `Ember dust ${fmt(st.dust)}` }),
      h("button", {
        class: "btn small",
        text: `Equip upgrades (${upCount})`,
        title: "Wear every stash item that raises the build score, the best first",
        attrs: upCount ? {} : { disabled: "" },
        on: { click: () => c.act((s) => {
          const n = equipUpgrades(s);
          c.toast(n ? `Equipped ${n} upgrade${n === 1 ? "" : "s"}` : "Nothing to equip");
        }) }
      }),
      bulk("Salvage outdated", old, "Unlocked items on a base 10+ levels behind the hero that are not upgrades"),
      bulk("Salvage plain", plain, "Every unlocked plain item in the stash"),
      bulk("Salvage enchanted", ench, "Every unlocked enchanted item in the stash"),
      marked.length ? bulk("Salvage marked", marked, "The items you shift-clicked") : null,
      marked.length ? h("button", { class: "btn alt small", text: "Clear marks", on: { click: () => {
        gearOpts.marks.clear();
        c.rerender();
      } } }) : null
    );
    const selItem = c.sel.uid !== void 0 ? ownedItem(st, c.sel.uid) : void 0;
    const selSlot = c.sel.slot;
    let pop = null;
    const close = h("button", { class: "x popx", text: "x", title: "Put it back (Esc)", attrs: { "aria-label": "Close", "data-esc": "" }, on: { click: () => {
      c.sel = {};
      c.rerender();
    } } });
    const lockBtn = (it) => h("button", {
      class: "btn alt",
      text: it.locked ? "Unlock" : "Lock",
      attrs: { "data-key": "l" },
      title: it.locked ? "Let upkeep and bulk salvage take it again (L)" : "Keep it: upkeep, auto-equip and bulk salvage leave it alone (L)",
      on: { click: () => c.act((s) => setLocked(s, it.uid, !it.locked)) }
    });
    if (selItem) {
      const targets = slotsFor(baseOf(selItem));
      const cmp = upgradeOf(st, selItem) ?? (targets.length > 1 ? targets.find((t) => !eq[t]) ?? targets[0] : targets[0]);
      const card = itemCard(selItem, c, { compareSlot: cmp });
      const row = h("div", { class: "row popacts" });
      targets.forEach((t, i) => {
        const err = canEquip(st, selItem, t);
        row.append(h("button", {
          class: "btn",
          text: targets.length > 1 ? `Equip ${t === "ring1" ? "left" : "right"}` : "Equip",
          attrs: { ...err ? { disabled: "" } : {}, ...i === 0 ? { "data-key": "e" } : {} },
          title: err ?? (i === 0 ? "Equip (E)" : ""),
          on: { click: () => c.act((s) => {
            const e2 = equip(s, selItem.uid, t);
            if (!e2) c.sel = { slot: t };
            return e2;
          }) }
        }));
      });
      row.append(lockBtn(selItem));
      row.append(h("button", {
        class: "btn alt",
        text: `Salvage +${salvageValue(selItem)}`,
        title: selItem.locked ? "Unlock it first" : "Salvage into ember dust (S)",
        attrs: { "data-key": "s", ...selItem.locked ? { disabled: "" } : {} },
        on: { click: () => c.act((s) => {
          salvage(s, [selItem.uid]);
          c.sel = {};
        }) }
      }));
      card.append(row);
      pop = h("div", { class: "gpop", attrs: { role: "dialog", "aria-label": itemLabel(selItem) } }, card, close);
    } else if (selSlot && eq[selSlot]) {
      const it = eq[selSlot];
      const card = itemCard(it, c);
      card.append(h("div", { class: "row popacts" }, h("button", { class: "btn alt", text: "Unequip", title: it.relic ? "Back to the relic case" : "Back to the stash", on: { click: () => c.act((s) => unequip(s, selSlot)) } }), lockBtn(it)));
      pop = h("div", { class: "gpop", attrs: { role: "dialog", "aria-label": itemLabel(it) } }, card, close);
    }
    const help = h("button", {
      class: "info",
      text: "i",
      attrs: { "aria-label": "How gear works" },
      title: "Hover an item to compare it with what you wear; click it to pin its card with Equip, Lock and Salvage.\nDrag an item onto a slot to equip it, onto the anvil to salvage it; drag worn gear back to the stash to take it off.\nShift-click stash items to mark them, then Salvage marked.\nA green corner marks an upgrade; faded items need a higher level; a lock keeps an item safe from upkeep and bulk salvage.\nKeys: E equips the picked item, L locks it, S salvages it, Esc puts it back."
    });
    const equipped = h("div", { class: "card" }, h("h3", { class: "split" }, h("span", { text: "Equipped" }), help), doll);
    root.append(equipped, h("div", { class: "col" }, stashCard, tools));
    root.addEventListener("click", (e2) => {
      if ((c.sel.uid !== void 0 || c.sel.slot) && !e2.target.closest(".cell, .gpop, button, select, .anvil")) {
        c.sel = {};
        c.rerender();
      }
    });
    if (pop) {
      const p = pop;
      requestAnimationFrame(() => {
        const body = root.closest(".body");
        const anchor = root.querySelector(".cell.sel");
        if (!body || !anchor) return;
        body.append(p);
        placeBeside(p, anchor, body);
      });
    }
    return root;
  }
  function placeBeside(el, anchor, body) {
    const br = body.getBoundingClientRect(), ar = anchor.getBoundingClientRect();
    const w2 = el.offsetWidth, ht = el.offsetHeight;
    let x = ar.right - br.left + body.scrollLeft + 10;
    if (x + w2 > body.scrollLeft + body.clientWidth - 6) x = ar.left - br.left + body.scrollLeft - w2 - 10;
    x = Math.max(body.scrollLeft + 4, x);
    let y = ar.top - br.top + body.scrollTop - 6;
    y = Math.max(body.scrollTop + 4, Math.min(y, body.scrollTop + body.clientHeight - ht - 6));
    el.style.left = x + "px";
    el.style.top = y + "px";
  }
  var pctDelta = (a, b) => b / Math.max(0.01, a) - 1;
  var fmtPct = (d) => `${d >= 0 ? "+" : ""}${(d * 100).toFixed(Math.abs(d) < 0.1 ? 1 : 0)}%`;
  function skillsView(c) {
    const hero = c.state.hero;
    const cur = c.sheet();
    const colourOf = (tags) => tags.includes("spell") ? "#3a7bff" : tags.some((t) => t === "projectile" || t === "bow") ? "#3fbf5f" : tags.some((t) => t === "attack" || t === "melee") ? "#e5383b" : "#e6d9b8";
    const gem = (colour, big = false, size = big ? 36 : 26) => h("span", { class: `gem${big ? " big" : ""}`, style: `color:${colour}` }, glyph("gem", size), h("span", { class: "shine" }, glyph("gemshine", size)));
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
        h("div", { class: "nm" }, gem(colourOf(s.tags), false, 14), h("span", { text: s.name })),
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
          swap ? h("span", { class: "muted", style: "font-size:8px", text: `for ${SUPPORTS[swap]?.name ?? swap}` }) : null
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
        h("div", { class: "nm" }, gem(colourOf(s.requires), false, 14), h("span", { text: s.name })),
        h("div", { class: "meta" }, meta),
        h("div", { class: "ds", text: s.blurb + (s.requires.length ? `  Needs: ${s.requires.join(" or ")}.` : "") })
      ));
    }
    const next = [1, 1, 8, 18, 32].find((l) => l > hero.level);
    const main = SKILLS[hero.skill];
    const links = h(
      "div",
      { class: "links" },
      h("div", { class: "sock main", title: main?.blurb ?? "" }, gem(colourOf(cur.skill.tags), true), h("b", { text: main?.name ?? hero.skill }))
    );
    [1, 1, 8, 18, 32].forEach((lvl, i) => {
      links.append(h("span", { class: `link${i < slots ? "" : " off"}`, attrs: { "aria-hidden": "true" } }));
      const id = active[i];
      const sup = id ? SUPPORTS[id] : void 0;
      if (sup) {
        const row = rows.find((r3) => r3.s.id === id);
        links.append(h(
          "button",
          {
            class: "sock",
            title: `${sup.name}: ${sup.blurb} Click to take it out.${row?.d != null ? ` Worth ${fmtPct(-row.d)} pack DPS.` : ""}`,
            on: { click: () => c.act((st) => setSupports(st, active.filter((x) => x !== id)), `${sup.name} removed`) }
          },
          gem(colourOf(sup.requires)),
          h("b", { text: sup.name })
        ));
      } else if (i < slots) {
        links.append(h("div", { class: "sock empty", title: "An empty socket: pick a support below" }, h("span", { class: "hole" }, glyph("socket", 26)), h("b", { text: "Empty" })));
      } else {
        links.append(h("div", { class: "sock locked", title: `Opens at level ${lvl}` }, h("span", { class: "hole" }, glyph("socket", 26)), h("b", { text: `Level ${lvl}` })));
      }
    });
    const bar2 = h("div", { class: "card socketbar" }, h("h3", { text: "Skill links" }), links);
    return h("div", { class: "col", style: "gap:14px" }, bar2, h(
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
    ));
  }
  var openActs = /* @__PURE__ */ new Set();
  function worldView(c) {
    const st = c.state;
    const root = h("div", { class: "col", style: "gap:14px" });
    const inMaps = st.activity.mode === "map";
    const push = h(
      "button",
      {
        class: `toggle${st.activity.autoPush ? " on" : ""}`,
        attrs: { role: "switch", "aria-checked": String(st.activity.autoPush) },
        on: { click: () => c.act((s) => {
          s.activity.autoPush = !s.activity.autoPush;
        }) }
      },
      h("i"),
      h("span", null, h("b", { text: "Auto-push" }), h("small", { text: "Move on after 3 clean clears, fall back after 3 deaths (in maps: 2 failed maps), take trials when out-levelled." }))
    );
    root.append(push, contractBoard(c), shrineCard(c));
    if (inMaps) root.append(h("div", { class: "note" }, glyph("atlas", 16), h("span", { text: "The hero is running maps (Atlas tab). Picking a place here leaves the maps after the current one." })));
    const hc = HERO_CAST[st.hero.cls];
    for (const act of ACTS) {
      if (!act.zones.some((z) => st.world.unlocked.includes(z))) continue;
      const done = !!st.world.clears[act.zones[act.zones.length - 1]];
      const current = !inMaps && (act.zones.includes(st.activity.zone) || act.trial === st.activity.zone);
      if (done && !current && !openActs.has(act.id)) {
        const total = act.zones.reduce((a, z) => a + (st.world.clears[z] ?? 0), 0);
        root.append(h(
          "div",
          { class: "card act folded" },
          h("h3", { text: `Act ${act.id} - ${act.name}` }),
          h(
            "div",
            { class: "row" },
            h("span", { class: "tag done", text: "Cleared" }),
            h("span", { class: "muted grow", text: `${act.zones.length} places, ${fmt(total)} clears. Open it to go back and farm.` }),
            h("button", { class: "btn alt small", text: "Open road", on: { click: () => {
              openActs.add(act.id);
              c.rerender();
            } } })
          )
        ));
        continue;
      }
      const road = h("div", { class: "road" });
      const stop = (id, n) => {
        const z = ZONES[id];
        const open = st.world.unlocked.includes(id);
        const here = st.activity.mode === "zone" && st.activity.zone === id;
        const clears = st.world.clears[id] ?? 0;
        const thumb = scenery(z, 112, 62);
        thumb.className = "thumb";
        const el = h(
          "button",
          {
            class: `stop${here ? " here" : ""}${open ? "" : " locked"}${z.trial ? " trial" : ""}${z.boss ? " boss" : ""}`,
            attrs: { "aria-label": `${z.name}, area level ${z.level}${open ? `, ${clears} clears` : ", locked"}` },
            title: open ? z.story ?? z.name : "Not reached yet",
            on: { click: () => {
              if (open && !here) c.act((s) => setZone(s, id), `Travelling to ${z.name}`);
            } }
          },
          h(
            "div",
            { class: "pic" },
            thumb,
            h("span", { class: "num-badge", text: n }),
            z.boss ? h("span", { class: "flag boss", text: "Boss" }) : z.trial ? h("span", { class: "flag trial", text: "Trial" }) : null,
            here && hc ? (() => {
              const a = spriteCanvas(hc.idle);
              if (a) a.className = "hero-mark";
              return a;
            })() : null,
            open ? null : h("span", { class: "lock" }, glyph("block", 18))
          ),
          h("b", { text: z.name }),
          h("span", { class: "meta" }, h("span", { class: "tag", text: `L${z.level}` }), h("span", { text: open ? `${clears} clear${clears === 1 ? "" : "s"}` : "locked" }))
        );
        return el;
      };
      act.zones.forEach((id, i) => {
        if (i) road.append(h("span", { class: `path${st.world.unlocked.includes(id) ? "" : " dim"}`, attrs: { "aria-hidden": "true" } }));
        road.append(stop(id, String(i + 1)));
      });
      const trial = h("div", { class: "trialrow" }, h("span", { class: "sub", text: "Off the road" }), stop(act.trial, "T"));
      root.append(h(
        "div",
        { class: "card act" },
        h("h3", { text: `Act ${act.id} - ${act.name}` }),
        h("div", { class: "story muted", text: done ? act.outro : act.intro }),
        road,
        trial,
        done && !current ? h(
          "div",
          { class: "row", style: "justify-content:flex-end;margin-top:8px" },
          h("button", { class: "btn alt small", text: "Fold road", on: { click: () => {
            openActs.delete(act.id);
            c.rerender();
          } } })
        ) : null
      ));
    }
    requestAnimationFrame(() => {
      const here = root.querySelector(".stop.here");
      const body = root.closest(".body");
      if (here && body && body.scrollTop === 0) {
        const top = here.getBoundingClientRect().top - body.getBoundingClientRect().top;
        if (top > body.clientHeight - 60) body.scrollTop = top - 80;
      }
    });
    return root;
  }
  var CONTRACT_GLYPH = { kills: "skills", champions: "chaos", bosses: "atlas", runs: "world", maps: "atlas", rares: "gem" };
  function contractBoard(c) {
    const st = c.state;
    const cost = rerollCost(st);
    const rows = h("div", { class: "contracts" });
    st.contracts.list.forEach((k, i) => {
      const done = k.n >= k.target;
      rows.append(h(
        "div",
        { class: `contract${done ? " done" : ""}` },
        h("span", { class: "cg" }, glyph(CONTRACT_GLYPH[k.kind], 16)),
        h(
          "div",
          { class: "grow col", style: "gap:3px;min-width:0" },
          h("b", { text: contractText(k) }),
          h("div", { class: "meter" }, h("i", { style: `width:${Math.min(100, k.n / k.target * 100).toFixed(1)}%` }), h("span", { class: "num", text: `${fmt(k.n)} / ${fmt(k.target)}` })),
          h("span", { class: "muted", style: "font-size:12px", text: `Reward: ${rewardText(k, st)}` })
        ),
        done ? h("button", { class: "btn small", text: "Claim", on: { click: () => c.act((s) => claimContract(s, i), "Contract claimed") } }) : h("button", {
          class: "btn alt small",
          text: `Reroll ${fmt(cost)}`,
          title: `A different contract for ${fmt(cost)} ember dust; progress on this one is lost`,
          attrs: st.dust >= cost ? {} : { disabled: "" },
          on: { click: () => c.act((s) => rerollContract(s, i)) }
        })
      ));
    });
    return h("div", { class: "card" }, h("h3", { class: "split" }, h("span", { text: "Contract board" }), h("span", { class: "num", text: `${fmt(st.contracts.done)} done` })), rows);
  }
  function shrineSig(s) {
    const cost = blessingCost(s);
    return `${BLESSINGS.map((b) => Math.ceil(Math.max(0, (s.blessings[b.id] ?? 0) - s.simTo) / 6e4)).join(",")}:${s.dust >= cost}:${spareOrbValue(s) + s.dust >= cost}:${s.shrine.keep.join(",")}:${s.shrine.orbs}`;
  }
  var BLESS_GLYPH = { insight: "regen", fortune: "gem", plenty: "gear", hoard: "forge" };
  function shrineCard(c) {
    const st = c.state;
    const cost = blessingCost(st);
    const spare = spareOrbValue(st);
    const canPay = st.dust + (st.shrine.orbs ? spare : 0) >= cost;
    const rows = h("div", { class: "contracts" });
    for (const b of BLESSINGS) {
      const left = Math.max(0, (st.blessings[b.id] ?? 0) - st.simTo);
      const keep = st.shrine.keep.includes(b.id);
      rows.append(h(
        "div",
        { class: `contract bless${left ? " done" : ""}` },
        h("span", { class: "cg" }, glyph(BLESS_GLYPH[b.id] ?? "gem", 16)),
        h(
          "div",
          { class: "grow col", style: "gap:2px;min-width:0" },
          h("b", { text: `${b.name}: ${b.text.replace("{0}", String(b.value))}` }),
          h("span", { class: "muted", style: "font-size:12px", text: left ? `${fmtDuration(left)} left${keep ? ", kept up" : ""}` : keep ? "Kept up: renews when it can be paid" : "Not running" })
        ),
        h("button", {
          class: `chip${keep ? " on" : ""}`,
          attrs: { role: "switch", "aria-checked": String(keep) },
          title: "Offer again on its own whenever it runs out (while it can be paid)",
          on: { click: () => c.act((s) => {
            setKeep(s, b.id, !keep);
            if (!keep && !left) return bless(s, b.id);
          }) }
        }, "Keep up"),
        h("button", {
          class: "btn small",
          text: `+1 h`,
          title: `An hour of ${b.name} for ${fmt(cost)} dust${st.shrine.orbs ? " (spare orbs pay first)" : ""}`,
          attrs: canPay ? {} : { disabled: "" },
          on: { click: () => c.act((s) => bless(s, b.id), `${b.name} blessed`) }
        })
      ));
    }
    const orbs = h(
      "button",
      {
        class: `toggle${st.shrine.orbs ? " on" : ""}`,
        attrs: { role: "switch", "aria-checked": String(st.shrine.orbs) },
        on: { click: () => c.act((s) => {
          s.shrine.orbs = !s.shrine.orbs;
        }) }
      },
      h("i"),
      h("span", null, h("b", { text: "Spare orbs pay first" }), h("small", { text: `Orbs above ${ORB_RESERVE} of a kind count at their shop price (now worth ${fmt(spare)} dust).` }))
    );
    return h(
      "div",
      { class: "card" },
      h("h3", { class: "split" }, h("span", { text: "Ember shrine" }), h("span", { class: "num", text: `${fmt(cost)} dust / hour` })),
      h("div", { class: "muted", style: "font-size:12px;margin-bottom:8px", text: "Blessings run on the hero's time, so they count while you are away too." }),
      rows,
      h("div", { style: "margin-top:8px" }, orbs)
    );
  }
  var LOG_GLYPH = { level: "regen", loot: "gem", death: "chaos", zone: "world", boss: "atlas", info: "log" };
  var LOG_KINDS = { level: ["Level", "var(--gold)"], loot: ["Loot", "var(--r-enchanted)"], death: ["Death", "var(--ember)"], zone: ["Road", "var(--teal)"], boss: ["Boss", "var(--violet)"], info: ["Note", "var(--paper2)"] };
  var logFilter = "all";
  function logView(c) {
    const log = c.state.log;
    const n = (k) => log.filter((e2) => e2.kind === k).length;
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
    for (const e2 of [...log].reverse()) {
      if (logFilter !== "all" && e2.kind !== logFilter) continue;
      const [label, color] = LOG_KINDS[e2.kind] ?? [e2.kind, "var(--paper2)"];
      el.append(h(
        "div",
        { class: `entry k-${e2.kind}` },
        h("span", { class: "lg", style: `background:${color}`, title: label }, glyph(LOG_GLYPH[e2.kind] ?? "log", 14)),
        h("span", { class: "grow", text: e2.text }),
        h("span", { class: "muted num when", text: e2.t > 1e12 ? `${fmtAgo(now - e2.t)}` : "" })
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
    const auto = h(
      "button",
      { class: `toggle${st.settings.autoEquip ? " on" : ""}`, attrs: { role: "switch", "aria-checked": String(st.settings.autoEquip) }, on: { click: () => c.act((s) => {
        s.settings.autoEquip = !s.settings.autoEquip;
      }) } },
      h("i"),
      h("span", null, h("b", { text: "Equip upgrades" }), h("small", { text: "Wear a drop straight away when it raises the build score; on level-ups, the stash's too." }))
    );
    const upkeep = h(
      "button",
      { class: `toggle${st.settings.upkeep ? " on" : ""}`, attrs: { role: "switch", "aria-checked": String(st.settings.upkeep) }, on: { click: () => c.act((s) => {
        s.settings.upkeep = !s.settings.upkeep;
      }) } },
      h("i"),
      h("span", null, h("b", { text: "Stash upkeep" }), h("small", { text: "When the stash is full, a better keeper replaces its least-worth unlocked item instead of being salvaged." }))
    );
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
        auto,
        upkeep,
        filterEditor(c),
        h("div", { class: "row" }, "Otherwise", keep),
        h("div", { class: "muted", style: "font-size:12px", text: "Rules run top to bottom; the first match decides. Salvaged items become ember dust." })
      ),
      h(
        "div",
        { class: "card col" },
        h("h3", { text: "Save" }),
        h("div", { class: "muted", style: "font-size:12px", text: `Saved in ${c.storeKind === "indexeddb" ? "this Discord profile (IndexedDB)" : "memory only: export to keep it"}.` }),
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
          void c.importSave(inp.value).then((e2) => c.toast(e2 ?? "Save loaded"));
        } } }))
      ),
      h("div", { class: "card" }, h("h3", { text: "Totals" }), kv([
        ["Runs", fmt(t.runs)],
        ["Kills", fmt(t.kills)],
        ["Deaths", fmt(t.deaths)],
        ["Items found", fmt(t.items)],
        ["Salvaged", fmt(t.salvaged)],
        ["Swapped out by upkeep", fmt(t.swapped ?? 0)],
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
        h("button", { class: "x", text: "^", title: "Move up", attrs: i === 0 ? { disabled: "", "aria-label": "Move up" } : { "aria-label": "Move up" }, on: { click: () => edit((rs) => {
          if (i > 0) [rs[i - 1], rs[i]] = [rs[i], rs[i - 1]];
        }) } }),
        h("button", { class: "x", text: "x", title: "Delete", attrs: { "aria-label": `Delete rule: ${describeRule(r3)}` }, on: { click: () => edit((rs) => {
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
    const behind = h("select", { attrs: { "aria-label": "Base level behind the hero" } });
    for (const v of ["0", "5", "10", "20"]) behind.append(h("option", { text: v === "0" ? "any base" : `base ${v}+ behind`, attrs: { value: v } }));
    const group = h("select", { attrs: { "aria-label": "Has an affix" } });
    group.append(h("option", { text: "any affix", attrs: { value: "" } }));
    for (const g of AFFIX_GROUPS()) group.append(h("option", { text: `with ${g.label}`, attrs: { value: g.group } }));
    box2.append(h(
      "div",
      { class: "row", style: "gap:4px" },
      action,
      rarity,
      slot,
      minAff,
      behind,
      group,
      h("button", { class: "btn alt", text: "Add rule", on: { click: () => edit((rs) => {
        const r3 = { on: true, action: action.value };
        if (rarity.value) r3.rarity = [rarity.value];
        if (slot.value) r3.slots = [slot.value];
        if (+minAff.value) r3.minAffixes = +minAff.value;
        if (+behind.value) r3.behind = +behind.value;
        if (group.value) r3.group = group.value;
        rs.push(r3);
      }) } }),
      h("button", { class: "btn alt", text: "Reset", on: { click: () => edit((rs) => {
        rs.splice(0, rs.length, ...structuredClone(DEFAULT_FILTER));
      }) } })
    ));
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    box2.append(h(
      "div",
      { class: "row presets", style: "gap:4px;margin-top:4px" },
      h("span", { class: "muted", style: "font-size:12px", text: "Presets:" }),
      ...FILTER_PRESETS.map((p) => h("button", {
        class: `chip${same(rules, p.rules) ? " on" : ""}`,
        text: p.name,
        title: p.blurb,
        on: { click: () => edit((rs) => {
          rs.splice(0, rs.length, ...structuredClone(p.rules));
        }) }
      }))
    ));
    return box2;
  }
  var CALLING_SCENE = { vanguard: "a1_lock", strider: "a1_cliffs", arcanist: "a1_chapel" };
  var SCENE_W = 120;
  var SCENE_H = 84;
  function callingScene(cls, bg, into, frame) {
    const g = into.getContext("2d");
    g.imageSmoothingEnabled = false;
    g.drawImage(bg, 0, 0);
    const hc = HERO_CAST[cls];
    if (!hc) return;
    const ground = SCENE_H - Math.max(6, Math.round(SCENE_H * 0.12));
    g.fillStyle = "rgba(0,0,0,.35)";
    g.beginPath();
    g.ellipse(SCENE_W / 2, ground, 14, 3, 0, 0, Math.PI * 2);
    g.fill();
    if (!drawSprite(g, hc.idle, frame, SCENE_W / 2, ground)) drawText(g, "LOADING", SCENE_W / 2, SCENE_H / 2 - 3, "#b5a48b", "center");
  }
  function creationView(onStart) {
    const name = h("input", { attrs: { type: "text", maxlength: "20", value: "Ashling", "aria-label": "Hero name", spellcheck: "false", autocomplete: "off" } });
    let cls = Object.keys(CLASSES)[0];
    const start = () => onStart(name.value.replace(/[^ -~]/g, "").trim().slice(0, 20) || "Ashling", cls);
    name.addEventListener("keydown", (e2) => {
      if (e2.key === "Enter") {
        e2.preventDefault();
        start();
      }
    });
    const grid = h("div", { class: "callings", attrs: { role: "radiogroup", "aria-label": "Calling" } });
    let live = null;
    const draw2 = () => {
      clear(grid);
      live = null;
      for (const k of Object.values(CLASSES)) {
        const on = k.id === cls;
        const bg = scenery(ZONES[CALLING_SCENE[k.id] ?? "a1_shore"], SCENE_W, SCENE_H);
        const pic = h("canvas", { class: "cscene", attrs: { width: String(SCENE_W), height: String(SCENE_H), "aria-hidden": "true" } });
        callingScene(k.id, bg, pic, 0);
        if (on) live = { cls: k.id, bg, c: pic };
        const attrs = [["might", "Might", k.str], ["grace", "Grace", k.dex], ["wit", "Wit", k.int]].map(([gl, label, v]) => h("span", { class: `cattr ${gl}`, title: label }, glyph(gl, 14), h("b", { class: "num", text: String(v) }), h("small", { text: label })));
        grid.append(h(
          "button",
          {
            class: `calling${on ? " on" : ""}`,
            style: `--cc:${k.color}`,
            attrs: { role: "radio", "aria-checked": String(on) },
            on: { click: () => {
              if (cls !== k.id) {
                cls = k.id;
                draw2();
                grid.querySelector(".calling.on")?.focus();
              }
            } }
          },
          h("span", { class: "cpic" }, pic, on ? h("span", { class: "cpick", text: "Chosen" }) : null),
          h("span", { class: "cname", text: k.name }),
          h("span", { class: "cattrs" }, ...attrs),
          h("span", { class: "ds", text: k.blurb }),
          h("span", { class: "ds muted", text: `Starts with ${SKILLS[k.startSkill].name} and a ${BASES[k.startWeapon].name}.` })
        ));
      }
    };
    draw2();
    void loadSprites().then(() => {
      if (grid.isConnected) draw2();
    });
    let f = 0;
    const timer = window.setInterval(() => {
      if (!root.isConnected && f > 20) {
        clearInterval(timer);
        return;
      }
      f++;
      if (live) callingScene(live.cls, live.bg, live.c, f);
    }, 150);
    const root = h(
      "div",
      { class: "create" },
      h("div", { class: "card story", text: "The sun of the March went out three hundred years ago. What is left of it fell as embers, and whoever holds one does not stay dead." }),
      h("div", { class: "sec", text: "Choose a calling" }),
      grid,
      h(
        "div",
        { class: "card col" },
        h("h3", { text: "Name your Kindled" }),
        h("div", { class: "row namebar" }, name, h("button", { class: "btn hot", text: "Wake up", on: { click: start } })),
        h("div", { class: "muted", style: "font-size:12px", text: "Up to 20 letters, numbers and spaces. Enter wakes them." })
      )
    );
    return root;
  }

  // src/ui/app.ts
  var GEO_KEY = "window";
  var UI_KEY = "frame";
  var QUICK_KEY = "quicksave";
  var BACKUP_MS = 5 * 6e4;
  var AUTOSAVE_MS = 2e4;
  var REPORT_MIN_MS = 6e4;
  var MINI_W = 320;
  var MINI_STAGE_H = 84;
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
    sound = new Sound({ on: false, volume: 0.35 });
    /** When the hero last swung or cast (performance.now()), for the skill slot's cooldown sweep. */
    lastUse = 0;
    nav;
    who;
    miniBtn;
    maxBtn;
    miniBox;
    /** Mini strip rows: the last notable event, a dialog waiting for the full window, the replay progress. */
    miniLast;
    miniNote;
    miniProg;
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
    frame = { stage: "m", mini: false, max: false, sfx: false, volume: 0.35 };
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
      if (!this.state) {
        this.flash();
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
      void loadPixelFont();
      const style = document.createElement("style");
      style.textContent = CSS;
      this.root.append(style);
      this.stopKeys = (e2) => e2.stopPropagation();
      for (const k of STOP_EVENTS) host.addEventListener(k, this.stopKeys);
      const f = this.kv.get(UI_KEY);
      if (f && typeof f === "object") {
        if (f.stage === "l" || f.stage === "m" || f.stage === "off") this.frame.stage = f.stage;
        this.frame.mini = f.mini === true;
        this.frame.max = f.max === true;
        this.frame.sfx = f.sfx === true;
        if (typeof f.volume === "number" && f.volume >= 0 && f.volume <= 1) this.frame.volume = f.volume;
      }
      this.sound.set(this.frame.sfx, this.frame.volume);
      const dark = this.hooks.theme?.() === "dark";
      const shell = h("div", { class: `hm${dark ? " dark" : ""}` });
      for (const [k, v] of Object.entries(frameVars(dark))) shell.style.setProperty(k, v);
      const ctl = (g, title, fn, cls = "") => {
        const b = h("button", { class: `ctl ${cls}`, title, attrs: { "aria-label": title }, on: { click: fn } }, glyph(g, 12));
        return b;
      };
      this.who = h("span", { class: "who" });
      this.stageBtn = ctl("stage", STAGE_TITLE.m, () => this.setStage(STAGE_NEXT[this.frame.stage]), "sz");
      this.miniBtn = ctl("min", "Mini mode: keeps playing in a small strip", () => this.setMini(!this.frame.mini), "mn");
      this.maxBtn = ctl("max", "Maximize (double-click the title)", () => this.setMax(!this.frame.max), "mx");
      this.soundBtn = ctl("mute", "Sound off (click or M to unmute)", () => this.setSound(!this.frame.sfx), "snd");
      const bar2 = h(
        "div",
        { class: "bar" },
        h("span", { class: "logo", text: "Hollowmarch" }),
        this.who,
        h("span", { class: "ctls" }, this.soundBtn, this.stageBtn, this.miniBtn, this.maxBtn, ctl("close", "Close (the road keeps going; it is replayed on open)", () => void this.close(), "x"))
      );
      bar2.addEventListener("dblclick", (e2) => {
        if (!e2.target.closest("button")) this.setMax(!this.frame.max);
      });
      this.miniLast = h("div", { class: "mlast", attrs: { "aria-live": "polite" } });
      this.miniNote = h("button", { class: "mnote", attrs: { hidden: "" }, on: { click: () => this.setMini(false) } });
      this.miniProg = h("div", { class: "mprog", attrs: { hidden: "" } }, h("span"), h("div", { class: "progress" }, h("i")));
      this.miniBox = h("div", { class: "minibox" }, this.miniProg, this.miniNote, this.miniLast);
      this.stage = h("div", { class: "stage" }, this.battle.canvas, this.miniBox);
      this.top = h("div", { class: "top" }, this.stage);
      this.stage.addEventListener("dblclick", (e2) => {
        if (this.frame.mini && !e2.target.closest("button")) this.setMini(false);
      });
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
      this.toasts = h("div", { class: "toasts", attrs: { "aria-live": "polite" } });
      const grip = h("div", { class: "grip", attrs: { "aria-hidden": "true" } });
      this.win = h("div", { class: "win", attrs: { role: "dialog", "aria-label": "Hollowmarch" } }, bar2, this.top, this.hudWrap, main, this.toasts, grip);
      shell.append(this.win);
      this.root.append(shell);
      document.body.append(host);
      this.placeWindow();
      this.tips = installTips(this.win, this.win);
      this.dragger(bar2, (dx, dy, g) => {
        g.x += dx;
        g.y += dy;
      });
      this.dragger(this.stage, (dx, dy, g) => {
        g.x += dx;
        g.y += dy;
      }, () => this.frame.mini);
      this.dragger(grip, (dx, dy, g) => {
        g.w += dx;
        g.h += dy;
      });
      this.win.tabIndex = -1;
      this.win.addEventListener("keydown", (e2) => {
        const t = e2.target;
        if (t.closest("input, textarea, select")) return;
        if ((e2.key === "Enter" || e2.key === " ") && t.getAttribute("role") === "button" && t.tagName !== "BUTTON") {
          t.click();
          e2.preventDefault();
          return;
        }
        if (e2.key === "Escape") {
          if (this.frame.mini) return;
          const modals = this.win.querySelectorAll(".modal");
          const top = modals[modals.length - 1];
          if (top) {
            if (!top.querySelector(".progress")) {
              top.remove();
              e2.preventDefault();
            }
            return;
          }
          const esc = this.body.querySelector("[data-esc]");
          if (esc) {
            esc.click();
            e2.preventDefault();
          }
          return;
        }
        if (e2.ctrlKey || e2.altKey || e2.metaKey || this.frame.mini || this.win.querySelector(".modal")) return;
        const n = Number(e2.key);
        if (n >= 1 && n <= VIEWS.length) {
          this.nav.children[n - 1]?.click();
          e2.preventDefault();
          return;
        }
        if (e2.key === "m" || e2.key === "M") {
          this.setSound(!this.frame.sfx);
          e2.preventDefault();
          return;
        }
        const k = e2.key.length === 1 ? e2.key.toLowerCase() : "";
        const hot = k && /^[a-z]$/.test(k) ? this.body.querySelector(`[data-key="${k}"]:not([disabled])`) : null;
        if (hot) {
          hot.click();
          e2.preventDefault();
        }
      });
      this.applyFrame();
      pixelize(this.nav);
      void loadSprites().then(() => {
        if (this.state && this.ctx) {
          this.sig = "";
          this.renderTab(true);
        }
      });
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
        const top = this.topReserve();
        g2.w = Math.max(380, Math.min(g2.w, vw - 8));
        g2.h = Math.max(340, Math.min(g2.h, vh - top - 8));
        g2.x = Math.max(0, Math.min(g2.x, vw - (this.frame.mini ? MINI_W : g2.w)));
        g2.y = Math.max(top, Math.min(g2.y, vh - (this.frame.mini ? MINI_STAGE_H + HUD_H + 12 : g2.h)));
        const hudAt = (cssW, scale) => {
          this.hud.resize(cssW / scale);
          this.hud.canvas.style.width = cssW + "px";
          this.hud.canvas.style.height = HUD_H * scale + "px";
        };
        if (this.frame.mini) {
          Object.assign(this.win.style, { left: g2.x + "px", top: g2.y + "px", width: MINI_W + "px", height: "" });
          hudAt(MINI_W - 6, 1);
          this.stage.style.height = MINI_STAGE_H + "px";
          this.battle.resize(MINI_W - 6, MINI_STAGE_H);
          Object.assign(this.battle.canvas.style, { width: MINI_W - 6 + "px", height: MINI_STAGE_H + "px" });
          return;
        }
        const box2 = this.frame.max ? { x: 8, y: top + 8, w: vw - 16, h: vh - top - 16 } : g2;
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
    reserve = { at: -1e9, px: 0 };
    /**
     * How far down Discord's title bar reaches (its window buttons live there), measured
     * from whatever sits at the top-right corner: a full-width strip under 64px tall.
     */
    topReserve() {
      const now = performance.now();
      if (now - this.reserve.at < 1500) return this.reserve.px;
      let px = 0;
      const hit = document.elementsFromPoint(window.innerWidth - 12, 3).find((el) => el !== this.host && !this.host?.contains(el));
      for (let e2 = hit ?? null; e2 && e2 !== document.body && e2 !== document.documentElement; e2 = e2.parentElement) {
        const b = e2.getBoundingClientRect();
        if (b.top <= 0 && b.height > 0 && b.height <= 64 && b.width >= window.innerWidth * 0.5) {
          px = Math.round(b.bottom);
          break;
        }
      }
      this.reserve = { at: now, px };
      return px;
    }
    applyFrame() {
      const f = this.frame;
      this.win.classList.toggle("mini", f.mini);
      this.win.classList.toggle("max", f.max && !f.mini);
      this.top.classList.toggle("nostage", f.stage === "off");
      this.stageBtn.dataset.tip = STAGE_TITLE[f.stage];
      this.stageBtn.setAttribute("aria-label", STAGE_TITLE[f.stage]);
      const setGlyph = (b, g, title) => {
        b.replaceChildren(glyph(g, 12));
        b.removeAttribute("title");
        b.dataset.tip = title;
        b.setAttribute("aria-label", title);
      };
      setGlyph(this.miniBtn, f.mini ? "max" : "min", f.mini ? "Back to the full window" : "Mini mode: keeps playing in a small strip");
      setGlyph(this.maxBtn, f.max ? "restore" : "max", f.max ? "Restore size (double-click the title)" : "Maximize (double-click the title)");
      setGlyph(this.soundBtn, f.sfx ? "sound" : "mute", f.sfx ? "Sound on (click or M to mute)" : "Sound off (click or M to unmute)");
      this.soundBtn.classList.toggle("off", !f.sfx);
      this.refit();
    }
    saveFrame() {
      this.kv.set(UI_KEY, { ...this.frame });
    }
    setMini(on) {
      if (on && !this.state) return;
      this.frame.mini = on;
      this.saveFrame();
      this.applyFrame();
      if (!on) {
        this.sig = "";
        this.renderTab(true);
        this.focusModal();
      }
      this.syncMini();
      this.hooks.onMini?.(on);
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
      this.frame.sfx = on;
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
    dragger(handle, apply, when = () => true) {
      handle.addEventListener("pointerdown", (e2) => {
        if (e2.target.closest("button") || e2.button !== 0 || !when()) return;
        if (this.frame.max && handle !== this.win.querySelector(".grip")) {
          this.frame.max = false;
          this.saveFrame();
          this.applyFrame();
        }
        if (this.frame.max) return;
        e2.preventDefault();
        handle.setPointerCapture(e2.pointerId);
        let lx = e2.clientX, ly = e2.clientY;
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
      } catch (e2) {
        console.warn("[Hollowmarch] quick save unusable:", e2);
      }
      for (const key of ["main", "backup"]) {
        try {
          const raw = await this.store.get(key);
          if (!raw) continue;
          const env = _GameWindow.accept(raw);
          this.state = quick && quick.savedAt > env.savedAt ? quick.state : env.state;
          this.lastBackup = Date.now();
          return true;
        } catch (e2) {
          console.warn(`[Hollowmarch] save "${key}" unusable:`, e2);
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
      } catch (e2) {
        console.warn("[Hollowmarch] save failed:", e2);
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
      const shown = away > 2e3;
      const closeModal = shown ? this.modal(h("div", { class: "card col" }, h("h3", { text: "While you were away" }), label, h("div", { class: "progress" }, bar2))) : () => {
      };
      const [miniLabel, miniBar] = [this.miniProg.firstElementChild, this.miniProg.querySelector("i")];
      this.miniProg.hidden = !shown;
      const from = s.simTo, target = Date.now();
      this.battle.quiet = true;
      while (!advance(s, target, rep.events, 25e3)) {
        const f = (s.simTo - from) / Math.max(1, target - from);
        bar2.style.width = miniBar.style.width = (f * 100).toFixed(1) + "%";
        label.textContent = miniLabel.textContent = `Replaying ${fmtDuration(target - from)}... ${(f * 100).toFixed(0)}%`;
        if (this.frame.mini) this.drawHud();
        await new Promise((r3) => setTimeout(r3, 0));
        if (!this.host) return;
      }
      this.battle.quiet = false;
      this.xpLog = [];
      this.miniProg.hidden = true;
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
        },
        companion: (id, isNew) => {
          const name = COMPANIONS[id]?.name ?? id;
          this.toast(isNew ? `Companion: ${name} joins you` : `${name} grows closer`, "relic");
          this.lastEvent = isNew ? `${name} joined` : `${name} grew closer`;
          sfx("level", true);
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
        if (this.frame.mini || this.frame.stage !== "off") this.battle.draw(this.state, runSheet(this.state), performance.now());
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
        hold: false,
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
          } catch (e2) {
            return e2 instanceof SaveError ? e2.message : "could not read that save";
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
    tips = { busy: () => false };
    lastSigCheck = 0;
    supportHint = { rev: -1, level: -1, gain: false };
    renderTab(force) {
      if (!this.state || !this.ctx) return;
      if (!force) {
        const t = performance.now();
        if (t - this.lastSigCheck < 250 || this.ctx.hold || this.tips.busy()) return;
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
      const FOCUSABLE = "button, select, input, textarea, [tabindex='0']";
      const active = this.root.activeElement;
      const focusAt = active && this.body.contains(active) ? [...this.body.querySelectorAll(FOCUSABLE)].indexOf(active) : -1;
      clear(this.body);
      this.body.append(renderView(this.view, this.ctx));
      pixelize(this.body);
      this.body.scrollTop = top;
      if (focusAt >= 0) this.body.querySelectorAll(FOCUSABLE)[focusAt]?.focus({ preventScroll: true });
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
        gear: s.stashFull ? ["!", "Stash is full: drops are being salvaged"] : void 0,
        world: claimable(s) ? [String(claimable(s)), `${claimable(s)} contract${claimable(s) > 1 ? "s" : ""} to claim`] : void 0
      };
      for (const b of this.nav.children) {
        const id = b.getAttribute("data-v");
        const badge = b.querySelector(".badge");
        const m4 = marks[id];
        const text = m4?.[0] ?? "";
        if (badge.textContent !== text) {
          badge.textContent = text;
          badge.toggleAttribute("hidden", !m4);
          badge.dataset.tip = m4?.[1] ?? "";
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
        dead: run?.phase === "dead",
        respawn: run?.phase === "dead" ? run.timer : 0
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
        const label = (run?.phase === "dead" ? `Dead: back in ${Math.ceil(run.timer)} seconds. ` : "") + `Life ${n(life)} of ${n(sh.life)}${sh.es ? `, energy shield ${n(es)} of ${n(sh.es)}` : ""}, mana ${n(mana)} of ${n(sh.mana)}, flask ${Math.floor(hh?.flask ?? 30)} of 30. Level ${s.hero.level}, ${(xpF * 100).toFixed(1)}% experience${eta ? ` (${eta})` : ""}. ${z.name}, area level ${z.level}. ${fmt(sh.skill.packDps)} pack DPS.`;
        this.hudWrap.setAttribute("aria-label", label);
        this.hudWrap.dataset.tip = label;
        if (this.miniLast.textContent !== this.lastEvent) this.miniLast.textContent = this.lastEvent;
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
    pingTimer = 0;
    toast(msg, kind = "") {
      if (this.frame.mini) {
        this.lastEvent = msg;
        this.miniLast.textContent = msg;
        this.miniLast.className = "mlast";
        void this.miniLast.offsetWidth;
        this.miniLast.className = `mlast ping${kind ? " t-" + kind : ""}`;
        clearTimeout(this.pingTimer);
        this.pingTimer = window.setTimeout(() => this.miniLast.classList.remove("ping"), 3200);
        return;
      }
      const t = h("div", { class: `toast${kind ? " t-" + kind : ""}`, text: msg });
      this.toasts.prepend(t);
      while (this.toasts.childElementCount > 4) this.toasts.lastElementChild.remove();
      setTimeout(() => {
        t.classList.add("out");
        setTimeout(() => t.remove(), 220);
      }, kind === "err" ? 3200 : 2600);
    }
    /**
     * A dialog over the window. In mini mode it waits hidden (the strip gets a row that
     * brings the window back); a click on the backdrop closes it, except the replay one.
     */
    modal(content) {
      const m4 = h("div", { class: "modal", attrs: { role: "dialog", "aria-modal": "true" } }, content);
      const title = content.querySelector("h3")?.textContent?.trim();
      if (title) m4.setAttribute("aria-label", title);
      const close = () => {
        if (!m4.isConnected) return;
        const hadFocus = m4.contains(this.root.activeElement);
        m4.remove();
        if (hadFocus && !this.focusModal()) this.win.focus();
        this.syncMini();
      };
      m4.addEventListener("click", (e2) => {
        if (e2.target === m4 && !m4.querySelector(".progress")) close();
      });
      this.win.append(m4);
      this.syncMini();
      if (this.frame.mini && !m4.querySelector(".progress")) this.flash();
      queueMicrotask(() => {
        pixelize(m4);
        this.focusModal();
      });
      return close;
    }
    /** Moves focus to the top dialog's first button, only if the player is in the game (never out of Discord's chat box). */
    focusModal() {
      if (!this.host || this.frame.mini || document.activeElement !== this.host) return false;
      const modals = this.win.querySelectorAll(":scope > .modal");
      const b = modals[modals.length - 1]?.querySelector("button, [tabindex]");
      b?.focus();
      return !!b;
    }
    /** The strip's row for dialogs that wait for the full window. */
    syncMini() {
      if (!this.miniNote) return;
      const waiting = [...this.win.querySelectorAll(":scope > .modal")].filter((m4) => !m4.querySelector(".progress"));
      const top = waiting[waiting.length - 1];
      this.miniNote.hidden = !top;
      if (!top) return;
      const title = top.getAttribute("aria-label") || "A message";
      this.miniNote.dataset.tip = `${title}: open the full window to read it`;
      this.miniNote.replaceChildren(glyph("log", 12), h("b", { text: title }), h("span", { text: waiting.length > 1 ? `${waiting.length} waiting - open` : "Open" }));
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
      pixelize(this.body);
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
        ["Ember dust", `+${fmt(r3.dust)}`],
        ...r3.swapped ? [["Swapped out by upkeep", fmt(r3.swapped)]] : []
      ];
      const kvEl = h("div", { class: "kv" });
      for (const [k, v] of rows) kvEl.append(h("div", { text: k }), h("div", { class: "num", text: v }));
      const card = h("div", { class: "card col" }, h("h3", { text: "While you were away" }), kvEl);
      for (const t of r3.story.slice(-3)) card.append(h("div", { class: "story", text: t }));
      if (r3.zones.length) card.append(h("div", { class: "tag teal", text: `New roads: ${r3.zones.join(", ")}` }));
      if (r3.equipped.length) card.append(h("div", { class: "tag gold", text: `Equipped: ${r3.equipped.slice(-4).join(", ")}` }));
      if (r3.newCompanions.length) card.append(h("div", { class: "tag gold", text: `New companion${r3.newCompanions.length > 1 ? "s" : ""}: ${r3.newCompanions.join(", ")}` }));
      if (r3.newRelics.length) card.append(h("div", { class: "tag", style: "background:var(--r-relic);color:#1a1410", text: `New in the codex: ${r3.newRelics.join(", ")}` }));
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
    const z = run ? runZone(s, run) : ZONES[s.activity.zone];
    return {
      name: s.hero.name,
      cls: s.hero.cls,
      level: s.hero.level,
      zone: z?.name ?? s.activity.zone,
      savedAt: Date.now(),
      xpFrac: isFinite(need) ? s.hero.xp / need : 1,
      zoneId: z?.id ?? s.activity.zone,
      sky: z?.palette[0]
    };
  }

  // src/ui/card.ts
  var CARD_CSS = `
:host { display: block; }
.hc { position: relative; margin: 8px 10px 14px 4px; border: 3px solid var(--line); background: var(--paper); box-shadow: 5px 5px 0 var(--line); }
.hc .bar { height: 30px; cursor: default; padding-right: 8px; }
.hc .logo { font-size: 16px; }
.hc .state { margin-left: auto; font: 700 12px/1 var(--display); font-stretch: condensed; letter-spacing: 1px; text-transform: uppercase; }
.hc .state.live { padding: 3px 6px; background: #1a1410; color: #19b3a3; }
.hc .in { display: flex; flex-direction: column; gap: 10px; padding: 10px; }
.hc .chero { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 10px; align-items: start; overflow: visible; white-space: normal; }
.hc .pic { line-height: 0; border: 8px solid transparent; border-image: var(--fr-sunk) 8 fill / 8px; }
.hc .pic canvas { image-rendering: pixelated; width: 176px; height: 132px; display: block; }
.hc .facts { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.hc .name { font: 700 16px/1.05 var(--display); font-stretch: condensed; letter-spacing: 1px; text-transform: uppercase; overflow-wrap: anywhere; }
.hc .facts .muted { font-size: 12px; }
.hc .xpbar { margin: 2px 0 0; }
.hc .xpl { font: 700 8px/1 var(--mono); color: var(--muted); }
.hc .acts { display: flex; gap: 8px; flex-wrap: wrap; }
.hc .acts .btn { flex: 1 1 auto; }
.hc .hint { font-size: 12px; color: var(--muted); }
.hc.new .chero { grid-template-columns: 1fr; }
.hc.new .pic canvas { width: 100%; height: auto; aspect-ratio: 4 / 3; }
`;
  function mountCard(el, api, summary, status, act) {
    void loadPixelFont();
    const holder = document.createElement("div");
    const root = holder.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = CSS + CARD_CSS;
    root.append(style);
    const dark = api.theme() === "dark";
    const wrap2 = h("div", { class: `hm${dark ? " dark" : ""}` });
    for (const [k, v] of Object.entries(frameVars(dark))) wrap2.style.setProperty(k, v);
    const stateText = status === "open" ? api.t("card.stateOpen") : status === "mini" ? api.t("card.stateMini") : "";
    const bar2 = h(
      "div",
      { class: "bar" },
      h("span", { class: "logo", text: api.t("title") }),
      stateText ? h("span", { class: "state live", text: stateText }) : h("span", { class: "state", text: "idle arpg" })
    );
    const inner = h("div", { class: "in" });
    const card = h("div", { class: `hc${summary ? "" : " new"}` }, bar2, inner);
    const pic = h("div", { class: "pic" });
    const paint2 = () => {
      let c;
      if (summary) {
        const z = summary.zoneId && ZONES[summary.zoneId] || { id: summary.zoneId ?? "", name: summary.zone, palette: [summary.sky ?? "#1a1410", "#111", "#111"] };
        c = portrait(z, summary.cls, 88, 66);
      } else c = scenery(ZONES.a1_shore, 120, 90);
      c.setAttribute("aria-hidden", "true");
      pic.replaceChildren(c);
    };
    paint2();
    void loadSprites().then(() => {
      if (holder.isConnected) paint2();
    });
    if (summary) {
      const zone = ZONES[summary.zone]?.name ?? summary.zone;
      const xp = Math.max(0, Math.min(1, summary.xpFrac));
      const seen = status === "closed" ? api.t("card.away", { time: fmtDuration(Math.max(0, Date.now() - summary.savedAt)) }) : status === "mini" ? api.t("card.inMini") : api.t("card.inWindow");
      inner.append(h("div", { class: "chero" }, pic, h(
        "div",
        { class: "facts" },
        h("div", { class: "name", text: summary.name }),
        h("div", { class: "muted", text: api.t("card.line", { level: summary.level, cls: CLASSES[summary.cls]?.name ?? summary.cls, zone }) }),
        h("div", { class: "xpbar", title: `${(xp * 100).toFixed(1)}%` }, h("i", { style: `width:${(xp * 100).toFixed(1)}%` })),
        h("div", { class: "xpl", text: `${(xp * 100).toFixed(0)}% XP` }),
        h("div", { class: "muted", text: seen })
      )));
    } else {
      inner.append(h("div", { class: "chero" }, pic, h("div", { class: "story", text: api.t("card.new") })));
    }
    const acts = h("div", { class: "acts" });
    if (status === "closed") acts.append(h("button", { class: "btn hot", text: summary ? api.t("card.play") : api.t("card.start"), on: { click: () => act.open() } }));
    else if (status === "open") acts.append(
      h("button", { class: "btn", text: api.t("card.show"), on: { click: () => act.open() } }),
      h("button", { class: "btn alt", text: api.t("card.fold"), on: { click: () => act.mini(true) } })
    );
    else acts.append(h("button", { class: "btn", text: api.t("card.unfold"), on: { click: () => act.mini(false) } }));
    inner.append(acts, h("div", { class: "hint", text: status === "closed" ? api.t("card.hint") : api.t("card.hintOpen") }));
    wrap2.append(card);
    root.append(wrap2);
    el.append(holder);
    pixelize(card);
    installTips(card, card);
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
    } catch (e2) {
      console.warn("[Hollowmarch] IndexedDB unavailable, progress will not persist:", e2);
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
    "arpg.card.show": "Show the window",
    "arpg.card.fold": "Fold to strip",
    "arpg.card.unfold": "Full window",
    "arpg.card.stateOpen": "Playing",
    "arpg.card.stateMini": "In the strip",
    "arpg.card.inWindow": "Playing now in its own window.",
    "arpg.card.inMini": "Playing now, folded into the mini strip.",
    "arpg.card.hint": "Opens in its own window. Nothing runs while it is closed; progress is replayed on open.",
    "arpg.card.hintOpen": "Closing the window pauses nothing: the time away is replayed on the next open."
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
  var REOPEN = "reopen";
  var tearingDown = false;
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
          if (!tearingDown) kv2.del(REOPEN);
          refreshCard?.();
          if (standalone) showOpener();
        },
        onMini: () => refreshCard?.()
      });
    }
    await game.open();
    if (game?.isOpen) (hub ? hubKV(hub) : localKV()).set(REOPEN, true);
    refreshCard?.();
  }
  var def = {
    id: ID,
    version: 1,
    icon: ICON,
    strings: STRINGS,
    init(api) {
      hub = api;
      const gen = ++generation;
      if (hubKV(api).get(REOPEN) === true) setTimeout(() => {
        if (gen === generation && hub === api && !game?.isOpen) void openGame();
      }, 1500);
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
      const draw2 = () => {
        view?.unmount();
        const o = api.load();
        const saved = o?.summary ?? (o && typeof o.level === "number" ? o : null);
        const status = game?.isOpen ? game.isMini ? "mini" : "open" : "closed";
        view = mountCard(el, api, saved && typeof saved.level === "number" ? saved : null, status, {
          open: () => void openGame(),
          mini: (on) => {
            if (game?.isOpen) game.setMini(on);
          }
        });
      };
      draw2();
      refreshCard = draw2;
      return { unmount() {
        view?.unmount();
        if (refreshCard === draw2) refreshCard = null;
      } };
    },
    destroy() {
      const g = game, gen = ++generation;
      game = null;
      tearingDown = true;
      void (g ? g.close() : Promise.resolve()).finally(() => {
        tearingDown = false;
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
