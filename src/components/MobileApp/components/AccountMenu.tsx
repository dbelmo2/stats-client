import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { LogIn, LogOut, User } from "lucide-react";
import { Button } from "./ui/button";
import { useAuth } from "../hooks/useAuth";

export function AccountMenu() {
  const [, navigate] = useLocation();
  const { authenticated, username, discriminator, avatarUrl, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  if (!authenticated) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={() => navigate("/login")}
        aria-label="Log in"
        data-testid="button-header-login"
      >
        <LogIn className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setMenuOpen((open) => !open)}
        className="flex items-center gap-2 rounded-md px-2 py-1 hover-elevate active-elevate-2"
        aria-label="Account menu"
        data-testid="button-account-menu"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-7 w-7 rounded-full" />
        ) : (
          <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center">
            <User className="h-4 w-4 text-primary" />
          </div>
        )}
        <span className="hidden md:inline font-retro text-sm text-foreground/90 truncate max-w-[140px]">
          {username}#{discriminator}
        </span>
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 rounded-md border border-border bg-card shadow-lg z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-border/60 md:hidden">
            <p className="font-retro text-sm text-foreground/90 truncate">
              {username}#{discriminator}
            </p>
          </div>
          <button
            onClick={() => {
              setMenuOpen(false);
              logout();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-left font-retro text-sm text-foreground/90 hover:bg-muted/30 transition-colors"
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4" />
            Log Out
          </button>
        </div>
      )}
    </div>
  );
}
