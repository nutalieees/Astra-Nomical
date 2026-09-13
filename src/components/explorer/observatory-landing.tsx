"use client";

import { useEffect, useRef } from "react";
import { FEATURED_PLANETS } from "../../lib/astronomy/planets-featured";
import { deriveEnvironment } from "../../lib/astronomy/environment";

// Composed screen positions, not sky coordinates or scaled astronomical orbits.
const SYSTEMS = ["TRAPPIST-1 e", "55 Cancri e", "WASP-121 b"].map((name, index) => {
  const planet = FEATURED_PLANETS.find(item => item.name === name)!;
  return { planet, color: deriveEnvironment(planet).starColor,
    desktop: [[0.7, 0.24], [0.84, 0.51], [0.66, 0.76]][index],
    mobile: [[0.2, 0.21], [0.76, 0.29], [0.74, 0.83]][index] };
});

export function ObservatoryLanding({ onBegin }: { onBegin: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d", { alpha: false });
    if (!element || !context) return;
    const host = element.parentElement!;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let width = 1, height = 1, frame = 0, time = 0, previous = 0;
    let pointerX = 0, pointerY = 0, driftX = 0, driftY = 0;
    let seed = 8319;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    // Three brightness/size batches keep a dense field inexpensive to draw.
    const stars = Array.from({ length: 1500 }, () => ({ x: random(), y: random(), depth: 0.2 + random() * 0.8, tier: Math.floor(random() ** 3 * 3) }));
    const colors = ["#506477", "#9caebf", "#e0eaf3"];

    const draw = (timestamp: number) => {
      const elapsed = previous ? Math.min(timestamp - previous, 50) : 0;
      previous = timestamp;
      if (!motion.matches) time += elapsed / 1000;
      const easing = 1 - Math.exp(-elapsed / 450);
      driftX = motion.matches ? 0 : driftX + (pointerX - driftX) * easing;
      driftY = motion.matches ? 0 : driftY + (pointerY - driftY) * easing;
      context.fillStyle = "#040910";
      context.fillRect(0, 0, width, height);
      for (let tier = 0; tier < 3; tier++) {
        context.beginPath();
        for (const star of stars) {
          if (star.tier !== tier) continue;
          const x = (star.x * width + (Math.sin(time * 0.025) * 14 + driftX * 10) * star.depth + width) % width;
          const y = (star.y * height + (Math.cos(time * 0.018) * 10 + driftY * 8) * star.depth + height) % height;
          const radius = (0.35 + tier * 0.45) * star.depth;
          context.moveTo(x + radius, y); context.arc(x, y, radius, 0, Math.PI * 2);
        }
        context.fillStyle = colors[tier]; context.fill();
      }
      // Observatory reference arcs are explicitly illustrative and unitless.
      context.strokeStyle = "rgba(112,164,185,0.12)";
      context.lineWidth = 0.6;
      for (const scale of [0.21, 0.34, 0.48]) {
        context.beginPath();
        context.ellipse(width * 0.77, height * 0.56, width * scale, height * scale * 0.68, -0.35, 0, Math.PI * 2);
        context.stroke();
      }
      context.beginPath();
      for (let index = 0; index <= 24; index++) {
        const x = width * (0.06 + index / 24 * 0.88);
        context.moveTo(x, height * 0.91);
        context.lineTo(x, height * 0.91 + (index % 4 === 0 ? 8 : 3));
      }
      context.stroke();
      for (const [index, system] of SYSTEMS.entries()) {
        const position = width < 700 ? system.mobile : system.desktop;
        const x = position[0] * width, y = position[1] * height;
        const glow = context.createRadialGradient(x, y, 0, x, y, 36);
        glow.addColorStop(0, system.color + "75"); glow.addColorStop(0.2, system.color + "20"); glow.addColorStop(1, system.color + "00");
        context.fillStyle = glow; context.fillRect(x - 36, y - 36, 72, 72);
        context.fillStyle = system.color;
        context.beginPath(); context.arc(x, y, 2.2 + index * 0.65, 0, Math.PI * 2); context.fill();
        context.strokeStyle = system.color + "40";
        context.beginPath(); context.ellipse(x, y, 22 + index * 5, 9 + index * 2, -0.55, 0, Math.PI * 1.7); context.stroke();
      }
      if (!motion.matches && !document.hidden) frame = requestAnimationFrame(draw);
    };
    const restart = () => { cancelAnimationFrame(frame); previous = 0; if (!document.hidden) frame = requestAnimationFrame(draw); };
    const resize = () => {
      width = host.clientWidth; height = host.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      element.width = Math.round(width * dpr); element.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0); restart();
    };
    const move = (event: PointerEvent) => {
      const bounds = host.getBoundingClientRect();
      pointerX = (event.clientX - bounds.left) / width - 0.5;
      pointerY = (event.clientY - bounds.top) / height - 0.5;
    };
    const leave = () => { pointerX = 0; pointerY = 0; };
    const observer = new ResizeObserver(resize); observer.observe(host);
    host.addEventListener("pointermove", move); host.addEventListener("pointerleave", leave);
    motion.addEventListener("change", restart); document.addEventListener("visibilitychange", restart);
    resize();
    return () => {
      cancelAnimationFrame(frame); observer.disconnect();
      host.removeEventListener("pointermove", move); host.removeEventListener("pointerleave", leave);
      motion.removeEventListener("change", restart); document.removeEventListener("visibilitychange", restart);
    };
  }, []);

  return (
    <section className="observatory" aria-label="Exoplanet observatory entrance">
      <canvas ref={canvas} className="observatory-canvas" aria-hidden="true" />
      <div className="observatory-shade" aria-hidden="true" />
      <header className="observatory-header">
        <span className="observatory-brand">ASTRA—NOMICAL</span>
        <span className="observatory-status"><i aria-hidden="true" /> CATALOGUE READY</span>
      </header>
      <div className="observatory-catalogue">
        <span>DISCOVERED SYSTEMS / FEATURED CATALOGUE</span>
        <strong>{String(FEATURED_PLANETS.length).padStart(2, "0")} <small>CONFIRMED WORLDS</small></strong>
      </div>
      <div className="observatory-labels" aria-label="Featured system annotations">
        {SYSTEMS.map((system, index) => <div className={`observatory-label observatory-system-${index}`} key={system.planet.name}>
          <span>{system.planet.name}</span>
          <small>{system.planet.distanceLightYears?.toLocaleString() ?? "Unknown"} ly / {system.planet.starName}</small>
        </div>)}
      </div>
      <div className="observatory-hero">
        <p className="eyebrow">EXOPLANET OBSERVATORY</p>
        <h1>A field guide to<br /><em>distant worlds</em></h1>
        <p className="observatory-description">Real exoplanet data, translated into a world you can enter.</p>
        <button className="primary-button" type="button" onClick={onBegin}>BEGIN EXPLORING <span aria-hidden="true">↗</span></button>
        <span className="observatory-hint">ENTER CATALOGUE / SELECT A WORLD</span>
      </div>
      <footer className="observatory-footer">
        <span>ILLUSTRATIVE EXOPLANET FIELD</span>
        <span>Positions and orbital paths are illustrative.</span>
      </footer>
    </section>
  );
}
