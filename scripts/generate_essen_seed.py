"""Generate the Essen questionnaire content migration from the co-founder's
question master (essen_hzp_question_master_v3.xlsx, sheet "Question Master").

Usage:  python scripts/generate_essen_seed.py
Output: supabase/migrations/20260705000004_essen_questionnaire.sql

All German text is taken VERBATIM from the master (or, for the few rows the
confirmed decisions add, verbatim from existing co-founder strings — see the
SYNTHETIC section). Decisions baked in: D1..D10 of the Essen milestone plus
the four Phase-2 confirmations (spouse-bulk value/label split; 9th group
spouse_additional_wealth; reuse applicant wording for spouse bank fields +
proposed health-gate wording; D6 block boundary 58-63 / 64-65 unconditional /
66-68 on the Nein path).
"""

import json
import os
import re
import sys

import openpyxl

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_CANDIDATES = [
    os.path.join(REPO, "essen_hzp_question_master_v3.xlsx"),
    r"C:\Users\Berk\Desktop\essen_hzp_question_master_v3.xlsx",
]
OUT = os.path.join(REPO, "supabase", "migrations", "20260705000004_essen_questionnaire.sql")

# ── Fixed UUIDs (deterministic; Essen namespace distinct from Berlin's) ───────
QUESTIONNAIRE_ID = "30000000-0000-0000-0000-000000000003"
ESSEN_OFFICE_ID = "10000000-0000-0000-0000-000000000162"  # Sozialamt Essen (seeded)


def cat_uuid(n):
    return f"41000000-0000-0000-0000-{n:012x}"


def grp_uuid(n):
    return f"51000000-0000-0000-0000-{n:012x}"


def q_uuid(n):
    return f"61000000-0000-0000-0000-{n:012x}"


def opt_uuid(q, i):
    return f"71000000-0000-0000-{q:04x}-{i:012x}"


def sq(s):
    return "NULL" if s is None else "'" + str(s).replace("'", "''") + "'"


def jb(d):
    if d is None:
        return "NULL"
    return "'" + json.dumps(d, ensure_ascii=False).replace("'", "''") + "'::jsonb"


# ── Content constants (decisions) ─────────────────────────────────────────────
MARITAL_GATE = ["verheiratet", "Lebenspartnerschaft", "eheähnliche Gemeinschaft"]  # D1
NONE_OPT = "Nein, nichts davon"
KEINE_RENTE = "Keine Rente"  # D7

CATEGORIES = [  # (n, master section, key, label — existing Berlin German labels)
    (1, "Personal", "antragsteller", "Angaben zur pflegebedürftigen Person"),
    (2, "Home", "wohnsituation", "Wohnsituation"),
    (3, "Children", "kinder", "Kinder"),
    (4, "Income", "income", "Einkünfte"),
    (5, "Expenditure", "expenditure", "Ausgaben"),
    (6, "Wealth", "wealth", "Vermögen"),
    (7, "Additional", "additional", "Weitere Angaben"),
    (8, "Spouse", "spouse", "Ehepartner / Lebenspartner"),
]

# Groups: (n, key, category n, label_de, custom_prompt_de or None, member master-IDs in order)
# Prompts per D10 (Roman's existing strings); spouse groups None -> template fallback.
GROUPS = [
    (1, "children", 3, "Kinder", "Haben Sie weitere Kinder?", [41, 42, 43, 44, 45, 46, 47, 48, 40]),  # D9: 40 last
    (2, "pension", 4, "Rente / Pension", "Möchten Sie weitere Renten hinzufügen?", [69, 70, 71]),
    (3, "other_income", 4, "Sonstige Einkünfte", "Möchten Sie sonstiges Einkommen hinzufügen?", [78, 79]),
    (4, "bank_additional", 6, "Weitere Bankkonten", "Möchten Sie weitere Bankkonten hinzufügen?", [245, 246, 247, 100]),  # D4
    (5, "additional_wealth", 6, "Weitere Vermögenswerte", "Möchten Sie weitere Vermögenswerte hinzufügen?", [123, 124]),
    (6, "spouse_pension", 8, "Rente / Pension des Ehepartners", None, [172, 173, 174]),
    (7, "spouse_other_income", 8, "Sonstige Einkünfte des Ehepartners", None, [181, 182]),
    (8, "spouse_bank_additional", 8, "Weitere Bankkonten des Ehepartners", None, [248, 249, 250, 190]),  # D4 mirror
    (9, "spouse_additional_wealth", 8, "Weitere Vermögenswerte des Ehepartners", None, [228, 229]),  # revised flag 5
]
GROUP_OF = {qid: n for (n, _k, _c, _l, _p, members) in GROUPS for qid in members}

