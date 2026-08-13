import { describe, it, expect } from 'vitest'
import { DATE_MIN, FUTURE_ORIENTED_DATE_KEYS, dateMaxFor, isValidIsoDate } from '@/lib/date-bounds'

/**
 * Go-live round 2, item 5 — split date bounds: future-oriented keys (expiries,
 * valid-until, due dates) reach today + 10 years; every other date field keeps
 * the feedback-pass-2 default of (currentYear+1)-12-31. Past-event fields
 * deliberately do NOT widen (Geburtsdaten bleiben vergangenheitsbeschränkt).
 *
 * All assertions inject a fixed `today` so the suite is deterministic.
 */

// A mid-year date well away from year boundaries and Feb-29 edge cases.
const TODAY = new Date('2026-08-13T12:00:00Z')

describe('dateMaxFor — future-oriented keys get today+10y', () => {
  it('id_expiry_date reaches exactly today + 10 years', () => {
    expect(dateMaxFor('id_expiry_date', TODAY)).toBe('2036-08-13')
  })

  it('a 2031 expiry is inside the new bound for EVERY future-oriented key', () => {
    for (const key of FUTURE_ORIENTED_DATE_KEYS) {
      const max = dateMaxFor(key, TODAY)
      expect('2031-05-01' <= max, `${key} must accept a 2031 date (max ${max})`).toBe(true)
    }
  })

  it('the classification set holds exactly the 14 approved keys', () => {
    // Pinned so an accidental key edit fails loudly — the set is the approved
    // classification from the Phase-1 report, not a grow-as-needed list.
    expect([...FUTURE_ORIENTED_DATE_KEYS].sort()).toEqual(
      [
        'disability_card_expiry',
        'former_rent_contract_terminated_by',
        'former_rent_paid_until',
        'id_expiry_date',
        'last_health_insurance_until',
        'private_pension_due_date',
        'rent_contract_terminated_by',
        'rent_paid_until',
        'spouse_disability_card_expiry',
        'spouse_id_expiry_date',
        'spouse_last_health_insurance_until',
        'spouse_private_pension_due_date',
        'spouse_state_subsidized_private_pension_due_date',
        'state_subsidized_private_pension_due_date',
      ].sort()
    )
  })

  it('Feb-29 today rolls to Mar-1 ten years out (no invalid date emitted)', () => {
    // 2028 is a leap year; 2038 is not — setFullYear rolls Feb-29 to Mar-1.
    expect(dateMaxFor('id_expiry_date', new Date('2028-02-29T12:00:00Z'))).toBe('2038-03-01')
  })
})

describe('dateMaxFor — past-oriented keys keep the pass-2 default', () => {
  it('birth dates keep (currentYear+1)-12-31', () => {
    expect(dateMaxFor('geburtsdatum', TODAY)).toBe('2027-12-31')
    expect(dateMaxFor('birthdate', TODAY)).toBe('2027-12-31')
  })

  it('a 2031 date is OUTSIDE the bound for past-only keys', () => {
    for (const key of ['geburtsdatum', 'birthdate', 'marital_status_since', 'in_facility_since']) {
      expect('2031-01-01' > dateMaxFor(key, TODAY)).toBe(true)
    }
  })

  it('an unknown/new key defaults to the conservative pass-2 bound', () => {
    expect(dateMaxFor('some_future_question_key', TODAY)).toBe('2027-12-31')
  })
})

describe('regression — the year-22000 typo class stays dead everywhere', () => {
  it('22000-12-12 exceeds the max for every key, future-oriented or not', () => {
    for (const key of [...FUTURE_ORIENTED_DATE_KEYS, 'geburtsdatum', 'birthdate']) {
      expect('22000-12-12' > dateMaxFor(key, TODAY)).toBe(true)
    }
  })

  it('DATE_MIN still floors at 1900', () => {
    expect(DATE_MIN).toBe('1900-01-01')
    expect('1899-12-31' < DATE_MIN).toBe(true)
  })
})

describe('isValidIsoDate — real calendar dates only', () => {
  it('accepts real dates incl. leap-day', () => {
    for (const v of ['2031-05-01', '1900-01-01', '2028-02-29', '2027-12-31']) {
      expect(isValidIsoDate(v), v).toBe(true)
    }
  })

  it('rejects rollover dates the format regex alone would admit', () => {
    for (const v of [
      '2026-02-30',
      '2026-02-31',
      '2027-04-31',
      '2026-13-01',
      '2026-00-10',
      '2029-02-29',
    ]) {
      expect(isValidIsoDate(v), v).toBe(false)
    }
  })

  it('rejects non-ISO formats and garbage', () => {
    for (const v of ['22000-12-12', '2026-1-5', '05/01/2031', 'May 1 2031', '', '2026-02']) {
      expect(isValidIsoDate(v), v).toBe(false)
    }
  })
})
