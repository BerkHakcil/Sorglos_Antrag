/**
 * Phase D storage-path tests (feedback pass 3, item 11).
 *
 * Covers the D-1 design matrix plus the four founder-required additions:
 * concurrent allocation, hostile bank names, deleted-file numbering, and the
 * nested-path trio — each of the last three written so it FAILS against the
 * old one-level behaviour.
 */

import { describe, it, expect } from 'vitest'
import {
  allocateNumber,
  buildBase,
  buildObjectKey,
  extensionFor,
  folderFor,
  listAllObjectPaths,
  sanitizeSegment,
  type SeqKey,
  type SeqStore,
  type StorageEntry,
} from '@/lib/storage-path'

const CASE = '2c8a5ca2-51c1-4c17-baf5-6418daeece91'

// ── Sanitizer ────────────────────────────────────────────────────────────────

describe('sanitizeSegment — umlauts and diacritics', () => {
  it('transliterates German umlauts (filenames only — DB copy keeps them)', () => {
    expect(sanitizeSegment('Kontoauszüge', 60)).toBe('Kontoauszuege')
    expect(sanitizeSegment('Mobilitätsnachweis', 60)).toBe('Mobilitaetsnachweis')
    expect(sanitizeSegment('Übertragungsvertrag', 60)).toBe('Uebertragungsvertrag')
    expect(sanitizeSegment('Finanzstatus/Saldenübersicht', 60)).toBe('FinanzstatusSaldenuebersicht')
  })

  it('transliterates ß to ss', () => {
    expect(sanitizeSegment('Straße', 60)).toBe('Strasse')
    expect(sanitizeSegment('Nießbrauch', 60)).toBe('Niessbrauch')
  })

  it('strips non-German diacritics', () => {
    expect(sanitizeSegment('Café Renté', 60)).toBe('CafeRente')
  })
})

describe('sanitizeSegment — separators and specials', () => {
  it('collapses slashes, spaces, hyphens and colons into PascalCase', () => {
    expect(sanitizeSegment('Renten/Pensionsbescheid', 60)).toBe('RentenPensionsbescheid')
    expect(sanitizeSegment('Pflegegutachten MDK', 60)).toBe('PflegegutachtenMDK')
    expect(sanitizeSegment('Kranken-/Pflegeversicherung', 60)).toBe('KrankenPflegeversicherung')
    expect(sanitizeSegment('Rente 1: Altersrente', 30)).toBe('Rente1Altersrente')
    expect(sanitizeSegment('Vertretungsvollmacht / Betreuungsnachweis', 60)).toBe(
      'VertretungsvollmachtBetreuungsnachweis'
    )
  })

  it('caps length without cutting mid-word when a boundary is near', () => {
    const long = sanitizeSegment(
      'Beitragsbescheid freiwillige/private Kranken-/Pflegeversicherung',
      60
    )
    expect(long.length).toBeLessThanOrEqual(60)
    expect(long.startsWith('BeitragsbescheidFreiwilligePrivate')).toBe(true)
  })

  it('returns empty string when nothing survives (callers fall back)', () => {
    expect(sanitizeSegment('***', 60)).toBe('')
    expect(sanitizeSegment('///', 60)).toBe('')
    expect(sanitizeSegment('', 60)).toBe('')
  })
})

// ── FOUNDER ADDITION: hostile bank names (user-typed free text) ──────────────

