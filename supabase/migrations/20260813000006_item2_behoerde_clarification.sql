-- Round-2 item 2: clarify the two "Welche Behörde hat den Ausweis
-- ausgestellt?" prompts (Vertriebenen-/Spätaussiedlerausweis block) so the
-- transcript view no longer reads as a duplicate of the Personaldokument
-- issuer question. Wording exactly as proposed in
-- docs/feedback/roman_package_round2.md item 2.
--
-- PROVENANCE: approved by Erman 2026-08-13, Roman review waived (item-3
-- waiver, "approve all" incl. the item-2 clarification + spouse mirror).
-- The proposal's OPTIONAL symmetric rewording of the two "Wann wurde der
-- Ausweis ausgestellt?" questions is deliberately NOT taken — the waiver
-- covers the proposal proper (the two Behörde prompts).
--
-- R2 (execution-time census, prod dumps 2026-08-13): exactly TWO questions
-- carry the old prompt — Berlin applicant 60000000-…-0016
-- (special_origin_rights_issued_by) and Berlin spouse 60000000-…-007c
-- (spouse_special_origin_rights_issued_by); Essen has none. Zero e2e/test
-- anchors couple to the old wording (grep census; the feedback-pass T1
-- matcher words vertriebenen/spätaussiedler still match the NEW prompt).

BEGIN;

DO $$
DECLARE
  n integer;
BEGIN
  -- Pre-assert: the old prompt exists on exactly the two surveyed rows.
  SELECT count(*) INTO n FROM public.question
   WHERE prompt_de = 'Welche Behörde hat den Ausweis ausgestellt?';
  IF n <> 2 THEN
    RAISE EXCEPTION 'item 2 blocked: expected exactly 2 rows with the old prompt, found %', n;
  END IF;

  UPDATE public.question
     SET prompt_de = 'Welche Behörde hat den Vertriebenen- oder Spätaussiedlerausweis ausgestellt?'
   WHERE id = '60000000-0000-0000-0000-000000000016'
     AND key = 'special_origin_rights_issued_by'
     AND prompt_de = 'Welche Behörde hat den Ausweis ausgestellt?';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'item 2 applicant prompt: matched % rows', n; END IF;

  UPDATE public.question
     SET prompt_de = 'Welche Behörde hat den Vertriebenen- oder Spätaussiedlerausweis Ihres Partners ausgestellt?'
   WHERE id = '60000000-0000-0000-0000-00000000007c'
     AND key = 'spouse_special_origin_rights_issued_by'
     AND prompt_de = 'Welche Behörde hat den Ausweis ausgestellt?';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'item 2 spouse prompt: matched % rows', n; END IF;

  SELECT count(*) INTO n FROM public.question
   WHERE prompt_de = 'Welche Behörde hat den Ausweis ausgestellt?';
  IF n <> 0 THEN RAISE EXCEPTION 'item 2 end-state: old prompt still on % rows', n; END IF;
  RAISE NOTICE 'item 2 applied: both Behörde prompts now name the Vertriebenen-/Spätaussiedlerausweis';
END $$;

COMMIT;
