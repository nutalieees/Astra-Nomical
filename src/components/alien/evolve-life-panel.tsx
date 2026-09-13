"use client";

import { useState } from "react";
import type { Planet } from "../../types/planet";
import type { PlanetEnvironment } from "../../types/environment";
import type { AlienSimulation } from "../../types/alien";

type Status = "idle" | "thinking" | "complete" | "error";

function localPreview(planet: Planet, environment: PlanetEnvironment): AlienSimulation {
  const pressure = environment.gravityEarth > 1.3
    ? `${environment.gravityEarth}× Earth gravity`
    : environment.temperatureCategory === "extreme"
      ? `${planet.equilibriumTemperatureK ?? "Extreme"} K equilibrium temperature`
      : `${environment.atmospherePreset} atmospheric visual scenario`;
  const adaptation = environment.gravityEarth > 1.3
    ? "A low, broad body plan with powerful limbs lowers the energy cost of movement."
    : environment.temperatureCategory === "extreme"
      ? "Reflective, heat-tolerant surface structures limit energy absorption."
      : "A compact, adaptable body plan conserves energy in an uncertain environment.";

  return {
    name: "Astra field hypothesis",
    summary: `A speculative survival strategy for ${planet.name}, grounded in the displayed environmental model.`,
    traits: [{ trait: "Adaptive body plan", environmentalPressure: pressure, reasoning: adaptation }],
    morphology: { bodyPlan: "Low-profile modular form", size: "Small to medium", locomotion: "Anchored movement", surfaceCovering: "Protective outer layer", sensorySystems: "Light and vibration sensing" },
    survivalStrategy: "Shelter around stable thermal and radiation conditions.",
    uncertainty: ["This is a local preview until the Astra agent workflow is connected.", ...environment.assumptions.slice(0, 1)],
  };
}

export function EvolveLifePanel({ planet, environment }: { planet: Planet; environment: PlanetEnvironment }) {
  const [status, setStatus] = useState<Status>("idle");
  const [simulation, setSimulation] = useState<AlienSimulation | null>(null);

  const evolve = () => {
    setStatus("thinking");
    window.setTimeout(() => {
      setSimulation(localPreview(planet, environment));
      setStatus("complete");
    }, 850);
  };

  return (
    <section className="evolve-panel" aria-live="polite">
      {status !== "complete" ? (
        <>
          <span className="eyebrow">ASTRA BIOSPHERE LAB</span>
          <p>{status === "thinking" ? "Mapping environmental pressures…" : "What could adapt to this world?"}</p>
          <button className="secondary-button" type="button" onClick={evolve} disabled={status === "thinking"}>
            {status === "thinking" ? "EVOLVING…" : "EVOLVE LIFE"}
          </button>
        </>
      ) : simulation ? (
        <div className="alien-result">
          <span className="eyebrow">SPECULATIVE LIFE RESULT</span>
          <h2>{simulation.name}</h2>
          <p>{simulation.summary}</p>
          <div className="adaptation-chain">
            <span>{simulation.traits[0].environmentalPressure}</span><b>↓</b><span>{simulation.traits[0].reasoning}</span>
          </div>
          <button className="text-button" type="button" onClick={() => { setStatus("idle"); setSimulation(null); }}>RESET</button>
        </div>
      ) : null}
    </section>
  );
}
