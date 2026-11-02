/**
 * Host half of dsh-usage-quota.
 *
 * One authenticated same-origin route answers the quota of whichever provider
 * the composer is currently using. API keys never leave the host process: the
 * browser names a provider route id, this handler picks that provider's
 * adapter, resolves the credential, and calls the provider's usage endpoint.
 *
 * Built-in adapters:
 * - `opencode-go` — OpenCode Go subscription windows (5h / weekly / monthly).
 *   The usage endpoint is Bearer-only, the opposite of its inference side,
 *   which only accepts `x-api-key`.
 * - `balance` — any OpenAI-compatible prepaid balance endpoint whose response
 *   carries a numeric `balance`, `remaining`, or `quota.remaining` field.
 *
 * @module dsh-usage-quota
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

/** Route path; kept out of `/api` so it never collides with the Connection bridge. */
const ROUTE_PATH = '/x-usage'

/** Upstream request budget. The pill refreshes itself, so waiting longer buys nothing. */
const UPSTREAM_TIMEOUT_MS = 15_000

/** Settings live in the Harness home, never inside the installed package. */
const SETTINGS_FILENAME = 'dsh-usage-quota.json'

/** Required host services: the HTTP carrier, its trust checks, and credentials. */
export const inject = ['webServer', 'connection', 'credentials']

/** Adapters shipped with the plugin. `balance` needs an endpoint from config. */
const ADAPTERS = {
  'opencode-go': {
    label: 'OpenCode Go',
    endpoint: 'https://opencode.ai/zen/go/v1/usage',
    apiKeyRef: 'OPENCODE_GO_API_KEY',
  },
  balance: {
    label: 'Balance',
  },
}

/** Usage windows OpenCode Go reports, in display order. */
const OPENCODE_GO_WINDOWS = [
  ['rolling', '5 小时', '5h'],
  ['weekly', '每周', '周'],
  ['monthly', '每月', '月'],
]

/**
 * Resolve the settings file path inside the Harness home.
 * @returns absolute file path.
 */
function settingsPath() {
  const home = process.env.DSH_HOME !== undefined && process.env.DSH_HOME !== ''
    ? process.env.DSH_HOME
    : join(homedir(), '.dsh')
  return join(home, SETTINGS_FILENAME)
}

/**
 * Read one credential reference, falling back to the process environment.
 * @param ctx - host plugin context.
 * @param ref - credential reference name, e.g. `OPENCODE_GO_API_KEY`.
 * @returns the secret, or undefined when neither source has it.
 */
async function resolveKey(ctx, ref) {
  const credentials = ctx.get('credentials')
  if (credentials !== undefined) {
    const hit = await credentials.resolve(ref).catch(() => undefined)
    if (hit?.value !== undefined && hit.value !== '') return hit.value
  }
  const fromEnv = process.env[ref]
  return fromEnv !== undefined && fromEnv !== '' ? fromEnv : undefined
}

/**
 * Round to one decimal so the wire never carries float dust.
 * @param value - raw numeric value.
 * @returns the rounded value.
 */
function oneDecimal(value) {
  return Math.round(value * 10) / 10
}

/**
 * Validate and normalize the plugin config.
 *
 * A provider route id maps to one adapter: either a shipped adapter name
 * (`opencode-go`) or the generic `balance` adapter with its own endpoint and
 * credential reference. Unknown adapters are rejected here so a typo surfaces
 * at load time instead of as an empty card.
 * @param config - raw plugin config from the patch row.
 * @returns normalized `{ refreshSeconds, providers }`.
 */
export function normalizeConfig(config) {
  const seconds = Number(config?.refreshSeconds ?? 60)
  if (!Number.isFinite(seconds)) throw new Error('refreshSeconds must be a number')
  const refreshSeconds = Math.min(3600, Math.max(30, Math.round(seconds)))

  const providers = {}
  for (const [id, raw] of Object.entries(ADAPTERS)) {
    if (raw.endpoint !== undefined) providers[id] = { kind: id, ...raw }
  }
  for (const [id, raw] of Object.entries(config?.providers ?? {})) {
    if (id === '' || raw === null || typeof raw !== 'object') throw new Error(`provider "${id}" must be an object`)
    const kind = String(raw.kind ?? 'balance')
    const adapter = ADAPTERS[kind]
    if (adapter === undefined) throw new Error(`provider "${id}" names unknown kind "${kind}"`)
    const endpoint = raw.endpoint ?? adapter.endpoint
    if (endpoint === undefined) throw new Error(`provider "${id}" needs an endpoint`)
    const url = new URL(endpoint)
    if (url.protocol !== 'https:' && url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
      throw new Error(`provider "${id}" endpoint must be HTTPS or loopback`)
    }
    const apiKeyRef = String(raw.apiKeyRef ?? adapter.apiKeyRef ?? '')
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(apiKeyRef)) throw new Error(`provider "${id}" needs a valid apiKeyRef`)
    providers[id] = {
      kind,
      label: String(raw.label ?? adapter.label ?? id),
      endpoint: url.href,
      apiKeyRef,
    }
  }
  return { refreshSeconds, providers }
}