# Per-category question order, by master ID (+ synthetic 241-252).
# Drops: 1, 2 (pre-questionnaire lookups), 30 (last_residence_plz — D8), 210 (split per D2).
ORDER = {
    1: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27],
    2: [28, 29, 31, 32, 33, 34, 35, 36, 37, 38, 39],
    3: [41, 42, 43, 44, 45, 46, 47, 48, 40, 49, 50, 51, 52, 53, 54, 55, 56, 57],
    4: [251, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84],
    5: [85, 86, 87, 88, 89, 90, 91, 92],
    6: [93, 94, 95, 96, 97, 98, 99, 245, 246, 247, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112,
        113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135],
    7: [136, 137, 138, 139, 140, 141, 142],
    8: [143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 252,
        161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180,
        181, 182, 183, 184, 185, 186, 187, 188, 189, 248, 249, 250, 190, 191, 192, 193, 194, 195, 196, 197,
        198, 199, 200, 201, 202, 203, 204, 205, 206, 207, 208, 209, 241, 242, 243, 244] + list(range(211, 241)),
}

TYPE_MAP = {
    "short text": "short_text",
    "long text": "long_text",
    "Euro": "amount",
    "DD.MM.YYYY": "date",
    "selection": "single_select",
    "multiple_selection": "multi_select",
    "MM.YYYY": "month_year",
    "number": "number",
    # YYYY / 5-digit-number / IBAN / BIC handled specially below
}
PATTERNS = {
    "5-digit-number": r"^[0-9]{5}$",
    "IBAN": r"^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$",
    "BIC": r"^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$",
}
YEARS = [str(y) for y in range(2026, 1929, -1)]  # Tier 7 precedent, newest first

# ── Curated option lists (cells are comma-joined but options contain commas) ──
BULK_23 = [
    "Es besteht eine Verpflichtungserklaerung nach § 68 Aufenthaltsgesetz",
    "Es wurden frueher bereits Leistungen nach SGB II oder SGB XI bezogen",
    "Es ist eine medizinisch notwendige kostenaufwaendige Ernaehrung erforderlich",
    "Es besteht weiterer Beratungsbedarf",
    NONE_OPT,
]
BULK_49 = [
    "Es bestehen Unterhaltsfragen zu einem getrennt lebenden oder geschiedenen Ehegatten/Partner",
    NONE_OPT,
]
BULK_80 = [
    "Es wurde ein Antrag nach dem Opferentschaedigungsgesetz gestellt",
    "Es wurden freiwillige Beitraege in Rentenversicherung oder betriebliche Altersvorsorge eingezahlt",
    "Es wurde im Ausland gearbeitet und dort in eine Rentenkasse eingezahlt",
    "Es wurde im Ausland gearbeitet, ohne dort Rentenbeitraege zu zahlen",
    "Es wird ein Grundrentenzuschlag bezogen",
    "Es wurden 33 oder mehr Jahre Grundrentenzeiten erfuellt",
    NONE_OPT,
]
BULK_85 = [
    "Es werden Einkommensteuern gezahlt",
    "Es werden Sozialversicherungsbeitraege gezahlt",
    "Es besteht eine Haftpflichtversicherung",
    "Es besteht eine Kfz-Haftpflichtversicherung",
    "Es besteht eine Hausratversicherung",
    "Es werden Altersvorsorgebeitraege gezahlt",
    "Es werden Beitraege zu einer Sterbegeldversicherung gezahlt",
    NONE_OPT,
]
BULK_120 = [
    "Es gibt Wertpapiere oder Aktien",
    "Es gibt Schmuck oder Edelmetalle von relevantem Wert",
    "Es gibt sonstiges Vermoegen im In- oder Ausland",
    "Es gibt eine staatlich gefoerderte private Altersvorsorge",
    "Es gibt eine sonstige private Altersvorsorge",
    "Es gibt Forderungen oder Ansprueche gegen Dritte",
    "Es gibt Ansprueche aus Uebertragsvertraegen, Wohnrecht, Niessbrauch oder Altenteil",
    "Es gibt Ansprueche aus einer Erbschaft oder erwartete Erbschaft",
    "Es wurde jemals im Ausland gelebt",
    NONE_OPT,
]
OPTION_OVERRIDES = {"23": BULK_23, "49": BULK_49, "80": BULK_80, "85": BULK_85, "120": BULK_120}

