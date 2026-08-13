# Batch C — Berlin PLZ routing reconciliation (READ-ONLY report, 2026-08-13)

> STOP document: nothing here is applied. The draft migration in §III is TEXT
> ONLY (not in supabase/migrations) and gated on decisions D-1..D-8 at the end.
> Produced by three verified read-only passes: prod-dump census, official-
> geodata research, and synthesis. Prod snapshots 2026-08-12/13; repo @ 4f21de8.
>
> HEADLINE PREMISE CORRECTIONS:
>
> 1. **13189 (and 13187) already route to Pankow** — priority-20 rules beat the
>    priority-1 city rules. The mapped Pankow set (21 PLZs) equals the standard
>    directory Pankow set exactly; NOTHING is missing from it.
> 2. **10247/10249/13051 (+10119) are minority-Pankow border PLZs kept on Pankow
>    DELIBERATELY** per Roman's recorded "when in doubt, include" policy
>    (migration 20260723000002, docs/operations.md §7) — not errors.
> 3. **The other 11 Berlin district offices do not exist in social_office**, and
>    **cases.social_office_id is frozen at PLZ entry** — the remap affects only
>    FUTURE cases unless an explicit case backfill ships (Part C1, decision D-5).
> 4. **Rico keeps banner + suppressed suffix after the remap** — his PLZ 12687 is
>    100% Marzahn-Hellersdorf (rule-less office → fallback). That is the CORRECT
>    behavior; the expected "banner gone, suffix returns" would require a
>    Marzahn rule set or a deliberate policy mapping (§IV.3).

---

# I. Census (prod dumps)

## Batch-C scout report: PLZ mapping + case census (read-only, from prod dumps + repo @ 4f21de8)

### 1. The 190 city-level PLZ rules

**Count confirmed: exactly 190 rules** on `Sozialamt Berlin` (10000000-…-0001), all id-prefix `a0000000`, **all priority 1**, all single-PLZ ranges (`plz_from === plz_to`), **zero duplicates** within the set, **zero PLZs outside 10000–14999**. Range spans 10115–14199 — this is the complete real Berlin PLZ set.

Full list (sorted):

```
10115,10117,10119,10178,10179,10243,10245,10247,10249,10315,10317,10318,10319,10365,10367,10369,
10405,10407,10409,10435,10437,10439,10551,10553,10555,10557,10559,10585,10587,10589,10623,10625,
10627,10629,10707,10709,10711,10713,10715,10717,10719,10777,10779,10781,10783,10785,10787,10789,
10823,10825,10827,10829,10961,10963,10965,10967,10969,10997,10999,12043,12045,12047,12049,12051,
12053,12055,12057,12059,12099,12101,12103,12105,12107,12109,12157,12159,12161,12163,12165,12167,
12169,12203,12205,12207,12209,12247,12249,12277,12279,12305,12307,12309,12347,12349,12351,12353,
12355,12357,12359,12435,12437,12439,12459,12487,12489,12524,12526,12527,12555,12557,12559,12587,
12589,12619,12621,12623,12627,12629,12679,12681,12683,12685,12687,12689,13051,13053,13055,13057,
13059,13086,13088,13089,13125,13127,13129,13156,13158,13159,13187,13189,13347,13349,13351,13353,
13355,13357,13359,13403,13405,13407,13409,13435,13437,13439,13465,13467,13469,13503,13505,13507,
13509,13581,13583,13585,13587,13589,13591,13593,13595,13597,13599,13627,13629,14050,14052,14053,
14055,14057,14059,14089,14109,14129,14163,14165,14167,14169,14193,14195,14197,14199
```

**Overlaps:** exactly 21 PLZs carry two rules — Pankow(prio 20) + city-level(prio 1) — and only those 21: 10119, 10247, 10249, 10405, 10407, 10409, 10435, 10437, 10439, 13051, 13086, 13088, 13089, 13125, 13127, 13129, 13156, 13158, 13159, **13187, 13189**. Resolver picks Pankow for all 21. **The founder's premise "13189 is Pankow and unmapped" is FALSE on today's prod** — 13189 (and 13187) each have a priority-20 Pankow rule that beats the priority-1 city rule; they already route to the Pankow office. Net: 169 of the 190 city rules are live; 21 are shadowed dead weight.

**Other offices in window 10000–14999** (261 rules total in window; 8180 rules overall):

| Office                               | Rules | PLZs                                          |
| ------------------------------------ | ----- | --------------------------------------------- |
| Sozialamt Berlin (city)              | 190   | above, prio 1                                 |
| Sozialamt Berlin-Pankow              | 21    | prio 20                                       |
| Sozialamt Dahme-Spreewald (…0035)    | 1     | 12529 (Schönefeld — legitimately Brandenburg) |
| Sozialamt Potsdam (…0036)            | 8     | 14467–14482                                   |
| Sozialamt Potsdam-Mittelmark (…0037) | 20    | 14513–14929                                   |
| Sozialamt Havelland (…0038)          | 11    | 14612–14728                                   |
| Sozialamt Brandenburg a.d.H. (…0039) | 4     | 14770–14776                                   |
| Sozialamt Teltow-Fläming (…0040)     | 6     | 14913–14979                                   |

Only ONE rule ≤14199 outside city+Pankow: 12529→Dahme-Spreewald, which is correct (Schönefeld is Brandenburg, not Berlin). **No foreign office owns any actual Berlin PLZ.** No multi-PLZ ranges anywhere in the Berlin window.

### 2. Berlin district offices — DECIDES #1

`dump_docrules.offices` (377 rows, shape `{id, name, is_active}` only) contains **exactly 2 offices with "Berlin" in the name**:

| id              | name                    | active | plz rules | doc rules (active) |
| --------------- | ----------------------- | ------ | --------- | ------------------ |
| 10000000-…-0001 | Sozialamt Berlin        | true   | 190       | 0 (0)              |
| 11000000-…-0001 | Sozialamt Berlin-Pankow | true   | 21        | 50 (49)            |

**There are NO rows for the other 11 districts** (Mitte, Friedrichshain-Kreuzberg, Marzahn-Hellersdorf, Lichtenberg, Charlottenburg-Wilmersdorf, Spandau, Steglitz-Zehlendorf, Tempelhof-Schöneberg, Neukölln, Treptow-Köpenick, Reinickendorf). **The founder's "non-Pankow Berlin PLZs → their own district offices" is NOT executable today** — it requires (a) 11 new `social_office` rows and (b) a Berlin PLZ→district mapping, which does not exist anywhere in the DB (migration 20260615000001 explicitly consolidated districts away, see §3). Doc-rule totals in dump: 105 = Pankow 50 + Essen 55 (`active` column: Pankow 49 true/1 false; Essen all true). `app_config.default_document_office_id` = Pankow (set 2026-07-22).

### 3. Rule-generation provenance (migrations)

