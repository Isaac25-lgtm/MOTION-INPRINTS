"use client";

import { useEffect, useRef, useState } from "react";

type Source = { src: string; poster: string };

/**
 * Muted, looping background video with a visible pause control (moving
 * content that plays for more than five seconds must be pausable). Visitors
 * who prefer reduced motion get the still poster and no playback.
 * A portrait clip is served to narrow screens.
 */
export function HeroVideo({ wide, tall }: { wide: Source; tall: Source }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobile = window.matchMedia("(max-width: 700px)");
    const pick = () => {
      setNarrow(mobile.matches);
    };
    pick();
    mobile.addEventListener("change", pick);
    if (!reduce.matches) {
      video.play().then(
        () => setPlaying(true),
        () => setPlaying(false),
      );
    }
    return () => mobile.removeEventListener("change", pick);
  }, [narrow]);

  const source = narrow ? tall : wide;

  function toggle() {
    const video = ref.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(
        () => setPlaying(true),
        () => {},
      );
    } else {
      video.pause();
      setPlaying(false);
    }
  }

  return (
    <>
      <video
        key={source.src}
        ref={ref}
        className="hero__video"
        muted
        loop
        playsInline
        preload="metadata"
        poster={source.poster}
        aria-hidden="true"
      >
        <source src={source.src} type="video/mp4" />
      </video>
      <button
        type="button"
        className="hero__pause"
        onClick={toggle}
        aria-label={
          playing ? "Pause background video" : "Play background video"
        }
      >
        {playing ? "Pause" : "Play"}
      </button>
    </>
  );
}