# D2: the four split spouse bulks. Option VALUE = the dependency-referenced
# applicant-style "Es …" string; LABEL = the "Der Partner …" text verbatim from
# master row 210. (value, label) pairs; the flag-only Verwaltungsakte option and
# NONE_OPT use label as value (nothing references them).
SPOUSE_APPLICANT_BULK = [
    ("Es besteht eine Verpflichtungserklaerung nach § 68 Aufenthaltsgesetz",
     "Beim Partner besteht eine Verpflichtungserklaerung nach § 68 Aufenthaltsgesetz"),
    ("Es wurden frueher bereits Leistungen nach SGB II oder SGB XI bezogen",
     "Der Partner hat frueher bereits Leistungen nach SGB II oder SGB XI bezogen"),
    ("Der Partner soll Verwaltungsakte oder Geldleistungen entgegennehmen duerfen",
     "Der Partner soll Verwaltungsakte oder Geldleistungen entgegennehmen duerfen"),
    (NONE_OPT, NONE_OPT),
]
SPOUSE_INCOME_BULK = [
    ("Es wurde ein Antrag nach dem Opferentschaedigungsgesetz gestellt",
     "Der Partner hat einen Antrag nach dem Opferentschaedigungsgesetz gestellt"),
    ("Es wurden freiwillige Beitraege in Rentenversicherung oder betriebliche Altersvorsorge eingezahlt",
     "Der Partner hat freiwillige Beitraege in Rentenversicherung oder betriebliche Altersvorsorge eingezahlt"),
    ("Es wurde im Ausland gearbeitet und dort in eine Rentenkasse eingezahlt",
     "Der Partner hat im Ausland gearbeitet und dort in eine Rentenkasse eingezahlt"),
    ("Es wurde im Ausland gearbeitet, ohne dort Rentenbeitraege zu zahlen",
     "Der Partner hat im Ausland gearbeitet, ohne dort Rentenbeitraege zu zahlen"),
    ("Es wird ein Grundrentenzuschlag bezogen", "Der Partner bezieht einen Grundrentenzuschlag"),
    ("Es wurden 33 oder mehr Jahre Grundrentenzeiten erfuellt",
     "Der Partner hat 33 oder mehr Jahre Grundrentenzeiten erfuellt"),
    (NONE_OPT, NONE_OPT),
]
SPOUSE_EXPENSE_BULK = [
    ("Es werden Einkommensteuern gezahlt", "Der Partner zahlt Einkommensteuern"),
    ("Es werden Sozialversicherungsbeitraege gezahlt", "Der Partner zahlt Sozialversicherungsbeitraege"),
    ("Es besteht eine Haftpflichtversicherung", "Beim Partner besteht eine Haftpflichtversicherung"),
    ("Es besteht eine Kfz-Haftpflichtversicherung", "Beim Partner besteht eine Kfz-Haftpflichtversicherung"),
    ("Es besteht eine Hausratversicherung", "Beim Partner besteht eine Hausratversicherung"),
    ("Es werden Altersvorsorgebeitraege gezahlt", "Der Partner zahlt Altersvorsorgebeitraege"),
    ("Es werden Beitraege zu einer Sterbegeldversicherung gezahlt",
     "Der Partner zahlt Beitraege zu einer Sterbegeldversicherung"),
    (NONE_OPT, NONE_OPT),
]
SPOUSE_WEALTH_BULK = [
    ("Es gibt Wertpapiere oder Aktien", "Der Partner besitzt Wertpapiere oder Aktien"),
    ("Es gibt Schmuck oder Edelmetalle von relevantem Wert",
     "Der Partner besitzt Schmuck oder Edelmetalle von relevantem Wert"),
    ("Es gibt sonstiges Vermoegen im In- oder Ausland",
     "Der Partner besitzt sonstiges Vermoegen im In- oder Ausland"),
    ("Es gibt eine staatlich gefoerderte private Altersvorsorge",
     "Der Partner hat eine staatlich gefoerderte private Altersvorsorge"),
    ("Es gibt eine sonstige private Altersvorsorge", "Der Partner hat eine sonstige private Altersvorsorge"),
    ("Es gibt Forderungen oder Ansprueche gegen Dritte",
     "Der Partner hat Forderungen oder Ansprueche gegen Dritte"),
    ("Es gibt Ansprueche aus Uebertragsvertraegen, Wohnrecht, Niessbrauch oder Altenteil",
     "Der Partner hat Ansprueche aus Uebertragsvertraegen, Wohnrecht, Niessbrauch oder Altenteil"),
    ("Es gibt Ansprueche aus einer Erbschaft oder erwartete Erbschaft",
     "Der Partner hat Ansprueche aus einer Erbschaft oder erwartet eine Erbschaft"),
    ("Es wurde jemals im Ausland gelebt", "Der Partner hat jemals im Ausland gelebt"),
    (NONE_OPT, NONE_OPT),
]

