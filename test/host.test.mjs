import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply, normalizeConfig, resolveProvider } from '../lib/index.js'

/** A config that needs no secrets: one built-in adapter and one balance provider. */
const CONFIG = {
  refreshSeconds: 60,
  providers: {
    'my-relay': { kind: 'balance', label: 'My Relay', endpoint: 'https://relay.example.com/v1/usage', apiKeyRef: 'MY_RELAY_API_KEY' },
  },
}

const KEYS = { OPENCODE_GO_API_KEY: 'test-opencode-key', MY_RELAY_API_KEY: 'test-relay-key' }

/**
 * Mount the plugin with a fake host and a scripted fetch.
 * @param {object} options - route script: `{ status, body }` per URL, or a function.
 * @returns the captured route plus recorded upstream calls.
 */
function mount(options = {}) {
  process.env.DSH_HOME = mkdtempSync(join(tmpdir(), 'dsh-usage-quota-'))
  const calls = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), headers: init.headers ?? {} })
    const scripted = typeof options.respond === 'function' ? options.respond(url, init) : options.respond
    if (scripted instanceof Error) throw scripted
    const status = scripted?.status ?? 200
    const body = scripted?.body ?? {}
    return { ok: status >= 200 && status < 300, status, json: async () => body }
  }
  let route
  const ctx = {
    get: name => (name === 'credentials' ? { resolve: ref => Promise.resolve(KEYS[ref] ? { value: KEYS[ref], source: 'env' } : undefined) } : undefined),
    connection: { requestRejection: () => undefined },
    webServer: { register: value => { route = value; return () => {} } },
    effect: fn => { fn() },
    logger: { warn: () => {} },
  }
  apply(ctx, { ...CONFIG, ...options.config })
  const call = async (path = '/x-usage', method = 'GET', body) => {
    let status, payload
    const request = {
      method,
      url: path,
      headers: {},
      async *[Symbol.asyncIterator]() { if (body !== undefined) yield JSON.stringify(body) },
    }
    request.on = () => {}
    await route.handler(request, { writeHead: value => { status = value }, end: value => { payload = JSON.parse(value) } })
    return { status, payload }
  }
  return { call, calls, restore: () => { globalThis.fetch = originalFetch } }
}

test('config normalization ships the built-in adapter and keeps provider overrides', () => {
  const config = normalizeConfig({})
  assert.equal(config.refreshSeconds, 60)
  assert.equal(config.providers['opencode-go'].endpoint, 'https://opencode.ai/zen/go/v1/usage')
  assert.equal(config.providers['opencode-go'].apiKeyRef, 'OPENCODE_GO_API_KEY')
  assert.equal(normalizeConfig(CONFIG).providers['my-relay'].kind, 'balance')
})

test('config normalization rejects unsafe or incomplete provider entries', () => {
  assert.throws(() => normalizeConfig({ refreshSeconds: 'soon' }), /refreshSeconds/)
  assert.throws(() => normalizeConfig({ providers: { x: { kind: 'nope' } } }), /unknown kind/)
  assert.throws(() => normalizeConfig({ providers: { x: { kind: 'balance' } } }), /needs an endpoint/)
  assert.throws(() => normalizeConfig({ providers: { x: { kind: 'balance', endpoint: 'http://example.com' } } }), /HTTPS or loopback/)
  assert.throws(() => normalizeConfig({ providers: { x: { kind: 'balance', endpoint: 'https://e.com', apiKeyRef: 'bad ref' } } }), /apiKeyRef/)
})

test('unknown providers are unsupported so the client stays silent', () => {
  const providers = normalizeConfig({}).providers
  assert.equal(resolveProvider(providers, 'deepseek-account'), undefined)
  assert.equal(resolveProvider(providers, ''), undefined)
  assert.equal(resolveProvider(providers, 'opencode-go').kind, 'opencode-go')
})

