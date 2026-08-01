import { CheckCircle, Vote } from "lucide-react";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import type { TimeStatus } from "../shared/schema";

const toggleSx = {
  '& .MuiToggleButton-root': {
    fontFamily: 'inherit',
    fontSize: '0.7rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'hsl(var(--muted-foreground))',
    borderColor: 'hsl(var(--input))',
    py: 0.9,
    px: 2,
    '&.Mui-selected': {
      color: 'hsl(var(--primary))',
      backgroundColor: 'hsl(var(--primary) / 0.12)',
      borderColor: 'hsl(var(--primary) / 0.5)',
      '&:hover': { backgroundColor: 'hsl(var(--primary) / 0.2)' },
    },
    '&:hover': { backgroundColor: 'hsl(var(--muted) / 0.15)' },
  },
};

interface CastVoteProps {
  hasPendingVote: boolean;
  voteSuccessMessage: string;
  isPending: boolean;
  voteFormError: string | null;
  voteUserName: string;
  voteDirection: TimeStatus;
  voteHours: string;
  voteMinutes: string;
  voteSeconds: string;
  onDirectionChange: (value: TimeStatus) => void;
  onHoursChange: (value: string) => void;
  onMinutesChange: (value: string) => void;
  onSecondsChange: (value: string) => void;
  onSubmit: () => void;
}

export function CastVote({
  hasPendingVote,
  voteSuccessMessage,
  isPending,
  voteFormError,
  voteUserName,
  voteDirection,
  voteHours,
  voteMinutes,
  voteSeconds,
  onDirectionChange,
  onHoursChange,
  onMinutesChange,
  onSecondsChange,
  onSubmit,
}: CastVoteProps) {
  return (
    <Card className="relative overflow-hidden border-2 border-primary/40 bg-card/95 backdrop-blur-sm p-4 md:p-6 shadow-lg shadow-primary/20">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />

      <div className="relative z-10 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-primary/20 border border-primary/40">
            <Vote className="w-6 h-6 text-primary" strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="font-pixel text-xl text-primary">
              How late will the next stream be?
            </h2>
            <p className="font-retro text-md text-muted-foreground mt-0.5">
              {hasPendingVote ? "Vote submitted!" : "Submit your vote!"}
            </p>
          </div>
        </div>

        {hasPendingVote ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-5 h-5" />
              <span className="font-retro">{voteSuccessMessage}</span>
            </div>
            <p className="font-retro text-md text-muted-foreground">
              Check back here once the pod goes live to see the results!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="font-retro text-sm uppercase tracking-wide text-muted-foreground">
                Voting As
              </Label>
              <p className="font-retro text-md text-foreground/90" data-testid="text-vote-username">
                {voteUserName}
              </p>
            </div>

            <div className="flex flex-col min-[395px]:flex-row min-[395px]:items-end gap-3">
              <div className="flex flex-col gap-2 shrink-0 order-2 min-[395px]:order-1">
                <Label className="font-retro text-sm uppercase tracking-wide text-muted-foreground">
                  Prediction Type
                </Label>
                <ToggleButtonGroup
                  value={voteDirection}
                  exclusive
                  onChange={(_, val: TimeStatus | null) => { if (val) onDirectionChange(val); }}
                  size="small"
                  data-testid="select-vote-direction"
                  sx={toggleSx}
                >
                  <ToggleButton value="LATE">Late</ToggleButton>
                  <ToggleButton value="EARLY">Early</ToggleButton>
                  <ToggleButton value="ON_TIME">On Time</ToggleButton>
                </ToggleButtonGroup>
              </div>

              <div className="flex gap-2 flex-1 min-w-0 order-1 min-[395px]:order-2">
                <div className="flex flex-col gap-2 flex-1 min-w-0">
                  <Label htmlFor="vote-hours" className="font-retro text-sm uppercase tracking-wide text-muted-foreground">
                    Hours
                  </Label>
                  <Input
                    id="vote-hours"
                    type="number"
                    min={0}
                    step={1}
                    value={voteHours}
                    onChange={(event) => onHoursChange(event.target.value)}
                    onFocus={() => { if (voteHours === "0") onHoursChange(""); }}
                    onBlur={() => { if (voteHours === "") onHoursChange("0"); }}
                    disabled={voteDirection === "ON_TIME"}
                    className="font-retro"
                    data-testid="input-vote-hours"
                  />
                </div>
                <div className="flex flex-col gap-2 flex-1 min-w-0">
                  <Label htmlFor="vote-minutes" className="font-retro text-sm uppercase tracking-wide text-muted-foreground">
                    Mins
                  </Label>
                  <Input
                    id="vote-minutes"
                    type="number"
                    min={0}
                    step={1}
                    value={voteMinutes}
                    onChange={(event) => onMinutesChange(event.target.value)}
                    onFocus={() => { if (voteMinutes === "0") onMinutesChange(""); }}
                    onBlur={() => { if (voteMinutes === "") onMinutesChange("0"); }}
                    disabled={voteDirection === "ON_TIME"}
                    className="font-retro"
                    data-testid="input-vote-minutes"
                  />
                </div>
                <div className="flex flex-col gap-2 flex-1 min-w-0">
                  <Label htmlFor="vote-seconds" className="font-retro text-sm uppercase tracking-wide text-muted-foreground">
                    Secs
                  </Label>
                  <Input
                    id="vote-seconds"
                    type="number"
                    min={0}
                    step={1}
                    value={voteSeconds}
                    onChange={(event) => onSecondsChange(event.target.value)}
                    onFocus={() => { if (voteSeconds === "0") onSecondsChange(""); }}
                    onBlur={() => { if (voteSeconds === "") onSecondsChange("0"); }}
                    disabled={voteDirection === "ON_TIME"}
                    className="font-retro"
                    data-testid="input-vote-seconds"
                  />
                </div>
              </div>
            </div>

            {voteFormError && (
              <div
                className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 font-retro text-md text-destructive"
                data-testid="text-vote-error"
              >
                {voteFormError}
              </div>
            )}

            <Button
              onClick={onSubmit}
              disabled={isPending}
              className="w-full font-retro uppercase tracking-wide"
              data-testid="button-submit-vote"
            >
              {isPending ? "Submitting..." : "Submit Vote"}
            </Button>

            <p className="font-retro text-sm text-muted-foreground text-center">
              Note: Votes cannot be changed once submitted.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
