import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { MusicToggle } from "./MusicToggle";
import { Button } from "./ui/button";
import { init as initAudio, toggleMute, isMuted } from "../lib/dashboardAudio";
import Logo from "../../game/images/l3l3.png";

interface RouteConfig {
  title: string;
  subtitle?: string;
  backTo?: string;
}

const ROUTE_CONFIG: Record<string, RouteConfig> = {
  "/dashboard":            { title: "H3 POD", subtitle: "LATE TRACKER" },
  "/vote":                 { title: "VOTE", backTo: "/dashboard" },
  "/data":                 { title: "LIVESTREAMS", backTo: "/dashboard" },
  "/contest":              { title: "TOP CLIPS", backTo: "/dashboard" },
  "/contest/hall-of-fame": { title: "HALL OF FAME", backTo: "/contest" },
};

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location, navigate] = useLocation();
  const [musicMuted, setMusicMuted] = useState(true);
  const gridRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const lastScrollTopRef = useRef(0);

  const config = ROUTE_CONFIG[location] ?? { title: "" };
  const isDashboard = location === "/dashboard";

  useEffect(() => {
    const cameFromGame = sessionStorage.getItem("dashboard:music-active") === "true";
    const seek = parseFloat(sessionStorage.getItem("dashboard:music-seek") ?? "0") || 0;
    if (cameFromGame) {
      sessionStorage.removeItem("dashboard:music-active");
      sessionStorage.removeItem("dashboard:music-seek");
    }
    initAudio(!cameFromGame, seek);
    setMusicMuted(isMuted());
  }, []);

  // Reset scroll to top and show header on every navigation
  useEffect(() => {
    const root = document.getElementById("root");
    if (root) root.scrollTop = 0;
    lastScrollTopRef.current = 0;
    if (headerRef.current) headerRef.current.style.transform = "translateY(0)";
  }, [location]);

  useEffect(() => {
    const root = document.getElementById("root");
    if (!root) return;
    const handleScroll = () => {
      const scrollTop = root.scrollTop;

      // Parallax grid
      if (gridRef.current) {
        gridRef.current.style.backgroundPosition = `0px ${scrollTop * 0.15}px`;
      }

      // Header hide on scroll-down, show on scroll-up
      if (headerRef.current) {
        const delta = scrollTop - lastScrollTopRef.current;
        if (scrollTop < 275) {
          headerRef.current.style.transform = "translateY(0)";
        } else if (delta > 0) {
          headerRef.current.style.transform = "translateY(-100%)";
        } else if (delta < 0) {
          headerRef.current.style.transform = "translateY(0)";
        }
        lastScrollTopRef.current = scrollTop;
      }
    };
    root.addEventListener("scroll", handleScroll, { passive: true });
    return () => root.removeEventListener("scroll", handleScroll);
  }, []);

  const handleMusicToggle = () => {
    toggleMute();
    setMusicMuted(isMuted());
  };

  return (
    <div className="min-h-screen bg-background relative">
      {/* Background grid */}
      <div ref={gridRef} className="fixed inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-[0.17] pointer-events-none z-0" />
      {/* Scanline */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none z-0">
        <div className="w-full h-1 bg-foreground/50 animate-scanline" />
      </div>

      <header ref={headerRef} className="fixed top-0 left-0 right-0 border-b-2 border-primary/40 bg-card/90 backdrop-blur-md shadow-lg shadow-primary/10 z-50 transition-transform duration-300 ease-in-out">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {config.backTo && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(config.backTo!)}
                aria-label="Go back"
                data-testid="button-back"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
            <img
              src={Logo}
              alt="L3L3 Logo"
              className={isDashboard ? "w-16 h-16" : "w-12 h-12 md:w-16 md:h-16"}
            />
            <div className="min-w-0">
              <h1 className="font-pixel text-xl md:text-2xl text-primary drop-shadow-[0_0_10px_rgba(168,85,247,0.5)] truncate">
                {config.title}
              </h1>
              {config.subtitle && (
                <p className="font-retro text-md md:text-base text-muted-foreground">
                  {config.subtitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <MusicToggle muted={musicMuted} onToggle={handleMusicToggle} />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="min-h-screen">
        {children}
      </div>

      <footer className="border-t-2 border-primary/40 bg-footer">
        <div className="container mx-auto px-4 min-h-48 flex flex-col items-center justify-center gap-2 text-center">
          <p className="font-retro text-base text-muted-foreground">
            This is a fan made website and is not associated with the H3 Podcast
          </p>
          <p className="font-retro text-base text-muted-foreground">
            (with ✌️ & ❤️)
          </p>
        </div>
      </footer>
    </div>
  );
}
