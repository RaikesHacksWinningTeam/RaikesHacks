import { auth } from './firebase-config.js';

const ORG_COLORS = ['#635bff', '#0ea5e9', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#ec4899'];
const EVENT_HEIGHT = 120;
const LAYER_SPACING = 130;
const SIDEBAR_WIDTH = 180;
const GAP = 12;
const PADDING = 20;

export function getOrgColor(name, storedColor) {
    if (storedColor) return storedColor;
    let hash = 0;
    for (let c of name) hash = c.charCodeAt(0) + ((hash << 5) - hash);
    return ORG_COLORS[Math.abs(hash) % ORG_COLORS.length];
}

export function showToast(message, type = 'success') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const icon = type === 'success' ? '✓' : '✕';
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

function format12h(hour) {
    const period = hour >= 12 ? 'PM' : 'AM';
    const h = hour % 12 || 12;
    return `${h} ${period}`;
}

function calculateLiveBarPosition() {
    const now = new Date();
    // Only calculate position if within 6 AM (6 * 60) and 10 PM (22 * 60)
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const startMins = 6 * 60; // 6 AM
    const totalGridMins = 16 * 60; // 16 hours total

    // Clamp so the bar stays at the edges if outside working hours
    const visibleMins = Math.max(0, Math.min(currentMins - startMins, totalGridMins));

    const container = document.getElementById('org-dashboard-container');
    const containerWidth = container ? container.scrollWidth : window.innerWidth;
    const gridWidth = containerWidth - (PADDING * 2) - SIDEBAR_WIDTH - GAP;
    const offset = PADDING + SIDEBAR_WIDTH + GAP;

    const pixelPos = offset + (visibleMins / totalGridMins) * gridWidth;
    return { pixelPos };
}

function updateLiveBar() {
    const bar = document.getElementById('dashboard-live-bar');
    if (!bar) return;
    const { pixelPos } = calculateLiveBarPosition();
    bar.style.left = `${pixelPos}px`;

    // Update the time text inside
    const span = bar.querySelector('span');
    if (span) {
        const now = new Date();
        span.innerText = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
}

export function renderDashboard(state) {
    const container = document.getElementById('org-dashboard-container');
    if (!container) return;

    if (state.allOrganizations.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 4rem; color: #94a3b8;">
                <i data-lucide="building-2" style="width: 48px; height: 48px; margin-bottom: 1rem;"></i>
                <p>No organizations found.</p>
            </div>`;
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    container.style.cssText = `
        display: grid;
        grid-template-columns: ${SIDEBAR_WIDTH}px 1fr;
        gap: ${GAP}px;
        padding: ${PADDING}px;
        background: var(--surface);
        position: relative;
        overflow-y: auto;
    `;
    container.innerHTML = '';

    const timelineOffset = PADDING + SIDEBAR_WIDTH + GAP;

    // Background grid
    const gridOverlay = document.createElement('div');
    gridOverlay.id = 'dashboard-grid-overlay';
    gridOverlay.style.cssText = `
        position: absolute;
        top: 0; left: ${timelineOffset}px; right: ${PADDING}px; bottom: 0;
        display: flex;
        pointer-events: none;
        z-index: 1;
    `;
    // Background grid (16 segments for 6 AM to 10 PM)
    for (let i = 0; i < 16; i++) {
        const line = document.createElement('div');
        line.style.cssText = `
            flex: 1;
            border-left: 1px dashed rgba(226, 232, 240, 0.8);
            height: 100%;
        `;
        gridOverlay.appendChild(line);
    }
    container.appendChild(gridOverlay);

    // Live time indicator (pill on top)
    const liveBar = document.createElement('div');
    liveBar.id = 'dashboard-live-bar';

    // Get current time formatted
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

    liveBar.innerHTML = `
        <div style="
            position: absolute;
            top: 24px; left: 50%;
            width: 2px; height: 2000px;
            background: rgba(220, 38, 38, 0.75);
            transform: translateX(-50%);
            box-shadow: 0 0 10px rgba(220, 38, 38, 0.4);
            z-index: -1;
        "></div>
        <span>${timeString}</span>
    `;
    liveBar.style.cssText = `
        position: absolute;
        top: 8px; /* sits in the time header */
        background: #dc2626; /* darker red */
        color: white;
        font-size: 0.7rem;
        font-weight: 800;
        padding: 4px 8px;
        border-radius: 12px;
        z-index: 1000;
        box-shadow: 0 4px 10px rgba(220, 38, 38, 0.4); /* drop shadow */
        pointer-events: none;
        transition: left 60s linear;
        transform: translateX(-50%); /* Center horizontally on the line */
        display: flex;
        align-items: center;
        justify-content: center;
        height: auto;
    `;
    container.appendChild(liveBar);
    updateLiveBar();

    // Time header
    const spacer = document.createElement('div');
    container.appendChild(spacer);

    const timeHeader = document.createElement('div');
    timeHeader.style.cssText = `
        display: flex;
        position: sticky;
        top: 0;
        z-index: 110;
        background: var(--background);
        backdrop-filter: blur(4px);
        padding-bottom: 10px;
        border-bottom: 1px solid var(--border);
    `;
    // Time header (16 segments for 6 AM to 10 PM)
    for (let i = 0; i < 16; i++) {
        const h = document.createElement('div');
        h.style.cssText = `flex: 1; font-size: 0.7rem; font-weight: 700; color: #94a3b8; text-align: center;`;

        // Offset by 6 hours to start at 6 AM
        const hour = i + 6;
        h.innerText = (hour % 2 === 0) ? format12h(hour) : '';
        timeHeader.appendChild(h);
    }
    container.appendChild(timeHeader);

    // Live bar update
    if (!window._liveBarInterval) {
        window._liveBarInterval = setInterval(updateLiveBar, 60000);
    }

    // Render org rows
    state.allOrganizations.forEach(org => {
        const myOrgEntry = state.userOrgs.find(o => o.id === org.id);
        const isAdmin = myOrgEntry && ['admin', 'owner'].includes(myOrgEntry.role);
        const hasAccess = !!myOrgEntry;

        // Sidebar label
        const orgLabel = document.createElement('div');
        const orgColorValue = getOrgColor(org.name || org.id, org.color);
        orgLabel.style.cssText = `
            font-weight: 800;
            color: var(--text-dark);
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 15px;
            font-size: 0.95rem;
            z-index: 2;
            border-bottom: 1px solid var(--border);
            background: var(--surface);
        `;
        
        const initial = (org.name || '?')[0].toUpperCase();
        orgLabel.innerHTML = `
            <div style="width: 28px; height: 28px; border-radius: 6px; background: ${orgColorValue}; color: white; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; flex-shrink: 0;">${initial}</div>
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${org.name}</span>
        `;
        container.appendChild(orgLabel);

        // Timeline slot with admin styling
        const timelineSlot = document.createElement('div');
        timelineSlot.style.cssText = `
            position: relative;
            min-height: ${EVENT_HEIGHT + 5}px;
            z-index: 5;
            border-bottom: 1px solid var(--border);
            ${hasAccess ? `
                background: linear-gradient(90deg, rgba(99,91,255,0.03) 0%, transparent 100%);
            ` : ''}
            ${isAdmin ? `
                border-left: 3px solid rgba(99,91,255,0.4);
                padding-left: 8px;
            ` : ''}
        `;

        const orgEvents = state.events.filter(e => e.org_id === org.id);
        orgEvents.sort((a, b) => new Date(a.start) - new Date(b.start));
        let layers = [];

        orgEvents.forEach(event => {
            const start = new Date(event.start);
            const end = new Date(event.end);
            const startMins = start.getHours() * 60 + start.getMinutes();
            const endMins = end.getHours() * 60 + end.getMinutes();

            // 6 AM is our zero point
            const gridStartMins = 6 * 60;
            const gridTotalMins = 16 * 60;

            // Constrain events visually to the grid (6am - 10pm)
            const visibleStart = Math.max(startMins, gridStartMins);
            const visibleEnd = Math.min(endMins, gridStartMins + gridTotalMins);

            // If event is completely outside the visible window, hide it
            const isOutside = visibleEnd <= gridStartMins || visibleStart >= gridStartMins + gridTotalMins;

            const left = ((visibleStart - gridStartMins) / gridTotalMins) * 100;
            const width = Math.max(0.5, ((visibleEnd - visibleStart) / gridTotalMins) * 100);

            let layerIndex = layers.findIndex(layerEnd => layerEnd <= startMins);
            if (layerIndex === -1) {
                layerIndex = layers.length;
                layers.push(endMins);
            } else {
                layers[layerIndex] = endMins;
            }

            const eventEl = document.createElement('div');
            eventEl.classList.add('event-card');
            const baseColor = getOrgColor(org.name, org.color);

            eventEl.style.cssText = `
                position: absolute;
                ${isOutside ? 'display: none;' : ''}
                left: ${left}%;
                width: ${width}%;
                top: ${layerIndex * LAYER_SPACING}px;
                height: ${EVENT_HEIGHT}px;
                background: ${baseColor}cc;
                backdrop-filter: blur(8px);
                border: 1px solid rgba(255,255,255,0.2);
                border-radius: 12px;
                padding: 12px 16px;
                color: white;
                cursor: pointer;
                box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                transition: all 0.3s ease;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                justify-content: flex-start;
                gap: 4px;
                z-index: 60;
            `;

            const startTime = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            const endTime = end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

            eventEl.innerHTML = `
                <div style="font-weight: 800; font-size: 1.1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${event.title}</div>
                <div style="font-size: 0.75rem; font-weight: 600; opacity: 0.9;">${startTime} - ${endTime}</div>
            `;

            eventEl.onmouseenter = () => {
                eventEl.style.transform = 'scale(1.02) translateY(-2px)';
                eventEl.style.zIndex = '200';
                eventEl.style.background = baseColor;
                eventEl.style.boxShadow = '0 12px 30px rgba(0,0,0,0.2)';
            };
            eventEl.onmouseleave = () => {
                eventEl.style.transform = 'scale(1) translateY(0)';
                eventEl.style.zIndex = '60';
                eventEl.style.background = baseColor + 'cc';
                eventEl.style.boxShadow = '0 4px 15px rgba(0,0,0,0.1)';
            };

            eventEl.onclick = (e) => {
                e.stopPropagation();
                if (window.editEvent) {
                    window.editEvent(event.id);
                }
            };

            timelineSlot.appendChild(eventEl);
        });

        timelineSlot.style.height = `${Math.max(EVENT_HEIGHT + 5, layers.length * LAYER_SPACING)}px`;
        container.appendChild(timelineSlot);
    });

    if (window.lucide) window.lucide.createIcons();
}

export function updateOrgSwitcher(userOrgs) {
    const label = document.getElementById('org-switcher-label');
    if (label) {
        label.textContent = userOrgs.length > 1 ? `${userOrgs.length} Orgs` : (userOrgs[0]?.name || 'My Orgs');
    }
}

export function renderMyOrgsPanel(userOrgs) {
    const container = document.getElementById('org-list-container');
    if (!container) return;

    if (userOrgs.length === 0) {
        container.innerHTML = `
            <div class="org-empty">
                <i data-lucide="building-2" style="width:40px;height:40px;opacity:0.3;margin: 0 auto 0.75rem; display: block;"></i>
                <p>You haven't joined any organizations yet.</p>
            </div>`;
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    container.innerHTML = userOrgs.map(org => {
        const initial = (org.name || '?')[0].toUpperCase();
        const color = getOrgColor(org.name || org.id, org.color);
        const role = org.role || 'viewer';
        const canManage = ['owner', 'admin'].includes(role);
        const isOwner = role === 'owner';
        const codeChip = org.invite_code
            ? `<span style="font-size:0.7rem;color:#94a3b8;margin-left:0.35rem;">· <code style="color:var(--secondary);letter-spacing:0.06em;">${org.invite_code}</code></span>`
            : '';

        return `
            <div class="org-card org-card-expandable" id="org-card-${org.id}" data-org-id="${org.id}">
                <div class="org-card-header" onclick="window.toggleOrgCard('${org.id}')" style="display: flex; align-items: center; gap: 1rem; width: 100%;">
                    <div class="org-avatar" style="background:${color}; width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 800; color: white;">${initial}</div>
                    <div class="org-card-info" style="flex: 1;">
                        <div class="org-card-name" style="font-weight: 700;">${org.name}${codeChip}</div>
                        <div class="org-card-role" id="org-member-count-${org.id}" style="font-size: 0.75rem; color: #94a3b8;">
                            ${canManage ? 'Manage members' : 'View members'}
                        </div>
                    </div>
                    <span class="role-badge ${role}">${role}</span>
                    <i data-lucide="chevron-down" class="org-card-expand-icon" style="width:16px;height:16px; transition: transform 0.2s;"></i>
                </div>
                <div class="org-member-panel" id="org-member-panel-${org.id}" style="display: none; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #e2e8f0;">
                    ${canManage ? `
                    <div style="margin-bottom: 1.5rem; display: flex; align-items: flex-start; gap: 1rem; padding-bottom: 1rem; border-bottom: 1px dashed #e2e8f0;">
                        <div style="flex: 1;">
                            <label style="display: block; font-size: 0.7rem; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 0.25rem;">Brand Color</label>
                            <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
                                ${ORG_COLORS.map(c => `
                                    <div onclick="event.stopPropagation(); window.updateOrgColor('${org.id}', '${c}')" 
                                         style="width: 20px; height: 20px; border-radius: 4px; background: ${c}; cursor: pointer; border: 2px solid ${c === org.color ? 'var(--primary)' : 'transparent'};">
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        ${isOwner ? `
                        <div style="flex-shrink: 0;">
                            <button class="btn btn-alert btn-sm" onclick="event.stopPropagation(); window.deleteOrganization('${org.id}', '${org.name.replace(/'/g, "\\'")}')" style="padding: 0.3rem 0.6rem; font-size: 0.7rem;">
                                <i data-lucide="trash-2" style="width:12px;height:12px;"></i> Delete
                            </button>
                        </div>
                        ` : ''}
                    </div>
                    ` : ''}
                    <div id="member-list-${org.id}">
                        <div class="member-skeleton" style="height: 50px; background: var(--surface); border-radius: 8px;"></div>
                    </div>
                </div>
            </div>`;
    }).join('');
    if (window.lucide) window.lucide.createIcons();
}

export function buildMemberPanel(orgId, panel, members, userOrgs) {
    const org = userOrgs.find(o => o.id === orgId);
    const myRole = org?.role || 'viewer';
    const canEdit = myRole === 'owner';

    panel.innerHTML = members.map(m => {
        const initial = (m.email || '?')[0].toUpperCase();
        const color = getOrgColor(m.email || m.uid);
        const role = m.role || 'viewer';
        const isMe = m.uid === auth?.currentUser?.uid;
        const isOwner = role === 'owner';
        const editBlocked = isMe || (isOwner && myRole !== 'owner');

        const adminActive = role === 'admin' ? 'active admin' : '';
        const viewerActive = (role === 'viewer' || role === 'member') ? 'active viewer' : '';

        return `
            <div class="member-row" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0;">
                <div style="background:${color}; width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-size: 0.8rem; font-weight: 800;">${initial}</div>
                <div style="flex: 1; font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${m.email}${isMe ? ' (you)' : ''}</div>
                <div style="display: flex; gap: 0.25rem;">
                    ${isOwner ? '<span class="role-pill active owner">Owner</span>' : (
                role === 'admin'
                    ? `<button class="role-pill ${adminActive}" onclick="window.setMemberRole('${orgId}','${m.uid}','viewer')" ${!canEdit || editBlocked ? 'disabled' : ''}>Revoke Admin</button>`
                    : `<button class="role-pill ${viewerActive}" onclick="window.setMemberRole('${orgId}','${m.uid}','admin')" ${!canEdit || editBlocked ? 'disabled' : ''}>Grant Admin</button>`
            )}
                </div>
            </div>`;
    }).join('');
}