- **`20260614000002_seed_options_plz.sql`** (M1 seed, first `a0000000` generation): "`-- ─── PLZ rules — 190 Berlin codes`" — 190 Berlin PLZs → city office at **priority 10**.
- **`20260615000001_real_plz_data.sql`** (current `a0000000` generation): header — "Imports 375 social offices + 8 159 PLZ rules from plz_de.xlsx. **Berlin districts consolidated → existing Sozialamt Berlin entry.**" It does `DELETE FROM public.postal_code_rule; DELETE FROM public.social_office WHERE id <> '10000000-…-0001';` then re-inserts everything at **priority 1** (reusing `a0000000` ids). This is where the district concept was deliberately erased.
- **`20260711000005_m5r2_office_tables.sql`** (`b0000000` 01–18): "`── Sozialamt Berlin-Pankow + higher-priority PLZ rules (D5, option B)` — PLZ list drafted from official Bezirk-Pankow data — **PENDING ROMAN CONFIRMATION** … **Priority 20 outranks the city-wide Berlin rules (priority 10 and below)**; all other Berlin PLZs keep the city-wide office. The new office id 11000000-… namespace: the nationwide seed already occupies 10000000-…-0001..0376". Inserts 18 Pankow PLZs at prio 20.
- **`20260723000002_pankow_plz_expansion_giro_prompt.sql`** (`b0000000` 19–21): "Roman approved all 18 seeded PLZs and added three: 10247, 10249, 13051 … **NOTE: 10247/10249 are administratively Friedrichshain and 13051 Lichtenberg — included DELIBERATELY per Roman's routing policy ('when in doubt, include'); not an error to 'fix' later.** Policy recorded verbatim in docs/operations.md §7." — 8159 + 18 + 3 = 8180 ✓.

**Resolver** (`lib/plz-resolver.ts` L25–29): pure; sorts desc by priority, first range match wins; text comparison valid for zero-padded 5-digit PLZs. **Tests** (`tests/unit/plz-routing.test.ts`): pin priority-wins-on-overlap, order-independence, exact single-code matching, boundary inclusion, null→fallback. All fixtures are synthetic ids ('berlin', 'ffm') — **no prod UUID or the Pankow override is pinned**; note L126–128 still asserts "routes a Berlin Pankow PLZ (13187) to the Berlin office" against a city-only fixture — valid as a fixture but narratively stale vs. prod.

### 4. Case census

3 cases, **all 3 real** by the given pattern rule (no `@hzp-test.invalid`/`pw-*`/`verif+*` emails). 4th user `verif+202606281400@hzp-test.invalid` (test) has no case.

