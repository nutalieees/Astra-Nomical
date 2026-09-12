import type { Planet } from "../../types/planet";

/**
 * 40-planet buffer set — a scope-flex safety net, kept SEPARATE from the
 * 5 demo-safe featured planets in planets-featured.ts.
 *
 * Purpose: if scope changes on the day (more planets, more variety, a
 * "browse the catalogue" mode), this list is ready to go without having to
 * pick-and-research planets under time pressure mid-hackathon.
 *
 * Curated for CATEGORY DIVERSITY, not just "40 random confirmed planets" —
 * spans habitable-zone rocky worlds, super-Earths, ultra-hot lava/gas
 * worlds, ordinary hot Jupiters, mini-Neptunes, directly-imaged giants,
 * circumbinary ("Tatooine") planets, pulsar planets, and a few scientific
 * oddities. Every name below is a real, confirmed object — this file
 * intentionally does NOT include speculative or disputed candidates.
 *
 * ⚠️ SCAFFOLD ONLY: all numeric fields are `undefined`. `name`, `starName`,
 * `category`, `discoveryMethod`, and `notableFact` are real curated
 * metadata you can rely on; they are NOT a substitute for pulling actual
 * numeric values from the NASA Exoplanet Archive before using any of
 * these in the app. See README.md for the fetch procedure — the same
 * bulk query works for all 40 at once (comma-separated pl_name list).
 *
 * A couple of entries carry an extra caution note where the scientific
 * story is unusually contested or nuanced (e.g. K2-18 b's biosignature
 * claims, Kepler-1625 b's disputed exomoon) — read those before using
 * them in any user-facing copy.
 */
