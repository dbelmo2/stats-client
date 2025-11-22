import { useQuery } from "@tanstack/react-query";
import type { StatsResponse, LivestreamsResponse } from "../shared/schema";
import { StatCard } from "../components/StatCard";
import { TotalStatsCard } from "../components/TotalStatsCard";
import { LatenessTrendChart } from "../components/LatenessTrendChart";
import { DayOfWeekChart } from "../components/DayOfWeekChart";
import { LoadingScreen } from "../components/LoadingScreen";
import { ThemeToggle } from "../components/ThemeToggle";
import { Clock, TrendingUp, Tv } from "lucide-react";
import { formatLateTime } from "../lib/utils";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<StatsResponse>({
    queryKey: ['/api/stats'],
  });

  const { data: livestreamsData, isLoading: livestreamsLoading } = useQuery<LivestreamsResponse>({
    queryKey: ['/api/livestreams'],
  });

  if (statsLoading || livestreamsLoading || !stats || !livestreamsData) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-[0.15] pointer-events-none" />
      
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
        <div className="w-full h-1 bg-foreground/50 animate-scanline" />
      </div>

      <div className="relative z-10">
        <header className="border-b-2 border-primary/40 bg-card/80 backdrop-blur-md shadow-lg shadow-primary/10 sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/20 border-2 border-primary/40">
                <Tv className="w-6 h-6 md:w-8 md:h-8 text-primary" strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="font-pixel text-xl md:text-2xl text-primary drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]" data-testid="heading-main">
                  L3L3
                </h1>
                <p className="font-retro text-sm md:text-base text-muted-foreground hidden sm:block">
                  LATENESS TRACKER
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="hidden md:block font-retro text-sm text-muted-foreground" data-testid="text-last-updated">
                Last Updated: {new Date(stats.lastUpdateDate).toLocaleDateString()}
              </div>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-6 md:py-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <StatCard
              icon={Clock}
              label="Most Recent"
              value={formatLateTime(stats.mostRecent.lateTime)}
              subtitle={stats.mostRecent.title}
            />
            
            <StatCard
              icon={TrendingUp}
              label="Most Late"
              value={formatLateTime(stats.max.lateTime)}
              subtitle={stats.max.title}
            />
          </div>

          <TotalStatsCard
            humanReadable={stats.humanReadable}
            averageLateTime={stats.averageLateTime}
            streamCount={stats.streamCount}
          />

          <div className="space-y-6">
            <LatenessTrendChart livestreams={livestreamsData.livestreams} />
            <DayOfWeekChart dailyStats={stats.daily} />
          </div>

          <footer className="text-center font-retro text-sm md:text-base text-muted-foreground py-4">
            <p>Tracking H3 Podcast YouTube Live Stream Lateness</p>
            <p className="text-xs mt-1 md:hidden" data-testid="text-last-updated-mobile">
              Last Updated: {new Date(stats.lastUpdateDate).toLocaleDateString()}
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}
