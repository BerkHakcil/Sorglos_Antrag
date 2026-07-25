# Generates the Essen document-rules seed migration from the canonical master
# docs/document-rules/essen_document_rules.json (committed verbatim from Roman).
#
# Applies the Phase-2 normalizations (Phase 1 report Addendum A3 + decisions
# D1/D3/D4) and hard-asserts the output shape. Emits:
#   supabase/migrations/20260724000001_essen_document_rules.sql
#   tests/fixtures/essen-rules.normalized.json   (unit-test input)
#
# Run:  python scripts/generate_essen_rules_seed.py
import json, io, copy, sys, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "docs", "document-rules", "essen_document_rules.json")
MIG = os.path.join(ROOT, "supabase", "migrations", "20260724000001_essen_document_rules.sql")
FIX = os.path.join(ROOT, "tests", "fixtures", "essen-rules.normalized.json")

ESSEN_OFFICE = "10000000-0000-0000-0000-000000000162"
NEW_DOCS = [f"DOC-{i:04d}" for i in range(31, 44)]

# A3: spouse_bulk_topics label -> (actual per-domain key, stored "Es ..." value).
# Keys/values verified character-for-character against prod in Phase 1.
SPOUSE_BULK_MAP = {
    "frueher bereits Leistungen nach SGB II": (
        "spouse_applicant_bulk_topics",
        "Es wurden frueher bereits Leistungen nach SGB II oder SGB XI bezogen",
    ),
    "Grundrentenzuschlag": (
        "spouse_income_bulk_topics",
        "Es wird ein Grundrentenzuschlag bezogen",
    ),
    "33 oder mehr Jahre Grundrentenzeiten": (
        "spouse_income_bulk_topics",
        "Es wurden 33 oder mehr Jahre Grundrentenzeiten erfuellt",
    ),
    "in eine Rentenkasse eingezahlt": (
        "spouse_income_bulk_topics",
        "Es wurde im Ausland gearbeitet und dort in eine Rentenkasse eingezahlt",
    ),
    "ohne dort Rentenbeitraege zu zahlen": (
        "spouse_income_bulk_topics",
        "Es wurde im Ausland gearbeitet, ohne dort Rentenbeitraege zu zahlen",
    ),
    "sonstiges Vermoegen": (
        "spouse_wealth_bulk_topics",
        "Es gibt sonstiges Vermoegen im In- oder Ausland",
    ),
    "Kfz-Haftpflichtversicherung": (
        "spouse_expense_bulk_topics",
        "Es besteht eine Kfz-Haftpflichtversicherung",
    ),
    "Haftpflichtversicherung": (
        "spouse_expense_bulk_topics",
        "Es besteht eine Haftpflichtversicherung",
    ),
    "Sterbegeldversicherung": (
        "spouse_expense_bulk_topics",
        "Es werden Beitraege zu einer Sterbegeldversicherung gezahlt",
    ),
    "Uebertragsvertraegen": (
        "spouse_wealth_bulk_topics",
        "Es gibt Ansprueche aus Uebertragsvertraegen, Wohnrecht, Niessbrauch oder Altenteil",
    ),
}
MAINTENANCE_NON_NEIN = [
    "Auf Unterhalt wurde verzichtet",
    "Unterhalt wird bereits bezahlt",
    "Unterhalt wurde noch nicht geltend gemacht",
    "Unterhalt ist bereits tituliert",
]
ASSET_TRANSFER_JA = ["Ja - ohne besonderen Vertrag", "Ja - siehe beigefuegte Urkunde"]
INCOME_REPEAT = {"other_income_type": "other_income", "spouse_other_income_type": "spouse_other_income"}
KNOWN_BINDINGS = {
    "applicant_bank_account", "spouse_bank_account",
    "pension_type", "spouse_pension_type", "other_income", "spouse_other_income",
}

# The file introduces two subject values outside the M5 CHECK constraint
# (subject IN person_1/person_2/previous_home) — and outside the UI's three
# grouping headings. Mapped to person_1 (applicant-side household documents);
# first push attempt failed on the constraint (2026-07-25, full rollback).
SUBJECT_MAP = {"property_owner": "person_1", "maintenance_case": "person_1"}

