// CLTExplica — app.js v3 (limpo, sem SUPABASE_OK)

let currentUser = null
let postTags = []
let editingPostId = null
let currentAdImageBase64 = null
let editingAdDbId = null

// INIT
document.addEventListener('DOMContentLoaded', async () => {
  initRouter() // Roda primeiro para mostrar a página correta imediatamente
  await checkSession()
  await loadPublicData()
  checkCalcGate()
  const modal = document.getElementById('ad-modal')
  if (modal) modal.addEventListener('click', e => { if (e.target === modal) closeAdModal() })
})

// AUTH
async function checkSession() {
  try {
    const { data: { session } } = await sb.auth.getSession()
    if (session) currentUser = session.user
  } catch(e) {}
}

function openLoginOverlay() {
  document.getElementById('login-overlay').classList.remove('hidden')
  setTimeout(() => document.getElementById('login-email').focus(), 100)
}

async function doLogin() {
  const email = document.getElementById('login-email').value.trim()
  const pass  = document.getElementById('login-pass').value
  const btn   = document.getElementById('login-btn-text')
  const err   = document.getElementById('login-error')
  btn.textContent = 'Entrando...'
  err.classList.remove('show')
  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password: pass })
    if (error) {
      err.textContent = 'E-mail ou senha incorretos.'
      err.classList.add('show')
      btn.textContent = 'Entrar no Dashboard'
      document.getElementById('login-pass').value = ''
      return
    }
    currentUser = data.user
    document.getElementById('login-overlay').classList.add('hidden')
    btn.textContent = 'Entrar no Dashboard'
    enterDashboard()
  } catch(e) {
    err.textContent = 'Erro de conexão: ' + e.message
    err.classList.add('show')
    btn.textContent = 'Entrar no Dashboard'
  }
}

async function doLogout() {
  try { await sb.auth.signOut() } catch(e) {}
  currentUser = null
  exitDashboard()
  showToast('Sessão encerrada.')
}

// NAVEGAÇÃO
const PAGE_MAP = {
  home:        { id: 'home-page',        url: '/' },
  article:     { id: 'article-page',     url: null },
  ferramentas: { id: 'ferramentas-page', url: '/ferramentas' },
  about:       { id: 'about-page',       url: '/sobre' },
  contact:     { id: 'contact-page',     url: '/contato' },
  'aviso-legal':{ id: 'aviso-legal-page',url: '/aviso-legal' },
  privacy:     { id: 'privacy-page',     url: '/privacidade' }
}

function showPage(page, pushState = true) {
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'))
  const entry = PAGE_MAP[page] || PAGE_MAP['home']
  const el = document.getElementById(entry.id)
  if (el) el.classList.add('active')
  if (pushState && entry.url) history.pushState({ page }, '', entry.url)
  window.scrollTo({ top: 0, behavior: 'smooth' })
  return false
}

function pageFromPath(path) {
  const routes = { '/':'home', '/ferramentas':'ferramentas', '/sobre':'about', '/contato':'contact', '/aviso-legal':'aviso-legal', '/privacidade':'privacy' }
  return routes[path] || 'home'
}

window.addEventListener('popstate', (e) => {
  const page = e.state?.page || pageFromPath(location.pathname)
  showPage(page, false)
})

function initRouter() {
  // Roteamento já tratado pelo script inline no <head>
  // Aqui só tratamos artigos que precisam buscar dados
  const path = location.pathname
  if (path.startsWith('/artigo/')) {
    const slug = path.replace('/artigo/', '')
    openArticle(slug)
  }
}

function scrollToSection(id) {
  setTimeout(() => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, 100)
}

// DADOS PÚBLICOS
async function loadPublicData() {
  await Promise.all([loadCategories(), loadPublicArticles()])
}

