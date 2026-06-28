import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Film } from "lucide-react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { SubmitClipModal } from "./contest/SubmitClipModal";
import type { Contest, ContestClip, VoterStatusResponse } from "../shared/contestSchema";
import type { PaginatedResponse } from "../shared/schema";
import { apiRequest } from "../lib/queryClient";
import { useVoterToken, getStoredSubmitterName } from "../hooks/useVoterToken";
import { config } from "../../game/utils/config";

const RANK_ICONS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export function TopClipsCard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const voterToken = useVoterToken();
  const [submitOpen, setSubmitOpen] = useState(false);

  const { data: contest } = useQuery<Contest | null>({
    queryKey: ["contest-active"],
    queryFn: async () => {
      const res = await fetch(`${config.API_URL}/api/contest/clip-contest/active`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
  });

  const contestId = contest?.id ?? null;

  const { data: voterStatus } = useQuery<VoterStatusResponse>({
    queryKey: ["contest-voter-status", contestId, voterToken],
    queryFn: () =>
      apiRequest("GET", `/api/contest/clip-contest/${contestId}/voter/${voterToken}`).then((r) =>
        r.json()
      ),
    enabled: !!contestId,
    refetchInterval: 60_000,
  });

  const { data: clipsPage } = useQuery<PaginatedResponse<ContestClip>>({
    queryKey: ["contest-clips-top3", contestId],
    queryFn: () =>
      apiRequest("GET", `/api/contest/clip-contest/${contestId}/clips?page=0&size=3`).then((r) =>
        r.json()
      ),
    enabled: !!contestId,
  });

  const topClips = clipsPage?.content ?? [];

  // null = no active contest; undefined = still loading — hide in both cases
  if (contest == null) return null;

  return (
    <>
      <Card className="relative overflow-hidden border-2 border-primary/40 bg-card/95 backdrop-blur-sm p-6 shadow-lg shadow-primary/20 hover-elevate transition-all duration-300">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

        <div className="relative z-10 space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-primary/20 border border-primary/40">
              <Film className="w-5 h-5 text-primary" />
            </div>
            <span className="font-retro text-2xl uppercase tracking-wide text-muted-foreground">
              Top Clips Of The Week
            </span>
          </div>

          {/* Clip rows or empty state */}
          {topClips.length === 0 ? (
            <p className="font-retro text-muted-foreground text-center py-2">
              No submissions yet — be the first!
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {topClips.map((clip, i) => (
                <button
                  key={clip.id}
                  className="flex flex-row md:flex-col gap-3 text-left rounded-md hover:bg-primary/5 active:bg-primary/10 transition-colors p-1 -m-1 cursor-pointer"
                  onClick={() => {
                    sessionStorage.setItem("contest:pinnedClipId", String(clip.id));
                    sessionStorage.setItem("contest:autoPlayClipId", String(clip.id));
                    setLocation("/contest");
                  }}
                >
                  <div className="relative shrink-0 w-24 md:w-full aspect-video rounded overflow-hidden border border-primary/20">
                    <img
                      src={`https://img.youtube.com/vi/${clip.videoId}/mqdefault.jpg`}
                      alt={clip.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex items-start gap-2 min-w-0 flex-1 md:flex-none">
                    <span className="text-2xl shrink-0 leading-none mt-0.5">{RANK_ICONS[i + 1]}</span>
                    <div className="min-w-0">
                      <p className="font-retro text-base text-foreground line-clamp-2 leading-snug">
                        {clip.title}
                      </p>
                      <p className="font-retro text-sm text-muted-foreground mt-0.5">
                        Submitted by: {clip.submitterName}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              variant="outline"
              className="font-retro uppercase tracking-wide"
              onClick={() => setLocation("/contest")}
            >
              View All Clips
            </Button>
            <Button
              className="font-retro uppercase tracking-wide"
              onClick={() => setSubmitOpen(true)}
              disabled={voterStatus != null && voterStatus.submissionsRemaining === 0}
              title={voterStatus != null && voterStatus.submissionsRemaining === 0 ? "Submission limit reached" : undefined}
            >
              + Submit Clip
            </Button>
          </div>
        </div>
      </Card>

      <SubmitClipModal
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        contest={contest}
        voterToken={voterToken}
        initialSubmitterName={getStoredSubmitterName()}
        onSuccess={(clip) => {
          queryClient.invalidateQueries({ queryKey: ["contest-clips-top3", contestId] });
          sessionStorage.setItem("contest:pinnedClipId", String(clip.id));
          setLocation("/contest");
        }}
      />
    </>
  );
}
