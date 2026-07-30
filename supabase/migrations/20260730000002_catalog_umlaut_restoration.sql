-- Feedback pass 3, item 8 (B3) — mechanical umlaut restoration in legacy
-- Pankow-era document_catalog names (seeded transliterated in M5). Per R3
-- exception (a): ae->ä, oe->ö, ue->ü ONLY — never ss->ß. The three
-- ss-containing names (DOC-0005 Pflegekasse, DOC-0017 Aufenthaltsstatus,
-- DOC-0021 …aussiedler…) are correct German and deliberately NOT touched
-- (listed to Roman for confirmation in roman_package_pass3.md §8).
--
-- name_de is display-only (slots/uploads bind by DOC/PAN ids), so zero user
-- rows are affected. Each UPDATE is guarded by id + exact current value so a
-- replay on already-fixed data is a no-op and drift would surface in
-- verify-baseline rather than being silently overwritten.

UPDATE public.document_catalog
SET name_de = 'Kontoauszüge'
WHERE id = 'DOC-0003' AND name_de = 'Kontoauszuege';

UPDATE public.document_catalog
SET name_de = 'Mobilitätsnachweis'
WHERE id = 'DOC-0011' AND name_de = 'Mobilitaetsnachweis';

UPDATE public.document_catalog
SET name_de = 'Heimatvertriebener/Spätaussiedler Nachweis'
WHERE id = 'DOC-0021' AND name_de = 'Heimatvertriebener/Spaetaussiedler Nachweis';

UPDATE public.document_catalog
SET name_de = 'Mietkündigungsnachweis'
WHERE id = 'DOC-0025' AND name_de = 'Mietkuendigungsnachweis';
