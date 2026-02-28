// Firebase Configuration - Passed from Flask via index.html
const firebaseConfig = window.firebaseConfig;

// Import Firebase SDK (Modular v10+)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, addDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Initialize Firebase
let db;
let auth;

try {
    if (firebaseConfig && firebaseConfig.apiKey) {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
    }
} catch (e) {
    console.error("Firebase initialization error:", e);
}

// Sign out logic
const btnLogout = document.getElementById('btn-logout');
if (btnLogout) {
    btnLogout.onclick = () => {
        signOut(auth).then(() => {
            window.location.href = '/logout'; // Clear Flask session too
        }).catch(e => console.error("Sign out error:", e));
    };
}

// App State
let rooms = [];
let events = [];
let allOrganizations = [];
let userOrgs = [];
let expandedOrgId = null;
let currentTime = new Date();

// Initialize UI components
lucide.createIcons();

const displayTimeElement = document.getElementById('display-time');
const dashboardContainer = document.getElementById('org-dashboard-container');
const adminModal = document.getElementById('admin-modal');
const eventForm = document.getElementById('event-form');
const eventRoomSelect = document.getElementById('event-room');
const eventOrgSelect = document.getElementById('event-org');

// --- Real-time Firestore Listeners ---
if (db) {
    onSnapshot(collection(db, "rooms"), (snapshot) => {
        rooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderDashboard();
    });

    onSnapshot(collection(db, "events"), (snapshot) => {
        events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderDashboard();
    });

    onSnapshot(collection(db, "organizations"), (snapshot) => {
        allOrganizations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderDashboard();
    });
}

// --- Dashboard Rendering ---
function renderDashboard() {
    if (!dashboardContainer) return;

    if (allOrganizations.length === 0) {
        dashboardContainer.innerHTML = `
            <div style="text-align: center; padding: 4rem; color: #94a3b8;">
                <i data-lucide="building-2" style="width: 48px; height: 48px; margin-bottom: 1rem;"></i>
                <p>No organizations found.</p>
            </div>`;
        lucide.createIcons();
        return;
    }

    svg.selectAll('g.room')
        .data(rooms)
        .enter()
        .append('g')
        .attr('class', d => `room ${selectedRoomId === d.id ? 'active' : ''}`)
        .on('click', (event, d) => selectRoom(d.id))
        .each(function (d) {
            const g = d3.select(this);
            const color = getRoomColor(d.id);
            const isActive = selectedRoomId === d.id;

            g.append('rect')
                .attr('x', d.x)
                .attr('y', d.y)
                .attr('width', d.width)
                .attr('height', d.height)
                .attr('fill', color)
                .attr('stroke', isActive ? 'var(--accent)' : '#cbd5e1')
                .attr('stroke-width', isActive ? '3' : '1')
                .attr('rx', 8)
                .style('transition', 'all 0.2s');

            g.append('text')
                .attr('x', d.x + d.width / 2)
                .attr('y', d.y + d.height / 2)
                .attr('text-anchor', 'middle')
                .attr('dominant-baseline', 'middle')
                .attr('font-size', '13')
                .attr('fill', (color === '#f1f5f9' || color === '#eef2ff') ? '#475569' : 'white')
                .attr('pointer-events', 'none')
                .attr('font-weight', '600')
                .text(d.name);
        });
}

function getRoomColor(roomId) {
    const activeEvents = events.filter(e => {
        const start = new Date(e.start);
        const end = new Date(e.end);
        return e.room_id === roomId && start <= currentTime && end >= currentTime;
    });

    if (activeEvents.length === 0) return '#f1f5f9';
    if (activeEvents.some(e => e.type === 'fire_drill')) return '#ef4444';
    if (activeEvents.some(e => e.type === 'maintenance')) return '#f59e0b';
    return 'var(--heatmap-mid)';
}

// --- Interaction Logic ---
function selectRoom(roomId) {
    selectedRoomId = roomId;
    renderFloorPlan();
    updateSidePanel();
}

