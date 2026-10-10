(function () {
  'use strict';

  var LANG_KEY    = 'rc2_lang';
  var TOKEN_KEY   = 'rc_acct_token';
  var USER_KEY    = 'rc_acct_user';
  var DAYS_KEY    = 'rc_acct_days';
  var UID_KEY     = 'rc_acct_uid';
  var CREATED_KEY = 'rc_acct_created';
  var MIN_DAYS    = 80;

  function getToken()   { return localStorage.getItem(TOKEN_KEY); }
  function getUser()    { return localStorage.getItem(USER_KEY); }
  function getDays()    { return parseInt(localStorage.getItem(DAYS_KEY) || '0', 10); }

  function saveVerification(id, name, days, created) {
    var arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    var hex = Array.from(arr).map(function(b){ return b.toString(16).padStart(2,'0'); }).join('');
    var token = 'RBX-' + id + '-' + hex.toUpperCase();
    localStorage.setItem(TOKEN_KEY,   token);
    localStorage.setItem(USER_KEY,    name);
    localStorage.setItem(DAYS_KEY,    String(days));
    localStorage.setItem(UID_KEY,     String(id));
    localStorage.setItem(CREATED_KEY, created || '');
    return token;
  }

  /* ── Sound ────────────────────────────────────────── */
  var audio = null;
  function playClick() {
    try {
      if (!audio) { audio = new Audio('/click-sound.mp3'); audio.volume = 0.5; }
      audio.currentTime = 0;
      audio.play().catch(function(){});
    } catch(e){}
  }

  /* ── Discord logs ─────────────────────────────────── */
  function logAccess() {
    if (sessionStorage.getItem('rc_logged_access')) return;
    sessionStorage.setItem('rc_logged_access', '1');
    fetch('/api/log-access', { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' })
      .catch(function(){});
  }

  function logVerify(id, name, days, created) {
    fetch('/api/log-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: id, username: name, days: days, created: created })
    }).catch(function(){});
  }

  function logGame(gameName, gameUrl) {
    fetch('/api/log-game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameName: gameName, gameUrl: gameUrl, username: getUser() || 'N/A' })
    }).catch(function(){});
  }

  /* ── Toast warning ────────────────────────────────── */
  var WARN_MSGS = {
    en: 'Verify your Roblox account first to access the game.',
    es: 'Verifica tu cuenta de Roblox primero para acceder al juego.',
    pt: 'Verifique sua conta Roblox primeiro para acessar o jogo.',
    ru: '\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0435 \u0443\u0447\u0451\u0442\u043d\u0443\u044e \u0437\u0430\u043f\u0438\u0441\u044c Roblox.',
  };
  function showWarning() {
    var lang = localStorage.getItem(LANG_KEY) || 'pt';
    var msg  = WARN_MSGS[lang] || WARN_MSGS.en;
    var old  = document.getElementById('rc-token-warning');
    if (old) old.remove();
    var warn = document.createElement('div');
    warn.id = 'rc-token-warning';
    warn.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#0c1a3d;border:1px solid rgba(59,130,246,0.4);color:#93c5fd;font-size:13px;font-weight:600;padding:10px 22px;border-radius:12px;z-index:999999;white-space:nowrap;box-shadow:0 8px 32px rgba(37,99,235,0.3);font-family:Outfit,Inter,sans-serif;';
    warn.textContent = msg;
    document.body.appendChild(warn);
    setTimeout(function(){ warn.remove(); }, 3200);
  }

  /* ── Auto language detection ──────────────────────── */
  function autoDetectLanguage() {
    if (localStorage.getItem(LANG_KEY)) return;
    fetch('/api/detect-region')
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(data) {
        if (!data || !data.lang) return;
        if (localStorage.getItem(LANG_KEY)) return;
        localStorage.setItem(LANG_KEY, data.lang);
        var ov = document.getElementById('rc-lang-overlay');
        if (ov) {
          ov.style.animation = 'rc-fadeout .2s ease forwards';
          setTimeout(function(){ ov.classList.add('rc-hidden'); }, 210);
        }
        rebuildVerifyTexts();
      })
      .catch(function(){});
  }

  function dismissLangOverlay(lang) {
    localStorage.setItem(LANG_KEY, lang);
    var overlay = document.getElementById('rc-lang-overlay');
    if (overlay) {
      overlay.style.animation = 'rc-fadeout .2s ease forwards';
      setTimeout(function(){ overlay.classList.add('rc-hidden'); }, 210);
    }
  }

  /* ═══════════════════════════════════════════════════
     VERIFICATION OVERLAY
  ═══════════════════════════════════════════════════ */
  function injectVerifyStyles() {
    if (document.getElementById('rc-vs')) return;
    var s = document.createElement('style');
    s.id = 'rc-vs';
    s.textContent = '#rc-verify-overlay{position:fixed;inset:0;z-index:999998;background:rgba(4,9,19,0.97);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);display:flex;align-items:center;justify-content:center;font-family:Outfit,Inter,sans-serif;animation:rcfi .3s ease;}'
      +'@keyframes rcfi{from{opacity:0}to{opacity:1}}'
      +'@keyframes rcfo{from{opacity:1}to{opacity:0}}'
      +'.rc-vm{position:relative;width:100%;max-width:430px;margin:0 16px;background:linear-gradient(180deg,rgba(12,22,50,.98) 0%,rgba(8,16,38,.98) 100%);border:1px solid rgba(59,130,246,.2);border-radius:24px;padding:40px 36px 32px;box-shadow:0 40px 80px rgba(0,0,0,.8),inset 0 1px 0 rgba(255,255,255,.05);text-align:center;overflow:hidden;}'
      +'.rc-vm::before{content:"";position:absolute;top:0;left:20%;right:20%;height:1px;background:linear-gradient(90deg,transparent,rgba(96,165,250,.6),transparent);}'
      +'.rc-vglow{position:absolute;top:-60px;left:50%;transform:translateX(-50%);width:220px;height:220px;border-radius:50%;background:radial-gradient(circle,rgba(59,130,246,.15) 0%,transparent 70%);pointer-events:none;}'
      +'.rc-vlogo{width:56px;height:56px;border-radius:16px;margin:0 auto 20px;background:linear-gradient(135deg,#1d4ed8,#3b82f6);display:flex;align-items:center;justify-content:center;box-shadow:0 0 40px rgba(59,130,246,.5);}'
      +'.rc-vtitle{font-size:1.5rem;font-weight:800;margin:0 0 8px;background:linear-gradient(90deg,#fff 40%,rgba(147,197,253,.9) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}'
      +'.rc-vsub{font-size:.875rem;color:rgba(148,163,184,.8);margin:0 0 24px;line-height:1.6;}'
      +'.rc-vinput{width:100%;padding:12px 16px;border-radius:12px;background:rgba(37,99,235,.06);border:1px solid rgba(59,130,246,.2);color:#e2e8f0;font-family:Outfit,Inter,sans-serif;font-size:.9rem;font-weight:500;outline:none;transition:border-color .2s,box-shadow .2s;box-sizing:border-box;margin-bottom:12px;}'
      +'.rc-vinput::placeholder{color:rgba(148,163,184,.5);}'
      +'.rc-vinput:focus{border-color:rgba(59,130,246,.5);box-shadow:0 0 0 3px rgba(59,130,246,.12);}'
      +'.rc-verr{border-radius:12px;padding:12px 16px;margin-bottom:12px;font-size:.82rem;font-weight:500;line-height:1.6;text-align:left;background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.3);color:#fca5a5;white-space:pre-line;}'
      +'.rc-vbtn{width:100%;padding:13px;border-radius:14px;border:none;cursor:pointer;background:linear-gradient(135deg,#1d4ed8 0%,#3b82f6 60%,#2563eb 100%);color:#fff;font-family:Outfit,Inter,sans-serif;font-size:.95rem;font-weight:700;letter-spacing:.01em;margin-bottom:16px;box-shadow:0 0 0 1px rgba(59,130,246,.3),0 4px 20px rgba(37,99,235,.4),inset 0 1px 0 rgba(255,255,255,.15);transition:all .25s ease;display:flex;align-items:center;justify-content:center;gap:8px;}'
      +'.rc-vbtn:hover:not(:disabled){background:linear-gradient(135deg,#2563eb 0%,#60a5fa 60%,#3b82f6 100%);box-shadow:0 0 0 1px rgba(96,165,250,.5),0 6px 30px rgba(59,130,246,.55),inset 0 1px 0 rgba(255,255,255,.2);transform:translateY(-1px);}'
      +'.rc-vbtn:disabled{opacity:.6;cursor:not-allowed;transform:none;}'
      +'.rc-spin{width:16px;height:16px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:rcsp .7s linear infinite;}'
      +'@keyframes rcsp{to{transform:rotate(360deg)}}'
      +'.rc-vhint{font-size:.78rem;color:rgba(148,163,184,.5);margin:0;}'
      +'.rc-vhint strong{color:rgba(96,165,250,.7);}'
      +'.rch{display:none!important;}';
    document.head.appendChild(s);
  }

  var V_TEXT = {
    en:{ title:'Account Verification', sub:'To access the games, enter your Roblox username. We will check if your account meets the minimum requirements.', ph:'Your Roblox username', btn:'Verify Account', loading:'Verifying...', hint:'Your account must be at least <strong>80 days</strong> old.', err_empty:'Please enter your Roblox username.', err_nf:'User not found. Check the name and try again.', err_age:'Use another account or wait for your account to get older.\n\nAccount @{name}: {days} day(s). {missing} more day(s) needed to reach the {min}-day requirement.', err_conn:'Connection error. Check your internet and try again.', err_generic:'Error verifying account. Please try again.' },
    pt:{ title:'Verifica\u00e7\u00e3o de Conta', sub:'Para acessar os jogos, informe seu usu\u00e1rio do Roblox. Verificaremos se sua conta atende os requisitos m\u00ednimos.', ph:'Seu usu\u00e1rio do Roblox', btn:'Verificar Conta', loading:'Verificando...', hint:'Sua conta precisa ter no m\u00ednimo <strong>80 dias</strong> de cria\u00e7\u00e3o.', err_empty:'Por favor, informe seu usu\u00e1rio do Roblox.', err_nf:'Usu\u00e1rio n\u00e3o encontrado. Verifique o nome e tente novamente.', err_age:'Utilize outra conta ou aguarde sua conta ficar mais velha.\n\nConta @{name}: {days} dia(s). Faltam {missing} dia(s) para atingir os {min} dias necess\u00e1rios.', err_conn:'Erro de conex\u00e3o. Verifique sua internet e tente novamente.', err_generic:'Erro ao verificar a conta. Tente novamente.' },
    es:{ title:'Verificaci\u00f3n de Cuenta', sub:'Para acceder a los juegos, ingresa tu usuario de Roblox. Verificaremos si tu cuenta cumple los requisitos m\u00ednimos.', ph:'Tu usuario de Roblox', btn:'Verificar Cuenta', loading:'Verificando...', hint:'Tu cuenta debe tener al menos <strong>80 d\u00edas</strong> de creaci\u00f3n.', err_empty:'Por favor, ingresa tu usuario de Roblox.', err_nf:'Usuario no encontrado. Verifica el nombre e int\u00e9ntalo de nuevo.', err_age:'Usa otra cuenta o espera a que tu cuenta sea m\u00e1s antigua.\n\nCuenta @{name}: {days} d\u00eda(s). Faltan {missing} d\u00edas para alcanzar los {min} d\u00edas requeridos.', err_conn:'Error de conexi\u00f3n. Verifica tu internet e int\u00e9ntalo de nuevo.', err_generic:'Error al verificar la cuenta. Int\u00e9ntalo de nuevo.' },
    ru:{ title:'\u041f\u0440\u043e\u0432\u0435\u0440\u043a\u0430 \u0430\u043a\u043a\u0430\u0443\u043d\u0442\u0430', sub:'\u0427\u0442\u043e\u0431\u044b \u043f\u043e\u043b\u0443\u0447\u0438\u0442\u044c \u0434\u043e\u0441\u0442\u0443\u043f \u043a \u0438\u0433\u0440\u0430\u043c, \u0432\u0432\u0435\u0434\u0438\u0442\u0435 \u0438\u043c\u044f \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f Roblox.', ph:'\u0412\u0430\u0448 \u043d\u0438\u043a Roblox', btn:'\u041f\u0440\u043e\u0432\u0435\u0440\u0438\u0442\u044c \u0430\u043a\u043a\u0430\u0443\u043d\u0442', loading:'\u041f\u0440\u043e\u0432\u0435\u0440\u043a\u0430...', hint:'\u0412\u0430\u0448\u0435\u043c\u0443 \u0430\u043a\u043a\u0430\u0443\u043d\u0442\u0443 \u0434\u043e\u043b\u0436\u043d\u043e \u0431\u044b\u0442\u044c \u043d\u0435 \u043c\u0435\u043d\u0435\u0435 <strong>80 \u0434\u043d\u0435\u0439</strong>.', err_empty:'\u041f\u043e\u0436\u0430\u043b\u0443\u0439\u0441\u0442\u0430, \u0432\u0432\u0435\u0434\u0438\u0442\u0435 \u0438\u043c\u044f \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f.', err_nf:'\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d.', err_age:'\u0418\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0439\u0442\u0435 \u0434\u0440\u0443\u0433\u043e\u0439 \u0430\u043a\u043a\u0430\u0443\u043d\u0442 \u0438\u043b\u0438 \u043f\u043e\u0434\u043e\u0436\u0434\u0438\u0442\u0435.\n\n@{name}: {days} \u0434\u043d\u0435\u0439. \u0415\u0449\u0451 {missing} \u0434\u043d\u0435\u0439 \u0434\u043e {min} \u0434\u043d\u0435\u0439.', err_conn:'\u041e\u0448\u0438\u0431\u043a\u0430 \u0441\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u044f. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u0435\u0449\u0451 \u0440\u0430\u0437.', err_generic:'\u041e\u0448\u0438\u0431\u043a\u0430 \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0438. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u0435\u0449\u0451 \u0440\u0430\u0437.' },
  };

  function t(key, rep) {
    var lang = localStorage.getItem(LANG_KEY) || 'en';
    var tbl  = V_TEXT[lang] || V_TEXT.en;
    var str  = tbl[key] || V_TEXT.en[key] || key;
    if (rep) Object.keys(rep).forEach(function(k){ str = str.replace(new RegExp('\\{'+k+'\\}','g'), rep[k]); });
    return str;
  }

  function createVerifyOverlay() {
    injectVerifyStyles();
    var el = document.createElement('div');
    el.id = 'rc-verify-overlay';
    el.innerHTML = '<div class="rc-vm">'
      +'<div class="rc-vglow"></div>'
      +'<div class="rc-vlogo"><svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>'
      +'<h2 class="rc-vtitle" id="rc-vtitle">'+t('title')+'</h2>'
      +'<p class="rc-vsub" id="rc-vsub">'+t('sub')+'</p>'
      +'<input id="rc-vi" class="rc-vinput" type="text" placeholder="'+t('ph')+'" autocomplete="off" spellcheck="false"/>'
      +'<div id="rc-ve" class="rc-verr rch"></div>'
      +'<button id="rc-vb" class="rc-vbtn"><span id="rc-vbt">'+t('btn')+'</span><span id="rc-vsp" class="rc-spin rch"></span></button>'
      +'<p class="rc-vhint" id="rc-vhint">'+t('hint')+'</p>'
      +'</div>';
    document.body.appendChild(el);
    bindVerifyEvents();
  }

  function rebuildVerifyTexts() {
    var el;
    if ((el=document.getElementById('rc-vtitle'))) el.textContent = t('title');
    if ((el=document.getElementById('rc-vsub')))   el.textContent = t('sub');
    if ((el=document.getElementById('rc-vi')))     el.placeholder = t('ph');
    if ((el=document.getElementById('rc-vbt')))    el.textContent = t('btn');
    if ((el=document.getElementById('rc-vhint')))  el.innerHTML   = t('hint');
  }

  function dismissVerifyOverlay() {
    var ov = document.getElementById('rc-verify-overlay');
    if (ov) {
      ov.style.animation = 'rcfo .25s ease forwards';
      setTimeout(function(){ ov.remove(); }, 260);
    }
  }

  function bindVerifyEvents() {
    var input  = document.getElementById('rc-vi');
    var btn    = document.getElementById('rc-vb');
    var btext  = document.getElementById('rc-vbt');
    var spin   = document.getElementById('rc-vsp');
    var errdiv = document.getElementById('rc-ve');
    function setErr(msg) { errdiv.textContent = msg; errdiv.classList.remove('rch'); }
    function clearErr()  { errdiv.classList.add('rch'); }
    function setLoading(on) {
      btn.disabled = on;
      btext.textContent = on ? t('loading') : t('btn');
      if (on) spin.classList.remove('rch'); else spin.classList.add('rch');
    }
    input && input.addEventListener('keydown', function(e){ if (e.key==='Enter') btn && btn.click(); });
    btn && btn.addEventListener('click', function() {
      var username = input ? input.value.trim() : '';
      if (!username) { setErr(t('err_empty')); return; }
      clearErr(); setLoading(true); playClick();
      fetch('/api/check-account?username='+encodeURIComponent(username))
        .then(function(r){ return r.json().then(function(d){ return {ok:r.ok,status:r.status,data:d}; }); })
        .then(function(res) {
          setLoading(false);
          if (res.status===404) { setErr(t('err_nf')); return; }
          if (!res.ok)          { setErr(t('err_generic')); return; }
          var d = res.data;
          if (d.days < MIN_DAYS) {
            setErr(t('err_age',{name:d.name,days:d.days,missing:MIN_DAYS-d.days,min:MIN_DAYS}));
            return;
          }
          saveVerification(d.id, d.name, d.days, d.created);
          logVerify(d.id, d.name, d.days, d.created);
          dismissVerifyOverlay();
        })
        .catch(function(){ setLoading(false); setErr(t('err_conn')); });
    });
  }

  /* ═══════════════════════════════════════════════════
     TOKEN CARD INJECTION
  ═══════════════════════════════════════════════════ */
  var TL = {
    en:{ label:'Access Token', purpose:'Exclusive game access', linked:'Linked to', who:'Who can use', age:'Account age' },
    pt:{ label:'Token de Acesso', purpose:'Acesso exclusivo aos jogos', linked:'Vinculado a', who:'Quem pode usar', age:'Conta com' },
    es:{ label:'Token de Acceso', purpose:'Acceso exclusivo a los juegos', linked:'Vinculado a', who:'Qui\u00e9n puede usar', age:'Cuenta con' },
    ru:{ label:'\u0422\u043e\u043a\u0435\u043d \u0434\u043e\u0441\u0442\u0443\u043f\u0430', purpose:'\u0418\u0441\u043a\u043b\u044e\u0447\u0438\u0442\u0435\u043b\u044c\u043d\u044b\u0439 \u0434\u043e\u0441\u0442\u0443\u043f \u043a \u0438\u0433\u0440\u0430\u043c', linked:'\u0421\u0432\u044f\u0437\u0430\u043d \u0441', who:'\u041a\u0442\u043e \u043c\u043e\u0436\u0435\u0442 \u0438\u0441\u043f.', age:'\u0412\u043e\u0437\u0440\u0430\u0441\u0442 \u0430\u043a.' },
  };
  function tl(k){ var lang=localStorage.getItem(LANG_KEY)||'en'; var tb=TL[lang]||TL.en; return tb[k]||TL.en[k]||k; }

  function injectTokenStyles() {
    if (document.getElementById('rc-ts')) return;
    var s = document.createElement('style');
    s.id = 'rc-ts';
    s.textContent = '.rc-td{width:100%;font-family:Outfit,Inter,sans-serif;}.rc-tcard{background:rgba(37,99,235,.05);border:1px solid rgba(59,130,246,.18);border-radius:14px;padding:14px;margin-bottom:4px;}.rc-tlabel{font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:rgba(96,165,250,.7);margin-bottom:10px;}.rc-trow{display:flex;align-items:center;gap:8px;margin-bottom:10px;background:rgba(37,99,235,.08);border-radius:8px;padding:8px 10px;border:1px solid rgba(59,130,246,.1);}.rc-tval{flex:1;font-family:monospace;font-size:.67rem;color:#93c5fd;word-break:break-all;line-height:1.5;}.rc-tcopy{flex-shrink:0;width:28px;height:28px;border-radius:6px;background:rgba(37,99,235,.1);border:1px solid rgba(59,130,246,.18);color:#93c5fd;cursor:pointer;font-size:.85rem;display:flex;align-items:center;justify-content:center;transition:background .2s;font-family:monospace;line-height:1;}.rc-tcopy:hover{background:rgba(59,130,246,.22);}.rc-tmeta{display:flex;flex-direction:column;gap:6px;}.rc-tmi{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(59,130,246,.07);}.rc-tmi:last-child{border-bottom:none;padding-bottom:0;}.rc-tml{font-size:.73rem;color:rgba(148,163,184,.6);}.rc-tmv{font-size:.73rem;font-weight:600;color:#e2e8f0;text-align:right;}';
    document.head.appendChild(s);
  }

  function buildTokenCard(token, user, days) {
    var lang = localStorage.getItem(LANG_KEY)||'en';
    var daysStr = days + (lang==='en' ? ' days' : lang==='ru' ? ' \u0434\u043d.' : ' dias');
    var wrap = document.createElement('div');
    wrap.className = 'rc-td';
    wrap.setAttribute('data-rc-token-injected','1');
    wrap.innerHTML = '<div class="rc-tcard">'
      +'<div class="rc-tlabel">'+tl('label')+'</div>'
      +'<div class="rc-trow"><span class="rc-tval">'+token+'</span><button class="rc-tcopy" id="rc-tcp-'+Date.now()+'" title="Copy">&#x2398;</button></div>'
      +'<div class="rc-tmeta">'
      +'<div class="rc-tmi"><span class="rc-tml">'+tl('purpose')+'</span><span class="rc-tmv">@'+user+'</span></div>'
      +'<div class="rc-tmi"><span class="rc-tml">'+tl('age')+'</span><span class="rc-tmv">'+daysStr+'</span></div>'
      +'</div></div>';
    setTimeout(function(){
      var cb = wrap.querySelector('.rc-tcopy');
      if (cb) cb.addEventListener('click', function(){
        playClick();
        navigator.clipboard && navigator.clipboard.writeText(token).then(function(){
          cb.innerHTML='&#x2713;'; setTimeout(function(){ cb.innerHTML='&#x2398;'; },1800);
        });
      });
    }, 80);
    return wrap;
  }

  function tryInjectTokenInfo() {
    var token=getToken(),user=getUser(),days=getDays();
    if (!token||!user) return;
    injectTokenStyles();
    document.querySelectorAll('[data-testid="button-generate-token"]:not([data-rc-ti])').forEach(function(btn){
      btn.setAttribute('data-rc-ti','1');
      var parent=btn.parentElement;
      if (!parent) return;
      parent.replaceChild(buildTokenCard(token,user,days),btn);
    });
  }

  /* ═══════════════════════════════════════════════════
     MUTATION OBSERVER
  ═══════════════════════════════════════════════════ */
  var observer = new MutationObserver(function() {
    document.querySelectorAll('button:not([data-rc-s]),a:not([data-rc-s])').forEach(function(el){
      el.setAttribute('data-rc-s','1');
      el.addEventListener('click', playClick);
    });

    tryInjectTokenInfo();

    // Game access buttons — always let through, just log
    document.querySelectorAll('[data-testid="button-access-game"]:not([data-rc-e])').forEach(function(el){
      el.setAttribute('data-rc-e','1');
      el.removeAttribute('disabled');
      el.style.removeProperty('opacity');
      el.style.removeProperty('cursor');
      el.addEventListener('click', function(e){
        var gameUrl  = el.href || el.getAttribute('href') || '';
        var gameName = '';
        var container = el.closest('[data-testid^="card-game-"]') ||
                        el.closest('[class*="rounded-2xl"]') ||
                        el.closest('[role="dialog"]') ||
                        el.parentElement;
        if (container) {
          var heading = container.querySelector('h1,h2,h3,[class*="font-black"],[class*="font-bold"]');
          if (heading) gameName = heading.textContent.trim();
        }
        logGame(gameName, gameUrl);
      });
    });

    document.querySelectorAll('#rc-lang-overlay .rc-btn:not([data-rc-l])').forEach(function(btn){
      btn.setAttribute('data-rc-l','1');
      btn.addEventListener('click', function(){ playClick(); dismissLangOverlay(btn.dataset.lang); rebuildVerifyTexts(); });
    });

    if (localStorage.getItem(LANG_KEY)) {
      var lov = document.getElementById('rc-lang-overlay');
      if (lov && !lov.classList.contains('rc-hidden') && !lov.getAttribute('data-rc-ld')) {
        lov.setAttribute('data-rc-ld','1');
        lov.style.animation = 'rc-fadeout .2s ease forwards';
        setTimeout(function(){ lov.classList.add('rc-hidden'); }, 210);
      }
    }
  });

  /* ═══════════════════════════════════════════════════
     INIT
  ═══════════════════════════════════════════════════ */
  function init() {
    logAccess();
    autoDetectLanguage();
    observer.observe(document.body, { childList: true, subtree: true });
    if (!getToken()) createVerifyOverlay();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
