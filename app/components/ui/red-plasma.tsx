"use client";

import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "../use-prefers-reduced-motion";

const VERTEX_SHADER = `
attribute vec2 a_position;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec4 u_scene;
uniform vec3 u_colors[4];

#define u_resolution u_scene.xy
#define u_time u_scene.z
#define u_motion u_scene.w

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 5; i++) {
    value += amplitude * noise(p);
    p = p * 2.03 + vec2(13.1, 7.7);
    amplitude *= 0.5;
  }
  return value;
}

vec3 palette(float x) {
  float t = clamp(x, 0.0, 1.0) * 3.0;
  if (t < 1.0) return mix(u_colors[0], u_colors[1], smoothstep(0.0, 1.0, t));
  if (t < 2.0) return mix(u_colors[1], u_colors[2], smoothstep(0.0, 1.0, t - 1.0));
  return mix(u_colors[2], u_colors[3], smoothstep(0.0, 1.0, t - 2.0));
}

void main() {
  vec2 screen = gl_FragCoord.xy / u_resolution.xy;
  vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution.xy)
    / min(u_resolution.x, u_resolution.y);

  float t = u_time * u_motion;
  p *= 1.45;
  p += 0.055 * vec2(sin(t * 0.31), cos(t * 0.23));

  vec2 warp = vec2(
    fbm(p * 1.15 + vec2(t * 0.025, 0.0)),
    fbm(p * 1.15 + vec2(4.2, 1.7 - t * 0.021))
  ) - 0.5;
  p += warp * 0.46;

  float ribbons = sin(p.x * 4.2 + t * 0.38)
    + sin(p.y * 3.6 - t * 0.29)
    + sin((p.x + p.y) * 2.7 + t * 0.17)
    + sin(length(p - vec2(0.28, -0.12)) * 7.0 - t * 0.26);
  float field = 0.5 + 0.5 * sin(ribbons + fbm(p * 2.0) * 2.2);
  field = smoothstep(0.14, 0.93, field);

  vec3 color = palette(field);
  float centerLight = 1.0 - smoothstep(0.0, 0.95, length(screen - vec2(0.58, 0.13)));
  color += u_colors[3] * centerLight * 0.075;

  float vignette = smoothstep(0.22, 1.0, length(screen - 0.5) * 1.32);
  color *= 1.0 - vignette * 0.72;
  color += (hash21(gl_FragCoord.xy + 17.0) - 0.5) * 0.026;
  color = clamp((color - 0.5) * 1.08 + 0.5, 0.0, 1.0);
  // Preserve Cosmoq-like black space: only the strongest evidence ribbons
  // should lift out of carbon, never wash the product into a full gradient.
  color = max(color - vec3(0.30), vec3(0.0)) * 0.72;

  gl_FragColor = vec4(color, 1.0);
}
`;

const COLORS = new Float32Array([
  0.008, 0.009, 0.011,
  0.075, 0.048, 0.13,
  0.49, 0.31, 0.82,
  0.84, 1.0, 0.28,
]);

const pendingContextReleases = new WeakMap<HTMLCanvasElement, number>();

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Unable to create the QueueProof evidence-field shader.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const detail = gl.getShaderInfoLog(shader) ?? "Unknown shader error.";
    gl.deleteShader(shader);
    throw new Error(detail);
  }
  return shader;
}

/**
 * A dependency-free WebGL evidence field based on the supplied 21st.dev
 * plasma component. It is deliberately quiet: the field establishes depth,
 * while the real evidence orbit and product controls remain the focal layer.
 */
