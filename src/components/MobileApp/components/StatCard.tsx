import { Card } from "../components/ui/card";
import { cn } from "../lib/utils";
import { type LucideIcon } from "lucide-react";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  subtitle?: string;
  className?: string;
}

export function StatCard({ icon: Icon, label, value, subtitle, className }: StatCardProps) {
  return (
    <Card className={cn(
      "relative overflow-hidden border-2 border-primary/40 bg-card/95 backdrop-blur-sm p-6",
      "shadow-lg shadow-primary/20",
      "hover-elevate transition-all duration-300",
      className
    )}>
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
      
      <div className="relative z-10 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-primary/20 border border-primary/40">
            <Icon className="w-6 h-6 text-primary" strokeWidth={2.5} />
          </div>
          <span className="font-retro text-lg uppercase tracking-wide text-muted-foreground" data-testid={`label-${label.toLowerCase().replace(/\s+/g, '-')}`}>
            {label}
          </span>
        </div>
        
        <div className="space-y-2">
          <div className="font-pixel text-2xl md:text-3xl text-primary drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]" data-testid={`value-${label.toLowerCase().replace(/\s+/g, '-')}`}>
            {value}
          </div>
          
          {subtitle && (
            <div className="font-retro text-base md:text-lg text-foreground/90 line-clamp-2" data-testid={`subtitle-${label.toLowerCase().replace(/\s+/g, '-')}`}>
              {subtitle}
            </div>
          )}
        </div>
      </div>
      
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
    </Card>
  );
}
