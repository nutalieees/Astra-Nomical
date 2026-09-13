import type { Planet } from "../../types/planet";
import type { PlanetEnvironment } from "../../types/environment";

interface PlanetOverviewProps {
  planet: Planet;
  environment: PlanetEnvironment;
  onEnterWorld: () => void;
  variant?: "field";
}

function value(value: number | undefined, suffix: string) {
  return value == null ? "Unknown" : `${value.toLocaleString()} ${suffix}`;
}

export function PlanetOverview({ planet, environment, onEnterWorld, variant }: PlanetOverviewProps) {
  return (
    <section className={variant === "field" ? "planet-overview field-overview" : "planet-overview"} aria-labelledby="planet-name">
      <p className="eyebrow">CONFIRMED EXOPLANET · {planet.discoveryYear ?? "YEAR UNKNOWN"}</p>
      <h1 id="planet-name">{planet.name}</h1>
      <p className="planet-fact">{planet.notableFact ?? "A distant world awaiting a closer look."}</p>

      <dl className="overview-measurements">
        <div><dt>HOST STAR</dt><dd>{planet.starName ?? "Unknown"}</dd></div>
        {variant === "field" && <div><dt>DISTANCE FROM EARTH</dt><dd>{value(planet.distanceLightYears, "ly")}</dd></div>}
        <div><dt>ORBIT</dt><dd>{value(planet.orbitalDistanceAU, "AU")}</dd></div>
        <div><dt>CLIMATE SIGNAL</dt><dd>{environment.temperatureCategory}</dd></div>
      </dl>

      <button className="primary-button" type="button" onClick={onEnterWorld}>
        <span>ENTER WORLD</span><span aria-hidden="true">↗</span>
      </button>
    </section>
  );
}
