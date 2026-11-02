window.__ModuleLoader__.load({
  id: 'dsh-usage-quota',
  factory: require => {
    const React = require('react'), { createPortal } = require('react-dom');
    const h = React.createElement;
    const { MenuSurface } = require('@deepseek-ai/dsh-client-ui-primitives');
    const EFFORT_LABELS = { minimal: 'Minimal', low: 'Low', medium: 'Medium', high: 'High', xhigh: 'Extra High', max: 'Ultra', off: '关闭思考' };
    const CSS = [
      '.dsh-usage-pill{display:inline-flex;align-items:center;gap:6px;white-space:nowrap;border:0;border-radius:999px;background:transparent;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:20px;padding:1px 8px;cursor:pointer;font-variant-numeric:tabular-nums}',
      '.dsh-usage-pill:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}',
      '.dsh-usage-pill[data-warn=true]{color:#e0a458}',
      '.dsh-usage-dot{color:var(--dsw-alias-separator-primary);margin:0 2px}',
      '.dsh-usage-backdrop{position:fixed;inset:0;z-index:10000;background:#0006;display:flex;align-items:center;justify-content:center;padding:20px}',
      '.dsh-usage-dialog{box-sizing:border-box;max-height:85vh;overflow:auto;width:460px;max-width:100%;border-radius:16px;padding:22px;background:var(--dsw-alias-bg-base,#242424);color:var(--dsw-alias-label-primary,#ddd);box-shadow:0 16px 60px #0006;font-size:13px}',
      '.dsh-usage-dialog header,.dsh-usage-dialog footer{display:flex;align-items:center;justify-content:space-between;gap:12px}',
      '.dsh-usage-dialog header{font-size:16px;margin-bottom:18px}',
      '.dsh-usage-dialog header span{font-size:12px;color:var(--dsw-alias-label-tertiary);font-weight:400}',
      '.dsh-usage-dialog button{cursor:pointer;color:inherit;background:var(--dsw-alias-interactive-bg-hover,#333);border:1px solid var(--dsw-alias-border-l2,#555);border-radius:8px;padding:6px 12px}',
      '.dsh-usage-dialog p{line-height:1.7;color:var(--dsw-alias-label-tertiary,#aaa);margin:0 0 6px}',
      '.dsh-usage-balance{font-size:24px;font-variant-numeric:tabular-nums;margin-bottom:8px}',
      '.dsh-usage-window{margin:14px 0}',
      '.dsh-usage-window-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:6px}',
      '.dsh-usage-window-name{color:var(--dsw-alias-label-secondary)}',
      '.dsh-usage-window-remain{font-variant-numeric:tabular-nums;font-weight:600}',
      '.dsh-usage-window[data-warn=true] .dsh-usage-window-remain{color:#e0a458}',
      '.dsh-usage-track{height:6px;border-radius:999px;background:var(--dsw-alias-interactive-bg-hover);overflow:hidden}',
      '.dsh-usage-track i{display:block;height:100%;border-radius:999px;background:var(--dsw-alias-state-business-primary,#4d8cff)}',
      '.dsh-usage-window[data-warn=true] .dsh-usage-track i{background:#e0a458}',
      '.dsh-usage-reset{margin-top:4px;font-size:11px;color:var(--dsw-alias-label-tertiary)}',
      '.dsh-usage-error{color:#e59683!important}',
      '.dsh-usage-field{display:flex;flex-direction:column;gap:6px;margin:16px 0}',
      '.dsh-usage-field input{box-sizing:border-box;width:100%;padding:8px 10px;border-radius:8px;background:var(--dsw-specific-input-major,#333);color:inherit;border:1px solid var(--dsw-alias-border-l2,#555);font:inherit}',
      '.dsh-effort-chip{display:inline-flex;align-items:center;gap:4px;border:0;background:transparent;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px;padding:2px 6px;border-radius:6px;cursor:pointer;white-space:nowrap}',
      '.dsh-effort-chip:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.dsh-effort-card{box-sizing:border-box;z-index:1200;width:272px;max-width:calc(100vw - 24px);padding:12px 10px 10px;border-radius:16px;background:transparent;color:var(--dsw-alias-label-primary);--dsw-elevation-stroke-color:var(--dsw-alias-border-l1);box-shadow:var(--dsw-elevation-prominent);border:0;font-size:13px}',
      '.dsh-effort-top{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:16px}',
      '.dsh-effort-heading{display:flex;flex-direction:column;align-items:center;gap:2px;flex:1;min-width:0}',
      '.dsh-effort-heading strong{font-size:15px;line-height:20px;color:var(--dsh-effort-accent);font-weight:600}',
      '.dsh-effort-model{max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}',
      '.dsh-effort-bolt-lg{width:20px;flex:none}',
      '.dsh-effort-card button{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;padding:2px 4px;font:inherit;border-radius:6px}',
      '.dsh-effort-card button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.dsh-effort-card button:focus-visible{outline:2px solid var(--dsh-effort-accent);outline-offset:1px}',
      '.dsh-effort-card button:disabled{opacity:.4;cursor:default}',
      '.dsh-effort-reset{font-size:20px;line-height:20px}',
      '.dsh-effort-track{position:relative;height:28px;margin:0 2px}',
      '.dsh-effort-rail{position:absolute;inset:0;border-radius:999px;background:var(--dsw-alias-interactive-bg-hover);overflow:hidden}',
      '.dsh-effort-fill{position:absolute;inset:0 auto 0 0;width:var(--dsh-effort-fill);background:var(--dsh-effort-accent);transition:width .12s}',
      '.dsh-effort-track[data-active=false] .dsh-effort-fill{background:var(--dsw-alias-label-caption)}',
      '.dsh-effort-dots{position:absolute;inset:0 14px;display:flex;justify-content:space-between;align-items:center}',
      '.dsh-effort-dots i{display:block;width:3px;height:3px;border-radius:50%;background:var(--dsw-alias-label-secondary);opacity:.6}',
      '.dsh-effort-track input{appearance:none;-webkit-appearance:none;position:absolute;inset:0;width:100%;height:28px;margin:0;padding:0;background:transparent;cursor:pointer;outline:none}',
      '.dsh-effort-track input::-webkit-slider-runnable-track{height:28px;background:transparent}',
      '.dsh-effort-track input::-webkit-slider-thumb{-webkit-appearance:none;width:28px;height:28px;border:0;border-radius:50%;background:#fff;box-shadow:0 1px 5px #0003}',
      '.dsh-effort-track input:focus-visible::-webkit-slider-thumb{outline:2px solid var(--dsh-effort-accent);outline-offset:2px}',
      '.dsh-effort-track input:disabled{opacity:.5;cursor:wait}',
      '.dsh-effort-scale{display:flex;margin:5px 0 12px}',
      '.dsh-effort-scale button{font-size:10px;padding:2px 0;flex:1;text-align:center}',
      '.dsh-effort-scale button[aria-pressed=true]{color:var(--dsh-effort-accent)}',
      '.dsh-effort-modes{display:flex;gap:6px;padding-top:8px;border-top:1px solid var(--dsw-alias-border-l2,#444)}',
      '.dsh-effort-modes button{flex:1;font-size:12px;padding:5px 8px;background:var(--dsw-alias-interactive-bg-hover);border-radius:999px}',
      '.dsh-effort-modes button[aria-pressed=true]{color:var(--dsh-effort-accent)}',
      '.dsh-effort-note{margin:8px 0 0;font-size:11px;color:var(--dsw-alias-label-tertiary);text-align:center}',
      '.dsh-effort-error{color:#e59683}',
    ].join('');
    async function request(query = '', body) {
      const response = await fetch(new URL('x-usage' + query, document.baseURI), { credentials: 'same-origin', signal: AbortSignal.timeout(20000), ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
      if (!response.ok) throw new Error(`DSH 查询请求失败 (${response.status})`);
      return response.json();
    }
    /** Only the active provider's card is ever shown; unknown providers render nothing. */
    const shouldRender = result => result !== undefined && result !== null && result.reason !== 'unsupported';
    function resetsText(iso) {
      const time = Date.parse(iso);
      if (!Number.isFinite(time)) return '';
      const ms = time - Date.now();
      if (ms <= 0) return '即将重置';
      const minutes = Math.round(ms / 60000);
      if (minutes < 1) return '不到 1 分钟后重置';
      if (minutes < 60) return `${minutes} 分钟后重置`;
      const hours = Math.floor(minutes / 60), rest = minutes % 60;
      if (hours < 24) return rest === 0 ? `${hours} 小时后重置` : `${hours} 小时 ${rest} 分后重置`;
      return `${Math.floor(hours / 24)} 天后重置`;
    }
    /** Provider-aware quota pill: one card per active provider, nothing for the rest. */
    function Usage({ sessionId, resolve }) {
      const binding = React.useMemo(() => (sessionId === undefined || resolve === undefined ? undefined : resolve(sessionId)), [sessionId, resolve]);
      const subscribe = React.useCallback(callback => (binding === undefined ? () => {} : binding.store.subscribe(callback)), [binding]);
      const getSnapshot = React.useCallback(() => (binding === undefined ? undefined : binding.store.getSnapshot()), [binding]);
      const snapshot = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
      const provider = snapshot?.current?.provider ?? '';
      const [entry, setEntry] = React.useState(null);
      const [open, setOpen] = React.useState(false);
      const [busy, setBusy] = React.useState(false);
      const [draftSeconds, setDraftSeconds] = React.useState(60);
      const [settingsError, setSettingsError] = React.useState('');
      const alive = React.useRef(true), locked = React.useRef(false), trigger = React.useRef(null), close = React.useRef(null);
      const load = React.useCallback(async (force = false) => {
        if (provider === '' || locked.current) return;
        locked.current = true; setBusy(true);
        try {
          const result = await request(`?provider=${encodeURIComponent(provider)}${force ? '&refresh=1' : ''}`);
          if (!alive.current) return;
          if (Number.isFinite(Number(result?.settings?.refreshSeconds))) setDraftSeconds(Number(result.settings.refreshSeconds));
          setEntry({ provider, result });
        } catch (error) {
          if (alive.current) setEntry({ provider, result: { ok: false, reason: 'client', error: error.message } });
        } finally {
          locked.current = false; if (alive.current) setBusy(false);
        }
      }, [provider]);
      React.useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
      React.useEffect(() => {
        // A provider switch invalidates the previous card immediately.
        setEntry(null);
        if (binding !== undefined) binding.load();
        load();
      }, [provider, load]);
      React.useEffect(() => {
        const seconds = Number(entry?.result?.settings?.refreshSeconds);
        const timer = setInterval(() => { if (!document.hidden && !open) load(); }, (Number.isFinite(seconds) ? seconds : 60) * 1000);
        return () => clearInterval(timer);
      }, [entry?.result?.settings?.refreshSeconds, load, open]);
      React.useEffect(() => {
        if (!open) return;
        close.current?.focus();
        const key = event => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
        document.addEventListener('keydown', key);
        return () => document.removeEventListener('keydown', key);
      }, [open]);
      const saveSeconds = async event => {
        event.preventDefault();
        setSettingsError('');
        try {
          const result = await request('', { refreshSeconds: draftSeconds });
          if (!result.ok) throw new Error(result.error ?? '保存失败');
          await load(true);
        } catch (error) { setSettingsError(error.message); }
      };
      const result = entry?.result;
      // Unsupported providers get no pill at all: the dock must never advertise
      // a different gateway's balance while another one is active.
      if (!shouldRender(result)) return null;
      const windows = Array.isArray(result?.windows) ? result.windows : null;
      const warn = (windows ?? []).some(window => window.remaining <= 20);
      const caption = result.ok === true
        ? result.kind === 'plan'
          ? windows.map(window => `${window.short ?? window.label} ${window.remaining}%`)
          : [`余额 ${result.balance.toFixed(2)} ${result.unit}`]
        : ['额度查询失败'];
      const icon = h('svg', { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1, 'aria-hidden': true }, h('rect', { x: 1.5, y: 3.5, width: 13, height: 10, rx: 2 }), h('path', { d: 'M1.5 7h13' }));
      const parts = [];
      caption.forEach((text, index) => {
        if (index > 0) parts.push(h('span', { key: `sep${index}`, className: 'dsh-usage-dot', 'aria-hidden': true }, '·'));
        parts.push(h('span', { key: `text${index}` }, text));
      });
      return h(React.Fragment, null,
        h('button', {
          ref: trigger, type: 'button', className: 'dsh-usage-pill', 'data-dsh-usage-pill': true,
          'data-provider': provider, 'data-warn': warn ? 'true' : undefined,
          'aria-haspopup': 'dialog', 'aria-expanded': open,
          onClick: () => setOpen(true),
          title: result.ok === true ? '点击查看额度详情' : `${result.error ?? '查询失败'}；点击重试`,
        }, icon, parts, result.ok === false ? ' ⚠' : null),
        open && createPortal(h('div', { className: 'dsh-usage-backdrop', onMouseDown: event => { if (event.target === event.currentTarget) { setOpen(false); trigger.current?.focus(); } } },
          h('section', { className: 'dsh-usage-dialog', role: 'dialog', 'aria-modal': true, 'aria-label': '额度详情' },
            h('header', null, h('div', null, result.ok === true && result.kind === 'plan' ? `${result.plan} 额度` : '账户额度', h('span', null, ` · ${provider}`)), h('button', { ref: close, type: 'button', 'aria-label': '关闭', onClick: () => { setOpen(false); trigger.current?.focus(); } }, '×')),
            result.ok === false && h('p', { role: 'alert', className: 'dsh-usage-error' }, result.error ?? '额度查询失败'),
            result.ok === true && result.kind === 'plan' && (windows ?? []).map(window => h('div', { key: window.key, className: 'dsh-usage-window', 'data-warn': window.remaining <= 20 ? 'true' : undefined },
              h('div', { className: 'dsh-usage-window-head' }, h('span', { className: 'dsh-usage-window-name' }, window.label), h('span', { className: 'dsh-usage-window-remain' }, `剩余 ${window.remaining}%`)),
              h('div', { className: 'dsh-usage-track', 'aria-hidden': true }, h('i', { style: { width: `${Math.min(100, Math.max(0, window.used))}%` } })),
              h('div', { className: 'dsh-usage-reset' }, window.resetsAt === null ? '未使用' : resetsText(window.resetsAt))
            )),
            result.ok === true && result.kind === 'balance' && h(React.Fragment, null,
              h('div', { className: 'dsh-usage-balance' }, `余额 ${result.balance.toFixed(2)} ${result.unit}`),
              h('p', null, [result.today ? `今日消费 ${Number(result.today.cost ?? 0).toFixed(2)} ${result.unit} · ${result.today.requests ?? 0} 次请求` : null, `更新于 ${new Date(result.fetchedAt).toLocaleTimeString()}`].filter(Boolean).join(' · '))
            ),
            h('form', { onSubmit: saveSeconds },
              h('label', { className: 'dsh-usage-field' }, '自动刷新间隔（秒，30–3600）', h('input', { type: 'number', min: 30, max: 3600, value: draftSeconds, onChange: event => setDraftSeconds(Number(event.target.value)) })),
              h('p', null, '只显示当前模型供应商的额度；切换供应商时这里会自动更换。密钥由 DSH 宿主读取，不会发送到页面。'),
              settingsError !== '' && h('p', { role: 'alert', className: 'dsh-usage-error' }, settingsError),
              h('footer', null,
                h('button', { type: 'button', disabled: busy, onClick: () => load(true) }, busy ? '查询中…' : '立即刷新'),
                h('button', { type: 'submit' }, '保存')
              )
            )
          )), document.body)
      );
    }
    /** Codex-style reasoning control: compact chip that opens the level card. */
    function EffortControl({ sessionId, resolve }) {
      const binding = React.useMemo(() => (sessionId === undefined || resolve === undefined ? undefined : resolve(sessionId)), [sessionId, resolve]);
      const subscribe = React.useCallback(callback => (binding === undefined ? () => {} : binding.store.subscribe(callback)), [binding]);
      const getSnapshot = React.useCallback(() => (binding === undefined ? undefined : binding.store.getSnapshot()), [binding]);
      const snapshot = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
      const [open, setOpen] = React.useState(false), [preview, setPreview] = React.useState(null), [busy, setBusy] = React.useState(false), [error, setError] = React.useState('');
      const trigger = React.useRef(null), card = React.useRef(null), [anchor, setAnchor] = React.useState(null);
      React.useEffect(() => { if (binding !== undefined) binding.load(); }, [binding]);
      React.useEffect(() => {
        if (!open) return;
        const place = () => { const rect = trigger.current?.getBoundingClientRect(); if (rect !== undefined) setAnchor({ right: Math.max(12, window.innerWidth - rect.right), bottom: window.innerHeight - rect.top + 8 }); };
        place(); window.addEventListener('resize', place);
        const key = event => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
        const down = event => { if (card.current !== null && card.current.contains(event.target) === false && trigger.current?.contains(event.target) !== true) setOpen(false); };
        document.addEventListener('keydown', key); document.addEventListener('pointerdown', down, true);
        return () => { window.removeEventListener('resize', place); document.removeEventListener('keydown', key); document.removeEventListener('pointerdown', down, true); };
      }, [open]);
      const current = snapshot?.current;
      const group = (snapshot?.groups ?? []).find(entry => entry.id === current?.provider);
      const model = group?.models.find(entry => entry.id === current?.model);
      const reasoning = model?.reasoning;
      if (binding === undefined || current === null || current === undefined || reasoning === undefined || reasoning.efforts.length === 0) return null;
      const levels = reasoning.efforts.filter(level => level.id !== 'off');
      const offSupported = reasoning.efforts.some(level => level.id === 'off');
      const selected = current.reasoningEffort;
      const defaultTarget = reasoning.defaultEffort ?? 'medium';
      const effective = selected ?? (offSupported ? defaultTarget : reasoning.defaultEffort);
      const label = level => (level === undefined ? '默认' : EFFORT_LABELS[level] ?? level);
      const display = label(effective);
      const index = Math.max(0, levels.findIndex(level => level.id === effective));
      const position = preview ?? index;
      const shown = preview === null ? display : label(levels[position]?.id);
      const percent = levels.length > 1 ? position / (levels.length - 1) * 100 : 0;
      const commit = effort => {
        if (busy) return;
        setBusy(true); setError('');
        const selection = { provider: current.provider, model: current.model, ...(effort === undefined ? {} : { reasoningEffort: effort }) };
        Promise.resolve(binding.select(selection))
          .then(result => { if (result !== undefined && result.ok === false) setError(result.error?.message ?? '设置失败'); })
          .catch(e => setError(String(e?.message ?? e)))
          .finally(() => { setBusy(false); setPreview(null); });
      };
      const purple = effective === 'max';
      return h(React.Fragment, null,
        h('button', { ref: trigger, type: 'button', className: 'dsh-effort-chip', 'data-dsh-effort-chip': true, 'aria-haspopup': 'dialog', 'aria-expanded': open, onClick: () => setOpen(!open), title: `${model.name} · 思考强度 ${display}（点击切换）` }, display),
        open && createPortal(h(MenuSurface, { ref: card, className: 'dsh-effort-card', 'data-dsh-effort-card': true, role: 'dialog', 'aria-label': '思考强度', style: { position: 'fixed', right: anchor?.right ?? 12, bottom: anchor?.bottom ?? 80, '--dsh-effort-accent': purple ? '#9c85f5' : '#e58a43' }, onKeyDown: event => { if (event.target.type === 'range' && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) event.stopPropagation(); } },
          h('div', { className: 'dsh-effort-top' },
            h('span', { className: 'dsh-effort-bolt-lg', 'aria-hidden': true }),
            h('div', { className: 'dsh-effort-heading' }, h('strong', { 'aria-live': 'polite' }, shown), h('span', { className: 'dsh-effort-model' }, model.name)),
            h('button', { type: 'button', className: 'dsh-effort-reset', disabled: busy, title: offSupported ? `恢复默认思考强度（${label(defaultTarget)}）` : '恢复模型默认思考', 'aria-label': '恢复默认思考强度', onClick: () => commit(offSupported ? defaultTarget : undefined) }, '↺')
          ),
          levels.length > 0 && h('div', { className: 'dsh-effort-track', 'data-active': effective !== undefined, style: { '--dsh-effort-fill': `${percent}%` } },
            h('div', { className: 'dsh-effort-rail', 'aria-hidden': true }, h('div', { className: 'dsh-effort-fill' }), h('div', { className: 'dsh-effort-dots' }, levels.map(level => h('i', { key: level.id })))),
            h('input', { type: 'range', min: 0, max: Math.max(0, levels.length - 1), step: 1, value: position, disabled: busy || levels.length < 2, 'aria-label': '选择思考强度', 'aria-valuetext': shown, onChange: event => setPreview(Number(event.target.value)), onPointerUp: () => { if (preview !== null) commit(levels[preview]?.id); }, onKeyUp: event => { if (preview !== null && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) commit(levels[preview]?.id); } })
          ),
          h('div', { className: 'dsh-effort-scale' }, levels.map(level => h('button', { key: level.id, type: 'button', disabled: busy, 'aria-pressed': effective === level.id, onClick: () => commit(level.id) }, label(level.id)))),
          h('div', { className: 'dsh-effort-modes' },
            offSupported
              ? h(React.Fragment, null,
                h('button', { type: 'button', disabled: busy, 'aria-pressed': selected === undefined || selected === defaultTarget, onClick: () => commit(defaultTarget) }, `默认 ${label(defaultTarget)}`),
                h('button', { type: 'button', disabled: busy, 'aria-pressed': selected === 'off', onClick: () => commit('off') }, '关闭思考'))
              : h(React.Fragment, null,
                h('button', { type: 'button', disabled: busy, 'aria-pressed': selected === undefined, onClick: () => commit(undefined) }, '默认'),
                h('button', { type: 'button', disabled: true, title: '此模型要求自适应思考，不支持关闭' }, '关闭思考'))
          ),
          !offSupported && h('p', { className: 'dsh-effort-note' }, '此模型不支持关闭思考，只能选择强度'),
          error !== '' && h('p', { className: 'dsh-effort-note dsh-effort-error', role: 'alert' }, error),
          busy && h('p', { className: 'dsh-effort-note', role: 'status' }, '正在应用…')
        ), document.body)
      );
    }
    function apply(ctx) {
      const tag = document.createElement('style'); tag.dataset.plugin = 'dsh-usage-quota';
      tag.textContent = CSS;
      document.head.appendChild(tag); ctx.effect(() => () => tag.remove());
      ctx.inject(['modelDirectories'], scope => {
        const resolve = sessionId => {
          const directory = scope.modelDirectories.directoryFor(sessionId);
          return directory === undefined ? undefined : { store: directory.store, load: () => directory.load().catch(() => {}), select: selection => directory.select(selection) };
        };
        const UsageBound = props => h(Usage, { sessionId: props.sessionId, resolve });
        const EffortBound = props => h(EffortControl, { sessionId: props.sessionId, resolve });
        scope.slots.inject('conversation.composer.dock', () => scope.slots.register({ name: 'conversation.composer.dock', id: 'usage-quota', order: 10 }, UsageBound));
        scope.slots.inject('conversation.input.right', () => scope.slots.register({ name: 'conversation.input.right', id: 'reasoning-effort', order: 20 }, EffortBound));
      });
    }
    return { inject: ['slots'], apply, __test: { shouldRender, resetsText } };
  }
});
