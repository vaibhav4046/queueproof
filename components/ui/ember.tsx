"use client";

import { forwardRef, type ReactEventHandler } from "react";

export const EMBER_VIDEO_SRC =
  "https://assets.21st.dev/ascii-recipes/videos/user_2nElBLvklOKlAURm6W1PTu6yYFh/1783480449589-7zukz7.mp4";
export const EMBER_POSTER_SRC =
  "https://assets.21st.dev/ascii-recipes/thumbnails/user_2nElBLvklOKlAURm6W1PTu6yYFh/f6c0f60d-9b9e-4f74-9c0a-aef9c5990ef8.jpg";

export type AsciiArtProps = {
  className?: string;
  decorative?: boolean;
  label?: string;
  onCanPlay?: ReactEventHandler<HTMLVideoElement>;
  onError?: ReactEventHandler<HTMLVideoElement>;
  poster?: string | null;
  source?: string | null;
};

/**
 * The low-level Ember media primitive. Use EmberBackdrop for production
 * surfaces so loading, playback, motion preferences, and failure states are
 * handled consistently.
 */
export const AsciiArt = forwardRef<HTMLVideoElement, AsciiArtProps>(function AsciiArt(
  {
    className,
    decorative = true,
    label = "Ember — animated ASCII art",
    onCanPlay,
    onError,
    poster = EMBER_POSTER_SRC,
    source = EMBER_VIDEO_SRC,
  },
  ref,
) {
  return (
    <video
      ref={ref}
      className={className}
      src={source ?? undefined}
      poster={poster ?? undefined}
      autoPlay={Boolean(source)}
      loop
      muted
      playsInline
      preload={source ? "metadata" : "none"}
      disablePictureInPicture
      aria-hidden={decorative ? "true" : undefined}
      aria-label={decorative ? undefined : label}
      tabIndex={-1}
      onCanPlay={onCanPlay}
      onError={onError}
    />
  );
});
