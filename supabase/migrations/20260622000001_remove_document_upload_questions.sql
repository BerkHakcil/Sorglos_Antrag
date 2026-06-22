-- Remove all questions of type document_upload from the questionnaire.
-- Documents are tracked via the document_type / document_rule tables (M5).
-- The chat flow (M3+) already filters document_upload in buildNav, but deleting
-- them from the DB is cleaner and prevents them appearing in any future query.
--
-- Answers referencing these questions are cascade-deleted via the FK constraint
-- defined in 20260607000001_initial_schema.sql.

DELETE FROM public.question
WHERE answer_type = 'document_upload';
