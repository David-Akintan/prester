"use client";

import { useEffect, useRef, useState } from "react";

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  /** Vertical offset to translate from while hidden, in px. */
  offset?: number;
  /** When true, observer fires once and disconnects. Default true. */
  once?: boolean;
}

/**
 * Wraps content in an IntersectionObserver-driven fade + slide-up. Replaces
 * on-mount keyframe animations for below-the-fold sections so the entrance
 * lands when the user actually reaches them.
 */
export function Reveal({
  children,
  className = "",
  delay = 0,
  offset = 24,
  once = true,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Guard against environments without IO (very old browsers / SSR safety).
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (once) obs.disconnect();
        } else if (!once) {
          setVisible(false);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [once]);

  return (
    <div
      ref={ref}
      style={{
        transitionDelay: `${delay}ms`,
        transform: visible ? "translateY(0)" : `translateY(${offset}px)`,
      }}
      className={`transition-all duration-700 ease-out motion-reduce:transition-none motion-reduce:transform-none ${
        visible ? "opacity-100" : "opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}
