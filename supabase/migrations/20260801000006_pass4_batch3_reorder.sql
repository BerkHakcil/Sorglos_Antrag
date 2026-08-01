-- Content pass 4, Batch 3 — D6 Berlin question reorder (approved order:
-- docs/feedback/pass4_phase_a.md appendix; §3 section labels approved by
-- Erman 2026-08-01, Roman review waived). Block order: Persönliches →
-- Wohnung und Heim → Einkommen → Vermögen → Versicherung und Pflege →
-- Weitere Angaben → Partner, Familie und Unterhalt. PLZ stays the
-- pre-questionnaire step (no PLZ question exists — FP2).
--
-- Mechanics: every ACTIVE Berlin question gets an explicit (category,
-- sort_order) from the approved 167-row sequence — ids never change, so
-- answers, doc rules and uploads are untouched. The dependency constraint
-- (controller precedes dependents) was re-verified programmatically against
-- the LIVE visibility rules at generation time. The retired pair keeps its
-- rows in the emptied 'einkommen' category (renumbered to the end); the
-- emptied 'kinder' category likewise. The children group follows its
-- questions into the Partner/Familie block (case-export loads groups by
-- category). Essen: zero statements touch it.
--
-- Real-data impact: sort_order/category_id/label_de only — no answer rows.
-- Resume positions of in_progress Berlin cases shift with the flow order
-- (resume = first unanswered required in flow order) — reported per case in
-- pass4_state.md, accepted by the founder gate.

