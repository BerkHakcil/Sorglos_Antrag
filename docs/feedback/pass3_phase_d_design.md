# Feedback Pass 3 — Phase D-1 design (storage restructure)

> **Design gate. Nothing here is implemented.** No migration file, no code,
> no writes. Produced 2026-07-30 read-only against prod.
> Awaiting founder approval of (a) the 43-doc category mapping and (b) the
> path/numbering scheme before D-2 begins.
>
> Basis: pass-brief D5 — restructure applies to **NEW uploads only**; the
> existing files stay where they are, no move/rename script.

## ✅ APPROVED 2026-07-30 — amendments folded in

1. **`document_filename_seq` gets `case_id UUID REFERENCES cases(id) ON
DELETE CASCADE`** — counter rows are case-scoped, GDPR-relevant metadata
   and must die with the case. `operations.md` §4 notes the cascade.
2. **Mapping flips:** DOC-0008 Bisherige Heimrechnungen **Housing →
   Financial** (Roman's definition lists invoices there). Deliberate
   **contract/invoice split**: DOC-0007 Heimvertrag **stays Housing**.
   ⚠ The catalog holds exactly **one** Heimrechnungen row (DOC-0008) —
   there is no separate "Heimrechnung" type to flip. DOC-0005 → Insurance,
   DOC-0030 → Housing, DOC-0015 stays Insurance, DOC-0016 stays Personal
   (all as originally proposed).
   **Category assignment is FORWARD-ONLY**: re-categorising later moves
   only future uploads; stored files keep their path and their counter
   continues in the old folder's scope.
3. **Filename format confirmed as proposed.** Commit B additionally
   defines the **no-extension fallback** and documents two accepted quirks
   (§6.3, §6.4).
4. **Commit A = migration only** → `20260730000004_document_storage_category_and_filename_seq.sql`.
   Commit B stays local and unpushed until the migration is verified on
   prod (CLAUDE.md #8).
5. Commit B carries four **additional** test groups (§10, items 14–17).

> ⚠ **Correction to §3 below.** The totals I first published
> (Personal 13 · Housing 7 · Financial 16 · Insurance 7 = 43) were
> **miscounted** — they do not sum to 43 and misstated two buckets. The
> mapping rows themselves were right. Verified counts, after the approved
> DOC-0008 flip: **Personal 11 · Housing 7 · Financial 16 · Insurance 9**.
> The migration asserts exactly this distribution and aborts otherwise, and
> a partition check confirmed all 43 ids appear exactly once.

## 0. What this phase changes / does not change

|                     |                                                                                                                                                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Changes**         | the storage path of **future** uploads; adds one catalog column + one counter table; three call sites that build or consume paths                                                                        |
| **Does not change** | the 14 existing files (grandfathered), the upload security model (server-minted signed URLs, private bucket, 60 s downloads), storage RLS policies, the checklist/evaluator, any German user-facing copy |

---

## 1. Rollout order — first application of CLAUDE.md rule #8

This phase adds `document_catalog.storage_category` **and** upload code that
reads it. Per the rule adopted in Phase C, the column must exist on prod
**before** any code referencing it is deployed. Sequence:

| Step | Action                                                                                                                                                                            | Gate                                                                                             |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1    | **Commit A — migration only** (`…_storage_category_and_filename_seq.sql`): adds the column, backfills all 43 rows, creates the counter table. Contains **zero** application code. | I push commit A; the deploy it triggers is a no-op for behaviour (no code reads the column yet). |
| 2    | Founder runs `supabase db push`                                                                                                                                                   | **STOP** — I wait.                                                                               |
| 3    | I verify on prod: column present + all 43 rows non-null, counter table present and empty, `verify-baseline` green                                                                 | **STOP** — reported to founder.                                                                  |
| 4    | **Commit B — code** (path builder, `recordUploadAction` fix, `case-export` naming, tests). **Held locally, unpushed, until step 3 passes.**                                       | pushing = deploying, so B is not pushed a moment earlier.                                        |
| 5    | Live upload test on prod with a throwaway account, then close-out commit                                                                                                          | —                                                                                                |

**Staging discipline:** the two commits are authored separately from the
start; commit B is never `git add`-ed into commit A, and I do not run
`git push` for B until step 3 is confirmed. If anything in step 3 fails,
commit B stays unpushed and we fix forward in commit A's successor.

Note the asymmetry that makes this safe in the other direction: **old code
tolerates the new column** (it selects `*` and ignores unknown fields), so
the window between step 2 and step 4 is behaviourally inert.

---

## 2. Schema changes (both additive, one migration)

### 2.1 `document_catalog.storage_category`

```sql
ALTER TABLE public.document_catalog
  ADD COLUMN storage_category TEXT;          -- nullable during backfill
-- 43 UPDATEs (§3 mapping)
ALTER TABLE public.document_catalog
  ALTER COLUMN storage_category SET NOT NULL;
ALTER TABLE public.document_catalog
  ADD CONSTRAINT document_catalog_storage_category_check
  CHECK (storage_category IN ('Personal','Housing','Financial','Insurance'));
```

Order inside the file: add nullable → backfill → assert no NULLs → `SET NOT
NULL` + CHECK. An assertion block (as in Phase C) raises if any row is
still NULL or the row count ≠ 43.

**Why only four values:** `Spouse` is **not a property of a document** — the
same Personaldokument is Personal for the applicant and Spouse for the
partner. Spouse is produced exclusively by the person_2 override at upload
time (§4). Putting it in the catalog would be unrepresentable.

### 2.2 `document_filename_seq` (numbering, §5)

```sql
CREATE TABLE public.document_filename_seq (
  case_id UUID    NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  folder  TEXT    NOT NULL,       -- 'Personal' | 'Housing' | 'Financial' | 'Insurance' | 'Spouse'
  base    TEXT    NOT NULL,       -- sanitized filename base incl. instance label
  last_n  INTEGER NOT NULL,
  PRIMARY KEY (case_id, folder, base)
);
ALTER TABLE public.document_filename_seq ENABLE ROW LEVEL SECURITY;
-- deliberately NO policies: server-only table, reached with the service-role
-- client after the ownership check (same pattern as status_event writes).
```

`ON DELETE CASCADE` on `cases` keeps GDPR deletion complete.

---

## 3. The 43-doc category mapping — **FOR YOUR APPROVAL**

Roman's five folders: **Personal, Housing, Financial, Insurance, Spouse**
(Spouse via override only). Proposed `storage_category` per catalog row;
the last column is the filename base produced by the §6 sanitizer.

| DOC  | name_de                                                          | today's `category` | **proposed folder**      | filename base                                                 |
| ---- | ---------------------------------------------------------------- | ------------------ | ------------------------ | ------------------------------------------------------------- |
| 0001 | Personaldokument                                                 | person             | **Personal**             | `Personaldokument`                                            |
| 0002 | Renten/Pensionsbescheid                                          | income             | **Financial**            | `RentenPensionsbescheid`                                      |
| 0003 | Kontoauszüge                                                     | assets             | **Financial**            | `Kontoauszuege`                                               |
| 0004 | Pflegegutachten MDK                                              | person             | **Personal**             | `PflegegutachtenMDK`                                          |
| 0005 | Leistungsbescheid Pflegekasse                                    | person             | **Insurance** ⚠          | `LeistungsbescheidPflegekasse`                                |
| 0006 | Vertretungsvollmacht / Betreuungsnachweis                        | person             | **Personal**             | `VertretungsvollmachtBetreuungsnachweis`                      |
| 0007 | Heimvertrag                                                      | expenses           | **Housing**              | `Heimvertrag`                                                 |
| 0008 | Bisherige Heimrechnungen                                         | expenses           | **Financial** ✅ flipped | `BisherigeHeimrechnungen`                                     |
| 0009 | Nachweis Bedarfsanzeige                                          | person             | **Personal**             | `NachweisBedarfsanzeige`                                      |
| 0010 | Polizeiliche Anmeldung im Heim                                   | person             | **Housing** ⚠            | `PolizeilicheAnmeldungImHeim`                                 |
| 0011 | Mobilitätsnachweis                                               | person             | **Personal**             | `Mobilitaetsnachweis`                                         |
| 0012 | Krankenversicherungskarte                                        | person             | **Insurance**            | `Krankenversicherungskarte`                                   |
| 0013 | Lebensversicherung                                               | expenses           | **Insurance**            | `Lebensversicherung`                                          |
| 0014 | Sterbeversicherung                                               | expenses           | **Insurance**            | `Sterbeversicherung`                                          |
| 0015 | Bestattungsvorsorgevertrag                                       | assets             | **Insurance** ⚠          | `Bestattungsvorsorgevertrag`                                  |
| 0016 | Sterbeurkunde Partner                                            | person             | **Personal** ⚠           | `SterbeurkundePartner`                                        |
| 0017 | Aufenthaltsstatus                                                | person             | **Personal**             | `Aufenthaltsstatus`                                           |
| 0018 | Schwerbehindertenausweis                                         | person             | **Personal**             | `Schwerbehindertenausweis`                                    |
| 0019 | Haftpflichtversicherung                                          | expenses           | **Insurance**            | `Haftpflichtversicherung`                                     |
| 0020 | Wohngeldbescheid                                                 | income             | **Financial** ⚠          | `Wohngeldbescheid`                                            |
| 0021 | Heimatvertriebener/Spätaussiedler Nachweis                       | person             | **Personal**             | `HeimatvertriebenerSpaetaussiedlerNachweis`                   |
| 0022 | Scheidungsurkunde                                                | person             | **Personal**             | `Scheidungsurkunde`                                           |
| 0023 | Leistungsnachweis Sozialhilfe                                    | person             | **Financial**            | `LeistungsnachweisSozialhilfe`                                |
| 0024 | Mietvertrag                                                      | expenses           | **Housing**              | `Mietvertrag`                                                 |
| 0025 | Mietkündigungsnachweis                                           | expenses           | **Housing**              | `Mietkuendigungsnachweis`                                     |
| 0026 | Nachweis anderes Einkommen                                       | income             | **Financial**            | `NachweisAnderesEinkommen`                                    |
| 0027 | KFZ Versicherung                                                 | expenses           | **Insurance**            | `KFZVersicherung`                                             |
| 0028 | KFZ Fahrzeugbrief                                                | assets             | **Financial** ⚠          | `KFZFahrzeugbrief`                                            |
| 0029 | KFZ Wertnachweis                                                 | assets             | **Financial**            | `KFZWertnachweis`                                             |
| 0030 | Nachweis Immobilienwert                                          | assets             | **Housing** ⚠            | `NachweisImmobilienwert`                                      |
| 0031 | Nachweis Rentenantragstellung                                    | income             | **Financial**            | `NachweisRentenantragstellung`                                |
| 0032 | Bescheid Arbeitslosengeld/JobCenter/Bürgergeld                   | income             | **Financial**            | `BescheidArbeitslosengeldJobCenterBuergergeld`                |
| 0033 | Bescheid Grundrentenzuschlag oder Grundrentenzeiten              | income             | **Financial**            | `BescheidGrundrentenzuschlagOderGrundrentenzeiten`            |
| 0034 | Krankengeldbescheid                                              | income             | **Financial** ⚠          | `Krankengeldbescheid`                                         |
| 0035 | Lohnbescheinigung                                                | income             | **Financial**            | `Lohnbescheinigung`                                           |
| 0036 | Beitragsbescheid freiwillige/private Kranken-/Pflegeversicherung | health             | **Insurance**            | `BeitragsbescheidFreiwilligePrivateKrankenPflegeversicherung` |
| 0037 | Finanzstatus/Saldenübersicht                                     | assets             | **Financial**            | `FinanzstatusSaldenuebersicht`                                |
| 0038 | Eigentumsnachweis                                                | housing            | **Housing**              | `Eigentumsnachweis`                                           |
| 0039 | Nachweis ausländische Krankenversicherung                        | health             | **Insurance**            | `NachweisAuslaendischeKrankenversicherung`                    |
| 0040 | Nachweise Auslandstätigkeit/Rentenbeiträge                       | income             | **Financial**            | `NachweiseAuslandstaetigkeitRentenbeitraege`                  |
| 0041 | Nachweise sonstiges Vermögen                                     | assets             | **Financial**            | `NachweiseSonstigesVermoegen`                                 |
| 0042 | Übertragungsvertrag mit Grundbuchauszug                          | assets             | **Housing** ⚠            | `UebertragungsvertragMitGrundbuchauszug`                      |
| 0043 | Unterhaltsurteil/Titel/Urkunde                                   | person             | **Personal** ⚠           | `UnterhaltsurteilTitelUrkunde`                                |

Totals (corrected + post-flip, asserted by the migration):
**Personal 11 · Housing 7 · Financial 16 · Insurance 9 = 43.**

### ⚠ The ten genuinely ambiguous calls (your decision)

| DOC                                        | Proposed  | The tension                                                                                                                                   |
| ------------------------------------------ | --------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 0005 Leistungsbescheid Pflegekasse         | Insurance | issued _by_ an insurer, but it is a benefits decision → could be Financial                                                                    |
| 0008 Bisherige Heimrechnungen              | Housing   | invoices (Financial) vs. keeping the whole Heim dossier together (Housing)                                                                    |
| 0010 Polizeiliche Anmeldung im Heim        | Housing   | proves _residence_ (Housing) vs. an official personal record (Personal)                                                                       |
| 0015 Bestattungsvorsorgevertrag            | Insurance | legally an **asset** (Financial), but sits beside Sterbeversicherung                                                                          |
| 0016 Sterbeurkunde Partner                 | Personal  | it concerns the partner, but the **subject is person_1** — it must NOT land in Spouse/                                                        |
| 0020 Wohngeldbescheid                      | Financial | it is income (Financial) despite the "Wohn-" name                                                                                             |
| 0028/0029 KFZ Fahrzeugbrief / Wertnachweis | Financial | asset proof (Financial) vs. a vehicle dossier next to KFZ-Versicherung (Insurance)                                                            |
| 0030 Nachweis Immobilienwert               | Housing   | means-tested **Vermögen** (Financial) vs. consistency with 0038 Eigentumsnachweis, which Roman's own Essen file already categorised `housing` |
| 0034 Krankengeldbescheid                   | Financial | sick pay is income, though it comes from the health insurer                                                                                   |
| 0042 Übertragungsvertrag + Grundbuchauszug | Housing   | property/land-register (Housing) vs. asset transfer (Financial)                                                                               |

My recommendation is the table as proposed — it optimises for "a clerk
opening one folder finds the whole topic". Say the word on any row and I
flip it before the migration is written. **Roman gets the final mapping as
FYI only** (package item, after your approval).

---

## 4. Path scheme

```
{case_id}/{Folder}/{Base}{n}.{ext}
```

- `{case_id}` — unchanged first segment (**required**: storage RLS keys on it).
- `{Folder}` — `storage_category` of the slot's document, **overridden to
  `Spouse` whenever the slot's `subject === 'person_2'`**, regardless of
  catalog category. `subject === 'previous_home'` (Mietvertrag,
  Mietkündigung) is **not** overridden — it maps by catalog category
  (Housing), which is where those documents belong anyway.
- `{Base}{n}` — §6 / §5.
- `{ext}` — §6.

Examples:

```
2c8a…/Personal/Personaldokument1.jpeg
2c8a…/Financial/Kontoauszuege_Girokonto1.pdf
2c8a…/Financial/Kontoauszuege_Girokonto2.pdf
2c8a…/Financial/RentenPensionsbescheid_Rente1Altersrente1.pdf
2c8a…/Housing/Heimvertrag1.pdf
2c8a…/Spouse/Personaldokument1.heic          ← person_2, same document type
```

---

## 5. Numbering — durability, atomicity, no reuse

**Source of truth: the database, never a storage listing.** (A listing is
eventually consistent, hides nothing about deleted files, and would reuse
numbers.)

**Scope of a counter:** `(case_id, folder, base)`. Because the folder is
part of the key, `Personal/Personaldokument1` and `Spouse/Personaldokument1`
**coexist**, each starting at 1 — exactly the requirement. Because the base
includes the instance label, `Kontoauszuege_Girokonto1` and
`Kontoauszuege_Sparkonto1` also coexist and each numbers independently.

**Mechanism — one atomic upsert, no retry loop needed:**

```sql
INSERT INTO public.document_filename_seq AS s (case_id, folder, base, last_n)
VALUES ($1, $2, $3, 1)
ON CONFLICT (case_id, folder, base)
DO UPDATE SET last_n = s.last_n + 1
RETURNING last_n;
```

A single statement takes a row lock on conflict, so two concurrent uploads
to the same slot get 1 and 2 — never the same number. Executed with the
service-role client **after** `ownCase()` has verified the caller owns the
case (same pattern as the existing `status_event` writes).

**No-reuse rule:** the counter only ever increments. `deleteUploadAction`
deliberately does **not** touch `document_filename_seq`, so deleting
`Heimvertrag2.pdf` leaves the next upload at `Heimvertrag3.pdf`. This is
`max(n) over everything ever created for the scope`, which is stronger than
`max over surviving rows` and is what prevents a deleted file's name from
being silently re-bound to a different document.

**Belt and braces:** `document_upload.storage_path` already carries a
`UNIQUE` constraint. The insert is therefore a second, independent guard —
if a path were ever duplicated the metadata insert fails loudly instead of
silently shadowing a file. (The allocation happens _before_ the signed URL
is minted, so a duplicate PUT overwriting an object cannot occur.)

**Accepted consequence:** a minted-but-abandoned upload (user closes the tab
before the PUT) burns its number, leaving a gap — `…1, …3`. Gaps are
harmless and preferable to reuse. This is the existing "orphaned object"
class of behaviour, already documented as accepted in M5.

---

## 6. Filename base, instance labels, sanitization

### 6.1 Base

`Base = Sanitize(document_catalog.name_de)` and, when the slot carries an
`instanceLabel`, `Base = Sanitize(name_de) + "_" + Sanitize(instanceLabel)`.

Instance labels come from the evaluator (`lib/document-rules.ts`):

| Binding                     | Label produced                                    | Sanitized            |
| --------------------------- | ------------------------------------------------- | -------------------- |
| bank giro                   | `Girokonto`                                       | `Girokonto`          |
| bank savings                | `Sparkonto`                                       | `Sparkonto`          |
| additional account          | the user-typed bank name, e.g. `Sparkasse Berlin` | `SparkasseBerlin`    |
| additional account, unnamed | `Weiteres Konto`                                  | `WeiteresKonto`      |
| pension                     | `Rente 1: Altersrente`                            | `Rente1Altersrente`  |
| other income                | `Einkommen 2: Nebenjob`                           | `Einkommen2Nebenjob` |

→ `Kontoauszuege_Girokonto1.pdf`,
`RentenPensionsbescheid_Rente1Altersrente1.pdf` (per-pension, as required).

⚠ Bank names are **user-typed free text** — they must go through the same
sanitizer and the 30-char cap (a hostile or emoji-laden name must not reach
the storage key).

### 6.2 Sanitization spec

Applied to the type name and, separately, to the instance label:

1. **German umlauts transliterated** — `ä→ae ö→oe ü→ue Ä→Ae Ö→Oe Ü→Ue
ß→ss`. ⚠ **This is filenames only.** It is the deliberate inverse of
   house rule R3 (which forbids touching `ß` in DB copy) and does not
   contradict it: the DB keeps `Kontoauszüge`, the object key gets
   `Kontoauszuege`. Roman's checklist text is unaffected.
2. **Other diacritics stripped** — NFD normalise, drop combining marks
   (`é→e`, `ç→c`).
3. **Word split on every non-alphanumeric** (space, `/`, `-`, `.`, `:`,
   `,`, `(`, `)`, `&`, `+`, quotes, control chars, path separators…), each
   word capitalised, joined with **no separator** → `Renten/Pensionsbescheid`
   → `RentenPensionsbescheid`; `Pflegegutachten MDK` → `PflegegutachtenMDK`.
   This removes every character that is unsafe in a storage key or a URL in
   one rule, rather than enumerating a blocklist.
4. **Case policy: preserve German capitalisation, do not lowercase.**
   Readability for the reviewing clerk is the point of this phase, and it
   matches Roman's own examples (`Heimvertrag1.pdf`). The **extension is
   lowercased**.
5. **Length caps:** type base ≤ 60 chars, instance label ≤ 30, truncated at
   the last internal capital where that keeps ≥ 60 % of the cap. Longest
   real value today is 58 (`Beitragsbescheid…Pflegeversicherung`) — under
   the cap unchanged.
6. **Empty-result fallback:** if sanitisation yields `""` (a name of only
   punctuation), fall back to `document_catalog.technical_key` (ASCII by
   construction), then to the `DOC-####` id.

### 6.3 Extension (+ approved no-extension fallback)

Taken from the **original filename**, lowercased, validated against the
existing allow-list `pdf|jpe?g|png|heic|heif` — the same `EXT_RE` the
upload action already enforces. `.jpeg` is **not** normalised to `.jpg`
(Roman's example `Heimvertrag2.jpeg` keeps the user's extension). The
allow-list is re-checked server-side before the key is built, so an
extension can never inject a path segment.

**No-extension fallback (commit B).** Today `createUploadUrlAction` rejects
a filename that fails `EXT_RE`, so an extensionless file never reaches the
key builder. Commit B keeps that guard and adds a defensive fallback for
the key itself, in this order:

1. extension from the original filename (allow-listed) — the normal path;
2. else derive from the **validated MIME type** (`application/pdf → pdf`,
   `image/jpeg → jpg`, `image/png → png`, `image/heic → heic`,
   `image/heif → heif`) — this is the M5 desktop-HEIC situation, where the
   browser reports an empty `file.type` or the name carries no suffix;
3. else **omit the extension entirely** (`Heimvertrag1`), never invent one.

The object's real content type is set on the PUT regardless, so an
extensionless key still downloads correctly.

### 6.4 Accepted quirks (documented, not fixed)

1. **Burned numbers on abandoned uploads.** The counter is allocated when
   the signed URL is minted, so a user who closes the tab before the PUT
   completes consumes a number: the sequence can read `…1, …3`. Gaps are
   harmless and strictly preferable to reuse — this is the same accepted
   class as the M5 "orphaned storage object".
2. **Double-number instance labels.** A per-instance slot whose label
   already contains an ordinal produces two digits:
   `RentenPensionsbescheid_Rente1Altersrente1.pdf` — "pension entry 1,
   file 1". Deliberate: the first number identifies _which pension_, the
   trailing one _which file for that pension_. Stripping either would make
   two pensions of the same type indistinguishable in the folder.

---

## 7. Grandfathering — proof that the 14 existing files keep working

No consumer recomputes a path; every read goes through the **stored**
`document_upload.storage_path`:

| Flow                | Code                                                                | Path source                                                   |
| ------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------- |
| Checklist rendering | `document-area.tsx` `filesFor(slot)`                                | joins on `(rule_id, instance_key)` — the path is never parsed |
| Download            | `createDownloadUrlAction` → `createSignedUrl(row.storage_path, 60)` | **stored**                                                    |
| Delete              | `deleteUploadAction` → `remove([row.storage_path])`                 | **stored**                                                    |
| Ops export          | `case-export.mjs` → `download(u.storage_path)`                      | **stored**                                                    |
| GDPR deletion       | operations.md §4 iterates `storage_path` rows                       | **stored**                                                    |

The **only** path-constructing site is `createUploadUrlAction` (new uploads
only). Therefore old `{case}/{uuid}.{ext}` objects keep resolving unchanged,
and a case can hold both schemes side by side indefinitely. A regression
test will assert exactly this (a legacy-shaped row still downloads/deletes).

---

## 8. Adjacent paths

### 8.1 ⚠ `recordUploadAction` must be fixed (bug found in this design pass)

It currently verifies the object landed with:

```ts
const dir = caseRow.id
const base = input.path.slice(dir.length + 1)
await supabase.storage.from(BUCKET).list(dir, { search: base })
```

With a nested key, `base` becomes `Personal/Personaldokument1.pdf` and
`list('{case_id}', { search: … })` lists only the case's **top level** —
the search would never match and **every upload would fail the verify
step**. Fix: split on the **last** `/` (`dir = path.slice(0, lastSlash)`,
`base = path.slice(lastSlash + 1)`). The ownership guard
(`input.path.startsWith(caseRow.id + '/')`) is unaffected and still correct.
This is part of commit B.

### 8.2 `case:export` naming (no double prefixing)

Current: `${rule_id}_${instance_key}_${original_filename}` →
`PAN-001_default_gisma_logo.jpeg`.

Proposed: **derive from the stored key, not from the rule.**

- New-scheme path (≥ 3 segments): use `{Folder}_{basename}` →
  `Personal_Personaldokument1.jpeg`, `Spouse_Personaldokument1.heic`.
  The folder prefix is **required**, not decoration: `files/` is flat, and
  `Personal/Personaldokument1.pdf` and `Spouse/Personaldokument1.pdf` would
  otherwise collide in the export directory.
- Legacy path (2 segments, UUID name): keep today's
  `{rule}_{instance}_{original}` naming, which is the only readable option
  for those.

No rule id or instance key is prepended to a new-scheme name — that is the
"double prefixing" to avoid.

### 8.3 GDPR deletion + orphan sweep

The primary loop iterates `document_upload.storage_path` and is
**unaffected** (stored paths, any depth). ⚠ One documentation fix needed:
the runbook's secondary step ("also list the prefix directly to catch
orphans … `<case_id>/` in the dashboard") now has to **descend into the
category subfolders** — a single-level listing shows folders, not files.
`operations.md` §4 gets that sentence, and `document_filename_seq` rows
disappear via `ON DELETE CASCADE` on the case.

### 8.4 Storage RLS — confirmed untouched

All three policies gate on `(storage.foldername(name))[1] IN (SELECT id::text
FROM cases WHERE user_id = auth.uid())`. For `{case}/{Folder}/{file}`,
`storage.foldername()` returns `{case, Folder}` and `[1]` is still the case
id. **Nested folders need no policy change** — the isolation proof from the
M7 audit carries over verbatim. Supabase Storage prefixes are virtual, so
no folder objects are created and no plan limit applies.

### 8.5 Test cleanup

The e2e suites clean up by listing the case prefix (`documents-m6` removed
17 objects this round). That listing must recurse into category folders or
it will silently leave objects behind → update the cleanup helper in
commit B, and assert "prefix empty" recursively.

---

## 9. Real-Data report (R2) — the backfill

| Object                              | Rows touched                                                       | Real vs test                                 |
| ----------------------------------- | ------------------------------------------------------------------ | -------------------------------------------- |
| `document_catalog.storage_category` | **43 UPDATEs** — config/content rows, authored by us, no user data | n/a — zero user-owned rows                   |
| `document_filename_seq`             | table created **empty**                                            | none                                         |
| `document_upload`                   | **0 rows read or written** by the migration                        | 14 live rows (all real) untouched            |
| Storage objects                     | **0** touched — no move, no rename, no delete                      | the 14 real files stay at their current keys |

No `case:export` snapshots required (nothing destructive to case data; the
snapshot-first precedent applies to destructive migrations touching real
accounts). Rollback for the mapping is a plain UPDATE; rollback for the
column/table is a drop, and no user data depends on either.

---

## 10. Test plan (commit B)

Unit (pure sanitizer + path builder, no I/O):

1. umlaut/ß transliteration incl. `Kontoauszüge → Kontoauszuege`,
   `Mobilitätsnachweis → Mobilitaetsnachweis`
2. slashes/spaces/hyphens/colons collapse (`Renten/Pensionsbescheid`,
   `Kranken-/Pflegeversicherung`, `Rente 1: Altersrente`)
3. hostile bank name (emoji, `../`, quotes, 200 chars) → safe, capped key
4. extension: from original filename, lowercased, `.jpeg` preserved,
   disallowed extension rejected
5. person_2 → `Spouse/` override; `previous_home` **not** overridden
6. instance-labelled bases (`Kontoauszuege_Girokonto`, per-pension)
7. empty-sanitisation fallback to `technical_key`
8. length caps

Integration/regression:

9. numbering: two sequential allocations → 1, 2; **concurrent** allocations
   → distinct numbers; delete-then-upload → next number, never reused
10. `Personal/Personaldokument1` and `Spouse/Personaldokument1` coexist
11. legacy-shaped upload row still downloads + deletes (grandfathering)
12. `case-export` naming for both schemes, no collision between
    `Personal/…1.pdf` and `Spouse/…1.pdf`
13. existing suites unchanged: `documents-m6`, unit 143/143,
    `verify-baseline` (which gains `storage_category` in its compared
    columns)

**Founder-required additions (approved 2026-07-30):**

14. **Concurrent allocation** — two (and more) parallel allocations for the
    same `(case, folder, base)` return distinct, contiguous numbers and
    never collide on a key. _Already proven at the SQL level during this
    design pass:_ 8 parallel upserts returned exactly 1–8, distinct;
    folder-scoped `Spouse/Personaldokument` returned 1 while
    `Personal/Personaldokument` was already at 2; `_Girokonto` and
    `_Sparkonto` each started at 1. Commit B re-asserts this through the
    action layer.
15. **Hostile bank-name sanitization** — slashes (`../`, `a/b`), dots
    (`..`, `file.tar.gz`), emoji, RTL/zero-width characters, a 200-char
    name, and **pure-symbol input** (`***`, `///`) → a safe capped key,
    with pure-symbol input hitting the §6.2 fallback chain
    (`technical_key`, then `DOC-####`) rather than producing an empty
    segment.
16. **Deleted-file numbering** — upload three files, delete
    `Heimvertrag2`, upload again → the new file is **`Heimvertrag3`**, and
    `Heimvertrag2` is never re-issued. _Proven at SQL level:_ deleting rows
    left the counter untouched and the next allocation returned 9.
17. **Nested-path fixes, each with a test that fails on a one-level
    listing** — (a) `recordUploadAction`'s verify step finds an object at
    `{case}/{Folder}/{file}` (a test asserting the old
    `list(case_id, {search})` shape returns nothing proves the fix is
    load-bearing); (b) the GDPR orphan sweep enumerates nested objects;
    (c) the e2e cleanup helper empties the prefix recursively and asserts
    zero remaining at any depth.

Live (after commit B deploys): real upload on prod with a throwaway
account → object lands at the new nested key, appears in the checklist,
downloads, deletes; a second file for the same slot becomes `…2`.

---

## 11. Open decisions for the founder

1. **The §3 mapping** — approve as proposed, or flip any of the ten ⚠ rows.
2. **Numbering mechanism** — approve the counter table (`document_filename_seq`)
   over a max+1-with-retry on `document_upload`. The counter is the only
   variant that satisfies "deletions never free numbers" without adding
   soft-delete tombstones.
3. **Filename case policy** — PascalCase German (`BisherigeHeimrechnungen1.pdf`)
   as proposed, vs underscores (`Bisherige_Heimrechnungen1.pdf`).
4. Confirm `case-export` may rename new-scheme files to
   `{Folder}_{basename}` (§8.2) — it changes what the team sees in export
   folders from the next export onward.

**Nothing proceeds until you approve.** On approval I write commit A
(migration only) and stop again for your push.