async function loadCategories() {
  try {
    const { data } = await sb.from('categories').select('*').order('name')
    if (!data) return
    const grid = document.getElementById('categories-grid')
    if (!grid) return
    const icons = {
      'Escalas de Trabalho':'🗓️','Salário e Adicionais':'💰','FGTS e Benefícios':'🏦',
      'Direitos do Trabalhador':'⚖️','Demissão e Rescisão':'📝','Ferramentas CLT':'🧮'
    }
    const colors = ['blue','green','yellow','blue','green','yellow']
    grid.innerHTML = data.map((cat, i) => `
      <a href="#" class="cat-card" onclick="filterByCategory('${cat.name}');return false;">
        <div class="cat-icon ${colors[i%3]}">${icons[cat.name]||'📄'}</div>
        <h3>${cat.name}</h3>
        <p>${cat.description||'Ver artigos'}</p>
      </a>`).join('')
    const sel = document.getElementById('post-category')
    if (sel) sel.innerHTML = '<option value="">Selecionar...</option>' + data.map(c => `<option value="${c.name}">${c.name}</option>`).join('')
  } catch(e) {}
}

async function loadPublicArticles(category = null) {
  try {
    let q = sb.from('posts').select('id,title,slug,excerpt,category,status,published_at')
      .eq('status','published').order('published_at',{ascending:false}).limit(6)
    if (category) q = q.eq('category', category)
    const { data } = await q
    const grid = document.getElementById('articles-grid')
    if (!grid) return
    if (!data || data.length === 0) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--gray-mid);padding:32px;">Nenhum artigo publicado ainda.</div>'
      return
    }
    const colors = ['blue','green','yellow']
    grid.innerHTML = data.map((p, i) => `
      <a href="#" class="article-card" onclick="openArticle('${p.slug}');return false;">
        <div class="article-thumb ${colors[i%3]}"></div>
        <div class="article-body">
          <div class="article-cat">${p.category||''}</div>
          <h3>${p.title}</h3>
          <p>${p.excerpt||''}</p>
          <div class="article-meta">${formatDate(p.published_at)}</div>
        </div>
      </a>`).join('')
  } catch(e) {}
}

async function openArticle(slug) {
  try {
    const { data } = await sb.from('posts').select('*').eq('slug',slug).eq('status','published').single()
    if (!data) { showToast('Artigo não encontrado.','error'); return }
    document.getElementById('article-title').textContent = data.title
    document.getElementById('article-category-breadcrumb').textContent = data.category||'Artigos'
    document.getElementById('article-date').textContent = '📅 '+formatDate(data.published_at)
    document.getElementById('article-read-time').textContent = '⏱️ ~'+readTime(data.content)+' min de leitura'
    document.getElementById('article-content').innerHTML = renderMarkdown(data.content||'')
    loadRelatedArticles(data.category, data.id)
    history.pushState({ page: 'article', slug }, '', `/artigo/${slug}`)
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'))
    document.getElementById('article-page').classList.add('active')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch(e) {}
}

async function loadRelatedArticles(category, excludeId) {
  try {
    const { data } = await sb.from('posts').select('title,slug').eq('status','published').eq('category',category).neq('id',excludeId).limit(5)
    const el = document.getElementById('related-articles')
    if (!el||!data) return
    el.innerHTML = data.map(p => `<li><a href="#" onclick="openArticle('${p.slug}');return false;">${p.title}</a></li>`).join('') || '<li>Nenhum artigo relacionado.</li>'
  } catch(e) {}
}

async function filterByCategory(category) {
  await loadPublicArticles(category)
  scrollToSection('artigos')
}

function doSearch() { const q = document.getElementById('search-input').value.trim(); if (q) searchPosts(q) }
function quickSearch(term) { document.getElementById('search-input').value = term; searchPosts(term) }

async function searchPosts(query) {
  try {
    const { data } = await sb.from('posts').select('id,title,slug,excerpt,category,published_at')
      .eq('status','published').or(`title.ilike.%${query}%,content.ilike.%${query}%`).limit(9)
    const grid = document.getElementById('articles-grid')
    if (!grid) return
    if (!data||data.length===0) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--gray-mid);padding:32px;">Nenhum resultado para "<strong>${query}</strong>".</div>`
      return
    }
    const colors = ['blue','green','yellow']
    grid.innerHTML = data.map((p,i) => `
      <a href="#" class="article-card" onclick="openArticle('${p.slug}');return false;">
        <div class="article-thumb ${colors[i%3]}"></div>
        <div class="article-body">
          <div class="article-cat">${p.category||''}</div>
          <h3>${p.title}</h3>
          <p>${p.excerpt||''}</p>
          <div class="article-meta">${formatDate(p.published_at)}</div>
        </div>
      </a>`).join('')
    scrollToSection('artigos')
  } catch(e) {}
}

