-- Static UI copy (header/footer chrome) stored as data — CLAUDE.md rule #2.
--
-- Generic key -> German text store. The non-technical co-founder edits value_de
-- here instead of in lib/strings/de.ts. Read-only for the app (same pattern as
-- the other config tables); writes go through migrations / Supabase Studio /
-- the service role.
--
-- Seeded with the exact copy that previously lived in lib/strings/de.ts, which
-- becomes the source of truth once the components read from this table.
--
-- Safe to re-run (create if not exists + upsert).

create table if not exists public.static_content (
  key        text primary key,
  value_de   text not null,
  updated_at timestamptz not null default now()
);

alter table public.static_content enable row level security;

drop policy if exists "static_content: authenticated read" on public.static_content;
create policy "static_content: authenticated read"
  on public.static_content for select to authenticated
  using (true);

insert into public.static_content (key, value_de) values
  ('brand.tagline',             'Heimkosten einfach geregelt.'),
  ('case.subheading',           'Mein Hilfe zur Pflege Antrag'),
  ('case.patient_banner_title', 'Angaben zur pflegebedürftigen Person'),
  ('case.patient_banner_body',  'Die folgenden Fragen beziehen sich ausschließlich auf die Person, die im Pflegeheim lebt, sie ist der Antragsteller.'),
  ('case.all_answered_heading', 'Sie haben alle Fragen beantwortet!'),
  ('case.all_answered_message', 'Wir prüfen nun alle Ihre Angaben und übertragen diese in das Antragsformular. Sofern Dinge unklar sind, melden wir uns bei Ihnen.')
on conflict (key) do update set value_de = excluded.value_de, updated_at = now();