describe('hostile instance labels — user-typed bank names', () => {
  const cases: [string, string][] = [
    ['../../etc/passwd', 'EtcPasswd'],
    ['a/b\\c', 'ABC'],
    ['file.tar.gz', 'FileTarGz'],
    ['Sparkasse Berlin', 'SparkasseBerlin'],
    ['Bank "quoted" name', 'BankQuotedName'],
    ['Bank\u0000Konto', 'BankKonto'], // embedded NUL byte
    ['Bank\r\nKonto', 'BankKonto'], // CRLF injection attempt
  ]
  for (const [input, expected] of cases) {
    it(`sanitizes ${JSON.stringify(input)} -> ${expected}`, () => {
      expect(sanitizeSegment(input, 30)).toBe(expected)
    })
  }

  it('emoji and zero-width characters are dropped entirely', () => {
    expect(sanitizeSegment('Bank 🏦💰 Konto', 30)).toBe('BankKonto')
    expect(sanitizeSegment('Bank​Konto', 30)).toBe('BankKonto')
  })

  it('a 200-char name is capped at the label limit', () => {
    const out = sanitizeSegment('A'.repeat(200), 30)
    expect(out.length).toBeLessThanOrEqual(30)
  })

  it('never yields a path separator or a traversal segment', () => {
    for (const nasty of ['../..', 'a/../b', 'x\\y', '..', './.']) {
      const out = sanitizeSegment(nasty, 30)
      expect(out).not.toContain('/')
      expect(out).not.toContain('\\')
      expect(out).not.toContain('..')
    }
  })

  it('PURE-SYMBOL bank name falls back — the key never gets an empty segment', () => {
    const base = buildBase({
      nameDe: 'Kontoauszüge',
      instanceLabel: '***',
      technicalKey: 'bank_statements',
      documentId: 'DOC-0003',
    })
    // label sanitises to '' → no dangling underscore, type part still present
    expect(base).toBe('Kontoauszuege')
    expect(base.endsWith('_')).toBe(false)
  })

  it('pure-symbol DOCUMENT name falls back to technical_key, then to the id', () => {
    expect(
      buildBase({ nameDe: '***', technicalKey: 'bank_statements', documentId: 'DOC-0003' })
    ).toBe('BankStatements')
    expect(buildBase({ nameDe: '///', technicalKey: '///', documentId: 'DOC-0003' })).toBe(
      'DOC0003'
    )
  })
})

// ── Folder mapping + Spouse override ─────────────────────────────────────────

describe('folderFor', () => {
  it('uses the catalog category for person_1', () => {
    expect(folderFor('Financial', 'person_1')).toBe('Financial')
    expect(folderFor('Housing', 'person_1')).toBe('Housing')
    expect(folderFor('Insurance', 'person_1')).toBe('Insurance')
    expect(folderFor('Personal', 'person_1')).toBe('Personal')
  })

  it('overrides ANY category to Spouse for person_2', () => {
    expect(folderFor('Personal', 'person_2')).toBe('Spouse')
    expect(folderFor('Financial', 'person_2')).toBe('Spouse')
    expect(folderFor('Insurance', 'person_2')).toBe('Spouse')
  })

  it('does NOT override previous_home (Mietvertrag stays in Housing)', () => {
    expect(folderFor('Housing', 'previous_home')).toBe('Housing')
  })
})

// ── Base + instance labels ───────────────────────────────────────────────────

describe('buildBase', () => {
  it('type only when the slot has no instance label', () => {
    expect(buildBase({ nameDe: 'Heimvertrag', documentId: 'DOC-0007' })).toBe('Heimvertrag')
  })

  it('appends the instance label after an underscore', () => {
    expect(
      buildBase({ nameDe: 'Kontoauszüge', instanceLabel: 'Girokonto', documentId: 'DOC-0003' })
    ).toBe('Kontoauszuege_Girokonto')
    expect(
      buildBase({ nameDe: 'Kontoauszüge', instanceLabel: 'Sparkonto', documentId: 'DOC-0003' })
    ).toBe('Kontoauszuege_Sparkonto')
  })

  it('per-pension slots keep their entry ordinal (accepted double-number quirk)', () => {
    const base = buildBase({
      nameDe: 'Renten/Pensionsbescheid',
      instanceLabel: 'Rente 1: Altersrente',
      documentId: 'DOC-0002',
    })
    expect(base).toBe('RentenPensionsbescheid_Rente1Altersrente')
    expect(buildObjectKey({ caseId: CASE, folder: 'Financial', base, n: 1, ext: 'pdf' })).toBe(
      `${CASE}/Financial/RentenPensionsbescheid_Rente1Altersrente1.pdf`
    )
  })
})

// ── Extension ────────────────────────────────────────────────────────────────

describe('extensionFor', () => {
  it('takes the extension from the filename, lowercased', () => {
    expect(extensionFor('Scan.PDF', 'application/pdf')).toBe('pdf')
    expect(extensionFor('foto.JPG', 'image/jpeg')).toBe('jpg')
  })

  it('preserves .jpeg rather than normalising it to .jpg', () => {
    expect(extensionFor('bild.jpeg', 'image/jpeg')).toBe('jpeg')
  })

  it('falls back to the MIME type when the filename has none (desktop HEIC)', () => {
    expect(extensionFor('IMG_0001', 'image/heic')).toBe('heic')
    expect(extensionFor('scan', 'application/pdf')).toBe('pdf')
  })

  it('omits the extension rather than inventing one', () => {
    expect(extensionFor('mystery', 'application/octet-stream')).toBeNull()
    expect(
      buildObjectKey({ caseId: CASE, folder: 'Housing', base: 'Heimvertrag', n: 1, ext: null })
    ).toBe(`${CASE}/Housing/Heimvertrag1`)
  })
})

