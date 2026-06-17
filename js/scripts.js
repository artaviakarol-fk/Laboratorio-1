'use strict';

/* =====================================================================
   1. MODO OSCURO / CLARO
   ===================================================================== */
(function initTheme() {
  var btn  = document.getElementById('theme-toggle');
  var icon = document.getElementById('theme-icon');
  if (!btn) return;

  function applyTheme(isDark) {
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
      icon.textContent = '☀️';
      btn.setAttribute('aria-pressed', 'true');
      btn.setAttribute('aria-label', 'Activar modo claro');
    } else {
      document.documentElement.removeAttribute('data-theme');
      icon.textContent = '🌙';
      btn.setAttribute('aria-pressed', 'false');
      btn.setAttribute('aria-label', 'Activar modo oscuro');
    }
  }

  var saved      = localStorage.getItem('teresita-theme');
  var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved === 'dark' || (saved === null && systemDark));

  btn.addEventListener('click', function () {
    var nowDark = document.documentElement.getAttribute('data-theme') !== 'dark';
    applyTheme(nowDark);
    localStorage.setItem('teresita-theme', nowDark ? 'dark' : 'light');
  });
})();


/* =====================================================================
   2. BANNER DE BIENVENIDA
   ===================================================================== */
(function initBanner() {
  var banner   = document.getElementById('welcome-banner');
  var closeBtn = document.getElementById('close-banner');
  if (!banner || !closeBtn) return;

  if (localStorage.getItem('teresita-banner-dismissed') === 'true') {
    banner.classList.add('hidden');
    return;
  }

  closeBtn.addEventListener('click', function () {
    banner.style.transition = 'opacity 300ms ease, max-height 300ms ease';
    banner.style.opacity    = '0';
    banner.style.maxHeight  = '0';
    banner.style.overflow   = 'hidden';
    banner.style.padding    = '0';
    setTimeout(function () {
      banner.classList.add('hidden');
      localStorage.setItem('teresita-banner-dismissed', 'true');
    }, 300);
  });
})();


/* =====================================================================
   3 & 4. CATÁLOGO + BÚSQUEDA — carga desde data/productos.json
   ===================================================================== */
