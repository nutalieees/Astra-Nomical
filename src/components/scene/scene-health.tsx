"use client";
import { Component, useEffect, useRef, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";

export class SceneBoundary extends Component<{children:ReactNode;fallback:ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed ? this.props.fallback : this.props.children;}
}

export function SceneHealth({onLost,token,onSample,failureToken}:{onLost:()=>void;token:number;onSample:(result:string)=>void;failureToken:number}) {
  const {gl,camera}=useThree();
  const sample=useRef({active:false,warm:0,previous:0,start:0,frames:[] as number[],calls:0,triangles:0});
  useEffect(()=>{
    const lost=(event:Event)=>{event.preventDefault();onLost();};
    gl.domElement.addEventListener("webglcontextlost",lost);
    return ()=>gl.domElement.removeEventListener("webglcontextlost",lost);
  },[gl,onLost]);
  useEffect(()=>{sample.current={active:token>0,warm:0,previous:0,start:0,frames:[],calls:0,triangles:0};},[token]);
  useEffect(()=>{if(failureToken>0) {const extension=gl.getContext().getExtension("WEBGL_lose_context");if(extension) extension.loseContext();else onSample("Context-loss simulation unavailable in this browser.");}},[failureToken,gl,onSample]);
  useFrame(()=>{
    const s=sample.current;if(!s.active)return;
    const now=performance.now();
    if(s.warm++<30){s.previous=now;s.start=now;return;}
    s.frames.push(now-s.previous);s.previous=now;
    s.calls=Math.max(s.calls,gl.info.render.calls);s.triangles=Math.max(s.triangles,gl.info.render.triangles);
    if(s.frames.length<120)return;
    s.active=false;
    const sorted=[...s.frames].sort((a,b)=>a-b), context=gl.getContext();
    const debug=context.getExtension("WEBGL_debug_renderer_info");
    onSample(JSON.stringify({samples:120,elapsedMs:Math.round(now-s.start),callbackFps:+(120000/(now-s.start)).toFixed(1),
      medianMs:+sorted[60].toFixed(2),p95Ms:+sorted[114].toFixed(2),maxDrawCalls:s.calls,maxTriangles:s.triangles,
      viewport:[gl.domElement.clientWidth,gl.domElement.clientHeight],buffer:[gl.domElement.width,gl.domElement.height],
      renderer:debug?context.getParameter(debug.UNMASKED_RENDERER_WEBGL):context.getParameter(context.RENDERER),
      observer:camera.position.toArray().map(value=>+value.toFixed(2)),
      note:"R3F callback timing on this browser/machine, not a GPU-time measurement or device-independent benchmark."},null,2));
  });
  return null;
}
