import { sql } from "drizzle-orm";
import { pgTable, text, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Podcast Lateness Statistics Types
export interface MostRecent {
  videoId: string;
  lateTime: number;
  title: string;
  actualStartTime: string;
  scheduledStartTime: string;
}

export interface MaxLate {
  videoId: string;
  lateTime: number;
  title: string;
}

export interface DailyStats {
  sunday: { count: number; totalLateTime: number };
  monday: { count: number; totalLateTime: number };
  tuesday: { count: number; totalLateTime: number };
  wednesday: { count: number; totalLateTime: number };
  thursday: { count: number; totalLateTime: number };
  friday: { count: number; totalLateTime: number };
  saturday: { count: number; totalLateTime: number };
}

export interface StatsResponse {
  humanReadable: string;
  totalLateTime: number;
  averageLateTime: number;
  mostRecent: MostRecent;
  max: MaxLate;
  daily: DailyStats;
  lastUpdateDate: string;
  streamCount: number;
}

export interface Livestream {
  _id: string;
  videoId: string;
  scheduledStartTime: string;
  actualStartTime: string;
  lateTime: number;
  title: string;
}

export interface EpisodeWithDate {
  title: string;
  videoId: string;
  lateTime: number;
  scheduledStartTime: string;
  date: string; // YYYY-MM
}

export interface LivestreamsResponse {
  livestreams: Livestream[];
  skip: number;
  limit: number;
  total: number;
}

