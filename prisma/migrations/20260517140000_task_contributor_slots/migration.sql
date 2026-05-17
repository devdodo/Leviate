-- Planned contributor headcount for budget split (payout + budgetPerTask display)
ALTER TABLE "tasks" ADD COLUMN "contributor_slots" INTEGER NOT NULL DEFAULT 1;

-- From audience_preferences JSON when present
UPDATE "tasks"
SET "contributor_slots" = GREATEST(1, slots)
FROM (
  SELECT
    "id",
    COALESCE(
      NULLIF(("audience_preferences"->>'contributorCount')::INTEGER, 0),
      NULLIF(("audience_preferences"->>'maxContributors')::INTEGER, 0),
      NULLIF(("audience_preferences"->>'contributorsWanted')::INTEGER, 0),
      NULLIF(("audience_preferences"->>'numberOfContributors')::INTEGER, 0),
      NULLIF(("audience_preferences"->>'contributorSlots')::INTEGER, 0)
    ) AS slots
  FROM "tasks"
) AS parsed
WHERE "tasks"."id" = parsed."id"
  AND parsed.slots IS NOT NULL
  AND parsed.slots >= 1;

-- Legacy rows where budget_per_task is a true per-contributor gross share
UPDATE "tasks"
SET "contributor_slots" = GREATEST(
  "contributor_slots",
  GREATEST(1, ROUND(("budget" / NULLIF("budget_per_task", 0)))::INTEGER)
)
WHERE "budget_per_task" IS NOT NULL
  AND "budget_per_task" > 0
  AND "budget" > "budget_per_task" * 1.01
  AND ROUND(("budget" / "budget_per_task")) >= 2;

-- Tasks that already had multiple approved/completed contributors
UPDATE "tasks" AS t
SET "contributor_slots" = GREATEST(t."contributor_slots", app_counts.cnt)
FROM (
  SELECT "task_id", COUNT(*)::INTEGER AS cnt
  FROM "task_applications"
  WHERE "status" IN ('APPROVED', 'COMPLETED')
  GROUP BY "task_id"
  HAVING COUNT(*) > 1
) AS app_counts
WHERE t."id" = app_counts."task_id";
