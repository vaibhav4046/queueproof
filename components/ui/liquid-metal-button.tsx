"use client";

import { LoaderCircle } from "lucide-react";
import {
  type ButtonHTMLAttributes,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePrefersReducedMotion } from "../../app/components/use-prefers-reduced-motion";

type ShaderPhase = "fallback" | "ready";

type ShaderMountHandle = {
  canvasElement: HTMLCanvasElement;
  dispose: () => void;
  setSpeed: (speed?: number) => void;
};

type NavigatorWithConnection = Navigator & {
  connection?: { saveData?: boolean };
};

export type LiquidMetalButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> & {
  label: string;
  icon?: ReactNode;
  iconOnly?: boolean;
  loading?: boolean;
};

const SHADER_SPEED = 0.42;
const SHADER_BOOT_DELAY_MS = 160;
const SHADER_LOAD_TIMEOUT_MS = 4_000;

const shaderUniforms = {
  u_fit: 2,
  u_scale: 1,
  u_rotation: 0,
  u_originX: 0.5,
  u_originY: 0.5,
  u_offsetX: 0,
  u_offsetY: 0,
  u_worldWidth: 1,
  u_worldHeight: 1,
  u_colorBack: [0.018, 0.018, 0.018, 1],
  u_colorTint: [1, 0.36, 0, 0.58],
  u_image: undefined,
  u_repetition: 3.6,
  u_shiftRed: 0.35,
  u_shiftBlue: -0.22,
  u_contour: 0.62,
  u_softness: 0.36,
  u_distortion: 0.3,
  u_angle: 76,
  u_shape: 0,
  u_isImage: false,
};

function usesDataSaver() {
  return Boolean((navigator as NavigatorWithConnection).connection?.saveData);
}

/**
 * A progressively enhanced native button. Orange-and-black HTML is always
 * rendered first; the WebGL layer is loaded only after hydration and remains
 * decorative, so interaction never depends on the shader.
 */
export function LiquidMetalButton({
  label,
  icon,
  iconOnly = false,
  loading = false,
  disabled = false,
  type = "button",
  className,
  "aria-label": ariaLabel,
  ...buttonProps
}: LiquidMetalButtonProps) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const shaderMountRef = useRef<ShaderMountHandle | null>(null);
  const pauseShaderRef = useRef(disabled || loading);
  const [shaderPhase, setShaderPhase] = useState<ShaderPhase>("fallback");
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const host = hostRef.current;
    if (!host || reducedMotion || usesDataSaver()) return;

    let cancelled = false;
    let timedOut = false;
    let attemptedMount = false;
    let mount: ShaderMountHandle | null = null;
    let canvas: HTMLCanvasElement | null = null;
    let loadTimeout = 0;

    const disposeMount = () => {
      if (!mount) return;
      try {
        mount.dispose();
      } catch {
        // A lost WebGL context can make driver cleanup throw. The HTML fallback
        // remains fully interactive even when disposal is best-effort.
      }
      if (shaderMountRef.current === mount) shaderMountRef.current = null;
      mount = null;
    };

    const handleContextLost = (event: Event) => {
      event.preventDefault();
      if (cancelled) return;
      canvas?.removeEventListener("webglcontextlost", handleContextLost);
      canvas = null;
      setShaderPhase("fallback");
      disposeMount();
    };

    const bootTimer = window.setTimeout(() => {
      loadTimeout = window.setTimeout(() => {
        timedOut = true;
        if (!cancelled) setShaderPhase("fallback");
      }, SHADER_LOAD_TIMEOUT_MS);

      void import("@paper-design/shaders")
        .then(({ ShaderMount, liquidMetalFragmentShader }) => {
          if (cancelled || timedOut) return;

          attemptedMount = true;
          const nextMount = new ShaderMount(
            host,
            liquidMetalFragmentShader,
            shaderUniforms,
            {
              alpha: true,
              antialias: false,
              depth: false,
              powerPreference: "low-power",
              premultipliedAlpha: true,
              preserveDrawingBuffer: false,
            },
            pauseShaderRef.current ? 0 : SHADER_SPEED,
            0,
            1,
            180_000,
          );

          if (cancelled || timedOut) {
            nextMount.dispose();
            return;
          }

          mount = nextMount;
          shaderMountRef.current = nextMount;
          canvas = nextMount.canvasElement;
          canvas.addEventListener("webglcontextlost", handleContextLost);
          setShaderPhase("ready");
        })
        .catch(() => {
          // ShaderMount creates its canvas before requesting WebGL2. Remove a
          // partially constructed canvas when the browser rejects that step.
          if (attemptedMount) {
            host.replaceChildren();
            host.removeAttribute("data-paper-shader");
          }
          if (!cancelled) setShaderPhase("fallback");
        })
        .finally(() => window.clearTimeout(loadTimeout));
    }, SHADER_BOOT_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(bootTimer);
      window.clearTimeout(loadTimeout);
      canvas?.removeEventListener("webglcontextlost", handleContextLost);
      disposeMount();
    };
  }, [reducedMotion]);

  useEffect(() => {
    pauseShaderRef.current = disabled || loading;
    shaderMountRef.current?.setSpeed(disabled || loading ? 0 : SHADER_SPEED);
  }, [disabled, loading]);

  const classes = [
    "liquid-metal-button",
    iconOnly ? "liquid-metal-button--icon" : "",
    className ?? "",
  ].filter(Boolean).join(" ");

  return (
    <button
      {...buttonProps}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      aria-label={ariaLabel ?? (iconOnly ? label : undefined)}
      data-shader={reducedMotion ? "fallback" : shaderPhase}
    >
      <span ref={hostRef} className="liquid-metal-button__shader" aria-hidden="true" />
      <span className="liquid-metal-button__contrast" aria-hidden="true" />
      <span className="liquid-metal-button__content">
        <span className="liquid-metal-button__icon" aria-hidden="true">
          {loading ? <LoaderCircle className="spin" size={15} /> : icon}
        </span>
        <span className={iconOnly ? "sr-only" : ""}>{label}</span>
      </span>
    </button>
  );
}