| Office                                    | Cases | Detail                                                                                                                                                                             |
| ----------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sozialamt Berlin (city, 0 doc rules)      | 2     | berk `c8542a35` bhakcil@gmail.com, plz 10245 (Friedrichshain), in_progress; rico `52e364f1` rico.schinzel@yahoo.de, plz 12687 (**Marzahn-Hellersdorf**), **under_review (locked)** |
| Sozialamt St. Wendel (…0232, 0 doc rules) | 1     | roman `adf1ad79` roman.pfeiffer@sorglosantrag.de (founder's own account), plz 66646, in_progress                                                                                   |
| Sozialamt Berlin-Pankow                   | **0** | —                                                                                                                                                                                  |

All three offices-of-record have zero document rules → all three cases are served the Pankow doc set via the app_config fallback (`lib/dal.ts` L319–334, `rulesSource='fallback'`, banner visible). Confirms the three known scout facts exactly.

### 5. resolvePlzAction — DECIDES #2

`app/case/actions.ts` L52–128: on a rule match it does `supabase.from('cases').update({ social_office_id: match.social_office_id, questionnaire_id, plz_before_move: plz, plz_resolution_status: 'resolved' }).eq('user_id', userId)` (L87–95); no-match path (L111–118) sets `questionnaire_id` to the Berlin default without touching `social_office_id`. So the action itself CAN overwrite the office — **but it is unreachable after first submission**: `PlzForm` renders only in the `!hasQuestionnaire` branch (`app/case/page.tsx` L32 `const hasQuestionnaire = !!caseData.questionnaire_id`, branch at L84, form at L146), and resolvePlzAction always sets `questionnaire_id` on both paths (L91, L114). Grep confirms `actions.ts` L90 is the **only** writer of `cases.social_office_id` in app code. **Conclusion: `social_office_id` is frozen at PLZ entry. A remap migration that should move existing cases MUST also `UPDATE public.cases` rows — nothing in the app will ever re-resolve them.** Corollaries: (a) rico (12687, locked) and berk (10245) will stay on the city-level office id unless the migration updates them; (b) `social_office.is_active` is checked NOWHERE in code (lib grep: the only `.eq('is_active', true)` in `lib/dal.ts` L56 is on questionnaire) — "deactivating" the city-level row is purely cosmetic today, while DELETING it would break the cases FK; the doc fallback keys off rule-count, not office activity, so cases parked on a rule-less office keep working either way.

**Bottom line for Batch C:** (1) executable today only as "Pankow keeps its 21, delete/deprioritize the 21 shadowed city rules"; routing the other 169 PLZs to district offices needs 11 new office rows plus an externally-sourced PLZ→district table; (2) any remap must include `UPDATE cases SET social_office_id …` for the 2 city-level cases if they are meant to move; (3) 13187/13189 already route to Pankow — correct the founder's premise before he plans around it.

---

# II. Authoritative Berlin district ↔ PLZ research (official geodata)

## SOURCES

1. **PRIMARY (authoritative, used for the full table): official Berlin geodata, computed intersection.**
   - PLZ polygons: Geoportal Berlin / Amt für Statistik Berlin-Brandenburg "Postleitzahlen" (RBS Postleitzahlgebiete), catalogued at https://daten.berlin.de/datensaetze/postleitzahlen-wfs, redistributed by ODIS Berlin (Technologiestiftung, Senatskanzlei-funded) https://daten.odis-berlin.de/de/dataset/plz/ — file used: https://tsb-opendata.s3.eu-central-1.amazonaws.com/plz/plz.geojson (193 unique PLZ).
   - Bezirk polygons: ALKIS Bezirksgrenzen, https://daten.odis-berlin.de/de/dataset/bezirksgrenzen/ — file used: https://tsb-opendata.s3.eu-central-1.amazonaws.com/bezirksgrenzen/bezirksgrenzen.geojson (12 Bezirke).
   - Method: scanline rasterization of both layers on a common ~27×28 m grid, cos-lat area-weighted shares. Script `plz_district.js` + full result `plz_district_result.json` in `C:\Users\Berk\AppData\Local\Temp\claude\C--Users-Berk-Desktop-hilfe-zur-pflege\88a923c1-be6a-46a6-9676-c65c3b46d6ed\scratchpad\`.
2. Cross-checks: plz-guru Pankow list (https://www.plz-guru.de/postleitzahl-plz-verzeichnis/berlin/stadtbezirk-pankow), suche-postleitzahl.org per-PLZ pages (…/plz-gebiet/10247, /13051, /13053, /13355), in-berlin-brandenburg.com full Bezirk table (https://www.in-berlin-brandenburg.com/Berliner_Bezirke/plz-berlin.html). No official berlin.de HTML _table_ of PLZ↔Bezirk exists; the geodata above IS the official assignment.

## OFFICIAL PANKOW SET (area share of each PLZ polygon inside Bezirk Pankow)

- **100% (or ~100%) Pankow (17):** 10405, 10407 (96.4%, rest = Volkspark Friedrichshain edge), 10409, 10437 (99.9%), 10439, 13086, 13088, 13089, 13125, 13127, 13129, 13156 (99.0%), 13158, 13159, 13187, 13189, and 10435 (79.1% Pankow / 20.9% Mitte — Schwedter Str./Mauerpark west strip).
- **Minority-Pankow border-spanners (4):** 10119 (25.2% Pankow / 74.8% Mitte), 10247 (14.4% Pankow / 85.6% Friedrichshain-Kreuzberg), 10249 (12.4% / 87.6% FK), 13051 (35.2% Pankow / 64.8% Lichtenberg — Pankow part = Blankenburg + Stadtrandsiedlung Malchow; largest settlement Neu-Hohenschönhausen is Lichtenberg; confirmed by suche-postleitzahl.org Ortsteil list).
- **Sliver-only (NOT in any directory's Pankow list):** 13053 (3.8% Pankow, unpopulated Malchow field edge; directories list only Alt-/Neu-Hohenschönhausen) and 13355 (4.0% Pankow, Mauerpark strip; directories list only Gesundbrunnen/Mitte).

## DIFF vs OUR MAPPED 21

- **(a) Pankow PLZs missing from our 21: NONE.** Our 21 = exactly the standard directory Pankow set (plz-guru lists the identical 21). Every majority-Pankow PLZ is mapped. Only the two negligible slivers 13053/13355 are absent — correctly so.
- **(b) Our 21 not officially Pankow: NONE are fully foreign, but 4 are minority-Pankow by area:** 10119, 10247, 10249, 13051 (shares above). They DO partly reach Pankow, so keeping them on the Pankow office is defensible but approximate: most residents of 10247/10249 live in Friedrichshain-Kreuzberg, most of 13051 in Lichtenberg, most of 10119 in Mitte. PLZ alone cannot discriminate at these borders — true jurisdiction follows the street address's Bezirk. Note suche-postleitzahl.org calls Prenzlauer Berg the "largest location" label for 10247 (label-level nuance, not an area claim); official geometry says FK 85.6%.
- **Founder premise check: "13189 is Pankow and unmapped" is half-false on today's prod.** 13189 is 100% Pankow (correct) but it IS mapped: Pankow rule prio 20 + city-level rule prio 1 → resolver already picks Pankow. Same for 13187.

## SANITY ANCHORS — all pass

12687 → Marzahn-Hellersdorf 100%. 10245 → Friedrichshain-Kreuzberg 100%. 13187 → Pankow 100%. 13189 → Pankow 100%.

## FULL BERLIN PLZ → BEZIRK (primary = largest area share; \* = split, see list below)

- **Mitte (19):** 10115, 10117, 10119*, 10178, 10179*, 10551, 10553*, 10555, 10557, 10559, 10785*, 10787*, 13347, 13349, 13351, 13353, 13355*, 13357, 13359
- **Friedrichshain-Kreuzberg (11):** 10243, 10245, 10247*, 10249*, 10961, 10963*, 10965*, 10967\*, 10969, 10997, 10999
- **Pankow (17):** 10405, 10407*, 10409, 10435*, 10437, 10439, 13086, 13088, 13089, 13125, 13127, 13129, 13156, 13158, 13159, 13187, 13189
- **Charlottenburg-Wilmersdorf (25):** 10585, 10587, 10589, 10623*, 10625, 10627, 10629, 10707, 10709, 10711, 10713, 10715, 10717, 10719, 10789*, 13627*, 14050, 14052, 14053, 14055, 14057, 14059, 14193*, 14197\*, 14199
- **Spandau (12):** 13581, 13583, 13585, 13587, 13589, 13591, 13593, 13595, 13597*, 13599*, 13629\*, 14089
- **Steglitz-Zehlendorf (17):** 12163*, 12165, 12167, 12169*, 12203, 12205, 12207, 12209, 12247, 12249*, 14109, 14129, 14163, 14165, 14167, 14169, 14195*
- **Tempelhof-Schöneberg (22):** 10777*, 10779*, 10781, 10783, 10823, 10825*, 10827, 10829, 12099, 12101, 12103, 12105, 12107*, 12109, 12157*, 12159, 12161*, 12277, 12279, 12305, 12307, 12309
- **Neukölln (16):** 12043, 12045, 12047, 12049, 12051, 12053, 12055, 12057, 12059, 12347\*, 12349, 12351, 12353, 12355, 12357, 12359
- **Treptow-Köpenick (16):** 12435, 12437, 12439, 12459, 12487, 12489, 12524, 12526, 12527, 12555, 12557, 12559, 12587, 12589, plus cross-Land slivers 15537*, 15569*
- **Marzahn-Hellersdorf (11):** 12619, 12621, 12623, 12627, 12629, 12679, 12681\*, 12683, 12685, 12687, 12689
- **Lichtenberg (12):** 10315, 10317, 10318, 10319, 10365, 10367, 10369, 13051*, 13053*, 13055, 13057\*, 13059
- **Reinickendorf (14):** 13403, 13405*, 13407*, 13409\*, 13435, 13437, 13439, 13465, 13467, 13469, 13503, 13505, 13507, 13509

**Split PLZs (secondary share >1%), full shares:** 10119 Mitte 74.8/Pankow 25.2; 10179 Mitte 98.5/FK 1.5; 10247 FK 85.6/Pankow 14.4; 10249 FK 87.6/Pankow 12.4; 10407 Pankow 96.4/FK 3.6; 10435 Pankow 79.1/Mitte 20.9; 10553 Mitte 97.2/CW 2.8; 10623 CW 92.3/Mitte 7.7; 10777 TS 76.2/CW 23.8; 10779 TS 71.5/CW 28.5; 10785 Mitte 90.6/FK 7.8/TS 1.6; 10787 Mitte 79.3/TS 17.2/CW 3.6; 10789 CW 60.6/TS 39.4; 10825 TS 95.3/CW 4.7; 10963 FK 97.2/Mitte 2.8; 10965 FK 45.6/TS 28.9/Neukölln 25.5; 10967 FK 77.9/Neukölln 22.1; 12107 TS 98.9/Neukölln 1.1; 12157 TS 75.2/SZ 24.8; 12161 TS 93.4/SZ 6.5; 12163 SZ 98.5/TS 1.5; 12169 SZ 94.2/TS 5.8; 12249 SZ 97.8/TS 2.2; 12347 Neukölln 98.9/TS 1.1; 12681 MH 97.5/Lichtenberg 2.5; 13051 Lichtenberg 64.8/Pankow 35.2; 13053 Lichtenberg 95.8/Pankow 3.8; 13057 Lichtenberg 94.6/MH 5.3; 13355 Mitte 96.0/Pankow 4.0; 13405 Reinickendorf 82.1/Mitte 17.9; 13407 Reinickendorf 94.3/Mitte 5.7; 13409 Reinickendorf 90.8/Mitte 9.2; 13597 Spandau 79.4/CW 20.6; 13599 Spandau 89.4/Reinickendorf 10.6; 13627 CW 96.4/Spandau 3.5; 13629 Spandau 63.9/Reinickendorf 19.8/CW 16.3; 14193 CW 96.0/SZ 4.0; 14195 SZ 88.2/CW 11.8; 14197 CW 94.2/TS 3.6/SZ 2.2.

## RECONCILIATION WITH PROD DUMP (dump_plz_rules.json)

- Official Berlin PLZ inventory = 193 codes. Prod coverage: 190 on city-level Berlin office + 21 on Pankow office (all 21 double-covered by city prio 1) + **3 codes NOT on any Berlin office: 15537, 15566, 15569 → routed to Sozialamt Oder-Spree (prio 1)**. These are Brandenburg-centered PLZs whose polygons clip marginally into Treptow-Köpenick (15566's Berlin share is below 28 m grid resolution ≈ 0 km²). Zero official Berlin PLZs lack a rule; zero Berlin-office rules point at non-existent codes.
- **Batch-C implication:** the 190-code city-level set decomposes cleanly by the table above (Mitte 19, FK 11, Pankow 17, CW 25, Spandau 12, SZ 17, TS 22, Neukölln 16, TK 14 + note the 3 Oder-Spree codes, MH 11, Lichtenberg 12, Reinickendorf 14). The only judgment calls are the 4 minority-Pankow codes (10119, 10247, 10249, 13051) currently on the Pankow office, plus deciding a policy for split codes generally (primary-district assignment recommended; per-address discrimination is out of scope of PLZ routing and should be flagged, not solved, in the report).

## DISAGREEMENTS / FLAGS

1. 10247/10249/13051/10119: mapped to Pankow in every directory (and our prod), but majority of area (and plausibly residents) lies in FK/FK/Lichtenberg/Mitte respectively. Split confirmed by two independent sources each.
2. 13053, 13355: official geometry shows 3.8%/4.0% Pankow slivers (unpopulated park/field edges); no directory assigns them to Pankow. Do not map to Pankow.
3. in-berlin-brandenburg.com lists 10317 also under Friedrichshain and 10369 under Pankow — official geometry shows <1% and <0.1% cross-shares respectively; treat both as directory noise (10317 = Lichtenberg, 10369 = Lichtenberg).
4. 15537/15566/15569: cross-Land PLZs (Oder-Spree, LOS) with marginal Berlin slivers — current Oder-Spree routing is a deliberate-looking, defensible choice; residents on the Berlin side of these codes (if any) would be misrouted, but the affected area is near-zero.
5. Shares are AREA shares from official polygons, not population shares — for 10119 in particular the Pankow quarter (Kollwitzkiez edge) is densely populated, so population share likely exceeds 25%.

---

# III–V. Remap proposal, draft migration, rico proof, R2, decisions

# Batch C — Berlin PLZ remap: proposal, draft migration, rico proof, R2 (read-only synthesis @ 4f21de8, prod dumps 2026-08-13)

**Premise correction, first:** the founder's premise "13189 is Pankow and unmapped" is **false on today's prod**. 13189 (and 13187) each carry a priority-20 Pankow rule that beats the priority-1 city rule; both already route to Sozialamt Berlin-Pankow. Verified against `dump_plz_rules.json`: 21 Pankow rules at prio 20, all 21 double-covered by prio-1 city rules. Please plan from that fact.

---

## 1. Remap proposal

### 1.1 Inventory (all counts re-verified against dumps)

- 8 180 rules total; **190** on Sozialamt Berlin (city, `10000000-0000-0000-0000-000000000001`), all priority 1, all single-PLZ; **21** on Sozialamt Berlin-Pankow (`11000000-0000-0000-0000-000000000001`), all priority 20.
- All 21 Pankow PLZs are shadow-duplicated by city rules. Net: 169 city rules live, 21 dead weight.
- **The other 11 Berlin district offices do not exist.** `dump_docrules.offices` (377 rows) contains exactly 2 Berlin-named offices (city + Pankow); name-search for Marzahn / Friedrichshain / Lichtenberg / Mitte / Neukölln / Spandau / Steglitz / Tempelhof / Treptow / Reinickendorf / Charlottenburg returns none (only false-positive "Mittelsachsen"/"Potsdam-Mittelmark"). Migration `20260615000001_real_plz_data.sql` deliberately erased the district concept. **The founder's end state therefore requires creating 11 new `social_office` rows** — flagged as Decision D-1.

### 1.2 Target mapping — the 190 city rules partition cleanly

Convention proposed (Decision D-2): **primary-district assignment** — each PLZ goes to the Bezirk holding the largest area share of its polygon (official Geoportal Berlin / ALKIS geometry). Per-address discrimination at borders is out of scope of PLZ routing; flagged, not solved. **Exception:** the 4 minority-Pankow codes 10119, 10247, 10249, 13051 keep their existing prio-20 Pankow rules, per Roman's recorded "when in doubt, include" policy (`20260723000002`, docs/operations.md §7 — deliberate, "not an error to fix later"). Overriding that policy is Decision D-3, not a default.

Partition (script-verified: 169 + 21 = 190, zero dupes, zero missing, zero extras):

| Target office (NEW unless noted)        | Count | PLZs                                                                                                                                                                          |
| --------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Delete (shadowed by Pankow prio 20)** | 21    | 10119, 10247, 10249, 10405, 10407, 10409, 10435, 10437, 10439, 13051, 13086, 13088, 13089, 13125, 13127, 13129, 13156, 13158, 13159, 13187, 13189                             |
| Berlin-Mitte                            | 18    | 10115, 10117, 10178, 10179, 10551, 10553, 10555, 10557, 10559, 10785, 10787, 13347, 13349, 13351, 13353, 13355, 13357, 13359                                                  |
| Berlin-Friedrichshain-Kreuzberg         | 9     | 10243, 10245, 10961, 10963, 10965, 10967, 10969, 10997, 10999                                                                                                                 |
| Berlin-Charlottenburg-Wilmersdorf       | 25    | 10585, 10587, 10589, 10623, 10625, 10627, 10629, 10707, 10709, 10711, 10713, 10715, 10717, 10719, 10789, 13627, 14050, 14052, 14053, 14055, 14057, 14059, 14193, 14197, 14199 |
| Berlin-Spandau                          | 12    | 13581, 13583, 13585, 13587, 13589, 13591, 13593, 13595, 13597, 13599, 13629, 14089                                                                                            |
| Berlin-Steglitz-Zehlendorf              | 17    | 12163, 12165, 12167, 12169, 12203, 12205, 12207, 12209, 12247, 12249, 14109, 14129, 14163, 14165, 14167, 14169, 14195                                                         |
| Berlin-Tempelhof-Schöneberg             | 22    | 10777, 10779, 10781, 10783, 10823, 10825, 10827, 10829, 12099, 12101, 12103, 12105, 12107, 12109, 12157, 12159, 12161, 12277, 12279, 12305, 12307, 12309                      |
| Berlin-Neukölln                         | 16    | 12043, 12045, 12047, 12049, 12051, 12053, 12055, 12057, 12059, 12347, 12349, 12351, 12353, 12355, 12357, 12359                                                                |
| Berlin-Treptow-Köpenick                 | 14    | 12435, 12437, 12439, 12459, 12487, 12489, 12524, 12526, 12527, 12555, 12557, 12559, 12587, 12589                                                                              |
| Berlin-Marzahn-Hellersdorf              | 11    | 12619, 12621, 12623, 12627, 12629, 12679, 12681, 12683, 12685, 12687, 12689                                                                                                   |
| Berlin-Lichtenberg                      | 11    | 10315, 10317, 10318, 10319, 10365, 10367, 10369, 13053, 13055, 13057, 13059                                                                                                   |
| Berlin-Reinickendorf                    | 14    | 13403, 13405, 13407, 13409, 13435, 13437, 13439, 13465, 13467, 13469, 13503, 13505, 13507, 13509                                                                              |

Multi-district per-PLZ calls baked into the table (all primary-share, official geometry): 10119→Mitte-primary but stays Pankow (policy); 10247/10249→FK-primary but stay Pankow (policy); 13051→Lichtenberg-primary but stays Pankow (policy); 13053 and 13355 have 3.8%/4.0% unpopulated Pankow slivers → Lichtenberg/Mitte (no directory calls them Pankow); 10435 (79% Pankow) already Pankow ✓; 13629→Spandau (63.9%); 10789→CW (60.6%); 10965→FK (45.6% plurality); 12157→TS (75.2%); 13405/13407/13409→Reinickendorf; 13597/13599→Spandau; 14195→SZ; 14193/14197→CW; 10777/10779→TS; 12681→MH; 13057→Lichtenberg. Also note: 15537/15566/15569 (Oder-Spree codes with near-zero Berlin slivers) are correctly on Sozialamt Oder-Spree and are **not touched**.

### 1.3 UPDATE vs DELETE+INSERT

**Recommended: guarded UPDATE of the 169 + guarded DELETE of the 21 shadowed duplicates** (house style: guarded UPDATEs with asserts).

- UPDATE preserves rule `id`s (`a0000000-…`) and `created_at`, keeping an auditable lineage to the `20260615000001` generation; the diff is exactly "social_office_id changed", nothing else.
- The 21 shadowed rules are deleted, not repointed: for the 17 fully-Pankow codes a repoint would create a second Pankow rule (prio 1 + prio 20) for the same PLZ; for the 4 policy codes the Pankow prio-20 rule is the deliberate winner and a dead prio-1 understudy only invites future confusion.
- DELETE+INSERT of all 190 would churn 190 ids for zero benefit and make the audit trail ("which rule moved where") reconstructible only from the migration text.
- Updated rules keep **priority 1** — they are single-PLZ rules with no competing range, and prio 20 continues to protect the 4 policy codes.

---

## 2. Draft migration (TEXT ONLY — not written to `supabase/migrations/`; requires founder approval of D-1..D-6 first)

German office names below are **placeholders**; per house rule 2, the co-founder must supply the real user-facing names before this ships. Migration-before-code ordering is trivially satisfied: no code change is required (no new columns; all code is already data-driven).

```sql
-- 2026XXXXXXXXXX_batch_c_berlin_district_remap.sql
-- Batch C: dissolve the city-level "Sozialamt Berlin" PLZ routing into the 11
-- missing district offices (Pankow already exists as 11000000-…-0001).
-- Read the plan in docs/… before applying. Founder-approved: D-1..D-6.
--
-- Effects: FUTURE cases only. cases.social_office_id is frozen at PLZ entry
-- (app/case/actions.ts L90 is the sole writer; PlzForm unreachable once
-- questionnaire_id is set). Existing-case backfill is Part C, separately gated.
-- New district offices have zero office_document_rule rows and zero
-- questionnaires, BY DESIGN: doc checklist degrades to the app_config default
-- (Pankow set, rulesSource='fallback', banner visible — lib/dal.ts L319-334),
-- questionnaire degrades to the Berlin default (D12, actions.ts L85).

BEGIN;

-- ── Part A: create the 11 missing district offices ─────────────────────────
-- Namespace: 11000000-… (Berlin districts), continuing the Pankow precedent;
-- the 10000000-… namespace is occupied by the nationwide seed (…0001..0376).
-- NAMES ARE PLACEHOLDERS — replace with founder-authored German names.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.social_office
             WHERE id BETWEEN '11000000-0000-0000-0000-000000000002'
                          AND '11000000-0000-0000-0000-000000000012') THEN
    RAISE EXCEPTION 'Batch C: district office id range already occupied';
  END IF;
