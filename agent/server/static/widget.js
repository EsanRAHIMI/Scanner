/*
 * Lorenzo Agent — embeddable floating navigation + AI chat widget.
 *
 * One file, framework-agnostic, served by the agent service and embedded via a
 * single <script> tag in each app. Renders inside a Shadow DOM so it never
 * touches host-app styles, and is position:fixed so it causes no layout shift.
 *
 * It derives the agent API base from its own <script> src origin, so no app
 * needs to hardcode the agent URL.
 */
(function () {
  'use strict';
  if (window.__lorenzoAgentLoaded) return;
  window.__lorenzoAgentLoaded = true;

  var SELF = document.currentScript;
  function agentBase() {
    try {
      if (SELF && SELF.src) return new URL(SELF.src).origin;
    } catch (e) {}
    var s = document.querySelector('script[src*="/static/widget.js"]');
    if (s) { try { return new URL(s.src).origin; } catch (e) {} }
    return window.location.origin;
  }
  var BASE = agentBase();
  var CONV_KEY = 'lorenzo_agent_conv_v1';

  /* ---------------------------------------------------------------- styles */
  var CSS = `
  :host { all: initial; }
  * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
  .wrap { position: fixed; left: 0; right: 0; bottom: 0; z-index: 2147483000;
          display: flex; justify-content: center; pointer-events: none;
          padding: 0 12px calc(12px + env(safe-area-inset-bottom)); }
  .bar { pointer-events: auto; display: flex; align-items: center; gap: 6px;
         padding: 8px; border-radius: 22px;
         background: rgba(255,255,255,0.62); backdrop-filter: blur(18px) saturate(160%);
         -webkit-backdrop-filter: blur(18px) saturate(160%);
         border: 1px solid rgba(255,255,255,0.55);
         box-shadow: 0 10px 30px rgba(40,20,30,0.18), 0 2px 8px rgba(0,0,0,0.06);
         transition: transform .35s cubic-bezier(.22,1,.36,1); }
  @media (prefers-color-scheme: dark) {
    .bar { background: rgba(28,24,26,0.6); border-color: rgba(255,255,255,0.12);
           box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    .btn { color: #f2eee9; }
    .btn:hover { background: rgba(255,255,255,0.10); }
    .label { color: rgba(242,238,233,0.85); }
  }
  .btn { display: flex; flex-direction: column; align-items: center; justify-content: center;
         gap: 2px; width: 60px; height: 50px; border: 0; background: transparent;
         border-radius: 16px; cursor: pointer; color: #3a2630; transition: background .2s, transform .15s; }
  .btn:hover { background: rgba(120,20,50,0.08); }
  .btn:active { transform: scale(.93); }
  .btn svg { width: 20px; height: 20px; }
  .label { font-size: 10px; font-weight: 600; letter-spacing: .02em; color: rgba(58,38,48,0.8); }
  .ai { width: 58px; height: 58px; border-radius: 50%; margin: 0 2px;
        background: linear-gradient(145deg, #6d1430, #9c1f45); color: #fff;
        box-shadow: 0 8px 20px rgba(120,20,50,0.45); position: relative; }
  .ai:hover { background: linear-gradient(145deg, #7a163668, #ac2350); }
  .ai svg { width: 26px; height: 26px; }
  .dot { position: absolute; top: 8px; right: 9px; width: 9px; height: 9px; border-radius: 50%;
         background: #46d17f; border: 2px solid rgba(255,255,255,0.85); transition: background .3s; }
  .dot.thinking { background: #f2b203; animation: pulse 1s infinite; }
  .dot.error { background: #e5484d; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.35} }

  .panel { pointer-events: auto; position: fixed; right: 16px; bottom: 86px;
           width: 380px; max-width: calc(100vw - 24px); height: 540px; max-height: calc(100vh - 120px);
           display: flex; flex-direction: column; border-radius: 22px; overflow: hidden;
           background: rgba(255,255,255,0.82); backdrop-filter: blur(26px) saturate(180%);
           -webkit-backdrop-filter: blur(26px) saturate(180%);
           border: 1px solid rgba(255,255,255,0.6);
           box-shadow: 0 24px 60px rgba(40,20,30,0.30);
           transform: translateY(16px) scale(.98); opacity: 0; visibility: hidden;
           transition: transform .38s cubic-bezier(.22,1,.36,1), opacity .28s ease, visibility .28s; }
  .panel.open { transform: translateY(0) scale(1); opacity: 1; visibility: visible; }
  @media (prefers-color-scheme: dark) {
    .panel { background: rgba(26,22,24,0.86); border-color: rgba(255,255,255,0.12); }
    .head, .msg.bot .bubble { color: #f2eee9; }
    .composer input { color: #f2eee9; background: rgba(255,255,255,0.06); }
    .msg.bot .bubble { background: rgba(255,255,255,0.08); }
  }
  @media (max-width: 520px) {
    .panel { right: 8px; left: 8px; width: auto; bottom: 84px; height: 70vh; }
  }
  .head { display: flex; align-items: center; gap: 8px; padding: 14px 16px;
          font-weight: 700; font-size: 14px; color: #2a1c24;
          border-bottom: 1px solid rgba(0,0,0,0.06); }
  .head .sub { font-weight: 500; font-size: 11px; opacity: .6; margin-left: auto; }
  .close { margin-left: 8px; border: 0; background: transparent; cursor: pointer; font-size: 18px; opacity:.6; }
  .msgs { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
  .msg { display: flex; }
  .msg.user { justify-content: flex-end; }
  .bubble { max-width: 84%; padding: 9px 12px; border-radius: 16px; font-size: 13.5px; line-height: 1.45; white-space: pre-wrap; word-wrap: break-word; }
  .msg.user .bubble { background: linear-gradient(145deg,#7a1636,#9c1f45); color: #fff; border-bottom-right-radius: 5px; }
  .msg.bot .bubble { background: rgba(0,0,0,0.05); color: #2a1c24; border-bottom-left-radius: 5px; }
  .empty { margin: auto; text-align: center; color: rgba(0,0,0,0.45); font-size: 13px; padding: 20px; }
  .composer { display: flex; gap: 8px; padding: 12px; border-top: 1px solid rgba(0,0,0,0.06); }
  .composer input { flex: 1; border: 1px solid rgba(0,0,0,0.12); background: rgba(255,255,255,0.7);
                    border-radius: 14px; padding: 10px 12px; font-size: 13.5px; outline: none; }
  .composer input:focus { border-color: #9c1f45; }
  .send { border: 0; border-radius: 14px; padding: 0 14px; background: #9c1f45; color: #fff; font-weight: 700; cursor: pointer; }
  .send:disabled { opacity: .5; cursor: default; }
  `;

  /* ----------------------------------------------------------------- icons */
  function icon(name) {
    var p = {
      products: '<path d="M3 7l9-4 9 4-9 4-9-4zm0 5l9 4 9-4M3 17l9 4 9-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
      proposals: '<path d="M7 3h7l5 5v13H7zM14 3v5h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9.5 13h6M9.5 16.5h6" stroke="currentColor" stroke-width="1.6"/>',
      images: '<rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="8.5" cy="9.5" r="1.6" fill="currentColor"/><path d="M5 18l4.5-4.5 3 3L17 11l3 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
      marketing: '<path d="M4 13V9a1 1 0 011-1h3l7-4v14l-7-4H5a1 1 0 01-1-1z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M18 9a3 3 0 010 6" fill="none" stroke="currentColor" stroke-width="1.8"/>',
      ai: '<path d="M12 3v2M12 19v2M3 12h2M19 12h2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><rect x="6" y="6" width="12" height="12" rx="4" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="9.5" cy="12" r="1.3" fill="currentColor"/><circle cx="14.5" cy="12" r="1.3" fill="currentColor"/>'
    };
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (p[name] || '') + '</svg>';
  }

  /* ------------------------------------------------------------------ mount */
  var host = document.createElement('div');
  host.id = 'lorenzo-agent-root';
  document.body.appendChild(host);
  var root = host.attachShadow({ mode: 'open' });
  var style = document.createElement('style');
  style.textContent = CSS;
  root.appendChild(style);

  var wrap = document.createElement('div');
  wrap.className = 'wrap';
  root.appendChild(wrap);

  var bar = document.createElement('div');
  bar.className = 'bar';
  wrap.appendChild(bar);

  function navButton(name, label, url) {
    var b = document.createElement('button');
    b.className = 'btn';
    b.innerHTML = icon(name) + '<span class="label">' + label + '</span>';
    b.onclick = function () { if (url) window.location.href = url; };
    return b;
  }

  var panel = document.createElement('div');
  panel.className = 'panel';
  panel.innerHTML =
    '<div class="head">Lorenzo AI <span class="sub" data-sub></span>' +
    '<button class="close" title="Close">×</button></div>' +
    '<div class="msgs"><div class="empty">Ask me about products, proposals, or how to get around the platform.</div></div>' +
    '<div class="composer"><input type="text" placeholder="Message Lorenzo AI…" /><button class="send">Send</button></div>';
  wrap.appendChild(panel);

  var dot, aiBtn, msgsEl = panel.querySelector('.msgs'),
      inputEl = panel.querySelector('input'),
      sendEl = panel.querySelector('.send'),
      subEl = panel.querySelector('[data-sub]');
  panel.querySelector('.close').onclick = function () { panel.classList.remove('open'); };

  function setStatus(s) { if (dot) dot.className = 'dot' + (s ? ' ' + s : ''); }

  function buildBar(nav, authed, provider) {
    bar.innerHTML = '';
    bar.appendChild(navButton('products', 'Products', nav && nav.products));
    bar.appendChild(navButton('proposals', 'Proposals', nav && nav.proposals));
    aiBtn = document.createElement('button');
    aiBtn.className = 'btn ai';
    aiBtn.innerHTML = icon('ai') + '<span class="dot"></span>';
    dot = aiBtn.querySelector('.dot');
    aiBtn.onclick = function () {
      panel.classList.toggle('open');
      if (panel.classList.contains('open')) setTimeout(function(){ inputEl.focus(); }, 80);
    };
    bar.appendChild(aiBtn);
    bar.appendChild(navButton('images', 'Images', nav && nav.images));
    bar.appendChild(navButton('marketing', 'Marketing', nav && nav.marketing));
    subEl.textContent = authed ? (provider || '') : 'sign in to chat';
  }

  /* -------------------------------------------------------------- messaging */
  function addBubble(role, text) {
    var empty = msgsEl.querySelector('.empty');
    if (empty) empty.remove();
    var row = document.createElement('div');
    row.className = 'msg ' + (role === 'user' ? 'user' : 'bot');
    var b = document.createElement('div');
    b.className = 'bubble';
    b.textContent = text;
    row.appendChild(b);
    msgsEl.appendChild(row);
    msgsEl.scrollTop = msgsEl.scrollHeight;
    return b;
  }

  var busy = false;
  function send() {
    var text = (inputEl.value || '').trim();
    if (!text || busy) return;
    busy = true; sendEl.disabled = true; setStatus('thinking');
    inputEl.value = '';
    addBubble('user', text);
    var bot = addBubble('bot', '');
    var convId = null;
    try { convId = localStorage.getItem(CONV_KEY); } catch (e) {}

    fetch(BASE + '/api/agent/chat', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, conversation_id: convId })
    }).then(function (res) {
      if (res.status === 401) { bot.textContent = 'Please sign in to your Lorenzo account to chat.'; throw new Error('unauth'); }
      if (!res.ok || !res.body) throw new Error('http ' + res.status);
      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var buf = '';
      function pump() {
        return reader.read().then(function (r) {
          if (r.done) return;
          buf += decoder.decode(r.value, { stream: true });
          var parts = buf.split('\n\n');
          buf = parts.pop();
          parts.forEach(function (chunk) {
            var line = chunk.split('\n').find(function (l) { return l.indexOf('data:') === 0; });
            if (!line) return;
            var obj;
            try { obj = JSON.parse(line.slice(5).trim()); } catch (e) { return; }
            if (obj.type === 'meta' || obj.type === 'done') {
              if (obj.conversation_id) { try { localStorage.setItem(CONV_KEY, obj.conversation_id); } catch (e) {} }
            } else if (obj.type === 'delta') {
              bot.textContent += obj.text;
              msgsEl.scrollTop = msgsEl.scrollHeight;
            } else if (obj.type === 'error') {
              bot.textContent += '\n(Sorry — the assistant had a problem answering.)';
              setStatus('error');
            }
          });
          return pump();
        });
      }
      return pump();
    }).catch(function () {
      if (!bot.textContent) bot.textContent = 'Could not reach the assistant. Please try again.';
      setStatus('error');
    }).finally(function () {
      busy = false; sendEl.disabled = false;
      if (dot && dot.className.indexOf('error') === -1) setStatus('');
    });
  }
  sendEl.onclick = send;
  inputEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });

  /* ----------------------------------------------------------- bootstrap UI */
  buildBar(null, false, '');
  fetch(BASE + '/api/agent/bootstrap', { credentials: 'include' })
    .then(function (r) { return r.json(); })
    .then(function (d) { buildBar(d.nav, d.authenticated, d.llm_provider); })
    .catch(function () { /* keep default bar */ });
})();