test('opencode-go windows report remaining percentages and drop placeholder reset times', async () => {
  const harness = mount({
    respond: {
      status: 200,
      body: {
        usage: {
          rolling: { status: 'ok', percent: 3, resetsAt: '2030-01-01T00:00:00.000Z' },
          weekly: { status: 'ok', percent: 100, resetsAt: '2030-01-08T00:00:00.000Z' },
          monthly: { status: 'ok', percent: 0, resetsAt: '2030-02-01T00:00:00.000Z' },
        },
      },
    },
  })
  try {
    const { status, payload } = await harness.call('/x-usage?provider=opencode-go')
    assert.equal(status, 200)
    assert.equal(payload.ok, true)
    assert.equal(payload.kind, 'plan')
    assert.deepEqual(payload.windows.map(window => [window.key, window.remaining]), [['rolling', 97], ['weekly', 0], ['monthly', 100]])
    assert.equal(payload.windows[2].resetsAt, null, 'a zero-used window carries no real reset time')
    assert.equal(payload.windows[1].resetsAt, '2030-01-08T00:00:00.000Z')
    assert.equal(harness.calls[0].url, 'https://opencode.ai/zen/go/v1/usage')
    assert.match(harness.calls[0].headers.authorization, /^Bearer test-opencode-key$/)
    assert.ok(!JSON.stringify(payload).includes('test-opencode-key'), 'the secret never crosses the wire')
  } finally { harness.restore() }
})

test('opencode-go distinguishes a missing subscription from a bad key', async () => {
  const forbidden = mount({ respond: { status: 403, body: { error: 'no subscription' } } })
  try {
    const { payload } = await forbidden.call('/x-usage?provider=opencode-go')
    assert.equal(payload.ok, false)
    assert.equal(payload.reason, 'no-subscription')
  } finally { forbidden.restore() }

  const unauthorized = mount({ respond: { status: 401, body: {} } })
  try {
    const { payload } = await unauthorized.call('/x-usage?provider=opencode-go')
    assert.equal(payload.reason, 'auth')
  } finally { unauthorized.restore() }
})

test('unrecognized or partial upstream shapes fail soft instead of rendering an empty card', async () => {
  const empty = mount({ respond: { status: 200, body: { usage: {} } } })
  try {
    assert.equal((await empty.call('/x-usage?provider=opencode-go')).payload.reason, 'shape')
  } finally { empty.restore() }

  const flat = mount({ respond: { status: 200, body: { rollingUsage: 1 } } })
  try {
    assert.equal((await flat.call('/x-usage?provider=opencode-go')).payload.reason, 'shape')
  } finally { flat.restore() }
})

test('a balance provider answers its own shape and unsupported providers answer unsupported', async () => {
  const harness = mount({ respond: { status: 200, body: { balance: 12.3456, unit: 'USD', daily_usage: [{ date: '2030-01-01', requests: 3, actual_cost: 0.5 }] } } })
  try {
    const balance = await harness.call('/x-usage?provider=my-relay')
    assert.equal(balance.payload.kind, 'balance')
    assert.equal(balance.payload.balance, 12.3456)
    assert.equal(balance.payload.today.requests, 3)
    assert.equal(harness.calls[0].headers.authorization, 'Bearer test-relay-key')

    const unsupported = await harness.call('/x-usage?provider=deepseek-account')
    assert.equal(unsupported.payload.ok, false)
    assert.equal(unsupported.payload.reason, 'unsupported')
  } finally { harness.restore() }
})

test('answers are cached within the refresh interval and bypassed on demand', async () => {
  const harness = mount({ respond: { status: 200, body: { usage: { rolling: { percent: 1, resetsAt: '2030-01-01T00:00:00.000Z' } } } } })
  try {
    await harness.call('/x-usage?provider=opencode-go')
    await harness.call('/x-usage?provider=opencode-go')
    assert.equal(harness.calls.length, 1, 'second read served from cache')
    await harness.call('/x-usage?provider=opencode-go&refresh=1')
    assert.equal(harness.calls.length, 2, 'manual refresh reaches upstream')
  } finally { harness.restore() }
})

test('refresh interval persists in the Harness home, not in the package', async () => {
  const harness = mount({ respond: { status: 200, body: { usage: { rolling: { percent: 0 } } } } })
  try {
    const saved = await harness.call('/x-usage', 'POST', { refreshSeconds: 30 })
    assert.equal(saved.payload.ok, true)
    assert.equal(saved.payload.settings.refreshSeconds, 30)
    const stored = JSON.parse(readFileSync(join(process.env.DSH_HOME, 'dsh-usage-quota.json'), 'utf8'))
    assert.equal(stored.refreshSeconds, 30)
    const bad = await harness.call('/x-usage', 'POST', { refreshSeconds: 'later' })
    assert.equal(bad.status, 400)
  } finally { harness.restore() }
})
