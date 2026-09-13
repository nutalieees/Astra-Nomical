"use client";

import type { Planet } from "../../types/planet";

interface PlanetSelectorProps {
  planets: Planet[];
  selectedPlanet: Planet;
  onSelect: (planet: Planet) => void;
}

export function PlanetSelector({ planets, selectedPlanet, onSelect }: PlanetSelectorProps) {
  return (
    <nav className="planet-selector" aria-label="Featured worlds">
      <span className="eyebrow selector-label">FEATURED WORLDS</span>
      <div className="planet-tabs">
        {planets.map((planet, index) => (
          <button
            className={planet.name === selectedPlanet.name ? "planet-tab is-selected" : "planet-tab"}
            key={planet.name}
            onClick={() => onSelect(planet)}
            type="button"
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            {planet.name}
          </button>
        ))}
      </div>
    </nav>
  );
}
