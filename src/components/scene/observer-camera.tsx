"use client";

import { useLayoutEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { VisualEnvironment } from "../../types/visual-environment";
import { safeObserverMove, type RockPlacement } from "./surface-geometry";

export type MoveDirection = "forward" | "back" | "left" | "right";
export interface MovementInput { held: Set<MoveDirection>; steps: [number,number] }
const directionForKey: Record<string,MoveDirection> = {w:"forward",ArrowUp:"forward",s:"back",ArrowDown:"back",a:"left",ArrowLeft:"left",d:"right",ArrowRight:"right"};
const uiTarget = (target: EventTarget | null) => target instanceof Element && !!target.closest('input,textarea,select,button,summary,[contenteditable="true"],[role="dialog"],.world-hud,.scene-performance');

const MAX_PITCH = 85 * Math.PI / 180;
const SENSITIVITY = 0.004;
const clampPitch = (pitch: number) => Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch));

/** The only camera writer: idle before interaction, then persistent observer look. */
export function ObserverCamera({ v, heightAt, resetView, rocks, movement }: {
  v: VisualEnvironment;
  heightAt: (x: number, z: number) => number;
  resetView: number;
  rocks: RockPlacement[];
  movement?: MovementInput;
}) {
  const { camera, gl } = useThree();
  const state = useRef({ yaw: 0, pitch: 0, targetYaw: 0, targetPitch: 0,
    paused: false, reduced: false, time: 0, pointer: -1, x: 0, y: 0 });
  const keys = useRef(new Set<MoveDirection>());
  const emptyInput = useRef<MovementInput>({held:new Set(),steps:[0,0]});
  const input = movement ?? emptyInput.current;

  useLayoutEffect(() => {
    const s = state.current;
    s.yaw = s.targetYaw = 0;
    s.pitch = s.targetPitch = Math.atan2(v.cameraLookHeight - v.cameraHeight, 102.25);
    s.time = 0;
    // Reset stays at the exact initial pose until the next drag, without idle drift.
    s.paused = resetView > 0;
    if (s.pointer !== -1 && gl.domElement.hasPointerCapture(s.pointer)) gl.domElement.releasePointerCapture(s.pointer);
    s.pointer = -1;
    keys.current.clear(); input.held.clear(); input.steps=[0,0];
    gl.domElement.classList.remove("is-looking");
    const ground = v.surfacePreset === "gas-giant" ? 0 : heightAt(0, 12.25);
    camera.position.set(0, ground + v.cameraHeight, 12.25);
    camera.rotation.set(s.pitch, 0, 0, "YXZ");
  }, [camera, gl, v, heightAt, resetView,input]);

  useLayoutEffect(() => {
    const canvas = gl.domElement, s = state.current;
    canvas.tabIndex=0;
    canvas.setAttribute("aria-label","Planetary environment. Drag to look; WASD or arrow keys to move.");
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
      canvas.focus({preventScroll:true});
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
    const pauseUi = (event: Event) => { pause(); if(event.target !== canvas) keys.current.clear(); };
    const clear = () => { keys.current.clear(); input.held.clear(); input.steps=[0,0]; s.pointer=-1; canvas.classList.remove("is-looking"); };
    const keyDown = (event: KeyboardEvent) => {
      const direction=directionForKey[event.key] ?? directionForKey[event.key.toLowerCase()];
      if(!direction || uiTarget(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
      pause(); event.preventDefault();
      if(!event.repeat && !keys.current.has(direction)) {
        input.steps[0] += direction === "right" ? .35 : direction === "left" ? -.35 : 0;
        input.steps[1] += direction === "forward" ? .875 : direction === "back" ? -.875 : 0;
      }
      keys.current.add(direction);
    };
    const keyUp = (event: KeyboardEvent) => {const direction=directionForKey[event.key] ?? directionForKey[event.key.toLowerCase()];if(direction) keys.current.delete(direction);};
    window.addEventListener("keydown",keyDown);window.addEventListener("keyup",keyUp);window.addEventListener("blur",clear);
    document.addEventListener("visibilitychange",clear);
    root?.addEventListener("pointerdown", pauseUi, true);
    root?.addEventListener("wheel", pause, { passive: true, capture: true });
    root?.addEventListener("focusin", pauseUi);
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("lostpointercapture", up);
    return () => {
      root?.removeEventListener("pointerdown", pauseUi, true);
      root?.removeEventListener("wheel", pause, true);
      root?.removeEventListener("focusin", pauseUi);
      window.removeEventListener("keydown",keyDown);window.removeEventListener("keyup",keyUp);window.removeEventListener("blur",clear);
      document.removeEventListener("visibilitychange",clear);clear();
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("lostpointercapture", up);
      canvas.classList.remove("is-looking");
      media.removeEventListener("change", reduce);
      gl.toneMappingExposure = previousExposure;
    };
  }, [gl, v,input]);

  useFrame((_, delta) => {
    const s = state.current;
    const has = (direction:MoveDirection)=>keys.current.has(direction)||input.held.has(direction);
    let right=Number(has("right"))-Number(has("left")), forward=Number(has("forward"))-Number(has("back"));
    const length=Math.hypot(right,forward)||1;
    right=right/length*v.movementSpeed*Math.min(delta,.05)+input.steps[0];
    forward=forward/length*v.movementSpeed*Math.min(delta,.05)+input.steps[1];
    input.steps=[0,0];
    if(right || forward) {
      s.paused=true;
      const dx=Math.cos(s.yaw)*right-Math.sin(s.yaw)*forward;
      const dz=-Math.sin(s.yaw)*right-Math.cos(s.yaw)*forward;
      const next=safeObserverMove(camera.position.x,camera.position.z,dx,dz,v,heightAt,rocks);
      camera.position.set(next.x,(v.surfacePreset === "gas-giant" ? 0 : heightAt(next.x,next.z))+v.cameraHeight,next.z);
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
