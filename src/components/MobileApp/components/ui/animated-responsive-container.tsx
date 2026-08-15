import * as React from "react";
import { ResponsiveContainer } from "recharts";
import { AnimateChartInView } from "./animate-chart-in-view";

type ResponsiveContainerProps = React.ComponentProps<typeof ResponsiveContainer>;

interface AnimatedResponsiveContainerProps extends ResponsiveContainerProps {
  /** Fraction of the element that must be visible before it mounts. */
  inViewAmount?: number;
  /** Replay the animation every time the element re-enters view. */
  inViewOnce?: boolean;
}

/**
 * Drop-in replacement for recharts' ResponsiveContainer that defers mounting
 * the chart until it scrolls into view, so its entrance animation plays then
 * instead of all at once on page load. See AnimateChartInView.
 */
export function AnimatedResponsiveContainer({
  inViewAmount,
  inViewOnce,
  ...props
}: AnimatedResponsiveContainerProps) {
  return (
    <AnimateChartInView amount={inViewAmount} once={inViewOnce}>
      <ResponsiveContainer {...props} />
    </AnimateChartInView>
  );
}
