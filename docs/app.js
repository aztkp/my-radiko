// Media Log Web App
(function() {
  'use strict';

  const GITHUB_REPO = 'aztkp/media-log';
  const STORAGE_KEY = 'media_log_token';

  const MEDIA_EMOJI = {
    radio: '📻', tv: '📺', movie: '🎬', streaming: '🎧',
    anime: '🎌', drama: '📺', game: '🎮', book: '📖', manga: '📚', youtube: '▶️'
  };

  const MEDIA_NAMES = {
    movie: '映画', anime: 'アニメ', drama: 'ドラマ', game: 'ゲーム',
    book: '本', manga: '漫画', youtube: 'YouTube', radio: 'ラジオ', tv: 'テレビ'
  };

  const STATUS_EMOJI = { want: '👀', watching: '📺', done: '✓', hold: '⏸' };
  const DAY_NAMES = { mon: '月', tue: '火', wed: '水', thu: '木', fri: '金', sat: '土', sun: '日' };
  const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

  let scheduleData = null;
  let scheduleSha = null;
  let currentBacklogFilter = 'all';
  let currentAllFilter = 'all';

  // Utils
  function b64decode(str) {
    const binary = atob(str.replace(/\n/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }

  function b64encode(str) {
    return btoa(String.fromCharCode(...new TextEncoder().encode(str)));
  }

  function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = 'toast ' + type + ' show';
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

  function getToken() { return localStorage.getItem(STORAGE_KEY) || ''; }
  function setToken(t) { localStorage.setItem(STORAGE_KEY, t); }

  function formatDate(d) {
    if (!d) return '';
    const date = new Date(d);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  function getTodayDayKey() {
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    return days[new Date().getDay()];
  }

  // API
  async function fetchData() {
    const token = getToken();
    if (!token) {
      document.getElementById('settings-modal').classList.add('show');
      return null;
    }

    try {
      const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/schedule.json`, {
        headers: { 'Authorization': `token ${token}` }
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      scheduleSha = data.sha;
      scheduleData = JSON.parse(b64decode(data.content));
      if (!scheduleData.watchlist) scheduleData.watchlist = [];
      if (!scheduleData.weekly) scheduleData.weekly = { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };
      return scheduleData;
    } catch (e) {
      showToast('データの読み込みに失敗しました', 'error');
      return null;
    }
  }

  async function saveData() {
    const token = getToken();
    if (!token || !scheduleData) return false;

    try {
      const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/schedule.json`, {
        method: 'PUT',
        headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: '📊 Update media log',
          content: b64encode(JSON.stringify(scheduleData, null, 2)),
          sha: scheduleSha
        })
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      scheduleSha = data.content.sha;
      showToast('保存しました');
      return true;
    } catch (e) {
      showToast('保存に失敗しました', 'error');
      return false;
    }
  }

  // Weekly Calendar
  function renderWeeklyCalendar() {
    const container = document.getElementById('weekly-calendar');
    if (!container) return;
    const today = getTodayDayKey();

    let html = '';
    DAY_ORDER.forEach(day => {
      const shows = scheduleData?.weekly[day] || [];
      const isToday = day === today;

      html += `<div class="day-card ${isToday ? 'today' : ''}">
        <div class="day-card-header">${DAY_NAMES[day]}${isToday ? ' (今日)' : ''}</div>
        ${shows.length === 0 ? '<div class="day-empty">-</div>' : ''}
        ${shows.map(s => `
          <div class="day-show">
            <span>${MEDIA_EMOJI[s.type] || '📻'}</span>
            <span class="day-show-name">${s.name}</span>
          </div>
        `).join('')}
      </div>`;
    });

    container.innerHTML = html;
  }

  // Stats
  function renderStats() {
    if (!scheduleData) return;

    const watchlist = scheduleData.watchlist || [];
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const yearDone = watchlist.filter(i => i.status === 'done' && i.completedAt && new Date(i.completedAt).getFullYear() === year);
    const monthDone = yearDone.filter(i => new Date(i.completedAt).getMonth() === month);
    const backlog = watchlist.filter(i => i.status === 'want' || i.status === 'watching');

    const statsRow = document.getElementById('stats-row');
    if (statsRow) {
      statsRow.innerHTML = `
        <div class="stat-card">
          <div class="stat-value">${yearDone.length}</div>
          <div class="stat-label">${year}年の完了</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${monthDone.length}</div>
          <div class="stat-label">${month + 1}月の完了</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${backlog.length}</div>
          <div class="stat-label">バックログ</div>
        </div>
      `;
    }

    const historyStats = document.getElementById('history-stats');
    if (historyStats) {
      historyStats.innerHTML = `
        <div class="stat-card">
          <div class="stat-value">${yearDone.length}</div>
          <div class="stat-label">${year}年の完了</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${monthDone.length}</div>
          <div class="stat-label">${month + 1}月の完了</div>
        </div>
      `;
    }
  }

  // Backlog
  function renderBacklog() {
    if (!scheduleData) return;

    const container = document.getElementById('backlog-content');
    if (!container) return;

    let items = scheduleData.watchlist
      .map((item, idx) => ({ ...item, idx }))
      .filter(i => i.status === 'want' || i.status === 'watching');

    if (currentBacklogFilter !== 'all') {
      items = items.filter(i => i.type === currentBacklogFilter);
    }

    if (items.length === 0) {
      container.innerHTML = '<div class="empty">バックログは空です</div>';
      return;
    }

    container.innerHTML = items.map(item => `
      <div class="backlog-item">
        <button class="backlog-item-status" data-idx="${item.idx}" title="ステータス変更">
          ${STATUS_EMOJI[item.status] || '👀'}
        </button>
        <div class="backlog-item-content">
          <div class="backlog-item-title">${item.title}</div>
          <div class="backlog-item-meta">${MEDIA_EMOJI[item.type]} ${MEDIA_NAMES[item.type] || ''}</div>
        </div>
        <div class="backlog-item-actions">
          <button class="btn btn-sm" data-idx="${item.idx}" data-action="edit">✏️</button>
          <button class="btn btn-sm" data-idx="${item.idx}" data-action="delete">×</button>
        </div>
      </div>
    `).join('');

    attachItemEvents(container);
  }

  function attachItemEvents(container) {
    container.querySelectorAll('.backlog-item-status').forEach(btn => {
      btn.addEventListener('click', () => cycleStatus(parseInt(btn.dataset.idx)));
    });

    container.querySelectorAll('[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', () => openEditModal(parseInt(btn.dataset.idx)));
    });

    container.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', () => deleteItem(parseInt(btn.dataset.idx)));
    });
  }

  async function cycleStatus(idx) {
    const STATUS_CYCLE = ['want', 'watching', 'done', 'hold'];
    const item = scheduleData.watchlist[idx];
    const curr = STATUS_CYCLE.indexOf(item.status || 'want');
    const next = STATUS_CYCLE[(curr + 1) % STATUS_CYCLE.length];

    item.status = next;
    if (next === 'done' && !item.completedAt) {
      item.completedAt = new Date().toISOString();
    } else if (next !== 'done') {
      delete item.completedAt;
    }

    await saveData();
    renderAll();
  }

  async function deleteItem(idx) {
    if (!confirm('削除しますか？')) return;
    scheduleData.watchlist.splice(idx, 1);
    await saveData();
    renderAll();
  }

  function openEditModal(idx) {
    const item = scheduleData.watchlist[idx];
    const modal = document.getElementById('edit-modal');
    const content = document.getElementById('modal-content');

    content.innerHTML = `
      <div class="form-group">
        <label class="form-label">タイトル</label>
        <input type="text" class="form-input" id="edit-title" value="${item.title || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">メディア</label>
        <select class="form-select" id="edit-type">
          ${Object.entries(MEDIA_NAMES).map(([k, v]) =>
            `<option value="${k}" ${item.type === k ? 'selected' : ''}>${MEDIA_EMOJI[k]} ${v}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">ステータス</label>
        <select class="form-select" id="edit-status">
          <option value="want" ${item.status === 'want' ? 'selected' : ''}>👀 見たい</option>
          <option value="watching" ${item.status === 'watching' ? 'selected' : ''}>📺 視聴中</option>
          <option value="done" ${item.status === 'done' ? 'selected' : ''}>✓ 完了</option>
          <option value="hold" ${item.status === 'hold' ? 'selected' : ''}>⏸ 保留</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">メモ</label>
        <textarea class="form-textarea" id="edit-note">${item.note || ''}</textarea>
      </div>
      <button class="btn btn-primary" id="edit-save" style="width:100%;margin-top:12px;">保存</button>
    `;

    modal.classList.add('show');

    document.getElementById('edit-save').addEventListener('click', async () => {
      item.title = document.getElementById('edit-title').value.trim();
      item.type = document.getElementById('edit-type').value;
      item.status = document.getElementById('edit-status').value;
      item.note = document.getElementById('edit-note').value.trim() || undefined;

      if (item.status === 'done' && !item.completedAt) {
        item.completedAt = new Date().toISOString();
      } else if (item.status !== 'done') {
        delete item.completedAt;
      }

      await saveData();
      modal.classList.remove('show');
      renderAll();
    });
  }

  // History
  function renderHistory() {
    if (!scheduleData) return;

    const container = document.getElementById('history-content');
    if (!container) return;

    const done = scheduleData.watchlist
      .filter(i => i.status === 'done' && i.completedAt)
      .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

    if (done.length === 0) {
      container.innerHTML = '<div class="empty">まだ記録がありません</div>';
      return;
    }

    // Group by date
    const grouped = {};
    done.forEach(item => {
      const date = formatDate(item.completedAt);
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(item);
    });

    let html = '';
    Object.entries(grouped).forEach(([date, items]) => {
      html += `<div class="history-group">
        <div class="history-date">${date}</div>
        <div class="history-items">
          ${items.map(item => `
            <div class="history-item">
              <div class="history-item-header">
                <span class="history-item-emoji">${MEDIA_EMOJI[item.type] || '🎬'}</span>
                <span class="history-item-title">${item.title}</span>
              </div>
              ${item.note ? `<div class="history-item-note">${item.note}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>`;
    });

    container.innerHTML = html;
  }

  // All List
  function renderAllList() {
    if (!scheduleData) return;

    const container = document.getElementById('all-content');
    if (!container) return;

    let items = scheduleData.watchlist.map((item, idx) => ({ ...item, idx }));

    if (currentAllFilter !== 'all') {
      items = items.filter(i => (i.status || 'want') === currentAllFilter);
    }

    if (items.length === 0) {
      container.innerHTML = '<div class="empty">アイテムがありません</div>';
      return;
    }

    container.innerHTML = items.map(item => `
      <div class="backlog-item">
        <button class="backlog-item-status" data-idx="${item.idx}">
          ${STATUS_EMOJI[item.status] || '👀'}
        </button>
        <div class="backlog-item-content">
          <div class="backlog-item-title">${item.title}</div>
          <div class="backlog-item-meta">${MEDIA_EMOJI[item.type]} ${MEDIA_NAMES[item.type] || ''}</div>
        </div>
        <div class="backlog-item-actions">
          <button class="btn btn-sm" data-idx="${item.idx}" data-action="edit">✏️</button>
          <button class="btn btn-sm" data-idx="${item.idx}" data-action="delete">×</button>
        </div>
      </div>
    `).join('');

    attachItemEvents(container);
  }

  // Quick Add
  async function quickAdd() {
    const title = document.getElementById('quick-title').value.trim();
    const type = document.getElementById('quick-type').value;

    if (!title) return;

    scheduleData.watchlist.push({
      title,
      type,
      status: 'want',
      addedAt: new Date().toISOString()
    });

    await saveData();
    document.getElementById('quick-title').value = '';
    renderAll();
  }

  // Render All
  function renderAll() {
    renderWeeklyCalendar();
    renderStats();
    renderBacklog();
    renderHistory();
    renderAllList();
  }

  // Init
  async function init() {
    // Tabs
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
      });
    });

    // Backlog filters
    document.querySelectorAll('#backlog-filters .filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#backlog-filters .filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentBacklogFilter = btn.dataset.filter;
        renderBacklog();
      });
    });

    // All list filters
    document.querySelectorAll('#all-filters .filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#all-filters .filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentAllFilter = btn.dataset.filter;
        renderAllList();
      });
    });

    // Quick add
    document.getElementById('quick-add-btn')?.addEventListener('click', quickAdd);
    document.getElementById('quick-title')?.addEventListener('keypress', e => {
      if (e.key === 'Enter') quickAdd();
    });

    // Modals
    document.getElementById('modal-close')?.addEventListener('click', () => {
      document.getElementById('edit-modal').classList.remove('show');
    });

    document.getElementById('edit-modal')?.addEventListener('click', e => {
      if (e.target.id === 'edit-modal') {
        document.getElementById('edit-modal').classList.remove('show');
      }
    });

    // Settings
    document.getElementById('btn-settings')?.addEventListener('click', () => {
      document.getElementById('settings-token').value = getToken();
      document.getElementById('settings-modal').classList.add('show');
    });

    document.getElementById('settings-close')?.addEventListener('click', () => {
      document.getElementById('settings-modal').classList.remove('show');
    });

    document.getElementById('settings-save')?.addEventListener('click', async () => {
      setToken(document.getElementById('settings-token').value.trim());
      document.getElementById('settings-modal').classList.remove('show');
      showToast('設定を保存しました');
      await loadData();
    });

    // Refresh
    document.getElementById('btn-refresh')?.addEventListener('click', loadData);

    // Load
    await loadData();
  }

  async function loadData() {
    await fetchData();
    if (scheduleData) renderAll();
  }

  init();
})();
