"use client";

import { useSyncExternalStore } from "react";
import { MeshGradient, Shader } from "shaders/react";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(REDUCED_MOTION);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/**
 * Slow indigo mesh gradient for the auth brand panel (WebGPU via shaders.com).
 *
 * - Telemetry is disabled: the library otherwise reports hostname and user agent to its vendor.
 * - Without WebGPU the canvas stays transparent and the CSS gradient underneath shows through.
 * - With "reduce motion" enabled nothing is rendered, leaving the static CSS gradient.
 */
export default function AuthShader() {
  const reduceMotion = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => true,
  );
  if (reduceMotion) return null;

  return (
    <Shader className="absolute inset-0 size-full" disableTelemetry>
      <MeshGradient
        stops={[
          { color: "#1e1b4b", position: 0 },
          { color: "#312e81", position: 0.35 },
          { color: "#4f46e5", position: 0.7 },
          { color: "#7c3aed", position: 1 },
        ]}
        colorSpace="oklab"
        count={4}
        smoothness={2.4}
        swirl={0.25}
        drift={0.3}
        speed={0.25}
      />
    </Shader>
  );
}