export function ShaderBackground({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pendingRelease = pendingContextReleases.get(canvas);
    if (pendingRelease !== undefined) window.clearTimeout(pendingRelease);
    pendingContextReleases.delete(canvas);

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      powerPreference: "low-power",
      preserveDrawingBuffer: false,
    });
    if (!gl) {
      canvas.dataset.unavailable = "true";
      return;
    }
    const surface: HTMLCanvasElement = canvas;
    const context: WebGLRenderingContext = gl;

    let program: WebGLProgram | null = null;
    let buffer: WebGLBuffer | null = null;
    let frame = 0;
    let disposed = false;
    let visible = document.visibilityState === "visible";
    let inView = true;
    let lastFrame = 0;
    const startedAt = performance.now();

    try {
      const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
      const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
      program = gl.createProgram();
      if (!program) throw new Error("Unable to link the QueueProof evidence field.");
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) ?? "Unknown WebGL link error.");
      }
      gl.useProgram(program);

      buffer = gl.createBuffer();
      if (!buffer) throw new Error("Unable to allocate the QueueProof evidence field.");
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 3, -1, -1, 3]),
        gl.STATIC_DRAW,
      );
      const position = gl.getAttribLocation(program, "a_position");
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

      const colors = gl.getUniformLocation(program, "u_colors");
      const scene = gl.getUniformLocation(program, "u_scene");
      gl.uniform3fv(colors, COLORS);

      const resize = () => {
        const bounds = canvas.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        const rawWidth = Math.max(1, Math.round(bounds.width * dpr));
        const rawHeight = Math.max(1, Math.round(bounds.height * dpr));
        const pixelScale = Math.min(
          1,
          Math.sqrt(1_100_000 / Math.max(1, rawWidth * rawHeight)),
        );
        const width = Math.max(1, Math.round(rawWidth * pixelScale));
        const height = Math.max(1, Math.round(rawHeight * pixelScale));
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
          gl.viewport(0, 0, width, height);
        }
      };

      const requestRender = () => {
        if (!disposed && visible && inView && frame === 0) {
          frame = window.requestAnimationFrame(render);
        }
      };

      function render(now: number) {
        frame = 0;
        if (disposed || !visible || !inView) return;
        if (!reducedMotion && now - lastFrame < 32) {
          requestRender();
          return;
        }
        lastFrame = now;
        resize();
        context.uniform4f(
          scene,
          surface.width,
          surface.height,
          reducedMotion ? 0 : (now - startedAt) / 1000,
          reducedMotion ? 0 : 0.72,
        );
        context.drawArrays(context.TRIANGLES, 0, 3);
        if (!reducedMotion) requestRender();
      }

      const resizeObserver = new ResizeObserver(() => requestRender());
      resizeObserver.observe(canvas);
      const intersectionObserver = new IntersectionObserver(([entry]) => {
        inView = entry?.isIntersecting ?? true;
        if (inView) requestRender();
        else if (frame) {
          window.cancelAnimationFrame(frame);
          frame = 0;
        }
      });
      intersectionObserver.observe(canvas);
      const onVisibilityChange = () => {
        visible = document.visibilityState === "visible";
        if (visible) requestRender();
        else if (frame) {
          window.cancelAnimationFrame(frame);
          frame = 0;
        }
      };
      document.addEventListener("visibilitychange", onVisibilityChange);
      window.addEventListener("resize", requestRender, { passive: true });
      requestRender();

      return () => {
        disposed = true;
        window.cancelAnimationFrame(frame);
        resizeObserver.disconnect();
        intersectionObserver.disconnect();
        document.removeEventListener("visibilitychange", onVisibilityChange);
        window.removeEventListener("resize", requestRender);
        if (buffer) gl.deleteBuffer(buffer);
        if (program) gl.deleteProgram(program);
        const releaseTimer = window.setTimeout(() => {
          if (pendingContextReleases.get(canvas) !== releaseTimer) return;
          pendingContextReleases.delete(canvas);
          gl.getExtension("WEBGL_lose_context")?.loseContext();
          canvas.width = 1;
          canvas.height = 1;
        }, 0);
        pendingContextReleases.set(canvas, releaseTimer);
      };
    } catch {
      canvas.dataset.unavailable = "true";
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      return;
    }
  }, [reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden="true"
      tabIndex={-1}
    />
  );
}
