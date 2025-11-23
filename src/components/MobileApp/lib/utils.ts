import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatLateTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round((seconds % 60) * 10) / 10;
  
  if (minutes === 0) {
    return `${remainingSeconds}s`;
  }
  
  if (remainingSeconds === 0) {
    return `${minutes}m`;
  }
  
  return `${minutes}m ${remainingSeconds}s`;
}

export function formatLateTimeVerbose(seconds: number): { minutes: number; seconds: number; formatted: string } {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  return {
    minutes,
    seconds: remainingSeconds,
    formatted: formatLateTime(seconds)
  };
}
