/* plant-id.js — Camera capture, Claude API call, result display */

var PlantID = (() => {
  let _photoBase64 = null;
  let _photoType   = 'image/jpeg';
  let _gpsCoords   = null;
  let _lastResult  = null;

  /* ── DOM refs (resolved after init) ── */
  const $ = id => document.getElementById(id);

  function init() {
    App.registerTab('plant-id', { onShow });
    setupPhotoInput();
    setupGPS();
    setupZoneSelect();
    setupIdentifyBtn();
    renderApiKeyWarning();
  }

  function onShow() {
    renderApiKeyWarning();
    populateZoneSelect();
  }

  /* ── API key warning ── */
  function renderApiKeyWarning() {
    const warn = $('pid-apikey-warn');
    if (!warn) return;
    if (App.getApiKey()) {
      warn.style.display = 'none';
    } else {
      warn.style.display = 'block';
    }
  }

  /* ── Zone select ── */
  function populateZoneSelect() {
    const sel = $('pid-zone');
    if (!sel) return;
    const zones = App.getZones();
    const current = sel.value;
    sel.innerHTML = '<option value="">— select zone —</option>';
    zones.forEach(z => {
      const opt = document.createElement('option');
      opt.value = z.id;
      opt.textContent = `Zone ${z.id} – ${z.name}`;
      if (z.id === current) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  function setupZoneSelect() {
    populateZoneSelect();
  }

  /* ── Image compression ── */
  function compressImage(dataUrl, maxPx, quality) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > maxPx || h > maxPx) {
          if (w > h) { h = Math.round(h * maxPx / w); w = maxPx; }
          else        { w = Math.round(w * maxPx / h); h = maxPx; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = dataUrl;
    });
  }

  /* ── Photo input ── */
  function setupPhotoInput() {
    const preview  = $('pid-photo-preview');
    const hint     = $('pid-upload-hint');

    async function handleFile(e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async ev => {
        const compressed = await compressImage(ev.target.result, 1024, 0.85);
        _photoBase64 = compressed.split(',')[1];
        _photoType   = 'image/jpeg';
        preview.src  = compressed;
        preview.style.display = 'block';
        if (hint) hint.textContent = file.name;
        updateIdentifyBtn();
      };
      reader.readAsDataURL(file);
    }

    const cam = $('pid-camera-input');
    const gal = $('pid-gallery-input');
    if (cam) cam.addEventListener('change', handleFile);
    if (gal) gal.addEventListener('change', handleFile);
  }

  /* ── GPS ── */
  function setupGPS() {
    const btn = $('pid-gps-btn');
    if (!btn) return;
    btn.addEventListener('click', captureGPS);
  }

  function captureGPS() {
    const status = $('pid-gps-status');
    status.textContent = '📍 Locating...';
    status.className = 'gps-status';

    if (!navigator.geolocation) {
      status.textContent = 'GPS not available on this device';
      status.className = 'gps-error';
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        _gpsCoords = {
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6),
        };
        status.textContent = `✓ ${_gpsCoords.lat}, ${_gpsCoords.lng}`;
        status.className = 'gps-status';
      },
      err => {
        _gpsCoords = null;
        status.textContent = 'GPS unavailable — add location notes instead';
        status.className = 'gps-error';
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  /* ── Identify button ── */
  function setupIdentifyBtn() {
    const btn = $('pid-identify-btn');
    if (!btn) return;
    btn.addEventListener('click', runIdentification);
  }

  function updateIdentifyBtn() {
    const btn = $('pid-identify-btn');
    if (!btn) return;
    btn.disabled = !_photoBase64;
  }

  /* ── Main identification flow ── */
  async function runIdentification() {
    if (!_photoBase64) { App.toast('Please select a photo first'); return; }

    const key = App.getApiKey();
    if (!key) {
      App.toast('Add your API key in Settings first');
      App.openSettings();
      return;
    }

    if (!navigator.onLine) {
      showOfflineMessage();
      return;
    }

    const zone     = $('pid-zone').value;
    const notes    = ($('pid-notes').value || '').trim();
    const zoneData = zone ? App.getZone(zone) : null;

    showSpinner(true);
    hideResult();

    try {
      const result = await callClaudeAPI(key, zoneData, notes);
      _lastResult  = result;
      showResult(result, zone, notes);
    } catch (err) {
      showSpinner(false);
      const raw = err.toString();
      let msg;
      if (!err.message || err.name === 'TypeError' || raw.toLowerCase().includes('fetch')) {
        msg = '⚠️ Network error — the API request was blocked or failed.<br><br>' +
              'Things to try:<br>' +
              '1. Check your API key is set in ⚙️ Settings<br>' +
              '2. In Brave: tap the lion icon → turn Shields OFF for this site<br>' +
              '3. Check your internet connection<br><br>' +
              '<small style="color:var(--muted)">Error detail: ' + esc(raw) + '</small>';
      } else {
        msg = esc(err.message) + '<br><small style="color:var(--muted)">' + esc(raw) + '</small>';
      }
      showError(msg);
    }
  }

  /* ── Claude API call ── */
  async function callClaudeAPI(apiKey, zoneData, userNotes) {
    const location = (_gpsCoords)
      ? `GPS: ${_gpsCoords.lat}, ${_gpsCoords.lng}`
      : 'Location: Southeast Iowa';

    const userMessage = [
      { type: 'image', source: { type: 'base64', media_type: _photoType, data: _photoBase64 } },
      { type: 'text', text: `${location}\nDate: ${App.todayISO()}` }
    ];

    const systemPrompt =
`Identify the plant in the photo. Respond with valid JSON only — no markdown, no text outside the JSON:
{
  "common_name": "string",
  "latin_name": "string",
  "confidence": "High" | "Medium" | "Low",
  "native_status": "Native" | "Invasive" | "Non-native" | "Unknown",
  "keystone": true | false,
  "recommended_action": "REMOVE" | "NURTURE" | "MONITOR" | "UNKNOWN",
  "action_detail": "string",
  "fun_fact": "string",
  "log_entry": {
    "common_name": "string",
    "latin_name": "string",
    "native": "Native" | "Invasive" | "Non-native" | "Unknown",
    "keystone": "Yes" | "No",
    "observation_type": "string",
    "action_needed": "string"
  }
}`;

    const res = await fetch('https://field-companion-api.paulwiner5.workers.dev/', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      if (res.status === 401) throw new Error('Invalid API key. Check Settings.');
      if (res.status === 429) throw new Error('Rate limit reached. Wait a moment and try again.');
      throw new Error(body.error?.message || `API error ${res.status}`);
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || '';

    let parsed;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch {
      throw new Error('Could not parse AI response. The model returned unexpected output.');
    }
    return parsed;
  }

  /* ── Result rendering ── */
  function showSpinner(on) {
    const spinner = $('pid-spinner');
    if (spinner) spinner.style.display = on ? 'flex' : 'none';
    if (on) hideResult();
  }

  function hideResult() {
    const r = $('pid-result');
    if (r) r.style.display = 'none';
  }

  function showOfflineMessage() {
    showSpinner(false);
    $('pid-result').style.display = 'block';
    $('pid-result').innerHTML = `
      <div class="alert alert-error">
        📵 <strong>No internet connection</strong><br>
        Plant ID requires the Claude AI service. You're currently offline.<br><br>
        ✅ You can still log this plant manually — switch to the Log tab and enter the details by hand.
      </div>`;
  }

  function showError(msg) {
    $('pid-result').style.display = 'block';
    $('pid-result').innerHTML = `<div class="alert alert-error">⚠️ ${msg}</div>`;
  }

  function nativeStatusBadge(status) {
    const map = {
      'Native':     'badge-native',
      'Invasive':   'badge-invasive',
      'Non-native': 'badge-nonnative',
      'Unknown':    'badge-zone',
    };
    return `<span class="badge ${map[status] || 'badge-zone'}">${status}</span>`;
  }

  function actionClass(action) {
    return { REMOVE: 'action-remove', NURTURE: 'action-nurture', MONITOR: 'action-monitor' }[action] || 'action-unknown';
  }

  function actionIcon(action) {
    return { REMOVE: '🗑️', NURTURE: '🌱', MONITOR: '👁️', UNKNOWN: '❓' }[action] || '❓';
  }

  function showResult(result, zone, notes) {
    showSpinner(false);
    const container = $('pid-result');
    container.style.display = 'block';

    const csvRow = buildCSVRow(result, zone, notes);
    const isKeystone = result.keystone ? '<span class="badge badge-keystone">⭐ Keystone</span>' : '';
    const lowConf = result.confidence === 'Low'
      ? `<div class="alert alert-warn" style="margin-top:10px">⚠️ Low confidence — consider cross-referencing with iNaturalist or a field guide before treating.</div>`
      : '';

    container.innerHTML = `
      <div class="result-card">
        <div class="result-name">${esc(result.common_name || 'Unknown plant')}</div>
        <div class="result-latin">${esc(result.latin_name || '')} · ${esc(result.confidence || '')} confidence</div>
        ${nativeStatusBadge(result.native_status)} ${isKeystone}
        ${lowConf}
        <div class="action-box ${actionClass(result.recommended_action)}" style="margin-top:12px">
          ${actionIcon(result.recommended_action)} <strong>${result.recommended_action}</strong> — ${esc(result.action_detail || '')}
        </div>
        ${result.fun_fact ? `<div class="fun-fact">📌 ${esc(result.fun_fact)}</div>` : ''}
        <div style="margin-top:14px;border-top:1px solid var(--border);padding-top:12px">
          <div class="lbl">Log entry — copy to Google Sheet</div>
          <div class="mono-box" id="pid-csv-row">${esc(csvRow)}</div>
          <div style="display:flex;gap:8px;margin-top:8px">
            <button class="btn btn-outline btn-sm" id="pid-copy-csv">📋 Copy CSV row</button>
            <button class="btn btn-sm" id="pid-save-obs">💾 Save observation</button>
          </div>
        </div>
      </div>`;

    $('pid-copy-csv').addEventListener('click', () => App.copyToClipboard(csvRow));
    $('pid-save-obs').addEventListener('click', () => saveObservation(result, zone, notes, csvRow));
  }

  function buildCSVRow(result, zone, notes) {
    const log = result.log_entry || {};
    const obs = {
      date:             App.todayISO(),
      zone:             zone || '',
      lat:              _gpsCoords?.lat || '',
      lng:              _gpsCoords?.lng || '',
      location_desc:    $('pid-notes').value.trim() || '',
      common_name:      result.common_name || log.common_name || '',
      latin_name:       result.latin_name  || log.latin_name  || '',
      native_status:    result.native_status || log.native || '',
      keystone:         result.keystone ? 'Yes' : 'No',
      observation_type: log.observation_type || result.native_status || '',
      action_needed:    log.action_needed || result.action_detail || '',
      notes:            notes || '',
    };
    return App.obsToCSVRow(obs);
  }

  async function saveObservation(result, zone, notes, csvRow) {
    const log = result.log_entry || {};
    const obs = {
      date:             App.todayISO(),
      zone:             zone || '',
      lat:              _gpsCoords?.lat || '',
      lng:              _gpsCoords?.lng || '',
      location_desc:    $('pid-notes').value.trim() || '',
      common_name:      result.common_name || log.common_name || '',
      latin_name:       result.latin_name  || log.latin_name  || '',
      native_status:    result.native_status || log.native || '',
      keystone:         result.keystone ? 'Yes' : 'No',
      observation_type: log.observation_type || '',
      action_needed:    log.action_needed || result.action_detail || '',
      notes:            notes || '',
      ai_identified:    true,
    };
    try {
      await App.saveObservation(obs);
      App.toast('Observation saved ✓');
      const btn = $('pid-save-obs');
      if (btn) { btn.textContent = '✓ Saved'; btn.disabled = true; }
    } catch (err) {
      App.toast('Save failed: ' + err.message);
    }
  }

  function esc(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  return { init };
})();
