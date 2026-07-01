/**
 * Creates a pre-confirmed test user for the Playwright completion test.
 * Uses the service-role key so the user is confirmed immediately (no email needed).
 * Run: node scripts/create-test-user.mjs
 *
 * Writes the credentials to .playwright-test-user.json so the test can read them.
 */

import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'fs'

const SUPABASE_URL = 'https://srtgqgueigyucanfzodb.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNydGdxZ3VlaWd5dWNhbmZ6b2RiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDg1MTg5NSwiZXhwIjoyMDk2NDI3ODk1fQ.XLw1_2NaUFhuRSjA92SQufYJ2TY3NCrLLGbp78ONy0Q'

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const email = `pw-completion+${Date.now()}@hzp-test.invalid`
const password = 'TestPassw0rd!'

console.log(`Creating test user: ${email}`)

// Create user via admin API — email_confirm: true skips email verification
const { data: userData, error: userErr } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { first_name: 'Playwright', last_name: 'Completion' },
})

if (userErr) {
  console.error('Failed to create user:', userErr.message)
  process.exit(1)
}

const userId = userData.user.id
console.log(`User created: ${userId}`)

// Update profile with phone and consent timestamps (trigger already created the row)
const now = new Date().toISOString()
const { error: profileErr } = await admin
  .from('profiles')
  .update({
    phone: '+4915123456789',
    consent_datenschutz_at: now,
    consent_agb_at: now,
    consent_data_processing_at: now,
    consent_authority_to_act_at: now,
  })
  .eq('id', userId)

if (profileErr) {
  console.error('Profile update failed:', profileErr.message)
  process.exit(1)
}

console.log('Profile updated')

// Verify case was created by trigger
const { data: caseData, error: caseErr } = await admin
  .from('cases')
  .select('id, status')
  .eq('user_id', userId)
  .single()

if (caseErr || !caseData) {
  console.error('Case not found:', caseErr?.message)
  process.exit(1)
}

console.log(`Case created: ${caseData.id} (status: ${caseData.status})`)

// Write credentials for Playwright test
const output = { email, password, userId, caseId: caseData.id }
writeFileSync('.playwright-test-user.json', JSON.stringify(output, null, 2))
console.log('Credentials written to .playwright-test-user.json')
console.log(JSON.stringify(output, null, 2))
