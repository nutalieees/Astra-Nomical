# Astra-Nomical — Codex Project Instructions

## 1. Project Mission

Astra-Nomical is a five-hour hackathon project.

The product turns real exoplanet data into an interactive place the user can experience.

A user should be able to:

1. choose a confirmed exoplanet;
2. inspect its important astronomical properties;
3. travel to it through a cinematic transition;
4. stand on a visually distinctive 3D representation of its surface;
5. understand how real planetary parameters influenced the visualization;
6. ask Astra what kind of life could plausibly adapt to that environment;
7. see each biological adaptation linked to an environmental pressure.

The product should feel:

- cinematic;
- immersive;
- scientifically grounded;
- visually impressive;
- easy to understand within a 90-second demo.

This is NOT intended to be a complete astronomical simulator.

---

# 2. Hackathon Constraints

This project must be completed within approximately five hours.

The final deliverables are:

- a deployed working web application;
- a reliable end-to-end demo;
- a 90-second demonstration showing the application and how Astra was used.

Therefore:

**working product > perfect architecture**

**visual impact > feature count**

**reliable demo > comprehensive dataset**

**simple implementation > technically elegant implementation**

Never sacrifice an already-working demo flow for a speculative feature.

---

# 3. Primary Product Flow

The critical user journey is:

Landing
↓
Choose an exoplanet
↓
Inspect important data
↓
Enter World
↓
Cinematic transition
↓
3D surface experience
↓
Inspect planetary environment
↓
Evolve Life
↓
Environment → Pressure → Adaptation reasoning

This entire flow is P0/P1 and must remain functional throughout development.

---

# 4. Feature Priorities

## P0 — MUST WORK

### 4.1 Exoplanet Selection

Provide a visually appealing planet-selection interface.

Users should be able to:

- select featured planets;
- search available planets;
- see a concise summary of each selected planet.

At minimum, reliably support these featured worlds:

- TRAPPIST-1 e
- Proxima Centauri b
- 55 Cancri e
- WASP-121 b
- Kepler-186 f

These featured planets MUST continue working even if an external API fails.

Cache or locally store their required astronomical values.

---

### 4.2 Planet Data Model

Create one normalized internal representation of a planet.

Prefer fields such as:

```ts
interface Planet {
  name: string;

  radiusEarth?: number;
  massEarth?: number;

  orbitalDistanceAU?: number;
  orbitalPeriodDays?: number;

  equilibriumTemperatureK?: number;

  starName?: string;
  starRadiusSolar?: number;
  starTemperatureK?: number;
  starSpectralType?: string;

  distanceLightYears?: number;

  discoveryYear?: number;
}
```

External data should be normalized before it reaches rendering components.

Do not let UI components depend directly on NASA API response formats.

---

### 4.3 3D Planet Surface

This is the central visual experience of Astra-Nomical.

Use Three.js / React Three Fiber.

The experience should make the user feel as though they are standing on another planet.

Prioritize:

- dramatic terrain;
- visible horizon;
- atmospheric haze;
- distinctive sky;
- visible host star;
- strong lighting;
- subtle animation;
- camera movement;
- depth and scale.

Stylized scientific visualization is acceptable.

Photorealism is NOT required.

The 3D experience should be visually impressive even if the underlying simulation is simplified.

---

### 4.4 Data-Driven Rendering

The selected planet MUST visibly influence the rendered environment.

Create a separate environment-calculation module.

Example:

```ts
Planet
    ↓
deriveEnvironment()
    ↓
PlanetEnvironment
    ↓
3D renderer
```

Use astronomical parameters to influence at least:

- horizon curvature;
- star color;
- apparent star size;
- illumination;
- approximate surface gravity;
- environmental temperature category;
- atmospheric visual preset.

Example structure:

```ts
interface PlanetEnvironment {
  gravityEarth: number;

  starColor: string;
  apparentStarSize: number;

  illumination: number;

  temperatureCategory:
    | "frozen"
    | "cold"
    | "temperate"
    | "hot"
    | "extreme";

  atmospherePreset:
    | "airless"
    | "thin"
    | "earthlike"
    | "dense";

  assumptions: string[];
}
```

Keep calculations deterministic and reusable.

Do NOT generate these values with an LLM.

---

### 4.5 Cinematic Transition

When the user chooses "Enter World", create a visually strong transition into the surface scene.

Possible techniques:

- starfield acceleration;
- camera zoom;
- warp effect;
- particle motion;
- blur;
- fade through atmosphere.

Keep the implementation lightweight.

A convincing illusion is more important than physically accurate interstellar travel.

Do NOT build a complete galaxy-navigation engine unless all higher-priority functionality is already finished.

---

