// Park and trail definitions
// To add a new park, add a new entry to PARKS with the same structure.

const PARKS = {
  twisted_oaks: {
    id: "twisted_oaks",
    name: "Twisted Oaks",
    location: "Brightwell, Ipswich, UK",
    coords: { lat: 52.03833778327689, lon: 1.2919455032460145 },
    mapImage: "twisted.jpg",
    mapNorthDeg: 270,  // map is rotated 90° CCW: N=left, E=top, S=right, W=bottom
    trails: [
      // ── Cross Country (out-and-back — both directions shown) ──
      // defaultHeading = best estimate from trail map; user can confirm/override in Admin Mode
      { id: "bxc", name: "BXC – Blue Cross Country", difficulty: "blue",  bidirectional: true, defaultHeading: 180 },
      { id: "rxc", name: "RXC – Red Cross Country",  difficulty: "red",   bidirectional: true, defaultHeading: 180 },
      { id: "blx", name: "BLX – Black Cross Country", difficulty: "black", bidirectional: true, defaultHeading: 180 },

      // ── Blue / Blue+ ───────────────────────────────────
      { id: "bm",           name: "BM – Bermalicious",             difficulty: "blue"   },
      { id: "tc",           name: "TC – Tea Cups",                 difficulty: "blue"   },
      { id: "mt",           name: "MT – Mouse Trap",               difficulty: "blue+"  },
      { id: "ds",           name: "DS – Dual Slalom",              difficulty: "blue+"  },
      { id: "je",           name: "JE – Jake & Elwood",            difficulty: "blue+"  },

      // ── Red / Red+ ─────────────────────────────────────
      { id: "bd",           name: "BD – Big Dipper",               difficulty: "red"    },
      { id: "t1",           name: "T1 – Toax 1",                   difficulty: "red"    },
      { id: "t2",           name: "T2 – Toax 2",                   difficulty: "red"    },
      { id: "st",           name: "ST – Skinny Tim-Buh",           difficulty: "red"    },
      { id: "dm",           name: "DM – Dropping in on Marty",     difficulty: "red"    },
      { id: "hs",           name: "HS – Helter Skelter",           difficulty: "red+"   },

      // ── Black ──────────────────────────────────────────
      { id: "rattrap",      name: "RT – Rat Trap",                 difficulty: "black"  },
      { id: "bt",           name: "BT – Badger Trap",              difficulty: "black"  },
      { id: "gr",           name: "GR – Growler",                  difficulty: "black"  },
      { id: "j23",          name: "23 – 23 Jump Street",           difficulty: "black"  },
      { id: "mo",           name: "MO – Moobs",                    difficulty: "black"  },
      { id: "pb",           name: "PB – Pin Ball",                 difficulty: "black"  },

      // ── Black+ ─────────────────────────────────────────
      { id: "ss",           name: "SS – Steezy or Sleazy",         difficulty: "black+" },
      { id: "ruhmtrousers", name: "RT – Ruhm Trousers",            difficulty: "black+" },

      // ── PRO Lines ──────────────────────────────────────
      { id: "fm",           name: "FM – Full Monty",               difficulty: "pro"    },
      { id: "or",           name: "OR – OrchRad",                  difficulty: "pro"    },

      // ── Jump Areas ─────────────────────────────────────
      { id: "j1",           name: "J1 – Dirt Jumps",                difficulty: "mixed" },
      { id: "j2",           name: "J2 – Jump Area (Training Zone)", difficulty: "blue"  },
      { id: "mj",           name: "MJ – Mulch Jumps",              difficulty: null     },
      { id: "ab",           name: "AB – Air Bag",                  difficulty: null     },

      // ── Other features ─────────────────────────────────
      { id: "fx",           name: "4X – Four Cross",               difficulty: null     },
      { id: "dz",           name: "DZ – Drop Zone",                difficulty: "mixed"  },
      { id: "hp",           name: "HP – Half Pipe",                difficulty: null     }
    ]
  }

  ,
  phoenix: {
    id: "phoenix",
    name: "Phoenix",
    location: "UK",
    coords: { lat: 52.27233555036601, lon: 0.5158397352408948 },
    mapImage: "Phoenix.png",
    trails: [
      { id: "shop_west", name: "Shop Side West", difficulty: null, defaultHeading: 270 },
      { id: "shop_east", name: "Shop Side East", difficulty: null, defaultHeading: 90  },
      { id: "dj_side",   name: "DJ Side",        difficulty: null, defaultHeading: 90  },
      { id: "asgard",    name: "Asgard Side",    difficulty: null, defaultHeading: 270 }
    ]
  }

  // To add another park, copy the structure above
};