async function submitLead() {
  const name = document.getElementById('lead-name').value.trim()
  const email = document.getElementById('lead-email').value.trim()
  if (!email) { showToast('Informe seu e-mail!','error'); return }
  try {
    const { error } = await sb.from('leads').insert({ name, email })
    if (error && error.code==='23505') { showToast('E-mail já cadastrado! 😊'); return }
    if (error) { showToast('Erro ao cadastrar.','error'); return }
    document.getElementById('lead-name').value = ''
    document.getElementById('lead-email').value = ''
    showToast('Cadastro realizado! 🎉','success')
  } catch(e) {}
}

// DASHBOARD
function enterDashboard() {
  document.getElementById('public-ui').style.display = 'none'
  document.getElementById('dashboard-page').style.display = 'block'
  document.getElementById('dash-user-email').textContent = currentUser?.email||'Admin'
  loadDashboardOverview()
}

function exitDashboard() {
  document.getElementById('dashboard-page').style.display = 'none'
  document.getElementById('public-ui').style.display = 'block'
  showPage('home')
}

function switchPanel(name) {
  document.querySelectorAll('.dash-panel').forEach(p => p.classList.remove('active'))
  document.querySelectorAll('.dash-nav-item').forEach(i => i.classList.remove('active'))
  const panel = document.getElementById('panel-'+name)
  if (panel) panel.classList.add('active')
  document.querySelectorAll('.dash-nav-item').forEach(i => {
    if (i.getAttribute('onclick')?.includes(`'${name}'`)) i.classList.add('active')
  })
  if (name==='ads') loadAdsPanel()
  if (name==='posts') loadPostsPanel()
  if (name==='leads') loadLeads()
  if (name==='seo') loadSettings()
}

async function loadDashboardOverview() {
  try {
    const [pub, dra, lea, cat] = await Promise.all([
      sb.from('posts').select('id',{count:'exact'}).eq('status','published'),
      sb.from('posts').select('id',{count:'exact'}).eq('status','draft'),
      sb.from('leads').select('id',{count:'exact'}),
      sb.from('categories').select('id',{count:'exact'})
    ])
    document.getElementById('stat-published').textContent = pub.count??'—'
    document.getElementById('stat-drafts').textContent = dra.count??'—'
    document.getElementById('stat-leads').textContent = lea.count??'—'
    document.getElementById('stat-cats').textContent = cat.count??'—'
    const { data: recent } = await sb.from('posts').select('title,status').order('created_at',{ascending:false}).limit(5)
    const el = document.getElementById('recent-posts-dash')
    if (el&&recent) el.innerHTML = recent.map(p => `
      <div style="padding:9px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
        <div style="font-size:13px;font-weight:600;color:var(--gray-dark);max-width:70%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.title}</div>
        <span class="status-badge ${p.status}">${p.status==='published'?'✅':'📝'}</span>
      </div>`).join('')
  } catch(e) {}
}

// POSTS
function newPost() {
  editingPostId = null; postTags = []
  document.getElementById('editing-post-id').value = ''
  document.getElementById('editor-mode-label').textContent = 'Novo Artigo'
  ;['post-title','post-content','post-excerpt','post-meta-desc','post-slug'].forEach(id => {
    const el = document.getElementById(id); if(el) el.value = ''
  })
  const sp = document.getElementById('slug-preview'); if(sp) sp.textContent = '...'
  const ps = document.getElementById('post-status'); if(ps) ps.value = 'draft'
  renderTags(); switchPanel('new-post')
}

function autoSlug() {
  const title = document.getElementById('post-title').value
  const slug = generateSlug(title)
  document.getElementById('post-slug').value = slug
  document.getElementById('slug-preview').textContent = slug||'...'
}

function generateSlug(t) {
  return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9\s-]/g,'').trim().replace(/\s+/g,'-').replace(/-+/g,'-').slice(0,60)
}

