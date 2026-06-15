/**
 * Server Component — loads the questionnaire from the DB and renders it.
 *
 * M2: display-only. Questions are filtered by visibility_rule against the
 * case's saved answers (empty in M2, so only unconditional questions show).
 * M3 will pass real answers; the same filter automatically shows conditional
 * questions without any UI code change.
 */

import { loadQuestionnaire, isVisible, type Category, type Question } from '@/lib/questionnaire-engine'
import { QuestionRenderer } from '@/components/ui/questionnaire/question-renderer'
import { de } from '@/lib/strings/de'

const s = de.case.questionnaire

type Props = {
  questionnaireId: string
  /** Current answers keyed by question_key → value. Empty in M2. */
  answers: Record<string, unknown>
}

export async function QuestionnaireView({ questionnaireId, answers }: Props) {
  const questionnaire = await loadQuestionnaire(questionnaireId)

  return (
    <div className="space-y-8">
      {/* Patient notice — M2 spec requirement */}
      <div className="border-border bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800 p-4">
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          {s.patientBannerTitle}
        </p>
        <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">{s.patientBannerBody}</p>
      </div>

      {questionnaire.categories.map((category) => (
        <CategorySection key={category.id} category={category} answers={answers} />
      ))}
    </div>
  )
}

// ── Category section ──────────────────────────────────────────────────────────

function CategorySection({
  category,
  answers,
}: {
  category: Category
  answers: Record<string, unknown>
}) {
  // Separate questions into groups and standalone
  const grouped = new Map<string, { label: string; isRepeatable: boolean; questions: Question[] }>()
  const standalone: Question[] = []

  for (const q of category.questions) {
    if (!isVisible(q.visibility_rule, answers)) continue

    if (q.group_id && q.group_key) {
      if (!grouped.has(q.group_id)) {
        grouped.set(q.group_id, {
          label: q.group_label_de ?? q.group_key,
          isRepeatable: q.group_is_repeatable ?? false,
          questions: [],
        })
      }
      grouped.get(q.group_id)!.questions.push(q)
    } else {
      standalone.push(q)
    }
  }

  // Also include group headers for groups whose questions are hidden (dependency on answers)
  // — show the group header with "no entries yet" hint for repeatable groups
  const allGroupIds = new Set<string>()
  for (const q of category.questions) {
    if (q.group_id) allGroupIds.add(q.group_id)
  }
  const emptyGroups: { id: string; label: string; isRepeatable: boolean }[] = []
  for (const q of category.questions) {
    if (q.group_id && q.group_key && !grouped.has(q.group_id) && q.group_is_repeatable) {
      if (!emptyGroups.find((g) => g.id === q.group_id)) {
        emptyGroups.push({
          id: q.group_id,
          label: q.group_label_de ?? q.group_key,
          isRepeatable: true,
        })
      }
    }
  }

  const hasContent = standalone.length > 0 || grouped.size > 0 || emptyGroups.length > 0

  return (
    <section className="space-y-4" aria-labelledby={`cat-${category.id}`}>
      <div className="border-border border-b pb-2">
        <h2
          id={`cat-${category.id}`}
          className="text-base font-semibold tracking-tight"
        >
          {category.label_de}
        </h2>
      </div>

      {!hasContent && (
        <p className="text-muted-foreground text-sm italic">
          Keine Fragen in dieser Kategorie sichtbar (alle bedingt).
        </p>
      )}

      {/* Standalone questions */}
      {standalone.length > 0 && (
        <div className="space-y-5">
          {standalone.map((q) => (
            <QuestionRenderer key={q.id} question={q} />
          ))}
        </div>
      )}

      {/* Repeatable group headers with their questions (or empty hint) */}
      {Array.from(grouped.entries()).map(([groupId, group]) => (
        <RepeatableGroupSection key={groupId} label={group.label} questions={group.questions} />
      ))}
      {emptyGroups.map((g) => (
        <RepeatableGroupSection key={g.id} label={g.label} questions={[]} />
      ))}
    </section>
  )
}

// ── Repeatable group wrapper ──────────────────────────────────────────────────

function RepeatableGroupSection({
  label,
  questions,
}: {
  label: string
  questions: Question[]
}) {
  const s = de.case.questionnaire

  return (
    <div className="border-border rounded-lg border p-4 space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">{label}</h3>
        <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-xs">
          {s.repeatableGroupLabel}
        </span>
      </div>

      {questions.length === 0 ? (
        <p className="text-muted-foreground text-sm italic">{s.groupEmptyHint}</p>
      ) : (
        <div className="space-y-5">
          {questions.map((q) => (
            <QuestionRenderer key={q.id} question={q} />
          ))}
        </div>
      )}
    </div>
  )
}
