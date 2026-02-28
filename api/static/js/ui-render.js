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
            <div style="text-align: center; padding: 4rem; color: #94a3b8;">
                <i data-lucide="building-2" style="width: 48px; height: 48px; margin-bottom: 1rem;"></i>
                <p>No organizations found.</p>
            </div>`;
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    dashboardContainer.innerHTML = `
        <table style="width: 100%; border-collapse: separate; border-spacing: 0 0.5rem;">
            <thead>
                <tr style="text-align: left; color: #64748b; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em;">
                    <th style="padding: 1rem;">Organization</th>
                    <th style="padding: 1rem;">Events</th>
                    <th style="padding: 1rem;">Status</th>
                    <th style="padding: 1rem;"></th>
                </tr>
            </thead>
            <tbody>
                ${state.allOrganizations.map(org => {
        const orgEvents = state.events
            .filter(e => e.org_id === org.id)
            .sort((a, b) => new Date(a.start) - new Date(b.start));
        const isExpanded = state.expandedOrgId === org.id;
        const activeNow = orgEvents.some(e => {
            const start = new Date(e.start);
            const end = new Date(e.end);
            return start <= state.currentTime && end >= state.currentTime;
        });

        return `
                        <tr onclick="window.toggleOrgExpansion('${org.id}')" style="background: white; cursor: pointer; transition: all 0.2s; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                            <td style="padding: 1rem; border-top-left-radius: 8px; border-bottom-left-radius: 8px;">
                                <div style="display: flex; align-items: center; gap: 1rem;">
                                    <div style="width: 32px; height: 32px; border-radius: 8px; background:${getOrgColor(org.name || org.id)}; color: white; display: flex; align-items: center; justify-content: center; font-weight: 600;">${(org.name || '?')[0].toUpperCase()}</div>
                                    <span style="font-weight: 600; color: #1e293b;">${org.name}</span>
                                </div>
                            </td>
                            <td style="padding: 1rem; color: #64748b;">${orgEvents.length} scheduled</td>
                            <td style="padding: 1rem;">
                                ${activeNow ? '<span style="background: #dcfce7; color: #166534; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600;">Live Now</span>' : '<span style="background: #f1f5f9; color: #475569; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600;">Inactive</span>'}
                            </td>
                            <td style="padding: 1rem; text-align: right; border-top-right-radius: 8px; border-bottom-right-radius: 8px;">
                                <i data-lucide="${isExpanded ? 'chevron-up' : 'chevron-down'}" style="color: #94a3b8;"></i>
                            </td>
                        </tr>
                        ${isExpanded ? `
                            <tr>
                                <td colspan="4" style="padding: 0 1rem 1rem 1rem;">
                                    <div style="background: #f8fafc; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px; padding: 1rem; border: 1px solid #e2e8f0; border-top: none;">
                                        ${orgEvents.length === 0 ? '<p style="color: #94a3b8; text-align: center; padding: 1rem;">No events scheduled.</p>' : orgEvents.map(e => {
            const room = state.rooms.find(r => r.id === e.room_id);
            const myOrg = state.userOrgs.find(o => o.id === e.org_id);
            const myRole = myOrg?.role || 'viewer';
            const canEdit = ['admin', 'owner'].includes(myRole);

            const eventDate = e.date ? new Date(e.date + 'T00:00:00') : new Date(e.start);
            const dateDisplay = eventDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

            return `
                                                <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem; background: white; border-radius: 8px; margin-bottom: 0.5rem; border: 1px solid #e2e8f0;">
                                                    <div style="font-size: 0.85rem; color: #64748b; width: 180px;">
                                                        <div style="font-weight: 700; color: #1e293b;">${dateDisplay}</div>
                                                        ${new Date(e.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(e.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                    <div style="flex: 1;">
                                                        <div style="font-weight: 600; color: #1e293b;">${e.title}</div>
                                                        <div style="font-size: 0.8rem; color: #94a3b8;"><i data-lucide="map-pin" style="width: 12px; height: 12px; display: inline-block;"></i> ${room ? room.name : 'Unknown Room'}</div>
                                                    </div>
                                                    <div style="display: flex; gap: 0.5rem;">
                                                        <button onclick="event.stopPropagation(); window.openCalendarModal('${e.id}')" style="background: none; border: none; color: #94a3b8; cursor: pointer; padding: 0.25rem;">
                                                            <i data-lucide="calendar" style="width: 16px; height: 16px;"></i>
                                                        </button>
                                                        ${canEdit ? `
                                                            <button onclick="event.stopPropagation(); window.editEvent('${e.id}')" style="background: none; border: none; color: #94a3b8; cursor: pointer; padding: 0.25rem;">
                                                                <i data-lucide="edit-3" style="width: 16px; height: 16px;"></i>
                                                            </button>
                                                        ` : ''}
                                                    </div>
                                                </div>
                                            `;
        }).join('')}
                                    </div>
                                </td>
                            </tr>
                        ` : ''}
                    `;
    }).join('')}
            </tbody>
        </table>
    `;
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
        const color = getOrgColor(org.name || org.id);
        const role = org.role || 'viewer';
        const canManage = ['owner', 'admin'].includes(role);
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
                <div class="member-skeleton" style="height: 50px; background: #f1f5f9; border-radius: 8px;"></div>
            </div>
        </div>`;
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