-- ── 1. The 167-row order ─────────────────────────────────────────────────────
DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM public.question q
  JOIN public.category c ON c.id = q.category_id
  WHERE c.questionnaire_id = '30000000-0000-0000-0000-000000000001' AND q.active;
  IF n <> 167 THEN
    RAISE EXCEPTION 'pre-check: expected 167 active Berlin questions, found %', n;
  END IF;

  UPDATE public.question AS q
  SET category_id = m.cat, sort_order = m.so
  FROM (VALUES
      ('60000000-0000-0000-0000-0000000000f1'::uuid, '40000000-0000-0000-0000-000000000001'::uuid, 0),
      ('60000000-0000-0000-0000-0000000000f3'::uuid, '40000000-0000-0000-0000-000000000001'::uuid, 1),
      ('60000000-0000-0000-0000-0000000000f2'::uuid, '40000000-0000-0000-0000-000000000001'::uuid, 2),
      ('60000000-0000-0000-0000-000000000002'::uuid, '40000000-0000-0000-0000-000000000001'::uuid, 3),
      ('60000000-0000-0000-0000-000000000007'::uuid, '40000000-0000-0000-0000-000000000001'::uuid, 4),
      ('60000000-0000-0000-0000-000000000008'::uuid, '40000000-0000-0000-0000-000000000001'::uuid, 5),
      ('60000000-0000-0000-0000-000000000009'::uuid, '40000000-0000-0000-0000-000000000001'::uuid, 6),
      ('60000000-0000-0000-0000-00000000000a'::uuid, '40000000-0000-0000-0000-000000000001'::uuid, 7),
      ('60000000-0000-0000-0000-00000000000b'::uuid, '40000000-0000-0000-0000-000000000001'::uuid, 8),
      ('60000000-0000-0000-0000-0000000000f4'::uuid, '40000000-0000-0000-0000-000000000001'::uuid, 9),
      ('60000000-0000-0000-0000-00000000000c'::uuid, '40000000-0000-0000-0000-000000000001'::uuid, 10),
      ('60000000-0000-0000-0000-00000000000d'::uuid, '40000000-0000-0000-0000-000000000001'::uuid, 11),
      ('60000000-0000-0000-0000-00000000000e'::uuid, '40000000-0000-0000-0000-000000000001'::uuid, 12),
      ('60000000-0000-0000-0000-000000000014'::uuid, '40000000-0000-0000-0000-000000000001'::uuid, 13),
      ('60000000-0000-0000-0000-000000000015'::uuid, '40000000-0000-0000-0000-000000000001'::uuid, 14),
      ('60000000-0000-0000-0000-000000000016'::uuid, '40000000-0000-0000-0000-000000000001'::uuid, 15),
      ('60000000-0000-0000-0000-000000000017'::uuid, '40000000-0000-0000-0000-000000000001'::uuid, 16),
      ('60000000-0000-0000-0000-000000000018'::uuid, '40000000-0000-0000-0000-000000000001'::uuid, 17),
      ('60000000-0000-0000-0000-000000000019'::uuid, '40000000-0000-0000-0000-000000000001'::uuid, 18),
      ('60000000-0000-0000-0000-00000000001a'::uuid, '40000000-0000-0000-0000-000000000001'::uuid, 19),
      ('60000000-0000-0000-0000-000000000013'::uuid, '40000000-0000-0000-0000-000000000001'::uuid, 20),
      ('60000000-0000-0000-0000-00000000000f'::uuid, '40000000-0000-0000-0000-000000000001'::uuid, 21),
      ('60000000-0000-0000-0000-000000000010'::uuid, '40000000-0000-0000-0000-000000000001'::uuid, 22),
      ('60000000-0000-0000-0000-000000000011'::uuid, '40000000-0000-0000-0000-000000000001'::uuid, 23),
      ('60000000-0000-0000-0000-000000000012'::uuid, '40000000-0000-0000-0000-000000000001'::uuid, 24),
      ('60000000-0000-0000-0000-00000000001f'::uuid, '40000000-0000-0000-0000-000000000001'::uuid, 25),
      ('60000000-0000-0000-0000-00000000001e'::uuid, '40000000-0000-0000-0000-000000000009'::uuid, 0),
      ('60000000-0000-0000-0000-000000000023'::uuid, '40000000-0000-0000-0000-000000000009'::uuid, 1),
      ('60000000-0000-0000-0000-000000000024'::uuid, '40000000-0000-0000-0000-000000000009'::uuid, 2),
      ('60000000-0000-0000-0000-000000000026'::uuid, '40000000-0000-0000-0000-000000000009'::uuid, 3),
      ('60000000-0000-0000-0000-000000000027'::uuid, '40000000-0000-0000-0000-000000000009'::uuid, 4),
      ('60000000-0000-0000-0000-000000000028'::uuid, '40000000-0000-0000-0000-000000000009'::uuid, 5),
      ('60000000-0000-0000-0000-000000000029'::uuid, '40000000-0000-0000-0000-000000000009'::uuid, 6),
      ('60000000-0000-0000-0000-00000000002a'::uuid, '40000000-0000-0000-0000-000000000009'::uuid, 7),
      ('60000000-0000-0000-0000-00000000002d'::uuid, '40000000-0000-0000-0000-000000000009'::uuid, 8),
      ('60000000-0000-0000-0000-00000000002e'::uuid, '40000000-0000-0000-0000-000000000009'::uuid, 9),
      ('60000000-0000-0000-0000-00000000002f'::uuid, '40000000-0000-0000-0000-000000000009'::uuid, 10),
      ('60000000-0000-0000-0000-000000000030'::uuid, '40000000-0000-0000-0000-000000000009'::uuid, 11),
      ('60000000-0000-0000-0000-000000000100'::uuid, '40000000-0000-0000-0000-000000000004'::uuid, 0),
      ('60000000-0000-0000-0000-000000000039'::uuid, '40000000-0000-0000-0000-000000000004'::uuid, 1),
      ('60000000-0000-0000-0000-00000000003a'::uuid, '40000000-0000-0000-0000-000000000004'::uuid, 2),
      ('60000000-0000-0000-0000-00000000003b'::uuid, '40000000-0000-0000-0000-000000000004'::uuid, 3),
      ('60000000-0000-0000-0000-00000000003c'::uuid, '40000000-0000-0000-0000-000000000004'::uuid, 4),
      ('60000000-0000-0000-0000-00000000003d'::uuid, '40000000-0000-0000-0000-000000000004'::uuid, 5),
      ('60000000-0000-0000-0000-00000000003e'::uuid, '40000000-0000-0000-0000-000000000004'::uuid, 6),
      ('60000000-0000-0000-0000-00000000003f'::uuid, '40000000-0000-0000-0000-000000000004'::uuid, 7),
      ('60000000-0000-0000-0000-000000000040'::uuid, '40000000-0000-0000-0000-000000000004'::uuid, 8),
      ('60000000-0000-0000-0000-000000000041'::uuid, '40000000-0000-0000-0000-000000000004'::uuid, 9),
      ('60000000-0000-0000-0000-000000000042'::uuid, '40000000-0000-0000-0000-000000000004'::uuid, 10),
      ('60000000-0000-0000-0000-000000000051'::uuid, '40000000-0000-0000-0000-000000000006'::uuid, 0),
      ('60000000-0000-0000-0000-000000000052'::uuid, '40000000-0000-0000-0000-000000000006'::uuid, 1),
      ('60000000-0000-0000-0000-000000000053'::uuid, '40000000-0000-0000-0000-000000000006'::uuid, 2),
      ('60000000-0000-0000-0000-000000000054'::uuid, '40000000-0000-0000-0000-000000000006'::uuid, 3),
      ('60000000-0000-0000-0000-000000000055'::uuid, '40000000-0000-0000-0000-000000000006'::uuid, 4),
      ('60000000-0000-0000-0000-000000000056'::uuid, '40000000-0000-0000-0000-000000000006'::uuid, 5),
      ('60000000-0000-0000-0000-000000000057'::uuid, '40000000-0000-0000-0000-000000000006'::uuid, 6),
      ('60000000-0000-0000-0000-000000000058'::uuid, '40000000-0000-0000-0000-000000000006'::uuid, 7),
      ('60000000-0000-0000-0000-000000000059'::uuid, '40000000-0000-0000-0000-000000000006'::uuid, 8),
      ('60000000-0000-0000-0000-00000000005a'::uuid, '40000000-0000-0000-0000-000000000006'::uuid, 9),
      ('60000000-0000-0000-0000-00000000005b'::uuid, '40000000-0000-0000-0000-000000000006'::uuid, 10),
      ('60000000-0000-0000-0000-00000000005c'::uuid, '40000000-0000-0000-0000-000000000006'::uuid, 11),
      ('60000000-0000-0000-0000-00000000005d'::uuid, '40000000-0000-0000-0000-000000000006'::uuid, 12),
      ('60000000-0000-0000-0000-00000000005e'::uuid, '40000000-0000-0000-0000-000000000006'::uuid, 13),
      ('60000000-0000-0000-0000-00000000005f'::uuid, '40000000-0000-0000-0000-000000000006'::uuid, 14),
      ('60000000-0000-0000-0000-000000000060'::uuid, '40000000-0000-0000-0000-000000000006'::uuid, 15),
      ('60000000-0000-0000-0000-000000000061'::uuid, '40000000-0000-0000-0000-000000000006'::uuid, 16),
      ('60000000-0000-0000-0000-000000000062'::uuid, '40000000-0000-0000-0000-000000000006'::uuid, 17),
      ('60000000-0000-0000-0000-000000000063'::uuid, '40000000-0000-0000-0000-000000000006'::uuid, 18),
      ('60000000-0000-0000-0000-000000000064'::uuid, '40000000-0000-0000-0000-000000000006'::uuid, 19),
      ('60000000-0000-0000-0000-000000000065'::uuid, '40000000-0000-0000-0000-000000000006'::uuid, 20),
      ('60000000-0000-0000-0000-000000000066'::uuid, '40000000-0000-0000-0000-000000000006'::uuid, 21),
      ('60000000-0000-0000-0000-000000000067'::uuid, '40000000-0000-0000-0000-000000000006'::uuid, 22),
      ('60000000-0000-0000-0000-000000000068'::uuid, '40000000-0000-0000-0000-000000000006'::uuid, 23),
      ('60000000-0000-0000-0000-00000000001b'::uuid, '40000000-0000-0000-0000-000000000005'::uuid, 0),
      ('60000000-0000-0000-0000-00000000001c'::uuid, '40000000-0000-0000-0000-000000000005'::uuid, 1),
      ('60000000-0000-0000-0000-00000000001d'::uuid, '40000000-0000-0000-0000-000000000005'::uuid, 2),
      ('60000000-0000-0000-0000-000000000043'::uuid, '40000000-0000-0000-0000-000000000005'::uuid, 3),
      ('60000000-0000-0000-0000-000000000044'::uuid, '40000000-0000-0000-0000-000000000005'::uuid, 4),
      ('60000000-0000-0000-0000-000000000045'::uuid, '40000000-0000-0000-0000-000000000005'::uuid, 5),
      ('60000000-0000-0000-0000-000000000046'::uuid, '40000000-0000-0000-0000-000000000005'::uuid, 6),
      ('60000000-0000-0000-0000-000000000047'::uuid, '40000000-0000-0000-0000-000000000005'::uuid, 7),
      ('60000000-0000-0000-0000-000000000048'::uuid, '40000000-0000-0000-0000-000000000005'::uuid, 8),
      ('60000000-0000-0000-0000-000000000049'::uuid, '40000000-0000-0000-0000-000000000005'::uuid, 9),
      ('60000000-0000-0000-0000-00000000004a'::uuid, '40000000-0000-0000-0000-000000000005'::uuid, 10),
      ('60000000-0000-0000-0000-00000000004b'::uuid, '40000000-0000-0000-0000-000000000005'::uuid, 11),
      ('60000000-0000-0000-0000-00000000004c'::uuid, '40000000-0000-0000-0000-000000000005'::uuid, 12),
      ('60000000-0000-0000-0000-00000000004d'::uuid, '40000000-0000-0000-0000-000000000005'::uuid, 13),
      ('60000000-0000-0000-0000-00000000004e'::uuid, '40000000-0000-0000-0000-000000000005'::uuid, 14),
      ('60000000-0000-0000-0000-00000000004f'::uuid, '40000000-0000-0000-0000-000000000005'::uuid, 15),
      ('60000000-0000-0000-0000-000000000050'::uuid, '40000000-0000-0000-0000-000000000005'::uuid, 16),
      ('60000000-0000-0000-0000-000000000069'::uuid, '40000000-0000-0000-0000-000000000007'::uuid, 0),
      ('60000000-0000-0000-0000-00000000006a'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 0),
      ('60000000-0000-0000-0000-00000000006b'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 1),
      ('60000000-0000-0000-0000-00000000006c'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 2),
      ('60000000-0000-0000-0000-00000000006d'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 3),
      ('60000000-0000-0000-0000-00000000006e'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 4),
      ('60000000-0000-0000-0000-00000000006f'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 5),
      ('60000000-0000-0000-0000-000000000070'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 6),
      ('60000000-0000-0000-0000-000000000071'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 7),
      ('60000000-0000-0000-0000-0000000000f5'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 8),
      ('60000000-0000-0000-0000-000000000072'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 9),
      ('60000000-0000-0000-0000-000000000073'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 10),
      ('60000000-0000-0000-0000-000000000074'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 11),
      ('60000000-0000-0000-0000-000000000075'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 12),
      ('60000000-0000-0000-0000-000000000076'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 13),
      ('60000000-0000-0000-0000-000000000077'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 14),
      ('60000000-0000-0000-0000-000000000078'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 15),
      ('60000000-0000-0000-0000-000000000079'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 16),
      ('60000000-0000-0000-0000-00000000007a'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 17),
      ('60000000-0000-0000-0000-00000000007b'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 18),
      ('60000000-0000-0000-0000-00000000007c'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 19),
      ('60000000-0000-0000-0000-00000000007d'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 20),
      ('60000000-0000-0000-0000-00000000007e'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 21),
      ('60000000-0000-0000-0000-00000000007f'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 22),
      ('60000000-0000-0000-0000-000000000080'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 23),
      ('60000000-0000-0000-0000-000000000081'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 24),
      ('60000000-0000-0000-0000-000000000082'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 25),
      ('60000000-0000-0000-0000-000000000083'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 26),
      ('60000000-0000-0000-0000-000000000084'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 27),
      ('60000000-0000-0000-0000-000000000085'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 28),
      ('60000000-0000-0000-0000-000000000086'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 29),
      ('60000000-0000-0000-0000-000000000087'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 30),
      ('60000000-0000-0000-0000-000000000088'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 31),
      ('60000000-0000-0000-0000-000000000089'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 32),
      ('60000000-0000-0000-0000-00000000008a'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 33),
      ('60000000-0000-0000-0000-00000000008b'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 34),
      ('60000000-0000-0000-0000-00000000008c'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 35),
      ('60000000-0000-0000-0000-00000000008d'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 36),
      ('60000000-0000-0000-0000-00000000008e'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 37),
      ('60000000-0000-0000-0000-00000000008f'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 38),
      ('60000000-0000-0000-0000-000000000090'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 39),
      ('60000000-0000-0000-0000-000000000091'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 40),
      ('60000000-0000-0000-0000-000000000092'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 41),
      ('60000000-0000-0000-0000-000000000093'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 42),
      ('60000000-0000-0000-0000-000000000094'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 43),
      ('60000000-0000-0000-0000-000000000095'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 44),
      ('60000000-0000-0000-0000-000000000096'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 45),
      ('60000000-0000-0000-0000-000000000097'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 46),
      ('60000000-0000-0000-0000-0000000000f6'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 47),
      ('60000000-0000-0000-0000-0000000000f7'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 48),
      ('60000000-0000-0000-0000-0000000000f8'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 49),
      ('60000000-0000-0000-0000-000000000099'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 50),
      ('60000000-0000-0000-0000-0000000000f9'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 51),
      ('60000000-0000-0000-0000-000000000098'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 52),
      ('60000000-0000-0000-0000-0000000000fa'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 53),
      ('60000000-0000-0000-0000-0000000000fb'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 54),
      ('60000000-0000-0000-0000-0000000000fc'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 55),
      ('60000000-0000-0000-0000-0000000000fd'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 56),
      ('60000000-0000-0000-0000-0000000000fe'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 57),
      ('60000000-0000-0000-0000-00000000009a'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 58),
      ('60000000-0000-0000-0000-00000000009b'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 59),
      ('60000000-0000-0000-0000-00000000009c'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 60),
      ('60000000-0000-0000-0000-00000000009d'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 61),
      ('60000000-0000-0000-0000-00000000009e'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 62),
      ('60000000-0000-0000-0000-00000000009f'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 63),
      ('60000000-0000-0000-0000-0000000000a0'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 64),
      ('60000000-0000-0000-0000-0000000000a1'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 65),
      ('60000000-0000-0000-0000-0000000000a2'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 66),
      ('60000000-0000-0000-0000-0000000000ff'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 67),
      ('60000000-0000-0000-0000-000000000031'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 68),
      ('60000000-0000-0000-0000-000000000032'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 69),
      ('60000000-0000-0000-0000-000000000033'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 70),
      ('60000000-0000-0000-0000-000000000034'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 71),
      ('60000000-0000-0000-0000-000000000035'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 72),
      ('60000000-0000-0000-0000-000000000036'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 73),
      ('60000000-0000-0000-0000-000000000037'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 74),
      ('60000000-0000-0000-0000-000000000038'::uuid, '40000000-0000-0000-0000-000000000008'::uuid, 75)
  ) AS m(id, cat, so)
  WHERE q.id = m.id;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 167 THEN
    RAISE EXCEPTION 'reorder applied to % rows (expected 167)', n;
  END IF;
  RAISE NOTICE 'reorder applied: 167 questions repositioned';
