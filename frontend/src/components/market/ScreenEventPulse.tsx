import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import type { ScreenPulse, ScreenPulseHandle } from "./types";

export const SCREEN_PULSE_EDGES = ["top", "right", "bottom", "left"] as const;

export const SCREEN_PULSE_KEYFRAMES: Keyframe[] = [
  { opacity: 0, offset: 0 },
  { opacity: 0.38, offset: 0.12 },
  { opacity: 0.72, offset: 0.24 },
  { opacity: 0.93, offset: 0.36 },
  { opacity: 1, offset: 0.48 },
  { opacity: 0.88, offset: 0.6 },
  { opacity: 0.68, offset: 0.72 },
  { opacity: 0.34, offset: 0.84 },
  { opacity: 0, offset: 1 }
];

export const SCREEN_PULSE_ANIMATION_OPTIONS: KeyframeAnimationOptions = {
  duration: 1350,
  easing: "linear",
  fill: "both"
};

export const ScreenEventPulse = memo(
  forwardRef<ScreenPulseHandle, object>(function ScreenEventPulse(_, ref) {
    const edgeRefs = useRef<HTMLSpanElement[]>([]);
    const animationsRef = useRef<Animation[]>([]);
    const timeoutRef = useRef<number | null>(null);
    const activationFrameRef = useRef<number | null>(null);

    const clearPulse = useCallback(() => {
      if (activationFrameRef.current !== null) {
        window.cancelAnimationFrame(activationFrameRef.current);
        activationFrameRef.current = null;
      }
      animationsRef.current.forEach(animation => animation.cancel());
      animationsRef.current = [];
      edgeRefs.current.forEach(edge => {
        edge.dataset.active = "false";
        edge.style.opacity = "";
      });
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        trigger(kind: ScreenPulse["kind"], tone: ScreenPulse["tone"]) {
          clearPulse();
          const edges = edgeRefs.current;
          const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          edges.forEach(edge => {
            edge.dataset.active = "true";
            edge.dataset.event = kind;
            edge.dataset.tone = tone;
          });

          if (reducedMotion) {
            edges.forEach(edge => {
              edge.style.opacity = ".75";
            });
          } else {
            // Start the compositor animation on the next frame without re-rendering the screen.
            const keyframes = SCREEN_PULSE_KEYFRAMES;
            activationFrameRef.current = window.requestAnimationFrame(() => {
              activationFrameRef.current = null;
              animationsRef.current = edges.map(edge =>
                edge.animate(keyframes, SCREEN_PULSE_ANIMATION_OPTIONS)
              );
            });
          }

          if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
          timeoutRef.current = window.setTimeout(() => {
            timeoutRef.current = null;
            clearPulse();
          }, 1400);
        }
      }),
      [clearPulse]
    );

    useEffect(
      () => () => {
        if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
        clearPulse();
      },
      [clearPulse]
    );

    return (
      <>
        {SCREEN_PULSE_EDGES.map(edge => (
          <span
            key={edge}
            ref={element => {
              if (element) edgeRefs.current[SCREEN_PULSE_EDGES.indexOf(edge)] = element;
            }}
            className={`sm-market-screen-event-pulse sm-market-screen-event-pulse-${edge}`}
            data-active="false"
            data-tone="info"
            aria-hidden="true"
          />
        ))}
      </>
    );
  })
);