function updateSidePanel() {
    const room = rooms.find(r => r.id === selectedRoomId);
    if (!room) {
        sidePanelEmpty.classList.remove('hidden');
        sidePanelContent.classList.add('hidden');
        return;
    }

    sidePanelEmpty.classList.add('hidden');
    sidePanelContent.classList.remove('hidden');

    const roomEvents = events.filter(e => e.room_id === room.id);
    const isLoggedIn = auth.currentUser !== null;

    sidePanelContent.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <h2 style="font-size: 1.5rem; font-weight: bold; color: var(--primary);">${room.name}</h2>
            <button id="btn-close-panel" class="btn-close"><i data-lucide="x"></i></button>
        </div>
        <div style="margin-bottom: 2rem; font-size: 0.9rem; color: #64748b;">
            <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem;">
                <i data-lucide="map-pin"></i> Floor ${room.floor}
            </div>
            <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem;">
                <i data-lucide="users"></i> Capacity: ${room.capacity}
            </div>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 1rem;">
                ${room.tags.map(tag => `<span style="background: #f1f5f9; color: #475569; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">${tag}</span>`).join('')}
            </div>
        </div>
        <section>
            <h3 style="font-size: 0.9rem; font-weight: bold; text-transform: uppercase; color: #94a3b8; margin-bottom: 1rem;">Events</h3>
            ${roomEvents.length === 0 ? '<p style="color: #94a3b8;">No events scheduled</p>' : roomEvents.map(e => `
                <div style="padding: 1rem; background: #ffffff; border-radius: 12px; margin-bottom: 1rem; border: 1px solid #e2e8f0; border-left: 4px solid var(--secondary); position: relative;">
                    <div style="font-weight: 700; color: var(--text-dark);">${e.title}</div>
                    <div style="font-size: 0.8rem; color: #64748b;">${new Date(e.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(e.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    <div style="font-size: 0.8rem; margin-top: 0.5rem;">By: ${e.organizer}</div>
                    ${isLoggedIn ? `
                        <button onclick="editEvent('${e.id}')" style="position: absolute; top: 0.5rem; right: 0.5rem; background: none; border: none; color: #94a3b8; cursor: pointer; padding: 0.25rem;" title="Edit Event">
                            <i data-lucide="edit-3" style="width: 16px; height: 16px;"></i>
                        </button>
                    ` : ''}
                </div>
            `).join('')}
        </section>
    `;
    lucide.createIcons();
}

window.toggleOrgExpansion = (orgId) => {
    expandedOrgId = expandedOrgId === orgId ? null : orgId;
    renderDashboard();
};

// --- Calendar Logic ---
const calendarModal = document.getElementById('calendar-modal');
const calendarLinkInput = document.getElementById('calendar-link-input');
const btnCopyCalendarLink = document.getElementById('btn-copy-calendar-link');

window.openCalendarModal = (eventId) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return;

    const startDate = new Date(event.start).toISOString().replace(/-|:|\.\d+/g, "");
    const endDate = new Date(event.end).toISOString().replace(/-|:|\.\d+/g, "");

    const icsContent = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//RaikesHacks2026//BuildingEvents//EN",
        "BEGIN:VEVENT",
        `UID:${event.id}@raikeshacks.com`,
        `DTSTAMP:${new Date().toISOString().replace(/-|:|\.\d+/g, "")}`,
        `DTSTART:${startDate}`,
        `DTEND:${endDate}`,
        `SUMMARY:${event.title}`,
        `DESCRIPTION:Event organized by ${event.organizer}`,
        `LOCATION:Room: ${event.room_id}`,
        "END:VEVENT",
        "END:VCALENDAR"
    ].join("\r\n");

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    calendarLinkInput.value = url;
    calendarModal.classList.remove('hidden');
    lucide.createIcons();
};

if (document.getElementById('btn-close-calendar-modal')) {
    document.getElementById('btn-close-calendar-modal').onclick = () => calendarModal.classList.add('hidden');
}
if (document.getElementById('btn-close-calendar-modal-footer')) {
    document.getElementById('btn-close-calendar-modal-footer').onclick = () => calendarModal.classList.add('hidden');
}

if (btnCopyCalendarLink) {
    btnCopyCalendarLink.onclick = () => {
        calendarLinkInput.select();
        navigator.clipboard.writeText(calendarLinkInput.value).then(() => {
            const originalHtml = btnCopyCalendarLink.innerHTML;
            btnCopyCalendarLink.innerHTML = '<i data-lucide="check" style="width: 18px; height: 18px;"></i> Copied!';
            lucide.createIcons();
            setTimeout(() => {
                btnCopyCalendarLink.innerHTML = originalHtml;
                lucide.createIcons();
            }, 2000);
        });
    };
}

// --- Admin Event Logic ---
window.editEvent = (eventId) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return;

    document.getElementById('modal-title').textContent = 'Edit Event';
    document.getElementById('event-id').value = event.id;
    document.getElementById('event-title').value = event.title;
    document.getElementById('event-room').innerHTML = rooms.map(r => `<option value="${r.id}" ${r.id === event.room_id ? 'selected' : ''}>${r.name}</option>`).join('');

    const startStr = new Date(event.start).toTimeString().slice(0, 5);
    const endStr = new Date(event.end).toTimeString().slice(0, 5);
    document.getElementById('event-start').value = startStr;
    document.getElementById('event-end').value = endStr;

    document.getElementById('btn-delete-event').classList.remove('hidden');
    adminModal.classList.remove('hidden');
};

document.getElementById('btn-create-event').onclick = () => {
    if (!isOrgMember()) {
        alert('You must belong to an organization to create events.');
        return;
    }
    document.getElementById('modal-title').textContent = 'Create New Event';
    document.getElementById('event-id').value = '';
    document.getElementById('event-title').value = '';
    document.getElementById('event-start').value = '';
    document.getElementById('event-end').value = '';
    document.getElementById('btn-delete-event').classList.add('hidden');
    adminModal.classList.remove('hidden');
    eventRoomSelect.innerHTML = rooms.map(r => `<option value="${r.id}">${r.name}</option>`).join('');

    adminModal.classList.remove('hidden');
};

document.getElementById('btn-close-modal').onclick = () => adminModal.classList.add('hidden');
document.getElementById('btn-cancel-modal').onclick = () => adminModal.classList.add('hidden');

document.getElementById('btn-delete-event').onclick = async () => {
    const eventId = document.getElementById('event-id').value;
    if (!eventId) return;

    if (confirm('Are you sure you want to delete this event?')) {
        try {
            await deleteDoc(doc(db, "events", eventId));
            adminModal.classList.add('hidden');
        } catch (error) {
            console.error("Error deleting event:", error);
            alert("Failed to delete event.");
        }
    }
};

// --- Helper: can current user create/edit events? ---
// Only admins and owners of an org can write events. Viewers/members are read-only.
function isOrgMember() {
    return userOrgs.some(o => o.role === 'admin' || o.role === 'owner');
}

eventForm.onsubmit = async (e) => {
    e.preventDefault();
    if (!db) {
        alert("Firestore not initialized. Update firebaseConfig in app.js.");
        return;
    }

    const eventId = document.getElementById('event-id').value;
    console.log("OnSubmit eventId:", eventId);
    const startTimeValue = document.getElementById('event-start').value;
    const endTimeValue = document.getElementById('event-end').value;

    const startDate = new Date();
    const [sH, sM] = document.getElementById('event-start').value.split(':');
    startDate.setHours(parseInt(sH), parseInt(sM), 0, 0);

    const endDate = new Date();
    const [eH, eM] = document.getElementById('event-end').value.split(':');
    endDate.setHours(parseInt(eH), parseInt(eM), 0, 0);

    const eventData = {
        room_id: document.getElementById('event-room').value,
        title: document.getElementById('event-title').value,
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        type: 'general',
        organizer: 'Staff',
        status: 'scheduled'
    };

    try {
        if (eventId) {
            console.log("Updating document:", eventId);
            // Update existing
            await updateDoc(doc(db, "events", eventId), eventData);
        } else {
            console.log("Creating new document");
            // Create new
            eventData.createdAt = serverTimestamp();
            await addDoc(collection(db, "events"), eventData);
        }
        adminModal.classList.add('hidden');
    } catch (error) {
        console.error("Error saving event:", error);
        alert("Failed to save event to Firestore.");
    }
};

// --- Organization UI ---
const ORG_COLORS = ['#635bff', '#0ea5e9', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#ec4899'];
function orgColor(name) {
    let hash = 0;
    for (let c of name) hash = c.charCodeAt(0) + ((hash << 5) - hash);
    return ORG_COLORS[Math.abs(hash) % ORG_COLORS.length];
}

function showToast(message, type = 'success') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const icon = type === 'success' ? '✓' : '✕';
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

async function fetchUserOrgs() {
    try {
        let res = await fetch('/api/user/orgs');
        if (res.status === 401) {
            const firebaseUser = auth?.currentUser;
            if (!firebaseUser) return;
            const idToken = await getIdToken(firebaseUser, true);
            await fetch('/api/auth/google', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken })
            });
            res = await fetch('/api/user/orgs');
        }
        if (!res.ok) return;
        const data = await res.json();
        userOrgs = data.orgs || [];
        updateOrgSwitcher();
        renderMyOrgsPanel();
        updateOrgSwitcher();
    } catch (e) {
        console.warn('Could not load orgs:', e);
    }
}

function renderMyOrgsPanel() {
    const container = document.getElementById('org-list-container');
    if (!container) return;

    if (userOrgs.length === 0) {
        container.innerHTML = `
            <div class="org-empty">
                <i data-lucide="building-2" style="width:40px;height:40px;opacity:0.3;margin: 0 auto 0.75rem; display: block;"></i>
                <p>You haven't joined any organizations yet.</p>
            </div>`;
        lucide.createIcons();
        return;
    }

    container.innerHTML = userOrgs.map(org => {
        const initial = (org.name || '?')[0].toUpperCase();
        const color = orgColor(org.name || org.id);
        const role = org.role || 'viewer';
        const isPending = role === 'pending';
        const canManage = ['owner', 'admin'].includes(role);
        const codeChip = org.invite_code
            ? `<span style="font-size:0.7rem;color:#94a3b8;margin-left:0.35rem;">· <code style="color:var(--secondary);letter-spacing:0.06em;">${org.invite_code}</code></span>`
            : '';

        const subtitle = isPending
            ? `<span style="color:#b45309;font-size:0.78rem;display:flex;align-items:center;gap:0.3rem;"><i data-lucide="clock" style="width:12px;height:12px;"></i> Waiting for admin approval</span>`
            : (canManage ? 'Click to manage members' : 'Click to view members');

        return `
        <div class="org-card org-card-expandable" id="org-card-${org.id}" data-org-id="${org.id}">
            <div class="org-card-header" onclick="toggleOrgCard('${org.id}')">
                <div class="org-avatar" style="background:${color};">${initial}</div>
                <div class="org-card-info">
                    <div class="org-card-name">${org.name}${codeChip}</div>
                    <div class="org-card-role" id="org-member-count-${org.id}">
                        ${canManage ? 'Click to manage members' : 'Click to view members'}
                    </div>
                </div>
                <span class="role-badge ${role}">${role}</span>
                <i data-lucide="chevron-down" class="org-card-expand-icon" style="width:16px;height:16px;"></i>
            </div>
            <div class="org-member-panel" id="org-member-panel-${org.id}" style="display: none; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #e2e8f0;">
                <div class="member-skeleton" style="height: 50px; background: #f1f5f9; border-radius: 8px;"></div>
            </div>
        </div>`;
    }).join('');
    lucide.createIcons();
}

const _memberCache = {};
async function toggleOrgCard(orgId) {
    const card = document.getElementById(`org-card-${orgId}`);
    const panel = document.getElementById(`org-member-panel-${orgId}`);
    if (!card || !panel) return;

    const isOpen = panel.style.display === 'block';
    document.querySelectorAll('.org-member-panel').forEach(p => p.style.display = 'none');
    document.querySelectorAll('.org-card-expand-icon').forEach(i => i.style.transform = 'rotate(0deg)');

    if (!isOpen) {
        panel.style.display = 'block';
        card.querySelector('.org-card-expand-icon').style.transform = 'rotate(180deg)';
        if (!_memberCache[orgId]) {
            const res = await fetch(`/api/orgs/${orgId}/members`);
            if (res.ok) {
                const data = await res.json();
                _memberCache[orgId] = data.members;
            }
        }
        buildMemberPanel(orgId, panel);
    }
}
window.toggleOrgCard = toggleOrgCard;

function buildMemberPanel(orgId, panel) {
    const members = _memberCache[orgId] || [];
    const org = userOrgs.find(o => o.id === orgId);
    const myRole = org?.role || 'viewer';
    const canEdit = ['owner', 'admin'].includes(myRole);
    const members = _memberCache[orgId] || [];

    // Update subtitle count
    const subtitle = document.getElementById(`org-member-count-${orgId}`);
    if (subtitle) subtitle.textContent = `${members.length} member${members.length !== 1 ? 's' : ''}`;

    if (members.length === 0) {
        panel.innerHTML = `<p style="color:#94a3b8;font-size:0.82rem;text-align:center;padding:0.5rem;">No members yet.</p>`;
        return;
    }

    panel.innerHTML = members.map(m => {
        const initial = (m.email || '?')[0].toUpperCase();
        const color = orgColor(m.email || m.uid);
        const role = m.role || 'viewer';
        const isOwner = role === 'owner';
        const isMe = m.uid === (window._currentUid || '');

        // Disable editing yourself, or editing an owner if you're not owner
        const editBlocked = isMe || (isOwner && myRole !== 'owner');

        const adminActive = role === 'admin' ? 'active admin' : '';
        const viewerActive = role === 'viewer' || role === 'member' ? 'active viewer' : '';
        const ownerBadge = isOwner
            ? `<span class="role-pill active owner" style="pointer-events:none;">Owner</span>`
            : `
              <button class="role-pill ${adminActive}"
                      data-org="${orgId}" data-uid="${m.uid}" data-role="admin"
                      ${editBlocked || !canEdit ? 'disabled' : ''}
                      onclick="setMemberRole('${orgId}','${m.uid}','admin',this)">Admin</button>
              <button class="role-pill ${viewerActive}"
                      data-org="${orgId}" data-uid="${m.uid}" data-role="viewer"
                      ${editBlocked || !canEdit ? 'disabled' : ''}
                      onclick="setMemberRole('${orgId}','${m.uid}','viewer',this)">Viewer</button>`;

        return `
        <div class="member-row" id="member-row-${orgId}-${m.uid}">
            <div class="member-avatar-sm" style="background:${color};">${initial}</div>
            <div class="member-email" title="${m.email}">${m.email}${isMe ? ' <span style="color:#94a3b8;">(you)</span>' : ''}</div>
            <div class="member-role-controls">${ownerBadge}</div>
        </div>`;
    }).join('');
}

async function setMemberRole(orgId, targetUid, newRole, clickedBtn) {
    // Optimistic: update all pills in this row immediately
    const row = document.getElementById(`member-row-${orgId}-${targetUid}`);
    const pills = row?.querySelectorAll('.role-pill:not([style])');
    pills?.forEach(p => {
        p.classList.remove('active', 'admin', 'viewer');
        p.classList.add('loading');
        p.disabled = true;
    });

    try {
        const res = await fetch(`/api/orgs/${orgId}/members`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid, role })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Role update failed');

        // Update cache so re-opens show correct state
        const members = _memberCache[orgId];
        if (members) {
            const m = members.find(m => m.uid === targetUid);
            if (m) m.role = newRole;
        }
        showToast(`Role updated to ${newRole}`, 'success');

    } catch (err) {
        showToast(err.message, 'error');
    }

    // Re-render the panel to reflect new state
    const panel = document.getElementById(`org-member-panel-${orgId}`);
    if (panel) buildMemberPanel(orgId, panel);
}

// Expose to global scope (called from inline onclick)
window.toggleOrgCard = toggleOrgCard;
window.setMemberRole = setMemberRole;
window.deleteOrg = deleteOrg;
window.approveMember = approveMember;
window.rejectMember = rejectMember;
window.requestAdminAccess = requestAdminAccess;

function switchOrgTab(tabId) {
    document.querySelectorAll('.org-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
    document.querySelectorAll('.org-tab-panel').forEach(p => p.classList.toggle('active', p.id === `panel-${tabId}`));
}
document.querySelectorAll('.org-tab').forEach(tab => tab.onclick = () => switchOrgTab(tab.dataset.tab));

const orgModal = document.getElementById('org-modal');
document.getElementById('btn-open-org-modal').onclick = () => {
    orgModal.classList.remove('hidden');
    switchOrgTab(defaultTab);
    lucide.createIcons();
}
function closeOrgModal() { orgModal.classList.add('hidden'); }

if (btnOpenOrg) btnOpenOrg.onclick = () => openOrgModal();
if (btnCloseOrg) btnCloseOrg.onclick = closeOrgModal;

// Close on backdrop click
orgModal.addEventListener('click', (e) => {
    if (e.target === orgModal) closeOrgModal();
});

// --- Tab switching ---
function switchOrgTab(tabId) {
    document.querySelectorAll('.org-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tabId);
    });
    document.querySelectorAll('.org-tab-panel').forEach(p => {
        p.classList.toggle('active', p.id === `panel-${tabId}`);
    });
    lucide.createIcons();
}

document.querySelectorAll('.org-tab').forEach(tab => {
    tab.addEventListener('click', () => switchOrgTab(tab.dataset.tab));
});

// --- Create Org ---
const createOrgForm = document.getElementById('create-org-form');
const newOrgInviteBox = document.getElementById('new-org-invite-box');
const newOrgCodeEl = document.getElementById('new-org-code');
const btnCopyNewCode = document.getElementById('btn-copy-new-code');
const btnCreateSubmit = document.getElementById('btn-create-org-submit');

if (createOrgForm) {
    createOrgForm.onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('org-name-input').value.trim();
        if (!name) return;

        btnCreateSubmit.disabled = true;
        btnCreateSubmit.innerHTML = '<i data-lucide="loader-2"></i> Creating…';
        lucide.createIcons();

        try {
            const res = await fetch('/api/orgs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Failed to create organization');

            // Show invite code
            newOrgCodeEl.textContent = data.invite_code || '------';
            newOrgInviteBox.classList.remove('hidden');
            btnCreateSubmit.innerHTML = '<i data-lucide="check"></i> Organization Created!';
            lucide.createIcons();

            // Add to local list
            userOrgs.push({ id: data.org_id, name: data.name, role: 'owner', invite_code: data.invite_code });
            renderMyOrgsPanel();
            updateOrgSwitcher();
            showToast(`"${data.name}" created successfully!`, 'success');

        } catch (err) {
            showToast(err.message, 'error');
            btnCreateSubmit.disabled = false;
            btnCreateSubmit.innerHTML = '<i data-lucide="sparkles"></i> Create Organization';
            lucide.createIcons();
        }
    };
}

// Copy invite code to clipboard
if (btnCopyNewCode) {
    btnCopyNewCode.onclick = () => {
        const code = newOrgCodeEl.textContent;
        navigator.clipboard.writeText(code).then(() => showToast('Invite code copied!', 'success'));
    };
}

// --- Join Org ---
const joinOrgForm = document.getElementById('join-org-form');
const btnJoinSubmit = document.getElementById('btn-join-org-submit');

if (joinOrgForm) {
    joinOrgForm.onsubmit = async (e) => {
        e.preventDefault();
        const rawCode = document.getElementById('org-invite-code-input').value.trim().toUpperCase();
        if (!rawCode) return;

        btnJoinSubmit.disabled = true;
        btnJoinSubmit.innerHTML = '<i data-lucide="loader-2"></i> Joining…';
        lucide.createIcons();

        try {
            const res = await fetch('/api/orgs/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invite_code: rawCode })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Invalid invite code');

            if (data.status === 'already_member') {
                showToast(`You're already a ${data.role} in "${data.name}"`, 'success');
            } else {
                userOrgs.push({ id: data.org_id, name: data.name, role: data.role });
                renderMyOrgsPanel();
                updateOrgSwitcher();
                showToast(`Joined "${data.name}" as ${data.role}!`, 'success');
                document.getElementById('org-invite-code-input').value = '';
                switchOrgTab('my-orgs');
            }

        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            btnJoinSubmit.disabled = false;
            btnJoinSubmit.innerHTML = '<i data-lucide="log-in"></i> Join Organization';
            lucide.createIcons();
        }
    };
}

// Auth state
onAuthStateChanged(auth, (user) => {
    const createBtn = document.getElementById('btn-create-event');
    const loginLink = document.getElementById('btn-login-page');
    const logoutBtn = document.getElementById('btn-logout');
    const orgSwitcher = document.getElementById('btn-open-org-modal');

    if (user) {
        window._currentUid = user.uid; // used by member panel to label "(you)"
        createBtn?.classList.remove('hidden');
        loginLink?.classList.add('hidden');
        logoutBtn?.classList.remove('hidden');
        orgSwitcher?.classList.remove('hidden');
        fetchUserOrgs();
    } else {
        createBtn?.classList.add('hidden');
        loginLink?.classList.remove('hidden');
        logoutBtn?.classList.add('hidden');
        orgSwitcher?.classList.add('hidden');
        userOrgs = [];
        // Refresh side panel so edit buttons disappear
        if (selectedRoomId) updateSidePanel();
    }
});

function updateTimeDisplay() {
    if (displayTimeElement) {
        displayTimeElement.textContent = currentTime.toLocaleString([], { weekday: 'long', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
}
updateTimeDisplay();