END $$;

INSERT INTO public.social_office (id, name, is_active) VALUES
  ('11000000-0000-0000-0000-000000000002', 'Sozialamt Berlin-Mitte',                      true),
  ('11000000-0000-0000-0000-000000000003', 'Sozialamt Berlin-Friedrichshain-Kreuzberg',   true),
  ('11000000-0000-0000-0000-000000000004', 'Sozialamt Berlin-Charlottenburg-Wilmersdorf', true),
  ('11000000-0000-0000-0000-000000000005', 'Sozialamt Berlin-Spandau',                    true),
  ('11000000-0000-0000-0000-000000000006', 'Sozialamt Berlin-Steglitz-Zehlendorf',        true),
  ('11000000-0000-0000-0000-000000000007', 'Sozialamt Berlin-Tempelhof-Schöneberg',       true),
  ('11000000-0000-0000-0000-000000000008', 'Sozialamt Berlin-Neukölln',                   true),
  ('11000000-0000-0000-0000-000000000009', 'Sozialamt Berlin-Treptow-Köpenick',           true),
  ('11000000-0000-0000-0000-000000000010', 'Sozialamt Berlin-Marzahn-Hellersdorf',        true),
  ('11000000-0000-0000-0000-000000000011', 'Sozialamt Berlin-Lichtenberg',                true),
  ('11000000-0000-0000-0000-000000000012', 'Sozialamt Berlin-Reinickendorf',              true);

