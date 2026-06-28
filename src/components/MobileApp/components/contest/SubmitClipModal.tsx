import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Loader2, Play, Square } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import type { Contest, ContestClip } from "../../shared/contestSchema";
import type { LivestreamRecord } from "../../shared/schema";
import { apiRequest } from "../../lib/queryClient";
import { saveSubmitterName } from "../../hooks/useVoterToken";

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseNonNegativeInt(val: string): number {
  const n = parseInt(val, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function hmsToSeconds(h: string, m: string, s: string): number {
  return parseNonNegativeInt(h) * 3600 + parseNonNegativeInt(m) * 60 + parseNonNegativeInt(s);
}

function secondsToHMS(total: number): [string, string, string] {
  const t = Math.max(0, Math.floor(total));
  return [String(Math.floor(t / 3600)), String(Math.floor((t % 3600) / 60)), String(t % 60)];
}

function formatTimestamp(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function getReadableError(error: unknown): string {
  if (error instanceof Error) {
    const parts = error.message.split(":");
    const msg = parts.slice(1).join(":").trim();
    return msg.length > 0 ? msg : error.message;
  }
  return "Unable to submit clip. Please try again.";
}

// ── Modal ──────────────────────────────────────────────────────────────────────

interface SubmitClipModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contest: Contest;
  voterToken: string;
  initialSubmitterName: string;
  onSuccess: (clip: ContestClip) => void;
}

export function SubmitClipModal({
  open,
  onOpenChange,
  contest,
  voterToken,
  initialSubmitterName,
  onSuccess,
}: SubmitClipModalProps) {
  const [selectedVideoId, setSelectedVideoId] = useState("");
  const [startH, setStartH] = useState("0");
  const [startM, setStartM] = useState("0");
  const [startS, setStartS] = useState("0");
  const [endH, setEndH] = useState("0");
  const [endM, setEndM] = useState("0");
  const [endS, setEndS] = useState("0");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitterName, setSubmitterName] = useState(initialSubmitterName);
  const [formError, setFormError] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [captureState, setCaptureState] = useState<"idle" | "capturing">("idle");
  const [liveEndSeconds, setLiveEndSeconds] = useState(0);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentVideoTimeRef = useRef<number>(0);
  const captureStartTimeRef = useRef<number>(0);

  // ── Derived ────────────────────────────────────────────────────────────────
  const startSeconds = hmsToSeconds(startH, startM, startS);
  const endSeconds = hmsToSeconds(endH, endM, endS);
  const clipDuration = endSeconds - startSeconds;
  const startExceedsVideo = videoDuration > 0 && startSeconds > videoDuration;
  const endExceedsVideo = videoDuration > 0 && endSeconds > videoDuration;
  const isTimestampValid =
    endSeconds > startSeconds &&
    clipDuration >= 5 &&
    clipDuration <= contest.maxClipDurationSeconds &&
    !startExceedsVideo &&
    !endExceedsVideo;

  const hasAnyTimestamp = captureState === "capturing" || startSeconds > 0 || endSeconds > 0;

  // ── Data ───────────────────────────────────────────────────────────────────
  const { data: eligibleStreams, isLoading: streamsLoading } = useQuery<LivestreamRecord[]>({
    queryKey: ["eligible-streams", contest.id],
    queryFn: () =>
      apiRequest("GET", `/api/contest/clip-contest/${contest.id}/eligible-streams`).then((r) =>
        r.json()
      ),
    enabled: open,
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/contest/clip-contest/${contest.id}/clips`, {
        videoId: selectedVideoId,
        title: title.trim(),
        description: description.trim() || null,
        startSeconds,
        endSeconds,
        submitterToken: voterToken,
        submitterName: submitterName.trim(),
      }).then((r) => r.json() as Promise<ContestClip>),
    onSuccess: (clip) => {
      saveSubmitterName(submitterName.trim());
      onSuccess(clip);
      handleClose();
    },
    onError: (err) => setFormError(getReadableError(err)),
  });

  // ── YouTube message listener ───────────────────────────────────────────────
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (!e.origin.includes("youtube.com")) return;
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (data?.info?.duration && data.info.duration > 0) {
          setVideoDuration(Math.floor(data.info.duration));
        }
        if (data?.info?.currentTime !== undefined) {
          currentVideoTimeRef.current = data.info.currentTime;
        }
        // If video ends naturally while previewing, clean up
        const ps = data?.info?.playerState;
        if ((ps === 2 || ps === 0) && previewTimerRef.current) {
          clearTimeout(previewTimerRef.current);
          previewTimerRef.current = null;
          setIsPreviewing(false);
        }
      } catch {}
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Reset when stream changes
  useEffect(() => {
    setVideoDuration(0);
    setStartH("0"); setStartM("0"); setStartS("0");
    setEndH("0"); setEndM("0"); setEndS("0");
    currentVideoTimeRef.current = 0;
    captureStartTimeRef.current = 0;
    if (captureTimerRef.current) { clearTimeout(captureTimerRef.current); captureTimerRef.current = null; }
    if (previewTimerRef.current) { clearTimeout(previewTimerRef.current); previewTimerRef.current = null; }
    if (liveIntervalRef.current) { clearInterval(liveIntervalRef.current); liveIntervalRef.current = null; }
    setCaptureState("idle");
    setLiveEndSeconds(0);
    setIsPreviewing(false);
  }, [selectedVideoId]);

  // ── YouTube postMessage helpers ────────────────────────────────────────────
  function postToPlayer(func: string, args: unknown[] = []) {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args }),
      "https://www.youtube.com"
    );
  }

  function onIframeLoad() {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "listening" }),
      "https://www.youtube.com"
    );
  }

  // ── Capture flow ───────────────────────────────────────────────────────────
  function stopLiveInterval() {
    if (liveIntervalRef.current) { clearInterval(liveIntervalRef.current); liveIntervalRef.current = null; }
  }

  function handleCaptureButton() {
    if (captureState === "idle") {
      const t = Math.floor(currentVideoTimeRef.current);
      captureStartTimeRef.current = t;
      const [h, m, s] = secondsToHMS(t);
      setStartH(h); setStartM(m); setStartS(s);
      setEndH("0"); setEndM("0"); setEndS("0");
      setLiveEndSeconds(t);
      postToPlayer("playVideo");
      setCaptureState("capturing");
      if (previewTimerRef.current) { clearTimeout(previewTimerRef.current); previewTimerRef.current = null; }
      setIsPreviewing(false);
      // Tick the live end display every 250 ms from currentVideoTimeRef
      stopLiveInterval();
      liveIntervalRef.current = setInterval(() => {
        setLiveEndSeconds(Math.floor(currentVideoTimeRef.current));
      }, 250);
      // Auto-stop after max clip duration
      captureTimerRef.current = setTimeout(() => {
        stopLiveInterval();
        const endT = captureStartTimeRef.current + contest.maxClipDurationSeconds;
        const [eh, em, es] = secondsToHMS(endT);
        setEndH(eh); setEndM(em); setEndS(es);
        setLiveEndSeconds(endT);
        postToPlayer("pauseVideo");
        setCaptureState("idle");
        captureTimerRef.current = null;
      }, contest.maxClipDurationSeconds * 1000);
    } else {
      finishCapture();
    }
  }

  function finishCapture() {
    if (captureTimerRef.current) { clearTimeout(captureTimerRef.current); captureTimerRef.current = null; }
    stopLiveInterval();
    const t = Math.floor(currentVideoTimeRef.current);
    const [h, m, s] = secondsToHMS(t);
    setEndH(h); setEndM(m); setEndS(s);
    setLiveEndSeconds(t);
    postToPlayer("pauseVideo");
    setCaptureState("idle");
  }

  // ── Play Clip preview ──────────────────────────────────────────────────────
  function handlePreviewClip() {
    if (previewTimerRef.current) { clearTimeout(previewTimerRef.current); previewTimerRef.current = null; }
    postToPlayer("seekTo", [startSeconds, true]);
    setTimeout(() => postToPlayer("playVideo"), 300);
    setIsPreviewing(true);
    previewTimerRef.current = setTimeout(() => {
      postToPlayer("pauseVideo");
      setIsPreviewing(false);
    }, clipDuration * 1000 + 400);
  }

  function handleStopPreview() {
    if (previewTimerRef.current) { clearTimeout(previewTimerRef.current); previewTimerRef.current = null; }
    postToPlayer("pauseVideo");
    setIsPreviewing(false);
  }

  // ── Manual text field blur → seek ─────────────────────────────────────────
  function seekStart(h: string, m: string, s: string) {
    if (!selectedVideoId) return;
    postToPlayer("seekTo", [hmsToSeconds(h, m, s), true]);
  }

  function seekEnd(h: string, m: string, s: string) {
    if (!selectedVideoId) return;
    postToPlayer("seekTo", [hmsToSeconds(h, m, s), true]);
  }

  // ── Dialog lifecycle ───────────────────────────────────────────────────────
  function handleClose() {
    onOpenChange(false);
    setSelectedVideoId("");
    setStartH("0"); setStartM("0"); setStartS("0");
    setEndH("0"); setEndM("0"); setEndS("0");
    setTitle("");
    setDescription("");
    setFormError(null);
    setVideoDuration(0);
    setManualEntryOpen(false);
    setPickerOpen(false);
    currentVideoTimeRef.current = 0;
    captureStartTimeRef.current = 0;
    if (captureTimerRef.current) { clearTimeout(captureTimerRef.current); captureTimerRef.current = null; }
    if (previewTimerRef.current) { clearTimeout(previewTimerRef.current); previewTimerRef.current = null; }
    if (liveIntervalRef.current) { clearInterval(liveIntervalRef.current); liveIntervalRef.current = null; }
    setCaptureState("idle");
    setLiveEndSeconds(0);
    setIsPreviewing(false);
    submitMutation.reset();
  }

  function handleSubmit() {
    setFormError(null);
    if (!selectedVideoId) { setFormError("Please select a stream to clip."); return; }
    if (!submitterName.trim()) { setFormError("Please enter your display name."); return; }
    if (!title.trim()) { setFormError("Please enter a title for your clip."); return; }
    if (!isTimestampValid) { setFormError("Please set a valid clip range."); return; }
    submitMutation.mutate();
  }

  // ── Styles ─────────────────────────────────────────────────────────────────
  const hmsBase =
    "flex-1 min-w-0 h-10 rounded-md border px-2 py-2 text-md font-retro text-center bg-background focus-visible:outline-none focus-visible:ring-2";
  const hmsOk = `${hmsBase} border-input focus-visible:ring-ring`;
  const hmsErr = `${hmsBase} border-destructive text-destructive focus-visible:ring-destructive`;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-full max-w-[90vw] sm:max-w-xl lg:max-w-[min(50vw,860px)] h-[88vh] flex flex-col gap-0 p-0 overflow-hidden">

        {/* Fixed header */}
        <div className="px-6 pt-6 pb-4 border-b border-border/40 shrink-0">
          <DialogHeader>
            <DialogTitle className="font-pixel text-primary text-md">SUBMIT A CLIP</DialogTitle>
            <DialogDescription className="font-retro text-md text-muted-foreground">
              Select a moment from this week's streams. Max {contest.maxClipDurationSeconds}s per clip, up to {contest.maxSubmissionsPerUser} submissions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5 mt-4">
            <Label className="font-retro text-md uppercase text-muted-foreground">Stream</Label>
            {streamsLoading ? (
              <div className="flex items-center gap-2 h-16 px-3 border border-input rounded-md">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                <span className="font-retro text-md text-muted-foreground">Loading streams...</span>
              </div>
            ) : !eligibleStreams?.length ? (
              <p className="font-retro text-md text-muted-foreground px-3 py-2 border border-input rounded-md">
                No streams available for this contest period.
              </p>
            ) : (() => {
              const sel = eligibleStreams.find((s) => s.videoId === selectedVideoId);
              return (
                <button
                  type="button"
                  onClick={() => setPickerOpen((v) => !v)}
                  className="w-full flex items-center gap-3 h-16 rounded-md border border-input bg-background px-3 hover:bg-muted/20 transition-colors"
                >
                  {sel ? (
                    <>
                      <img
                        src={`https://img.youtube.com/vi/${sel.videoId}/mqdefault.jpg`}
                        alt=""
                        className="h-10 w-[72px] rounded object-cover shrink-0"
                      />
                      <div className="flex-1 text-left min-w-0">
                        <p className="font-retro text-md text-foreground truncate">{sel.title}</p>
                        {sel.actualStart && (
                          <p className="font-retro text-xs text-muted-foreground">
                            {new Date(sel.actualStart).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </>
                  ) : (
                    <span className="flex-1 text-left font-retro text-md text-muted-foreground">Select a stream...</span>
                  )}
                  <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 ${pickerOpen ? "rotate-180" : ""}`} />
                </button>
              );
            })()}
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto min-h-0 px-6 py-5">
          {pickerOpen ? (
            <div className="space-y-1">
              {(eligibleStreams ?? []).map((stream) => (
                <button
                  key={stream.videoId}
                  type="button"
                  onClick={() => { setSelectedVideoId(stream.videoId); setPickerOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2 h-[68px] rounded-md text-left transition-colors ${
                    stream.videoId === selectedVideoId ? "bg-primary/10" : "hover:bg-muted/30"
                  }`}
                >
                  <img
                    src={`https://img.youtube.com/vi/${stream.videoId}/mqdefault.jpg`}
                    alt=""
                    className="h-11 w-[78px] rounded object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-retro text-md text-foreground line-clamp-2 leading-snug">{stream.title}</p>
                    {stream.actualStart && (
                      <p className="font-retro text-xs text-muted-foreground mt-0.5">
                        {new Date(stream.actualStart).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  {stream.videoId === selectedVideoId && (
                    <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  )}
                </button>
              ))}
            </div>
          ) : !selectedVideoId ? (
            <div className="flex h-full items-center justify-center">
              <p className="font-retro text-lg text-muted-foreground/50 text-center">
                Select a recent stream to get started
              </p>
            </div>
          ) : (
            <div className="space-y-4">

              {/* 16:9 embed — controls re-enabled */}
              <div
                className="relative w-full rounded-md overflow-hidden border border-border/50"
                style={{ paddingBottom: "56.25%" }}
              >
                <iframe
                  ref={iframeRef}
                  className="absolute inset-0 w-full h-full"
                  src={`https://www.youtube.com/embed/${selectedVideoId}?enablejsapi=1&autoplay=0&iv_load_policy=3&rel=0`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  onLoad={onIframeLoad}
                  title="Stream preview"
                />
              </div>

              {/* Capture button */}
              <Button
                className={`w-full font-retro uppercase tracking-wide ${
                  captureState === "capturing"
                    ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground border-destructive"
                    : ""
                }`}
                variant={captureState === "capturing" ? "default" : "outline"}
                onClick={handleCaptureButton}
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full mr-2.5 shrink-0 bg-destructive ${
                    captureState === "capturing" ? "animate-pulse bg-white" : ""
                  }`}
                />
                {captureState === "capturing" ? "End Clip Capture" : "Start Clip Capture"}
              </Button>

              {/* Captured timestamp display */}
              {hasAnyTimestamp && (
                <div className="flex items-center justify-between px-1">
                  <span className="font-retro text-md text-muted-foreground">
                    Start: <span className="text-primary tabular-nums">{formatTimestamp(startSeconds)}</span>
                  </span>
                  {captureState === "capturing" && (
                    <span className="font-retro text-md text-destructive animate-pulse tabular-nums">
                      {formatTimestamp(Math.max(0, liveEndSeconds - startSeconds))}
                    </span>
                  )}
                  <span className="font-retro text-md text-muted-foreground">
                    End:{" "}
                    <span className={`tabular-nums ${captureState === "capturing" ? "text-destructive animate-pulse" : "text-primary"}`}>
                      {captureState === "capturing"
                        ? formatTimestamp(liveEndSeconds)
                        : endSeconds > 0
                        ? formatTimestamp(endSeconds)
                        : "—"}
                    </span>
                  </span>
                </div>
              )}

              {/* Validation / clip length hint */}
              {hasAnyTimestamp && endSeconds > 0 && (
                <p className={`font-retro text-md text-center ${isTimestampValid ? "text-muted-foreground" : "text-destructive"}`}>
                  {endSeconds <= startSeconds
                    ? "End time must be after start time"
                    : clipDuration > contest.maxClipDurationSeconds
                    ? `Clip too long — max ${contest.maxClipDurationSeconds}s`
                    : clipDuration < 5
                    ? "Clip must be at least 5 seconds"
                    : `Clip length: ${formatTimestamp(clipDuration)}`}
                </p>
              )}

              {/* Play Clip / Stop Preview */}
              {isTimestampValid && (
                <Button
                  variant="outline"
                  className="w-full font-retro uppercase"
                  onClick={isPreviewing ? handleStopPreview : handlePreviewClip}
                >
                  {isPreviewing ? (
                    <><Square className="w-4 h-4 mr-2" />Stop Preview</>
                  ) : (
                    <><Play className="w-4 h-4 mr-2" />Play Clip</>
                  )}
                </Button>
              )}

              {/* Manual entry accordion */}
              <div className="border border-border/50 rounded-md overflow-hidden">
                <button
                  type="button"
                  onClick={() => setManualEntryOpen((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 font-retro text-md text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                >
                  <span>Enter timestamps manually</span>
                  {manualEntryOpen
                    ? <ChevronUp className="w-4 h-4 shrink-0" />
                    : <ChevronDown className="w-4 h-4 shrink-0" />}
                </button>

                {manualEntryOpen && (
                  <div className="px-4 pb-4 pt-2 space-y-4 border-t border-border/50">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Start time */}
                      <div className="space-y-1.5">
                        <Label className="font-retro text-md uppercase text-muted-foreground">Start Time</Label>
                        <div className="flex items-center gap-1">
                          <input type="number" min="0" value={startH}
                            onChange={(e) => setStartH(e.target.value)}
                            onFocus={() => { if (startH === "0") setStartH(""); }}
                            onBlur={(e) => {
                              const h = e.target.value === "" ? (setStartH("0"), "0") : e.target.value;
                              seekStart(h, startM, startS);
                            }}
                            className={startExceedsVideo ? hmsErr : hmsOk} placeholder="0" />
                          <span className="font-retro text-md text-muted-foreground">h</span>
                          <input type="number" min="0" max="59" value={startM}
                            onChange={(e) => setStartM(e.target.value)}
                            onFocus={() => { if (startM === "0") setStartM(""); }}
                            onBlur={(e) => {
                              const m = e.target.value === "" ? (setStartM("0"), "0") : e.target.value;
                              seekStart(startH, m, startS);
                            }}
                            className={startExceedsVideo ? hmsErr : hmsOk} placeholder="0" />
                          <span className="font-retro text-md text-muted-foreground">m</span>
                          <input type="number" min="0" max="59" value={startS}
                            onChange={(e) => setStartS(e.target.value)}
                            onFocus={() => { if (startS === "0") setStartS(""); }}
                            onBlur={(e) => {
                              const s = e.target.value === "" ? (setStartS("0"), "0") : e.target.value;
                              seekStart(startH, startM, s);
                            }}
                            className={startExceedsVideo ? hmsErr : hmsOk} placeholder="0" />
                          <span className="font-retro text-md text-muted-foreground">s</span>
                        </div>
                        {startExceedsVideo && (
                          <p className="font-retro text-md text-destructive">
                            Exceeds stream length ({formatTimestamp(videoDuration)})
                          </p>
                        )}
                      </div>

                      {/* End time */}
                      <div className="space-y-1.5">
                        <Label className="font-retro text-md uppercase text-muted-foreground">End Time</Label>
                        <div className="flex items-center gap-1">
                          <input type="number" min="0" value={endH}
                            onChange={(e) => setEndH(e.target.value)}
                            onFocus={() => { if (endH === "0") setEndH(""); }}
                            onBlur={(e) => {
                              const h = e.target.value === "" ? (setEndH("0"), "0") : e.target.value;
                              seekEnd(h, endM, endS);
                            }}
                            className={endExceedsVideo ? hmsErr : hmsOk} placeholder="0" />
                          <span className="font-retro text-md text-muted-foreground">h</span>
                          <input type="number" min="0" max="59" value={endM}
                            onChange={(e) => setEndM(e.target.value)}
                            onFocus={() => { if (endM === "0") setEndM(""); }}
                            onBlur={(e) => {
                              const m = e.target.value === "" ? (setEndM("0"), "0") : e.target.value;
                              seekEnd(endH, m, endS);
                            }}
                            className={endExceedsVideo ? hmsErr : hmsOk} placeholder="0" />
                          <span className="font-retro text-md text-muted-foreground">m</span>
                          <input type="number" min="0" max="59" value={endS}
                            onChange={(e) => setEndS(e.target.value)}
                            onFocus={() => { if (endS === "0") setEndS(""); }}
                            onBlur={(e) => {
                              const s = e.target.value === "" ? (setEndS("0"), "0") : e.target.value;
                              seekEnd(endH, endM, s);
                            }}
                            className={endExceedsVideo ? hmsErr : hmsOk} placeholder="0" />
                          <span className="font-retro text-md text-muted-foreground">s</span>
                        </div>
                        {endExceedsVideo && (
                          <p className="font-retro text-md text-destructive">
                            Exceeds stream length ({formatTimestamp(videoDuration)})
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <Label className="font-retro text-md uppercase text-muted-foreground">
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                  className="font-retro"
                />
                <p className="font-retro text-md text-muted-foreground text-right">{title.length}/120</p>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label className="font-retro text-md uppercase text-muted-foreground">
                  Description <span className="text-muted-foreground/50">(optional)</span>
                </Label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="context...?"
                  rows={2}
                  maxLength={280}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-md font-retro placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                />
              </div>

              {/* Display name */}
              <div className="space-y-1.5">
                <Label className="font-retro text-md uppercase text-muted-foreground">
                  Your Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={submitterName}
                  onChange={(e) => setSubmitterName(e.target.value)}
                  placeholder="What should we call you?"
                  maxLength={40}
                  className="font-retro"
                />
                <p className="font-retro text-md text-muted-foreground">
                  Displayed on leaderboard and winners list.
                </p>
              </div>

              {/* Error */}
              {formError && (
                <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 font-retro text-md text-destructive">
                  {formError}
                </p>
              )}

            </div>
          )}
        </div>

        {/* Pinned action buttons */}
        <div className="px-6 py-4 border-t border-border/40 shrink-0 flex gap-3">
          <Button
            variant="outline"
            className="font-retro uppercase flex-1"
            onClick={handleClose}
            disabled={submitMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            className="font-retro uppercase flex-1"
            onClick={handleSubmit}
            disabled={submitMutation.isPending || !selectedVideoId || !isTimestampValid}
          >
            {submitMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</>
            ) : (
              "Submit Clip"
            )}
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  );
}
