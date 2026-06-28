import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ChevronDown, ChevronUp, Film, Search, Trophy, X, Zap } from "lucide-react";
import { LoadingScreen } from "../components/LoadingScreen";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { ContestClipCard } from "../components/contest/ContestClipCard";
import { SubmitClipModal } from "../components/contest/SubmitClipModal";
import { VoteRefreshCountdown } from "../components/contest/VoteRefreshCountdown";
import type { Contest, ContestClip, VoterStatusResponse } from "../shared/contestSchema";
import type { PaginatedResponse } from "../shared/schema";
import { apiRequest } from "../lib/queryClient";
import { useVoterToken, getStoredSubmitterName } from "../hooks/useVoterToken";
import { config } from "../../game/utils/config";
import { resumeAfterVideo } from "../lib/dashboardAudio";


const PAGE_SIZE = 4;

type SortField = "votes" | "submittedAt" | "duration";

const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: "votes",       label: "Votes"   },
  { field: "submittedAt", label: "Date"   },
  { field: "duration",    label: "Length" },
];

function filterAndSort(
  clips: ContestClip[],
  query: string,
  field: SortField,
  dir: "asc" | "desc"
): ContestClip[] {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? clips.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          (c.description?.toLowerCase().includes(q) ?? false)
      )
    : [...clips];

  filtered.sort((a, b) => {
    let diff = 0;
    if (field === "votes") diff = a.voteCount - b.voteCount;
    else if (field === "submittedAt")
      diff = new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
    else if (field === "duration")
      diff = (a.endSeconds - a.startSeconds) - (b.endSeconds - b.startSeconds);
    return dir === "desc" ? -diff : diff;
  });

  return filtered;
}

function formatContestDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getReadableError(error: unknown): string {
  if (error instanceof Error) {
    const parts = error.message.split(":");
    const msg = parts.slice(1).join(":").trim();
    return msg.length > 0 ? msg : error.message;
  }
  return "Something went wrong.";
}