MARITAL_RULE = {"question_key": "marital_status", "in_values": MARITAL_GATE}

# ── Synthetic rows (all German verbatim from existing co-founder strings) ─────
# D2 bulk prompts: 241 uses master row 210's prompt; 242/243/244 reuse the
# subject-neutral applicant prompts of rows 80/85/120. D4 field prompts reuse
# Berlin's bank strings + master row 139's BIC wording (confirmed decision 3).
# D6 gate prompts are the proposed wording (pending Roman review).
SYNTH = {
    241: dict(key="spouse_applicant_bulk_topics", type="multiple_selection",
              prompt="Treffen eine oder mehrere dieser eher seltenen Situationen auf den Ehepartner/Partner zu?",
              vis=MARITAL_RULE, pairs=SPOUSE_APPLICANT_BULK),
    242: dict(key="spouse_income_bulk_topics", type="multiple_selection",
              prompt="Treffen eine oder mehrere dieser besonderen Einkommens- oder Rentensituationen zu?",
              vis=MARITAL_RULE, pairs=SPOUSE_INCOME_BULK),
    243: dict(key="spouse_expense_bulk_topics", type="multiple_selection",
              prompt="Gibt es eine oder mehrere dieser absetzbaren Ausgaben?",
              vis=MARITAL_RULE, pairs=SPOUSE_EXPENSE_BULK),
    244: dict(key="spouse_wealth_bulk_topics", type="multiple_selection",
              prompt="Gibt es eine oder mehrere dieser besonderen Vermoegensarten?",
              vis=MARITAL_RULE, pairs=SPOUSE_WEALTH_BULK),
    245: dict(key="bank_additional_name", type="short text",
              prompt="Bei welcher Bank haben Sie ein weiteres Konto?",
              vis={"question_key": "bank_additional_account_yes_no", "value": "Ja"}),
    246: dict(key="bank_additional_iban", type="IBAN",
              prompt="Was ist die IBAN Nummer dieses Kontos?",
              vis={"question_key": "bank_additional_account_yes_no", "value": "Ja"}),
    247: dict(key="bank_additional_bic", type="BIC", prompt="Wie lautet die BIC?",
              vis={"question_key": "bank_additional_account_yes_no", "value": "Ja"}),
    248: dict(key="spouse_bank_additional_name", type="short text",
              prompt="Bei welcher Bank haben Sie ein weiteres Konto?",
              vis={"question_key": "spouse_bank_additional_account_yes_no", "value": "Ja"}),
    249: dict(key="spouse_bank_additional_iban", type="IBAN",
              prompt="Was ist die IBAN Nummer dieses Kontos?",
              vis={"question_key": "spouse_bank_additional_account_yes_no", "value": "Ja"}),
    250: dict(key="spouse_bank_additional_bic", type="BIC", prompt="Wie lautet die BIC?",
              vis={"question_key": "spouse_bank_additional_account_yes_no", "value": "Ja"}),
    251: dict(key="health_insurance_yes_no", type="selection",
              prompt="Sind Sie aktuell krankenversichert?", vis=None, opts=["Ja", "Nein"]),
    252: dict(key="spouse_health_insurance_yes_no", type="selection",
              prompt="Ist Ihr Ehepartner / Lebenspartner aktuell krankenversichert?",
              vis=MARITAL_RULE, opts=["Ja", "Nein"]),
}

