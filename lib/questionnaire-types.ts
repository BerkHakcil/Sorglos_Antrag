// Shared questionnaire types — no imports, safe for both server and client code.

// Every variant carries the controller's question_key; the extra field selects
// the match semantics. Written as an intersection so `question_key` is always
// accessible without a cast (needed for transitive visibility resolution).
export type VisibilityRule = { question_key: string } & (
  | { value: string }
  | { not_value: string }
  | { not_empty: true }
  | { in_values: string[] }
)

export type QuestionOption = {
  id: string
  key: string
  sort_order: number
  label_de: string
  value: string
}

export type Question = {
  id: string
  key: string
  sort_order: number
  answer_type: string
  is_required: boolean
  prompt_de: string
  help_de: string | null
  validation: Record<string, unknown> | null
  visibility_rule: VisibilityRule | null
  group_id: string | null
  group_key: string | null
  group_label_de: string | null
  group_is_repeatable: boolean | null
  group_sort_order: number | null
  group_min_count: number | null
  group_max_count: number | null
  options: QuestionOption[]
}

export type Category = {
  id: string
  key: string
  sort_order: number
  label_de: string
  questions: Question[]
}

export type LoadedQuestionnaire = {
  id: string
  name: string
  categories: Category[]
}
