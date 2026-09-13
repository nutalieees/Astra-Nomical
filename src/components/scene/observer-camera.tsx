"use client";

import { useLayoutEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { VisualEnvironment } from "../../types/visual-environment";

const MAX_PITCH = 85 * Math.PI / 180;
const SENSITIVITY = 0.004;
const clampPitch = (pitch: number) => Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch));

/** The only camera writer: idle before interaction, then persistent observer look. */
export function ObserverCamera({ v, heightAt, resetView }: {
  v: VisualEnvironment;
  heightAt: (x: number, z: number) => number;
  resetView: number;
}) {
  const { camera, gl } = useThree();
  const state = useRef({ yaw: 0, pitch: 0, targetYaw: 0, targetPitch: 0,
    paused: false, reduced: false, time: 0, pointer: -1, x: 0, y: 0 });

  useLayoutEffect(() => {
    const s = state.current;
    s.yaw = s.targetYaw = 0;
    s.pitch = s.targetPitch = Math.atan2(v.cameraLookHeight - v.cameraHeight, 102.25);
    s.time = 0;
    // Reset stays at the exact initial pose until the next drag, without idle drift.
    s.paused = resetView > 0;
    if (s.pointer !== -1 && gl.domElement.hasPointerCapture(s.pointer)) gl.domElement.releasePointerCapture(s.pointer);
    s.pointer = -1;
    gl.domElement.classList.remove("is-looking");
    const ground = v.surfacePreset === "gas-giant" ? 0 : heightAt(0, 12.25);
    camera.position.set(0, ground + v.cameraHeight, 12.25);
    camera.rotation.set(s.pitch, 0, 0, "YXZ");
  }, [camera, gl, v, heightAt, resetView]);

  useLayoutEffect(() => {
    const canvas = gl.domElement, s = state.current;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reduce = () => { s.reduced = media.matches; };
    reduce(); media.addEventListener("change", reduce);
    const previousExposure = gl.toneMappingExposure;
    gl.toneMappingExposure = v.exposure;
    const pause = () => {
      if (!s.paused) { s.targetYaw = s.yaw; s.targetPitch = s.pitch; }
      s.paused = true;
    };
    const down = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0 || s.pointer !== -1) return;
      pause();
      s.pointer = event.pointerId; s.x = event.clientX; s.y = event.clientY;
      canvas.setPointerCapture(event.pointerId);
      canvas.classList.add("is-looking");
      event.preventDefault();
    };
    const move = (event: PointerEvent) => {
      if (event.pointerId !== s.pointer) return;
      // Never wrap yaw: repeated drags can pass through any number of revolutions.
      s.targetYaw -= (event.clientX - s.x) * SENSITIVITY;
      s.targetPitch = clampPitch(s.targetPitch - (event.clientY - s.y) * SENSITIVITY);
      s.x = event.clientX; s.y = event.clientY;
    };
    const up = (event: PointerEvent) => {
      if (event.pointerId !== s.pointer) return;
      s.pointer = -1;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      canvas.classList.remove("is-looking");
    };
    // Capture only pauses idle on HUD interaction. Rotation listeners exist on Canvas only.
    const root = canvas.closest(".world-page");
    root?.addEventListener("pointerdown", pause, true);
    root?.addEventListener("wheel", pause, { passive: true, capture: true });
    root?.addEventListener("focusin", pause);
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("lostpointercapture", up);
    return () => {
      root?.removeEventListener("pointerdown", pause, true);
      root?.removeEventListener("wheel", pause, true);
      root?.removeEventListener("focusin", pause);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("lostpointercapture", up);
      canvas.classList.remove("is-looking");
      media.removeEventListener("change", reduce);
      gl.toneMappingExposure = previousExposure;
    };
  }, [gl, v]);

  useFrame((_, delta) => {
    const s = state.current;
    if (!s.paused && !s.reduced) {
      s.time += Math.min(delta, 0.05);
      const x = Math.sin(s.time * v.cameraSpeed) * v.cameraSway;
      const z = 12 + Math.cos(s.time * v.cameraSpeed * 0.7) * 0.25;
      const ground = v.surfacePreset === "gas-giant" ? 0 : heightAt(x, z);
      camera.position.set(x, ground + v.cameraHeight, z);
      s.yaw = s.targetYaw = Math.atan2(x * 0.8, 90 + z);
      s.pitch = s.targetPitch = Math.atan2(v.cameraLookHeight - v.cameraHeight, Math.hypot(x * 0.8, 90 + z));
    } else {
      const damping = 1 - Math.exp(-25 * Math.min(delta, 0.1));
      s.yaw += (s.targetYaw - s.yaw) * damping;
      s.pitch += (s.targetPitch - s.pitch) * damping;
    }
    // YXZ gives world-up yaw, bounded pitch, and zero roll. No orbit or translation on drag.
    camera.rotation.set(s.pitch, s.yaw, 0, "YXZ");
  });
  return null;
}
