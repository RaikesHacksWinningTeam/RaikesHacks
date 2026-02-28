import { auth } from './firebase-config.js';

const ORG_COLORS = ['#635bff', '#0ea5e9', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#ec4899'];

export function getOrgColor(name) {
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

export function renderDashboard(state) {
    const dashboardContainer = document.getElementById('org-dashboard-container');
    if (!dashboardContainer) return;

    if (state.allOrganizations.length === 0) {
        dashboardContainer.innerHTML = `
            <div style="text-align: center; padding: 4rem; color: #94a3b8; grid-column: 1 / -1;">
                <i data-lucide="building-2" style="width: 48px; height: 48px; margin-bottom: 1rem;"></i>
                <p>No organizations found.</p>
            </div>`;
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    dashboardContainer.innerHTML = '';
    dashboardContainer.style.display = 'flex';
    dashboardContainer.style.flexDirection = 'column';
    dashboardContainer.style.overflowY = 'auto';
    dashboardContainer.style.overflowX = 'hidden';

    // Add time axis header (X axis = hours)
    const timeAxisRow = document.createElement('div');
    timeAxisRow.className = 'time-axis-row';
    timeAxisRow.style.display = 'flex';
    timeAxisRow.style.marginLeft = '180px'; // Space for org names
    timeAxisRow.style.borderBottom = '2px solid #e2e8f0';
    timeAxisRow.style.position = 'sticky';
    timeAxisRow.style.top = '0';
    timeAxisRow.style.background = '#f8fafc';
    timeAxisRow.style.zIndex = '20';
    timeAxisRow.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';

    for (let i = 0; i < 24; i++) {
        const hourLabel = document.createElement('div');
        hourLabel.style.flex = '1';
        hourLabel.style.textAlign = 'center';
        hourLabel.style.fontSize = '0.75rem';
        hourLabel.style.fontWeight = 'bold';
        hourLabel.style.color = '#64748b';
        hourLabel.style.padding = '0.75rem 0';
        hourLabel.style.borderLeft = i === 0 ? 'none' : '1px solid #e2e8f0';
        hourLabel.innerText = `${i}:00`;
        timeAxisRow.appendChild(hourLabel);
    }
    dashboardContainer.appendChild(timeAxisRow);

    // Rows for each Org (Y axis = orgs)
    state.allOrganizations.forEach(org => {
        const row = document.createElement('div');
        row.className = 'org-timeline-row';
        row.style.display = 'flex';
        row.style.borderBottom = '1px solid #e2e8f0';
        row.style.minHeight = '120px'; // Make hours block as big as possible
        row.style.position = 'relative';
        row.style.background = '#ffffff';
        row.style.transition = 'background 0.2s ease';

        row.onmouseenter = () => { row.style.background = '#fcfcfc'; };
        row.onmouseleave = () => { row.style.background = '#ffffff'; };

        const orgLabel = document.createElement('div');
        orgLabel.style.width = '180px';
        orgLabel.style.flexShrink = '0';
        orgLabel.style.padding = '1.5rem 1rem';
        orgLabel.style.fontWeight = '800';
        orgLabel.style.fontSize = '1.1rem';
        orgLabel.style.borderRight = '2px solid #e2e8f0';
        orgLabel.style.background = '#ffffff';
        orgLabel.style.display = 'flex';
        orgLabel.style.alignItems = 'center';
        orgLabel.style.justifyContent = 'center';
        orgLabel.style.textAlign = 'center';
        orgLabel.style.color = 'var(--primary)';
        orgLabel.style.zIndex = '10';
        orgLabel.innerText = org.name;
        row.appendChild(orgLabel);

        const eventsContainer = document.createElement('div');
        eventsContainer.style.flex = '1';
        eventsContainer.style.position = 'relative';
        eventsContainer.style.background = 'transparent';

        // Add 24-hour grid lines
        for (let i = 0; i < 24; i++) {
            const gridLine = document.createElement('div');
            gridLine.style.position = 'absolute';
            gridLine.style.left = `${(i / 24) * 100}%`;
            gridLine.style.top = '0';
            gridLine.style.bottom = '0';
            gridLine.style.borderLeft = i === 0 ? 'none' : '1px dashed #e2e8f0';
            gridLine.style.pointerEvents = 'none';
            eventsContainer.appendChild(gridLine);
        }

        const orgEvents = state.events.filter(e => e.org_id === org.id);
        orgEvents.forEach(event => {
            const startDate = new Date(event.start);
            const endDate = new Date(event.end);

            const startHours = startDate.getHours() + startDate.getMinutes() / 60;
            const endHours = endDate.getHours() + endDate.getMinutes() / 60;

            const leftPercent = (startHours / 24) * 100;
            const widthPercent = ((endHours - startHours) / 24) * 100;

            const orgColor = getOrgColor(org.name || org.id);

            const eventEl = document.createElement('div');
            eventEl.className = 'event-card timeline-event';
            eventEl.style.position = 'absolute';
            eventEl.style.left = `calc(${leftPercent}% + 2px)`; // padding adjustment
            eventEl.style.width = `calc(${widthPercent}% - 4px)`;
            eventEl.style.top = '12px';
            eventEl.style.bottom = '12px';
            eventEl.style.backgroundColor = orgColor;
            eventEl.style.color = 'white';
            eventEl.style.borderRadius = '10px';
            eventEl.style.padding = '10px 14px';
            eventEl.style.overflow = 'hidden';
            eventEl.style.cursor = 'pointer';
            eventEl.style.boxShadow = '0 6px 12px rgba(0,0,0,0.15)';
            eventEl.style.display = 'flex';
            eventEl.style.flexDirection = 'column';
            eventEl.style.justifyContent = 'center';
            eventEl.style.transition = 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)';

            const title = event.title;
            const timeText = `${startDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - ${endDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;

            eventEl.innerHTML = `
                <div style="font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 1.05rem; letter-spacing: 0.02em; margin-bottom: 4px;">${title}</div>
                <div class="time-text" style="font-size: 0.8rem; font-weight: 600; opacity: 0.9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    <i data-lucide="clock" style="width: 12px; height: 12px; display: inline-block; vertical-align: middle; margin-right: 2px;"></i>${timeText}
                </div>
            `;

            eventEl.onmouseenter = () => {
                eventEl.style.transform = 'translateY(-2px) scale(1.01)';
                eventEl.style.boxShadow = '0 10px 20px rgba(0,0,0,0.2)';
                eventEl.style.zIndex = '30';
                eventEl.style.filter = 'brightness(1.1)';
            };
            eventEl.onmouseleave = () => {
                eventEl.style.transform = 'translateY(0) scale(1)';
                eventEl.style.boxShadow = '0 6px 12px rgba(0,0,0,0.15)';
                eventEl.style.zIndex = '10';
                eventEl.style.filter = 'brightness(1)';
            };

            eventEl.onclick = (e) => {
                e.stopPropagation();
                const myOrg = state.userOrgs.find(o => o.id === event.org_id);
                const myRole = myOrg?.role || 'viewer';
                if (['admin', 'owner'].includes(myRole)) {
                    if (window.editEvent) window.editEvent(event.id);
                }
            };

            eventsContainer.appendChild(eventEl);
        });

        row.appendChild(eventsContainer);
        dashboardContainer.appendChild(row);
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
                < div class="org-empty" >
                <i data-lucide="building-2" style="width:40px;height:40px;opacity:0.3;margin: 0 auto 0.75rem; display: block;"></i>
                <p>You haven't joined any organizations yet.</p>
            </div > `;
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    container.innerHTML = userOrgs.map(org => {
        const initial = (org.name || '?')[0].toUpperCase();
        const color = getOrgColor(org.name || org.id);
        const role = org.role || 'viewer';
        const canManage = ['owner', 'admin'].includes(role);
        const isOwner = role === 'owner';
        const codeChip = org.invite_code
            ? `< span style = "font-size:0.7rem;color:#94a3b8;margin-left:0.35rem;" >· <code style="color:var(--secondary);letter-spacing:0.06em;">${org.invite_code}</code></span > `
            : '';

        return `
                < div class="org-card org-card-expandable" id = "org-card-${org.id}" data - org - id="${org.id}" >
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
        </div > `;
    }).join('');
    if (window.lucide) window.lucide.createIcons();
}

export function buildMemberPanel(orgId, panel, members, userOrgs) {
    const org = userOrgs.find(o => o.id === orgId);
    const myRole = org?.role || 'viewer';
    const canEdit = ['owner', 'admin'].includes(myRole);

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
                < div class="member-row" style = "display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0;" >
            <div style="background:${color}; width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-size: 0.8rem; font-weight: 800;">${initial}</div>
            <div style="flex: 1; font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${m.email}${isMe ? ' (you)' : ''}</div>
            <div style="display: flex; gap: 0.25rem;">
                ${isOwner ? '<span class="role-pill active owner">Owner</span>' : (
                role === 'admin'
                    ? `<button class="role-pill ${adminActive}" onclick="window.setMemberRole('${orgId}','${m.uid}','viewer')" ${!canEdit || editBlocked ? 'disabled' : ''}>Revoke Admin</button>`
                    : `<button class="role-pill ${viewerActive}" onclick="window.setMemberRole('${orgId}','${m.uid}','admin')" ${!canEdit || editBlocked ? 'disabled' : ''}>Grant Admin</button>`
            )}
            </div>
        </div > `;
    }).join('');
}
