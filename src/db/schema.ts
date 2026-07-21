import {
  pgTable,
  serial,
  varchar,
  boolean,
  date,
  integer,
  timestamp,
  unique,
  index,
} from "drizzle-orm/pg-core";

export const habits = pgTable("habits", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 50 }).notNull(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  icon: varchar("icon", { length: 10 }),
  optional: boolean("optional").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const dailyChecks = pgTable(
  "daily_checks",
  {
    id: serial("id").primaryKey(),
    habitId: integer("habit_id")
      .notNull()
      .references(() => habits.id),
    // NO database default on purpose: Neon runs in UTC and CURRENT_DATE would
    // roll the day over at 21:00 São Paulo time. The date is always computed
    // in app code (todayInSaoPaulo) and passed in explicitly.
    checkedAt: date("checked_at").notNull(),
    done: boolean("done").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    unique().on(t.habitId, t.checkedAt),
    index("idx_checks_date").on(t.checkedAt.desc()),
  ]
);
