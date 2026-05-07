/* app.js — Field Companion core: routing, data loading, IndexedDB, toast, offline */

const App = (() => {
  let _zones = [];
  let _tasks = {};
  let _driveLinks = {};
  let _propertyCtx = {};
  let _db = null;

  /* ── IndexedDB ── */
  function initDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('field-companion', 1);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('observations')) {
          const store = db.createObjectStore('observations', { keyPath: 'id', autoIncrement: true });
          store.createIndex('date',  'date',  { unique: false });
          store.createIndex('zone',  'zone',  { unique: false });
        }
      };
      req.onsuccess = e => { _db = e.target.result; resolve(_db); };
      req.onerror   = e => reject(e.target.error);
    });
  }

  function getDB() { return _db; }

  function saveObservation(obs) {
    return new Promise((resolve, reject) => {
      const tx = _db.transaction('observations', 'readwrite');
      const req = tx.objectStore('observations').add({ ...obs, created_at: Date.now() });
      req.onsuccess = e => resolve(e.target.result);
      req.onerror   = e => reject(e.target.error);
    });
  }

  function getAllObservations() {
    return new Promise((resolve, reject) => {
      const tx = _db.transaction('observations', 'readonly');
      const req = tx.objectStore('observations').getAll();
      req.onsuccess = e => resolve(e.target.result.reverse());
      req.onerror   = e => reject(e.target.error);
    });
  }

  function getObservationsByZone(zone) {
    return new Promise((resolve, reject) => {
      const tx = _db.transaction('observations', 'readonly');
      const idx = tx.objectStore('observations').index('zone');
      const req = idx.getAll(zone);
      req.onsuccess = e => resolve(e.target.result.reverse());
      req.onerror   = e => reject(e.target.error);
    });
  }

  function deleteObservation(id) {
    return new Promise((resolve, reject) => {
      const tx = _db.transaction('observations', 'readwrite');
      const req = tx.objectStore('observations').delete(id);
      req.onsuccess = () => resolve();
      req.onerror   = e => reject(e.target.error);
    });
  }

  /* ── JSON data loaders ── */
  async function loadJSON(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to load ${path}`);
    return res.json();
  }

  async function loadAllData() {
    const base = 'js/data/';
    const [zones, tasks, driveLinks, ctx] = await Promise.all([
      loadJSON(base + 'zones.json'),
      loadJSON(base + 'tasks.json'),
      loadJSON(base + 'drive-links.json'),
      loadJSON(base + 'property-context.json'),
    ]);
    _zones      = zones;
    _tasks      = tasks;
    _driveLinks = driveLinks;
    _propertyCtx = ctx;
  }

  function getZones()       { return _zones; }
  function getZone(id)      { return _zones.find(z => z.id === id); }
  function getTasks()       { return _tasks; }
  function getDriveLinks()  { return _driveLinks; }
  function getPropertyCtx() { return _propertyCtx; }

  /* ── API key ── */
  function getApiKey()        { return localStorage.getItem('fc_api_key') || ''; }
  function setApiKey(key)     { localStorage.setItem('fc_api_key', key.trim()); }
  function clearApiKey()      { localStorage.removeItem('fc_api_key'); }

  /* ── Tab routing ── */
  let _currentTab = 'plant-id';
  const _tabModules = {};

  function registerTab(id, mod) { _tabModules[id] = mod; }

  function switchTab(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const screen = document.getElementById('screen-' + id);
    const btn    = document.querySelector(`[data-tab="${id}"]`);
    if (screen) screen.classList.add('active');
    if (btn)    btn.classList.add('active');
    _currentTab = id;
    if (_tabModules[id] && _tabModules[id].onShow) _tabModules[id].onShow();
  }

  /* ── Offline detection ── */
  function updateOnlineStatus() {
    const banner = document.getElementById('offline-banner');
    if (!navigator.onLine) {
      banner.classList.add('show');
    } else {
      banner.classList.remove('show');
    }
  }

  /* ── Toast notifications ── */
  let _toastTimer = null;
  function toast(msg, duration = 2500) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => el.classList.remove('show'), duration);
  }

  /* ── Settings panel ── */
  function openSettings() {
    document.getElementById('settings-panel').classList.add('open');
    renderSettings();
  }
  function closeSettings() {
    document.getElementById('settings-panel').classList.remove('open');
  }

  function renderSettings() {
    const key = getApiKey();
    document.getElementById('api-key-input').value = key ? '••••••••••••••••' : '';
    document.getElementById('api-key-status').textContent = key
      ? '✓ API key saved on this device'
      : '⚠ No API key set — Plant ID disabled';
    document.getElementById('api-key-status').className = key ? 'alert alert-ok' : 'alert alert-warn';

    const ctx = getPropertyCtx();
    document.getElementById('settings-version').textContent = ctx.owner
      ? `${ctx.owner} · ${ctx.location} (${ctx.zip})`
      : 'Field Companion v1.0';
  }

  function setupSettings() {
    document.getElementById('settings-btn').addEventListener('click', openSettings);
    document.getElementById('settings-close').addEventListener('click', closeSettings);
    document.getElementById('settings-panel').addEventListener('click', e => {
      if (e.target === document.getElementById('settings-panel')) closeSettings();
    });

    document.getElementById('api-key-save').addEventListener('click', () => {
      const input = document.getElementById('api-key-input');
      const val = input.value.trim();
      if (val && !val.startsWith('••')) {
        setApiKey(val);
        input.value = '';
        toast('API key saved ✓');
        renderSettings();
      } else if (!val) {
        toast('Enter your API key first');
      }
    });

    document.getElementById('api-key-clear').addEventListener('click', () => {
      if (confirm('Remove saved API key? Plant ID will stop working until you add a new one.')) {
        clearApiKey();
        document.getElementById('api-key-input').value = '';
        renderSettings();
        toast('API key removed');
      }
    });
  }

  /* ── Service Worker registration ── */
  function registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('service-worker.js').catch(console.warn);
    }
  }

  /* ── Date helpers ── */
  function todayISO() {
    return new Date().toISOString().split('T')[0];
  }

  function formatDate(iso) {
    const [y, m, d] = iso.split('-');
    return `${m}/${d}/${y}`;
  }

  /* ── CSV helpers ── */
  function obsToCSVRow(obs) {
    const fields = [
      obs.date, obs.zone,
      obs.lat || '', obs.lng || '',
      obs.location_desc || '',
      obs.common_name || '', obs.latin_name || '',
      obs.native_status || '', obs.keystone || 'No',
      obs.observation_type || '', obs.action_needed || '',
      '', 'Paul', obs.notes || ''
    ];
    return fields.map(f => {
      const s = String(f);
      return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',');
  }

  function obsArrayToCSV(list) {
    const header = 'Date,Zone,Lat,Lng,Location,Common Name,Latin Name,Native,Keystone,Type,Action,Photo,Logged By,Notes';
    return [header, ...list.map(obsToCSVRow)].join('\n');
  }

  function copyToClipboard(text) {
    if (navigator.clipboard) {
      return navigator.clipboard.writeText(text).then(() => toast('Copied to clipboard ✓'));
    }
    const el = document.createElement('textarea');
    el.value = text; document.body.appendChild(el);
    el.select(); document.execCommand('copy');
    document.body.removeChild(el);
    toast('Copied to clipboard ✓');
  }

  function downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /* ── Init ── */
  async function init() {
    try {
      await Promise.all([initDB(), loadAllData()]);
    } catch (err) {
      console.error('App init error:', err);
    }

    window.addEventListener('online',  updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    setupSettings();
    registerSW();

    if (window.PlantID) PlantID.init();
    if (window.Logger)  Logger.init();
    if (window.Zones)   Zones.init();
    if (window.Tasks)   Tasks.init();
    if (window.Drive)   Drive.init();

    switchTab('plant-id');
  }

  return {
    init,
    getDB, saveObservation, getAllObservations, getObservationsByZone, deleteObservation,
    getZones, getZone, getTasks, getDriveLinks, getPropertyCtx,
    getApiKey, setApiKey,
    registerTab, switchTab,
    toast,
    todayISO, formatDate,
    obsToCSVRow, obsArrayToCSV, copyToClipboard, downloadCSV,
    openSettings, closeSettings,
  };
})();

document.addEventListener('DOMContentLoaded', App.init);
