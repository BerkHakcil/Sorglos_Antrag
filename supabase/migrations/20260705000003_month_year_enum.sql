-- Essen milestone, migration A — new answer type for MM.YYYY questions.
--
-- Separate from the Essen content migration because Postgres does not allow a
-- freshly added enum value to be USED in the same transaction that adds it
-- (the content migration references 'month_year' in its INSERTs).
-- Rendered as <input type="month">, stored "YYYY-MM"; validation + display
-- shipped in the engine commit that precedes this migration.

ALTER TYPE public.answer_type ADD VALUE IF NOT EXISTS 'month_year';