(function initCatalogo() {

  var tabsContainer    = document.getElementById('catalogos-tabs');
  var contentContainer = document.getElementById('catalogos-content');
  var searchInput      = document.getElementById('productos-search');
  var searchResults    = document.getElementById('search-results');
  if (!tabsContainer || !contentContainer) return;

  var ICONOS = {
    'Abarrotes y Despensa':       '',
    'Lácteos y Refrigerados':     '',
    'Carnes y Embutidos':         '',
    'Frutas y Verduras':          '',
    'Bebidas':                    '',
    'Snacks y Dulcería':          '',
    'Panadería':                  '',
    'Higiene y Farmacia':         '',
    'Limpieza del Hogar':         '',
    'Ferretería y Hogar':         '',
    'Alimentos para Mascotas':    '',
  };

  var todosLosProductos = [];
  var catalogaData      = {};

  function toId(nombre) {
    return nombre.toLowerCase()
      .replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i')
      .replace(/ó/g,'o').replace(/ú/g,'u').replace(/ñ/g,'n')
      .replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'');
  }

  function formatPrecio(precio) {
    return '₡' + Number(precio).toLocaleString('es-CR');
  }

  function normalizar(str) {
    return String(str).toLowerCase()
      .replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i')
      .replace(/ó/g,'o').replace(/ú/g,'u').replace(/ñ/g,'n')
      .replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
  }

  function levenshtein(a, b) {
    var m = a.length, n = b.length;
    var dp = [];
    for (var i = 0; i <= m; i++) {
      dp[i] = [i];
      for (var j = 1; j <= n; j++) {
        dp[i][j] = i === 0 ? j
          : j === 0 ? i
          : a[i-1] === b[j-1] ? dp[i-1][j-1]
          : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
      }
    }
    return dp[m][n];
  }

  function calcScore(query, nombre) {
    var q = normalizar(query);
    var n = normalizar(nombre);
    if (n === q)            return 100;
    if (n.startsWith(q))    return 90;
    if (n.includes(q))      return 80;
    var qWords = q.split(' ').filter(Boolean);
    var nWords = n.split(' ').filter(Boolean);
    var allMatch = qWords.every(function (qw) {
      return nWords.some(function (nw) { return nw.includes(qw) || qw.includes(nw); });
    });
    if (allMatch) return 70;
    var bestFuzzy = 0;
    qWords.forEach(function (qw) {
      if (qw.length < 3) return;
      nWords.forEach(function (nw) {
        if (nw.length < 3) return;
        var maxLen  = Math.max(qw.length, nw.length);
        var dist    = levenshtein(qw, nw);
        var sim     = 1 - dist / maxLen;
        if (sim > 0.65) bestFuzzy = Math.max(bestFuzzy, Math.round(sim * 60));
      });
    });
    return bestFuzzy;
  }

  function attachLazyHover(card, imagenSrc, nombre) {
    var wrapper = card.querySelector('.card-img-wrapper');
    if (!wrapper) return;
    wrapper.innerHTML = '';
    if (imagenSrc) {
      var img       = document.createElement('img');
      img.alt       = nombre;
      img.width     = 400;
      img.height    = 300;
      img.src       = imagenSrc;
      img.className = 'card-img-loaded';
      img.loading   = 'lazy';
      wrapper.appendChild(img);
    } else {
      wrapper.innerHTML =
        '<div class="card-img-placeholder">'
        + '<span class="img-placeholder-icon" aria-hidden="true">📷</span>'
        + '<span class="img-placeholder-text">Sin imagen</span>'
        + '</div>';
    }
  }

  function crearTarjeta(producto, catLabel) {
    var li      = document.createElement('li');
    li.className = 'carrusel-item';
    var article = document.createElement('article');
    article.className = 'producto-card';
    article.setAttribute('aria-label', 'Producto: ' + producto.nombre);
    article.innerHTML =
      '<div class="card-img-wrapper card-img-hover-pending">'
      + '</div>'
      + '<div class="card-body">'
      + (catLabel ? '<span class="card-cat-label">' + catLabel + '</span>' : '')
      + '  <span class="card-subcat">' + producto.subcategoria + '</span>'
      + '  <h3 class="card-title">' + producto.nombre + '</h3>'
      + '  <p class="card-price"><strong class="price-amount">'
      +    formatPrecio(producto.precio)
      + '  </strong></p>'
      + '</div>';
    attachLazyHover(article, producto.imagen || '', producto.nombre);
    li.appendChild(article);
    return li;
  }

  function renderCarrusel(catNombre, productos) {
    contentContainer.innerHTML = '';
    if (searchInput) searchInput.value = '';
    if (searchResults) searchResults.innerHTML = '';

    var wrapper = document.createElement('div');
    wrapper.className = 'carrusel-wrapper';

    var btnPrev = document.createElement('button');
    btnPrev.className = 'carrusel-btn carrusel-btn--prev';
    btnPrev.innerHTML = '‹';
    btnPrev.setAttribute('aria-label', 'Desplazar izquierda');

    var btnNext = document.createElement('button');
    btnNext.className = 'carrusel-btn carrusel-btn--next';
    btnNext.innerHTML = '›';
    btnNext.setAttribute('aria-label', 'Desplazar derecha');

    var track = document.createElement('ul');
    track.className = 'carrusel-track';
    track.setAttribute('aria-label', 'Productos de ' + catNombre);

    productos.forEach(function (p) { track.appendChild(crearTarjeta(p, null)); });

    var SCROLL = 304;
    btnPrev.addEventListener('click', function () { track.scrollBy({ left: -SCROLL, behavior: 'smooth' }); });
    btnNext.addEventListener('click', function () { track.scrollBy({ left:  SCROLL, behavior: 'smooth' }); });

    wrapper.appendChild(btnPrev);
    wrapper.appendChild(track);
    wrapper.appendChild(btnNext);
    contentContainer.appendChild(wrapper);
  }

  function renderBusqueda(resultados, query) {
    if (!searchResults) return;
    searchResults.innerHTML = '';
    if (!resultados.length) {
      searchResults.innerHTML = '<p class="search-empty">No se encontraron productos para <strong>"' + query + '"</strong>.</p>';
      return;
    }
    var exactos   = resultados.filter(function (r) { return r.score >= 70; });
    var similares = resultados.filter(function (r) { return r.score > 0 && r.score < 70; });

    function renderGrupo(titulo, items) {
      if (!items.length) return;
      var h = document.createElement('p');
      h.className   = 'search-group-title';
      h.textContent = titulo + ' (' + items.length + ')';
      searchResults.appendChild(h);
      var track = document.createElement('ul');
      track.className = 'carrusel-track';
      items.forEach(function (r) { track.appendChild(crearTarjeta(r.producto, r.categoria)); });
      var wrapper = document.createElement('div');
      wrapper.className = 'carrusel-wrapper';
      var btnP = document.createElement('button');
      btnP.className = 'carrusel-btn carrusel-btn--prev';
      btnP.innerHTML = '‹';
      btnP.setAttribute('aria-label', 'Desplazar izquierda');
      var btnN = document.createElement('button');
      btnN.className = 'carrusel-btn carrusel-btn--next';
      btnN.innerHTML = '›';
      btnN.setAttribute('aria-label', 'Desplazar derecha');
      var SCROLL = 304;
      btnP.addEventListener('click', function () { track.scrollBy({ left: -SCROLL, behavior: 'smooth' }); });
      btnN.addEventListener('click', function () { track.scrollBy({ left:  SCROLL, behavior: 'smooth' }); });
      wrapper.appendChild(btnP);
      wrapper.appendChild(track);
      wrapper.appendChild(btnN);
      searchResults.appendChild(wrapper);
    }
    renderGrupo('✅ Resultados para "' + query + '"', exactos);
    renderGrupo('🔍 Productos similares', similares);
  }

  function buscar(query) {
    query = query.trim();
    if (query.length < 2) {
      if (searchResults) searchResults.innerHTML = '';
      return;
    }
    var resultados = [];
    todosLosProductos.forEach(function (item) {
      var score = calcScore(query, item.producto.nombre);
      if (score > 0) resultados.push({ score: score, producto: item.producto, categoria: item.categoria });
    });
    resultados.sort(function (a, b) {
      return b.score - a.score || a.producto.nombre.localeCompare(b.producto.nombre, 'es');
    });
    renderBusqueda(resultados.slice(0, 40), query);
  }

  function activarTab(catId) {
    tabsContainer.querySelectorAll('.catalogo-tab').forEach(function (btn) {
      var active = btn.dataset.tab === catId;
      btn.classList.toggle('catalogo-tab--active', active);
      btn.setAttribute('aria-selected', String(active));
    });
    sessionStorage.setItem('teresita-catalogo-tab', catId);
  }

  function inicializarCatalogo(data) {
    catalogaData = data;

    Object.keys(data).forEach(function (cat) {
      data[cat].forEach(function (p) {
        todosLosProductos.push({ producto: p, categoria: cat });
      });
    });

    var categorias = Object.keys(data).sort().map(function (nombre) {
      return { id: toId(nombre), nombre: nombre, icono: ICONOS[nombre] || '', productos: data[nombre] };
    });

    if (!categorias.length) return;

    var savedId = sessionStorage.getItem('teresita-catalogo-tab');
    var inicial = categorias.find(function (c) { return c.id === savedId; }) || categorias[0];

    categorias.forEach(function (cat) {
      var btn = document.createElement('button');
      btn.className   = 'catalogo-tab';
      btn.dataset.tab = cat.id;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', 'false');
      btn.innerHTML = '<span aria-hidden="true">' + cat.icono + '</span> ' + cat.nombre;
      btn.addEventListener('click', function () {
        activarTab(cat.id);
        renderCarrusel(cat.nombre, cat.productos);
        if (searchInput)  searchInput.value = '';
        if (searchResults) searchResults.innerHTML = '';
      });
      tabsContainer.appendChild(btn);
    });

    activarTab(inicial.id);
    renderCarrusel(inicial.nombre, inicial.productos);
  }

  /* ── Mostrar indicador de carga mientras llega el JSON ── */
  contentContainer.innerHTML = '<p style="padding:2rem;text-align:center;color:var(--color-texto-suave);">Cargando productos…</p>';

  /* ── Cargar datos desde data/productos.json ── */
  fetch('js/productos.json')
    .then(function (res) {
      if (!res.ok) throw new Error('Error al cargar productos.json: ' + res.status);
      return res.json();
    })
    .then(function (data) {
      contentContainer.innerHTML = '';
      inicializarCatalogo(data);
    })
    .catch(function (err) {
      console.error(err);
      contentContainer.innerHTML =
        '<p class="catalogo-error">⚠️ No se pudieron cargar los productos. Intentá recargar la página.</p>';
    });

  if (searchInput) {
    var debounceTimer;
    searchInput.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        var q = searchInput.value.trim();
        if (q.length >= 2) {
          contentContainer.style.display = 'none';
          buscar(q);
        } else {
          contentContainer.style.display = '';
          if (searchResults) searchResults.innerHTML = '';
        }
      }, 300);
    });
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        searchInput.value = '';
        contentContainer.style.display = '';
        if (searchResults) searchResults.innerHTML = '';
      }
    });
  }

})();