-- ── Part B: remap the 190 city-level PLZ rules ─────────────────────────────

DO $$
DECLARE
  n int;
  city constant uuid := '10000000-0000-0000-0000-000000000001';
  pankow constant uuid := '11000000-0000-0000-0000-000000000001';
BEGIN
  -- Pre-asserts: the world is exactly as surveyed on 2026-08-13.
  SELECT count(*) INTO n FROM public.postal_code_rule
    WHERE social_office_id = city;
  IF n <> 190 THEN RAISE EXCEPTION 'expected 190 city rules, found %', n; END IF;
  SELECT count(*) INTO n FROM public.postal_code_rule
    WHERE social_office_id = city AND priority <> 1;
  IF n <> 0 THEN RAISE EXCEPTION 'city rules at unexpected priority'; END IF;
  SELECT count(*) INTO n FROM public.postal_code_rule
    WHERE social_office_id = pankow AND priority = 20;
  IF n <> 21 THEN RAISE EXCEPTION 'expected 21 Pankow prio-20 rules, found %', n; END IF;

  -- B1: delete the 21 city rules shadowed by Pankow prio-20 rules.
  -- (17 fully-Pankow codes + 10119/10247/10249/13051 kept on Pankow per
  -- Roman's recorded "when in doubt, include" policy, docs/operations.md §7.)
  DELETE FROM public.postal_code_rule
   WHERE social_office_id = city
     AND plz_from IN ('10119','10247','10249','10405','10407','10409','10435',
                      '10437','10439','13051','13086','13088','13089','13125',
                      '13127','13129','13156','13158','13159','13187','13189');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 21 THEN RAISE EXCEPTION 'expected to delete 21 shadowed rules, deleted %', n; END IF;

  -- B2: repoint the remaining 169 rules to their primary district
  -- (largest-area-share Bezirk, official Geoportal Berlin/ALKIS geometry).
  -- Guarded UPDATEs preserve rule ids for auditability. Priority stays 1.

  UPDATE public.postal_code_rule SET social_office_id = '11000000-0000-0000-0000-000000000002'
   WHERE social_office_id = city AND plz_from IN
   ('10115','10117','10178','10179','10551','10553','10555','10557','10559',
    '10785','10787','13347','13349','13351','13353','13355','13357','13359');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 18 THEN RAISE EXCEPTION 'Mitte: expected 18, got %', n; END IF;

  UPDATE public.postal_code_rule SET social_office_id = '11000000-0000-0000-0000-000000000003'
   WHERE social_office_id = city AND plz_from IN
   ('10243','10245','10961','10963','10965','10967','10969','10997','10999');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 9 THEN RAISE EXCEPTION 'FK: expected 9, got %', n; END IF;

  UPDATE public.postal_code_rule SET social_office_id = '11000000-0000-0000-0000-000000000004'
   WHERE social_office_id = city AND plz_from IN
   ('10585','10587','10589','10623','10625','10627','10629','10707','10709',
    '10711','10713','10715','10717','10719','10789','13627','14050','14052',
    '14053','14055','14057','14059','14193','14197','14199');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 25 THEN RAISE EXCEPTION 'CW: expected 25, got %', n; END IF;

  UPDATE public.postal_code_rule SET social_office_id = '11000000-0000-0000-0000-000000000005'
   WHERE social_office_id = city AND plz_from IN
   ('13581','13583','13585','13587','13589','13591','13593','13595','13597',
    '13599','13629','14089');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 12 THEN RAISE EXCEPTION 'Spandau: expected 12, got %', n; END IF;

  UPDATE public.postal_code_rule SET social_office_id = '11000000-0000-0000-0000-000000000006'
   WHERE social_office_id = city AND plz_from IN
   ('12163','12165','12167','12169','12203','12205','12207','12209','12247',
    '12249','14109','14129','14163','14165','14167','14169','14195');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 17 THEN RAISE EXCEPTION 'SZ: expected 17, got %', n; END IF;

  UPDATE public.postal_code_rule SET social_office_id = '11000000-0000-0000-0000-000000000007'
   WHERE social_office_id = city AND plz_from IN
   ('10777','10779','10781','10783','10823','10825','10827','10829','12099',
    '12101','12103','12105','12107','12109','12157','12159','12161','12277',
    '12279','12305','12307','12309');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 22 THEN RAISE EXCEPTION 'TS: expected 22, got %', n; END IF;

  UPDATE public.postal_code_rule SET social_office_id = '11000000-0000-0000-0000-000000000008'
   WHERE social_office_id = city AND plz_from IN
   ('12043','12045','12047','12049','12051','12053','12055','12057','12059',
    '12347','12349','12351','12353','12355','12357','12359');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 16 THEN RAISE EXCEPTION 'NK: expected 16, got %', n; END IF;

  UPDATE public.postal_code_rule SET social_office_id = '11000000-0000-0000-0000-000000000009'
   WHERE social_office_id = city AND plz_from IN
   ('12435','12437','12439','12459','12487','12489','12524','12526','12527',
    '12555','12557','12559','12587','12589');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 14 THEN RAISE EXCEPTION 'TK: expected 14, got %', n; END IF;

  UPDATE public.postal_code_rule SET social_office_id = '11000000-0000-0000-0000-000000000010'
   WHERE social_office_id = city AND plz_from IN
   ('12619','12621','12623','12627','12629','12679','12681','12683','12685',
    '12687','12689');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 11 THEN RAISE EXCEPTION 'MH: expected 11, got %', n; END IF;

  UPDATE public.postal_code_rule SET social_office_id = '11000000-0000-0000-0000-000000000011'
   WHERE social_office_id = city AND plz_from IN
   ('10315','10317','10318','10319','10365','10367','10369','13053','13055',
    '13057','13059');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 11 THEN RAISE EXCEPTION 'Lichtenberg: expected 11, got %', n; END IF;

  UPDATE public.postal_code_rule SET social_office_id = '11000000-0000-0000-0000-000000000012'
   WHERE social_office_id = city AND plz_from IN
   ('13403','13405','13407','13409','13435','13437','13439','13465','13467',
    '13469','13503','13505','13507','13509');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 14 THEN RAISE EXCEPTION 'Reinickendorf: expected 14, got %', n; END IF;

  -- END-STATE ASSERT: zero PLZ rules reference the city-level office.
  SELECT count(*) INTO n FROM public.postal_code_rule
    WHERE social_office_id = city;
  IF n <> 0 THEN RAISE EXCEPTION 'city office still referenced by % rules', n; END IF;
END $$;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════
-- Part C — DO NOT APPLY WITH PARTS A/B. Ships only after (1) founder decides
-- the backfill question (D-5) and (2) Parts A/B are verified live.
-- ════════════════════════════════════════════════════════════════════════════
-- C1 (OPTIONAL, founder decision D-5): backfill the 2 existing cases parked on
-- the city office. cases.social_office_id is frozen — nothing in the app ever
-- re-resolves it (actions.ts L90 is the sole writer, unreachable post-submit).
-- User-visible effect: NONE (both target offices have zero doc rules; the
-- fallback checklist is byte-identical either way — see rico proof). Effect is
-- internal bookkeeping only. Note rico's case is under_review (locked).
--
-- BEGIN;
-- DO $$
-- DECLARE n int;
-- BEGIN
--   UPDATE public.cases SET social_office_id = '11000000-0000-0000-0000-000000000010'
--    WHERE id = '52e364f1-...' AND plz_before_move = '12687'
--      AND social_office_id = '10000000-0000-0000-0000-000000000001';  -- rico → Marzahn-Hellersdorf
--   GET DIAGNOSTICS n = ROW_COUNT;
--   IF n <> 1 THEN RAISE EXCEPTION 'rico backfill matched % rows', n; END IF;
--   UPDATE public.cases SET social_office_id = '11000000-0000-0000-0000-000000000003'
--    WHERE id = 'c8542a35-...' AND plz_before_move = '10245'
--      AND social_office_id = '10000000-0000-0000-0000-000000000001';  -- berk → Friedrichshain-Kreuzberg
--   GET DIAGNOSTICS n = ROW_COUNT;
--   IF n <> 1 THEN RAISE EXCEPTION 'berk backfill matched % rows', n; END IF;
-- END $$;
-- COMMIT;
--
-- C2 (ONLY AFTER PROOF — separate migration, after Parts A/B verified live AND
-- the backfill question is settled): deactivate the city-level row.
-- Prereqs asserted, not assumed:
--   * zero postal_code_rule rows reference it (Part B end-state assert),
--   * cases referencing it either backfilled (C1) or accepted as-is (FK
--     still valid; do NOT DELETE the row — cases.social_office_id and
--     questionnaire 30000000-…-0001 (the D12 product default) both FK to it).
-- Note: social_office.is_active is checked NOWHERE in app code (verified:
-- the only is_active filter in lib/dal.ts L56 is on questionnaire). This
-- flag is bookkeeping/hygiene, not behavior. The Berlin default
-- questionnaire keeps working regardless (its own is_active is separate).
--
-- BEGIN;
-- DO $$
-- DECLARE n int;
-- BEGIN
--   SELECT count(*) INTO n FROM public.postal_code_rule
--     WHERE social_office_id = '10000000-0000-0000-0000-000000000001';
--   IF n <> 0 THEN RAISE EXCEPTION 'city office still routed-to by % rules', n; END IF;
--   UPDATE public.social_office SET is_active = false
--    WHERE id = '10000000-0000-0000-0000-000000000001';
--   GET DIAGNOSTICS n = ROW_COUNT;
--   IF n <> 1 THEN RAISE EXCEPTION 'city office deactivation matched % rows', n; END IF;
-- END $$;
-- COMMIT;
```

---

## 3. Rico proof (computed, not assumed)

**Frozen-office finding first, because it gates everything:** `cases.social_office_id` is written exactly once, at PLZ entry (`app/case/actions.ts` L90 — grep-confirmed sole writer). `PlzForm` renders only while `!caseData.questionnaire_id` (`app/case/page.tsx` L32/L84/L146), and `resolvePlzAction` sets `questionnaire_id` on both paths (L91, L114), so the form is unreachable after first submission. **The remap (Parts A/B) therefore affects FUTURE cases only. Rico's and berk's rows keep the city-level office id unless the Part-C backfill ships — an explicit, separate founder decision (D-5).**

**Rico (`52e364f1`, rico.schinzel@yahoo.de, PLZ 12687, under_review/LOCKED):**

1. 12687 → Marzahn-Hellersdorf, 100.0% area share (official geometry; sanity anchor passed). Post-remap rule: → new MH office `11000000-…-0010`, prio 1, sole match.
2. MH office is created with **zero** `office_document_rule` rows (dump: only Pankow 50 and Essen 55 doc rules exist in the entire table).
3. `lib/dal.ts` L319–334: own-office rules = 0 → falls to `app_config.default_document_office_id` = Pankow (`11000000-…-0001`, set 2026-07-22); guard `defaultOffice !== socialOfficeId` passes → loads Pankow's 49 active rules → **`rulesSource='fallback'`**.
4. Therefore: **his checklist is byte-identical** (same Pankow-default rule set he sees today from the city office, which also has 0 rules), the **fallback banner STAYS**, and the **per-office period suffix stays suppressed** (commit 346bb08: fallback-served checklists drop the suffix). This holds **whether or not** the C1 backfill runs — city office and MH office are both rule-less, so the fallback path is identical from either.

**This contradicts the founder's stated expectation ("banner gone, suffix returns"). The post-remap behavior is the CORRECT one:** Marzahn-Hellersdorf genuinely has no authored document rule set, and the banner exists precisely to say "you are seeing the default set, not your office's own." Making the banner disappear by remap alone would be lying to the user. What WOULD make it disappear for rico — both founder decisions, not ours:

- (a) author a Marzahn-Hellersdorf rule set (`rulesSource='own'`, banner gone, suffix returns), or
- (b) deliberately map him to the Pankow office (then `socialOfficeId === Pankow`, own-office query returns 49 rules, `rulesSource='own'`, banner gone, suffix returns) — defensible only as an explicit policy call, since 12687 is not Pankow.

**Berk (`c8542a35`, bhakcil@gmail.com, PLZ 10245):** 10245 → Friedrichshain-Kreuzberg 100% → new FK office `11000000-…-0003` → zero doc rules → identical fallback chain → checklist byte-identical, banner stays, suffix suppressed. Same with/without backfill.

**Roman (`adf1ad79`, 66646 → Sozialamt St. Wendel `…-0232`):** entirely outside the remap; unchanged fallback behavior.

---

## 4. R2 real-data report for the draft migration

| Case                                          | Today                                                       | After Parts A/B               | After optional C1 backfill                                          | User-visible delta |
| --------------------------------------------- | ----------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------- | ------------------ |
| rico `52e364f1` (12687, under_review, LOCKED) | city office, fallback checklist + banner, suffix suppressed | **unchanged** (office frozen) | office id → MH `…-0010`; checklist/banner/suffix **byte-identical** | **NONE**           |
| berk `c8542a35` (10245, in_progress)          | city office, fallback + banner                              | **unchanged**                 | office id → FK `…-0003`; display identical                          | **NONE**           |
| roman `adf1ad79` (66646, in_progress)         | St. Wendel, fallback + banner                               | unchanged (out of scope)      | unchanged                                                           | **NONE**           |

- **Test-account impact: none.** The only test user (`verif+202606281400@hzp-test.invalid`) has no case.
- Future cases: a Berlin PLZ entered post-migration resolves to a district office; that office has no questionnaire, so D12 (actions.ts L85) assigns the Berlin default questionnaire `30000000-…-0001` — same questionnaire UX as today; checklist = Pankow fallback + banner — exactly the founder's intended "rule-less → fallback + banner is CORRECT" state. A Pankow-PLZ future case behaves exactly as today (prio-20 rules untouched).
- Rollback surface: Parts A/B touch only `social_office` (11 inserts) and `postal_code_rule` (21 deletes, 169 updates); no code deploy is coupled to it; inverse migration is mechanical.
- Note for the locked case: C1 changes a row of an under_review case. Since display is proven identical, it is safe, but it should be logged (consider a `status_event` insert alongside the backfill) — founder call.

---

## 5. Open decisions for the founder

- **D-1 — Create 11 district office rows** (they do not exist; the goal is not executable without them). Approve the `11000000-…-0002..0012` id block and supply the German user-facing office names (placeholders above; real Berlin naming is "Bezirksamt X von Berlin – Amt für Soziales" — co-founder authors this, per house rule 2).
- **D-2 — Multi-district convention:** primary-district (largest area share) assignment for split PLZs, as tabled in §1.2. PLZ routing cannot discriminate at street level; accepted as a known approximation.
- **D-3 — The 4 minority-Pankow codes** (10119 ~25% Pankow, 10247 ~14%, 10249 ~12%, 13051 ~35%): keep on Pankow per your recorded "when in doubt, include" policy (recommended — it is your documented deliberate choice), or reassign to their primary districts (Mitte / FK / FK / Lichtenberg)?
- **D-4 — Premise correction acknowledged:** 13187/13189 already route to Pankow today; no action item exists for them beyond deleting the shadowed prio-1 duplicates.
- **D-5 — Case backfill (Part C1):** move rico → MH and berk → FK office ids? Zero user-visible effect either way (proof in §3); pure internal bookkeeping, but rico's case is locked/under_review. Ship, or leave both parked on the (soon-inactive) city row?
- **D-6 — City-office deactivation (Part C2):** only after A/B verified live and D-5 settled. Note `is_active` is checked nowhere in code today — this is hygiene, not behavior — and the row must never be DELETEd (cases FK + the D12 default questionnaire FK to it).
- **D-7 (flag, no action):** expectation reset — for banner-gone/suffix-back in any district, someone must author that district's document rule set (or you accept fallback permanently). The remap alone changes no checklist anywhere, by design.
- **D-8 (flag, no action):** 15537/15566/15569 stay on Sozialamt Oder-Spree (near-zero-area Berlin slivers; defensible, on record).

Verification provenance: every count above re-computed this session from `dump_plz_rules.json` / `dump_docrules.json` / `dump_cases.json` / `dump_config.json` in `C:\Users\Berk\AppData\Local\Temp\claude\C--Users-Berk-Desktop-hilfe-zur-pflege\88a923c1-be6a-46a6-9676-c65c3b46d6ed\scratchpad` (partition check: 169 district + 21 shadowed = 190, zero dupes/missing/extras) and from repo files `lib/dal.ts` (L310–334), `app/case/actions.ts` (L52–128, sole `social_office_id` writer at L90, `DEFAULT_QUESTIONNAIRE_ID` L50), `app/case/page.tsx`. Geometry: official Geoportal Berlin PLZ polygons × ALKIS Bezirksgrenzen, scripts + full shares in the scratchpad (`plz_district.js`, `plz_district_result.json`).

---

# VI. Execution record (2026-08-13 evening — GOs received)

**All eight decisions GO (founder, 2026-08-13).** D-7 resolved as premise
error on the founder's side: 12687 is Marzahn-Hellersdorf, the report's
framing wins — rico correctly keeps banner + suppressed suffix; the live
check is rewritten to BYTE-IDENTICAL before/after. D-1 addendum: office
names = OFFICIAL designations ("Bezirksamt <X> von Berlin – Amt für
Soziales", source cited in the migration header), full list to Roman as
confirm-or-correct. D-4 addendum: per-row twin-guard before each of the 21
deletes. D-5 addendum: backfill ALL city-office cases, with `status_event`
audit rows; C1 ships as push 2 after A/B is live-verified. D-6: C1+C2 may
ride one push, C2's assert running after C1.

## VI.1 What shipped this session (push 1, awaiting founder)

`supabase/migrations/20260813000004_batch_c_berlin_district_remap.sql` —
Parts A/B exactly per the approved design: 11 offices (official names,
id block 0002..0012), 21 per-row twin-guarded deletes (D-4), 169 guarded
UPDATEs (D-2/D-3 partition unchanged), end-state asserts (0 city rules,
21 Pankow prio-20 untouched, 169 district rules, 8159 total). Data-only,
zero dependent code (R8 trivially satisfied).

**Execution-time re-verification (fresh prod dumps 2026-08-13 evening,
`census-batch-c.mjs` — ALL CHECKS PASS):** all §I counts re-confirmed
byte-for-byte (8180/190/21/partition/id-range-free/377 offices/doc-rule
census/app_config); Berlin default questionnaire re-confirmed anchored to
the city office and active (the C2 DELETE-forbidden anchor); in-memory
migration simulation re-ran the resolver over the post-state: 12687→MH,
10245→FK, 10115→Mitte, 13187/13189→Pankow, 10247/13051 stay Pankow,
45127 Essen / 21682 Stade / 12529 Dahme-Spreewald / 14467 Potsdam
untouched. A second adversarial pass (`xcheck-migration.mjs`) parsed the
migration SQL itself and compared every PLZ list, office id, name, and
asserted count against the prod-verified partition — symmetric copy errors
between lists are the one failure mode count-asserts cannot catch; zero
found. `npm run verify` green (incl. encoding guard over the umlaut names).

## VI.2 Drift on record (execution-time R2, does not block)

1. **Rico uploaded everything.** The §III/§IV "missing 3 (PAN-016/017/018)"
   premise is stale as of this evening: 19 uploads now cover all 17 slots →
   **missing = 0**, PAN-016/017/018 among the uploads. Legitimate user
   activity; nothing in the migration reads uploads. The identity proof was
   re-run at missing=0: slot set BYTE-IDENTICAL and missing count identical
   (0=0) under city office vs MH office. Live-check consequence: his locked
   card shows the STANDARD variant (not the docs variant), banner PRESENT,
   suffix SUPPRESSED — the byte-identical requirement is unchanged.
2. **A 4th case exists** (§I.4 said 3): `461038b0`,
   `pw-completion+…@hzp-test.invalid`, PLZ 10115, city office, under_review —
   the KEPT completion fixture from the round-2 close (on record there).
   TEST case. D-5's "backfill ALL cases currently on the city office"
   therefore covers **3 cases**: rico → MH `…-0010`, berk → FK `…-0003`,
   fixture → Mitte `…-0002`. A completion.spec re-seed between pushes would
   replace the fixture case (post-A/B it resolves 10115 → Mitte on its own);
   C1's exact-set assert would then abort for a trivial re-derive.
3. Roman's own case (`adf1ad79`, St. Wendel) now holds 1 upload (PAN-001,
   2026-08-12) — out of remap scope, recorded for completeness.

## VI.3 Push 2 — C1+C2 final draft (TEXT ONLY until A/B is live-verified)

One migration, C2's asserts after C1 (founder D-6). To be materialized as
`2026XXXXXXXXXX_batch_c_case_backfill_city_deactivation.sql` only after the
A/B live verification passes, with the case census re-derived at that time:

```sql
BEGIN;
-- C1 (D-5): backfill ALL cases parked on the city-level office.
-- Zero user-visible effect (both sides rule-less -> identical fallback
-- chain; re-proven at execution time). status_event audit rows document the
-- administrative write (append-only log; table takes free-form event_type).
DO $$
DECLARE
  n integer;
  city constant uuid := '10000000-0000-0000-0000-000000000001';
BEGIN
  -- exact-set pre-assert: exactly these 3 cases, else ABORT for re-derive
  SELECT count(*) INTO n FROM public.cases WHERE social_office_id = city;
  IF n <> 3 THEN RAISE EXCEPTION 'expected 3 city-office cases, found %', n; END IF;

  UPDATE public.cases SET social_office_id = '11000000-0000-0000-0000-000000000010'
   WHERE id = '52e364f1-e27e-4e79-b455-55d658e1be95'
     AND plz_before_move = '12687' AND social_office_id = city;      -- rico -> MH
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'rico backfill matched % rows', n; END IF;
  INSERT INTO public.status_event (case_id, event_type, payload) VALUES
    ('52e364f1-e27e-4e79-b455-55d658e1be95', 'social_office_backfilled',
     jsonb_build_object('from', city, 'to', '11000000-0000-0000-0000-000000000010',
       'plz', '12687', 'migration', 'batch_c_c1',
       'note', 'administrative remap, display-identical (fallback both sides), case locked'));

  -- berk -> FK …-0003 (10245) and fixture 461038b0 -> Mitte …-0002 (10115):
  -- same shape — id+plz+office-guarded UPDATE, 1-row assert, audit row each
  -- (fixture id re-derived at materialization time in case of re-seed).
  [...]

  SELECT count(*) INTO n FROM public.cases WHERE social_office_id = city;
  IF n <> 0 THEN RAISE EXCEPTION 'C1 end-state: % cases still on city office', n; END IF;
  RAISE NOTICE 'C1 applied: 3 cases backfilled, 0 remain on the city office';
END $$;

-- C2 (D-6): deactivate the city-level row — AFTER C1, asserts not assumed.
-- NEVER DELETE: cases.social_office_id history may reference it and the
-- Berlin default questionnaire 30000000-…-0001 FKs to it (verified active).
-- social_office.is_active is checked nowhere in app code — hygiene only.
DO $$
DECLARE
  n integer;
  city constant uuid := '10000000-0000-0000-0000-000000000001';
BEGIN
  SELECT count(*) INTO n FROM public.postal_code_rule WHERE social_office_id = city;
  IF n <> 0 THEN RAISE EXCEPTION 'C2 blocked: % PLZ rules still reference the city office', n; END IF;
  SELECT count(*) INTO n FROM public.cases WHERE social_office_id = city;
  IF n <> 0 THEN RAISE EXCEPTION 'C2 blocked: % cases still reference the city office', n; END IF;
  UPDATE public.social_office SET is_active = false
   WHERE id = city AND is_active = true;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'C2: deactivation matched % rows', n; END IF;
  RAISE NOTICE 'C2 applied: city-level office deactivated (row preserved for FK anchors)';
END $$;
COMMIT;
```

## VI.4 Live verification plan (rewritten per D-7 GO + drift)

After push 1 + data-level checks:

1. **rico BYTE-IDENTICAL** (read-only render check, zero writes): banner
   PRESENT, "(letzte 4 Monate)" suffix SUPPRESSED, slot set (17) and
   missing count (**0** — drift on record) identical to the pre-push
   computation; locked card = STANDARD variant.
2. Fresh throwaway, non-Pankow Berlin PLZ: case row records the NEW
   district office id; checklist = fallback + banner (UX unchanged,
   bookkeeping corrected).
3. 13187 throwaway: Pankow own list, NO banner, suffix PRESENT — unchanged.
4. 45127 Essen + 21682 Stade: untouched.
5. Throwaways deleted, leak sweep zero debris.

Then push 2 (C1+C2), post-push: rico/berk/fixture office ids moved, audit
rows present, rico's render STILL byte-identical from the MH office, city
office inactive with zero references. Close-out: milestone log, state file,
ClickUp two-liner, ledger refresh (all queued per the founder brief).
