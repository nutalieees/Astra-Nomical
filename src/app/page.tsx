"use client";

import { useEffect, useMemo, useState } from "react";
import { EvolveLifePanel } from "../components/alien/evolve-life-panel";
import { PlanetSelector } from "../components/explorer/planet-selector";
import { PlanetOverview } from "../components/planet/planet-overview";
import { ScienceHud } from "../components/planet/science-hud";
import { EnterWorldTransition } from "../components/scene/enter-world-transition";
import { PlanetScenePlaceholder } from "../components/scene/planet-scene-placeholder";
import { deriveEnvironment } from "../lib/astronomy/environment";
import { FEATURED_PLANETS, FEATURED_PLANETS_PROVENANCE } from "../lib/astronomy/planets-featured";

type View = "landing" | "overview" | "transition" | "world";

export default function Home() {
  const [selectedPlanet, setSelectedPlanet] = useState(FEATURED_PLANETS[0]);
  const [view, setView] = useState<View>("landing");
  const environment = useMemo(() => deriveEnvironment(selectedPlanet), [selectedPlanet]);

  useEffect(() => {
    if (view !== "transition") return;
    const timer = window.setTimeout(() => setView("world"), 1300);
    return () => window.clearTimeout(timer);
  }, [view]);

  const choosePlanet = (planet: (typeof FEATURED_PLANETS)[number]) => {
    setSelectedPlanet(planet);
    if (view !== "world") setView("overview");
  };

  if (view === "landing") {
    return (
      <main className="landing-page">
        <div className="landing-stars" aria-hidden="true" />
        <header className="site-header"><span>ASTRA—NOMICAL</span><span>EXOPLANET EXPERIENCE / 01</span></header>
        <section className="landing-hero">
          <p className="eyebrow">A FIELD GUIDE TO DISTANT WORLDS</p>
          <h1>Stand beneath an<br /><em>alien sky.</em></h1>
          <p>Real exoplanet data, translated into a world you can enter.</p>
          <button className="primary-button" type="button" onClick={() => setView("overview")}>BEGIN EXPLORING <span>↗</span></button>
        </section>
        <footer>NASA ARCHIVE DATA · VISUAL SCENARIOS, NOT ATMOSPHERIC MEASUREMENTS</footer>
      </main>
    );
  }

  if (view === "transition") {
    return <main className="transition-page"><EnterWorldTransition planetName={selectedPlanet.name} /></main>;
  }

  if (view === "world") {
    return (
      <main className="world-page">
        <PlanetScenePlaceholder planet={selectedPlanet} environment={environment} visualEnvironment={null} />
        <header className="world-header">
          <button className="brand-button" type="button" onClick={() => setView("landing")}>ASTRA—NOMICAL</button>
          <span>{selectedPlanet.name}</span>
          <button className="text-button" type="button" onClick={() => setView("overview")}>CHANGE WORLD</button>
        </header>
        <ScienceHud
          planet={selectedPlanet}
          environment={environment}
          provenance={FEATURED_PLANETS_PROVENANCE[selectedPlanet.name]}
        />
        <EvolveLifePanel planet={selectedPlanet} environment={environment} />
      </main>
    );
  }

  return (
    <main className="explorer-page">
      <header className="site-header"><button className="brand-button" type="button" onClick={() => setView("landing")}>ASTRA—NOMICAL</button><span>CATALOGUE / 05 VERIFIED WORLDS</span></header>
      <PlanetSelector planets={FEATURED_PLANETS} selectedPlanet={selectedPlanet} onSelect={choosePlanet} />
      <PlanetOverview planet={selectedPlanet} environment={environment} onEnterWorld={() => setView("transition")} />
      <div className={`overview-orb overview-${environment.temperatureCategory}`} aria-hidden="true"><i style={{ backgroundColor: environment.starColor }} /></div>
    </main>
  );
}