END $$;

-- ── 2. Category sort + the three approved labels ─────────────────────────────
DO $$
DECLARE
  n integer := 0;
  r integer;
BEGIN
  UPDATE public.category SET sort_order = 0 WHERE id = '40000000-0000-0000-0000-000000000001'; GET DIAGNOSTICS r = ROW_COUNT; n := n + r;
  UPDATE public.category SET sort_order = 1, label_de = 'Wohnung und Heim' WHERE id = '40000000-0000-0000-0000-000000000009' AND label_de = 'Wohnsituation'; GET DIAGNOSTICS r = ROW_COUNT; n := n + r;
  UPDATE public.category SET sort_order = 2, label_de = 'Einkommen' WHERE id = '40000000-0000-0000-0000-000000000004' AND label_de = 'Einkünfte'; GET DIAGNOSTICS r = ROW_COUNT; n := n + r;
  UPDATE public.category SET sort_order = 3 WHERE id = '40000000-0000-0000-0000-000000000006'; GET DIAGNOSTICS r = ROW_COUNT; n := n + r;
  UPDATE public.category SET sort_order = 4, label_de = 'Versicherung und Pflege' WHERE id = '40000000-0000-0000-0000-000000000005' AND label_de = 'Ausgaben'; GET DIAGNOSTICS r = ROW_COUNT; n := n + r;
  UPDATE public.category SET sort_order = 5 WHERE id = '40000000-0000-0000-0000-000000000007'; GET DIAGNOSTICS r = ROW_COUNT; n := n + r;
  UPDATE public.category SET sort_order = 6, label_de = 'Partner, Familie und Unterhalt' WHERE id = '40000000-0000-0000-0000-000000000008' AND label_de = 'Ehepartner / Lebenspartner'; GET DIAGNOSTICS r = ROW_COUNT; n := n + r;
  -- Emptied holders to the end: einkommen keeps only the RETIRED pair rows;
  -- kinder is empty after its questions moved to the Partner/Familie block.
  UPDATE public.category SET sort_order = 98 WHERE id = '40000000-0000-0000-0000-000000000002'; GET DIAGNOSTICS r = ROW_COUNT; n := n + r;
  UPDATE public.category SET sort_order = 99 WHERE id = '40000000-0000-0000-0000-000000000003'; GET DIAGNOSTICS r = ROW_COUNT; n := n + r;
  IF n <> 9 THEN
    RAISE EXCEPTION 'category updates hit % rows (expected 9 — a label guard failed?)', n;
  END IF;
  RAISE NOTICE 'categories renumbered; three approved labels set';