### 4.6 Reliability

The application must never fail because some astronomical field is missing.

Use a fallback hierarchy:

1. measured value;
2. derived value;
3. scientifically reasonable visual assumption;
4. safe default.

Never allow:

- NaN values;
- infinite scale;
- invalid CSS colors;
- invisible host stars;
- broken cameras;
- undefined labels;
- blank scenes.

---

# 5. P1 — HIGH VALUE FEATURES

## 5.1 Evolve Life

Provide a prominent:

**EVOLVE LIFE**

interaction.

This should call GPT-6 Astra.

Astra receives:

- selected planet;
- known astronomical measurements;
- calculated PlanetEnvironment;
- assumptions made by the visualization.

Astra should return speculative astrobiology.

The purpose is NOT:

"Generate a cool alien."

The purpose is:

"Reason about what adaptations might plausibly emerge under these environmental pressures."

---

## 5.2 Alien Reasoning Format

Require structured output.

Conceptually:

```ts
interface AlienSimulation {
  name: string;

  summary: string;

  traits: {
    trait: string;
    environmentalPressure: string;
    reasoning: string;
  }[];

  morphology: {
    bodyPlan: string;
    size: string;
    locomotion: string;
    surfaceCovering: string;
    sensorySystems: string;
  };

  survivalStrategy: string;

  uncertainty: string[];
}
```

The most important visual representation is:

ENVIRONMENT
↓
PRESSURE
↓
ADAPTATION

Example:

```text
1.7× Earth gravity
↓
Movement requires more energy
↓
Low, broad body with powerful limbs
```

Another:

```text
Active red dwarf
↓
Frequent radiation exposure
↓
Radiation-resistant protective tissue
```

Keep explanations short and visual.

Do not show long essays.

---

# 6. Scientific Integrity

Scientific credibility matters.

Never fabricate unknown measurements.

Clearly distinguish:

- measured;
- derived;
- assumed;
- speculative.

Do NOT claim that sky color can be uniquely determined from basic exoplanet measurements.

Actual atmospheric composition is often unknown.

Therefore represent atmospheric appearance as a visual scenario or preset.

Examples:

- airless;
- thin atmosphere;
- Earth-like scattering;
- dense haze.

If assumptions are made, surface them in the UI.

---

# 7. P1 — Planet Science HUD

While viewing the surface, show a compact scientific HUD.

Recommended metrics:

- planet radius;
- planet mass;
- surface gravity;
- equilibrium temperature;
- orbital distance;
- star temperature;
- star spectral class;
- approximate visible star size.

Do not overwhelm the view.

The 3D environment remains the main focus.

The HUD should explain what the user is seeing rather than compete with it.

---

# 8. P1 — Compare With Earth

If time allows, provide a simple comparison mode.

Compare:

- radius;
- gravity;
- temperature;
- orbital distance;
- host star temperature;
- apparent star size;
- illumination.

Prefer visual comparisons over dense tables.

Example:

```text
GRAVITY

Earth           1.0 g
Selected World  1.7 g
```

Comparison should help users understand scale immediately.

---

# 9. P2 — Optional Features

Only implement these after the entire core journey works.

## Atmospheric presets

Allow users to compare hypothetical atmosphere scenarios.

## Lightweight star map

Display planets in a stylized 3D star field.

This is a navigation interface, NOT an accurate Milky Way simulator.

## Additional exoplanet catalogue

Increase the number of searchable worlds.

## Procedural alien visualization

Create a simple visual representation of Astra's organism.

These features must never jeopardize the core experience.

---

# 10. Features Explicitly Out of Scope During Initial Build

Do NOT initially build:

- a physically accurate Milky Way;
- interstellar orbital mechanics;
- multiplayer;
- accounts;
- authentication;
- databases;
- user profiles;
- social features;
- complex backend infrastructure;
- realistic weather simulation;
- ecosystem simulation;
- procedural cities;
- detailed alien animation;
- full planetary walking simulator;
- advanced game physics.

These are distractions during a five-hour hackathon.

---

# 11. Visual Direction

The visual experience is a major judging advantage.

Prioritize visual quality.

Desired aesthetic:

**NASA scientific visualization × cinematic sci-fi × premium interactive product**

The application should NOT look like:

- an admin dashboard;
- a generic SaaS application;
- a chatbot UI;
- a collection of cards;
- a typical AI wrapper.

The 3D world should dominate the experience.

---

# 12. UI Direction

Use:

- dark space backgrounds;
- restrained glass panels;
- large typography;
- subtle gradients;
- smooth transitions;
- minimal chrome;
- strong visual hierarchy;
- small amounts of scientific annotation.

Avoid:

- excessive borders;
- dozens of cards;
- excessive text;
- rainbow gradients;
- unnecessary icons;
- large navigation menus.

Users should understand the application without instructions.

---

# 13. Camera and Scene Behaviour

Keep controls simple.

Preferred:

- subtle idle camera motion;
- mouse-look or drag-to-look;
- optional limited orbit;
- smooth transitions.

Do not spend significant development time on realistic walking controls.

The product is primarily an **experience**, not a game.

---

# 14. Performance

3D performance is important.

Prefer:

- procedural geometry;
- simple shaders;
- low-resolution textures;
- instanced particles;
- modest polygon counts;
- lightweight post-processing.

Avoid:

- huge assets;
- large downloadable textures;
- excessive shadow maps;
- unnecessary physics;
- expensive effects that noticeably reduce frame rate.

Desktop demo performance is the priority.

---

# 15. Recommended Technology

Prefer:

- Next.js
- TypeScript
- React
- React Three Fiber
- Three.js
- Tailwind CSS
- OpenAI Responses API
- Vercel

Do not introduce another framework unless necessary.

Do not add dependencies when a small local implementation will suffice.

---

# 16. Project Architecture

Keep architecture simple.

Suggested organization:

```text
src/
├── app/
├── components/
│   ├── explorer/
│   ├── planet/
│   ├── scene/
│   └── alien/
│
├── lib/
│   ├── astronomy/
│   │   ├── planets.ts
│   │   ├── environment.ts
│   │   └── constants.ts
│   │
│   └── ai/
│       └── evolveLife.ts
│
└── types/
    ├── planet.ts
    └── alien.ts
```

Do not create unnecessary abstraction layers.

---

# 17. Development Behaviour

When given a task:

1. Read this AGENTS.md.
2. Inspect the existing implementation.
3. Understand the current user journey.
4. Make the requested change directly.
5. Preserve working functionality.
6. Run appropriate checks.
7. Fix errors you encounter.
8. Leave the application runnable.

Do not stop after only explaining what should be done.

Implement it.

---

# 18. Decision-Making Rules

This is a timed hackathon.

If a minor implementation detail is ambiguous:

**make a reasonable decision and continue.**

Do not repeatedly ask the developer questions.

Prefer:

working > elegant

simple > clever

visual > architecturally sophisticated

existing dependency > adding dependency

local fallback > network dependency

graceful approximation > broken feature

---

# 19. Avoid Unnecessary Refactoring

Once a subsystem works, leave it alone unless a change is necessary.

Do NOT:

- rewrite functioning components for style;
- change framework;
- replace major libraries;
- reorganize the entire repository;
- introduce state-management libraries without a clear need.

Hackathon time is limited.

---

# 20. Error Handling

All important interactions require graceful failure states.

Especially:

- NASA data fetching;
- OpenAI API requests;
- missing values;
- loading the 3D scene.

Never present a blank screen.

If NASA data fails:

use cached featured planets.

If Astra fails:

show a retry button while preserving the planet experience.

---

# 21. Testing Philosophy

Testing should protect the demo, not consume the hackathon.

After meaningful changes, validate the exact demo flow.

At minimum test:

1. Load application.
2. Select TRAPPIST-1 e.
3. Enter world.
4. Confirm scene renders.
5. Confirm HUD values appear.
6. Generate life.
7. Confirm adaptation reasoning appears.
8. Return.
9. Select 55 Cancri e.
10. Confirm its world looks visibly different.

Also ensure:

- production build succeeds;
- TypeScript compiles;
- no major browser-console errors occur.

Do not build a comprehensive automated testing suite unless spare time remains.

---

# 22. Demo-Safe Worlds

Treat these planets as production-critical:

1. TRAPPIST-1 e
2. 55 Cancri e
3. Proxima Centauri b
4. WASP-121 b
5. Kepler-186 f

When visual differences are scientifically reasonable, deliberately make these scenes noticeably different.

The demo should immediately communicate:

**different planetary data → different world**

---

# 23. Demo Success Criteria

The product is ready when someone unfamiliar with Astra-Nomical can:

- open the app;
- choose a planet;
- travel to it;
- immediately notice its unusual environment;
- understand why it looks different;
- click Evolve Life;
- understand how Astra connected environmental conditions to biological adaptation;

without explanation from the developer.

---

# 24. Final Priority Rule

Whenever choosing between two tasks, use this order:

1. Fix broken functionality.
2. Improve core 3D experience.
3. Improve planet-to-planet visual differentiation.
4. Improve Evolve Life reasoning.
5. Improve transitions and animation.
6. Improve UI polish.
7. Add optional features.

The core product should always remain demoable.

Do not add lower-priority functionality while a higher-priority part of the experience is broken.