# ── Load master ───────────────────────────────────────────────────────────────
src = next((p for p in SRC_CANDIDATES if os.path.exists(p)), None)
if not src:
    sys.exit("essen_hzp_question_master_v3.xlsx not found")
wb = openpyxl.load_workbook(src, data_only=True)
ws = wb["Question Master"]
rows = list(ws.iter_rows(values_only=True))
header = [str(h).strip() if h else "" for h in rows[0]]
col = {name: header.index(name) for name in ("ID", "Section", "Question", "Translation", "Type", "Options", "Dependency")}

master = {}
for r in rows[1:]:
    if r[col["ID"]] is None:
        continue
    rid = int(str(r[col["ID"]]).strip())
    master[rid] = {
        "section": str(r[col["Section"]]).strip(),
        "key": str(r[col["Question"]]).strip(),
        "prompt": str(r[col["Translation"]]).strip(),
        "type": str(r[col["Type"]]).strip(),
        "options": str(r[col["Options"]]).strip() if r[col["Options"]] else None,
        "dep": str(r[col["Dependency"]]).strip() if r[col["Dependency"]] else None,
    }
assert len(master) == 240, f"expected 240 master rows, got {len(master)}"

# ── Option parsing ────────────────────────────────────────────────────────────
def options_for(rid, row):
    if str(rid) in OPTION_OVERRIDES:
        return [(o, o) for o in OPTION_OVERRIDES[str(rid)]]
    if row["type"] == "YYYY":
        return [(y, y) for y in YEARS]
    if not row["options"]:
        return []
    opts = [(o.strip(), o.strip()) for o in row["options"].split(",") if o.strip()]
    # D1: 7th marital option, placed after "Lebenspartnerschaft".
    if row["key"] in ("marital_status",):
        vals = [v for v, _ in opts]
        idx = vals.index("Lebenspartnerschaft") + 1
        opts = opts[:idx] + [("eheähnliche Gemeinschaft", "eheähnliche Gemeinschaft")] + opts[idx:]
    # D7: none-option on both pension type questions.
    if row["key"] in ("pension_type", "spouse_pension_type"):
        opts = opts + [(KEINE_RENTE, KEINE_RENTE)]
    return opts


# ── Dependency translation ────────────────────────────────────────────────────
def real_values(rid):
    """Option values of a master selection row, before D7 additions."""
    return [o.strip() for o in master[rid]["options"].split(",") if o.strip()]


SPECIAL_VIS = {
    # D5 — residence_status unconditional (its "Nicht zutreffend/deutsch" covers Germans)
    14: None,
    152: MARITAL_RULE,
    # D6 — health gate replaces the "is empty" dependency (block = rows 58-63 via
    # chain: 58-61 gated Ja; 62/63 keep their type-chain; 64/65 unconditional).
    58: {"question_key": "health_insurance_yes_no", "value": "Ja"},
    59: {"question_key": "health_insurance_yes_no", "value": "Ja"},
    60: {"question_key": "health_insurance_yes_no", "value": "Ja"},
    61: {"question_key": "health_insurance_yes_no", "value": "Ja"},
    66: {"question_key": "health_insurance_yes_no", "value": "Nein"},
    161: {"question_key": "spouse_health_insurance_yes_no", "value": "Ja"},
    162: {"question_key": "spouse_health_insurance_yes_no", "value": "Ja"},
    163: {"question_key": "spouse_health_insurance_yes_no", "value": "Ja"},
    164: {"question_key": "spouse_health_insurance_yes_no", "value": "Ja"},
    169: {"question_key": "spouse_health_insurance_yes_no", "value": "Nein"},
    # D7 — pension follow-ups only for real pensions (not "Keine Rente")
    70: {"question_key": "pension_type", "in_values": real_values(69)},
    71: {"question_key": "pension_type", "in_values": real_values(69)},
    173: {"question_key": "spouse_pension_type", "in_values": real_values(172)},
    174: {"question_key": "spouse_pension_type", "in_values": real_values(172)},
    # "starts with Ja" → the two exact Ja options
    118: {"question_key": "asset_transfer_yes_no", "in_values": [v for v in real_values(117) if v.startswith("Ja")]},
    119: {"question_key": "asset_transfer_yes_no", "in_values": [v for v in real_values(117) if v.startswith("Ja")]},
    208: {"question_key": "spouse_asset_transfer_yes_no", "in_values": [v for v in real_values(207) if v.startswith("Ja")]},
    209: {"question_key": "spouse_asset_transfer_yes_no", "in_values": [v for v in real_values(207) if v.startswith("Ja")]},
}