END $$;

-- ── 3. The children group follows its questions ──────────────────────────────
DO $$
DECLARE
  n integer;
BEGIN
  UPDATE public.question_group SET category_id = '40000000-0000-0000-0000-000000000008'
  WHERE id = '50000000-0000-0000-0000-000000000001' AND key = 'children';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'children group move failed (%)', n; END IF;
  RAISE NOTICE 'children group moved to the Partner/Familie block';
END $$;

-- ── 4. Final assertion: the complete flow order matches the approved sequence
DO $$
DECLARE
  seq text;
BEGIN
  SELECT string_agg(q.key, ',' ORDER BY c.sort_order, q.sort_order) INTO seq
  FROM public.question q
  JOIN public.category c ON c.id = q.category_id
  WHERE c.questionnaire_id = '30000000-0000-0000-0000-000000000001' AND q.active;
  IF seq <> 'first_name,birth_name,last_name,geburtsdatum,district_of_birth,country_of_birth,gender,marital_status,marital_status_since,german_citizenship_yes_no,citizenship,issuer_of_id,id_expiry_date,special_origin_rights,special_origin_rights_issued,special_origin_rights_issued_by,disability_card,disablity_card_application,disability_card_expiry,disability_card_markers,power_of_attorney,prior_social_aid,prior_social_aid_until,prior_social_aid_issuer,prior_social_aid_reference_id,prior_social_service_applications,in_facility_since,last_residence_street,last_residence_city,berlin_since,berlin_district_since,apartment_ownership,landlord_name_and_address,rent_total,rent_paid_until,rent_debt,rent_contract_termination_yes_no,rent_contract_terminated_by,pension_count,pension_type,pension_amount,pension_id,pension_issuer,wohngeld_yes_no,wohngeld_amount,wohngeld_id,other_income,other_income_type,other_income_amount,bank_giro,bank_giro_blz,bank_giro_iban,bank_giro_amount,bank_savings_account_yes_no,bank_savings_account_amount,bank_savings_iban,bank_additional_account_yes_no,bank_additional_name,bank_additional_iban,bank_additional_amount,cash_savings,automobile_owner,automobile_numbers_plate,automobile_type,automobile_year,automobile_holder,property_yes_no,property_address,property_usage,property_size,additional_wealth_yes_no,additional_wealth_type,additional_wealth_amount,health_insurance,health_insurance_type,care_level,govermental_employee,health_insurance_amount,care_insurance_amount,general_liablity_insurance_yes_no,general_liablity_insurance_provider,general_liability_amount,life_insurance,life_insurance_monthly_amount,life_insurance_total_amount,life_insurance_name,life_insurance_number,funeral_insurance_yes_no,funeral_insurance_amount,funeral_insurance_detail,costly_diet,spouse_last_name,spouse_birth_name,spouse_first_name,spouse_birthdate,spouse_city_of_birth,spouse_district_of_birth,spouse_country_of_birth,spouse_gender,spouse_german_citizenship_yes_no,spouse_citizenship,spouse_issuer_of_id,spouse_id_expiry_date,spouse_prior_social_aid,spouse_prior_social_aid_until,spouse_prior_social_aid_issuer,spouse_prior_social_aid_reference_id,spouse_power_of_attorney,spouse_special_origin_rights,spouse_special_origin_rights_issued,spouse_special_origin_rights_issued_by,spouse_disability_card,spouse_disability_card_application,spouse_disability_card_expiry,spouse_disability_card_markers,spouse_health_insurance,spouse_health_insurance_type,spouse_care_level,spouse_in_facility_yes_no,spouse_in_facility_since,spouse_prior_social_service_applications,spouse_pension_type,spouse_pension_amount,spouse_pension_id,spouse_pension_issuer,spouse_wohngeld_yes_no,spouse_wohngeld_amount,spouse_wohngeld_id,spouse_other_income,spouse_other_income_type,spouse_other_income_amount,spouse_health_insurance_amount,spouse_care_insurance_amount,spouse_general_liablity_insurance_yes_no,spouse_general_liablity_insurance_provider,spouse_general_liability_amount,spouse_life_insurance,spouse_life_insurance_amount,spouse_bank_giro,spouse_bank_giro_blz,spouse_bank_giro_iban,spouse_bank_account_amount,spouse_bank_savings_account_yes_no,spouse_bank_savings_account_amount,spouse_bank_savings_iban,spouse_bank_additional_account_yes_no,spouse_bank_additional_name,spouse_bank_additional_iban,spouse_bank_additional_amount,spouse_automobile_owner,spouse_automobile_numbers_plate,spouse_automobile_type,spouse_automobile_year,spouse_automobile_holder,spouse_property_yes_no,spouse_additional_wealth_yes_no,spouse_additional_wealth_type,spouse_additional_wealth_amount,children_yes_no,child_first_name,child_last_name,child_birth_name,child_birth_date,child_marital_status,child_family_tie,child_profession,child_address' THEN
    RAISE EXCEPTION 'final order mismatch — flow does not match the approved sequence';
  END IF;
  RAISE NOTICE 'final order verified: 167-key sequence matches the approved appendix';
END $$;