// ── Object key ───────────────────────────────────────────────────────────────

describe('buildObjectKey', () => {
  it('produces the designed shape, case id first (storage RLS depends on it)', () => {
    const key = buildObjectKey({
      caseId: CASE,
      folder: 'Personal',
      base: 'Personaldokument',
      n: 1,
      ext: 'jpeg',
    })
    expect(key).toBe(`${CASE}/Personal/Personaldokument1.jpeg`)
    expect(key.split('/')[0]).toBe(CASE)
  })

  it('Spouse and Personal keys of the same document coexist', () => {
    const a = buildObjectKey({
      caseId: CASE,
      folder: 'Personal',
      base: 'Personaldokument',
      n: 1,
      ext: 'pdf',
    })
    const b = buildObjectKey({
      caseId: CASE,
      folder: 'Spouse',
      base: 'Personaldokument',
      n: 1,
      ext: 'pdf',
    })
    expect(a).not.toBe(b)
  })
})

// ── Numbering ────────────────────────────────────────────────────────────────

/** In-memory store mimicking the PostgREST semantics (unique insert + CAS). */
function fakeStore(initial: Record<string, number> = {}) {
  const rows = new Map<string, number>(Object.entries(initial))
  const k = (key: SeqKey) => `${key.caseId}|${key.folder}|${key.base}`
  let reads = 0
  const store: SeqStore = {
    async read(key) {
      reads++
      return rows.has(k(key)) ? rows.get(k(key))! : null
    },
    async insertFirst(key) {
      if (rows.has(k(key))) return 'conflict'
      rows.set(k(key), 1)
      return 'inserted'
    },
    async bump(key, from) {
      const cur = rows.get(k(key))
      if (cur !== from) return null // lost the race — CAS guard
      rows.set(k(key), from + 1)
      return from + 1
    },
  }
  return { store, rows, k, reads: () => reads }
}

describe('allocateNumber', () => {
  it('first allocation is 1, then 2, 3', async () => {
    const { store } = fakeStore()
    const key = { caseId: CASE, folder: 'Housing', base: 'Heimvertrag' }
    expect(await allocateNumber(store, key)).toBe(1)
    expect(await allocateNumber(store, key)).toBe(2)
    expect(await allocateNumber(store, key)).toBe(3)
  })

  it('counters are folder-scoped: Spouse starts at 1 while Personal is at 2', async () => {
    const { store } = fakeStore()
    await allocateNumber(store, { caseId: CASE, folder: 'Personal', base: 'Personaldokument' })
    await allocateNumber(store, { caseId: CASE, folder: 'Personal', base: 'Personaldokument' })
    expect(
      await allocateNumber(store, { caseId: CASE, folder: 'Spouse', base: 'Personaldokument' })
    ).toBe(1)
  })

  it('counters are instance-scoped: Girokonto and Sparkonto each start at 1', async () => {
    const { store } = fakeStore()
    expect(
      await allocateNumber(store, {
        caseId: CASE,
        folder: 'Financial',
        base: 'Kontoauszuege_Girokonto',
      })
    ).toBe(1)
    expect(
      await allocateNumber(store, {
        caseId: CASE,
        folder: 'Financial',
        base: 'Kontoauszuege_Sparkonto',
      })
    ).toBe(1)
  })

  it('counters are case-scoped', async () => {
    const { store } = fakeStore()
    await allocateNumber(store, { caseId: CASE, folder: 'Housing', base: 'Heimvertrag' })
    expect(
      await allocateNumber(store, { caseId: 'other-case', folder: 'Housing', base: 'Heimvertrag' })
    ).toBe(1)
  })
})

// ── FOUNDER ADDITION: concurrent allocation ─────────────────────────────────

