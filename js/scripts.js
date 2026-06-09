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
   3 & 4. CATÁLOGO + BÚSQUEDA — datos inline (funciona con file://)
   ===================================================================== */
(function initCatalogo() {

  var tabsContainer    = document.getElementById('catalogos-tabs');
  var contentContainer = document.getElementById('catalogos-content');
  var searchInput      = document.getElementById('productos-search');
  var searchResults    = document.getElementById('search-results');
  if (!tabsContainer || !contentContainer) return;

  var ICONOS = {
    'Abarrotes y Despensa':       '🛒',
    'Lácteos y Refrigerados':     '🥛',
    'Carnes y Embutidos':         '🥩',
    'Frutas y Verduras':          '🥦',
    'Bebidas':                    '🥤',
    'Snacks y Dulcería':          '🍫',
    'Panadería':                  '🍞',
    'Higiene y Cuidado Personal': '🧴',
    'Limpieza del Hogar':         '🧹',
    'Ferretería y Hogar':         '🔧',
    'Alimentos para Mascotas':    '🐾',
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
    function loadImg() {
      wrapper.innerHTML = '';
      if (imagenSrc) {
        var img       = document.createElement('img');
        img.alt       = nombre;
        img.width     = 400;
        img.height    = 300;
        img.src       = imagenSrc;
        img.className = 'card-img-loaded';
        wrapper.appendChild(img);
      } else {
        wrapper.innerHTML =
          '<div class="card-img-placeholder">'
          + '<span class="img-placeholder-icon" aria-hidden="true">📷</span>'
          + '<span class="img-placeholder-text">Sin imagen</span>'
          + '</div>';
      }
      card.removeEventListener('mouseenter', loadImg);
    }
    card.addEventListener('mouseenter', loadImg);
  }

  function crearTarjeta(producto, catLabel) {
    var li      = document.createElement('li');
    li.className = 'carrusel-item';
    var article = document.createElement('article');
    article.className = 'producto-card';
    article.setAttribute('aria-label', 'Producto: ' + producto.nombre);
    article.innerHTML =
      '<div class="card-img-wrapper card-img-hover-pending">'
      + '<span class="hover-hint" aria-hidden="true">🖱️ Hover para ver</span>'
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

  /* ── Datos inline — no necesita servidor ── */
  var data = {"Abarrotes y Despensa": [{"nombre": "Aceite 3 En 1 90Ml", "precio": 1450, "subcategoria": "Aceites", "imagen": ""}, {"nombre": "Aceite 40 Abro", "precio": 2825, "subcategoria": "Aceites", "imagen": ""}, {"nombre": "Aceite Beisite Moto 4T", "precio": 5200, "subcategoria": "Aceites", "imagen": ""}, {"nombre": "Aceite Beisite Moto 4T Lata", "precio": 6525, "subcategoria": "Aceites", "imagen": ""}, {"nombre": "Aceite Camibar 65Ml", "precio": 950, "subcategoria": "Aceites", "imagen": ""}, {"nombre": "Aceite Clover Soya 500Ml", "precio": 850, "subcategoria": "Aceites", "imagen": ""}, {"nombre": "Aceite Clover Soya 900Ml", "precio": 1415, "subcategoria": "Aceites", "imagen": ""}, {"nombre": "Aceite Cocina Don Cheff 900Ml", "precio": 1245, "subcategoria": "Aceites", "imagen": ""}, {"nombre": "Aceite Corona 3000Ml", "precio": 3590, "subcategoria": "Aceites", "imagen": ""}, {"nombre": "Aceite Corona 500Ml", "precio": 750, "subcategoria": "Aceites", "imagen": ""}, {"nombre": "Aceite Corona 900Ml", "precio": 1225, "subcategoria": "Aceites", "imagen": ""}, {"nombre": "Aceite De Aguacate 60Ml", "precio": 350, "subcategoria": "Aceites", "imagen": ""}, {"nombre": "Aceite De Almendras", "precio": 950, "subcategoria": "Aceites", "imagen": ""}, {"nombre": "Aceite Don Chef", "precio": 850, "subcategoria": "Aceites", "imagen": ""}, {"nombre": "Aceite En Su Punto 1500Ml", "precio": 1975, "subcategoria": "Aceites", "imagen": ""}, {"nombre": "Aceite En Su Punto 450Ml", "precio": 730, "subcategoria": "Aceites", "imagen": ""}, {"nombre": "Aceite En Su Punto 900Ml", "precio": 1275, "subcategoria": "Aceites", "imagen": ""}, {"nombre": "Aceite Girol Girasol 500 Ml", "precio": 805, "subcategoria": "Aceites", "imagen": ""}, {"nombre": "Aceite Gonher Moto 4T 20W50", "precio": 5325, "subcategoria": "Aceites", "imagen": ""}, {"nombre": "Aceite Hidraulico Pinta Abro 354Ml", "precio": 2350, "subcategoria": "Aceites", "imagen": ""}, {"nombre": "Aceite Ideal 1.400Ml", "precio": 1925, "subcategoria": "Aceites", "imagen": ""}, {"nombre": "Aceite Ideal 3L", "precio": 3650, "subcategoria": "Aceites", "imagen": ""}, {"nombre": "Aceite Ideal 800Ml", "precio": 1110, "subcategoria": "Aceites", "imagen": ""}, {"nombre": "Aceite Mi Sabor Natural 900Ml", "precio": 1050, "subcategoria": "Aceites", "imagen": ""}, {"nombre": "Aceite Mineral 65Ml", "precio": 550, "subcategoria": "Aceites", "imagen": ""}, {"nombre": "Aceite Moto 20W50", "precio": 6525, "subcategoria": "Aceites", "imagen": ""}, {"nombre": "Aceite Moto 4T Rider 20W-50", "precio": 5475, "subcategoria": "Aceites", "imagen": ""}, {"nombre": "Aceite Motor Abro 1 Litro", "precio": 3575, "subcategoria": "Aceites", "imagen": ""}, {"nombre": "Aceite Motor Evame 1L", "precio": 4380, "subcategoria": "Aceites", "imagen": ""}, {"nombre": "Aceite Motor Golden #40", "precio": 2525, "subcategoria": "Aceites", "imagen": ""}, {"nombre": "Aceite Pennzoil 2T", "precio": 6525, "subcategoria": "Aceites", "imagen": ""}, {"nombre": "Aceite Pennzoil Moto 4T", "precio": 5500, "subcategoria": "Aceites", "imagen": ""}, {"nombre": "Aceite Purela 750Ml", "precio": 950, "subcategoria": "Aceites", "imagen": ""}, {"nombre": "Aceite Salat De Oliva 175G", "precio": 2255, "subcategoria": "Aceites", "imagen": ""}, {"nombre": "Achiote Achiotico 215G", "precio": 1275, "subcategoria": "Condimentos", "imagen": ""}, {"nombre": "Achiote Achiotico 95G", "precio": 485, "subcategoria": "Condimentos", "imagen": ""}, {"nombre": "Achiote Aracelly 90Grs", "precio": 450, "subcategoria": "Condimentos", "imagen": ""}, {"nombre": "Achiote Los Patitos 215 Grms", "precio": 1500, "subcategoria": "Condimentos", "imagen": ""}, {"nombre": "Achiote Los Patitos 90G", "precio": 690, "subcategoria": "Condimentos", "imagen": ""}, {"nombre": "Aderezo Con Chipotle Zafran 420G", "precio": 1700, "subcategoria": "Salsas", "imagen": ""}, {"nombre": "Ajo Molido 20G", "precio": 350, "subcategoria": "Condimentos", "imagen": ""}, {"nombre": "Ajo Molido 4G", "precio": 100, "subcategoria": "Condimentos", "imagen": ""}, {"nombre": "Atun Aurora Trocitos", "precio": 1000, "subcategoria": "Atunes", "imagen": ""}, {"nombre": "Atun Calvo Trocitos +Ahumado", "precio": 2150, "subcategoria": "Atunes", "imagen": ""}, {"nombre": "Atun Calvo Trocitos +Maiz Dulce", "precio": 2150, "subcategoria": "Atunes", "imagen": ""}, {"nombre": "Atun Gomes 3Pack", "precio": 1825, "subcategoria": "Atunes", "imagen": ""}, {"nombre": "Atun Splash Trocitos", "precio": 795, "subcategoria": "Atunes", "imagen": ""}, {"nombre": "Avena Mosh Hojuela 350G", "precio": 1205, "subcategoria": "Avenas", "imagen": ""}, {"nombre": "Cafe Montaña 250G", "precio": 2400, "subcategoria": "Cafe", "imagen": ""}, {"nombre": "Caracolitos Roma 250G", "precio": 740, "subcategoria": "Pastas Alimenticias", "imagen": ""}, {"nombre": "Cereal Fruity Ohs Bolsa", "precio": 1050, "subcategoria": "Cereales", "imagen": ""}, {"nombre": "Consome Maggi Costilla", "precio": 130, "subcategoria": "Consomes", "imagen": ""}, {"nombre": "Consome Pollo 4Un", "precio": 710, "subcategoria": "Consomes", "imagen": ""}, {"nombre": "Crema Cola De Res Maggi 76G", "precio": 865, "subcategoria": "Sopas", "imagen": ""}, {"nombre": "Frijol Blanco Productos De Mama 400G", "precio": 775, "subcategoria": "Frijoles", "imagen": ""}, {"nombre": "Frijoles Rojos Don Pedro 425G", "precio": 1135, "subcategoria": "Frijoles", "imagen": ""}, {"nombre": "Garbanzos Productos De Mama 400G", "precio": 775, "subcategoria": "Semillas", "imagen": ""}, {"nombre": "Garbanzos Tonos 410G", "precio": 915, "subcategoria": "Enlatados", "imagen": ""}, {"nombre": "Indavigo Maicena 200G", "precio": 475, "subcategoria": "Maicenas", "imagen": ""}, {"nombre": "Lentejas Productos De Mama 400G", "precio": 725, "subcategoria": "Semillas", "imagen": ""}, {"nombre": "Lentejas Tio Pelon 400G Bol,", "precio": 725, "subcategoria": "Semillas", "imagen": ""}, {"nombre": "Maicena Fabri 500G", "precio": 850, "subcategoria": "Maicenas", "imagen": ""}, {"nombre": "Maiz Dulce Richly 248G", "precio": 550, "subcategoria": "Enlatados", "imagen": ""}, {"nombre": "Miel De Abeja La Legitima 150Ml", "precio": 1600, "subcategoria": "Miel", "imagen": ""}, {"nombre": "Palomitas Act Ii Mantequilla", "precio": 865, "subcategoria": "Maiz", "imagen": ""}, {"nombre": "Sal Solar 500G", "precio": 330, "subcategoria": "Sal", "imagen": ""}, {"nombre": "Salsa China Banquete 148Ml", "precio": 1000, "subcategoria": "Salsas", "imagen": ""}, {"nombre": "Sardina Ovalada Sirena 425G", "precio": 1775, "subcategoria": "Sardinas", "imagen": ""}, {"nombre": "Tang Pina Guayaba", "precio": 250, "subcategoria": "Tang", "imagen": ""}, {"nombre": "Tortillas Al Toque Ilusion", "precio": 850, "subcategoria": "Tortillas", "imagen": ""}], "Alimentos para Mascotas": [{"nombre": "Alimento Cachorros Dog Choice", "precio": 1425, "subcategoria": "Alimento Para Perros", "imagen": ""}, {"nombre": "Alimento Conejo 1K", "precio": 1025, "subcategoria": "Concentrados", "imagen": ""}, {"nombre": "Alimento De Gallina Ponedora 1.7Kg", "precio": 950, "subcategoria": "Concentrados", "imagen": ""}, {"nombre": "Alimento De Gato 1K", "precio": 2050, "subcategoria": "Concentrados", "imagen": ""}, {"nombre": "Alimento De Perro Adulto 1.7Kg", "precio": 1730, "subcategoria": "Alimento Para Perros", "imagen": ""}, {"nombre": "Alimento Desarrollo 1.7Kg", "precio": 950, "subcategoria": "Concentrados", "imagen": ""}, {"nombre": "Alimento Don Gato 1K", "precio": 1600, "subcategoria": "Alimento Para Gatos", "imagen": ""}, {"nombre": "Alimento Don Gato 454 Gr", "precio": 800, "subcategoria": "Concentrados", "imagen": ""}, {"nombre": "Alimento Engorde Pollo 1.7Kg", "precio": 950, "subcategoria": "Concentrados", "imagen": ""}, {"nombre": "Alimento Gato Alimiau 1.3K", "precio": 2775, "subcategoria": "Alimento Para Gatos", "imagen": ""}, {"nombre": "Alimento Gato Alimiau 420Gr", "precio": 975, "subcategoria": "Alimento Para Gatos", "imagen": ""}, {"nombre": "Alimento Gato Trio Cat 1K", "precio": 2050, "subcategoria": "Alimento Para Gatos", "imagen": ""}, {"nombre": "Alimento Gato Trio Cat 400G", "precio": 950, "subcategoria": "Concentrados", "imagen": ""}, {"nombre": "Alimento Inicio De Pollo 1.7Kg", "precio": 950, "subcategoria": "Concentrados", "imagen": ""}, {"nombre": "Alimento Inicio Pelet", "precio": 1050, "subcategoria": "Concentrados", "imagen": ""}, {"nombre": "Alimento Maxi Dog 4K", "precio": 5425, "subcategoria": "Concentrados", "imagen": ""}, {"nombre": "Alimento Maxi Dog Adulto 1.5Kg", "precio": 2300, "subcategoria": "Concentrados", "imagen": ""}, {"nombre": "Alimento Maxi Dog Cachorro 1.5Kg", "precio": 2525, "subcategoria": "Concentrados", "imagen": ""}, {"nombre": "Alimento Mega Dog Adulto1.8Kg", "precio": 1725, "subcategoria": "Alimento Para Perros", "imagen": ""}, {"nombre": "Alimento Para Perro 1K Adulto", "precio": 1025, "subcategoria": "Alimento Para Perros", "imagen": ""}, {"nombre": "Alimento Perro Brikan 900G", "precio": 850, "subcategoria": "Alimento Para Perros", "imagen": ""}, {"nombre": "Alimento Perro Pet Master Cachorro", "precio": 1200, "subcategoria": "Concentrados", "imagen": ""}, {"nombre": "Alimento Perro Rufo 1K", "precio": 1400, "subcategoria": "Alimento Para Perros", "imagen": ""}, {"nombre": "Alimento Pet Master Adulto 1Kg", "precio": 1150, "subcategoria": "Concentrados", "imagen": ""}, {"nombre": "Alimento Ponedora Pelet", "precio": 1050, "subcategoria": "Concentrados", "imagen": ""}], "Bebidas": [{"nombre": "Agua Alma 600Ml", "precio": 545, "subcategoria": "Aguas", "imagen": ""}, {"nombre": "Agua Alpina 1L", "precio": 1000, "subcategoria": "Aguas", "imagen": ""}, {"nombre": "Agua Alpina 2L", "precio": 1300, "subcategoria": "Aguas", "imagen": ""}, {"nombre": "Agua Alpina 600Ml", "precio": 800, "subcategoria": "Aguas", "imagen": ""}, {"nombre": "Agua B-Healthy 1L", "precio": 375, "subcategoria": "Aguas", "imagen": ""}, {"nombre": "Agua B-Healthy 500Ml", "precio": 250, "subcategoria": "Aguas", "imagen": ""}, {"nombre": "Agua Oxigenada 60Ml", "precio": 1350, "subcategoria": "Aguas", "imagen": ""}, {"nombre": "Alma Soda Limon ---15004958", "precio": 750, "subcategoria": "Refrescos", "imagen": ""}, {"nombre": "Big Cola Roja 3030Ml", "precio": 1500, "subcategoria": "Refrescos", "imagen": ""}, {"nombre": "Coca Cola Zero 600Ml", "precio": 900, "subcategoria": "Gaseosos", "imagen": ""}, {"nombre": "De Agua Alma Il", "precio": 600, "subcategoria": "Aguas", "imagen": ""}, {"nombre": "Del Valle Mango Y Fresa 330Ml", "precio": 600, "subcategoria": "Refrescos", "imagen": ""}, {"nombre": "Fanta Kolita 1.500L", "precio": 1300, "subcategoria": "Refrescos", "imagen": ""}, {"nombre": "Fanta Kolita 3L", "precio": 2400, "subcategoria": "Refrescos", "imagen": ""}, {"nombre": "Fanta Naranja 1.5L", "precio": 1300, "subcategoria": "Refrescos", "imagen": ""}, {"nombre": "Fanta Uva 2.5L", "precio": 1400, "subcategoria": "Refrescos", "imagen": ""}, {"nombre": "Fresca 1.5 L", "precio": 1300, "subcategoria": "Refrescos", "imagen": ""}, {"nombre": "Fresca 3 L", "precio": 2400, "subcategoria": "Refrescos", "imagen": ""}, {"nombre": "Fresca 600Ml", "precio": 900, "subcategoria": "Gaseosos", "imagen": ""}, {"nombre": "Fuze Tea Manzanilla 250Ml", "precio": 300, "subcategoria": "Refrescos", "imagen": ""}, {"nombre": "Gin Ale 3L", "precio": 2400, "subcategoria": "Refrescos", "imagen": ""}, {"nombre": "Ginger Ale 600Ml", "precio": 900, "subcategoria": "Gaseosos", "imagen": "img/Productos/Ginger-Ale.jpg"}, {"nombre": "Jugo De Naranja 2.2L", "precio": 2425, "subcategoria": "Jugos Y Refrescos", "imagen": ""}, {"nombre": "Jugo Naranja 1L == 15000593", "precio": 1650, "subcategoria": "Jugos Y Refrescos", "imagen": ""}, {"nombre": "Jugo Naranja 250Ml", "precio": 665, "subcategoria": "Jugos Y Refrescos", "imagen": ""}, {"nombre": "Jugo Naranja 500Ml --- 15004084", "precio": 975, "subcategoria": "Jugos Y Refrescos", "imagen": ""}, {"nombre": "Jugo Tampico 1L Citrus Punch", "precio": 885, "subcategoria": "Jugos Y Refrescos", "imagen": ""}, {"nombre": "Jugo Welchs Uva 1890Ml", "precio": 5725, "subcategoria": "Jugos Y Refrescos", "imagen": ""}, {"nombre": "Nectar Mango 1L == 15004336", "precio": 1000, "subcategoria": "Jugos Y Refrescos", "imagen": ""}, {"nombre": "Nectar Manzana 1L", "precio": 1000, "subcategoria": "Jugos Y Refrescos", "imagen": ""}, {"nombre": "Nectar Melocoton 1L== 15004338", "precio": 1000, "subcategoria": "Jugos Y Refrescos", "imagen": ""}, {"nombre": "Nectar Pera 1L", "precio": 1000, "subcategoria": "Jugos Y Refrescos", "imagen": ""}, {"nombre": "Smirnoff Lata Original", "precio": 1225, "subcategoria": "Cervesas Lata", "imagen": ""}, {"nombre": "Soda Canada Dry 2.5L", "precio": 2000, "subcategoria": "Refrescos", "imagen": ""}], "Carnes y Embutidos": [{"nombre": "Alas De Pollo Pollo Pako 500G", "precio": 2025, "subcategoria": "Pollo", "imagen": ""}, {"nombre": "Alitas Empanizadas 500Grs", "precio": 3885, "subcategoria": "Pollo", "imagen": ""}, {"nombre": "Bisteck Cerdo Adobado Carranza", "precio": 2000, "subcategoria": "Carnes De Cerdo", "imagen": ""}, {"nombre": "Bisteck De Cerdo Carranza", "precio": 2495, "subcategoria": "Carnes Res", "imagen": ""}, {"nombre": "Carcasa Pollo", "precio": 800, "subcategoria": "Pollo", "imagen": ""}, {"nombre": "Cerdo Picado Carranza", "precio": 2000, "subcategoria": "Carnes De Cerdo", "imagen": ""}, {"nombre": "Combo Sandwich Kimby", "precio": 1855, "subcategoria": "Embutidos", "imagen": ""}, {"nombre": "Hueso Consome Carranza", "precio": 1250, "subcategoria": "Carnes Res", "imagen": ""}, {"nombre": "Jamon Tico 100G", "precio": 1250, "subcategoria": "Embutidos", "imagen": ""}, {"nombre": "Kimby Menudos Pollo", "precio": 1100, "subcategoria": "Pollo", "imagen": ""}, {"nombre": "Medallones Pollo Kimby 200G", "precio": 1200, "subcategoria": "Pollo", "imagen": ""}, {"nombre": "Mortadela Bologna 1K", "precio": 1375, "subcategoria": "Embutidos", "imagen": ""}, {"nombre": "Mortadela De Pollo Tucurrique", "precio": 2250, "subcategoria": "Embutidos", "imagen": ""}, {"nombre": "Salchichas Tucurrique 500G", "precio": 1400, "subcategoria": "Embutidos", "imagen": ""}, {"nombre": "Salchichon", "precio": 1300, "subcategoria": "Embutidos", "imagen": ""}, {"nombre": "Tortas Res Tiquisia", "precio": 1850, "subcategoria": "Carnes Res", "imagen": ""}], "Ferretería y Hogar": [{"nombre": "Apagador Doble Eagle Plata", "precio": 3205, "subcategoria": "Ferreteria", "imagen": ""}, {"nombre": "Apagador Doble Volteck", "precio": 1800, "subcategoria": "Ferreteria", "imagen": ""}, {"nombre": "Apagador Sencillo Volteck", "precio": 850, "subcategoria": "Ferreteria", "imagen": ""}, {"nombre": "Apagador Tania", "precio": 675, "subcategoria": "Cosas Electricas", "imagen": ""}, {"nombre": "Apagador Volteck 46004", "precio": 400, "subcategoria": "Ferreteria", "imagen": ""}, {"nombre": "Atomizador Sprayer Peq,", "precio": 850, "subcategoria": "Cosas Para El Hohar", "imagen": ""}, {"nombre": "Bisagra Diesel 2\"", "precio": 575, "subcategoria": "Ferreteria", "imagen": ""}, {"nombre": "Bombillo Akzi 15 Wats", "precio": 875, "subcategoria": "Bombillos", "imagen": ""}, {"nombre": "Brocha Hunter 2,1/2#", "precio": 560, "subcategoria": "Brochas", "imagen": ""}, {"nombre": "Candado Hermex 40Mm", "precio": 3935, "subcategoria": "Candados", "imagen": ""}, {"nombre": "Candado Hermex 50Mm", "precio": 2260, "subcategoria": "Candados", "imagen": ""}, {"nombre": "Cinta Empaque Transparente 40M", "precio": 595, "subcategoria": "Cinta", "imagen": ""}, {"nombre": "Cinta Teflon", "precio": 200, "subcategoria": "Cinta", "imagen": ""}, {"nombre": "Clavos Acero 2\"", "precio": 455, "subcategoria": "Clavo", "imagen": ""}, {"nombre": "Clavos Acero 2/1/2", "precio": 665, "subcategoria": "Clavo", "imagen": ""}, {"nombre": "Clavos Acero 3\"", "precio": 825, "subcategoria": "Clavo", "imagen": ""}, {"nombre": "Disco Metal Ingco", "precio": 700, "subcategoria": "Ferreteria", "imagen": ""}, {"nombre": "Escoba Super Mundo", "precio": 1650, "subcategoria": "Cosas Para El Hohar", "imagen": ""}, {"nombre": "Extencion Akzi 5M", "precio": 2175, "subcategoria": "Extencion", "imagen": ""}, {"nombre": "Hoja Segueta Diesel", "precio": 625, "subcategoria": "Cosas Electricas", "imagen": ""}, {"nombre": "Lija", "precio": 250, "subcategoria": "Lijas", "imagen": ""}, {"nombre": "Llave De Paso Amanco", "precio": 3050, "subcategoria": "Hogar", "imagen": ""}, {"nombre": "Llave De Paso Roja", "precio": 550, "subcategoria": "Llave Chorro", "imagen": ""}, {"nombre": "Llave Paso Pcp", "precio": 2475, "subcategoria": "Llave Chorro", "imagen": ""}, {"nombre": "Masking Bestape 1/2\"", "precio": 200, "subcategoria": "Cosas Electricas", "imagen": ""}, {"nombre": "Pegamento Poxipol Trasparente 14Ml", "precio": 2950, "subcategoria": "Pegamento", "imagen": ""}, {"nombre": "Picaporte Diesel 3\"", "precio": 825, "subcategoria": "Ferreteria", "imagen": ""}, {"nombre": "Picaporte Uyustools 4\"", "precio": 900, "subcategoria": "Cosas Para El Hohar", "imagen": ""}, {"nombre": "Pistola Manguera Pretul 22753", "precio": 750, "subcategoria": "Cosas Para El Hohar", "imagen": ""}, {"nombre": "Plafon Volteck", "precio": 750, "subcategoria": "Cosas Electricas", "imagen": ""}, {"nombre": "Plastico Adhesivo", "precio": 1530, "subcategoria": "Cosas Para El Hohar", "imagen": ""}, {"nombre": "Prensa P/ Ropa My Home", "precio": 1200, "subcategoria": "Hogar", "imagen": ""}, {"nombre": "Toma Doble Parche Tania", "precio": 1625, "subcategoria": "Ferreteria", "imagen": ""}], "Frutas y Verduras": [{"nombre": "Aguacate", "precio": 800, "subcategoria": "Frutas", "imagen": ""}, {"nombre": "Ajo Paquete 3", "precio": 400, "subcategoria": "Verduras", "imagen": ""}, {"nombre": "Ajos Grande X5", "precio": 1225, "subcategoria": "Verduras", "imagen": ""}, {"nombre": "Ajos X3", "precio": 375, "subcategoria": "Verduras", "imagen": ""}], "Higiene y Cuidado Personal": [{"nombre": "Acetaminofen 500Mg", "precio": 300, "subcategoria": "Medicinas", "imagen": ""}, {"nombre": "Acondicionador Dove12Ml", "precio": 100, "subcategoria": "Acondicionador", "imagen": ""}, {"nombre": "Agua Oxigenada", "precio": 525, "subcategoria": "Medicinas", "imagen": ""}, {"nombre": "Alcohol Con Metilo Malick 250Ml", "precio": 1125, "subcategoria": "Alcohol", "imagen": ""}, {"nombre": "Alcohol Etilico Omnivit 250Ml", "precio": 800, "subcategoria": "Alcohol", "imagen": ""}, {"nombre": "Alcohol Malick 96 250Ml", "precio": 1275, "subcategoria": "Alcohol", "imagen": ""}, {"nombre": "Alcohol Multiuso Omnivit 250Ml", "precio": 925, "subcategoria": "Alcohol", "imagen": ""}, {"nombre": "Aleve Liq-Gde 24U", "precio": 300, "subcategoria": "Pastillas", "imagen": ""}, {"nombre": "Algodon Absorbente 25G", "precio": 450, "subcategoria": "Medicinas", "imagen": ""}, {"nombre": "Algodon Malick 10Grs", "precio": 250, "subcategoria": "Medicinas", "imagen": ""}, {"nombre": "Alka - Seltzer Boost", "precio": 225, "subcategoria": "Pastillas", "imagen": ""}, {"nombre": "Alka Gastric", "precio": 300, "subcategoria": "Medicinas", "imagen": ""}, {"nombre": "Alka-Ad", "precio": 225, "subcategoria": "Pastillas", "imagen": ""}, {"nombre": "Amiga Con Alas X10", "precio": 795, "subcategoria": "Toallas De Mujer", "imagen": ""}, {"nombre": "Antiflu-Des Mas", "precio": 350, "subcategoria": "Pastillas", "imagen": ""}, {"nombre": "Aplicadores Madera 100 U", "precio": 200, "subcategoria": "Aplicadores", "imagen": ""}, {"nombre": "Colonia Mennen 100Ml", "precio": 3200, "subcategoria": "Colonias", "imagen": ""}, {"nombre": "Crema Sweet Honey", "precio": 1100, "subcategoria": "Cremas", "imagen": ""}, {"nombre": "Des, Dove Invisible Dry Barra 45G", "precio": 3000, "subcategoria": "Desodorantes", "imagen": ""}, {"nombre": "Des, Rexona Forest 45G", "precio": 2750, "subcategoria": "Desodorantes", "imagen": ""}, {"nombre": "Desodorante Aerosol Lady Speed Stick Invisible", "precio": 3100, "subcategoria": "Desodorantes", "imagen": ""}, {"nombre": "Desodorante Rexona Men Clinical 150Ml", "precio": 2500, "subcategoria": "Desodorantes", "imagen": ""}, {"nombre": "Desodorante Rexona V8 150Ml", "precio": 3000, "subcategoria": "Desodorantes", "imagen": ""}, {"nombre": "Desodorante Speed Stick Barra Classic 50G", "precio": 3000, "subcategoria": "Desodorantes", "imagen": ""}, {"nombre": "Higienico Nevax Economax 900Hs", "precio": 1550, "subcategoria": "Papel Higienico", "imagen": ""}, {"nombre": "Higienico Nevax Extramas", "precio": 975, "subcategoria": "Papel Higienico", "imagen": ""}, {"nombre": "Jabon Baby Dove Hipoelergenico 75G", "precio": 1175, "subcategoria": "Jabones De Barra", "imagen": ""}, {"nombre": "Jabon Bactex Avena", "precio": 600, "subcategoria": "Jabones De Bano", "imagen": ""}, {"nombre": "Jabon Liquido Jobonito Manzana", "precio": 875, "subcategoria": "Jabon Para Manos", "imagen": ""}, {"nombre": "Jabon Mennen 90G", "precio": 775, "subcategoria": "Jabones De Bano", "imagen": ""}, {"nombre": "Jabon Protex Carbon", "precio": 800, "subcategoria": "Jabones De Bano", "imagen": ""}, {"nombre": "Jabon Vinolia Frescura 145G", "precio": 795, "subcategoria": "Jabones De Barra", "imagen": ""}, {"nombre": "Kit De Parches", "precio": 650, "subcategoria": "Parches", "imagen": ""}, {"nombre": "Lava Platos Suntex 1000G", "precio": 755, "subcategoria": "Jabon Para Manos", "imagen": ""}, {"nombre": "Masculan Estrias", "precio": 1600, "subcategoria": "Preservativos", "imagen": ""}, {"nombre": "Masculan Sensitivo", "precio": 1600, "subcategoria": "Preservativos", "imagen": ""}, {"nombre": "Nit.Jabon Liquido Primavera", "precio": 1200, "subcategoria": "Jabon Para Manos", "imagen": ""}, {"nombre": "Protectores Kotex Days Normal", "precio": 675, "subcategoria": "Toallas De Mujer", "imagen": ""}, {"nombre": "Talco Baby Magic Mennen Rosa 100G", "precio": 2050, "subcategoria": "Talcos", "imagen": ""}, {"nombre": "Toalla Cocina Nevax Mil Usos", "precio": 1440, "subcategoria": "Toalla Cocina", "imagen": ""}, {"nombre": "Toallas Esencial Kotex", "precio": 350, "subcategoria": "Toallas De Mujer", "imagen": ""}, {"nombre": "Zepol Infantil 30G", "precio": 1550, "subcategoria": "Medicinas", "imagen": ""}], "Limpieza del Hogar": [{"nombre": "Aluminliah 1L", "precio": 2125, "subcategoria": "Aluminios", "imagen": ""}, {"nombre": "Aluminol Trigger Litro", "precio": 2900, "subcategoria": "Aluminios", "imagen": ""}, {"nombre": "Aromatizante Coconut", "precio": 1250, "subcategoria": "Desodorantes Ambientales", "imagen": ""}, {"nombre": "Aromatizante Green Apple", "precio": 1250, "subcategoria": "Desodorantes Ambientales", "imagen": ""}, {"nombre": "Brillo Fino Contraste", "precio": 375, "subcategoria": "Fibras Lavaplatos", "imagen": ""}, {"nombre": "Brillo Grueso Contraste", "precio": 375, "subcategoria": "Fibras Lavaplatos", "imagen": ""}, {"nombre": "Cloro Blanko 450Ml", "precio": 385, "subcategoria": "Cloros", "imagen": ""}, {"nombre": "Desatorador Para Inodoro", "precio": 1900, "subcategoria": "Limpieza", "imagen": ""}, {"nombre": "Desengrasante Liah 1L", "precio": 1000, "subcategoria": "Desengrasantes", "imagen": ""}, {"nombre": "Esponja La Negrita Doble Uso", "precio": 615, "subcategoria": "Fibras Lavaplatos", "imagen": ""}, {"nombre": "Fibra Alumine", "precio": 385, "subcategoria": "Fibras Lavaplatos", "imagen": ""}, {"nombre": "Lavaplatos Acibril Manzana 1000Gr", "precio": 1450, "subcategoria": "Lavaplatos", "imagen": ""}, {"nombre": "Lavaplatos Liah", "precio": 675, "subcategoria": "Lavaplatos", "imagen": ""}, {"nombre": "Pala P/ Basura", "precio": 1100, "subcategoria": "Escobas Y Palo Piso", "imagen": ""}, {"nombre": "Suavitel Acgua Bot, 700Ml", "precio": 1225, "subcategoria": "Suaviteles", "imagen": ""}, {"nombre": "Suavitel Fresca Primavera 700Ml", "precio": 1225, "subcategoria": "Suaviteles", "imagen": ""}, {"nombre": "Suavitel Fresca Primavera 750Ml", "precio": 1280, "subcategoria": "Suaviteles", "imagen": ""}], "Lácteos y Refrigerados": [{"nombre": "Charo Cuarto Pie Limon 500G", "precio": 3400, "subcategoria": "Helados", "imagen": ""}, {"nombre": "Deligurt Fresa In Line 200Ml", "precio": 765, "subcategoria": "Yogurt", "imagen": ""}, {"nombre": "Deligurt Frutas 200 Ml == 15000021", "precio": 765, "subcategoria": "Yogurt", "imagen": ""}, {"nombre": "Leche Condensada Able Farm", "precio": 775, "subcategoria": "Leche Condensada", "imagen": ""}, {"nombre": "Leche Descremada 0% 1L", "precio": 1225, "subcategoria": "Leche Liquida", "imagen": ""}, {"nombre": "Leche Dos Pinos 1L", "precio": 750, "subcategoria": "Leche Liquida", "imagen": ""}, {"nombre": "Leche Dos Pinos 250Ml.", "precio": 425, "subcategoria": "Leche Liquida", "imagen": ""}, {"nombre": "Leche Magnesia Rey", "precio": 650, "subcategoria": "Leche En Polvo", "imagen": ""}, {"nombre": "Natilla La Granja 500G", "precio": 1635, "subcategoria": "Natillas", "imagen": ""}, {"nombre": "Natilla Llanos Del Norte 200G", "precio": 995, "subcategoria": "Natillas", "imagen": ""}, {"nombre": "Natilla Zarcero 300G", "precio": 930, "subcategoria": "Natillas", "imagen": ""}, {"nombre": "Natilla Zarcero 500G", "precio": 1525, "subcategoria": "Natillas", "imagen": ""}, {"nombre": "Numar Suave Taza 250G", "precio": 850, "subcategoria": "Mantequillas", "imagen": ""}, {"nombre": "Numar Taza Con Ajo 200G", "precio": 1050, "subcategoria": "Mantequillas", "imagen": ""}, {"nombre": "Rebanadas La Granja 128G", "precio": 760, "subcategoria": "Quesos", "imagen": ""}, {"nombre": "Yogurt Frutas Coronado 1L", "precio": 2150, "subcategoria": "Yogurt", "imagen": ""}], "Panadería": [{"nombre": "Aragones Pan Pupusa Dulce", "precio": 1350, "subcategoria": "Pan", "imagen": ""}, {"nombre": "Arepas Prolasa", "precio": 1150, "subcategoria": "Pan", "imagen": ""}, {"nombre": "Pan Rosquitas Laguna", "precio": 950, "subcategoria": "Pan", "imagen": ""}], "Snacks y Dulcería": [{"nombre": "Bizcochos Lilliana 100G", "precio": 1200, "subcategoria": "Snacks", "imagen": ""}, {"nombre": "Bon Bon Amarillo Unidad", "precio": 200, "subcategoria": "Chocolates", "imagen": ""}, {"nombre": "Cebollino Jacks 30G", "precio": 450, "subcategoria": "Snacks", "imagen": ""}, {"nombre": "Chocolate Milka Brownie", "precio": 1175, "subcategoria": "Confites Y Chocolates", "imagen": ""}, {"nombre": "Chocolate Milka Caramelo 100G", "precio": 1175, "subcategoria": "Confites Y Chocolates", "imagen": ""}, {"nombre": "Chocolate Milka Dessert", "precio": 1175, "subcategoria": "Confites Y Chocolates", "imagen": ""}, {"nombre": "De Todito Fiesta Snax 330G", "precio": 2575, "subcategoria": "Snacks", "imagen": ""}, {"nombre": "Galletas Brinky Mantequilla", "precio": 1200, "subcategoria": "Galletas", "imagen": ""}, {"nombre": "Galletas Brinky Vainilla", "precio": 1200, "subcategoria": "Galletas", "imagen": ""}, {"nombre": "Gelafina Uva 80G", "precio": 450, "subcategoria": "Gelatinas", "imagen": ""}, {"nombre": "Gelatina Gelitos", "precio": 125, "subcategoria": "Gelatinas", "imagen": ""}, {"nombre": "Gelatinas Fruit Grande", "precio": 100, "subcategoria": "Gelatinas", "imagen": ""}, {"nombre": "Halls Mora Azul", "precio": 350, "subcategoria": "Confites Y Chocolates", "imagen": ""}, {"nombre": "Kenys Papas 180G", "precio": 2125, "subcategoria": "Papas Todtadas", "imagen": ""}, {"nombre": "Kenys Super Mix 350 G.", "precio": 1750, "subcategoria": "Snacks", "imagen": ""}, {"nombre": "Kitty Aros De Cebolla 14G", "precio": 100, "subcategoria": "Paquetes", "imagen": ""}, {"nombre": "Kitty Takitos De Maiz", "precio": 100, "subcategoria": "Paquetes", "imagen": ""}, {"nombre": "Palomitas Act Ii Queso Chedar", "precio": 1100, "subcategoria": "Palomitas", "imagen": ""}, {"nombre": "Popi Jacks Con Caramelo 75G", "precio": 600, "subcategoria": "Snacks", "imagen": ""}, {"nombre": "Popi Supercoco", "precio": 75, "subcategoria": "Confites Y Chocolates", "imagen": ""}, {"nombre": "Tortrix Barbacoa 150G", "precio": 1250, "subcategoria": "Snacks", "imagen": ""}, {"nombre": "Tosty Familiar 3 Pack", "precio": 2800, "subcategoria": "Snacks", "imagen": "img/Productos/tosty-familiar.png"}, {"nombre": "Tosty Tronaditas Limon & Sal 20% Mas", "precio": 1450, "subcategoria": "Snacks", "imagen": "img/Productos/tronaditas.png"}, {"nombre": "Violeta Gallito", "precio": 175, "subcategoria": "Confites Y Chocolates", "imagen": "img/Productos/violetas.png"}, {"nombre": "Zibas Papa Miel Mostaza 26G", "precio": 300, "subcategoria": "Snacks", "imagen": "img/Productos/zibas-mostaza-miel.png"}]};

  catalogaData = data;

  Object.keys(data).forEach(function (cat) {
    data[cat].forEach(function (p) {
      todosLosProductos.push({ producto: p, categoria: cat });
    });
  });

  var categorias = Object.keys(data).sort().map(function (nombre) {
    return { id: toId(nombre), nombre: nombre, icono: ICONOS[nombre] || '📦', productos: data[nombre] };
  });

  if (categorias.length) {
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