export const BUFFER_PLANETS: Planet[] = [
  // --- Rocky / habitable-zone candidates ---
  {
    name: "TRAPPIST-1 d",
    starName: "TRAPPIST-1",
    discoveryMethod: "Transit",
    category: "rocky-habitable-zone",
    notableFact: "Innermost of the three TRAPPIST-1 planets generally considered within the habitable zone.",
  },
  {
    name: "TRAPPIST-1 f",
    starName: "TRAPPIST-1",
    discoveryMethod: "Transit",
    category: "rocky-habitable-zone",
    notableFact: "Outer habitable-zone TRAPPIST-1 world — pairs well with TRAPPIST-1 e to show intra-system variation.",
  },
  {
    name: "Kepler-452 b",
    starName: "Kepler-452",
    discoveryMethod: "Transit",
    category: "rocky-habitable-zone",
    notableFact: "Nicknamed 'Earth's cousin' — orbits a G-type (Sun-like) star, one of the few HZ candidates around a solar-type host.",
  },
  {
    name: "Kepler-22 b",
    starName: "Kepler-22",
    discoveryMethod: "Transit",
    category: "rocky-habitable-zone",
    notableFact: "First planet Kepler confirmed within the habitable zone of a Sun-like star (2011).",
  },
  {
    name: "TOI-700 d",
    starName: "TOI-700",
    discoveryMethod: "Transit",
    category: "rocky-habitable-zone",
    notableFact: "TESS's first Earth-size habitable-zone discovery, orbiting a small cool M dwarf.",
  },
  {
    name: "LHS 1140 b",
    starName: "LHS 1140",
    discoveryMethod: "Transit",
    category: "rocky-habitable-zone",
    notableFact: "Dense rocky super-Earth around a nearby red dwarf, considered a strong atmosphere-search target.",
  },
  {
    name: "Gliese 667 Cc",
    starName: "Gliese 667 C",
    discoveryMethod: "Radial Velocity",
    category: "rocky-habitable-zone",
    notableFact: "Orbits the smallest star in a triple-star system — good visual contrast for a multi-star sky.",
  },
  {
    name: "Kepler-62 f",
    starName: "Kepler-62",
    discoveryMethod: "Transit",
    category: "rocky-habitable-zone",
    notableFact: "Outermost of two habitable-zone planets in the Kepler-62 system.",
  },
  {
    name: "Teegarden's Star b",
    starName: "Teegarden's Star",
    discoveryMethod: "Radial Velocity",
    category: "rocky-habitable-zone",
    notableFact: "Earth-mass planet on a notably circular orbit around one of the coolest, nearest known M dwarfs.",
  },

  // --- Super-Earths ---
  {
    name: "Gliese 486 b",
    starName: "Gliese 486",
    discoveryMethod: "Transit",
    category: "super-earth",
    notableFact: "Nearby (~26 ly) hot rocky super-Earth, a prime atmosphere-detection target for JWST.",
  },
  {
    name: "LHS 3844 b",
    starName: "LHS 3844",
    discoveryMethod: "Transit",
    category: "super-earth",
    notableFact: "Ultra-short-period rocky world with observations suggesting little to no atmosphere — a good 'airless' showcase.",
  },
  {
    name: "HD 219134 b",
    starName: "HD 219134",
    discoveryMethod: "Radial Velocity / Transit",
    category: "super-earth",
    notableFact: "One of the nearest known rocky exoplanets, in a compact multi-planet system.",
  },

  // --- Ultra-hot / lava & extreme worlds ---
  {
    name: "Kepler-10 b",
    starName: "Kepler-10",
    discoveryMethod: "Transit",
    category: "ultra-hot",
    notableFact: "First confirmed rocky exoplanet found by Kepler; likely a molten-surface lava world.",
  },
  {
    name: "CoRoT-7 b",
    starName: "CoRoT-7",
    discoveryMethod: "Transit",
    category: "ultra-hot",
    notableFact: "First transiting rocky exoplanet ever confirmed (CoRoT mission, 2009); dayside possibly hot enough for rock vapor and 'mineral rain.'",
  },
  {
    name: "WASP-12 b",
    starName: "WASP-12",
    discoveryMethod: "Transit",
    category: "ultra-hot",
    notableFact: "Being tidally disrupted and slowly consumed by its host star — dramatic 'doomed planet' story.",
  },
  {
    name: "KELT-9 b",
    starName: "KELT-9",
    discoveryMethod: "Transit",
    category: "ultra-hot",
    notableFact: "Hottest known exoplanet — dayside temperature rivals many stars; orbits a hot A-type star.",
  },
  {
    name: "WASP-76 b",
    starName: "WASP-76",
    discoveryMethod: "Transit",
    category: "ultra-hot",
    notableFact: "'Iron rain' planet — evidence of iron vapor condensing on the cooler nightside.",
  },

  // --- Ordinary / classic hot Jupiters ---
  {
    name: "HD 209458 b",
    starName: "HD 209458",
    discoveryMethod: "Transit",
    category: "hot-jupiter",
    notableFact: "Nicknamed 'Osiris' — first exoplanet observed transiting its star, with a detected evaporating atmosphere.",
  },
  {
    name: "51 Pegasi b",
    starName: "51 Pegasi",
    discoveryMethod: "Radial Velocity",
    category: "hot-jupiter",
    notableFact: "First exoplanet discovered orbiting a Sun-like star (1995) — the discovery that opened the field, Nobel Prize in Physics 2019.",
  },
  {
    name: "HD 189733 b",
    starName: "HD 189733",
    discoveryMethod: "Transit",
    category: "hot-jupiter",
    notableFact: "Famous deep-blue color from silicate haze, with winds strong enough to drive glass sideways.",
  },
  {
    name: "Kepler-7 b",
    starName: "Kepler-7",
    discoveryMethod: "Transit",
    category: "hot-jupiter",
    notableFact: "One of the puffiest, lowest-density planets known — good extreme-low-gravity visual.",
  },
  {
    name: "WASP-17 b",
    starName: "WASP-17",
    discoveryMethod: "Transit",
    category: "hot-jupiter",
    notableFact: "One of the largest, puffiest planets known; orbits retrograde (backwards relative to its star's spin).",
  },
  {
    name: "WASP-39 b",
    starName: "WASP-39",
    discoveryMethod: "Transit",
    category: "hot-jupiter",
    notableFact: "JWST early-release-science target — first clear exoplanet CO2 detection, a strong 'real recent science' talking point.",
  },

  // --- Mini-Neptunes / sub-Neptunes ---
  {
    name: "HAT-P-11 b",
    starName: "HAT-P-11",
    discoveryMethod: "Transit",
    category: "mini-neptune",
    notableFact: "Neptune-size planet with confirmed water vapor in its atmosphere.",
  },
  {
    name: "Gliese 436 b",
    starName: "Gliese 436",
    discoveryMethod: "Radial Velocity / Transit",
    category: "mini-neptune",
    notableFact: "Hot Neptune shedding a comet-like tail of evaporating hydrogen.",
  },
  {
    name: "GJ 1214 b",
    starName: "GJ 1214",
    discoveryMethod: "Transit",
    category: "mini-neptune",
    notableFact: "Archetypal 'water world' / mini-Neptune with a thick, hazy atmosphere obscuring surface studies.",
  },
  {
    name: "K2-18 b",
    starName: "K2-18",
    discoveryMethod: "Transit",
    category: "mini-neptune",
    notableFact: "⚠️ Handle with care: widely (and prematurely) publicized 'biosignature' claims (DMS detection) remain scientifically contested — do not present as confirmed life indicators.",
  },
  {
    name: "WASP-107 b",
    starName: "WASP-107",
    discoveryMethod: "Transit",
    category: "mini-neptune",
    notableFact: "Extremely low-density 'super-puff' with detected helium actively escaping the atmosphere.",
  },

  // --- Directly imaged giants ---
  {
    name: "HR 8799 c",
    starName: "HR 8799",
    discoveryMethod: "Direct Imaging",
    category: "directly-imaged",
    notableFact: "Part of one of the first directly-imaged multi-planet systems — an actual photograph exists of this system.",
  },
  {
    name: "HR 8799 e",
    starName: "HR 8799",
    discoveryMethod: "Direct Imaging",
    category: "directly-imaged",
    notableFact: "Innermost known planet in the directly-imaged HR 8799 system.",
  },
  {
    name: "Beta Pictoris b",
    starName: "Beta Pictoris",
    discoveryMethod: "Direct Imaging",
    category: "directly-imaged",
    notableFact: "Young, still-forming giant planet in a system with a visible debris disk.",
  },

  // --- Circumbinary ("Tatooine") planets ---
  {
    name: "Kepler-16 b",
    starName: "Kepler-16 (AB)",
    discoveryMethod: "Transit",
    category: "circumbinary",
    notableFact: "The original real-life 'Tatooine' — orbits two stars at once, would see a double sunset.",
  },
  {
    name: "TOI-1338 b",
    starName: "TOI-1338 (AB)",
    discoveryMethod: "Transit",
    category: "circumbinary",
    notableFact: "Circumbinary planet found by a 17-year-old NASA citizen-science intern reviewing TESS data.",
  },

  // --- Pulsar planets ---
  {
    name: "PSR B1257+12 b",
    starName: "PSR B1257+12",
    discoveryMethod: "Pulsar Timing",
    category: "pulsar-planet",
    notableFact: "Part of the first exoplanet system ever confirmed (1992) — orbits a millisecond pulsar, not a normal star.",
  },
  {
    name: "PSR B1257+12 c",
    starName: "PSR B1257+12",
    discoveryMethod: "Pulsar Timing",
    category: "pulsar-planet",
    notableFact: "Sibling to PSR B1257+12 b; a genuinely alien host-star scenario (no visible starlight at all in the conventional sense).",
  },

  // --- Scientific oddities ---
  {
    name: "Kepler-11 f",
    starName: "Kepler-11",
    discoveryMethod: "Transit",
    category: "oddity",
    notableFact: "Part of an extremely compact 6-planet system, all orbiting closer than Venus does to our Sun.",
  },
  {
    name: "Kepler-1625 b",
    starName: "Kepler-1625",
    discoveryMethod: "Transit",
    category: "oddity",
    notableFact: "⚠️ Handle with care: the planet itself is confirmed, but its candidate exomoon (Kepler-1625b-i) is disputed, not confirmed — don't present the moon as established fact.",
  },
  {
    name: "TOI-178 d",
    starName: "TOI-178",
    discoveryMethod: "Transit",
    category: "oddity",
    notableFact: "Member of a 6-planet system locked in a rare, precise orbital resonance chain.",
  },
  {
    name: "TrES-2 b",
    starName: "TrES-2",
    discoveryMethod: "Transit",
    category: "oddity",
    notableFact: "Darkest known exoplanet — reflects less than 1% of incoming starlight, darker than coal.",
  },
  {
    name: "GJ 3512 b",
    starName: "GJ 3512",
    discoveryMethod: "Radial Velocity",
    category: "oddity",
    notableFact: "Surprisingly massive gas giant around a tiny red dwarf — a system that strains standard planet-formation theory.",
  },
];

/** Quick lookup of how many buffer planets fall into each category, for sanity-checking curation balance. */
export function bufferCategoryCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of BUFFER_PLANETS) {
    const key = p.category ?? "uncategorized";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}