async function savePost() {
  const title = document.getElementById('post-title').value.trim()
  if (!title) { showToast('Informe o título!','error'); return }
  const slug = document.getElementById('post-slug').value || generateSlug(title)
  const status = document.getElementById('post-status').value
  const payload = {
    title, slug,
    content: document.getElementById('post-content').value,
    excerpt: document.getElementById('post-excerpt').value,
    meta_description: document.getElementById('post-meta-desc').value,
    category: document.getElementById('post-category').value,
    tags: postTags, status,
    published_at: status==='published' ? new Date().toISOString() : null,
    updated_at: new Date().toISOString()
  }
  try {
    const id = document.getElementById('editing-post-id').value
    const { error } = id
      ? await sb.from('posts').update(payload).eq('id',id)
      : await sb.from('posts').insert(payload)
    if (error) { showToast(error.message.includes('unique')?'Slug duplicado!':'Erro ao salvar.','error'); return }
    showToast(status==='published'?'Publicado! 🎉':'Rascunho salvo! 💾','success')
    newPost(); loadDashboardOverview(); loadPublicArticles()
  } catch(e) { showToast('Erro: '+e.message,'error') }
}

async function loadPostsPanel() {
  try {
    const { data } = await sb.from('posts').select('*').order('created_at',{ascending:false})
    const body = document.getElementById('posts-list-body')
    if (!body) return
    if (!data||data.length===0) { body.innerHTML='<div style="padding:24px;text-align:center;color:var(--gray-mid);">Nenhum artigo.</div>'; return }
    body.innerHTML = data.map(p => `
      <div class="posts-table-row">
        <div class="post-title-cell">${p.title}<small>${p.slug}</small></div>
        <div style="font-size:13px;color:var(--gray-mid);">${p.category||'—'}</div>
        <div><span class="status-badge ${p.status}">${p.status==='published'?'✅ Publicado':'📝 Rascunho'}</span></div>
        <div style="font-size:13px;color:var(--gray-mid);">${formatDate(p.published_at||p.created_at)}</div>
        <div class="post-actions">
          <button class="action-btn" onclick="editPost('${p.id}')">✏️</button>
          <button class="action-btn danger" onclick="deletePost('${p.id}','${p.title.replace(/'/g,"\\'")}')">🗑️</button>
        </div>
      </div>`).join('')
  } catch(e) {}
}

async function editPost(id) {
  try {
    const { data } = await sb.from('posts').select('*').eq('id',id).single()
    if (!data) return
    editingPostId = id; postTags = data.tags||[]
    document.getElementById('editing-post-id').value = id
    document.getElementById('editor-mode-label').textContent = 'Editar Artigo'
    document.getElementById('post-title').value = data.title
    document.getElementById('post-content').value = data.content||''
    document.getElementById('post-excerpt').value = data.excerpt||''
    document.getElementById('post-meta-desc').value = data.meta_description||''
    document.getElementById('post-slug').value = data.slug
    document.getElementById('slug-preview').textContent = data.slug
    document.getElementById('post-status').value = data.status
    document.getElementById('post-category').value = data.category||''
    renderTags(); switchPanel('new-post')
  } catch(e) {}
}

async function deletePost(id, title) {
  if (!confirm(`Excluir "${title}"?`)) return
  try {
    await sb.from('posts').delete().eq('id',id)
    showToast('Excluído!','error'); loadPostsPanel(); loadDashboardOverview(); loadPublicArticles()
  } catch(e) {}
}

async function loadLeads() {
  try {
    const { data } = await sb.from('leads').select('*').order('created_at',{ascending:false})
    const body = document.getElementById('leads-list-body')
    if (!body) return
    if (!data||data.length===0) { body.innerHTML='<div style="padding:24px;text-align:center;color:var(--gray-mid);">Nenhum lead.</div>'; return }
    body.innerHTML = data.map(l => `
      <div class="posts-table-row" style="grid-template-columns:1fr 1fr 120px;">
        <div>${l.name||'—'}</div>
        <div style="font-size:14px;color:var(--gray-mid);">${l.email}</div>
        <div style="font-size:12px;color:var(--gray-mid);">${formatDate(l.created_at)}</div>
      </div>`).join('')
  } catch(e) {}
}

