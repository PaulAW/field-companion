/* tasks.js — Seasonal maintenance checklist with localStorage persistence */

const Tasks = (() => {
  const STORAGE_KEY = 'fc_tasks';
  let _state = {};   // { 'sp-01': true, ... }

  const $ = id => document.getElementById(id);

  function init() {
    App.registerTab('tasks', { onShow });
    loadState();
    render();
  }

  function onShow() {
    render();
  }

  /* ── State persistence ── */
  function loadState() {
    try {
      _state = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch { _state = {}; }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_state));
  }

  function toggleTask(id) {
    _state[id] = !_state[id];
    saveState();
  }

  function clearSeason(seasonId, taskIds) {
    taskIds.forEach(id => { _state[id] = false; });
    saveState();
  }

  /* ── Current season detection ── */
  function currentSeasonId() {
    const month = new Date().getMonth() + 1;
    if (month >= 4 && month <= 5) return 'spring';
    if (month >= 6 && month <= 8) return 'summer';
    if (month >= 9 && month <= 11) return 'fall';
    return 'winter';
  }

  /* ── Render ── */
  function render() {
    const container = $('tasks-container');
    if (!container) return;

    const data = App.getTasks();
    if (!data || !data.seasons) {
      container.innerHTML = '<div class="alert alert-warn">Task data not loaded.</div>';
      return;
    }

    const curSeason = currentSeasonId();
    container.innerHTML = data.seasons.map(s => seasonHTML(s, s.id === curSeason)).join('');

    data.seasons.forEach(season => {
      const header  = $(`season-hd-${season.id}`);
      const body    = $(`season-body-${season.id}`);
      const clearBtn = $(`season-clear-${season.id}`);

      if (header) {
        header.addEventListener('click', () => {
          const isOpen = body.classList.contains('open');
          body.classList.toggle('open', !isOpen);
          header.classList.toggle('open', !isOpen);
        });
      }

      season.tasks.forEach(task => {
        const row = $(`task-row-${task.id}`);
        if (row) {
          row.addEventListener('click', () => {
            toggleTask(task.id);
            rerenderTask(task, season.id);
          });
        }
      });

      if (clearBtn) {
        clearBtn.addEventListener('click', e => {
          e.stopPropagation();
          const ids = season.tasks.map(t => t.id);
          const done = ids.filter(id => _state[id]).length;
          if (done === 0) { App.toast('No completed tasks to clear'); return; }
          if (!confirm(`Clear ${done} completed task${done > 1 ? 's' : ''} for ${season.label}?`)) return;
          clearSeason(season.id, ids);
          render();
          App.toast(`${season.label} tasks reset`);
        });
      }
    });
  }

  function seasonHTML(season, isOpen) {
    const taskIds  = season.tasks.map(t => t.id);
    const total    = taskIds.length;
    const done     = taskIds.filter(id => _state[id]).length;
    const pct      = total ? Math.round((done / total) * 100) : 0;
    const urgentCount = season.tasks.filter(t => t.urgent && !_state[t.id]).length;

    return `
      <div class="season-block">
        <div class="season-header ${isOpen ? 'open' : ''}" id="season-hd-${season.id}">
          <div>
            <div class="season-title">${season.emoji} ${season.label} <span style="font-size:11px;font-weight:400;color:var(--muted)">${season.months}</span></div>
            ${urgentCount > 0 ? `<span class="badge badge-urgent">${urgentCount} urgent</span>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="season-progress">${done}/${total}</span>
            <span class="season-chevron">▶</span>
          </div>
        </div>
        <div class="progress-bar" style="${isOpen ? '' : 'display:none'}" id="season-prog-${season.id}">
          <div class="progress-fill" style="width:${pct}%"></div>
        </div>
        <div class="season-body ${isOpen ? 'open' : ''}" id="season-body-${season.id}">
          ${season.tasks.map(t => taskItemHTML(t)).join('')}
          <div class="season-footer">
            <button class="btn btn-outline btn-sm" id="season-clear-${season.id}">Clear ${season.label} checkmarks</button>
          </div>
        </div>
      </div>`;
  }

  function taskItemHTML(task) {
    const done = !!_state[task.id];
    return `
      <div class="task-item" id="task-row-${task.id}">
        <div class="task-check ${done ? 'done' : ''}"></div>
        <div class="task-text ${done ? 'done' : ''} ${task.urgent && !done ? 'task-urgent' : ''}">
          ${esc(task.text)}
          ${task.zone ? `<span style="color:var(--muted);font-size:10px"> · Zone ${esc(task.zone)}</span>` : ''}
        </div>
      </div>`;
  }

  function rerenderTask(task, seasonId) {
    const row = $(`task-row-${task.id}`);
    if (!row) return;
    row.outerHTML = taskItemHTML(task);
    const newRow = $(`task-row-${task.id}`);
    if (newRow) {
      newRow.addEventListener('click', () => {
        toggleTask(task.id);
        rerenderTask(task, seasonId);
        updateSeasonProgress(seasonId);
      });
    }
    updateSeasonProgress(seasonId);
  }

  function updateSeasonProgress(seasonId) {
    const data = App.getTasks();
    const season = data.seasons.find(s => s.id === seasonId);
    if (!season) return;
    const ids  = season.tasks.map(t => t.id);
    const done = ids.filter(id => _state[id]).length;
    const pct  = ids.length ? Math.round((done / ids.length) * 100) : 0;
    const bar  = $(`season-prog-${seasonId}`);
    if (bar) bar.querySelector('.progress-fill').style.width = pct + '%';
    const hd = $(`season-hd-${seasonId}`);
    if (hd) {
      const prog = hd.querySelector('.season-progress');
      if (prog) prog.textContent = `${done}/${ids.length}`;
    }
  }

  function esc(str) {
    return String(str || '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return { init };
})();