/* =====================================================================
   5. MENÚ HAMBURGUESA
   ===================================================================== */
(function initMobileMenu() {
  var navToggle = document.getElementById('nav-toggle');
  var mainNav   = document.getElementById('main-nav');
  if (!navToggle || !mainNav) return;

  navToggle.addEventListener('click', function () {
    var expanded = this.getAttribute('aria-expanded') === 'true';
    this.setAttribute('aria-expanded', String(!expanded));
    mainNav.classList.toggle('is-open', !expanded);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && mainNav.classList.contains('is-open')) {
      mainNav.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
      navToggle.focus();
    }
  });

  mainNav.querySelectorAll('.nav-link').forEach(function (link) {
    link.addEventListener('click', function () {
      mainNav.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });

  document.addEventListener('click', function (e) {
    if (!mainNav.contains(e.target) && !navToggle.contains(e.target)
        && mainNav.classList.contains('is-open')) {
      mainNav.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
    }
  });
})();


/* =====================================================================
   6. SCROLL SPY
   ===================================================================== */
(function initScrollSpy() {
  var sections = document.querySelectorAll('section[id]');
  var navLinks = document.querySelectorAll('.nav-link');
  if (!sections.length || !navLinks.length) return;

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        navLinks.forEach(function (l) { l.removeAttribute('aria-current'); });
        var active = document.querySelector('.nav-link[href="#' + entry.target.id + '"]');
        if (active) active.setAttribute('aria-current', 'location');
      }
    });
  }, { threshold: 0.3, rootMargin: '-80px 0px -50% 0px' });

  sections.forEach(function (s) { observer.observe(s); });
})();