async function loadSettings() {
  try {
    const { data } = await sb.from('site_settings').select('*')
    if (!data) return
    const map = {}; data.forEach(s => map[s.key]=s.value)
    const fields = { 'cfg-meta-title':'meta_title','cfg-meta-desc':'meta_description','cfg-ga-id':'google_analytics_id','cfg-site-email':'site_email' }
    Object.entries(fields).forEach(([elId, key]) => {
      const el = document.getElementById(elId); if(el) el.value = map[key]||''
    })
  } catch(e) {}
}

async function saveSettings(keys) {
  const fieldMap = { 'meta_title':'cfg-meta-title','meta_description':'cfg-meta-desc','google_analytics_id':'cfg-ga-id','site_email':'cfg-site-email' }
  try {
    for (const key of keys) {
      const el = document.getElementById(fieldMap[key]); if (!el) continue
      await sb.from('site_settings').upsert({ key, value:el.value, updated_at:new Date().toISOString() })
    }
    showToast('Salvo! ✅','success')
  } catch(e) { showToast('Erro ao salvar.','error') }
}

// TAGS
function addTag(e) {
  if (e.key!=='Enter') return; e.preventDefault()
  const val = e.target.value.trim()
  if (val&&!postTags.includes(val)) { postTags.push(val); renderTags() }
  e.target.value = ''
}
function removeTag(t) { postTags = postTags.filter(x=>x!==t); renderTags() }
function renderTags() {
  const chips = document.getElementById('tags-chips')
  if (!chips) return
  chips.innerHTML = postTags.map(t => `<div class="tag-chip">${t}<span onclick="removeTag('${t}')">×</span></div>`).join('')
}
function insertTag(before, after) {
  const ta = document.getElementById('post-content')
  if (!ta) return
  const s=ta.selectionStart, e=ta.selectionEnd, sel=ta.value.substring(s,e)
  ta.value = ta.value.substring(0,s)+before+sel+after+ta.value.substring(e)
  ta.focus()
}

// ADS
async function loadAdsPanel() {
  try {
    const { data } = await sb.from('ads').select('*').order('created_at',{ascending:false})
    const grid = document.getElementById('ads-grid')
    const empty = document.getElementById('ads-empty')
    if (!grid) return
    if (!data||data.length===0) { grid.innerHTML=''; if(empty) empty.style.display='block'; return }
    if (empty) empty.style.display='none'
    const pos = {'banner-topo':'🔝 Banner topo','lateral-artigo':'📰 Lateral','meio-artigo':'📄 Meio','rodape':'🔻 Rodapé','personalizado':'⚙️ Personalizado'}
    grid.innerHTML = data.map(ad => {
      const img = ad.image_base64||ad.image_url
      const thumb = img ? `<img src="${img}" style="width:100%;height:100%;object-fit:cover;">` : `<div style="font-size:36px;">${ad.type==='image'?'🖼️':'💻'}</div>`
      return `
      <div class="ad-card">
        <div class="ad-card-thumb">${thumb}
          <div style="position:absolute;top:8px;left:8px;"><span class="ad-id-badge">${ad.ad_id}</span></div>
          <div style="position:absolute;top:8px;right:8px;"><span class="ad-type-badge">${ad.type}</span></div>
        </div>
        <div style="padding:16px;">
          <div style="font-weight:700;margin-bottom:4px;">${ad.name||ad.ad_id}</div>
          <div style="font-size:12px;color:var(--gray-mid);margin-bottom:10px;">${pos[ad.position]||ad.position}</div>
          <div style="display:flex;gap:8px;">
            <button class="action-btn" onclick="editAd('${ad.id}')" style="flex:1;">✏️ Editar</button>
            <button class="action-btn" onclick="toggleAdStatus('${ad.id}','${ad.status}')" style="flex:1;">${ad.status==='active'?'⏸️':'▶️'}</button>
            <button class="action-btn danger" onclick="deleteAd('${ad.id}','${ad.ad_id}')">🗑️</button>
          </div>
        </div>
      </div>`
    }).join('')
  } catch(e) {}
}

