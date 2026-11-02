import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

/** Load the browser bundle the way the DSH module loader does. */
function loadBundle() {
  let registration
  const element = (type, props) => ({ type, props: props ?? {} })
  const React = {
    createElement: element,
    Fragment: 'fragment',
    Component: class {},
    useMemo: fn => fn(),
    useCallback: fn => fn,
    useState: value => [value, () => {}],
    useEffect() {},
    useRef: value => ({ current: value }),
  }
  vm.runInNewContext(readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'), {
    window: { __ModuleLoader__: { load: value => { registration = value } } },
    document: { baseURI: 'http://dsh-usage-quota.example/', createElement: () => ({ dataset: {} }), head: { appendChild() {} } },
    console, URL, Date, JSON, Number, AbortSignal,
  })
  const client = registration.factory(name => {
    if (name === 'react') return React
    if (name === 'react-dom') return { createPortal: value => value }
    if (name === '@deepseek-ai/dsh-client-ui-primitives') return { MenuSurface: 'surface' }
    throw new Error(`unexpected require ${name}`)
  })
  return { registration, client }
}

test('the bundle registers as the documented package id', () => {
  const { registration } = loadBundle()
  assert.equal(registration.id, 'dsh-usage-quota')
})

test('apply mounts the quota pill and the reasoning control', () => {
  const { client } = loadBundle()
  const registrations = []
  const slots = {
    inject: (name, callback) => { callback(); return () => {} },
    register: (options) => { registrations.push([options.name, options.id]); return () => {} },
  }
  const directory = {
    store: { subscribe: () => () => {}, getSnapshot: () => ({ current: { provider: 'opencode-go', model: 'm' } }) },
    load: async () => {},
    select: async () => ({ ok: true }),
  }
  client.apply({ effect: fn => fn(), slots, inject: (deps, callback) => callback({ slots, modelDirectories: { directoryFor: () => directory } }) })
  assert.deepEqual(registrations, [['conversation.composer.dock', 'usage-quota'], ['conversation.input.right', 'reasoning-effort']])
})

test('foreign or unknown providers never render a card', () => {
  const { client } = loadBundle()
  assert.equal(client.__test.shouldRender(undefined), false)
  assert.equal(client.__test.shouldRender({ ok: false, reason: 'unsupported' }), false)
  assert.equal(client.__test.shouldRender({ ok: true, kind: 'plan', windows: [] }), true)
  assert.equal(client.__test.shouldRender({ ok: false, reason: 'no-key' }), true, 'a supported provider still shows its error state')
})

test('the quota dialog rides the shared menu material so it blurs like the rest of the UI', () => {
  const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  assert.match(source, /h\(MenuSurface, \{ className: 'dsh-usage-dialog'/)
  assert.match(source, /--dsw-menu-backdrop-filter:blur\(var\(--we-blur/)
  assert.match(source, /--dsw-menu-surface-fill:var\(--we-tool-glass-fill/)
  assert.match(source, /backdrop-filter:blur\(var\(--we-blur,18px\)\)/)
  assert.doesNotMatch(source, /background:var\(--dsw-alias-bg-base/, 'the dialog must not paint an opaque theme background over the glass')
})

test('reset copy degrades gracefully around the boundary', () => {
  const { client } = loadBundle()
  assert.equal(client.__test.resetsText('not-a-date'), '')
  assert.equal(client.__test.resetsText(new Date(Date.now() - 60_000).toISOString()), '即将重置')
  assert.match(client.__test.resetsText(new Date(Date.now() + 90 * 60_000).toISOString()), /后重置$/)
  assert.match(client.__test.resetsText(new Date(Date.now() + 3 * 86_400_000).toISOString()), /天后重置$/)
})
