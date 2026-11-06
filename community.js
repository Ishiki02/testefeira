(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const TOKEN_KEY = 'ecorotas_token', USER_KEY = 'ecorotas_user';
  let token = null, user = null, posts = [], requestVersion = 0;
  let activeModal = null, returnFocus = null;
  try {
    token = localStorage.getItem(TOKEN_KEY);
    user = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
    if (!token || !user || typeof user !== 'object') { token = null; user = null; }
  } catch { token = null; user = null; }
  function saveSession(newToken, newUser) {
    token = newToken; user = newUser;
    try {
      if (token && user) {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      } else { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); }
    } catch { /* A sessão continua em memória se o armazenamento estiver bloqueado. */ }
    updateAuthUI();
  }
  function feedback(id, message = '', type = 'error') {
    const el = $(id); el.textContent = message;
    el.className = message ? `form-feedback show ${type}` : 'form-feedback';
  }
  async function api(endpoint, { method = 'GET', body, authenticated = false } = {}) {
    const requestToken = token;
    let res;
    try {
      res = await fetch('/api' + endpoint, {
        method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(authenticated ? { Authorization: `Bearer ${requestToken}` } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(45000),
      });
    } catch { throw new Error('Não foi possível conectar. Confira sua conexão e tente novamente.'); }
    let data;
    try { data = await res.json(); } catch { throw new Error('O serviço está indisponível no momento. Tente novamente.'); }
    if (res.status === 401 && authenticated && token === requestToken) saveSession(null, null);
    if (!res.ok) throw new Error(data.error || 'Não foi possível concluir. Tente novamente.');
    return data;
  }
  function displayName(value) {
    return typeof value === 'string' && value.trim() && !value.includes('@') ? value.trim() : '';
  }
  function updateAuthUI() {
    const logged = Boolean(user && token), name = displayName(user?.name);
    $('navAuth').hidden = logged; $('navUser').hidden = !logged;
    $('comunidadeLoggedOut').hidden = logged; $('comunidadeLogged').hidden = !logged;
    // Remove o antigo display:none do CSS apenas quando a sessão está ativa.
    $('comunidadeLogged').style.display = logged ? 'block' : 'none';
    $('navUserName').textContent = name ? `Olá, ${name.split(/\s+/)[0]}` : 'Meu perfil';
    $('openProfileBtn').title = name ? `Editar perfil de ${name}` : 'Definir meu nome';
    $('userAvatar').textContent = name ? name.split(/\s+/).slice(0, 2).map(n => Array.from(n)[0]).join('').toUpperCase() : 'EU';
    renderPosts();
  }
  function setTab(tab) {
    for (const name of ['Login', 'Register']) {
      const active = name.toLowerCase() === tab;
      $('tab' + name).classList.toggle('active', active);
      $('tab' + name).setAttribute('aria-pressed', String(active));
      $('form' + name).classList.toggle('active', active);
    }
  }
  function openModal(id, tab = 'login') {
    returnFocus = document.activeElement; activeModal = $(id);
    if (id === 'authModal') { setTab(tab); feedback('loginFeedback'); feedback('registerFeedback'); }
    else { $('profileName').value = displayName(user?.name); feedback('profileFeedback'); }
    activeModal.classList.add('open'); activeModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    document.querySelectorAll('header,main,footer').forEach(el => el.inert = true);
    activeModal.querySelector(id === 'authModal' ? '.auth-form.active input' : 'input').focus();
  }
  function closeModal() {
    if (!activeModal) return;
    activeModal.classList.remove('open'); activeModal.setAttribute('aria-hidden', 'true'); activeModal = null;
    document.body.style.overflow = '';
    document.querySelectorAll('header,main,footer').forEach(el => el.inert = false);
    if (returnFocus?.getClientRects().length) returnFocus.focus();
    else (user ? $('openProfileBtn') : $('openLoginBtn')).focus();
  }
  $('openLoginBtn').onclick = $('comunidadeLoginBtn').onclick = () => openModal('authModal');
  $('openRegisterBtn').onclick = () => openModal('authModal', 'register');
  $('openProfileBtn').onclick = () => openModal('profileModal');
  $('closeModalBtn').onclick = $('closeProfileBtn').onclick = closeModal;
  $('tabLogin').onclick = () => { setTab('login'); $('loginEmail').focus(); };
  $('tabRegister').onclick = () => { setTab('register'); $('regName').focus(); };
  for (const id of ['authModal', 'profileModal']) $(id).onclick = e => { if (e.target === $(id)) closeModal(); };
  document.addEventListener('keydown', e => {
    if (!activeModal) return;
    if (e.key === 'Escape') closeModal();
    if (e.key === 'Tab') {
      const nodes = [...activeModal.querySelectorAll('button,input,[tabindex="0"]')].filter(el => !el.disabled && el.getClientRects().length);
      const first = nodes[0], last = nodes.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  async function submit(buttonId, feedbackId, pending, action) {
    const button = $(buttonId), original = button.textContent;
    if (button.disabled) return;
    feedback(feedbackId); button.disabled = true; button.textContent = pending;
    try { await action(); } catch (err) { feedback(feedbackId, err.message); }
    finally { button.disabled = false; button.textContent = original; }
  }
  for (const mode of ['login', 'register']) {
    $(mode === 'login' ? 'formLogin' : 'formRegister').onsubmit = e => {
      e.preventDefault();
      submit(mode + 'SubmitBtn', mode + 'Feedback', mode === 'login' ? 'Entrando...' : 'Criando conta...', async () => {
        const prefix = mode === 'login' ? 'login' : 'reg';
        const body = { email: $(prefix + 'Email').value.trim(), password: $(prefix + 'Password').value };
        if (mode === 'register') body.name = $('regName').value.trim();
        const data = await api('/' + mode, { method: 'POST', body });
        if (!data.token || !data.user) throw new Error('Resposta de acesso inválida. Tente novamente.');
        saveSession(data.token, data.user); closeModal(); e.target.reset();
        loadPosts();
        if (!displayName(data.user.name)) openModal('profileModal');
      });
    };
  }
  $('profileForm').onsubmit = e => {
    e.preventDefault();
    submit('profileSubmitBtn', 'profileFeedback', 'Salvando...', async () => {
      const sessionToken = token;
      const data = await api('/me', { method: 'PATCH', body: { name: $('profileName').value.trim() }, authenticated: true });
      if (token !== sessionToken) return;
      saveSession(token, data.user); closeModal(); loadPosts();
    });
  };
  $('logoutBtn').onclick = () => { saveSession(null, null); $('postContent').value = ''; $('postCount').textContent = '0/500'; feedback('postFeedback'); };
  $('postContent').oninput = () => { $('postCount').textContent = `${$('postContent').value.length}/500`; };
  $('postForm').onsubmit = e => {
    e.preventDefault();
    submit('postSubmitBtn', 'postFeedback', 'Publicando...', async () => {
      await api('/posts', { method: 'POST', body: { content: $('postContent').value.trim() }, authenticated: true });
      $('postContent').value = ''; $('postCount').textContent = '0/500';
      feedback('postFeedback', 'Publicação enviada.', 'success'); await loadPosts();
    });
  };
  function renderPosts() {
    const list = $('postList'); list.replaceChildren();
    if (!posts.length) { const p = document.createElement('p'); p.className = 'post-empty'; p.textContent = 'Ainda não há publicações. Compartilhe a primeira dica!'; list.append(p); }
    for (const post of posts) {
      const card = document.createElement('article'); card.className = 'post-card';
      const head = document.createElement('div'); head.className = 'post-card-head';
      const author = document.createElement('b'); author.textContent = displayName(post.author_name) || 'Participante';
      const time = document.createElement('time');
      const rawDate = post.created_at || '';
      const date = new Date(/^\d{4}-\d{2}-\d{2} \d{2}:/.test(rawDate) ? rawDate.replace(' ', 'T') + 'Z' : rawDate);
      if (!Number.isNaN(date.getTime())) { time.dateTime = date.toISOString(); time.textContent = date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
      head.append(author, time); const text = document.createElement('p'); text.textContent = post.content; card.append(head, text);
      if (user && token && post.author_id != null && String(post.author_id) === String(user.id)) {
        const button = document.createElement('button'); button.className = 'post-delete'; button.textContent = 'Apagar';
        button.onclick = async () => {
          if (!confirm('Apagar esta publicação?')) return;
          button.disabled = true;
          try { await api('/posts/' + encodeURIComponent(post.id), { method: 'DELETE', authenticated: true }); await loadPosts(); }
          catch (err) { feedback('postFeedback', err.message); button.disabled = false; }
        }; card.append(button);
      }
      list.append(card);
    }
  }
  async function loadPosts() {
    const version = ++requestVersion; $('postList').setAttribute('aria-busy', 'true');
    try {
      const data = await api('/posts');
      if (!Array.isArray(data.posts)) throw new Error('Não foi possível carregar as publicações.');
      if (version !== requestVersion) return;
      posts = data.posts; renderPosts();
    } catch (err) {
      if (version !== requestVersion) return;
      const message = document.createElement('p'); message.className = 'post-empty'; message.textContent = err.message;
      const retry = document.createElement('button'); retry.className = 'btn-auth'; retry.textContent = 'Tentar novamente'; retry.onclick = loadPosts;
      $('postList').replaceChildren(message, retry);
    } finally { if (version === requestVersion) $('postList').setAttribute('aria-busy', 'false'); }
  }
  async function refreshSession() {
    if (!token) return;
    const previous = token;
    try {
      const data = await api('/me', { authenticated: true });
      if (token === previous) saveSession(token, data.user);
    } catch { /* Falhas de rede não apagam a sessão; 401 é tratado pela API. */ }
  }
  window.addEventListener('storage', e => {
    if (![TOKEN_KEY, USER_KEY, null].includes(e.key)) return;
    try { token = localStorage.getItem(TOKEN_KEY); user = JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { token = null; user = null; }
    updateAuthUI(); refreshSession();
  });
  updateAuthUI(); refreshSession(); loadPosts();
})();
