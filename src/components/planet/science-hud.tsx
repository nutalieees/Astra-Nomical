"use client";

import { useState } from "react";
import type { Planet, PlanetFieldProvenance } from "../../types/planet";
import type { PlanetEnvironment } from "../../types/environment";
import type { VisualEnvironment } from "../../types/visual-environment";

interface ScienceHudProps {
  planet: Planet;
  environment: PlanetEnvironment;
  visualEnvironment?: VisualEnvironment;
  provenance?: PlanetFieldProvenance;
}

type Readout = {
  label: string;
  value: string;
  source: "measured" | "derived" | "assumed" | "archive";
};

const format = (number: number | undefined, unit: string) =>
  number == null ? "Not available" : `${number.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${unit}`;

const sourceLabel: Record<Readout["source"], string> = {
  measured: "MEASURED",
  derived: "DERIVED",
  assumed: "ASSUMED",
  archive: "ARCHIVE VALUE",
};

function dataSource(
  provenance: PlanetFieldProvenance | undefined,
  field: keyof Planet
): Readout["source"] {
  const source = provenance?.[field];
  return source === "measured" || source === "derived" || source === "assumed" ? source : "archive";
}

export function ScienceHud({ planet, environment, provenance, visualEnvironment }: ScienceHudProps) {
  const [expanded, setExpanded] = useState(false);
  const rows: Readout[] = [
    { label: "RADIUS", value: format(planet.radiusEarth, "R⊕"), source: dataSource(provenance, "radiusEarth") },
    { label: "MASS", value: format(planet.massEarth, "M⊕"), source: dataSource(provenance, "massEarth") },
    { label: "GRAVITY", value: `${environment.gravityEarth} g`, source: "derived" },
    { label: "EQUILIBRIUM TEMP", value: format(planet.equilibriumTemperatureK, "K"), source: dataSource(provenance, "equilibriumTemperatureK") },
    { label: "ORBITAL DISTANCE", value: format(planet.orbitalDistanceAU, "AU"), source: dataSource(provenance, "orbitalDistanceAU") },
    { label: "HOST STAR", value: planet.starName ?? "Not available", source: "archive" },
    { label: "STELLAR TEMP", value: format(planet.starTemperatureK, "K"), source: dataSource(provenance, "starTemperatureK") },
    { label: "SPECTRAL TYPE", value: planet.starSpectralType ?? "Not available", source: "archive" },
    { label: "ILLUMINATION", value: `${environment.illumination}× Earth`, source: "derived" },
  ];
  const measured = rows.filter((row) => row.source === "measured" || row.source === "archive");
  const derived = rows.filter((row) => row.source === "derived");
  const inputAssumptions = rows.filter((row) => row.source === "assumed");

  return (
    <aside className={expanded ? "science-hud is-expanded" : "science-hud"} aria-label="Planet science HUD">
      <div className="hud-heading">
        <div><span className="eyebrow">SCIENCE READOUT</span><strong>{planet.name}</strong></div>
        <span className="hud-live-dot" aria-label="Live data" />
      </div>
      <dl className="hud-grid">
        {rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
            <small className={`source-${row.source}`}>{sourceLabel[row.source]}</small>
          </div>
        ))}
      </dl>
      <button
        className="simulation-toggle"
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        How was this world simulated? <span aria-hidden="true">{expanded ? "−" : "+"}</span>
      </button>
      {expanded && <div className="hud-explainer">
        <section>
          <h2>Observed data</h2>
          <p>Values marked measured come from the curated record. “Archive value” means the NASA archive reports a value, but this UI has no field-level measurement qualifier for it.</p>
          <div className="source-summary">
            {measured.map((row) => <span key={row.label}>{row.label}</span>)}
          </div>
        </section>
        <section>
          <h2>Derived values</h2>
          <p>Gravity and illumination are calculated deterministically from the available planet, orbit, and star values.</p>
          <div className="source-summary">
            {derived.map((row) => <span key={row.label}>{row.label}</span>)}
          </div>
        </section>
        <section>
          <h2>Visual assumptions</h2>
          {inputAssumptions.length > 0 && <p>Curated input assumptions are marked above and are not presented as measurements: {inputAssumptions.map((row) => row.label.toLowerCase()).join(", ")}.</p>}
          <p className="visual-scenario">Atmosphere visual scenario: <b>{visualEnvironment?.surfacePreset === "gas-giant" ? "upper-atmosphere cloud layers" : environment.atmospherePreset}</b>. This is not a measured atmospheric composition.</p>
          <ul>
            {(visualEnvironment?.assumptions ?? environment.assumptions).map((assumption) => <li key={assumption}>{assumption}</li>)}
          </ul>
        </section>
      </div>}
    </aside>
  );
}
