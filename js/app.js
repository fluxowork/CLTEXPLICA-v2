// CLTExplica — app.js (sem login, sem dashboard, sem anúncios)

// ── INIT ──
document.addEventListener('DOMContentLoaded', async () => {
  await loadPublicData()
  checkCalcGate()
  initRouter()
})

// ── NAVEGAÇÃO ──
const PAGE_MAP = {
  home:          { id: 'home-page',        url: '/' },
  article:       { id: 'article-page',     url: null },
  ferramentas:   { id: 'ferramentas-page', url: '/ferramentas' },
  about:         { id: 'about-page',       url: '/sobre' },
  contact:       { id: 'contact-page',     url: '/contato' },
  'aviso-legal': { id: 'aviso-legal-page', url: '/aviso-legal' },
  privacy:       { id: 'privacy-page',     url: '/privacidade' }
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
  const routes = {
    '/': 'home',
    '/ferramentas': 'ferramentas',
    '/sobre': 'about',
    '/contato': 'contact',
    '/aviso-legal': 'aviso-legal',
    '/privacidade': 'privacy'
  }
  return routes[path] || 'home'
}

window.addEventListener('popstate', (e) => {
  const page = e.state?.page || pageFromPath(location.pathname)
  showPage(page, false)
})

function initRouter() {
  const path = location.pathname
  if (path === '/' || path === '') return
  if (path.startsWith('/artigo/')) {
    openArticle(path.replace('/artigo/', ''))
    return
  }
  const page = pageFromPath(path)
  if (page !== 'home') showPage(page, false)
}

function scrollToSection(id) {
  showPage('home', false)
  setTimeout(() => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, 100)
}

// ── DADOS PÚBLICOS ──
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
      'Escalas de Trabalho': '🗓️',
      'Salário e Adicionais': '💰',
      'FGTS e Benefícios': '🏦',
      'Direitos do Trabalhador': '⚖️',
      'Demissão e Rescisão': '📝',
      'Ferramentas CLT': '🧮'
    }
    const colors = ['blue', 'green', 'yellow', 'blue', 'green', 'yellow']
    grid.innerHTML = data.map((cat, i) => `
      <a href="#" class="cat-card" onclick="filterByCategory('${cat.name}');return false;">
        <div class="cat-icon ${colors[i % 3]}">${icons[cat.name] || '📄'}</div>
        <h3>${cat.name}</h3>
        <p>${cat.description || 'Ver artigos'}</p>
      </a>`).join('')
  } catch (e) {}
}