changed = {}  # rule_id -> list of reasons

def note(rid, reason):
    changed.setdefault(rid, []).append(reason)

def normalize(rid, c):
    if not isinstance(c, dict):
        return c
    # recurse first
    for k in ("any", "all"):
        if isinstance(c.get(k), list):
            c[k] = [normalize(rid, s) for s in c[k]]
    f, op = c.get("field"), c.get("operator")
    # A3: spouse_bulk_topics remap (key + label->value)
    if f == "spouse_bulk_topics":
        assert op == "includes", f"{rid}: unexpected op on spouse_bulk_topics"
        hits = [(sub, tgt) for sub, tgt in SPOUSE_BULK_MAP.items() if sub in c["value"]]
        assert hits, f"{rid}: no spouse-bulk mapping for {c['value']!r}"
        # longest / most specific substring wins (Kfz- before plain Haftpflicht)
        _, (key, value) = max(hits, key=lambda h: len(h[0]))
        note(rid, f"A3 remap: spouse_bulk_topics -> {key} (label->stored value)")
        return {"field": key, "operator": "includes", "value": value}
    # A3: maintenance bulk (deleted by CP3) -> maintenance_claims_status
    if f == "maintenance_bulk_topics":
        note(rid, "A3 remap: maintenance_bulk_topics -> maintenance_claims_status in(non-Nein)")
        return {"any": [
            {"field": "maintenance_claims_status", "operator": "equals", "value": v}
            for v in MAINTENANCE_NON_NEIN
        ]}
    # D3: starts_with "Ja" -> any-of-equals
    if op == "starts_with":
        assert c["value"] == "Ja", f"{rid}: unexpected starts_with value"
        note(rid, "D3: starts_with 'Ja' -> any-of-equals(the two Ja options)")
        return {"any": [
            {"field": f, "operator": "equals", "value": v} for v in ASSET_TRANSFER_JA
        ]}
    # D1: equals/in on (spouse_)other_income_type -> filtered repeat
    if f in INCOME_REPEAT and op in ("equals", "in"):
        values = c["value"] if isinstance(c["value"], list) else [c["value"]]
        note(rid, f"D1: {op} on {f} -> repeat_for_each {INCOME_REPEAT[f]} + match_values")
        return {"repeat_for_each": INCOME_REPEAT[f], "match_values": values}
    # remaining "in" (health types) -> any-of-equals
    if op == "in":
        note(rid, f"'in' on {f} -> any-of-equals")
        return {"any": [
            {"field": f, "operator": "equals", "value": v} for v in c["value"]
        ]}
    return c

def walk_assert(c, rid):
    if not isinstance(c, dict):
        return
    assert c.get("operator") not in ("in", "starts_with"), f"{rid}: {c.get('operator')} survived"
    assert c.get("field") not in ("spouse_bulk_topics", "maintenance_bulk_topics"), f"{rid}: dead key survived"
    if isinstance(c.get("repeat_for_each"), str):
        assert c["repeat_for_each"] in KNOWN_BINDINGS, f"{rid}: unknown binding {c['repeat_for_each']}"
    for k in ("any", "all"):
        for s in c.get(k) or []:
            walk_assert(s, rid)

data = json.load(io.open(SRC, encoding="utf-8"))
rules_out = []
for r in data["essen_rules"]:
    cond = normalize(r["rule_id"], copy.deepcopy(r.get("condition") or {"always": True}))
    if not cond:
        cond = {"always": True}
    walk_assert(cond, r["rule_id"])
    subject = r["subject"]
    if subject in SUBJECT_MAP:
        note(r["rule_id"], f"subject '{subject}' -> '{SUBJECT_MAP[subject]}' (M5 CHECK + UI grouping)")
        subject = SUBJECT_MAP[subject]
    assert subject in ("person_1", "person_2", "previous_home"), f"{r['rule_id']}: bad subject {subject}"
    rules_out.append({
        "id": r["rule_id"], "social_office_id": ESSEN_OFFICE, "document_id": r["document_id"],
        "requirement_type": r["requirement_type"], "subject": subject,
        "instance_note": r.get("instance_rule"), "period_months": r.get("period_months"),
        "condition": cond,
    })