/**
 * Query the OpenCode Go subscription windows.
 *
 * The upstream shape is undocumented, so each window is parsed defensively: a
 * missing or unparsable window is skipped instead of failing the whole card. A
 * zero-used window carries a placeholder reset time, which is dropped so no
 * countdown is shown for an already-expired window.
 * @param spec - resolved provider spec.
 * @param key - provider API key.
 * @param signal - abort signal.
 * @returns the client-facing plan view, or a soft failure the pill can render.
 */
async function readOpencodeGo(spec, key, signal) {
  const response = await fetch(spec.endpoint, {
    headers: { authorization: `Bearer ${key}`, accept: 'application/json' },
    signal,
  })
  // 403 means the key is valid but the workspace holds no Go subscription;
  // 401 is the separate authentication failure.
  if (response.status === 403) return { ok: false, reason: 'no-subscription', error: '该密钥没有 OpenCode Go 订阅' }
  if (response.status === 401) return { ok: false, reason: 'auth', error: 'OpenCode Go 密钥无效' }
  if (!response.ok) return { ok: false, reason: 'http', error: `额度接口返回 HTTP ${response.status}` }

  const body = await response.json()
  const usage = body?.usage
  if (usage === null || typeof usage !== 'object') return { ok: false, reason: 'shape', error: '无法识别的额度响应' }

  const windows = []
  for (const [windowKey, label, short] of OPENCODE_GO_WINDOWS) {
    const window = usage[windowKey]
    if (window === null || typeof window !== 'object') continue
    const used = Number(window.percent)
    if (!Number.isFinite(used)) continue
    const clamped = Math.min(100, Math.max(0, used))
    windows.push({
      key: windowKey,
      label,
      short,
      used: oneDecimal(clamped),
      remaining: oneDecimal(100 - clamped),
      status: typeof window.status === 'string' ? window.status : null,
      resetsAt: clamped > 0 && typeof window.resetsAt === 'string' ? window.resetsAt : null,
    })
  }
  if (windows.length === 0) return { ok: false, reason: 'shape', error: '无法识别的额度响应' }
  return { ok: true, kind: 'plan', plan: spec.label, windows, fetchedAt: Date.now() }
}

/**
 * Query a prepaid balance endpoint.
 * @param spec - resolved provider spec.
 * @param key - provider API key.
 * @param signal - abort signal.
 * @returns the client-facing balance view, or a soft failure.
 */
async function readBalance(spec, key, signal) {
  const response = await fetch(spec.endpoint, {
    headers: { authorization: `Bearer ${key}`, accept: 'application/json' },
    signal,
  })
  if (!response.ok) return { ok: false, reason: 'http', error: `余额接口返回 HTTP ${response.status}` }
  const payload = await response.json()
  const raw = payload?.balance ?? payload?.remaining ?? payload?.quota?.remaining
  const balance = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(balance)) return { ok: false, reason: 'shape', error: '响应中没有可用余额' }
  const daily = Array.isArray(payload?.daily_usage) ? payload.daily_usage : []
  const today = daily.length > 0 ? daily[daily.length - 1] : undefined
  return {
    ok: true,
    kind: 'balance',
    plan: spec.label,
    balance,
    unit: typeof payload?.unit === 'string' ? payload.unit : 'USD',
    today: today === undefined ? null : {
      date: today.date ?? null,
      requests: today.requests ?? null,
      cost: typeof today.actual_cost === 'number' ? today.actual_cost : (typeof today.cost === 'number' ? today.cost : null),
    },
    fetchedAt: Date.now(),
  }
}

/**
 * Resolve the adapter spec for one provider route id.
 *
 * Unknown routes are deliberately unsupported: showing another provider's
 * balance while a different gateway is active is exactly the confusion this
 * plugin avoids. The client hides the pill for that answer.
 * @param providers - configured provider table.
 * @param id - provider route id from the client.
 * @returns the spec, or undefined when this provider has no usage API.
 */
