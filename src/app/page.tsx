"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EvolveLifePanel } from "../components/alien/evolve-life-panel";
import { ExoplanetField } from "../components/explorer/exoplanet-field";
import { PlanetOverview } from "../components/planet/planet-overview";
import { ScienceHud } from "../components/planet/science-hud";
import { EnterWorldTransition } from "../components/scene/enter-world-transition";
import { PlanetSurface } from "../components/scene/planet-surface";
import { deriveEnvironment } from "../lib/astronomy/environment";
import { FEATURED_PLANETS, FEATURED_PLANETS_PROVENANCE } from "../lib/astronomy/planets-featured";
import { deriveVisualEnvironment } from "../lib/astronomy/visual-environment";
import type { ValidatedOrganism } from "../types/astrobiology";
import type { Planet } from "../types/planet";
import type { OrganismSceneSpec } from "../lib/evolve-life/organism-scene";

type View = "landing" | "overview" | "transition" | "world";

export default function Home() {
  const [selectedPlanet, setSelectedPlanet] = useState(FEATURED_PLANETS[0]);
  const [view, setView] = useState<View>("landing");
  const [specimen, setSpecimen] = useState<{ planetName: string; organism: ValidatedOrganism; scene: OrganismSceneSpec | null } | null>(null);
  const [organismVisible, setOrganismVisible] = useState(true);
  const [focusOrganism, setFocusOrganism] = useState(0);
  const environment = useMemo(() => deriveEnvironment(selectedPlanet), [selectedPlanet]);
  const visualEnvironment = useMemo(() => deriveVisualEnvironment(selectedPlanet, environment), [selectedPlanet, environment]);
  const currentSpecimen = specimen?.planetName === selectedPlanet.name ? specimen : null;

  const navigate = useCallback((nextView: View) => {
    setSpecimen(null);
    setOrganismVisible(true);
    setFocusOrganism(0);
    setView(nextView);
  }, []);
  const selectPlanet = useCallback((planet: Planet) => {
    setSpecimen(null);
    setOrganismVisible(true);
    setFocusOrganism(0);
    setSelectedPlanet(planet);
  }, []);
  const receiveOrganismScene = useCallback((organism: ValidatedOrganism | null, scene: OrganismSceneSpec | null) => {
    setSpecimen(organism ? { planetName: selectedPlanet.name, organism, scene } : null);
    if (!scene) setOrganismVisible(true);
  }, [selectedPlanet.name]);
  const inspectOrganism = useCallback(() => {
    setOrganismVisible(true);
    setFocusOrganism((current) => current + 1);
  }, []);
  const toggleOrganism = useCallback(() => setOrganismVisible((current) => !current), []);

  useEffect(() => {
    if (view !== "transition") return;
    const timer = window.setTimeout(() => setView("world"), 1300);
    return () => window.clearTimeout(timer);
  }, [view]);

  if (view === "landing") {
    return (
      <main className="landing-page">
        <header className="site-header"><span>ASTRA—NOMICAL</span><span>EXOPLANET EXPERIENCE / 01</span></header>
        <ExoplanetField onSelect={selectPlanet} onEnterWorld={() => navigate("transition")} />
      </main>
    );
  }

  if (view === "transition") {
    return <main className="transition-page"><EnterWorldTransition planetName={selectedPlanet.name} /></main>;
  }

  if (view === "world") {
    return (
      <main className="world-page">
        <PlanetSurface
          planet={selectedPlanet}
          environment={environment}
          visualEnvironment={visualEnvironment}
          organism={currentSpecimen?.organism}
          organismScene={currentSpecimen?.scene}
          organismVisible={organismVisible}
          focusOrganism={focusOrganism}
          onReturnToOverview={() => navigate("overview")}
        />
        <header className="world-header">
          <button className="brand-button" type="button" onClick={() => navigate("overview")}>ASTRA—NOMICAL</button>
          <span>{selectedPlanet.name}</span>
          <button className="text-button" type="button" onClick={() => navigate("overview")}>EXIT WORLD</button>
        </header>
        <div className="world-hud">
        <ScienceHud
          planet={selectedPlanet}
          environment={environment}
          visualEnvironment={visualEnvironment}
          provenance={FEATURED_PLANETS_PROVENANCE[selectedPlanet.name]}
        />
        <EvolveLifePanel key={selectedPlanet.name} planet={selectedPlanet} environment={environment} onOrganismScene={receiveOrganismScene} organismVisible={organismVisible} onFocusOrganism={inspectOrganism} onToggleOrganism={toggleOrganism} />
        </div>
      </main>
    );
  }

  return (
    <main className="explorer-page">
      <header className="site-header"><button className="brand-button" type="button" onClick={() => navigate("landing")}>ASTRA—NOMICAL</button><span>SELECTED WORLD / {selectedPlanet.name}</span></header>
      <PlanetOverview planet={selectedPlanet} environment={environment} onEnterWorld={() => navigate("transition")} onBackToMap={() => navigate("landing")} />
      <div className={`overview-orb overview-${environment.temperatureCategory}`} aria-hidden="true"><i style={{ backgroundColor: environment.starColor }} /></div>
    </main>
  );
}
