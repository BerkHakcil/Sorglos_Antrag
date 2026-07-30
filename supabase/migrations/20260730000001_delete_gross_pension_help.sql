-- Feedback pass 3, item 7 (B2) — delete the gross-pension info text on the
-- Berlin flat pension-amount question. Roman ordered the deletion (R3
-- exception b); the text was:
--   "Bitte geben Sie den Bruttobetrag aus dem aktuellen Rentenbescheid an."
--
-- Scope: exactly one row, targeted by id + key double guard. Berlin-only —
-- Essen's pension_amount_gross / spouse_pension_amount_gross PROMPTS mention
-- "Brutto" because they are dedicated gross-amount questions from Roman's
-- Essen master and are deliberately untouched.
--
-- Real-data impact: help_de is display-only; zero answer rows are affected.

UPDATE public.question
SET help_de = NULL
WHERE id = '60000000-0000-0000-0000-000000000005'
  AND key = 'rentenbetrag';