export default function ContestPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const voterToken = useVoterToken();

  const [page, setPage] = useState(0);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [pendingClipId, setPendingClipId] = useState<number | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [pinnedClip, setPinnedClip] = useState<ContestClip | null>(null);
  const [autoPlayClipId, setAutoPlayClipId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("votes");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  useEffect(() => {
    return () => resumeAfterVideo();
  }, []);

  // Fetch active contest — 404 → null (no contest)
  const { data: contest, isLoading: contestLoading } = useQuery<Contest | null>({
    queryKey: ["contest-active"],
    queryFn: async () => {
      const res = await fetch(`${config.API_URL}/api/contest/clip-contest/active`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`${res.status}: Failed to load contest`);
      return res.json() as Promise<Contest>;
    },
  });

  const contestId = contest?.id ?? null;

  // Read pinned/autoplay clip from sessionStorage (set when navigating here from dashboard)
  useEffect(() => {
    if (!contestId) return;
    const storedId = sessionStorage.getItem("contest:pinnedClipId");
    const autoPlayId = sessionStorage.getItem("contest:autoPlayClipId");
    if (autoPlayId) {
      sessionStorage.removeItem("contest:autoPlayClipId");
      setAutoPlayClipId(Number(autoPlayId));
    }
    if (!storedId) return;
    sessionStorage.removeItem("contest:pinnedClipId");
    apiRequest("GET", `/api/contest/clip-contest/clips/${storedId}`)
      .then((r) => r.json())
      .then((clip: ContestClip) => setPinnedClip(clip))
      .catch(() => {});
  }, [contestId]);

  // Fetch clips for this page
  const { data: clipsPage, isLoading: clipsLoading } = useQuery<PaginatedResponse<ContestClip>>({
    queryKey: ["contest-clips", contestId, page],
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/contest/clip-contest/${contestId}/clips?page=${page}&size=${PAGE_SIZE}`
      ).then((r) => r.json()),
    enabled: !!contestId,
  });

  const isFiltered = searchQuery.trim() !== "" || sortField !== "votes" || sortDir !== "desc";

  // All clips — only fetched when search or non-default sort is active
  const { data: allClipsPage, isLoading: allClipsLoading } = useQuery<PaginatedResponse<ContestClip>>({
    queryKey: ["contest-clips-all", contestId],
    queryFn: () =>
      apiRequest("GET", `/api/contest/clip-contest/${contestId}/clips?page=0&size=500`).then((r) =>
        r.json()
      ),
    enabled: !!contestId && isFiltered,
  });

  // Fetch voter status (budget + which clips voted on)
  const { data: voterStatus } = useQuery<VoterStatusResponse>({
    queryKey: ["contest-voter-status", contestId, voterToken],
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/contest/clip-contest/${contestId}/voter/${voterToken}`
      ).then((r) => r.json()),
    enabled: !!contestId,
    refetchInterval: 60_000,
  });

  function invalidateContestData() {
    queryClient.invalidateQueries({ queryKey: ["contest-clips", contestId] });
    queryClient.invalidateQueries({ queryKey: ["contest-voter-status", contestId, voterToken] });
  }

  const voteMutation = useMutation({
    mutationFn: (clipId: number) =>
      apiRequest("POST", `/api/contest/clip-contest/clips/${clipId}/vote`, {
        voterToken,
      }),
    onMutate: (clipId) => {
      setPendingClipId(clipId);
      setVoteError(null);
    },
    onSuccess: () => {
      invalidateContestData();
    },
    onError: (err) => {
      setVoteError(getReadableError(err));
    },
    onSettled: () => setPendingClipId(null),
  });

  const unvoteMutation = useMutation({
    mutationFn: (clipId: number) =>
      apiRequest(
        "DELETE",
        `/api/contest/clip-contest/clips/${clipId}/vote?voterToken=${encodeURIComponent(voterToken)}`
      ),
    onMutate: (clipId) => {
      setPendingClipId(clipId);
      setVoteError(null);
    },
    onSuccess: () => {
      invalidateContestData();
    },
    onError: (err) => {
      setVoteError(getReadableError(err));
    },
    onSettled: () => setPendingClipId(null),
  });

  if (contestLoading) return <LoadingScreen />;

  const rawClips = clipsPage?.content ?? [];
  const pinnedClips = pinnedClip && !isFiltered
    ? [pinnedClip, ...rawClips.filter((c) => c.id !== pinnedClip.id)]
    : rawClips;
  const displayClips = isFiltered
    ? filterAndSort(allClipsPage?.content ?? [], searchQuery, sortField, sortDir)
    : pinnedClips;
  const isClipsLoading = isFiltered ? allClipsLoading : clipsLoading;
  const totalPages = isFiltered ? 0 : (clipsPage?.totalPages ?? 0);
  const totalClips = isFiltered ? displayClips.length : (clipsPage?.totalElements ?? 0);
  const votesRemaining = voterStatus?.votesRemainingToday ?? 0;
  const votedClipIds = new Set(voterStatus?.votedClipIds ?? []);
  const isVoting = voteMutation.isPending || unvoteMutation.isPending;

  return (
    <>
      <main className="relative z-10 pt-24 pb-[calc(7rem+env(safe-area-inset-bottom))] md:pb-8">
        <div className="container mx-auto px-4 space-y-6 pt-4 md:pt-0">

          {/* No active contest */}
          {contest == null && (
            <div className="flex flex-col items-center justify-center py-24 text-center space-y-5 mt-20">
              <div className="p-4 rounded-full bg-muted/30 border border-border">
                <Trophy className="w-12 h-12 text-muted-foreground/50" />
              </div>
              <div>
                <h2 className="font-pixel text-xl text-muted-foreground">NO ACTIVE CONTEST</h2>
                <p className="font-retro text-muted-foreground mt-2">
                  Check back soon for the next weekly clip contest!
                </p>
              </div>
              <Button
                variant="outline"
                className="font-retro uppercase tracking-wide"
                onClick={() => setLocation("/contest/hall-of-fame")}
              >
                <Trophy className="w-4 h-4 mr-2" />
                View Hall of Fame
              </Button>
            </div>
          )}

          {/* Active contest */}
          {contest != null && (
            <>
              {/* Contest banner */}
              <Card className="relative overflow-hidden border-2 border-primary/40 bg-card/95 backdrop-blur-sm p-4 md:p-6 shadow-lg shadow-primary/20 mt-20">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="p-1.5 rounded-md bg-primary/20 border border-primary/40">
                          <Zap className="w-4 h-4 text-primary" />
                        </div>
                        <span className="font-retro text-lg uppercase tracking-wide text-muted-foreground">
                          {contest.type === "WEEKLY" ? "Weekly" : "Monthly"} Contest
                        </span>
                      </div>
                      <p className="font-retro text-md text-muted-foreground">
                        {formatContestDate(contest.startDate)} — {formatContestDate(contest.endDate)}
                      </p>
                    </div>
                    <VoteRefreshCountdown
                      targetDate={contest.endDate}
                      label="ENDS IN"
                    />
                  </div>

                  <div className="flex flex-wrap gap-3 mt-4">
                    <Button
                      className="font-retro uppercase tracking-wide"
                      onClick={() => setSubmitOpen(true)}
                    >
                      + Submit a Clip
                    </Button>
                    <Button
                      variant="outline"
                      className="font-retro uppercase tracking-wide"
                      onClick={() => setLocation("/contest/hall-of-fame")}
                    >
                      <Trophy className="w-4 h-4 mr-2" />
                      Hall of Fame
                    </Button>
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
              </Card>

              {/* Voter status */}
              {voterStatus && (
                <Card className="relative overflow-hidden border-2 border-accent/40 bg-card/95 backdrop-blur-sm p-4 shadow-lg shadow-accent/20">
                  <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent pointer-events-none" />
                  <div className="relative z-10 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-md bg-accent/20 border border-accent/40">
                        <Zap className="w-4 h-4 text-accent" />
                      </div>
                      <div>
                        <div className="font-pixel text-md text-accent">
                          {votesRemaining}{" "}
                          {votesRemaining === 1 ? "VOTE" : "VOTES"} REMAINING
                        </div>
                        <div className="font-retro text-xs text-muted-foreground uppercase">
                          {contest.voteRefreshSchedule === "DAILY"
                            ? "Resets at midnight UTC"
                            : `Resets on ${contest.voteRefreshSchedule}`}
                        </div>
                      </div>
                    </div>
                    {votesRemaining === 0 && voterStatus.nextPeriodStart && (
                      <VoteRefreshCountdown
                        targetDate={voterStatus.nextPeriodStart}
                        label="NEXT VOTES IN"
                        colorClass="text-accent"
                      />
                    )}
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-accent/50 to-transparent" />
                </Card>
              )}

              {/* Vote error */}
              {voteError && (
                <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 font-retro text-md text-destructive">
                  {voteError}
                </p>
              )}

              {/* Search & sort controls */}
              <div className="space-y-2.5">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="search"
                    placeholder="Search by title or description..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
                    className="w-full pl-9 pr-9 h-10 rounded-md border border-input bg-background font-retro text-md placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Clear search"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-retro text-md text-muted-foreground shrink-0">Sort:</span>
                  {SORT_OPTIONS.map(({ field, label }) => {
                    const active = sortField === field;
                    return (
                      <Button
                        key={field}
                        variant={active ? "default" : "outline"}
                        size="sm"
                        className="font-retro text-xs h-8 px-3 gap-1"
                        onClick={() => {
                          if (active) {
                            setSortDir((d) => (d === "desc" ? "asc" : "desc"));
                          } else {
                            setSortField(field);
                            setSortDir("desc");
                            setPage(0);
                          }
                        }}
                      >
                        {label}
                        {active && (sortDir === "desc"
                          ? <ChevronDown className="w-3 h-3 shrink-0" />
                          : <ChevronUp className="w-3 h-3 shrink-0" />
                        )}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Clips leaderboard */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-pixel text-lg text-primary drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]">
                    TOP CLIPS
                  </h2>
                  {totalClips > 0 && (
                    <span className="font-retro text-md text-muted-foreground">
                      {totalClips} submission{totalClips !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                {isClipsLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                      <div
                        key={i}
                        className="rounded-lg border-2 border-primary/20 bg-card/50 aspect-[4/3] animate-pulse"
                      />
                    ))}
                  </div>
                ) : displayClips.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                    <div className="p-4 rounded-full bg-muted/30 border border-border">
                      <Film className="w-10 h-10 text-muted-foreground/40" />
                    </div>
                    {searchQuery ? (
                      <>
                        <p className="font-pixel text-md text-muted-foreground">NO RESULTS</p>
                        <p className="font-retro text-md text-muted-foreground">
                          No clips match "{searchQuery}"
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-pixel text-md text-muted-foreground">NO CLIPS YET</p>
                        <p className="font-retro text-md text-muted-foreground">
                          Be the first to submit a clip!
                        </p>
                        <Button
                          className="font-retro uppercase mt-2"
                          onClick={() => setSubmitOpen(true)}
                        >
                          + Submit a Clip
                        </Button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {displayClips.map((clip: ContestClip, i: number) => (
                      <ContestClipCard
                        key={clip.id}
                        clip={clip}
                        rank={isFiltered ? i + 1 : i + 1 + page * PAGE_SIZE}
                        voterToken={voterToken}
                        hasVoted={votedClipIds.has(clip.id)}
                        votesRemaining={votesRemaining}
                        isVoting={isVoting && pendingClipId === clip.id}
                        contestActive={contest.status === "ACTIVE"}
                        isMyClip={clip.submitterToken === voterToken}
                        autoPlay={clip.id === autoPlayClipId}
                        onVote={(id) => voteMutation.mutate(id)}
                        onUnvote={(id) => unvoteMutation.mutate(id)}
                      />
                    ))}
                  </div>
                )}

                {/* Pagination — hidden when search/sort is active */}
                {!isFiltered && totalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 mt-6">
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
            </>
          )}

          {/* Footer */}
          <footer className="text-center font-retro text-base text-muted-foreground py-4">
            <p>Submit your favorite moments from this week's streams</p>
          </footer>
        </div>
      </main>

      {/* Submit modal */}
      {contest != null && (
        <SubmitClipModal
          open={submitOpen}
          onOpenChange={setSubmitOpen}
          contest={contest}
          voterToken={voterToken}
          initialSubmitterName={getStoredSubmitterName()}
          onSuccess={(clip) => {
            setPinnedClip(clip);
            queryClient.invalidateQueries({ queryKey: ["contest-clips", contestId] });
            setPage(0);
          }}
        />
      )}
    </>
  );
}
