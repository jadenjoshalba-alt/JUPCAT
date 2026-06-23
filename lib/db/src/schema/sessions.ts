import { pgTable, serial, integer, numeric, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sessionsTable = pgTable("sessions", {
  id: serial("id").primaryKey(),
  answers: jsonb("answers").notNull(),
  totalScore: numeric("total_score", { precision: 10, scale: 4 }).notNull(),
  totalQuestions: integer("total_questions").notNull(),
  timeTakenSeconds: integer("time_taken_seconds").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSessionSchema = createInsertSchema(sessionsTable).omit({ id: true, createdAt: true });
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessionsTable.$inferSelect;