function openAdModal() {
  editingAdDbId=null; currentAdImageBase64=null
  document.getElementById('modal-ad-title').textContent='Novo anúncio'
  document.getElementById('modal-ad-db-id').value=''
  document.getElementById('modal-ad-id').value=''
  document.getElementById('modal-ad-name').value=''
  document.getElementById('modal-ad-position').value='banner-topo'
  document.getElementById('modal-ad-link').value=''
  document.getElementById('modal-ad-alt').value=''
  document.getElementById('modal-ad-code').value=''
  document.getElementById('modal-ad-img-url').value=''
  document.querySelector('input[name="ad-type"][value="image"]').checked=true
  document.querySelector('input[name="ad-status"][value="active"]').checked=true
  switchAdType('image'); resetImagePreview()
  document.getElementById('ad-modal').style.display='flex'
  document.body.style.overflow='hidden'
}

function closeAdModal() {
  document.getElementById('ad-modal').style.display='none'
  document.body.style.overflow=''
}

function switchAdType(type) {
  document.getElementById('section-image').style.display = type==='image'?'flex':'none'
  document.getElementById('section-code').style.display  = type==='code'?'block':'none'
}

function handleAdImageUpload(event) {
  const file = event.target.files[0]; if (!file) return
  if (file.size>2*1024*1024) { showToast('Máx. 2MB','error'); return }
  const reader = new FileReader()
  reader.onload = e => { currentAdImageBase64=e.target.result; showImagePreview(e.target.result) }
  reader.readAsDataURL(file)
}

function previewImageUrl(url) { if (!url) return; showImagePreview(url); currentAdImageBase64=null }

function showImagePreview(src) {
  document.getElementById('img-upload-placeholder').style.display='none'
  const img=document.getElementById('img-preview'); img.src=src; img.style.display='block'
  document.getElementById('img-remove-btn').style.display='block'
}

function resetImagePreview() {
  document.getElementById('img-upload-placeholder').style.display='block'
  const img=document.getElementById('img-preview'); img.style.display='none'; img.src=''
  document.getElementById('img-remove-btn').style.display='none'
  document.getElementById('modal-ad-img-url').value=''
  currentAdImageBase64=null
}

function removeAdImage(e) { e.stopPropagation(); resetImagePreview() }

async function saveAd() {
  const adId = document.getElementById('modal-ad-id').value.trim()
  const type  = document.querySelector('input[name="ad-type"]:checked').value
  const imageUrl = document.getElementById('modal-ad-img-url').value.trim()
  const code  = document.getElementById('modal-ad-code').value.trim()
  if (!adId) { showToast('Informe o ID!','error'); return }
  if (type==='image'&&!currentAdImageBase64&&!imageUrl) { showToast('Adicione uma imagem!','error'); return }
  if (type==='code'&&!code) { showToast('Informe o código HTML!','error'); return }
  const payload = {
    ad_id: adId,
    name: document.getElementById('modal-ad-name').value.trim(),
    position: document.getElementById('modal-ad-position').value,
    type, status: document.querySelector('input[name="ad-status"]:checked').value,
    link: document.getElementById('modal-ad-link').value.trim()||null,
    alt_text: document.getElementById('modal-ad-alt').value.trim()||null,
    html_code: type==='code'?code:null,
    image_base64: type==='image'?(currentAdImageBase64||null):null,
    image_url: type==='image'&&!currentAdImageBase64?(imageUrl||null):null,
    updated_at: new Date().toISOString()
  }
  try {
    const dbId = document.getElementById('modal-ad-db-id').value
    const { error } = dbId
      ? await sb.from('ads').update(payload).eq('id',dbId)
      : await sb.from('ads').insert(payload)
    if (error) { showToast(error.message.includes('unique')?`ID "${adId}" já existe!`:'Erro ao salvar.','error'); return }
    showToast(dbId?'Atualizado! ✅':'Criado! 🎉','success')
    closeAdModal(); loadAdsPanel()
  } catch(e) { showToast('Erro: '+e.message,'error') }
}

