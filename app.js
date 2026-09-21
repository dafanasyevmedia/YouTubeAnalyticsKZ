(function(){
  "use strict";

  var DATA = window.__DASHBOARD_DATA__ || { channels: [], videos: [], themes: {} };
  var CHANNELS = DATA.channels || [];
  var VIDEOS = DATA.videos || [];
  var THEMES = DATA.themes || {};

  var channelsById = {};
  CHANNELS.forEach(function(c){ channelsById[c.id] = c; });

  var videosByChannel = {};
  VIDEOS.forEach(function(v){
    (videosByChannel[v.cid] = videosByChannel[v.cid] || []).push(v);
  });

  var FORMATS = Array.from(new Set(VIDEOS.map(function(v){ return v.format; }).filter(Boolean))).sort(function(a,b){ return a.localeCompare(b,'ru'); });

  // -------------------- критерии отбора каналов (футер, коротко) --------------------
  var CRITERIA = {
    kz: 'Казахстанские авторы и медиа о Казахстане (рус./двуязычные с долей рус. ≥50%) + зарубежные редакции про Казахстан отдельным сегментом-ориентиром; топ — по медиане просмотров длинных видео за окно, не по подписчикам; порог для лонг-листа — от 5 тыс. подписчиков и 3 видео за полгода; без ТВ-каналов, крупных новостных порталов, казахоязычных и чисто развлекательных каналов.',
    politics: 'Русскоязычные каналы, ядро которых — общественно-политическая повестка (независимые медиа, аналитики, интервьюеры, расследователи); топ — по медиане просмотров за 92 дня; без госвещателей (Россия 24, RT, Соловьёв LIVE и т.п.) и политики как развлечения (юмор, мемные нарезки, реакции).',
    general: 'Топ ру-ютуба в целом, независимо от тематики, кроме прямо исключённых направлений: музыка, развлечения (шоу/пранки/челленджи/реакции), детское, летсплеи и игровые стримы, нарезки чужого контента; топ — по медиане просмотров за 184 дня; порог — от 100 тыс. подписчиков.',
    travel: 'Каналы, где поездка — предмет выпуска: маршруты, страны, экспедиции, жизнь за границей глазами приезжего, гастрономические и транспортные путешествия; без миграционно-визового контента (это политика) и турагентской рекламы; топ — по медиане просмотров за 184 дня.'
  };
  (function renderCriteriaFooter(){
    var el = document.getElementById('criteriaFooter');
    if (!el) return;
    var text = CRITERIA[DATA.dataset];
    el.innerHTML = text ? '<b>Критерий отбора канала в этот набор.</b> ' + escapeHtml(text) : '';
  })();

  // -------------------- helpers --------------------
  function fmtNum(n, decimals){
    if (n === null || n === undefined || isNaN(n)) return "—";
    var d = decimals || 0;
    return Number(n).toLocaleString('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function fmtPct(x, decimals){
    if (x === null || x === undefined || isNaN(x)) return "—";
    return (x*100).toLocaleString('ru-RU', { minimumFractionDigits: decimals||1, maximumFractionDigits: decimals||1 }) + "%";
  }
  function fmtDate(iso){
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString('ru-RU', { day:'2-digit', month:'2-digit', year:'numeric' });
  }
  function fmtDuration(sec){
    if (sec === null || sec === undefined || isNaN(sec)) return "—";
    sec = Math.round(sec);
    var h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = sec%60;
    var pad = function(x){ return (x<10?'0':'')+x; };
    return h > 0 ? (h+':'+pad(m)+':'+pad(s)) : (m+':'+pad(s));
  }
  function median(arr){
    if (!arr || !arr.length) return null;
    var s = arr.slice().sort(function(a,b){ return a-b; });
    var mid = Math.floor(s.length/2);
    return s.length % 2 ? s[mid] : (s[mid-1]+s[mid])/2;
  }
  function escapeHtml(str){
    if (str === null || str === undefined) return "";
    return String(str).replace(/[&<>"']/g, function(c){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
    });
  }
  function themeName(id){
    if (id === null || id === undefined) return "—";
    return THEMES[String(id)] || ("Тема " + id);
  }
  function themeColor(id){
    var hue = Math.round((Number(id) * 137.508) % 360);
    return 'hsl(' + hue + ' 62% 54%)';
  }
  function debounce(fn, ms){
    var t;
    return function(){
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function(){ fn.apply(ctx, args); }, ms);
    };
  }
  function youtubeWatchUrl(id){ return 'https://www.youtube.com/watch?v=' + encodeURIComponent(id); }
  function youtubeChannelUrl(id){ return 'https://www.youtube.com/channel/' + encodeURIComponent(id); }

  // -------------------- meta line --------------------
  // На вкладке «Отчёт» строка в шапке не привязана к одному набору (сам
  // отчёт сквозной по всем наборам) — показываем сумму по всем готовым
  // наборам. На остальных вкладках — как раньше, цифры активного набора.
  function renderMetaInfo(tabName){
    var el = document.getElementById('metaInfo');
    if (!el) return;
    var parts = [];
    if (tabName === 'report' && window.__DATASETS__ && window.__DATASETS__.sets) {
      var sets = window.__DATASETS__.sets;
      var readyKeys = Object.keys(sets).filter(function(k){ return sets[k].ready; });
      var totalCh = 0, totalVid = 0;
      readyKeys.forEach(function(k){
        totalCh += sets[k].channels || 0;
        totalVid += sets[k].videos || 0;
      });
      parts.push(totalCh + ' каналов');
      parts.push(totalVid + ' видео');
      parts.push(readyKeys.length + ' набора');
      var genAt = window.__DATASETS__.generated_at ? new Date(window.__DATASETS__.generated_at) : null;
      if (genAt && !isNaN(genAt.getTime())) parts.push('данные собраны ' + genAt.toLocaleDateString('ru-RU'));
    } else {
      var genAt2 = DATA.generated_at ? new Date(DATA.generated_at) : null;
      parts.push(CHANNELS.length + ' каналов');
      parts.push(VIDEOS.length + ' видео');
      if (genAt2 && !isNaN(genAt2.getTime())) parts.push('данные собраны ' + genAt2.toLocaleDateString('ru-RU'));
    }
    el.textContent = parts.join(' · ');
  }

  // -------------------- tabs --------------------
  var tabButtons = Array.prototype.slice.call(document.querySelectorAll('.tab-btn'));
  var tabPanels = {
    report: document.getElementById('tab-report'),
    channels: document.getElementById('tab-channels'),
    themes: document.getElementById('tab-themes'),
    formats: document.getElementById('tab-formats'),
    videos: document.getElementById('tab-videos'),
    analytics: document.getElementById('tab-analytics')
  };
  function switchTab(name){
    tabButtons.forEach(function(b){ b.classList.toggle('active', b.dataset.tab === name); });
    Object.keys(tabPanels).forEach(function(k){ tabPanels[k].classList.toggle('active', k === name); });
    // «Отчёт» — не часть вкладок конкретного набора (живёт в шапке рядом с
    // кнопками наборов, т.к. его содержимое не зависит от того, какой набор
    // сейчас загружен). Поэтому пока показан отчёт, ряд вкладок набора
    // (Обзор каналов/Карта тем/...) скрыт — он не имеет смысла без выбранного
    // набора для просмотра.
    var tabsNav = document.getElementById('tabs');
    if (tabsNav) tabsNav.style.display = (name === 'report') ? 'none' : '';
    var reportBtn = document.getElementById('reportTabBtn');
    if (reportBtn) reportBtn.classList.toggle('active', name === 'report');
    if (name === 'themes') renderThemeMap();
    if (name === 'formats') renderFormatMap();
    if (name === 'analytics') renderAnalyticsTab();
    renderMetaInfo(name);
    updateBoundedTableHeights();
  }

  // Таблицы каналов/видео скроллятся внутри себя (а не вся страница) — высота считается
  // под фактическую высоту хедера/тулбара над таблицей и того, что идёт под ней (пагинация,
  // нижний отступ main), чтобы горизонтальный скролл всегда был у нижнего края видимой
  // области, а не в конце длинного списка строк.
  function updateBoundedTableHeights(){
    var mainEl = document.querySelector('main');
    var mainPB = parseFloat(getComputedStyle(mainEl).paddingBottom) || 0;
    document.querySelectorAll('.table-wrap.scroll-bound').forEach(function(el){
      if (el.offsetParent === null) return; // скрытая (неактивная) вкладка — пересчитаем при переключении
      var panel = el.closest('.tab-panel');
      el.style.height = ''; // снимаем прошлую высоту, чтобы измерить естественную раскладку
      var top = el.getBoundingClientRect().top;
      var naturalBottom = el.getBoundingClientRect().bottom;
      var panelBottom = panel.getBoundingClientRect().bottom;
      var trailing = Math.max(0, panelBottom - naturalBottom) + mainPB;
      var h = window.innerHeight - top - trailing - 8;
      el.style.height = Math.max(260, h) + 'px';
    });
  }
  tabButtons.forEach(function(b){
    b.addEventListener('click', function(){ switchTab(b.dataset.tab); });
  });

  // ====================================================================
  // TAB 1 — Обзор каналов
  // ====================================================================
  var channelsState = {
    search: '',
    showExcluded: false,
    sortKey: 'subs',
    sortDir: 'desc'
  };

  var channelsSearchEl = document.getElementById('channelsSearch');
  var channelsExclEl = document.getElementById('channelsShowExcluded');
  var channelsCountEl = document.getElementById('channelsCount');
  var channelsTbody = document.querySelector('#channelsTable tbody');

  channelsSearchEl.addEventListener('input', debounce(function(){
    channelsState.search = channelsSearchEl.value.trim().toLowerCase();
    renderChannelsTable();
  }, 150));
  channelsExclEl.addEventListener('change', function(){
    channelsState.showExcluded = channelsExclEl.checked;
    renderChannelsTable();
  });

  document.querySelectorAll('#channelsTable thead th[data-key]').forEach(function(th){
    th.addEventListener('click', function(){
      var key = th.dataset.key;
      if (channelsState.sortKey === key) {
        channelsState.sortDir = channelsState.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        channelsState.sortKey = key;
        channelsState.sortDir = (key === 'name' || key === 'category' || key === 'bm_format') ? 'asc' : 'desc';
      }
      renderChannelsTable();
    });
  });

  function updateSortHeaders(tableSel, key, dir){
    document.querySelectorAll(tableSel + ' thead th[data-key]').forEach(function(th){
      th.classList.toggle('sorted', th.dataset.key === key);
      var arrow = th.querySelector('.arrow');
      if (arrow) arrow.remove();
      if (th.dataset.key === key){
        var span = document.createElement('span');
        span.className = 'arrow';
        span.textContent = dir === 'asc' ? '▲' : '▼';
        th.appendChild(span);
      }
    });
  }

  function compareValues(a, b){
    if (a === null || a === undefined) a = -Infinity;
    if (b === null || b === undefined) b = -Infinity;
    if (typeof a === 'string' || typeof b === 'string') {
      return String(a).localeCompare(String(b), 'ru');
    }
    return a - b;
  }

  function getFilteredChannels(){
    return CHANNELS.filter(function(c){
      if (!channelsState.showExcluded && c.excluded) return false;
      if (channelsState.search && c.name.toLowerCase().indexOf(channelsState.search) === -1) return false;
      return true;
    });
  }

  function renderChannelsTable(){
    var rows = getFilteredChannels();
    var key = channelsState.sortKey, dir = channelsState.sortDir;
    rows.sort(function(a, b){
      var va = key === 'excluded' ? (a.excluded?1:0) : key === 'faceless' ? (a.faceless?1:0) : key === 'monetized' ? (a.monetized?1:0) : a[key];
      var vb = key === 'excluded' ? (b.excluded?1:0) : key === 'faceless' ? (b.faceless?1:0) : key === 'monetized' ? (b.monetized?1:0) : b[key];
      var c = compareValues(va, vb);
      return dir === 'asc' ? c : -c;
    });
    updateSortHeaders('#channelsTable', key, dir);

    var html = rows.map(function(c){
      return '<tr class="clickable" data-cid="' + c.id + '">' +
        '<td class="col-name" title="' + escapeHtml(c.name) + '">' + escapeHtml(c.name) + '</td>' +
        '<td class="num">' + fmtNum(c.subs) + '</td>' +
        '<td class="num">' + fmtNum(c.median_views) + '</td>' +
        '<td class="num">' + fmtPct(c.median_to_subs_ratio, 2) + '</td>' +
        '<td class="num">' + fmtNum(c.frequency_per_week, 2) + '</td>' +
        '<td class="num">' + fmtPct(c.median_engagement_rate, 2) + '</td>' +
        '<td class="num">' + fmtNum(c.video_count_period) + '</td>' +
        '<td>' + escapeHtml(c.category || '—') + '</td>' +
        '<td>' + escapeHtml(c.bm_format || '—') + '</td>' +
        '<td class="center">' + (c.faceless ? '✓' : '—') + '</td>' +
        '<td class="center">' + (c.monetized ? '✓' : '—') + '</td>' +
        '<td><span class="badge ' + (c.excluded ? 'status-excluded' : 'status-active') + '">' + (c.excluded ? 'исключён' : 'активен') + '</span></td>' +
        '<td>' + (c.has_video_data ? '<button class="link-btn videos-jump" data-cid="' + c.id + '">Видео →</button>' : '') + '</td>' +
      '</tr>';
    }).join('');
    channelsTbody.innerHTML = html || '<tr><td colspan="13" class="empty-note">Ничего не найдено</td></tr>';
    channelsCountEl.textContent = rows.length + ' из ' + CHANNELS.length;

    channelsTbody.querySelectorAll('tr[data-cid]').forEach(function(tr){
      tr.addEventListener('click', function(e){
        if (e.target.closest('.videos-jump')) return;
        openChannelCard(tr.dataset.cid);
      });
    });
    channelsTbody.querySelectorAll('.videos-jump').forEach(function(btn){
      btn.addEventListener('click', function(e){
        e.stopPropagation();
        filterVideosByChannel(btn.dataset.cid);
      });
    });
  }

  // ====================================================================
  // TAB 3 — Таблица видео
  // ====================================================================
  var videosState = {
    search: '',
    theme: 'all',
    format: 'all',
    channel: 'all',
    hero: 'all',
    sortKey: 'views',
    sortDir: 'desc',
    page: 1,
    pageSize: 150
  };

  var videosSearchEl = document.getElementById('videosSearch');
  var videosThemeEl = document.getElementById('videosThemeFilter');
  var videosFormatEl = document.getElementById('videosFormatFilter');
  var videosChannelEl = document.getElementById('videosChannelFilter');
  var videosCountEl = document.getElementById('videosCount');
  var videosTbody = document.querySelector('#videosTable tbody');
  var videosActiveFiltersEl = document.getElementById('videosActiveFilters');
  var videosPaginationEl = document.getElementById('videosPagination');

  (function initVideoFilters(){
    var themeIds = Object.keys(THEMES).map(Number).sort(function(a,b){return a-b;});
    var opts = ['<option value="all">Все темы</option>'];
    themeIds.forEach(function(id){ opts.push('<option value="' + id + '">' + escapeHtml(themeName(id)) + '</option>'); });
    opts.push('<option value="none">Без темы</option>');
    videosThemeEl.innerHTML = opts.join('');

    var fopts = ['<option value="all">Все форматы</option>'];
    FORMATS.forEach(function(f){ fopts.push('<option value="' + escapeHtml(f) + '">' + escapeHtml(f) + '</option>'); });
    fopts.push('<option value="none">Без формата</option>');
    videosFormatEl.innerHTML = fopts.join('');

    var channelsWithVideos = CHANNELS.filter(function(c){ return c.has_video_data; })
      .sort(function(a,b){ return a.name.localeCompare(b.name, 'ru'); });
    var copts = ['<option value="all">Все каналы</option>'];
    channelsWithVideos.forEach(function(c){ copts.push('<option value="' + c.id + '">' + escapeHtml(c.name) + '</option>'); });
    videosChannelEl.innerHTML = copts.join('');
  })();

  videosSearchEl.addEventListener('input', debounce(function(){
    videosState.search = videosSearchEl.value.trim().toLowerCase();
    videosState.page = 1;
    renderVideosTable();
  }, 150));
  videosThemeEl.addEventListener('change', function(){ videosState.theme = videosThemeEl.value; videosState.page = 1; renderVideosTable(); });
  videosFormatEl.addEventListener('change', function(){ videosState.format = videosFormatEl.value; videosState.page = 1; renderVideosTable(); });
  videosChannelEl.addEventListener('change', function(){ videosState.channel = videosChannelEl.value; videosState.page = 1; renderVideosTable(); });
  document.getElementById('videosClearFilters').addEventListener('click', function(){
    videosState.search = ''; videosState.theme = 'all'; videosState.format = 'all'; videosState.channel = 'all'; videosState.hero = 'all'; videosState.page = 1;
    videosSearchEl.value = ''; videosThemeEl.value = 'all'; videosFormatEl.value = 'all'; videosChannelEl.value = 'all';
    renderVideosTable();
  });

  document.querySelectorAll('#videosTable thead th[data-key]').forEach(function(th){
    th.addEventListener('click', function(){
      var key = th.dataset.key;
      if (videosState.sortKey === key) {
        videosState.sortDir = videosState.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        videosState.sortKey = key;
        videosState.sortDir = (key === 'title' || key === 'channel_name' || key === 'format' || key === 'hero') ? 'asc' : 'desc';
      }
      renderVideosTable();
    });
  });

  function filterVideosByChannel(cid){
    setBackToReport(null);
    videosState.channel = cid;
    videosState.theme = 'all'; videosState.format = 'all'; videosState.search = '';
    videosState.page = 1;
    videosChannelEl.value = cid; videosThemeEl.value = 'all'; videosFormatEl.value = 'all'; videosSearchEl.value = '';
    switchTab('videos');
    renderVideosTable();
    closeChannelCard();
  }
  function filterVideosByTheme(themeId){
    setBackToReport(null);
    videosState.theme = String(themeId);
    videosState.format = 'all'; videosState.channel = 'all'; videosState.search = '';
    videosState.page = 1;
    videosThemeEl.value = String(themeId); videosFormatEl.value = 'all'; videosChannelEl.value = 'all'; videosSearchEl.value = '';
    switchTab('videos');
    renderVideosTable();
  }
  function filterVideosByFormat(format){
    setBackToReport(null);
    videosState.format = format;
    videosState.theme = 'all'; videosState.channel = 'all'; videosState.search = ''; videosState.hero = 'all';
    videosState.page = 1;
    videosFormatEl.value = format; videosThemeEl.value = 'all'; videosChannelEl.value = 'all'; videosSearchEl.value = '';
    switchTab('videos');
    renderVideosTable();
  }
  function filterVideosByThemeAndFormat(themeId, format){
    setBackToReport(null);
    videosState.theme = String(themeId);
    videosState.format = format;
    videosState.channel = 'all'; videosState.search = ''; videosState.hero = 'all';
    videosState.page = 1;
    videosThemeEl.value = String(themeId); videosFormatEl.value = format; videosChannelEl.value = 'all'; videosSearchEl.value = '';
    switchTab('videos');
    renderVideosTable();
  }
  function filterVideosByHero(hero){
    setBackToReport(null);
    videosState.hero = hero;
    videosState.theme = 'all'; videosState.format = 'all'; videosState.channel = 'all'; videosState.search = '';
    videosState.page = 1;
    videosThemeEl.value = 'all'; videosFormatEl.value = 'all'; videosChannelEl.value = 'all'; videosSearchEl.value = '';
    switchTab('videos');
    renderVideosTable();
  }
  function filterVideosBySearch(term){
    setBackToReport(null);
    videosState.search = (term || '').toLowerCase();
    videosState.theme = 'all'; videosState.format = 'all'; videosState.channel = 'all'; videosState.hero = 'all';
    videosState.page = 1;
    videosSearchEl.value = term || ''; videosThemeEl.value = 'all'; videosFormatEl.value = 'all'; videosChannelEl.value = 'all';
    switchTab('videos');
    renderVideosTable();
  }

  function getFilteredVideos(){
    return VIDEOS.filter(function(v){
      if (videosState.theme === 'none') { if (v.theme_id !== null && v.theme_id !== undefined) return false; }
      else if (videosState.theme !== 'all') { if (String(v.theme_id) !== videosState.theme) return false; }

      if (videosState.format === 'none') { if (v.format) return false; }
      else if (videosState.format !== 'all') { if (v.format !== videosState.format) return false; }

      if (videosState.channel !== 'all' && v.cid !== videosState.channel) return false;
      if (videosState.hero !== 'all' && v.hero !== videosState.hero) return false;
      if (videosState.search && v.title.toLowerCase().indexOf(videosState.search) === -1) return false;
      return true;
    });
  }

  function renderActiveFilters(){
    var chips = [];
    if (videosState.channel !== 'all') {
      var ch = channelsById[videosState.channel];
      chips.push({ key:'channel', label: 'Канал: ' + (ch ? ch.name : videosState.channel) });
    }
    if (videosState.theme !== 'all') {
      chips.push({ key:'theme', label: 'Тема: ' + (videosState.theme === 'none' ? 'без темы' : themeName(videosState.theme)) });
    }
    if (videosState.format !== 'all') {
      chips.push({ key:'format', label: 'Формат: ' + (videosState.format === 'none' ? 'без формата' : videosState.format) });
    }
    if (videosState.hero !== 'all') {
      chips.push({ key:'hero', label: 'Герой: ' + videosState.hero });
    }
    if (videosState.search) {
      chips.push({ key:'search', label: 'Поиск: «' + videosState.search + '»' });
    }
    videosActiveFiltersEl.innerHTML = chips.map(function(c){
      return '<span class="chip">' + escapeHtml(c.label) + '<button data-clear="' + c.key + '">✕</button></span>';
    }).join('');
    videosActiveFiltersEl.querySelectorAll('button[data-clear]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var k = btn.dataset.clear;
        if (k === 'channel') { videosState.channel = 'all'; videosChannelEl.value = 'all'; }
        if (k === 'theme') { videosState.theme = 'all'; videosThemeEl.value = 'all'; }
        if (k === 'format') { videosState.format = 'all'; videosFormatEl.value = 'all'; }
        if (k === 'hero') { videosState.hero = 'all'; }
        if (k === 'search') { videosState.search = ''; videosSearchEl.value = ''; }
        videosState.page = 1;
        renderVideosTable();
      });
    });
  }

  function renderVideosTable(){
    var rows = getFilteredVideos();
    var key = videosState.sortKey, dir = videosState.sortDir;
    rows.sort(function(a, b){
      var va = key === 'theme_id' ? themeName(a.theme_id) : a[key];
      var vb = key === 'theme_id' ? themeName(b.theme_id) : b[key];
      if (key === 'publishDate') { va = va ? new Date(va).getTime() : -Infinity; vb = vb ? new Date(vb).getTime() : -Infinity; }
      var c = compareValues(va, vb);
      return dir === 'asc' ? c : -c;
    });
    updateSortHeaders('#videosTable', key, dir);
    renderActiveFilters();

    var total = rows.length;
    var pageCount = Math.max(1, Math.ceil(total / videosState.pageSize));
    if (videosState.page > pageCount) videosState.page = pageCount;
    var start = (videosState.page - 1) * videosState.pageSize;
    var pageRows = rows.slice(start, start + videosState.pageSize);

    var html = pageRows.map(function(v){
      var ratioStr = (v.ratio === null || v.ratio === undefined) ? '—' : v.ratio.toFixed(2) + '×';
      return '<tr>' +
        '<td class="col-title"><a href="' + youtubeWatchUrl(v.video_id) + '" target="_blank" rel="noopener" title="' + escapeHtml(v.title) + '">' + escapeHtml(v.title) + '</a></td>' +
        '<td><button class="link-btn chan-jump" data-cid="' + v.cid + '">' + escapeHtml(v.channel_name) + '</button></td>' +
        '<td>' + (v.theme_id !== null && v.theme_id !== undefined ? '<span style="color:' + themeColor(v.theme_id) + '">●</span> ' + escapeHtml(themeName(v.theme_id)) : '<span class="muted">—</span>') + '</td>' +
        '<td>' + escapeHtml(v.format || '—') + '</td>' +
        '<td>' + escapeHtml(v.hero || '—') + '</td>' +
        '<td class="num">' + fmtNum(v.views) + '</td>' +
        '<td class="num">' + ratioStr + '</td>' +
        '<td class="num">' + fmtDate(v.publishDate) + '</td>' +
        '<td class="num">' + fmtDuration(v.duration_sec) + '</td>' +
      '</tr>';
    }).join('');
    videosTbody.innerHTML = html || '<tr><td colspan="9" class="empty-note">Ничего не найдено</td></tr>';
    videosCountEl.textContent = total + ' из ' + VIDEOS.length;

    videosTbody.querySelectorAll('.chan-jump').forEach(function(btn){
      btn.addEventListener('click', function(){ filterVideosByChannel(btn.dataset.cid); });
    });

    renderVideosPagination(pageCount, total);
  }

  function renderVideosPagination(pageCount, total){
    if (pageCount <= 1) { videosPaginationEl.innerHTML = ''; return; }
    var p = videosState.page;
    videosPaginationEl.innerHTML =
      '<button class="btn" id="vpPrev" ' + (p<=1?'disabled':'') + '>← Назад</button>' +
      '<span>Страница ' + p + ' из ' + pageCount + ' (' + total + ' видео)</span>' +
      '<button class="btn" id="vpNext" ' + (p>=pageCount?'disabled':'') + '>Вперёд →</button>';
    var prev = document.getElementById('vpPrev'), next = document.getElementById('vpNext');
    if (prev) prev.addEventListener('click', function(){ videosState.page--; renderVideosTable(); window.scrollTo({top:0, behavior:'smooth'}); });
    if (next) next.addEventListener('click', function(){ videosState.page++; renderVideosTable(); window.scrollTo({top:0, behavior:'smooth'}); });
  }

  // ====================================================================
  // TAB 2/2b — Карта тем / Карта форматов (общий bubble-chart движок)
  // ====================================================================
  var bubbleTooltipEl = document.getElementById('themeTooltip');

  function formatColor(str){
    var h = 0;
    for (var i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) >>> 0; }
    return 'hsl(' + (h % 360) + ' 58% 52%)';
  }

  // Общая агрегация "видео -> группа" (тема или формат) с учётом окна 14 дней для спроса.
  function computeGroupStats(getKey, getLabel, getColor){
    var now = new Date();
    var cutoff = new Date(now.getTime() - 14*24*3600*1000);
    var groups = {};
    VIDEOS.forEach(function(v){
      var key = getKey(v);
      if (key === null || key === undefined || key === '') return;
      var gid = String(key);
      if (!groups[gid]) groups[gid] = { id: key, name: getLabel(key), color: getColor(key), channels: new Set(), videoCount: 0, ratios: [], byChannel: {} };
      var g = groups[gid];
      g.channels.add(v.cid);
      g.videoCount++;
      if (!g.byChannel[v.cid]) g.byChannel[v.cid] = { name: v.channel_name, count: 0 };
      g.byChannel[v.cid].count++;
      if (v.ratio !== null && v.ratio !== undefined && v.publishDate) {
        var d = new Date(v.publishDate);
        if (!isNaN(d.getTime()) && d <= cutoff) g.ratios.push(v.ratio);
      }
    });
    var out = [];
    Object.keys(groups).forEach(function(gid){
      var g = groups[gid];
      var sorted = g.ratios.slice().sort(function(a,b){return a-b;});
      var median = null;
      if (sorted.length) {
        var mid = Math.floor(sorted.length/2);
        median = sorted.length % 2 ? sorted[mid] : (sorted[mid-1]+sorted[mid])/2;
      }
      var topChannel = null, topCount = 0;
      Object.keys(g.byChannel).forEach(function(cid){
        var e = g.byChannel[cid];
        if (e.count > topCount) { topCount = e.count; topChannel = e.name; }
      });
      var topShare = g.videoCount ? topCount / g.videoCount : 0;
      out.push({
        id: g.id, name: g.name, color: g.color,
        channelCount: g.channels.size,
        videoCount: g.videoCount,
        sampleSize: sorted.length,
        medianRatio: median,
        topChannel: topChannel,
        topChannelCount: topCount,
        topChannelShare: topShare,
        avgPerChannel: g.channels.size ? g.videoCount / g.channels.size : 0
      });
    });
    return out;
  }

  function computeThemeStats(){
    return computeGroupStats(
      function(v){ return v.theme_id; },
      function(id){ return themeName(id); },
      function(id){ return themeColor(id); }
    );
  }
  function computeFormatStats(){
    return computeGroupStats(
      function(v){ return v.format; },
      function(f){ return f; },
      function(f){ return formatColor(f); }
    );
  }

  function fmtShort(n){
    if (n === null || n === undefined || isNaN(n)) return '—';
    var sign = n < 0 ? '-' : '';
    n = Math.abs(n);
    if (n >= 1e6) return sign + (n/1e6).toFixed(1).replace(/\.0$/,'') + 'M';
    if (n >= 1e3) return sign + (n/1e3).toFixed(0) + 'K';
    return sign + String(Math.round(n));
  }

  // Универсальная отрисовка bubble/scatter-chart: svg/no-data элементы, подписи осей, обработчик клика,
  // подпись над пузырём и заголовки осей задаются вызывающей функцией. Изначально писалась для карт тем/форматов
  // (X = channelCount, Y = medianRatio, размер = videoCount), но переиспользуется и для Shorts vs long-form —
  // эти поля там означают X/Y/размер точки соответственно, не буквально "каналы"/"ratio".
  function renderBubbleMap(opts){
    var svg = document.getElementById(opts.svgId);
    var noDataEl = opts.noDataId ? document.getElementById(opts.noDataId) : null;
    var stats = opts.stats;
    var plottable = stats.filter(function(s){ return s.channelCount > 0 && s.medianRatio !== null; });
    var noData = stats.filter(function(s){ return s.channelCount > 0 && s.medianRatio === null; });

    var W = 920, H = 560, M = { top: 24, right: 30, bottom: 56, left: 64 };
    var innerW = W - M.left - M.right, innerH = H - M.top - M.bottom;

    var yTickFormat = opts.yTickFormat || function(v){ return v.toFixed(2) + '×'; };
    var xTickFormat = opts.xTickFormat || function(v){ return String(Math.round(v)); };
    var yLabel = opts.yLabel || 'Медиана views/медиана канала (спрос)';

    if (!plottable.length) {
      svg.innerHTML = '<text x="' + (W/2) + '" y="' + (H/2) + '" text-anchor="middle" class="axis-label">' + (opts.emptyMessage || 'Недостаточно данных') + '</text>';
      if (noDataEl) noDataEl.textContent = '';
      return;
    }

    var rawXMax = Math.max.apply(null, plottable.map(function(s){ return s.channelCount; }));
    var rawYMax = Math.max.apply(null, plottable.map(function(s){ return s.medianRatio; }));
    var xMax, yMax;
    if (opts.diagonal) {
      var commonMax = Math.max(rawXMax, rawYMax) * 1.15 || 1;
      xMax = commonMax; yMax = commonMax;
    } else {
      xMax = rawXMax + (opts.xPad !== undefined ? opts.xPad : 1);
      yMax = rawYMax * 1.15 || 1;
    }
    var yMin = 0;
    var sizeField = opts.sizeField || function(s){ return s.videoCount; };
    var maxSize = Math.max.apply(null, plottable.map(sizeField)) || 1;

    function xScale(v){ return M.left + (v / xMax) * innerW; }
    function yScale(v){ return M.top + innerH - ((v - yMin) / (yMax - yMin)) * innerH; }
    function rScale(v){ return 7 + Math.sqrt(v / maxSize) * 26; }

    var svgParts = [];

    // gridlines + axes
    var xTicks = Math.min(Math.round(xMax), 8) || 1;
    for (var i=0; i<=xTicks; i++){
      var xv = (xMax) * i / xTicks;
      var xpix = xScale(xv);
      svgParts.push('<line class="gridline" x1="'+xpix+'" y1="'+M.top+'" x2="'+xpix+'" y2="'+(M.top+innerH)+'"/>');
      svgParts.push('<text class="axis" x="'+xpix+'" y="'+(M.top+innerH+18)+'" text-anchor="middle">'+xTickFormat(xv)+'</text>');
    }
    var yTicks = 6;
    for (var j=0; j<=yTicks; j++){
      var yv = yMax * j / yTicks;
      var ypix = yScale(yv);
      svgParts.push('<line class="gridline" x1="'+M.left+'" y1="'+ypix+'" x2="'+(M.left+innerW)+'" y2="'+ypix+'"/>');
      svgParts.push('<text class="axis" x="'+(M.left-8)+'" y="'+(ypix+4)+'" text-anchor="end">'+yTickFormat(yv)+'</text>');
    }
    svgParts.push('<line class="axis" x1="'+M.left+'" y1="'+(M.top+innerH)+'" x2="'+(M.left+innerW)+'" y2="'+(M.top+innerH)+'"/>');
    svgParts.push('<line class="axis" x1="'+M.left+'" y1="'+M.top+'" x2="'+M.left+'" y2="'+(M.top+innerH)+'"/>');
    svgParts.push('<text class="axis-label" x="'+(M.left+innerW/2)+'" y="'+(H-14)+'" text-anchor="middle">'+opts.xLabel+'</text>');
    svgParts.push('<text class="axis-label" transform="translate(16,'+(M.top+innerH/2)+') rotate(-90)" text-anchor="middle">'+yLabel+'</text>');

    if (opts.diagonal) {
      svgParts.push('<line class="diagonal-line" x1="'+xScale(0)+'" y1="'+yScale(0)+'" x2="'+xScale(xMax)+'" y2="'+yScale(yMax)+'"/>');
    }

    // bubbles — крупные рисуем первыми (снизу), мелкие поверх них, чтобы мелкие
    // не оказывались полностью погребены под большими и оставались кликабельными.
    var drawOrder = plottable.slice().sort(function(a, b){ return sizeField(b) - sizeField(a); });
    drawOrder.forEach(function(s, idx){
      var cx = xScale(s.channelCount), cy = yScale(s.medianRatio), r = rScale(sizeField(s));
      var skewed = s.topChannelShare !== undefined && s.topChannelShare >= 0.5 && s.videoCount >= 4;
      svgParts.push('<g class="bubble-g" data-idx="'+idx+'">' +
        '<circle class="bubble'+(skewed?' bubble-skewed':'')+'" cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="'+s.color+'"' +
          (skewed ? ' stroke="#dc2626" stroke-width="2" stroke-dasharray="4,3"' : '') + '></circle>' +
        (opts.showLabels === false ? '' : '<text class="bubble-label" x="'+cx+'" y="'+(cy - r - 5)+'" text-anchor="middle">'+escapeHtml(opts.bubbleLabel(s))+(skewed?' ⚠':'')+'</text>') +
      '</g>');
    });

    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.innerHTML = svgParts.join('');

    svg.querySelectorAll('g.bubble-g').forEach(function(g){
      var s = drawOrder[Number(g.dataset.idx)];
      var circ = g.querySelector('circle.bubble');
      circ.addEventListener('mousemove', function(e){ showBubbleTooltip(e, s, opts); });
      circ.addEventListener('mouseleave', hideBubbleTooltip);
      circ.addEventListener('click', function(){ opts.onClick(s.id); });
    });

    if (noDataEl) {
      if (noData.length) {
        noDataEl.textContent = 'Недостаточно данных по видео старше 14 дней для: ' +
          noData.map(function(s){ return s.name; }).join(', ') + '.';
      } else {
        noDataEl.textContent = '';
      }
    }
  }

  var bubbleSizeMode = { themes: 'videos', formats: 'videos' };
  var SIZE_FIELDS = {
    videos: { field: function(s){ return s.videoCount; }, note: 'Размер пузыря — общее число видео в группе.' },
    skew: { field: function(s){ return s.avgPerChannel; }, note: 'Размер пузыря — среднее число видео на один канал в группе (выше — меньше каналов создают объём, больше риск, что это один прожорливый канал, а не массовая тема).' }
  };

  function wireSizeToggle(toggleId, key, rerenderFn){
    var wrap = document.getElementById(toggleId);
    if (!wrap) return;
    wrap.querySelectorAll('button[data-size]').forEach(function(btn){
      btn.classList.toggle('active', btn.dataset.size === bubbleSizeMode[key]);
      btn.addEventListener('click', function(){
        bubbleSizeMode[key] = btn.dataset.size;
        wrap.querySelectorAll('button[data-size]').forEach(function(b){ b.classList.toggle('active', b === btn); });
        rerenderFn();
      });
    });
  }

  function renderThemeMap(){
    renderBubbleMap({
      svgId: 'themeChart', noDataId: 'themeNoData',
      stats: computeThemeStats(),
      xLabel: 'Число каналов в теме (предложение)',
      groupNounGenitive: 'теме',
      bubbleLabel: function(s){ return String(s.id); },
      sizeField: SIZE_FIELDS[bubbleSizeMode.themes].field,
      onClick: function(id){ filterVideosByTheme(id); }
    });
    var noteEl = document.getElementById('themeSizeNote');
    if (noteEl) noteEl.textContent = SIZE_FIELDS[bubbleSizeMode.themes].note;
  }
  function renderFormatMap(){
    renderBubbleMap({
      svgId: 'formatChart', noDataId: 'formatNoData',
      stats: computeFormatStats(),
      xLabel: 'Число каналов, использующих формат (предложение)',
      groupNounGenitive: 'формате',
      bubbleLabel: function(s){ return s.name.length > 14 ? s.name.slice(0, 13) + '…' : s.name; },
      sizeField: SIZE_FIELDS[bubbleSizeMode.formats].field,
      onClick: function(format){ filterVideosByFormat(format); }
    });
    var noteEl = document.getElementById('formatSizeNote');
    if (noteEl) noteEl.textContent = SIZE_FIELDS[bubbleSizeMode.formats].note;
  }
  wireSizeToggle('themeSizeToggle', 'themes', renderThemeMap);
  wireSizeToggle('formatSizeToggle', 'formats', renderFormatMap);

  function showBubbleTooltip(e, s, opts){
    var rows = opts.tooltipRows ? opts.tooltipRows(s) : [
      ['Каналов в ' + opts.groupNounGenitive, String(s.channelCount)],
      ['Видео в ' + opts.groupNounGenitive, String(s.videoCount)],
      ['Медиана ratio (спрос)', s.medianRatio.toFixed(2) + '×'],
      ['Видео в выборке (>14 дн.)', String(s.sampleSize)]
    ];
    if (s.topChannel && opts.tooltipRows === undefined) {
      rows.push(['Видео на канал (среднее)', s.avgPerChannel.toFixed(1)]);
      rows.push(['Топ канал в группе', s.topChannel + ' — ' + s.topChannelCount + ' (' + Math.round(s.topChannelShare*100) + '%)']);
    }
    bubbleTooltipEl.innerHTML =
      '<b>' + escapeHtml(s.name) + '</b>' +
      rows.map(function(r){ return '<div class="row"><span>' + escapeHtml(r[0]) + '</span><span>' + escapeHtml(r[1]) + '</span></div>'; }).join('');
    bubbleTooltipEl.hidden = false;
    positionTooltip(e);
  }
  function positionTooltip(e){
    var pad = 14;
    var x = e.clientX + pad, y = e.clientY + pad;
    var rect = bubbleTooltipEl.getBoundingClientRect();
    if (x + rect.width > window.innerWidth) x = e.clientX - rect.width - pad;
    if (y + rect.height > window.innerHeight) y = e.clientY - rect.height - pad;
    bubbleTooltipEl.style.left = x + 'px';
    bubbleTooltipEl.style.top = y + 'px';
  }
  function hideBubbleTooltip(){ bubbleTooltipEl.hidden = true; }

  window.addEventListener('resize', debounce(function(){
    if (tabPanels.themes.classList.contains('active')) renderThemeMap();
    if (tabPanels.formats.classList.contains('active')) renderFormatMap();
    if (tabPanels.analytics.classList.contains('active')) renderShortsScatter();
    updateBoundedTableHeights();
  }, 200));

  // ====================================================================
  // TAB "Ещё аналитика" — тренды во времени, время публикации, длительность,
  // тема×формат, топ героев, Shorts vs long-form, топ каналов
  // ====================================================================
  var analyticsRendered = false;

  function renderAnalyticsTab(){
    renderDowHourCharts();
    renderDurationChart();
    renderThemeFormatMatrix();
    renderHeroesTable();
    renderShortsScatter();
    renderChannelLeaderboard();
    analyticsRendered = true;
  }

  // ---- generic CSS bar chart (used by dow/hour/duration charts) ----
  function renderBars(containerEl, data, opts){
    opts = opts || {};
    var valueOf = opts.value || function(d){ return d.medianRatio; };
    var vals = data.map(valueOf).filter(function(v){ return v !== null && v !== undefined && !isNaN(v); });
    var maxV = opts.maxValue !== undefined ? opts.maxValue : (vals.length ? Math.max.apply(null, vals) : 1);
    var minV = opts.minValue !== undefined ? opts.minValue : 0;
    if (maxV <= minV) maxV = minV + 1;
    var labelEvery = opts.labelEvery || 1;

    if (!data.length) { containerEl.innerHTML = '<div class="empty-note">Недостаточно данных.</div>'; return; }

    var barsHtml = data.map(function(d, i){
      var v = valueOf(d);
      var hasValue = v !== null && v !== undefined && !isNaN(v);
      var pct = hasValue ? Math.max(2, Math.round(((v - minV) / (maxV - minV)) * 100)) : 0;
      var color = opts.color ? opts.color(d, v) : 'var(--accent)';
      return '<div class="bar-col" data-idx="'+i+'"><div class="bar-fill" style="height:'+pct+'%;background:'+color+'"></div></div>';
    }).join('');

    var labelsHtml = data.map(function(d, i){
      return '<div class="bar-label">' + (i % labelEvery === 0 ? escapeHtml(d.label) : '') + '</div>';
    }).join('');

    containerEl.innerHTML = '<div class="barchart"><div class="barchart-bars">'+barsHtml+'</div><div class="barchart-labels">'+labelsHtml+'</div></div>';

    containerEl.querySelectorAll('.bar-col').forEach(function(col){
      var d = data[Number(col.dataset.idx)];
      col.addEventListener('mousemove', function(e){
        var rows = opts.tooltipRows ? opts.tooltipRows(d) : [[opts.valueLabel || 'Значение', String(valueOf(d))]];
        bubbleTooltipEl.innerHTML = '<b>' + escapeHtml(opts.titleOf ? opts.titleOf(d) : d.label) + '</b>' +
          rows.map(function(r){ return '<div class="row"><span>'+escapeHtml(r[0])+'</span><span>'+escapeHtml(r[1])+'</span></div>'; }).join('');
        bubbleTooltipEl.hidden = false;
        positionTooltip(e);
      });
      col.addEventListener('mouseleave', hideBubbleTooltip);
      if (opts.onClick) col.addEventListener('click', function(){ opts.onClick(d); });
    });
  }

  // ---- 1. Когда публикуют эффективнее (день недели / час, время KZ = UTC+5) ----
  var DOW_LABELS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
  function kzShift(date){ return new Date(date.getTime() + 5*3600*1000); }

  function computeDowStats(){
    var buckets = DOW_LABELS.map(function(l){ return { label:l, count:0, ratios:[] }; });
    VIDEOS.forEach(function(v){
      if (!v.publishDate) return;
      var d = new Date(v.publishDate);
      if (isNaN(d.getTime())) return;
      var jsDay = kzShift(d).getUTCDay();
      var idx = (jsDay+6)%7;
      buckets[idx].count++;
      if (v.ratio !== null && v.ratio !== undefined) buckets[idx].ratios.push(v.ratio);
    });
    return buckets.map(function(b){ return { label:b.label, count:b.count, medianRatio: median(b.ratios) }; });
  }
  function computeHourStats(){
    var buckets = [];
    for (var h=0; h<24; h++) buckets.push({ label:String(h), count:0, ratios:[] });
    VIDEOS.forEach(function(v){
      if (!v.publishDate) return;
      var d = new Date(v.publishDate);
      if (isNaN(d.getTime())) return;
      var h2 = kzShift(d).getUTCHours();
      buckets[h2].count++;
      if (v.ratio !== null && v.ratio !== undefined) buckets[h2].ratios.push(v.ratio);
    });
    return buckets.map(function(b){ return { label:b.label, count:b.count, medianRatio: median(b.ratios) }; });
  }
  function dowHourColor(d, v){
    if (v === null || v === undefined) return 'var(--border-strong)';
    return v >= 1 ? 'var(--success)' : 'var(--warn)';
  }
  function dowHourTooltipRows(d){
    return [['Медиана ratio', d.medianRatio !== null ? d.medianRatio.toFixed(2)+'×' : '—'], ['Видео опубликовано', fmtNum(d.count)]];
  }

  function renderDowHourCharts(){
    renderBars(document.getElementById('dowChart'), computeDowStats(), {
      color: dowHourColor,
      tooltipRows: dowHourTooltipRows,
      titleOf: function(d){ return d.label; }
    });
    renderBars(document.getElementById('hourChart'), computeHourStats(), {
      color: dowHourColor,
      labelEvery: 3,
      tooltipRows: dowHourTooltipRows,
      titleOf: function(d){ return d.label + ':00 (KZ)'; }
    });
  }

  // ---- 2. Длительность видео vs эффективность ----
  var DURATION_BUCKETS = [[0,5,'<5 мин'], [5,10,'5–10'], [10,20,'10–20'], [20,40,'20–40'], [40,60,'40–60'], [60,Infinity,'60+']];

  function computeDurationStats(){
    var buckets = DURATION_BUCKETS.map(function(b){ return { label:b[2], min:b[0], max:b[1], count:0, ratios:[] }; });
    VIDEOS.forEach(function(v){
      if (!v.duration_sec) return;
      var m = v.duration_sec/60;
      for (var i=0; i<buckets.length; i++){
        if (m >= buckets[i].min && m < buckets[i].max) {
          buckets[i].count++;
          if (v.ratio !== null && v.ratio !== undefined) buckets[i].ratios.push(v.ratio);
          break;
        }
      }
    });
    return buckets.map(function(b){ return { label:b.label, count:b.count, medianRatio: median(b.ratios) }; });
  }

  function renderDurationChart(){
    renderBars(document.getElementById('durationChart'), computeDurationStats(), {
      color: dowHourColor,
      tooltipRows: dowHourTooltipRows,
      titleOf: function(d){ return d.label + ' мин'; }
    });
  }

  // ---- 3. Тема × Формат ----
  function computeThemeFormatMatrix(){
    var themeIds = Object.keys(THEMES).map(Number).sort(function(a,b){ return a-b; });
    var cells = {};
    VIDEOS.forEach(function(v){
      if (v.theme_id === null || v.theme_id === undefined || !v.format) return;
      var key = v.theme_id + '|' + v.format;
      if (!cells[key]) cells[key] = { count:0, ratios: [], byChannel: {} };
      cells[key].count++;
      if (!cells[key].byChannel[v.cid]) cells[key].byChannel[v.cid] = { name: v.channel_name, count: 0 };
      cells[key].byChannel[v.cid].count++;
      if (v.ratio !== null && v.ratio !== undefined) cells[key].ratios.push(v.ratio);
    });
    var matrix = {};
    Object.keys(cells).forEach(function(key){
      var c = cells[key];
      var channelIds = Object.keys(c.byChannel);
      var topChannel = null, topCount = 0;
      channelIds.forEach(function(cid){
        var e = c.byChannel[cid];
        if (e.count > topCount) { topCount = e.count; topChannel = e.name; }
      });
      var topShare = c.count ? topCount / c.count : 0;
      matrix[key] = {
        count: c.count, medianRatio: median(c.ratios),
        channelCount: channelIds.length,
        topChannel: topChannel, topChannelCount: topCount, topChannelShare: topShare
      };
    });
    return { themeIds: themeIds, formats: FORMATS, matrix: matrix };
  }
  function heatColor(v, lo, hi){
    var t = hi > lo ? (v - lo) / (hi - lo) : 0.5;
    t = Math.max(0, Math.min(1, t));
    var alpha = 0.08 + t*0.55;
    return 'rgba(37,99,235,' + alpha.toFixed(2) + ')';
  }

  function renderThemeFormatMatrix(){
    var data = computeThemeFormatMatrix();
    var validMedians = Object.keys(data.matrix)
      .filter(function(k){ return data.matrix[k].count >= 2; })
      .map(function(k){ return data.matrix[k].medianRatio; });
    var lo = validMedians.length ? Math.min.apply(null, validMedians) : 0;
    var hi = validMedians.length ? Math.max.apply(null, validMedians) : 1;

    var html = '<table class="heatmap-table"><thead><tr><th class="row-head">Тема \\ Формат</th>';
    data.formats.forEach(function(f){
      html += '<th class="col-head" title="'+escapeHtml(f)+'">'+escapeHtml(f.length>10 ? f.slice(0,9)+'…' : f)+'</th>';
    });
    html += '</tr></thead><tbody>';
    data.themeIds.forEach(function(tid){
      html += '<tr><th class="row-head">'+escapeHtml(themeName(tid))+'</th>';
      data.formats.forEach(function(f){
        var cell = data.matrix[tid+'|'+f];
        if (cell && cell.count >= 2) {
          var skewed = cell.topChannelShare >= 0.5 && cell.count >= 4;
          var title = escapeHtml(themeName(tid))+' × '+escapeHtml(f)+': медиана '+cell.medianRatio.toFixed(2)+'×, '+cell.count+' видео, '+cell.channelCount+' '+(cell.channelCount===1?'канал':'канала(ов)');
          if (skewed) title += ' — из них '+cell.topChannelCount+' ('+Math.round(cell.topChannelShare*100)+'%) от одного канала: '+escapeHtml(cell.topChannel);
          html += '<td class="heatmap-cell'+(skewed?' heatmap-skewed':'')+'" data-theme="'+tid+'" data-format="'+escapeHtml(f)+'" style="background:'+heatColor(cell.medianRatio, lo, hi)+'" title="'+title+'">'+cell.medianRatio.toFixed(1)+'×'+(skewed?' ⚠':'')+'</td>';
        } else if (cell) {
          html += '<td class="heatmap-cell empty" title="1 видео — недостаточно для медианы">·</td>';
        } else {
          html += '<td class="heatmap-cell empty"></td>';
        }
      });
      html += '</tr>';
    });
    html += '</tbody></table>';

    var wrap = document.getElementById('themeFormatMatrixWrap');
    wrap.innerHTML = html;
    wrap.querySelectorAll('td.heatmap-cell[data-theme]').forEach(function(td){
      td.addEventListener('click', function(){ filterVideosByThemeAndFormat(td.dataset.theme, td.dataset.format); });
    });
  }

  // ---- 4. Топ героев ----
  function computeTopHeroes(){
    var heroes = {};
    VIDEOS.forEach(function(v){
      if (!v.hero) return;
      if (!heroes[v.hero]) heroes[v.hero] = { hero: v.hero, count:0, views: [], channels: new Set() };
      var h = heroes[v.hero];
      h.count++;
      h.views.push(v.views || 0);
      h.channels.add(v.cid);
    });
    var arr = Object.keys(heroes).map(function(k){
      var h = heroes[k];
      return { hero: h.hero, count: h.count, medianViews: median(h.views), channelCount: h.channels.size };
    }).filter(function(h){ return h.count >= 2; });
    arr.sort(function(a,b){ return b.count - a.count || b.medianViews - a.medianViews; });
    return arr.slice(0, 20);
  }

  function renderHeroesTable(){
    var heroes = computeTopHeroes();
    var wrap = document.getElementById('heroesTableWrap');
    if (!heroes.length) { wrap.innerHTML = '<div class="empty-note">Недостаточно данных.</div>'; return; }
    var html = '<table><thead><tr><th>#</th><th>Герой</th><th class="num">Видео</th><th class="num">Медиана просмотров</th><th class="num">Каналов</th></tr></thead><tbody>';
    heroes.forEach(function(h, i){
      html += '<tr class="clickable" data-hero="'+escapeHtml(h.hero)+'">' +
        '<td class="muted">'+(i+1)+'</td>' +
        '<td>'+escapeHtml(h.hero)+'</td>' +
        '<td class="num">'+fmtNum(h.count)+'</td>' +
        '<td class="num">'+fmtNum(h.medianViews)+'</td>' +
        '<td class="num">'+fmtNum(h.channelCount)+'</td>' +
      '</tr>';
    });
    html += '</tbody></table>';
    wrap.innerHTML = html;
    wrap.querySelectorAll('tr[data-hero]').forEach(function(tr){
      tr.addEventListener('click', function(){ filterVideosByHero(tr.dataset.hero); });
    });
  }

  // ---- 5. Shorts vs long-form по каналам ----
  function computeShortsVsLongStats(){
    return CHANNELS.filter(function(c){ return c.median_views && c.shorts_median_views; })
      .map(function(c){
        return {
          id: c.id, name: c.name,
          color: c.role === 'sample' ? 'hsl(221 74% 52%)' : 'hsl(220 9% 55%)',
          channelCount: c.median_views,
          medianRatio: c.shorts_median_views,
          videoCount: c.subs || 1,
          sampleSize: null
        };
      });
  }

  function renderShortsScatter(){
    renderBubbleMap({
      svgId: 'shortsChart', noDataId: 'shortsNoData',
      stats: computeShortsVsLongStats(),
      xLabel: 'Медиана просмотров long-form',
      yLabel: 'Медиана просмотров Shorts',
      xTickFormat: fmtShort, yTickFormat: fmtShort,
      diagonal: true,
      showLabels: false,
      tooltipRows: function(s){
        return [
          ['Медиана long-form', fmtNum(s.channelCount)],
          ['Медиана Shorts', fmtNum(s.medianRatio)],
          ['Подписчики', fmtNum(s.videoCount)]
        ];
      },
      onClick: function(id){ openChannelCard(id); },
      emptyMessage: 'Недостаточно данных о Shorts'
    });
  }

  // ---- 6. Топ каналов (leaderboard с выбором метрики) ----
  var LEADERBOARD_METRICS = [
    { key:'median_views', label:'Медиана просмотров', format:function(v){ return fmtNum(v); } },
    { key:'subs', label:'Подписчики', format:function(v){ return fmtNum(v); } },
    { key:'median_engagement_rate', label:'Engagement', format:function(v){ return fmtPct(v,2); } },
    { key:'frequency_per_week', label:'Частота публикаций/нед', format:function(v){ return fmtNum(v,2); } },
    { key:'median_to_subs_ratio', label:'Медиана/подписчики', format:function(v){ return fmtPct(v,2); } }
  ];

  (function initLeaderboard(){
    var sel = document.getElementById('leaderboardMetric');
    sel.innerHTML = LEADERBOARD_METRICS.map(function(m){ return '<option value="'+m.key+'">'+escapeHtml(m.label)+'</option>'; }).join('');
    sel.addEventListener('change', function(){ renderChannelLeaderboard(sel.value); });
  })();

  function renderChannelLeaderboard(metricKey){
    metricKey = metricKey || document.getElementById('leaderboardMetric').value;
    var metric = LEADERBOARD_METRICS.filter(function(m){ return m.key === metricKey; })[0] || LEADERBOARD_METRICS[0];
    var active = CHANNELS.filter(function(c){ return !c.excluded; });
    var rows = active.filter(function(c){ return c[metric.key] !== null && c[metric.key] !== undefined; })
      .sort(function(a,b){ return b[metric.key] - a[metric.key]; })
      .slice(0, 15);
    var maxV = rows.length ? rows[0][metric.key] : 1;
    var wrap = document.getElementById('leaderboardWrap');
    wrap.innerHTML = rows.map(function(c){
      var pct = maxV > 0 ? Math.max(2, Math.round((c[metric.key]/maxV)*100)) : 0;
      return '<div class="themebar-row lb-row" data-cid="'+c.id+'">' +
        '<div class="tb-label" title="'+escapeHtml(c.name)+'">'+escapeHtml(c.name)+'</div>' +
        '<div class="tb-track"><div class="tb-fill" style="width:'+pct+'%;background:'+(c.role==='sample' ? 'var(--accent)' : 'var(--text-faint)')+'"></div></div>' +
        '<div class="tb-count">'+metric.format(c[metric.key])+'</div>' +
      '</div>';
    }).join('') || '<div class="empty-note">Недостаточно данных.</div>';
    document.getElementById('leaderboardCount').textContent = 'Топ ' + rows.length + ' из ' + active.length;
    wrap.querySelectorAll('.lb-row').forEach(function(row){
      row.addEventListener('click', function(){ openChannelCard(row.dataset.cid); });
    });
  }

  // ====================================================================
  // Карточка канала
  // ====================================================================
  var overlayEl = document.getElementById('channelCardOverlay');
  var cardBodyEl = document.getElementById('channelCardBody');
  document.getElementById('channelCardClose').addEventListener('click', closeChannelCard);
  overlayEl.addEventListener('click', function(e){ if (e.target === overlayEl) closeChannelCard(); });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape') closeChannelCard(); });

  function closeChannelCard(){ overlayEl.hidden = true; }

  function openChannelCard(cid){
    var c = channelsById[cid];
    if (!c) return;
    var vids = (videosByChannel[cid] || []).slice();

    var html = '';
    html += '<div class="cc-head"><h2>' + escapeHtml(c.name) + '</h2>' +
      '<span class="badge role-' + c.role + '">' + (c.role === 'sample' ? 'sample' : 'ориентир') + '</span>' +
      '<span class="badge ' + (c.excluded ? 'status-excluded' : 'status-active') + '">' + (c.excluded ? 'исключён' : 'активен') + '</span>' +
      '</div>';
    html += '<div class="cc-sub">' +
      (c.category ? escapeHtml(c.category) + ' · ' : '') + (c.bm_format ? escapeHtml(c.bm_format) + ' · ' : '') +
      (c.faceless ? 'faceless · ' : '') + (c.monetized ? 'монетизирован · ' : 'не монетизирован · ') +
      '<a href="' + youtubeChannelUrl(c.channel_id) + '" target="_blank" rel="noopener">канал на YouTube ↗</a>' +
      '</div>';

    html += '<div class="cc-stats">' +
      stat('Подписчики', fmtNum(c.subs)) +
      stat('Медиана просмотров', fmtNum(c.median_views)) +
      stat('Медиана/подп.', fmtPct(c.median_to_subs_ratio, 2)) +
      stat('Видео за период', fmtNum(c.video_count_period)) +
      stat('Частота, вид/нед', fmtNum(c.frequency_per_week, 2)) +
      stat('Engagement', fmtPct(c.median_engagement_rate, 2)) +
      stat('Ср. длительность', fmtDuration(c.avg_duration_sec)) +
      (c.shorts_count_period ? stat('Shorts за период', fmtNum(c.shorts_count_period)) : '') +
      (c.shorts_median_views ? stat('Медиана Shorts', fmtNum(c.shorts_median_views)) : '') +
    '</div>';

    if (!c.has_video_data || !vids.length) {
      html += '<div class="empty-note">Детальные данные по отдельным видео для этого канала недоступны' + (c.exclude_reason ? ' (' + escapeHtml(c.exclude_reason) + ')' : '') + '.</div>';
    } else {
      var byViewsDesc = vids.slice().sort(function(a,b){ return (b.views||0) - (a.views||0); });
      var top5 = byViewsDesc.slice(0, 5);
      var bottom5 = byViewsDesc.slice(-5).reverse();

      html += '<div class="cc-section-title">Топ и антитоп по просмотрам</div>';
      html += '<div class="cc-cols">' +
        '<div><div class="muted" style="margin-bottom:4px;font-size:11px;">Топ‑5</div>' + videoMiniList(top5) + '</div>' +
        '<div><div class="muted" style="margin-bottom:4px;font-size:11px;">Антитоп‑5</div>' + videoMiniList(bottom5) + '</div>' +
      '</div>';

      var themeCounts = {};
      vids.forEach(function(v){
        if (v.theme_id === null || v.theme_id === undefined) return;
        themeCounts[v.theme_id] = (themeCounts[v.theme_id] || 0) + 1;
      });
      var themeRows = Object.keys(themeCounts).map(function(id){ return { id: Number(id), count: themeCounts[id] }; })
        .sort(function(a,b){ return b.count - a.count; });
      if (themeRows.length) {
        var maxCount = themeRows[0].count;
        html += '<div class="cc-section-title">Разбивка по темам</div>';
        html += themeRows.map(function(t){
          var pct = Math.round((t.count / maxCount) * 100);
          return '<div class="themebar-row">' +
            '<div class="tb-label">' + escapeHtml(themeName(t.id)) + '</div>' +
            '<div class="tb-track"><div class="tb-fill" style="width:' + pct + '%;background:' + themeColor(t.id) + '"></div></div>' +
            '<div class="tb-count">' + t.count + '</div>' +
          '</div>';
        }).join('');
      }

      html += '<div class="cc-footer"><button class="btn" id="ccJumpVideos">Смотреть все видео канала в таблице →</button></div>';
    }

    cardBodyEl.innerHTML = html;
    overlayEl.hidden = false;

    var jumpBtn = document.getElementById('ccJumpVideos');
    if (jumpBtn) jumpBtn.addEventListener('click', function(){ filterVideosByChannel(cid); });
  }

  function stat(label, value){
    return '<div class="stat"><div class="lbl">' + escapeHtml(label) + '</div><div class="val">' + value + '</div></div>';
  }
  function videoMiniList(list){
    if (!list.length) return '<div class="empty-note">нет данных</div>';
    return '<ul class="mini-list">' + list.map(function(v){
      return '<li><a href="' + youtubeWatchUrl(v.video_id) + '" target="_blank" rel="noopener" title="' + escapeHtml(v.title) + '">' + escapeHtml(v.title) + '</a><span>' + fmtNum(v.views) + '</span></li>';
    }).join('') + '</ul>';
  }

  // ====================================================================
  // TAB "Отчёт" — маршрутизация между наборами/вкладками через #хэш,
  // мини-графики в карточках, кнопка "Назад к отчёту".
  // ====================================================================
  var REPORT = window.__REPORT_DATA__ || {};
  var REPORT_TEXTS = window.__REPORT_TEXTS__ || {};

  // Подставляет текст карточек отчёта (кикер/тезис/пояснение/сноска,
  // заголовки секций, вступление) из report_texts.js в разметку. Сама
  // разметка (id карточек, кнопки, графики, цифры в rc-stat) остаётся в
  // index.html — меняется только этот текстовый слой, поэтому чтобы
  // поправить формулировку, достаточно отредактировать report_texts.js
  // и обновить страницу — пересборка дашборда не нужна.
  function applyReportTexts(){
    var root = document.getElementById('reportRoot');
    if (!root) return;

    if (REPORT_TEXTS.intro) {
      var introEl = document.getElementById('rcIntro');
      if (introEl) introEl.innerHTML = REPORT_TEXTS.intro;
    }

    var sections = REPORT_TEXTS.sections || {};
    Object.keys(sections).forEach(function(key){
      var secEl = document.getElementById('rc-sec-' + key);
      if (!secEl) return;
      var s = sections[key] || {};
      var titleEl = secEl.querySelector('.rc-section-title');
      var subEl = secEl.querySelector('.rc-section-sub');
      if (titleEl && s.title) titleEl.innerHTML = s.title;
      if (subEl) { if (s.sub) subEl.innerHTML = s.sub; else subEl.style.display = 'none'; }
    });

    var cards = REPORT_TEXTS.cards || {};
    Object.keys(cards).forEach(function(id){
      var cardEl = document.getElementById(id);
      if (!cardEl) return;
      var c = cards[id] || {};
      var kickerEl = cardEl.querySelector('.rc-kicker');
      var thesisEl = cardEl.querySelector('.rc-thesis');
      var explainEl = cardEl.querySelector('.rc-explain');
      var noteEl = cardEl.querySelector('.rc-note');
      var actionEl = cardEl.querySelector('.rc-action');
      if (kickerEl && c.kicker) kickerEl.innerHTML = c.kicker;
      if (thesisEl && c.thesis) thesisEl.innerHTML = c.thesis;
      if (explainEl && c.explain) explainEl.innerHTML = c.explain;
      if (noteEl && c.note) noteEl.innerHTML = c.note;
      if (actionEl && c.action) {
        var isDont = c.action.type === 'dont';
        actionEl.classList.toggle('rc-action-dont', isDont);
        actionEl.innerHTML = '<span class="rc-action-label">Что делать?</span>' +
          (isDont ? '⨯ ' : '→ ') + escapeHtml(c.action.text);
      }
    });
  }

  // Заполняет ряды с цифрами (rc-stat-row) в карточках отчёта из
  // REPORT.card_stats — раньше эти числа были вписаны в index.html вручную
  // и расходились с report_data.js при пересборке; теперь пересборка сама
  // проставляет их сюда при каждой загрузке страницы.
  function applyReportStats(){
    var cardStats = (REPORT && REPORT.card_stats) || {};
    Object.keys(cardStats).forEach(function(id){
      var cardEl = document.getElementById(id);
      if (!cardEl) return;
      var row = cardEl.querySelector('.rc-stat-row');
      if (!row) return;
      row.innerHTML = '';
      (cardStats[id] || []).forEach(function(s){
        var stat = document.createElement('div');
        stat.className = 'rc-stat';
        var val = document.createElement('div');
        val.className = 'rc-stat-val' + (s.cls ? ' ' + s.cls : '');
        val.textContent = s.val;
        var lbl = document.createElement('div');
        lbl.className = 'rc-stat-lbl';
        lbl.textContent = s.lbl;
        stat.appendChild(val);
        stat.appendChild(lbl);
        row.appendChild(stat);
      });
    });
  }

  // Вставляет в карточки отчёта до 3 кликабельных примеров видео (превью +
  // тайтл + просмотры), которые подтверждают тезис карточки на конкретном
  // контенте — «типичное» (медиана по просмотрам) и два «яркий пример»
  // (максимум просмотров, второй — нарочно с другого канала, чтобы
  // показать, что паттерн не завязан на один канал); при малом числе
  // видео часть категорий схлопывается. Данные — REPORT.examples из
  // report_data.js, считает scripts/build_report_data.py (см.
  // CARD_FILTERS/pick_examples там). Ссылка ведёт сразу на YouTube;
  // кнопка «Смотреть эти видео в таблице →» рядом остаётся как
  // «показать остальное».
  function renderReportExamples(){
    var examples = REPORT.examples || {};
    Object.keys(examples).forEach(function(cardId){
      var list = examples[cardId];
      if (!list || !list.length) return;
      var cardEl = document.getElementById(cardId);
      if (!cardEl) return;
      var dataEl = cardEl.querySelector('.rc-data');
      if (!dataEl) return;

      var wrap = document.createElement('div');
      wrap.className = 'rc-examples';

      list.forEach(function(v){
        if (!v.video_id) return;
        var a = document.createElement('a');
        a.className = 'rc-example';
        a.href = youtubeWatchUrl(v.video_id);
        a.target = '_blank';
        a.rel = 'noopener';
        a.title = v.title || '';

        var img = document.createElement('img');
        img.className = 'rc-example-thumb';
        img.loading = 'lazy';
        img.alt = '';
        img.src = 'https://i.ytimg.com/vi/' + encodeURIComponent(v.video_id) + '/mqdefault.jpg';

        var body = document.createElement('div');
        body.className = 'rc-example-body';

        var TAG_LABELS = { median: 'типичное', standout: 'яркий пример' };
        var tag = document.createElement('span');
        tag.className = 'rc-example-tag ' + (v.kind === 'standout' ? 'standout' : 'muted');
        tag.textContent = TAG_LABELS[v.kind] || v.kind;

        var title = document.createElement('div');
        title.className = 'rc-example-title';
        title.textContent = v.title || '';

        var meta = document.createElement('div');
        meta.className = 'rc-example-meta';
        meta.textContent = fmtNum(v.views) + ' просм.' + (v.channel ? ' · ' + v.channel : '');

        body.appendChild(tag);
        body.appendChild(title);
        body.appendChild(meta);
        a.appendChild(img);
        a.appendChild(body);
        wrap.appendChild(a);
      });

      if (!wrap.children.length) return;
      var btn = dataEl.querySelector('button');
      if (btn) dataEl.insertBefore(wrap, btn); else dataEl.appendChild(wrap);
    });
  }

  function currentHashParts(){
    var raw = (location.hash || '').replace(/^#/, '');
    if (!raw) return [];
    return raw.split('|').map(function(s){
      try { return decodeURIComponent(s); } catch(e){ return s; }
    });
  }

  // Переход к отчёту/таблице видео. Если целевой набор данных отличается от
  // текущего — полная перезагрузка (как и у кнопок наборов в шапке), потому
  // что тяжёлые data_<key>.js грузятся только для активного набора. Если
  // набор тот же — просто меняем хэш, дальше им займётся hashchange.
  function navigateTo(ds, rest){
    var newHash = ds + (rest && rest.length ? '|' + rest.map(encodeURIComponent).join('|') : '');
    if (ds !== window.__ACTIVE_DATASET__) {
      location.hash = newHash;
      location.reload();
      return;
    }
    if (('#' + newHash) === location.hash) { applyRoute(rest || []); }
    else { location.hash = newHash; }
  }

  // Мостик для кнопки «Отчёт» и клика по уже загруженному набору в шапке
  // (они живут в отдельном инлайн-скрипте index.html, который выполняется
  // раньше этого файла и не имеет доступа к замыканию app.js) — переход
  // без перезагрузки тяжёлого data_<key>.js, когда набор не меняется.
  window.__goToReport = function(){ navigateTo(window.__ACTIVE_DATASET__, ['report']); };
  window.__goToDatasetTab = function(name){ navigateTo(window.__ACTIVE_DATASET__, ['tab', name || 'channels']); };

  function setBackToReport(cardId){
    var wrap = document.getElementById('backToReportWrap');
    if (!wrap) return;
    if (!cardId) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = '<button class="btn" id="backToReportBtn">← Назад к отчёту</button>';
    var btn = document.getElementById('backToReportBtn');
    if (btn) btn.addEventListener('click', function(){ navigateTo(window.__ACTIVE_DATASET__, ['report', cardId]); });
  }

  function scrollToReportCard(cardId){
    if (!cardId) { window.scrollTo({top:0, behavior:'smooth'}); return; }
    var el = document.getElementById(cardId);
    if (!el) return;
    el.scrollIntoView({behavior:'smooth', block:'start'});
    el.classList.add('rc-flash');
    setTimeout(function(){ el.classList.remove('rc-flash'); }, 1600);
  }

  // Разбирает "хвост" хэша (всё после набора данных) и приводит страницу в нужное состояние.
  function applyRoute(rest){
    rest = rest || [];
    if (!rest.length) return;
    var kind = rest[0];
    if (kind === 'report') {
      switchTab('report');
      scrollToReportCard(rest[1]);
      return;
    }
    if (kind === 'tab') {
      switchTab(rest[1] || 'channels');
      return;
    }
    if (kind === 'videos') {
      var sub = rest[1];
      var fromIdx = rest.indexOf('from');
      var fromCard = fromIdx >= 0 ? rest[fromIdx + 1] : null;
      if (sub === 'theme') filterVideosByTheme(rest[2]);
      else if (sub === 'format') filterVideosByFormat(rest[2]);
      else if (sub === 'themeformat') filterVideosByThemeAndFormat(rest[2], rest[3]);
      else if (sub === 'hero') filterVideosByHero(rest[2]);
      else if (sub === 'search') filterVideosBySearch(rest[2]);
      if (fromCard) setBackToReport(fromCard);
      return;
    }
  }

  window.addEventListener('hashchange', function(){
    var parts = currentHashParts();
    var ds = parts[0] || '';
    if (ds && ds !== window.__ACTIVE_DATASET__) { location.reload(); return; }
    applyRoute(parts.slice(1));
  });

  // клики по карточкам отчёта: "смотреть таблицу" (может сменить набор) и
  // "см. выше" (скролл к другой карточке внутри отчёта, набор не трогаем)
  var reportRootEl = document.getElementById('reportRoot');
  if (reportRootEl) {
    reportRootEl.addEventListener('click', function(e){
      var drill = e.target.closest ? e.target.closest('.report-drill') : null;
      if (drill) {
        navigateTo(drill.dataset.ds, drill.dataset.route.split('|'));
        return;
      }
      var jump = e.target.closest ? e.target.closest('.report-jump') : null;
      if (jump) { scrollToReportCard(jump.dataset.jump); return; }
    });
  }
  var rcTocEl = document.getElementById('rcToc');
  if (rcTocEl) {
    rcTocEl.addEventListener('click', function(e){
      var a = e.target.closest ? e.target.closest('[data-jump]') : null;
      if (a) scrollToReportCard(a.dataset.jump);
    });
  }

  // -------- мини-графики в карточках отчёта (данные из report_data.js, лёгкие ~KB на набор) --------
  function renderTwoBar(containerEl, a, b, labelA, labelB){
    if (!containerEl || a === undefined || b === undefined) return;
    var maxV = Math.max(a, b, 1);
    var maxPx = 46;
    function h(v){ return Math.max(3, Math.round((v / maxV) * maxPx)); }
    containerEl.innerHTML =
      '<div class="tb-col"><div class="tb-num">' + fmtNum(a) + '</div><div class="tb-fill" style="height:' + h(a) + 'px"></div><div class="tb-cap">' + escapeHtml(labelA) + '</div></div>' +
      '<div class="tb-col"><div class="tb-num">' + fmtNum(b) + '</div><div class="tb-fill tb-fill-2" style="height:' + h(b) + 'px"></div><div class="tb-cap">' + escapeHtml(labelB) + '</div></div>';
  }

  function renderReportCharts(){
    if (!REPORT || !REPORT.politics) return;

    if (REPORT.politics.month_people) {
      renderTwoBar(document.getElementById('rcChart-politics-people'),
        REPORT.politics.month_people.first_half, REPORT.politics.month_people.second_half,
        'первая половина окна', 'вторая половина');
    }
    if (REPORT.general && REPORT.general.month_truecrime) {
      renderTwoBar(document.getElementById('rcChart-general-truecrime'),
        REPORT.general.month_truecrime.first_half, REPORT.general.month_truecrime.second_half,
        'было', 'стало');
    }
    if (REPORT.general && REPORT.general.month_auto) {
      renderTwoBar(document.getElementById('rcChart-general-auto'),
        REPORT.general.month_auto.first_half, REPORT.general.month_auto.second_half,
        'было', 'стало');
    }
    if (REPORT.travel && REPORT.travel.month_central_asia) {
      renderTwoBar(document.getElementById('rcChart-travel-central-asia'),
        REPORT.travel.month_central_asia.first_half, REPORT.travel.month_central_asia.second_half,
        'было', 'стало');
    }

    var durEl = document.getElementById('rcChart-politics-duration');
    if (durEl && REPORT.politics.duration) {
      var durData = Object.keys(REPORT.politics.duration)
        .filter(function(k){ return REPORT.politics.duration[k].video_count > 0; })
        .map(function(k){ return { label: k, medianRatio: REPORT.politics.duration[k].demand_median_ratio, count: REPORT.politics.duration[k].video_count }; });
      renderBars(durEl, durData, {
        value: function(d){ return d.medianRatio; },
        minValue: 0.7, maxValue: 1.5,
        color: function(d, v){ return v >= 1.1 ? 'var(--success)' : (v < 0.95 ? 'var(--danger)' : 'var(--accent)'); },
        tooltipRows: function(d){ return [['Видео', String(d.count)], ['Медиана ratio', d.medianRatio.toFixed(2) + '×']]; },
        titleOf: function(d){ return d.label; }
      });
    }

    var freqEl = document.getElementById('rcChart-cross-frequency');
    if (freqEl && REPORT.cross && REPORT.cross.freq_corr_subsratio) {
      var freqLabels = { kz: 'Казахстан', general: 'Общий', politics: 'Политика', travel: 'Тревел' };
      var freqData = Object.keys(freqLabels).map(function(k){
        return { label: freqLabels[k], r: REPORT.cross.freq_corr_subsratio[k] };
      }).filter(function(d){ return d.r !== undefined && d.r !== null; });
      renderBars(freqEl, freqData, {
        value: function(d){ return -d.r; },
        minValue: 0, maxValue: 0.3,
        tooltipRows: function(d){ return [['r (частота × просмотры/подп.)', d.r.toFixed(2)]]; },
        titleOf: function(d){ return d.label; }
      });
    }
  }

  // -------------------- init --------------------
  renderChannelsTable();
  renderVideosTable();
  applyReportTexts();
  applyReportStats();
  renderReportCharts();
  renderReportExamples();
  updateBoundedTableHeights();
  // Базовое состояние — отчёт (совпадает со статическим #tab-report.active
  // в разметке); switchTab тут же прячет ряд вкладок набора и подсвечивает
  // кнопку «Отчёт». Если в хэше был реальный маршрут — applyRoute переключит
  // куда нужно поверх этого базового состояния.
  switchTab('report');
  applyRoute(window.__ROUTE_REST__ || []);

})();
