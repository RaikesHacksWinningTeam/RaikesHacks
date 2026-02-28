// Firebase Configuration - Passed from Flask via index.html
const firebaseConfig = window.firebaseConfig;

// Import Firebase SDK (Modular v10+)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut, getIdToken } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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
                ${allOrganizations.map(org => {
                    const orgEvents = events.filter(e => e.org_id === org.id);
                    const isExpanded = expandedOrgId === org.id;
                    const activeNow = orgEvents.some(e => {
                        const start = new Date(e.start);
                        const end = new Date(e.end);
                        return start <= currentTime && end >= currentTime;
                    });

                    return `
                        <tr onclick="toggleOrgExpansion('${org.id}')" style="background: white; cursor: pointer; transition: all 0.2s; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                            <td style="padding: 1rem; border-top-left-radius: 8px; border-bottom-left-radius: 8px;">
                                <div style="display: flex; align-items: center; gap: 1rem;">
                                    <div style="width: 32px; height: 32px; border-radius: 8px; background:${orgColor(org.name || org.id)}; color: white; display: flex; align-items: center; justify-content: center; font-weight: 600;">${(org.name || '?')[0].toUpperCase()}</div>
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
                                            const room = rooms.find(r => r.id === e.room_id);
                                            const isLoggedIn = auth?.currentUser !== null;
                                            return `
                                                <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem; background: white; border-radius: 8px; margin-bottom: 0.5rem; border: 1px solid #e2e8f0;">
                                                    <div style="font-size: 0.85rem; color: #64748b; width: 150px;">
                                                        ${new Date(e.start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - ${new Date(e.end).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                    </div>
                                                    <div style="flex: 1;">
                                                        <div style="font-weight: 600; color: #1e293b;">${e.title}</div>
                                                        <div style="font-size: 0.8rem; color: #94a3b8;"><i data-lucide="map-pin" style="width: 12px; height: 12px; display: inline-block;"></i> ${room ? room.name : 'Unknown Room'}</div>
                                                    </div>
                                                    <div style="display: flex; gap: 0.5rem;">
                                                        <button onclick="event.stopPropagation(); window.openCalendarModal('${e.id}')" style="background: none; border: none; color: #94a3b8; cursor: pointer; padding: 0.25rem;">
                                                            <i data-lucide="calendar" style="width: 16px; height: 16px;"></i>
                                                        </button>
                                                        ${isLoggedIn ? `
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
    
    eventOrgSelect.innerHTML = allOrganizations.map(o => `<option value="${o.id}" ${o.id === event.org_id ? 'selected' : ''}>${o.name}</option>`).join('');
    eventRoomSelect.innerHTML = rooms.map(r => `<option value="${r.id}" ${r.id === event.room_id ? 'selected' : ''}>${r.name}</option>`).join('');

    const startStr = new Date(event.start).toTimeString().slice(0, 5);
    const endStr = new Date(event.end).toTimeString().slice(0, 5);
    document.getElementById('event-start').value = startStr;
    document.getElementById('event-end').value = endStr;

    document.getElementById('btn-delete-event').classList.remove('hidden');
    adminModal.classList.remove('hidden');
};

document.getElementById('btn-create-event').onclick = () => {
    document.getElementById('modal-title').textContent = 'Create New Event';
    document.getElementById('event-id').value = '';
    document.getElementById('event-title').value = '';
    document.getElementById('event-start').value = '';
    document.getElementById('event-end').value = '';
    document.getElementById('btn-delete-event').classList.add('hidden');
    
    eventOrgSelect.innerHTML = allOrganizations.map(o => `<option value="${o.id}">${o.name}</option>`).join('');
    eventRoomSelect.innerHTML = rooms.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
    
    adminModal.classList.remove('hidden');
};

document.getElementById('btn-close-modal').onclick = () => adminModal.classList.add('hidden');
document.getElementById('btn-cancel-modal').onclick = () => adminModal.classList.add('hidden');

document.getElementById('btn-delete-event').onclick = async () => {
    const eventId = document.getElementById('event-id').value;
    if (confirm('Are you sure?')) {
        await deleteDoc(doc(db, "events", eventId));
        adminModal.classList.add('hidden');
    }
};

eventForm.onsubmit = async (e) => {
    e.preventDefault();
    const eventId = document.getElementById('event-id').value;
    const startDate = new Date();
    const [sH, sM] = document.getElementById('event-start').value.split(':');
    startDate.setHours(parseInt(sH), parseInt(sM), 0, 0);

    const endDate = new Date();
    const [eH, eM] = document.getElementById('event-end').value.split(':');
    endDate.setHours(parseInt(eH), parseInt(eM), 0, 0);

    const data = {
        org_id: eventOrgSelect.value,
        room_id: eventRoomSelect.value,
        title: document.getElementById('event-title').value,
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        organizer: 'Staff',
        status: 'scheduled'
    };

    if (eventId) {
        await updateDoc(doc(db, "events", eventId), data);
    } else {
        data.createdAt = serverTimestamp();
        await addDoc(collection(db, "events"), data);
    }
    adminModal.classList.add('hidden');
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
    } catch (e) { console.error(e); }
}

function updateOrgSwitcher() {
    const label = document.getElementById('org-switcher-label');
    if (label) {
        label.textContent = userOrgs.length > 1 ? `${userOrgs.length} Orgs` : (userOrgs[0]?.name || 'My Orgs');
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
        const canManage = ['owner', 'admin'].includes(role);
        const codeChip = org.invite_code
            ? `<span style="font-size:0.7rem;color:#94a3b8;margin-left:0.35rem;">· <code style="color:var(--secondary);letter-spacing:0.06em;">${org.invite_code}</code></span>`
            : '';

        return `
        <div class="org-card org-card-expandable" id="org-card-${org.id}" data-org-id="${org.id}">
            <div class="org-card-header" onclick="toggleOrgCard('${org.id}')" style="display: flex; align-items: center; gap: 1rem; width: 100%;">
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

    panel.innerHTML = members.map(m => {
        const initial = (m.email || '?')[0].toUpperCase();
        const color = orgColor(m.email || m.uid);
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
                ${isOwner ? '<span class="role-pill active owner">Owner</span>' : `
                    <button class="role-pill ${adminActive}" onclick="setMemberRole('${orgId}','${m.uid}','admin')" ${!canEdit || editBlocked ? 'disabled' : ''}>Admin</button>
                    <button class="role-pill ${viewerActive}" onclick="setMemberRole('${orgId}','${m.uid}','viewer')" ${!canEdit || editBlocked ? 'disabled' : ''}>Viewer</button>
                `}
            </div>
        </div>`;
    }).join('');
}

async function setMemberRole(orgId, uid, role) {
    try {
        const res = await fetch(`/api/orgs/${orgId}/members`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid, role })
        });
        if (res.ok) {
            _memberCache[orgId] = null; // force reload
            toggleOrgCard(orgId); toggleOrgCard(orgId); // quick toggle to refresh
            showToast("Role updated");
        }
    } catch (e) { console.error(e); }
}
window.setMemberRole = setMemberRole;

function switchOrgTab(tabId) {
    document.querySelectorAll('.org-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
    document.querySelectorAll('.org-tab-panel').forEach(p => p.classList.toggle('active', p.id === `panel-${tabId}`));
}
document.querySelectorAll('.org-tab').forEach(tab => tab.onclick = () => switchOrgTab(tab.dataset.tab));

const orgModal = document.getElementById('org-modal');
document.getElementById('btn-open-org-modal').onclick = () => {
    orgModal.classList.remove('hidden');
    switchOrgTab('my-orgs');
};
document.getElementById('btn-close-org-modal').onclick = () => orgModal.classList.add('hidden');
orgModal.onclick = (e) => { if (e.target === orgModal) orgModal.classList.add('hidden'); };

document.getElementById('create-org-form').onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById('org-name-input').value;
    const res = await fetch('/api/orgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
    });
    if (res.ok) {
        const data = await res.json();
        document.getElementById('new-org-code').textContent = data.invite_code;
        document.getElementById('new-org-invite-box').classList.remove('hidden');
        fetchUserOrgs();
        showToast("Organization created");
    }
};

document.getElementById('join-org-form').onsubmit = async (e) => {
    e.preventDefault();
    const code = document.getElementById('org-invite-code-input').value;
    const res = await fetch('/api/orgs/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite_code: code })
    });
    if (res.ok) {
        fetchUserOrgs();
        switchOrgTab('my-orgs');
        showToast("Joined organization");
    } else {
        showToast("Invalid code", "error");
    }
};

// Auth state
onAuthStateChanged(auth, (user) => {
    const createBtn = document.getElementById('btn-create-event');
    const loginLink = document.getElementById('btn-login-page');
    const logoutBtn = document.getElementById('btn-logout');
    const orgSwitcher = document.getElementById('btn-open-org-modal');

    if (user) {
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
    }
});

function updateTimeDisplay() {
    if (displayTimeElement) {
        displayTimeElement.textContent = currentTime.toLocaleString([], { weekday: 'long', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
}
updateTimeDisplay();
