"use client";

import { useLayoutEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Matrix4, Quaternion, Vector3 } from "three";
import type { VisualEnvironment } from "../../types/visual-environment";

const MAX_PITCH = 85 * Math.PI / 180;
const SENSITIVITY = 0.004;
const clampPitch = (pitch: number) => Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch));

/** The only camera writer: idle before interaction, then persistent observer look. */
export function ObserverCamera({ v, heightAt, resetView, organismTarget = null, focusOrganism = 0 }: {
  v: VisualEnvironment;
  heightAt: (x: number, z: number) => number;
  resetView: number;
  organismTarget?: [number, number, number] | null;
  focusOrganism?: number;
}) {
  const { camera, gl, size } = useThree();
  const state = useRef({ yaw: 0, pitch: 0, targetYaw: 0, targetPitch: 0,
    paused: false, reduced: false, time: 0, pointer: -1, x: 0, y: 0,
    inspecting: false, orbitYaw: 0.35, orbitPitch: 0.32, orbitRadius: 6.2 });
  const orbit = useRef({ position: new Vector3(), target: new Vector3(), matrix: new Matrix4(), rotation: new Quaternion() });

  useLayoutEffect(() => {
    const s = state.current;
    s.inspecting = false;
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
    if (!organismTarget) {
      if (state.current.inspecting) {
        const s = state.current;
        s.inspecting = false; s.yaw = s.targetYaw = 0;
        s.pitch = s.targetPitch = Math.atan2(v.cameraLookHeight - v.cameraHeight, 102.25);
        camera.position.set(0,(v.surfacePreset === "gas-giant" ? 0 : heightAt(0,12.25))+v.cameraHeight,12.25);
      }
      return;
    }
    const s = state.current;
    s.inspecting = true; s.paused = true;
    s.orbitYaw = 0.35; s.orbitPitch = 0.32;
    // Preserve the whole silhouette when the world is shown in a narrow browser panel.
    s.orbitRadius = 6.2 * Math.max(1, .85 * size.height / Math.max(1,size.width));
    orbit.current.target.set(...organismTarget);
  }, [organismTarget, focusOrganism, camera, heightAt, v, size.width, size.height]);

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
      if (s.inspecting) {
        s.orbitYaw -= (event.clientX - s.x) * SENSITIVITY;
        s.orbitPitch = Math.max(0.12, Math.min(1.35, s.orbitPitch + (event.clientY - s.y) * SENSITIVITY));
        s.x = event.clientX; s.y = event.clientY;
        return;
      }
      // Never wrap yaw: repeated drags can pass through any number of revolutions.
      s.targetYaw -= (event.clientX - s.x) * SENSITIVITY;
      s.targetPitch = clampPitch(s.targetPitch - (event.clientY - s.y) * SENSITIVITY);
      s.x = event.clientX; s.y = event.clientY;
    };
    const zoom = (event: WheelEvent) => {
      if (!s.inspecting) return;
      event.preventDefault();
      s.orbitRadius = Math.max(3.2, Math.min(12, s.orbitRadius * Math.exp(Math.max(-100, Math.min(100,event.deltaY)) * .002)));
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
    canvas.addEventListener("wheel", zoom, { passive: false });
    return () => {
      root?.removeEventListener("pointerdown", pause, true);
      root?.removeEventListener("wheel", pause, true);
      root?.removeEventListener("focusin", pause);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("lostpointercapture", up);
      canvas.removeEventListener("wheel", zoom);
      canvas.classList.remove("is-looking");
      media.removeEventListener("change", reduce);
      gl.toneMappingExposure = previousExposure;
    };
  }, [gl, v]);

  useFrame((_, delta) => {
    const s = state.current;
    if (s.inspecting) {
      const o = orbit.current;
      o.position.set(o.target.x + Math.sin(s.orbitYaw)*Math.cos(s.orbitPitch)*s.orbitRadius,
        o.target.y + Math.sin(s.orbitPitch)*s.orbitRadius,
        o.target.z + Math.cos(s.orbitYaw)*Math.cos(s.orbitPitch)*s.orbitRadius);
      if (v.surfacePreset !== "gas-giant") o.position.y = Math.max(o.position.y, heightAt(o.position.x,o.position.z)+1.1);
      const damping = s.reduced ? 1 : 1 - Math.exp(-7 * Math.min(delta,.1));
      camera.position.lerp(o.position,damping);
      o.matrix.lookAt(camera.position,o.target,camera.up);
      o.rotation.setFromRotationMatrix(o.matrix);
      camera.quaternion.slerp(o.rotation,damping);
      return;
    }
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
