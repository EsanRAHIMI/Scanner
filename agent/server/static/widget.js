/*
 * Lorenzo Agent v2 — context-aware floating control bar + assistant.
 *
 * One framework-agnostic file served by the agent service, embedded via a single
 * <script> per app. Renders in a Shadow DOM (style-isolated), position:fixed (no
 * layout shift). Detects the current app/page context and forwards it with every
 * message, renders tool activity, and offers app-aware suggestions.
 */
(function () {
  'use strict';
  if (window.__lorenzoAgentLoaded) return;
  window.__lorenzoAgentLoaded = true;

  var SELF = document.currentScript;
  function agentBase() {
    // Derive the API base from THIS script's own URL, preserving any base path
    // (e.g. https://agent.example.com/server). We strip only the trailing widget
    // filename — never reduce to .origin, which would drop the base path.
    var src = '';
    try { if (SELF && SELF.src) src = SELF.src; } catch (e) {}
    if (!src) { var s = document.querySelector('script[src*="widget.js"]'); if (s) src = s.src; }
    if (src) {
      var base = src.replace(/\/(?:static\/)?widget\.js(?:[?#].*)?$/, '');
      if (base && base !== src) return base.replace(/\/+$/, '');
    }
    // Last resort only (same-origin dev): never invent a host.
    return window.location.origin;
  }
  var BASE = agentBase();
  var CONV_KEY = 'lorenzo_agent_conv_v1';
  var BOOT = { nav: {}, suggestions: {}, authenticated: false, llm_provider: '' };

  /* --------------------------------------------------- context detection */
  function detectApp() {
    var h = (location.hostname || '').toLowerCase();
    var p = (location.pathname || '/');
    if (h.indexOf('products') === 0 || h.indexOf('products.') !== -1) return 'products';
    if (h.indexOf('proposals') !== -1) return 'proposals';
    if (h.indexOf('image') !== -1) return 'images';
    if (h.indexOf('marketing') !== -1) return 'marketing';
    if (h.indexOf('trainer') !== -1) return 'trainer';
    if (h.indexOf('dashboard') !== -1) return 'dashboard';
    // localhost dev: infer from path
    if (p.indexOf('/proposals') === 0 || p.indexOf('/new') === 0) return 'proposals';
    if (p.indexOf('/scanner') === 0) return 'scanner';
    return 'unknown';
  }
  function moduleFromPath(app, p) {
    var seg = p.split('/').filter(Boolean);
    if (app === 'proposals') {
      if (p.indexOf('/new') === 0) return 'new-proposal';
      if (seg[0] === 'proposals' && seg[1]) return 'proposal-editor';
      if (seg[0] === 'templates') return 'templates';
      return 'proposals-list';
    }
    return seg[0] || 'home';
  }
  function getContext() {
    var app = detectApp();
    var p = location.pathname || '/';
    var ctx = {
      app: app, url: location.href, path: p,
      module: moduleFromPath(app, p),
      title: document.title || '',
      selected_product_ids: [], proposal_id: null
    };
    // proposal id from URL (/proposals/{id})
    var m = p.match(/\/proposals\/([^\/?#]+)/);
    if (m && m[1] && m[1] !== 'new') ctx.proposal_id = m[1];
    // optional host-app hook for richer context (e.g. selected product ids)
    try {
      var hook = window.__lorenzoAgentContext;
      var extra = typeof hook === 'function' ? hook() : hook;
      if (extra && typeof extra === 'object') {
        if (Array.isArray(extra.selected_product_ids)) ctx.selected_product_ids = extra.selected_product_ids.slice(0, 50);
        if (extra.proposal_id) ctx.proposal_id = extra.proposal_id;
        if (extra.module) ctx.module = extra.module;
      }
    } catch (e) {}
    return ctx;
  }

  /* ------------------------------------------------------------- styles */
  var CSS = `
  :host { all: initial; }
  * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
  .wrap { position: fixed; left: 0; right: 0; bottom: 0; z-index: 2147483000;
          display: flex; justify-content: center; pointer-events: none;
          padding: 0 12px calc(12px + env(safe-area-inset-bottom)); }
  .bar { pointer-events: auto; display: flex; align-items: center; gap: 4px; padding: 7px;
         border-radius: 20px; background: rgba(252,250,249,0.72);
         backdrop-filter: blur(20px) saturate(170%); -webkit-backdrop-filter: blur(20px) saturate(170%);
         border: 1px solid rgba(120,20,50,0.10);
         box-shadow: 0 12px 34px rgba(60,20,35,0.16), 0 1px 3px rgba(0,0,0,0.05); }
  @media (prefers-color-scheme: dark) {
    .bar { background: rgba(26,22,24,0.66); border-color: rgba(255,255,255,0.10); box-shadow: 0 12px 34px rgba(0,0,0,0.55); }
    .btn { color: #ece6e1; } .btn .lbl { color: rgba(236,230,225,0.7); }
    .btn.active { background: rgba(156,31,69,0.22); }
    .panel { background: rgba(24,20,22,0.9); border-color: rgba(255,255,255,0.10); color:#ece6e1; }
    .head, .h-app { color:#f2ece8; } .msg.bot .bubble { background: rgba(255,255,255,0.07); color:#ece6e1; }
    .chip, .sugg { background: rgba(255,255,255,0.06); color:#e7ddd9; border-color: rgba(255,255,255,0.10); }
    .composer input { color:#f2ece8; background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.12); }
    .tool { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.10); color:#d9cfca; }
  }
  .btn { position: relative; display:flex; flex-direction:column; align-items:center; justify-content:center;
         gap:1px; width:56px; height:48px; border:0; background:transparent; border-radius:14px; cursor:pointer;
         color:#4a2c38; transition: background .18s, transform .12s; }
  .btn:hover { background: rgba(120,20,50,0.07); } .btn:active { transform: scale(.92); }
  .btn.active { background: rgba(156,31,69,0.12); }
  .btn.active .lbl { color:#9c1f45; font-weight:700; }
  .btn svg { width:19px; height:19px; } .lbl { font-size:9.5px; font-weight:600; letter-spacing:.01em; color: rgba(74,44,56,0.78); }
  .ai { width:54px; height:54px; border-radius:16px; margin:0 3px;
        background: linear-gradient(150deg,#6d1430,#a02247); color:#fff; box-shadow: 0 8px 18px rgba(120,20,50,0.42); }
  .ai:hover { filter: brightness(1.06); } .ai svg { width:24px; height:24px; }
  .dot { position:absolute; top:7px; right:9px; width:8px; height:8px; border-radius:50%; background:#46d17f;
         border:2px solid rgba(255,255,255,0.9); transition: background .3s; }
  .dot.thinking { background:#f2b203; animation:pulse 1s infinite; } .dot.error { background:#e5484d; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }

  .panel { pointer-events:auto; position:fixed; right:16px; bottom:84px; width:392px; max-width:calc(100vw - 24px);
           height:560px; max-height:calc(100vh - 116px); display:flex; flex-direction:column; border-radius:22px;
           overflow:hidden; background: rgba(252,250,249,0.9); backdrop-filter: blur(30px) saturate(180%);
           -webkit-backdrop-filter: blur(30px) saturate(180%); border:1px solid rgba(120,20,50,0.12);
           box-shadow: 0 28px 70px rgba(50,20,32,0.32); color:#2a1c24;
           transform: translateY(18px) scale(.97); opacity:0; visibility:hidden;
           transition: transform .4s cubic-bezier(.22,1,.36,1), opacity .26s ease, visibility .26s; }
  .panel.open { transform: translateY(0) scale(1); opacity:1; visibility:visible; }
  @media (max-width:520px) { .panel { right:8px; left:8px; width:auto; bottom:82px; height:74vh; } }
  .head { display:flex; align-items:center; gap:8px; padding:13px 15px; border-bottom:1px solid rgba(0,0,0,0.06); }
  .h-title { font-weight:800; font-size:14px; letter-spacing:.01em; }
  .h-app { margin-left:8px; font-size:10.5px; font-weight:600; padding:3px 8px; border-radius:999px;
           background: rgba(156,31,69,0.12); color:#9c1f45; }
  .h-prov { margin-left:auto; font-size:10px; opacity:.5; }
  .close { border:0; background:transparent; cursor:pointer; font-size:20px; line-height:1; opacity:.55; margin-left:6px; }
  .msgs { flex:1; overflow-y:auto; padding:14px; display:flex; flex-direction:column; gap:10px; }
  .msg { display:flex; } .msg.user { justify-content:flex-end; }
  .bubble { max-width:86%; padding:9px 12px; border-radius:15px; font-size:13.5px; line-height:1.46; white-space:pre-wrap; word-wrap:break-word; }
  .msg.user .bubble { background: linear-gradient(150deg,#7a1636,#9c1f45); color:#fff; border-bottom-right-radius:5px; }
  .msg.bot .bubble { background: rgba(0,0,0,0.045); color:#2a1c24; border-bottom-left-radius:5px; }
  .tools { display:flex; flex-direction:column; gap:5px; margin-bottom:6px; align-self:flex-start; max-width:90%; }
  .tool { display:flex; align-items:center; gap:7px; font-size:11.5px; padding:6px 9px; border-radius:11px;
          background: rgba(0,0,0,0.04); border:1px solid rgba(0,0,0,0.05); color:#5a4751; }
  .tool .ic { width:14px; height:14px; flex:none; }
  .tool.run .ic { animation: spin 1s linear infinite; }
  .tool.ok { color:#1f7a4d; } .tool.fail { color:#b4302f; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .empty { margin:auto; text-align:center; color: rgba(0,0,0,0.42); font-size:13px; padding:14px; }
  .suggs { display:flex; flex-wrap:wrap; gap:7px; justify-content:center; margin-top:10px; }
  .sugg { font-size:12px; padding:7px 11px; border-radius:12px; cursor:pointer; border:1px solid rgba(120,20,50,0.18);
          background: rgba(156,31,69,0.06); color:#7a2238; transition: background .15s; }
  .sugg:hover { background: rgba(156,31,69,0.13); }
  .chips { display:flex; gap:6px; padding:0 12px 8px; flex-wrap:wrap; }
  .chip { font-size:11px; padding:5px 9px; border-radius:10px; cursor:pointer; border:1px solid rgba(0,0,0,0.08);
          background: rgba(0,0,0,0.03); color:#5a4751; }
  .chip:hover { background: rgba(156,31,69,0.10); }
  .composer { display:flex; gap:8px; padding:11px 12px; border-top:1px solid rgba(0,0,0,0.06); }
  .composer input { flex:1; border:1px solid rgba(0,0,0,0.12); background: rgba(255,255,255,0.75); border-radius:13px;
                    padding:10px 12px; font-size:13.5px; outline:none; }
  .composer input:focus { border-color:#9c1f45; }
  .send { border:0; border-radius:13px; padding:0 15px; background:#9c1f45; color:#fff; font-weight:700; cursor:pointer; }
  .send:disabled { opacity:.5; cursor:default; }
  `;

  function icon(name) {
    var p = {
      products: '<path d="M3 7l9-4 9 4-9 4-9-4zm0 5l9 4 9-4M3 17l9 4 9-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
      proposals: '<path d="M7 3h7l5 5v13H7zM14 3v5h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9.5 13h6M9.5 16.5h6" stroke="currentColor" stroke-width="1.6"/>',
      images: '<rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="8.5" cy="9.5" r="1.6" fill="currentColor"/><path d="M5 18l4.5-4.5 3 3L17 11l3 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
      marketing: '<path d="M4 13V9a1 1 0 011-1h3l7-4v14l-7-4H5a1 1 0 01-1-1z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M18 9a3 3 0 010 6" fill="none" stroke="currentColor" stroke-width="1.8"/>',
      ai: '<rect x="5" y="6" width="14" height="12" rx="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 3v3M8.5 11.5h.01M15.5 11.5h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M9 15c1 .8 5 .8 6 0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
      gear: '<circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'
    };
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (p[name] || '') + '</svg>';
  }

  /* --------------------------------------------------------------- mount */
  var host = document.createElement('div'); host.id = 'lorenzo-agent-root';
  document.body.appendChild(host);
  var root = host.attachShadow({ mode: 'open' });
  var style = document.createElement('style'); style.textContent = CSS; root.appendChild(style);
  var wrap = document.createElement('div'); wrap.className = 'wrap'; root.appendChild(wrap);
  var bar = document.createElement('div'); bar.className = 'bar'; wrap.appendChild(bar);

  var panel = document.createElement('div'); panel.className = 'panel';
  panel.innerHTML =
    '<div class="head"><span class="h-title">Lorenzo AI</span><span class="h-app" data-app></span>' +
    '<span class="h-prov" data-prov></span><button class="close" title="Close">×</button></div>' +
    '<div class="msgs"></div>' +
    '<div class="chips" data-chips></div>' +
    '<div class="composer"><input type="text" placeholder="Ask or run a command…" /><button class="send">Send</button></div>';
  wrap.appendChild(panel);

  var dot, aiBtn, navButtons = {},
      msgsEl = panel.querySelector('.msgs'),
      inputEl = panel.querySelector('input'),
      sendEl = panel.querySelector('.send'),
      appEl = panel.querySelector('[data-app]'),
      provEl = panel.querySelector('[data-prov]'),
      chipsEl = panel.querySelector('[data-chips]');
  panel.querySelector('.close').onclick = function () { panel.classList.remove('open'); };

  function setStatus(s) { if (dot) dot.className = 'dot' + (s ? ' ' + s : ''); }

  function navBtn(name, label, key, url) {
    var b = document.createElement('button'); b.className = 'btn';
    b.innerHTML = icon(name) + '<span class="lbl">' + label + '</span>';
    b.onclick = function () { if (url) window.location.href = url; };
    navButtons[key] = b; return b;
  }

  function buildBar() {
    bar.innerHTML = ''; navButtons = {};
    var nav = BOOT.nav || {};
    bar.appendChild(navBtn('products', 'Products', 'products', nav.products));
    bar.appendChild(navBtn('proposals', 'Proposals', 'proposals', nav.proposals));
    aiBtn = document.createElement('button'); aiBtn.className = 'btn ai';
    aiBtn.innerHTML = icon('ai') + '<span class="dot"></span>'; dot = aiBtn.querySelector('.dot');
    aiBtn.onclick = function () {
      panel.classList.toggle('open');
      if (panel.classList.contains('open')) { refreshPanelContext(); setTimeout(function(){ inputEl.focus(); }, 80); }
    };
    bar.appendChild(aiBtn);
    bar.appendChild(navBtn('images', 'Images', 'images', nav.images));
    bar.appendChild(navBtn('marketing', 'Marketing', 'marketing', nav.marketing));
    highlightActive();
  }
  function highlightActive() {
    var app = detectApp();
    Object.keys(navButtons).forEach(function (k) { navButtons[k].classList.toggle('active', k === app); });
  }

  var APP_LABEL = { products:'Products', proposals:'Proposals', images:'Images', marketing:'Marketing', trainer:'Trainer', dashboard:'Dashboard', scanner:'Scanner', unknown:'Lorenzo' };
  function refreshPanelContext() {
    var ctx = getContext();
    appEl.textContent = APP_LABEL[ctx.app] || 'Lorenzo';
    provEl.textContent = BOOT.authenticated ? (BOOT.llm_provider || '') : 'sign in';
    // suggested prompts + module chips
    if (!msgsEl.querySelector('.msg')) renderEmptyState(ctx);
    renderChips(ctx);
  }
  function renderChips(ctx) {
    chipsEl.innerHTML = '';
    var quick = [];
    if (ctx.selected_product_ids && ctx.selected_product_ids.length)
      quick.push('Summarize my ' + ctx.selected_product_ids.length + ' selected product(s)');
    if (ctx.proposal_id) quick.push('Summarize the current proposal');
    quick.forEach(function (q) {
      var c = document.createElement('button'); c.className = 'chip'; c.textContent = q;
      c.onclick = function () { inputEl.value = q; send(); };
      chipsEl.appendChild(c);
    });
  }
  function renderEmptyState(ctx) {
    msgsEl.innerHTML = '';
    var wrapE = document.createElement('div'); wrapE.className = 'empty';
    wrapE.innerHTML = 'Ask about products, proposals, or the platform.<div class="suggs"></div>';
    var sg = (BOOT.suggestions && (BOOT.suggestions[ctx.app] || BOOT.suggestions.default)) || [];
    var s = wrapE.querySelector('.suggs');
    sg.forEach(function (q) {
      var b = document.createElement('button'); b.className = 'sugg'; b.textContent = q;
      b.onclick = function () { inputEl.value = q; send(); };
      s.appendChild(b);
    });
    msgsEl.appendChild(wrapE);
  }

  /* ------------------------------------------------------------- chat */
  function addBubble(role, text) {
    var e = msgsEl.querySelector('.empty'); if (e) e.remove();
    var row = document.createElement('div'); row.className = 'msg ' + (role === 'user' ? 'user' : 'bot');
    var b = document.createElement('div'); b.className = 'bubble'; b.textContent = text;
    row.appendChild(b); msgsEl.appendChild(row); msgsEl.scrollTop = msgsEl.scrollHeight; return b;
  }
  function addToolStrip() {
    var s = document.createElement('div'); s.className = 'tools'; msgsEl.appendChild(s);
    msgsEl.scrollTop = msgsEl.scrollHeight; return s;
  }
  var TOOL_LABEL = {
    search_products:'Searching products', get_product_details:'Loading product',
    get_recent_proposals:'Loading proposals', get_proposal_details:'Loading proposal',
    get_image_service_status:'Checking image service', get_platform_status:'Checking platform',
    remember_preference:'Saving preference'
  };
  function toolRow(name) {
    var r = document.createElement('div'); r.className = 'tool run';
    r.innerHTML = '<span class="ic">' + icon('gear') + '</span><span class="t">' + (TOOL_LABEL[name] || name) + '…</span>';
    return r;
  }

  var busy = false;
  function send() {
    var text = (inputEl.value || '').trim(); if (!text || busy) return;
    busy = true; sendEl.disabled = true; setStatus('thinking'); inputEl.value = '';
    addBubble('user', text);
    var toolStrip = null, bot = null;
    var convId = null; try { convId = localStorage.getItem(CONV_KEY); } catch (e) {}

    fetch(BASE + '/api/agent/chat', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, conversation_id: convId, context: getContext() })
    }).then(function (res) {
      if (res.status === 401) { addBubble('bot', 'Please sign in to your Lorenzo account to use the assistant.'); throw new Error('unauth'); }
      if (!res.ok || !res.body) throw new Error('http ' + res.status);
      var reader = res.body.getReader(), dec = new TextDecoder(), buf = '';
      function handle(obj) {
        if (obj.type === 'meta' || obj.type === 'done') {
          if (obj.conversation_id) { try { localStorage.setItem(CONV_KEY, obj.conversation_id); } catch (e) {} }
        } else if (obj.type === 'tool_call') {
          if (!toolStrip) toolStrip = addToolStrip();
          var r = toolRow(obj.name); r.setAttribute('data-tool', obj.name); toolStrip.appendChild(r);
          msgsEl.scrollTop = msgsEl.scrollHeight;
        } else if (obj.type === 'tool_result') {
          if (toolStrip) {
            var rows = toolStrip.querySelectorAll('[data-tool="' + obj.name + '"].run');
            var r = rows[rows.length - 1];
            if (r) { r.className = 'tool ' + (obj.ok ? 'ok' : 'fail');
              r.querySelector('.t').textContent = obj.summary || (obj.ok ? 'done' : 'failed'); }
          }
        } else if (obj.type === 'delta') {
          if (!bot) bot = addBubble('bot', '');
          bot.textContent += obj.text; msgsEl.scrollTop = msgsEl.scrollHeight;
        } else if (obj.type === 'error') {
          if (!bot) bot = addBubble('bot', '');
          bot.textContent += '\n(Sorry — there was a problem answering.)'; setStatus('error');
        }
      }
      function pump() {
        return reader.read().then(function (r) {
          if (r.done) return;
          buf += dec.decode(r.value, { stream: true });
          var parts = buf.split('\n\n'); buf = parts.pop();
          parts.forEach(function (chunk) {
            var line = chunk.split('\n').find(function (l) { return l.indexOf('data:') === 0; });
            if (!line) return; var obj; try { obj = JSON.parse(line.slice(5).trim()); } catch (e) { return; }
            handle(obj);
          });
          return pump();
        });
      }
      return pump();
    }).catch(function () {
      if (!bot) addBubble('bot', 'Could not reach the assistant. Please try again.');
      setStatus('error');
    }).finally(function () {
      busy = false; sendEl.disabled = false;
      if (dot && dot.className.indexOf('error') === -1) setStatus('');
      refreshPanelContext();
    });
  }
  sendEl.onclick = send;
  inputEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });

  /* ------------------------------------------------------------- boot */
  buildBar();
  fetch(BASE + '/api/agent/bootstrap', { credentials: 'include' })
    .then(function (r) { return r.json(); })
    .then(function (d) { BOOT = d || BOOT; buildBar(); refreshPanelContext(); })
    .catch(function () {});
  // keep active-app highlight fresh on SPA navigation
  setInterval(highlightActive, 1500);
})();