export function resolveProvider(providers, id) {
  if (typeof id !== 'string' || id === '') return undefined
  const spec = providers[id]
  return spec === undefined ? undefined : { ...spec, id }
}

/**
 * Mount the usage route.
 * @param ctx - host plugin context.
 * @param config - plugin config: `refreshSeconds` and optional `providers`.
 */
export function apply(ctx, config) {
  const { refreshSeconds: initialSeconds, providers } = normalizeConfig(config)
  let settings = { refreshSeconds: initialSeconds }
  let cache = new Map()

  try {
    const stored = JSON.parse(readFileSync(settingsPath(), 'utf8'))
    const seconds = Number(stored?.refreshSeconds)
    if (Number.isFinite(seconds)) settings.refreshSeconds = Math.min(3600, Math.max(30, Math.round(seconds)))
  } catch {
    // A missing or corrupt preferences file simply starts from the defaults.
  }

  /**
   * Answer one provider's quota, reusing a recent value.
   * @param providerId - provider route id.
   * @param force - bypass the cache (manual refresh).
   * @param signal - request-scoped abort signal.
   * @returns the client-facing view.
   */
  async function readUsage(providerId, force, signal) {
    const spec = resolveProvider(providers, providerId)
    if (spec === undefined) return { ok: false, reason: 'unsupported', providerId }

    const now = Date.now()
    const hit = cache.get(providerId)
    if (!force && hit !== undefined && now - hit.at < settings.refreshSeconds * 1000) return hit.value

    const key = await resolveKey(ctx, spec.apiKeyRef)
    if (key === undefined) {
      return { ok: false, reason: 'no-key', providerId, error: `未配置密钥 ${spec.apiKeyRef}` }
    }

    const timeout = AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
    const abort = signal === undefined ? timeout : AbortSignal.any([signal, timeout])
    try {
      const value = spec.kind === 'opencode-go'
        ? await readOpencodeGo(spec, key, abort)
        : await readBalance(spec, key, abort)
      const view = { ...value, providerId }
      if (value.ok === true) cache.set(providerId, { at: now, value: view })
      return view
    } catch (error) {
      ctx.logger?.warn?.(`usage-quota: ${spec.id} request failed: ${String(error)}`)
      return { ok: false, reason: 'network', providerId, error: '额度查询网络错误' }
    }
  }

  /**
   * Persist display preferences in the Harness home.
   * @param next - settings to write.
   */
  function saveSettings(next) {
    settings = next
    const target = settingsPath()
    mkdirSync(dirname(target), { recursive: true })
    const temp = `${target}.tmp`
    writeFileSync(temp, JSON.stringify(next, null, 2))
    renameSync(temp, target)
  }

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: ROUTE_PATH,
    handler: async (req, res) => {
      const send = (status, value) => {
        const body = Buffer.from(JSON.stringify(value), 'utf8')
        res.writeHead(status, {
          'content-type': 'application/json; charset=utf-8',
          'content-length': String(body.byteLength),
          'cache-control': 'no-store',
        })
        res.end(body)
      }

      const rejection = ctx.connection.requestRejection(req)
      if (rejection !== undefined) { res.writeHead(rejection); res.end(); return }

      if (req.method === 'POST') {
        try {
          let body = ''
          for await (const chunk of req) { body += chunk; if (body.length > 8192) throw new Error('too large') }
          const seconds = Number(JSON.parse(body)?.refreshSeconds)
          if (!Number.isFinite(seconds)) throw new Error('refreshSeconds required')
          saveSettings({ refreshSeconds: Math.min(3600, Math.max(30, Math.round(seconds))) })
          cache = new Map()
          send(200, { ok: true, settings })
        } catch (error) {
          send(400, { ok: false, error: error instanceof Error ? error.message : 'invalid settings' })
        }
        return
      }
      if (req.method !== 'GET') { send(405, { ok: false, error: 'method not allowed' }); return }

      const url = new URL(req.url ?? ROUTE_PATH, 'http://localhost')
      const providerId = url.searchParams.get('provider') ?? ''
      const controller = new AbortController()
      req.on('close', () => { controller.abort() })
      const value = await readUsage(providerId, url.searchParams.has('refresh'), controller.signal)
      send(200, { ...value, settings })
    },
  }), 'usage-quota: provider-aware quota route')
}
