"use client";

import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "../../app/components/use-prefers-reduced-motion";
import { AsciiArt, EMBER_POSTER_SRC, EMBER_VIDEO_SRC } from "../ui/ember";
import styles from "./ember-backdrop.module.css";

export type EmberState =
  | "idle"
  | "retrieving"
  | "connecting"
  | "verifying"
  | "conflict"
  | "complete"
  | "error";

export type EmberPlacement = "composer" | "empty" | "connect" | "detail" | "demo";

export type EmberPlaybackSignals = {
  reducedMotion: boolean;
  saveData: boolean;
  slowConnection: boolean;
  smallViewport: boolean;
};

export type EmberPlaybackPolicy =
  | "video"
  | "fallback-reduced-motion"
  | "fallback-data-saver"
  | "fallback-slow-connection"
  | "fallback-mobile";

export type EmberPlaybackAction = "fallback" | "defer" | "pause" | "play";

export function selectEmberPlaybackPolicy({
  reducedMotion,
  saveData,
  slowConnection,
  smallViewport,
}: EmberPlaybackSignals): EmberPlaybackPolicy {
  if (reducedMotion) return "fallback-reduced-motion";
  if (saveData) return "fallback-data-saver";
  if (slowConnection) return "fallback-slow-connection";
  if (smallViewport) return "fallback-mobile";
  return "video";
}

export function selectEmberPlaybackAction({
  inView,
  pageVisible,
  policy,
  sourceAttached,
}: {
  inView: boolean;
  pageVisible: boolean;
  policy: EmberPlaybackPolicy;
  sourceAttached: boolean;
}): EmberPlaybackAction {
  if (policy !== "video") return "fallback";
  if (!inView || !pageVisible) return sourceAttached ? "pause" : "defer";
  return "play";
}

type NetworkInformation = EventTarget & {
  effectiveType?: string;
  saveData?: boolean;
};

type NetworkNavigator = Navigator & {
  connection?: NetworkInformation;
};

export type EmberBackdropProps = {
  className?: string;
  decorative?: boolean;
  label?: string;
  placement?: EmberPlacement;
  state?: EmberState;
};

/**
 * Production Ember background. It renders a local CSS fallback immediately,
 * then attaches the remote video only while the surface is visible and the
 * browser's motion, data, network, and mobile signals allow it.
 *
 * Mount inside a positioned, overflow-hidden surface. The backdrop is
 * absolute and pointer-inert, so it never contributes to layout or input lag.
 */
export function EmberBackdrop({
  className,
  decorative = true,
  label = "Ember evidence field",
  placement = "composer",
  state = "idle",
}: EmberBackdropProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const root = rootRef.current;
    const video = videoRef.current;
    if (!root || !video) return;

    const smallViewportQuery = window.matchMedia("(max-width: 640px)");
    const connection = (navigator as NetworkNavigator).connection;
    let disposed = false;
    let inView = typeof IntersectionObserver === "undefined";
    let sourceAttached = false;
    let deferredTimer = 0;
    let loadTimer = 0;
    let policy: EmberPlaybackPolicy = "video";

    const clearDeferredTimer = () => {
      if (!deferredTimer) return;
      window.clearTimeout(deferredTimer);
      deferredTimer = 0;
    };

    const clearLoadTimer = () => {
      if (!loadTimer) return;
      window.clearTimeout(loadTimer);
      loadTimer = 0;
    };

    const pause = () => {
      video.pause();
    };

    const releaseSource = ({ keepPoster = false }: { keepPoster?: boolean } = {}) => {
      clearLoadTimer();
      pause();
      if (sourceAttached) {
        sourceAttached = false;
        video.removeAttribute("src");
        video.load();
      }
      if (!keepPoster) video.removeAttribute("poster");
    };

    const fail = () => {
      if (disposed || policy !== "video") return;
      releaseSource({ keepPoster: true });
      root.dataset.videoState = "failed";
    };

    const play = () => {
      if (disposed || policy !== "video" || !inView || document.visibilityState === "hidden") return;

      if (!sourceAttached) {
        sourceAttached = true;
        root.dataset.videoState = "loading";
        video.poster = EMBER_POSTER_SRC;
        video.src = EMBER_VIDEO_SRC;
        video.load();
        clearLoadTimer();
        loadTimer = window.setTimeout(fail, 8_000);
      }

      const playRequest = video.play();
      if (playRequest) {
        void playRequest.catch((error: unknown) => {
          const interrupted = error instanceof DOMException && error.name === "AbortError";
          if (!interrupted && !disposed && inView && document.visibilityState !== "hidden") fail();
        });
      }
    };

    const deferPlay = () => {
      if (deferredTimer || disposed || policy !== "video" || !inView) return;
      root.dataset.videoState = sourceAttached ? "paused" : "deferred";
      deferredTimer = window.setTimeout(() => {
        deferredTimer = 0;
        play();
      }, 160);
    };

    const readPolicy = () => selectEmberPlaybackPolicy({
      reducedMotion,
      saveData: connection?.saveData === true,
      slowConnection: connection?.effectiveType === "slow-2g" || connection?.effectiveType === "2g",
      smallViewport: smallViewportQuery.matches,
    });

    const reconcile = () => {
      policy = readPolicy();
      const action = selectEmberPlaybackAction({
        inView,
        pageVisible: document.visibilityState !== "hidden",
        policy,
        sourceAttached,
      });

      if (action === "fallback") {
        clearDeferredTimer();
        releaseSource();
        root.dataset.videoState = policy;
        return;
      }

      if (action === "play") deferPlay();
      else {
        clearDeferredTimer();
        pause();
        root.dataset.videoState = action === "pause" ? "paused" : "deferred";
      }
    };

    const onCanPlay = () => {
      if (disposed || policy !== "video") return;
      clearLoadTimer();
      root.dataset.videoState = "ready";
    };

    const onVisibilityChange = () => reconcile();
    const observer = typeof IntersectionObserver === "undefined"
      ? null
      : new IntersectionObserver(([entry]) => {
        inView = entry?.isIntersecting ?? false;
        reconcile();
      });

    observer?.observe(root);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("error", fail);
    document.addEventListener("visibilitychange", onVisibilityChange);
    smallViewportQuery.addEventListener("change", reconcile);
    connection?.addEventListener("change", reconcile);
    reconcile();

    return () => {
      disposed = true;
      clearDeferredTimer();
      clearLoadTimer();
      observer?.disconnect();
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("error", fail);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      smallViewportQuery.removeEventListener("change", reconcile);
      connection?.removeEventListener("change", reconcile);
      releaseSource();
    };
  }, [reducedMotion]);

  return (
    <div
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      data-ember-backdrop=""
      data-placement={placement}
      data-state={state}
      data-video-state="deferred"
      aria-hidden={decorative ? "true" : undefined}
      aria-label={decorative ? undefined : label}
      role={decorative ? undefined : "img"}
    >
      <span className={styles.fallback} aria-hidden="true" />
      <AsciiArt
        ref={videoRef}
        className={styles.video}
        decorative
        poster={null}
        source={null}
      />
    </div>
  );
}