async function loadPublicArticles(category = null) {
  try {
    let q = sb.from('posts')
      .select('id,title,slug,excerpt,category,status,published_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(9)
    if (category) q = q.eq('category', category)
    const { data } = await q
    const grid = document.getElementById('articles-grid')
    if (!grid) return
    if (!data || data.length === 0) {
      grid.innerHTML = '<div class="loading-placeholder">Nenhum artigo publicado ainda.</div>'
      return
    }
    const colors = ['blue', 'green', 'yellow']
    grid.innerHTML = data.map((p, i) => `
      <a href="/artigo/${p.slug}" class="article-card" onclick="openArticle('${p.slug}');return false;">
        <div class="article-thumb ${colors[i % 3]}"></div>
        <div class="article-body">
          <div class="article-cat">${p.category || ''}</div>
          <h3>${p.title}</h3>
          <p>${p.excerpt || ''}</p>
          <div class="article-footer">
            <span class="article-meta">${formatDate(p.published_at)}</span>
            <span class="article-cta">Ler mais →</span>
          </div>
        </div>
      </a>`).join('')
  } catch (e) {}
}

async function filterByCategory(category) {
  showPage('home')
  await loadPublicArticles(category)
  setTimeout(() => scrollToSection('artigos'), 150)
}


// ── MARKDOWN PARSER ──
function parseMarkdown(text) {
  if (!text) return ''
  return text
    // Títulos
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Negrito e itálico
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Listas
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Agrupar <li> em <ul>
    .replace(/(<li>.*<\/li>\n?)+/g, m => '<ul>' + m + '</ul>')
    // Tabelas simples
    .replace(/\|(.+)\|/g, (match) => {
      const cells = match.split('|').filter(c => c.trim())
      return '<tr>' + cells.map(c => '<td>' + c.trim() + '</td>').join('') + '</tr>'
    })
    .replace(/(<tr>.*<\/tr>\n?)+/g, m => '<table>' + m + '</table>')
    // Remover linhas de separador de tabela
    .replace(/<tr><td>[-| ]+<\/td><\/tr>/g, '')
    // Parágrafos (linhas que não são tags HTML)
    .replace(/^(?!<[hultbp]).+$/gm, p => p.trim() ? '<p>' + p + '</p>' : '')
    // Quebras de linha duplas extras
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function openArticle(slug) {
  try {
    const { data } = await sb.from('posts')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .single()
    if (!data) { showToast('Artigo não encontrado.', 'error'); return }
    document.getElementById('article-category-breadcrumb').textContent = data.category || 'Artigos'
    document.getElementById('article-title').textContent = data.title
    document.getElementById('article-date').textContent = '📅 ' + formatDate(data.published_at)
    document.getElementById('article-read-time').textContent = '⏱️ ~' + readTime(data.content) + ' min de leitura'
    document.getElementById('article-content').innerHTML = parseMarkdown(data.content || '')
    loadRelatedArticles(data.category, data.id)
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'))
    document.getElementById('article-page').classList.add('active')
    history.pushState({ page: 'article', slug }, '', `/artigo/${slug}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (e) {}
}

async function loadRelatedArticles(category, excludeId) {
  try {
    const { data } = await sb.from('posts')
      .select('id,title,slug')
      .eq('status', 'published')
      .eq('category', category)
      .neq('id', excludeId)
      .limit(3)
    const el = document.getElementById('related-articles')
    if (!el || !data || !data.length) return
    el.innerHTML = `<h3 style="font-family:var(--font-head);font-size:18px;font-weight:700;margin:32px 0 16px;">Artigos relacionados</h3>
      <ul style="list-style:none;padding:0;">${data.map(p =>
        `<li style="margin-bottom:10px;"><a href="/artigo/${p.slug}" onclick="openArticle('${p.slug}');return false;" style="color:var(--blue);font-weight:600;font-size:15px;">→ ${p.title}</a></li>`
      ).join('')}</ul>`
  } catch (e) {}
}

async function searchArticles(query) {
  if (!query || query.length < 2) return
  try {
    const { data } = await sb.from('posts')
      .select('id,title,slug,excerpt,category,published_at')
      .eq('status', 'published')
      .ilike('title', `%${query}%`)
      .limit(9)
    const grid = document.getElementById('articles-grid')
    if (!grid) return
    if (!data || data.length === 0) {
      grid.innerHTML = `<div class="loading-placeholder">Nenhum resultado para "<strong>${query}</strong>".</div>`
      return
    }
    const colors = ['blue', 'green', 'yellow']
    grid.innerHTML = data.map((p, i) => `
      <a href="/artigo/${p.slug}" class="article-card" onclick="openArticle('${p.slug}');return false;">
        <div class="article-thumb ${colors[i % 3]}"></div>
        <div class="article-body">
          <div class="article-cat">${p.category || ''}</div>
          <h3>${p.title}</h3>
          <p>${p.excerpt || ''}</p>
          <div class="article-footer">
            <span class="article-meta">${formatDate(p.published_at)}</span>
            <span class="article-cta">Ler mais →</span>
          </div>
        </div>
      </a>`).join('')
    scrollToSection('artigos')
  } catch (e) {}
}

// ── GATE E-MAIL ──
function checkCalcGate() {
  if (localStorage.getItem('clt_unlocked') === '1') {
    document.getElementById('calc-gate').style.display = 'none'
    document.getElementById('calc-content').style.display = 'block'
  }
}

async function unlockCalcs() {
  const email = document.getElementById('gate-email').value.trim()
  if (!email || !email.includes('@')) { showToast('Informe um e-mail válido.', 'error'); return }
  try {
    const { error } = await sb.from('leads').insert({ email })
    if (error && error.code !== '23505') { showToast('Erro ao cadastrar.', 'error'); return }
  } catch (e) {}
  localStorage.setItem('clt_unlocked', '1')
  document.getElementById('calc-gate').style.display = 'none'
  document.getElementById('calc-content').style.display = 'block'
  showToast('Acesso liberado! 🎉', 'success')
}

// ── CALCULADORAS ──
function fmt(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function calcHoraExtra() {
  const sal = parseFloat(document.getElementById('he-salario').value)
  const hd = parseFloat(document.getElementById('he-horas-dia').value)
  const ds = parseFloat(document.getElementById('he-dias-semana').value)
  const perc = parseFloat(document.getElementById('he-tipo').value) / 100
  if (!sal || !hd || !ds) { showToast('Preencha todos os campos.', 'error'); return }
  const horasMes = (hd * ds * 52) / 12
  const valorHora = sal / horasMes
  const valorExtra = valorHora * (1 + perc)
  document.getElementById('he-valor-hora').textContent = fmt(valorExtra)
  document.getElementById('he-total-mes').textContent = fmt(valorExtra * horasMes * 0.1)
  document.getElementById('he-note').textContent = `Hora normal: ${fmt(valorHora)} | Adicional: ${Math.round(perc * 100)}%`
  document.getElementById('he-result').classList.add('show')
}

function calcRescisao() {
  const sal = parseFloat(document.getElementById('res-salario').value)
  const meses = parseInt(document.getElementById('res-meses').value)
  const mes = parseInt(document.getElementById('res-mes').value)
  const tipo = document.getElementById('res-tipo').value
  if (!sal || !meses) { showToast('Preencha todos os campos.', 'error'); return }
  const saldo = sal / 30 * 28
  const aviso = tipo === 'sem-justa' ? sal : 0
  const feriasProp = (sal / 12) * (meses % 12 || 12)
  const terco = feriasProp / 3
  const decimoProp = (sal / 12) * (mes / 12 * 12 || meses % 12 || 12)
  const multa = tipo === 'sem-justa' ? sal * meses * 0.08 * 0.4 : 0
  const total = saldo + aviso + feriasProp + terco + decimoProp
  document.getElementById('res-total').textContent = fmt(total)
  document.getElementById('res-saldo').textContent = fmt(saldo)
  document.getElementById('res-aviso').textContent = fmt(aviso)
  document.getElementById('res-ferias').textContent = fmt(feriasProp + terco)
  document.getElementById('res-decimo').textContent = fmt(decimoProp)
  document.getElementById('res-multa').textContent = fmt(multa)
  document.getElementById('res-multa-line').style.display = tipo === 'sem-justa' ? '' : 'none'
  document.getElementById('res-result').classList.add('show')
}

function calcFerias() {
  const sal = parseFloat(document.getElementById('fer-salario').value)
  const dias = parseInt(document.getElementById('fer-dias').value)
  const abono = parseInt(document.getElementById('fer-abono').value) || 0
  if (!sal) { showToast('Informe o salário.', 'error'); return }
  const valorDia = sal / 30
  const valorFerias = valorDia * dias
  const terco = valorFerias / 3
  const valorAbono = valorDia * abono
  const total = valorFerias + terco + valorAbono
  document.getElementById('fer-total').textContent = fmt(total)
  document.getElementById('fer-dias-label').textContent = dias
  document.getElementById('fer-valor-ferias').textContent = fmt(valorFerias)
  document.getElementById('fer-terco').textContent = fmt(terco)
  document.getElementById('fer-abono-valor').textContent = fmt(valorAbono)
  document.getElementById('fer-result').classList.add('show')
}

// ── UTILITÁRIOS ──
function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function readTime(content) {
  if (!content) return 3
  const words = content.replace(/<[^>]*>/g, '').split(/\s+/).length
  return Math.max(2, Math.ceil(words / 200))
}

function showToast(msg, tipo = '') {
  const t = document.getElementById('toast')
  t.textContent = msg
  t.className = 'toast show' + (tipo ? ' ' + tipo : '')
  setTimeout(() => t.classList.remove('show'), 3000)
}