/* =====================================================================
   CATEGORÍAS POPULARES — click para saltar al tab correcto
   ===================================================================== */
(function initCatCards() {
  document.querySelectorAll('.cat-card[data-jump]').forEach(function(card) {
    card.addEventListener('click', function() {
      var tabId = card.getAttribute('data-jump');
      setTimeout(function() {
        var btn = document.querySelector('.catalogo-tab[data-tab="' + tabId + '"]');
        if (btn) btn.click();
      }, 300);
    });
  });
})();
/* =====================================================================
   CARRUSEL DE GALERÍA
   ===================================================================== */
(function() {
  var track = document.getElementById('carruselTrack');
  var prevBtn = document.getElementById('carruselPrev');
  var nextBtn = document.getElementById('carruselNext');
  var dotsWrapper = document.getElementById('carruselIndicadores');
  if (!track) return;

  var slides = track.querySelectorAll('.galeria-carrusel-slide');
  var total = slides.length;
  var current = 0;
  var autoTimer;

  // Crear puntos indicadores
  slides.forEach(function(_, i) {
    var dot = document.createElement('button');
    dot.className = 'galeria-carrusel-dot' + (i === 0 ? ' activo' : '');
    dot.setAttribute('aria-label', 'Ir a imagen ' + (i + 1));
    dot.addEventListener('click', function() { goTo(i); });
    dotsWrapper.appendChild(dot);
  });

  function goTo(index) {
    current = (index + total) % total;
    track.style.transform = 'translateX(-' + (current * 100) + '%)';
    dotsWrapper.querySelectorAll('.galeria-carrusel-dot').forEach(function(d, i) {
      d.classList.toggle('activo', i === current);
    });
  }

  prevBtn.addEventListener('click', function() { goTo(current - 1); resetAuto(); });
  nextBtn.addEventListener('click', function() { goTo(current + 1); resetAuto(); });

  function resetAuto() {
    clearInterval(autoTimer);
    autoTimer = setInterval(function() { goTo(current + 1); }, 4000);
  }
  resetAuto();
})();