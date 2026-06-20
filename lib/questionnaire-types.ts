// Shared questionnaire types — no imports, safe for both server and client code.

export type VisibilityRule =
  | { question_key: string; value: string }
  | { question_key: string; not_value: string }
  | { question_key: string; not_empty: true }
  | { question_key: string; in_values: string[] }

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