describe('allocateNumber — concurrency', () => {
  it('two parallel uploads to the same slot get 1 and 2 (never the same key)', async () => {
    const { store } = fakeStore()
    const key = { caseId: CASE, folder: 'Housing', base: 'Heimvertrag' }
    const [a, b] = await Promise.all([allocateNumber(store, key), allocateNumber(store, key)])
    expect([a, b].sort()).toEqual([1, 2])
  })

  it('eight parallel uploads get eight distinct, contiguous numbers', async () => {
    const { store } = fakeStore()
    const key = { caseId: CASE, folder: 'Financial', base: 'Kontoauszuege_Girokonto' }
    const got = await Promise.all(Array.from({ length: 8 }, () => allocateNumber(store, key)))
    expect(new Set(got).size).toBe(8)
    expect([...got].sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('a lost insert race is retried rather than surfacing an error', async () => {
    const { store, rows } = fakeStore()
    const key = { caseId: CASE, folder: 'Personal', base: 'Personaldokument' }
    // Simulate: our read says "absent", but another writer inserts first.
    const original = store.read.bind(store)
    let firstRead = true
    store.read = async (k) => {
      if (firstRead) {
        firstRead = false
        rows.set(`${k.caseId}|${k.folder}|${k.base}`, 1) // the other writer won
        return null // …but we already saw "absent"
      }
      return original(k)
    }
    expect(await allocateNumber(store, key)).toBe(2)
  })

  it('gives up loudly instead of returning a duplicate under pathological contention', async () => {
    const store: SeqStore = {
      read: async () => 5,
      insertFirst: async () => 'conflict',
      bump: async () => null, // every CAS loses
    }
    await expect(
      allocateNumber(store, { caseId: CASE, folder: 'Housing', base: 'Heimvertrag' }, 3)
    ).rejects.toThrow(/gave up after 3 contended attempts/)
  })

  it('is BOUNDED: it stops after exactly maxAttempts, it does not spin', async () => {
    let reads = 0
    const store: SeqStore = {
      read: async () => {
        reads++
        return 5
      },
      insertFirst: async () => 'conflict',
      bump: async () => null,
    }
    await expect(
      allocateNumber(store, { caseId: CASE, folder: 'Housing', base: 'Heimvertrag' }, 4)
    ).rejects.toThrow()
    expect(reads).toBe(4)
  })

  it('the failure message leaks NO user data — the bank name never reaches logs', async () => {
    const bankName = 'SparkasseGeheimKundeMueller' // sanitized user-typed bank name
    const store: SeqStore = {
      read: async () => 1,
      insertFirst: async () => 'conflict',
      bump: async () => null,
    }
    const err = await allocateNumber(
      store,
      { caseId: CASE, folder: 'Financial', base: `Kontoauszuege_${bankName}` },
      2
    ).catch((e: Error) => e)
    expect(err).toBeInstanceOf(Error)
    const message = (err as Error).message
    expect(message).not.toContain(bankName)
    expect(message).not.toContain(CASE) // no case id either
    expect(message).toContain('Financial') // the fixed folder constant is fine
  })
})

// ── FOUNDER ADDITION: deleted-file numbering ────────────────────────────────

describe('numbering after deletion — numbers are never reused', () => {
  it('delete Heimvertrag2 → the next upload is Heimvertrag3', async () => {
    const { store } = fakeStore()
    const key = { caseId: CASE, folder: 'Housing', base: 'Heimvertrag' }
    const n1 = await allocateNumber(store, key)
    const n2 = await allocateNumber(store, key)
    expect([n1, n2]).toEqual([1, 2])

    // deleteUploadAction removes the object + metadata row but NEVER touches
    // the counter — modelled here by simply not calling the store.
    const n3 = await allocateNumber(store, key)
    expect(n3).toBe(3)
    expect(n3).not.toBe(n2)
  })

  it('deleting every file still does not restart numbering', async () => {
    const { store } = fakeStore()
    const key = { caseId: CASE, folder: 'Personal', base: 'Personaldokument' }
    for (let i = 0; i < 5; i++) await allocateNumber(store, key)
    expect(await allocateNumber(store, key)).toBe(6)
  })
})

// ── FOUNDER ADDITION: nested-path listing ───────────────────────────────────

describe('listAllObjectPaths — nested keys (one-level listing would miss them)', () => {
  /** Mimics Supabase Storage: one level per call, folders have id === null. */
  const tree: Record<string, StorageEntry[]> = {
    [CASE]: [
      { name: 'Personal', id: null },
      { name: 'Financial', id: null },
      { name: 'legacy-uuid.pdf', id: 'obj-legacy' },
    ],
    [`${CASE}/Personal`]: [
      { name: 'Personaldokument1.jpeg', id: 'obj-1' },
      { name: 'Personaldokument2.pdf', id: 'obj-2' },
    ],
    [`${CASE}/Financial`]: [{ name: 'Kontoauszuege_Girokonto1.pdf', id: 'obj-3' }],
  }
  const listFn = async (prefix: string) => tree[prefix] ?? []

  it('finds every nested object AND the grandfathered flat one', async () => {
    const paths = await listAllObjectPaths(listFn, CASE)
    expect(paths.sort()).toEqual(
      [
        `${CASE}/Financial/Kontoauszuege_Girokonto1.pdf`,
        `${CASE}/Personal/Personaldokument1.jpeg`,
        `${CASE}/Personal/Personaldokument2.pdf`,
        `${CASE}/legacy-uuid.pdf`,
      ].sort()
    )
  })

  it('PROOF the fix is load-bearing: a one-level listing finds 0 of the 3 nested files', async () => {
    const oneLevel = (await listFn(CASE))
      .filter((e) => e.id !== null)
      .map((e) => `${CASE}/${e.name}`)
    expect(oneLevel).toEqual([`${CASE}/legacy-uuid.pdf`]) // only the legacy file
    const recursive = await listAllObjectPaths(listFn, CASE)
    expect(recursive.length).toBe(4)
    expect(recursive.length - oneLevel.length).toBe(3) // 3 objects would have leaked
  })

  it('returns an empty list for an empty prefix', async () => {
    expect(await listAllObjectPaths(listFn, 'unknown-case')).toEqual([])
  })

  it('honours maxDepth so a pathological tree cannot recurse forever', async () => {
    const selfRef = async () => [{ name: 'deeper', id: null }] as StorageEntry[]
    expect(await listAllObjectPaths(selfRef, 'x', 3)).toEqual([])
  })
})

// ── recordUploadAction dir/base split (nested-key verify fix) ────────────────

describe('upload verify split — dir/base from the LAST slash', () => {
  const split = (path: string) => {
    const i = path.lastIndexOf('/')
    return { dir: path.slice(0, i), base: path.slice(i + 1) }
  }

  it('nested key splits into the category folder and the filename', () => {
    expect(split(`${CASE}/Personal/Personaldokument1.pdf`)).toEqual({
      dir: `${CASE}/Personal`,
      base: 'Personaldokument1.pdf',
    })
  })

  it('legacy flat key still splits to the case prefix (grandfathering)', () => {
    expect(split(`${CASE}/abc-123.pdf`)).toEqual({ dir: CASE, base: 'abc-123.pdf' })
  })

  it('PROOF the fix is load-bearing: the old split produced a base with a slash', () => {
    const path = `${CASE}/Personal/Personaldokument1.pdf`
    const oldBase = path.slice(CASE.length + 1) // the pre-fix computation
    expect(oldBase).toBe('Personal/Personaldokument1.pdf')
    expect(oldBase).toContain('/') // list(dir, {search}) can never match this
    expect(split(path).base).not.toContain('/')
  })
})

// ── case-export naming ──────────────────────────────────────────────────────

describe('case-export filename derivation', () => {
  // mirrors exportFileName() in scripts/case-export.mjs
  const exportName = (u: {
    storage_path: string
    rule_id: string
    instance_key: string
    original_filename: string
  }) => {
    const s = u.storage_path.split('/')
    const raw =
      s.length >= 3
        ? `${s[s.length - 2]}_${s[s.length - 1]}`
        : `${u.rule_id}_${u.instance_key}_${u.original_filename}`
    return raw.replace(/[^\w.\-äöüÄÖÜß ]/g, '_')
  }

  it('new-scheme files are named {Category}_{Base}{n}.{ext}, no rule prefix', () => {
    expect(
      exportName({
        storage_path: `${CASE}/Personal/Personaldokument1.jpeg`,
        rule_id: 'PAN-001',
        instance_key: 'default',
        original_filename: 'IMG_8449.jpeg',
      })
    ).toBe('Personal_Personaldokument1.jpeg')
  })

  it('Personal and Spouse copies of one document do NOT collide in the flat export dir', () => {
    const a = exportName({
      storage_path: `${CASE}/Personal/Personaldokument1.pdf`,
      rule_id: 'PAN-001',
      instance_key: 'default',
      original_filename: 'x.pdf',
    })
    const b = exportName({
      storage_path: `${CASE}/Spouse/Personaldokument1.pdf`,
      rule_id: 'PAN-002',
      instance_key: 'default',
      original_filename: 'y.pdf',
    })
    expect(a).not.toBe(b)
  })

  it('legacy UUID files keep the rule_instance_original naming', () => {
    expect(
      exportName({
        storage_path: `${CASE}/cdf9a394-03cc-4222-ab61-4e6cb53d9427.jpeg`,
        rule_id: 'PAN-001',
        instance_key: 'default',
        original_filename: 'gisma_logo.jpeg',
      })
    ).toBe('PAN-001_default_gisma_logo.jpeg')
  })
})