assert len(rules_out) == 55, f"expected 55 rules, got {len(rules_out)}"
assert sorted(r["id"] for r in rules_out) == [f"ESS-{i:03d}" for i in range(1, 56)]
cat_out = [c for c in data["document_catalog"] if c["document_id"] in NEW_DOCS]
assert len(cat_out) == 13, f"expected 13 new docs, got {len(cat_out)}"

def sq(s):
    return "NULL" if s is None else "'" + str(s).replace("'", "''") + "'"

L = []
L.append("-- GENERATED by scripts/generate_essen_rules_seed.py from the canonical")
L.append("-- docs/document-rules/essen_document_rules.json — do not edit by hand.")
L.append("--")
L.append("-- Essen document rules: 13 new catalog docs (DOC-0031..0043) + 55 rules")
L.append("-- (ESS-001..055) for Sozialamt Essen. INSERTS ONLY — no existing catalog")
L.append("-- doc, Pankow rule, or upload row is touched. Essen-routed cases switch")
L.append("-- to this ruleset automatically (own-office rules win in getDocumentData);")
L.append("-- app_config default stays Pankow for Berlin-questionnaire fallback cases.")
L.append("--")
L.append("-- E3 SEMANTICS (chosen, founders 2026-07-23) — ESS-015/016: when matching")
L.append("-- income entries exist, only per-entry slots are emitted; the prior-SGB-II/XI")
L.append("-- flat branch contributes a slot only when zero entries match. Changing this")
L.append("-- is a rules change, not an engine change.")
L.append("--")
L.append("-- Seeded-condition differs from the rules file for these rules:")
L.append("--   rule    | reason")
for rid in sorted(changed):
    for reason in changed[rid]:
        L.append(f"--   {rid} | {reason}")
L.append("-- All other rules seed verbatim; transliterated values ARE the DB's stored")
L.append("-- option values (CP3 umlaut sweep touched labels only) — deliberate (D4).")
L.append("")
L.append("BEGIN;")
L.append("")
L.append("INSERT INTO public.document_catalog (id, technical_key, name_de, category, instance_basis, active) VALUES")
rows = []
for c in cat_out:
    rows.append(f"  ({sq(c['document_id'])}, {sq(c['technical_key'])}, {sq(c['user_facing_name_de'])}, "
                f"{sq(c['category'])}, {sq(c['default_instance_basis'])}, {'TRUE' if c.get('active', True) else 'FALSE'})")
L.append(",\n".join(rows) + ";")
L.append("")
L.append("INSERT INTO public.office_document_rule (id, social_office_id, document_id, requirement_type, subject, instance_note, period_months, condition) VALUES")
rows = []
for r in rules_out:
    cond = json.dumps(r["condition"], ensure_ascii=False).replace("'", "''")
    pm = "NULL" if r["period_months"] is None else str(r["period_months"])
    rows.append(f"  ({sq(r['id'])}, {sq(r['social_office_id'])}, {sq(r['document_id'])}, "
                f"{sq(r['requirement_type'])}, {sq(r['subject'])}, {sq(r['instance_note'])}, {pm}, '{cond}'::jsonb)")
L.append(",\n".join(rows) + ";")
L.append("")
L.append("COMMIT;")

io.open(MIG, "w", encoding="utf-8", newline="\n").write("\n".join(L) + "\n")
io.open(FIX, "w", encoding="utf-8", newline="\n").write(json.dumps(
    {"note": "GENERATED normalized Essen rules (unit-test input) — regenerate via scripts/generate_essen_rules_seed.py",
     "rules": rules_out,
     "catalog": {c["document_id"]: {"id": c["document_id"], "name_de": c["user_facing_name_de"], "category": c["category"]}
                  for c in data["document_catalog"]}},
    ensure_ascii=False, indent=1))
print(f"migration: {MIG}")
print(f"fixture:   {FIX}")
print(f"rules with seeded != file: {len(changed)} -> {sorted(changed)}")