async function editAd(id) {
  try {
    const { data } = await sb.from('ads').select('*').eq('id',id).single()
    if (!data) return
    editingAdDbId=id; currentAdImageBase64=data.image_base64||null
    document.getElementById('modal-ad-title').textContent='Editar anúncio'
    document.getElementById('modal-ad-db-id').value=id
    document.getElementById('modal-ad-id').value=data.ad_id
    document.getElementById('modal-ad-name').value=data.name||''
    document.getElementById('modal-ad-position').value=data.position
    document.getElementById('modal-ad-link').value=data.link||''
    document.getElementById('modal-ad-alt').value=data.alt_text||''
    document.getElementById('modal-ad-code').value=data.html_code||''
    document.getElementById('modal-ad-img-url').value=data.image_url||''
    document.querySelector(`input[name="ad-type"][value="${data.type}"]`).checked=true
    document.querySelector(`input[name="ad-status"][value="${data.status}"]`).checked=true
    switchAdType(data.type)
    const imgSrc=data.image_base64||data.image_url
    if (imgSrc) showImagePreview(imgSrc); else resetImagePreview()
    document.getElementById('ad-modal').style.display='flex'
    document.body.style.overflow='hidden'
  } catch(e) {}
}

async function deleteAd(id, adId) {
  if (!confirm(`Excluir "${adId}"?`)) return
  try {
    await sb.from('ads').delete().eq('id',id)
    showToast('Excluído!','error'); loadAdsPanel()
  } catch(e) {}
}

async function toggleAdStatus(id, currentStatus) {
  try {
    const newStatus = currentStatus==='active'?'inactive':'active'
    await sb.from('ads').update({status:newStatus}).eq('id',id)
    showToast(newStatus==='active'?'Ativado! ✅':'Pausado ⏸️', newStatus==='active'?'success':'neutral')
    loadAdsPanel()
  } catch(e) {}
}

// CALCULADORAS
function calcHoraExtra() {
  const salario=parseFloat(document.getElementById('he-salario').value)||0
  const horasDia=parseFloat(document.getElementById('he-horas-dia').value)||8
  const diasSemana=parseFloat(document.getElementById('he-dias-semana').value)||6
  const adicional=parseFloat(document.getElementById('he-tipo').value)/100
  if (!salario) { showToast('Informe um salário válido!','error'); return }
  const valorHora=salario/220, valorExtra=valorHora*(1+adicional)
  const extrasSemana=Math.max(0,(horasDia*diasSemana)-44), totalMes=extrasSemana*4.33*valorExtra
  const fmt=v=>v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
  document.getElementById('he-valor-hora').textContent=fmt(valorExtra)
  document.getElementById('he-total-mes').textContent=fmt(totalMes)
  document.getElementById('he-note').textContent=extrasSemana>0?`Jornada excede 44h em ${extrasSemana}h/semana.`:'Jornada dentro do limite legal.'
  document.getElementById('he-result').classList.add('show')
}

function calcRescisao() {
  const salario=parseFloat(document.getElementById('res-salario').value)||0
  const meses=parseInt(document.getElementById('res-meses').value)||0
  const mesDemissao=parseInt(document.getElementById('res-mes').value)
  const tipo=document.getElementById('res-tipo').value
  if (!salario||!meses) { showToast('Preencha todos os campos!','error'); return }
  const fmt=v=>v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
  const anos=Math.floor(meses/12), diasAviso=tipo==='sem-justa'?Math.min(30+anos*3,90):0
  const aviso=(salario/30)*diasAviso, ferias=(salario/12)*(meses%12)*(4/3)
  const decimo=(salario/12)*Math.min(mesDemissao,meses%12||12)
  const fgtsAcum=salario*0.08*meses, fgts=tipo==='sem-justa'?fgtsAcum*1.4:0
  const total=salario+aviso+ferias+decimo+fgts
  document.getElementById('res-saldo').textContent=fmt(salario)
  document.getElementById('res-aviso').textContent=tipo==='sem-justa'?fmt(aviso)+` (${diasAviso} dias)`:'Não devido'
  document.getElementById('res-ferias').textContent=fmt(ferias)
  document.getElementById('res-decimo').textContent=fmt(decimo)
  document.getElementById('res-fgts').textContent=tipo==='sem-justa'?fmt(fgts)+' (estimado)':'Não inclui multa'
  document.getElementById('res-total').textContent=fmt(total)
  document.getElementById('res-result').classList.add('show')
}

