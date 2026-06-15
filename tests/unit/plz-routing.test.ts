import { describe, it, expect } from 'vitest'
import { resolveOffice, type PlzRule } from '@/lib/plz-resolver'

// ─── Fixtures ─────────────────────────────────────────────

const FRANKFURT: PlzRule = {
  plz_from: '60001',
  plz_to: '60699',
  priority: 10,
  social_office_id: 'ffm',
}
const MUNICH: PlzRule = {
  plz_from: '80001',
  plz_to: '81999',
  priority: 10,
  social_office_id: 'muc',
}

// ─── Tests ────────────────────────────────────────────────

describe('resolveOffice — basic range matching', () => {
  it('matches a PLZ inside a range', () => {
    expect(resolveOffice('60385', [FRANKFURT])).toBe('ffm')
  })

  it('matches the lower boundary exactly', () => {
    expect(resolveOffice('60001', [FRANKFURT])).toBe('ffm')
  })

  it('matches the upper boundary exactly', () => {
    expect(resolveOffice('60699', [FRANKFURT])).toBe('ffm')
  })

  it('returns null when PLZ is above all ranges', () => {
    expect(resolveOffice('99999', [FRANKFURT])).toBeNull()
  })

  it('returns null when PLZ is below all ranges', () => {
    expect(resolveOffice('00001', [FRANKFURT])).toBeNull()
  })

  it('returns null for an empty rule list', () => {
    expect(resolveOffice('60385', [])).toBeNull()
  })
})

describe('resolveOffice — multiple rules', () => {
  it('picks the correct rule from two non-overlapping ranges', () => {
    expect(resolveOffice('80331', [FRANKFURT, MUNICH])).toBe('muc')
    expect(resolveOffice('60318', [FRANKFURT, MUNICH])).toBe('ffm')
  })

  it('returns null for a PLZ between two non-overlapping ranges', () => {
    // 70000 is between Frankfurt (60001–60699) and Munich (80001–81999)
    expect(resolveOffice('70000', [FRANKFURT, MUNICH])).toBeNull()
  })
})

describe('resolveOffice — priority ordering', () => {
  const BROAD: PlzRule = {
    plz_from: '60000',
    plz_to: '69999',
    priority: 5,
    social_office_id: 'broad',
  }
  const NARROW: PlzRule = {
    plz_from: '60300',
    plz_to: '60399',
    priority: 20,
    social_office_id: 'narrow',
  }

  it('higher priority wins when ranges overlap', () => {
    // 60318 matches both BROAD and NARROW; NARROW has higher priority
    expect(resolveOffice('60318', [BROAD, NARROW])).toBe('narrow')
  })

  it('falls back to lower-priority rule outside the narrow range', () => {
    // 60100 matches only BROAD
    expect(resolveOffice('60100', [BROAD, NARROW])).toBe('broad')
  })

  it('returns the same result regardless of rule array order', () => {
    expect(resolveOffice('60318', [NARROW, BROAD])).toBe('narrow')
  })
})

describe('resolveOffice — single-code rule (plz_from === plz_to)', () => {
  const SINGLE: PlzRule = {
    plz_from: '12345',
    plz_to: '12345',
    priority: 10,
    social_office_id: 'single',
  }

  it('matches the exact code', () => {
    expect(resolveOffice('12345', [SINGLE])).toBe('single')
  })

  it('does not match adjacent codes', () => {
    expect(resolveOffice('12344', [SINGLE])).toBeNull()
    expect(resolveOffice('12346', [SINGLE])).toBeNull()
  })
})

describe('resolveOffice — Berlin individual-code rules', () => {
  // Simulates how the DB seed stores individual Berlin PLZs
  const BERLIN_MITTE: PlzRule = {
    plz_from: '10115',
    plz_to: '10115',
    priority: 10,
    social_office_id: 'berlin',
  }
  const BERLIN_PANKOW: PlzRule = {
    plz_from: '13187',
    plz_to: '13187',
    priority: 10,
    social_office_id: 'berlin',
  }
  const rules = [BERLIN_MITTE, BERLIN_PANKOW]

  it('routes a Berlin Mitte PLZ to the Berlin office', () => {
    expect(resolveOffice('10115', rules)).toBe('berlin')
  })

  it('routes a Berlin Pankow PLZ to the Berlin office', () => {
    expect(resolveOffice('13187', rules)).toBe('berlin')
  })

  it('returns null for a PLZ not in Berlin (no matching rule → fallback)', () => {
    expect(resolveOffice('45326', rules)).toBeNull()
  })
})

describe('resolveOffice — real care-home PLZ scenarios (from plz_de.xlsx)', () => {
  // Mirrors the structure produced by migration 20260615000001:
  // each PLZ is a single-code rule (plz_from === plz_to), all priority 1.
  const BERLIN: PlzRule  = { plz_from: '13187', plz_to: '13187', priority: 1, social_office_id: 'berlin' }
  const ESSEN: PlzRule   = { plz_from: '45326', plz_to: '45326', priority: 1, social_office_id: 'essen' }
  const RECKLING: PlzRule = { plz_from: '45968', plz_to: '45968', priority: 1, social_office_id: 'reck' }
  const DUISBURG: PlzRule = { plz_from: '47198', plz_to: '47198', priority: 1, social_office_id: 'du' }
  const STADE: PlzRule   = { plz_from: '21680', plz_to: '21680', priority: 1, social_office_id: 'stade' }
  const allRules = [BERLIN, ESSEN, RECKLING, DUISBURG, STADE]

  it('routes 13187 (Haus Pankow) to Berlin', () => {
    expect(resolveOffice('13187', allRules)).toBe('berlin')
  })

  it('routes 45326 (Altenessen) to Essen — from Excel', () => {
    expect(resolveOffice('45326', allRules)).toBe('essen')
  })

  it('routes 45968 (Brauck) to Recklinghausen — from Excel', () => {
    expect(resolveOffice('45968', allRules)).toBe('reck')
  })

  it('routes 47198 (Homberg/Feldstraße) to Duisburg — from Excel', () => {
    expect(resolveOffice('47198', allRules)).toBe('du')
  })

  it('routes 21680 (Stade) to Stade — from Excel', () => {
    expect(resolveOffice('21680', allRules)).toBe('stade')
  })

  it('returns null for a nonsense PLZ (00000) — unclear, fallback continues', () => {
    expect(resolveOffice('00000', allRules)).toBeNull()
  })

  it('returns null for a valid-format but unregistered PLZ — fallback continues', () => {
    // 99999 does not appear in the care-home subset; resolver returns null → fallback
    expect(resolveOffice('99999', allRules)).toBeNull()
  })
})
