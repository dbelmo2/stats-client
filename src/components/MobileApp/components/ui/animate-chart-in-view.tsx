import * as React from "react";
import { useInView } from "framer-motion";

interface AnimateChartInViewProps {
  children: React.ReactNode;
  className?: string;
  /** Fraction of the element that must be visible before it mounts. */
  amount?: number;
  /** Replay the animation every time the element re-enters view. */
  once?: boolean;
}

/**
 * Defers mounting its children until they scroll into view.
 *
 * Recharts animates on mount, not on scroll, so wrapping
 * a chart's render (not just a container) in this component makes its
 * entrance animation play when the user actually scrolls to it instead of
 * all at once on page load.
 */
export function AnimateChartInView({
  children,
  className = "h-full w-full",
  amount = 0.3,
  once = true,
}: AnimateChartInViewProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once, amount });

  return (
    <div ref={ref} className={className}>
      {isInView ? children : null}
    </div>
  );
}
