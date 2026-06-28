import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ChevronDown, ChevronUp, Play, Trophy } from "lucide-react";
import { LoadingScreen } from "../components/LoadingScreen";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { ClipPlayer } from "../components/contest/ClipPlayer";
import type { Contest, ContestClip, ContestResult } from "../shared/contestSchema";
import type { PaginatedResponse } from "../shared/schema";
import { apiRequest } from "../lib/queryClient";

const RANK_ICONS = ["🥇", "🥈", "🥉"];
const RANK_LABELS = ["1st Place", "2nd Place", "3rd Place"];

function formatContestRange(startDate: string, endDate: string): string {
  const start = new Date(startDate).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const end = new Date(endDate).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${start} – ${end}`;
}

function ResultRow({ result }: { result: ContestResult }) {
  const [playerOpen, setPlayerOpen] = useState(false);

  const { data: clip } = useQuery<ContestClip>({
    queryKey: ["contest-clip", result.clipId],
    queryFn: () =>
      apiRequest("GET", `/api/contest/clip-contest/clips/${result.clipId}`).then((r) => r.json()),
  });

  return (
    <div className="rounded-md bg-background/40 border border-border/40 overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        <span className="text-2xl shrink-0">{RANK_ICONS[result.rank - 1] ?? `#${result.rank}`}</span>

        {clip ? (
          <button
            className="relative shrink-0 w-20 aspect-video rounded overflow-hidden border border-primary/20 hover:border-primary/50 transition-colors group"
            onClick={() => setPlayerOpen((v) => !v)}
          >
            <img
              src={`https://img.youtube.com/vi/${clip.videoId}/mqdefault.jpg`}
              alt={clip.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/20 transition-colors">
              <Play className="w-4 h-4 text-white" />
            </div>
          </button>
        ) : (
          <div className="shrink-0 w-20 aspect-video rounded bg-muted/30 animate-pulse" />
        )}

        <div className="flex-1 min-w-0">
          <div className="font-retro text-sm uppercase text-muted-foreground">
            {RANK_LABELS[result.rank - 1] ?? `Rank ${result.rank}`}
          </div>
          <div className="font-retro text-base text-foreground truncate">
            {result.submitterName}
          </div>
          {clip && (
            <div className="font-retro text-sm text-muted-foreground truncate mt-0.5">
              {clip.title}
            </div>
          )}
        </div>

        <div className="text-right shrink-0">
          <div className="font-pixel text-md text-primary">{result.voteCount}</div>
          <div className="font-retro text-sm text-muted-foreground">votes</div>
        </div>
      </div>

      {playerOpen && clip && (
        <div className="border-t border-border/40">
          <ClipPlayer clip={clip} />
        </div>
      )}
    </div>
  );
}

interface PastContestRowProps {
  contest: Contest;
}

function PastContestRow({ contest }: PastContestRowProps) {
  const [expanded, setExpanded] = useState(false);

  const { data: results, isLoading } = useQuery<ContestResult[]>({
    queryKey: ["contest-results", contest.id],
    queryFn: () =>
      apiRequest("GET", `/api/contest/clip-contest/${contest.id}/results`).then((r) =>
        r.json()
      ),
    enabled: expanded,
  });

  return (
    <Card className="relative overflow-hidden border-2 border-primary/40 bg-card/95 backdrop-blur-sm shadow-lg shadow-primary/20">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />

      <button
        className="relative z-10 w-full p-4 md:p-5 flex items-center justify-between gap-4 text-left hover:bg-primary/5 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div>
          <div className="font-pixel text-md text-primary drop-shadow-[0_0_6px_rgba(168,85,247,0.4)]">
            {contest.type === "WEEKLY" ? "WEEKLY" : "MONTHLY"} CONTEST
          </div>
          <div className="font-retro text-md text-muted-foreground mt-0.5">
            {formatContestRange(contest.startDate, contest.endDate)}
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="relative z-10 px-4 md:px-5 pb-4 border-t border-border/40 pt-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 rounded-md bg-muted/30 animate-pulse" />
              ))}
            </div>
          ) : !results?.length ? (
            <p className="font-retro text-md text-muted-foreground text-center py-4">
              No results recorded for this contest.
            </p>
          ) : (
            <div className="space-y-3">
              {results.map((result) => (
                <ResultRow key={result.id} result={result} />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
    </Card>
  );
}

export default function HallOfFamePage() {
  const [, setLocation] = useLocation();
  const [page, setPage] = useState(0);

  const { data: historyPage, isLoading } = useQuery<PaginatedResponse<Contest>>({
    queryKey: ["contest-history", page],
    queryFn: () =>
      apiRequest("GET", `/api/contest/clip-contest/history?page=${page}&size=10`).then((r) =>
        r.json()
      ),
  });

  if (isLoading) return <LoadingScreen />;

  const contests = historyPage?.content ?? [];
  const totalPages = historyPage?.totalPages ?? 0;

  return (
    <main className="relative z-10 pt-24 pb-[calc(7rem+env(safe-area-inset-bottom))] md:pb-8">
        <div className="container mx-auto px-4 space-y-4 pt-4 md:pt-0">

          {/* Intro card */}
          <Card className="relative overflow-hidden border-2 border-secondary/40 bg-card/95 backdrop-blur-sm p-4 md:p-6 shadow-lg shadow-secondary/20 mt-20">
            <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 to-transparent pointer-events-none" />
            <div className="relative z-10 flex items-center gap-4">
              <div className="p-3 rounded-md bg-secondary/20 border border-secondary/40 shrink-0">
                <Trophy className="w-8 h-8 text-secondary" />
              </div>
              <div>
                <h2 className="font-pixel text-base text-secondary drop-shadow-[0_0_8px_rgba(236,72,153,0.4)]">
                  PAST CHAMPIONS
                </h2>
                <p className="font-retro text-md text-muted-foreground mt-1">
                  The best clips from every contest, voted on by the community.
                </p>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-secondary/50 to-transparent" />
          </Card>

          {/* No history */}
          {contests.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <div className="p-4 rounded-full bg-muted/30 border border-border">
                <Trophy className="w-10 h-10 text-muted-foreground/40" />
              </div>
              <p className="font-pixel text-md text-muted-foreground">NO CONTESTS YET</p>
              <p className="font-retro text-md text-muted-foreground">
                Past contest results will appear here.
              </p>
              <Button
                variant="outline"
                className="font-retro uppercase mt-2"
                onClick={() => setLocation("/contest")}
              >
                Go to Active Contest
              </Button>
            </div>
          )}

          {/* Past contests list */}
          {contests.map((c) => (
            <PastContestRow key={c.id} contest={c} />
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="font-retro"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                ← Prev
              </Button>
              <span className="font-retro text-md text-muted-foreground">
                {page + 1} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="font-retro"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next →
              </Button>
            </div>
          )}

        </div>
      </main>
  );
}
