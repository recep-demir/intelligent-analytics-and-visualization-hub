/**
 * helpers/api.ts
 * --------------
 * QA Sprint 2 — Heba
 *
 * Shared helper functions used by all test files.
 * Every test imports from here instead of duplicating fetch logic.
 *
 * EXPECTED TO PASS WHEN:
 *   ✅ login()    — passes once Recep (Dev B) delivers POST /auth/login
 *   ✅ getToken() — passes once login() works (depends on Recep)
 *   ✅ aiQuery()  — passes once Recep delivers POST /ai/query
 *   ✅ get()      — passes once Recep delivers the requested route
 *
 * These helpers have no tests of their own — they just make
 * the HTTP calls so test files stay clean and readable.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { TEST_USERS } = require('../fixtures/seed') as { TEST_USERS: TestUser[] }

const API_URL = process.env.API_URL ?? 'http://localhost:4000'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Role = 'admin' | 'analyst' | 'viewer'

interface TestUser {
  id:       string
  username: string
  email:    string
  password: string
  role:     Role
  active:   boolean
}

export interface LoginResult {
  status: number
  token:  string | undefined
  user:   { id: string; email: string; role: Role } | undefined
  body:   Record<string, unknown>
}

export interface ApiResult<T = Record<string, unknown>> {
  status: number
  body:   T | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * POST /auth/login
 * Returns status, JWT token string, user object, and raw body.
 */
async function login(email: string, password: string): Promise<LoginResult> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email, password }),
  })
  const data = (await res.json()) as LoginResult['body']
  return {
    status: res.status,
    token:  data.token  as string | undefined,
    user:   data.user   as LoginResult['user'],
    body:   data,
  }
}

/**
 * Shortcut: get a valid token for a given role using test users.
 * role: "admin" | "analyst" | "viewer"
 */
async function getToken(role: Role): Promise<string> {
  const user = TEST_USERS.find((u) => u.role === role)
  if (!user) throw new Error(`No test user found for role: ${role}`)
  const { token } = await login(user.email, user.password)
  if (!token) throw new Error(`Login failed for ${role} — is the backend running?`)
  return token
}

/**
 * POST /ai/query
 * Sends a natural language question with a Bearer token.
 * Returns { status, body } so tests can check both.
 */
async function aiQuery(question: string, token: string | null): Promise<ApiResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_URL}/api/ai/query`, {
    method:  'POST',
    headers,
    body:    JSON.stringify({ nl: question }),
  })

  let body: Record<string, unknown> | null
  try {
    body = (await res.json()) as Record<string, unknown>
  } catch {
    body = null
  }

  return { status: res.status, body }
}

/**
 * GET request helper with optional auth token.
 */
async function get(path: string, token: string | null): Promise<ApiResult> {
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_URL}${path}`, { headers })

  let body: Record<string, unknown> | null
  try {
    body = (await res.json()) as Record<string, unknown>
  } catch {
    body = null
  }

  return { status: res.status, body }
}

module.exports = { login, getToken, aiQuery, get, API_URL }