// UTILS
function updateCharCount(el,countId,max) {
  const len=el.value.length, ct=document.getElementById(countId); if(!ct) return
  ct.textContent=`${len} / ${max}`; ct.className='char-count'+(len>max?' over':len>max*.9?' warn':'')
}
function formatDate(d) {
  if(!d) return '—'
  try { return new Date(d).toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'}) } catch(e) { return '—' }
}
function readTime(c) { if(!c) return 3; return Math.max(2,Math.round(c.split(' ').length/200)) }
function renderMarkdown(md) {
  if(!md) return ''
  return md
    .replace(/^## (.+)$/gm,'<h2>$1</h2>').replace(/^### (.+)$/gm,'<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/_(.+?)_/g,'<em>$1</em>')
    .replace(/^- (.+)$/gm,'<li>$1</li>').replace(/(<li>.*<\/li>)/gs,'<ul>$1</ul>')
    .replace(/^> (.+)$/gm,'<blockquote style="border-left:4px solid var(--blue);padding:10px 16px;background:var(--blue-light);margin:16px 0;border-radius:0 8px 8px 0;">$1</blockquote>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank">$1</a>')
    .split('\n\n').map(p=>p.trim().startsWith('<')?p:`<p>${p.replace(/\n/g,'<br>')}</p>`).join('\n')
}

// GATE DE E-MAIL DAS CALCULADORAS
async function unlockCalcs() {
  const email = document.getElementById('gate-email').value.trim()
  if (!email || !email.includes('@')) {
    showToast('Informe um e-mail válido!', 'error')
    return
  }
  // Salvar lead no Supabase
  try {
    await sb.from('leads').insert({ email, name: 'Calculadoras' })
  } catch(e) {}
  // Mostrar calculadoras
  document.getElementById('calc-gate').style.display = 'none'
  document.getElementById('calc-content').style.display = 'block'
  showToast('Acesso liberado! 🎉', 'success')
  // Salvar no localStorage para não pedir de novo
  localStorage.setItem('calc_unlocked', '1')
}

// Verificar se já desbloqueou antes
function checkCalcGate() {
  if (localStorage.getItem('calc_unlocked') === '1') {
    const gate = document.getElementById('calc-gate')
    const content = document.getElementById('calc-content')
    if (gate) gate.style.display = 'none'
    if (content) content.style.display = 'block'
  }
}

// CALCULADORA DE FÉRIAS
function calcFerias() {
  const salario = parseFloat(document.getElementById('fer-salario').value) || 0
  const diasFerias = parseInt(document.getElementById('fer-dias').value) || 30
  const diasAbono = parseInt(document.getElementById('fer-abono').value) || 0
  const mes = parseInt(document.getElementById('fer-mes').value)
  if (!salario) { showToast('Informe um salário válido!', 'error'); return }
  if (diasAbono > 10) { showToast('Máximo de 10 dias de abono!', 'error'); return }

  const fmt = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const valorDia = salario / 30
  const valorFerias = valorDia * diasFerias
  const terco = valorFerias / 3
  const abono = diasAbono > 0 ? (valorDia * diasAbono) + ((valorDia * diasAbono) / 3) : 0
  const total = valorFerias + terco + abono

  // Meses com INSS e IR podem variar — nota informativa
  const mesesAlto = [1, 3, 5, 7, 8, 10, 12]
  const nota = mesesAlto.includes(mes)
    ? '⚠️ Neste mês é comum ter desconto de INSS e IR sobre as férias.'
    : '✅ Verifique possíveis descontos de INSS e IR com seu RH.'

  document.getElementById('fer-total').textContent = fmt(total)
  document.getElementById('fer-dias-label').textContent = diasFerias
  document.getElementById('fer-valor-ferias').textContent = fmt(valorFerias)
  document.getElementById('fer-terco').textContent = fmt(terco)
  document.getElementById('fer-abono-valor').textContent = diasAbono > 0 ? fmt(abono) : 'Não solicitado'
  document.getElementById('fer-note').textContent = nota
  document.getElementById('fer-result').classList.add('show')
}

function showToast(msg, type='neutral') {
  const t=document.getElementById('toast'); t.textContent=msg
  t.className='toast show'+(type==='success'?' success':type==='error'?' error':'')
  setTimeout(()=>t.className='toast',3500)
}
