/* zones.js â€” Zone grid and zone detail view */

const Zones = (() => {
  let _showingDetail = false;

  const $ = id => document.getElementById(id);

  function init() {
    App.registerTab('zones', { onShow });
  }

  function onShow() {
    if (!_showingDetail) renderGrid();
  }

  /* â”€â”€ Grid â”€â”€ */
  function renderGrid() {
    _showingDetail = false;
    const container = $('zones-container');
    if (!container) return;
    const zones = App.getZones();

    container.innerHTML = `
      <div class="zone-grid" id="zone-grid">
        ${zones.map(z => zoneCardHTML(z)).join('')}
      </div>
      <div class="zone-hint">Tap any zone for full detail</div>`;

    container.querySelectorAll('.zone-card').forEach((el, i) => {
      el.addEventListener('click', () => renderDetail(zones[i]));
    });
  }

  function zoneCardHTML(z) {
    const urgent = z.urgency === 'high';
    const issue  = z.priority_action
      ? z.priority_action.replace(/^(URGENT:|#\d+ PRIORITY:)\s*/i, '').split('.')[0]
      : '';
    return `
      <div class="zone-card ${urgent ? 'urgent' : ''}">
        <div class="zn">Zone ${esc(z.id)}${urgent ? ' âš ï¸' : ''}</div>
        <div class="zd">${esc(z.name)} Â· ${z.acres} ac</div>
        ${urgent && issue ? `<div class="zp">${esc(issue.substring(0, 60))}</div>` : ''}
      </div>`;
  }

  /* â”€â”€ Detail â”€â”€ */
  function renderDetail(zone) {
    _showingDetail = true;
    const container = $('zones-container');
    if (!container) return;

    const urgentClass = zone.urgency === 'high' ? 'action-remove' : 'action-nurture';

    const invasivesList = zone.invasives.length
      ? zone.invasives.map(s => `<li>${esc(s)}</li>`).join('')
      : '<li style="color:var(--muted)">None confirmed</li>';

    const targetsList = zone.target_natives.map(s => `<li>${esc(s)}</li>`).join('');

    container.innerHTML = `
      <button class="zone-detail-back" id="zone-back-btn">â† All zones</button>
      <div class="result-card">
        <div class="result-name">Zone ${esc(zone.id)} â€” ${esc(zone.name)}</div>
        <div class="result-latin">${zone.acres} acres Â· ${esc(zone.elevation)}</div>

        ${zone.priority_action ? `
          <div class="zone-detail-section">
            <h4>Priority action</h4>
            <div class="action-box ${urgentClass}">${esc(zone.priority_action)}</div>
          </div>` : ''}

        <div class="zone-detail-section">
          <h4>Description</h4>
          <p style="font-size:13px;color:var(--text);line-height:1.6">${esc(zone.description)}</p>
        </div>

        <div class="zone-detail-section">
          <h4>Goals</h4>
          <p style="font-size:13px;color:var(--text);line-height:1.6">${esc(zone.goals)}</p>
        </div>

        <div class="zone-detail-section">
          <h4>Invasives present</h4>
          <ul>${invasivesList}</ul>
        </div>

        <div class="zone-detail-section">
          <h4>Target natives to add</h4>
          <ul>${targetsList}</ul>
        </div>

        <div class="zone-detail-section">
          <h4>Notes</h4>
          <p style="font-size:12px;color:var(--label);line-height:1.6">${esc(zone.notes)}</p>
        </div>
      </div>`;

    $('zone-back-btn').addEventListener('click', renderGrid);
  }

  function esc(str) {
    return String(str || '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return { init };
})();