def parse_dep(rid, dep):
    if rid in SPECIAL_VIS:
        return SPECIAL_VIS[rid]
    if not dep:
        return None
    clause = dep.split(";")[-1].strip()
    if clause.startswith("if "):
        clause = clause[3:].strip()
    if clause.startswith("marital_status in"):
        return MARITAL_RULE
    m = re.match(r'^(\w+) includes "(.+)"$', clause)
    if m:
        return {"question_key": m.group(1), "includes": m.group(2)}
    m = re.match(r"^(\w+) not empty$", clause)
    if m:
        return {"question_key": m.group(1), "not_empty": True}
    m = re.match(r"^(\w+) other than (.+)$", clause)
    if m:
        return {"question_key": m.group(1), "not_value": m.group(2).strip()}
    m = re.match(r"^(\w+) in (.+)$", clause)
    if m:
        return {"question_key": m.group(1), "in_values": [v.strip() for v in m.group(2).split(",")]}
    m = re.match(r"^(\w+) != (.+)$", clause)
    if m:
        return {"question_key": m.group(1), "not_value": m.group(2).strip()}
    m = re.match(r"^(\w+) = (.+)$", clause)
    if m:
        return {"question_key": m.group(1), "value": m.group(2).strip()}
    raise SystemExit(f"UNMAPPED dependency on row {rid}: {dep!r}")


# ── Assemble questions ────────────────────────────────────────────────────────
questions = []  # dicts: id_n, cat_n, key, sort, atype, prompt, vis, validation, options [(v,l)]
for cat_n, _section, _key, _label in CATEGORIES:
    for sort, rid in enumerate(ORDER[cat_n]):
        if rid in SYNTH:
            s = SYNTH[rid]
            atype_raw = s["type"]
            row = {"key": s["key"], "prompt": s["prompt"], "type": atype_raw, "options": None, "dep": None}
            vis = s["vis"]
            pairs = s.get("pairs") or [(o, o) for o in s.get("opts", [])]
        else:
            row = master[rid]
            vis = parse_dep(rid, row["dep"])
            atype_raw = row["type"]
            pairs = options_for(rid, row)

        validation = {}
        if atype_raw in PATTERNS:
            validation["pattern"] = PATTERNS[atype_raw]
            atype = "short_text"
        elif atype_raw == "YYYY":
            atype = "single_select"
        else:
            atype = TYPE_MAP[atype_raw]
        if atype == "multi_select" and any(v == NONE_OPT for v, _ in pairs):
            validation["exclusive_value"] = NONE_OPT

        questions.append(dict(
            id_n=rid, cat_n=cat_n, key=row["key"], sort=sort, atype=atype,
            prompt=row["prompt"], vis=vis, validation=validation or None, options=pairs,
        ))

# ── Sanity assertions ─────────────────────────────────────────────────────────
keys = [q["key"] for q in questions]
assert len(keys) == len(set(keys)), f"duplicate keys: {[k for k in keys if keys.count(k) > 1]}"
by_key = {q["key"]: q for q in questions}
for q in questions:
    if not q["vis"]:
        continue
    ctrl = by_key.get(q["vis"]["question_key"])
    assert ctrl, f"{q['key']}: rule references missing controller {q['vis']['question_key']}"
    if "includes" in q["vis"]:
        vals = [v for v, _ in ctrl["options"]]
        assert q["vis"]["includes"] in vals, f"{q['key']}: includes target not an option of {ctrl['key']}: {q['vis']['includes']!r}"
    if "in_values" in q["vis"] and ctrl["options"]:
        vals = [v for v, _ in ctrl["options"]]
        for v in q["vis"]["in_values"]:
            assert v in vals, f"{q['key']}: in_values {v!r} not an option of {ctrl['key']}"
    if "value" in q["vis"] and ctrl["options"]:
        vals = [v for v, _ in ctrl["options"]]
        assert q["vis"]["value"] in vals, f"{q['key']}: value {q['vis']['value']!r} not an option of {ctrl['key']}"
expected_n = 240 - 4 + 12  # drops 1,2,30,210; adds 241-252
assert len(questions) == expected_n, f"expected {expected_n} questions, got {len(questions)}"

