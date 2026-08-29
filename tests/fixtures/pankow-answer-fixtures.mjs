/**
 * Representative Pankow answer sets for the evaluator regression gate.
 * F1 mirrors the real pilot-shaped case (married, 2 pensions, savings + one
 * additional account, Wohngeld, disability Nein — the M6 acceptance shape).
 * F2 is the minimal single applicant. F3 exercises the conditional edges
 * (citizenship Nein, automobile, prior aid, life insurance, rент debt).
 * F4 (widowed pass, GATE 1 2026-08-29) is the widowed single applicant with
 * a Witwenrente — consumed ONLY by the PAN-025 coverage
 * (pankow-widowed-death-certificate.test.ts); deliberately absent from the
 * golden files, whose loops pin exactly F1–F3.
 */

const inst = (n) => `instance-${n}`

export const F1 = {
  answers: {
    marital_status: 'verheiratet',
    disability_card: 'Nein',
    bank_savings_account_yes_no: 'Ja',
    spouse_bank_savings_account_yes_no: 'Nein',
    wohngeld_yes_no: 'Ja',
    german_citizenship_yes_no: 'Ja',
    spouse_german_citizenship_yes_no: 'Ja',
    life_insurance: 'Nein',
    apartment_ownership: 'Mietwohnung',
  },
  groupInstances: {
    pension: [inst(1), inst(2)],
    spouse_pension: [inst(3)],
    bank_additional: [inst(4)],
  },
  groupAnswers: {
    [inst(1)]: { pension_type: 'Altersrente', pension_amount: '1200' },
    [inst(2)]: { pension_type: 'Witwen Rente', pension_amount: '400' },
    [inst(3)]: { spouse_pension_type: 'Altersrente', spouse_pension_amount: '900' },
    [inst(4)]: { bank_additional_name: 'Sparkasse', bank_additional_iban: 'DE00' },
  },
}

export const F2 = {
  answers: {
    marital_status: 'ledig',
    disability_card: 'Nein',
    bank_savings_account_yes_no: 'Nein',
    german_citizenship_yes_no: 'Ja',
  },
  groupInstances: { pension: [inst(1)] },
  groupAnswers: { [inst(1)]: { pension_type: 'Keine Rente' } },
}

export const F3 = {
  answers: {
    marital_status: 'dauernd getrennt lebend',
    disability_card: 'Ja',
    german_citizenship_yes_no: 'Nein',
    automobile_owner: 'Ja',
    prior_social_aid: 'Ja',
    life_insurance: 'Lebensversicherung',
    apartment_ownership: 'Mietwohnung',
    rent_contract_termination_yes_no: 'Nein',
    bank_savings_account_yes_no: 'Ja',
  },
  groupInstances: { other_income: [inst(5)] },
  groupAnswers: { [inst(5)]: { other_income_type: 'Nebenjob' } },
}

export const F4 = {
  answers: {
    marital_status: 'verwitwet',
    disability_card: 'Nein',
    bank_savings_account_yes_no: 'Nein',
    german_citizenship_yes_no: 'Ja',
  },
  groupInstances: { pension: [inst(6)] },
  groupAnswers: { [inst(6)]: { pension_type: 'Witwenrente', pension_amount: '800' } },
}