# ── Emit SQL ──────────────────────────────────────────────────────────────────
L = []
L.append("-- Essen milestone, migration B — the full Essen questionnaire (GENERATED).")
L.append("-- Generator: scripts/generate_essen_seed.py (source: essen_hzp_question_master_v3.xlsx,")
L.append("-- sheet \"Question Master\", 240 rows). Do not hand-edit; re-run the generator.")
L.append("--")
L.append("-- Contains NO Berlin-touching statements: one questionnaire row for Sozialamt")
L.append("-- Essen (routing picks it up via resolvePlzAction's office->questionnaire lookup;")
L.append("-- postal_code_rule is untouched), 8 categories, 9 repeatable groups, "
         f"{len(questions)} questions,")
L.append("-- and their options. Decisions D1-D10 + Phase-2 confirmations baked in; see the")
L.append("-- milestone log. Idempotent (fixed ids + ON CONFLICT DO NOTHING).")
L.append("")
L.append("BEGIN;")
L.append("")
L.append("INSERT INTO public.questionnaire (id, social_office_id, name, version, is_active) VALUES")
L.append(f"  ('{QUESTIONNAIRE_ID}', '{ESSEN_OFFICE_ID}', 'Fragebogen – Sozialamt Essen', 1, true)")
L.append("ON CONFLICT (id) DO NOTHING;")
L.append("")
L.append("INSERT INTO public.category (id, questionnaire_id, key, sort_order, label_de) VALUES")
cat_lines = [f"  ('{cat_uuid(n)}', '{QUESTIONNAIRE_ID}', {sq(key)}, {n - 1}, {sq(label)})"
             for n, _s, key, label in CATEGORIES]
L.append(",\n".join(cat_lines))
L.append("ON CONFLICT (id) DO NOTHING;")
L.append("")
L.append("INSERT INTO public.question_group (id, category_id, key, sort_order, label_de, custom_prompt_de, is_repeatable, min_count, max_count) VALUES")
grp_lines = [f"  ('{grp_uuid(n)}', '{cat_uuid(cat_n)}', {sq(key)}, {i}, {sq(label)}, {sq(prompt)}, true, 0, NULL)"
             for i, (n, key, cat_n, label, prompt, _m) in enumerate(GROUPS)]
L.append(",\n".join(grp_lines))
L.append("ON CONFLICT (id) DO NOTHING;")
L.append("")
L.append("INSERT INTO public.question (id, category_id, group_id, key, sort_order, answer_type, is_required, prompt_de, help_de, validation, visibility_rule) VALUES")
q_lines = []
for q in questions:
    gid = f"'{grp_uuid(GROUP_OF[q['id_n']])}'" if q["id_n"] in GROUP_OF else "NULL"
    q_lines.append(
        f"  ('{q_uuid(q['id_n'])}', '{cat_uuid(q['cat_n'])}', {gid}, {sq(q['key'])}, {q['sort']}, "
        f"'{q['atype']}'::public.answer_type, true, {sq(q['prompt'])}, NULL, {jb(q['validation'])}, {jb(q['vis'])})"
    )
L.append(",\n".join(q_lines))
L.append("ON CONFLICT (id) DO NOTHING;")
L.append("")
opt_lines = []
for q in questions:
    for i, (val, label) in enumerate(q["options"]):
        okey = f"o{i}"
        opt_lines.append(f"  ('{opt_uuid(q['id_n'], i)}', '{q_uuid(q['id_n'])}', '{okey}', {i}, {sq(label)}, {sq(val)})")
if opt_lines:
    L.append("INSERT INTO public.question_option (id, question_id, key, sort_order, label_de, value) VALUES")
    L.append(",\n".join(opt_lines))
    L.append("ON CONFLICT (id) DO NOTHING;")
L.append("")
L.append("COMMIT;")
L.append("")

with open(OUT, "w", encoding="utf-8", newline="\n") as f:
    f.write("\n".join(L))

n_opts = sum(len(q["options"]) for q in questions)
n_selects = sum(1 for q in questions if q["atype"] in ("single_select", "multi_select"))
print(f"WROTE {OUT}")
print(f"questions={len(questions)}  categories={len(CATEGORIES)}  groups={len(GROUPS)}  options={n_opts}  select-questions={n_selects}")
print(f"required=all  includes-rules={sum(1 for q in questions if q['vis'] and 'includes' in q['vis'])}")
