// Firebase Configuration - Passed from Flask via index.html
const firebaseConfig = window.firebaseConfig;

// Import Firebase SDK (Modular v10+)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, addDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Initialize Firebase
let db;
let auth;
console.log("Attempting to initialize Firebase with:", firebaseConfig);

try {
    if (firebaseConfig && firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY") {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        console.log("Firebase initialized successfully using environment variables.");

        // Track login status
        onAuthStateChanged(auth, (user) => {
            const createBtn = document.getElementById('btn-create-event');
            const loginLink = document.getElementById('btn-login-page');
            const logoutBtn = document.getElementById('btn-logout');

            if (user) {
                createBtn.classList.remove('hidden');
                loginLink.classList.add('hidden');
                logoutBtn.classList.remove('hidden');
            } else {
                createBtn.classList.add('hidden');
                loginLink.classList.remove('hidden');
                logoutBtn.classList.add('hidden');
            }
        });
    } else {
        console.error("❌ Firebase config is missing or contains placeholders! Check your .env file.");
    }
} catch (e) {
    console.error("💥 Firebase initialization error:", e);
}

// Sign out logic
document.getElementById('btn-logout').onclick = () => {
    signOut(auth).then(() => {
        window.location.reload();
    });
};

// App State
let rooms = [];
let events = [];
let selectedRoomId = null;
let currentTime = new Date();

// Initialize UI components
lucide.createIcons();

const displayTimeElement = document.getElementById('display-time');
const timelineSlider = document.getElementById('timeline-slider');
const floorPlanContainer = document.getElementById('floor-plan-container');
const sidePanelContent = document.getElementById('side-panel-content');
const sidePanelEmpty = document.getElementById('side-panel-empty');
const adminModal = document.getElementById('admin-modal');
const eventForm = document.getElementById('event-form');
const eventRoomSelect = document.getElementById('event-room');

// --- Real-time Firestore Listeners ---
if (db) {
    console.log("Setting up real-time listeners...");

    // Listen for Rooms
    onSnapshot(collection(db, "rooms"), (snapshot) => {
        rooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("Rooms updated:", rooms.length);
        renderFloorPlan();
        if (selectedRoomId) updateSidePanel();
    }, (error) => {
        console.error("Rooms listener error:", error);
    });

    // Listen for Events
    onSnapshot(collection(db, "events"), (snapshot) => {
        events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("Events updated:", events.length);
        renderFloorPlan();
        if (selectedRoomId) updateSidePanel();
    }, (error) => {
        console.error("Events listener error:", error);
    });
} else {
    console.warn("Firestore 'db' not initialized. Check your config and browser console for errors.");
}

// --- D3.js Floor Plan Rendering ---
function renderFloorPlan() {
    floorPlanContainer.innerHTML = '';
    const width = 800;
    const height = 500;

    const svg = d3.select('#floor-plan-container')
        .append('svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .style('max-width', '800px');

    if (rooms.length === 0) {
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', height / 2)
            .attr('text-anchor', 'middle')
            .style('fill', '#94a3b8')
            .text('Waiting for Firestore data (rooms collection)...');
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
    document.getElementById('btn-close-panel').onclick = () => selectRoom(null);
}

window.editEvent = (eventId) => {
    console.log("Editing event with ID:", eventId);
    const event = events.find(e => e.id === eventId);
    if (!event) {
        console.error("Event not found in state:", eventId);
        return;
    }

    document.getElementById('modal-title').textContent = 'Edit Event';
    document.getElementById('event-id').value = event.id;
    console.log("Set hidden input event-id to:", document.getElementById('event-id').value);
    document.getElementById('event-title').value = event.title;
    document.getElementById('event-room').innerHTML = rooms.map(r => `<option value="${r.id}" ${r.id === event.room_id ? 'selected' : ''}>${r.name}</option>`).join('');

    const startStr = new Date(event.start).toTimeString().slice(0, 5);
    const endStr = new Date(event.end).toTimeString().slice(0, 5);
    document.getElementById('event-start').value = startStr;
    document.getElementById('event-end').value = endStr;

    document.getElementById('btn-delete-event').classList.remove('hidden');
    adminModal.classList.remove('hidden');
};

// --- Timeline Logic ---
timelineSlider.addEventListener('input', (e) => {
    const hoursToAdd = parseInt(e.target.value);
    const now = new Date();
    now.setMinutes(0, 0, 0);
    currentTime = new Date(now.getTime() + hoursToAdd * 3600000);
    updateTimeDisplay();
    renderFloorPlan();
    if (selectedRoomId) updateSidePanel();
});

function updateTimeDisplay() {
    displayTimeElement.textContent = currentTime.toLocaleString([], { weekday: 'long', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// --- Admin Modal Logic ---
document.getElementById('btn-create-event').onclick = () => {
    document.getElementById('modal-title').textContent = 'Create New Event';
    document.getElementById('event-id').value = '';
    document.getElementById('event-title').value = '';
    document.getElementById('event-start').value = '';
    document.getElementById('event-end').value = '';
    document.getElementById('btn-delete-event').classList.add('hidden');
    adminModal.classList.remove('hidden');
    eventRoomSelect.innerHTML = rooms.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
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
    const [startH, startM] = startTimeValue.split(':');
    startDate.setHours(parseInt(startH), parseInt(startM), 0, 0);

    const endDate = new Date();
    const [endH, endM] = endTimeValue.split(':');
    endDate.setHours(parseInt(endH), parseInt(endM), 0, 0);

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

// --- Initialization ---
updateTimeDisplay();
renderFloorPlan();
window.selectRoom = selectRoom; // Expose to global

// ============================================================
//  Organization UI
// ============================================================

// --- State ---
let userOrgs = []; // [{id, name, role, invite_code?}]

// --- Utility: show a quick toast notification ---
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

// --- Utility: color avatar from string ---
const ORG_COLORS = ['#635bff', '#0ea5e9', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#ec4899'];
function orgColor(name) {
    let hash = 0;
    for (let c of name) hash = c.charCodeAt(0) + ((hash << 5) - hash);
    return ORG_COLORS[Math.abs(hash) % ORG_COLORS.length];
}

// --- Re-establish the Flask session cookie using the current Firebase user ---
async function refreshFlaskSession() {
    const firebaseUser = auth?.currentUser;
    if (!firebaseUser) return false;
    try {
        // Force-refresh ensures we always get a valid, non-expired token
        const idToken = await getIdToken(firebaseUser, /* forceRefresh= */ true);
        const res = await fetch('/api/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken })
        });
        return res.ok;
    } catch (e) {
        console.warn('Session refresh failed:', e);
        return false;
    }
}

// --- Fetch orgs the current user belongs to ---
async function fetchUserOrgs() {
    try {
        let res = await fetch('/api/user/orgs');

        // 401 = Flask session cookie missing or expired (Firebase client state
        // is ahead of server state). Auto-refresh the session and retry once.
        if (res.status === 401) {
            console.log('Flask session missing — refreshing…');
            const ok = await refreshFlaskSession();
            if (!ok) {
                console.warn('Could not refresh session. User may need to log in again.');
                return;
            }
            res = await fetch('/api/user/orgs');
        }

        if (!res.ok) return;
        const data = await res.json();
        userOrgs = data.orgs || [];
        renderMyOrgsPanel();
        updateOrgSwitcher();
    } catch (e) {
        console.warn('Could not load orgs:', e);
    }
}

// --- Render "My Orgs" tab content (expandable accordion cards) ---
function renderMyOrgsPanel() {
    const container = document.getElementById('org-list-container');
    if (!container) return;

    if (userOrgs.length === 0) {
        container.innerHTML = `
            <div class="org-empty">
                <i data-lucide="building-2" style="width:40px;height:40px;opacity:0.3;"></i>
                <p>You haven't joined any organizations yet.</p>
                <p style="margin-top:0.5rem;font-size:0.8rem;">Create one or join with an invite code.</p>
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
            <div class="org-member-panel" id="org-member-panel-${org.id}">
                <div class="member-skeleton">
                    <div class="skeleton-row"></div>
                    <div class="skeleton-row" style="width:80%;"></div>
                    <div class="skeleton-row" style="width:65%;"></div>
                </div>
            </div>
        </div>`;
    }).join('');
    lucide.createIcons();
}

// Track which orgs have already had their members fetched (avoid re-fetching)
const _memberCache = {};

async function toggleOrgCard(orgId) {
    const card = document.getElementById(`org-card-${orgId}`);
    const panel = document.getElementById(`org-member-panel-${orgId}`);
    if (!card || !panel) return;

    const isOpen = card.classList.contains('open');
    // Close all open cards first
    document.querySelectorAll('.org-card-expandable.open').forEach(c => c.classList.remove('open'));

    if (isOpen) return; // toggled closed — done

    card.classList.add('open');
    lucide.createIcons(); // re-render chevron

    // Fetch members only once
    if (!_memberCache[orgId]) {
        try {
            const res = await fetch(`/api/orgs/${orgId}/members`);
            if (!res.ok) throw new Error('Failed to load members');
            const data = await res.json();
            _memberCache[orgId] = data.members || [];
        } catch (e) {
            panel.innerHTML = `<p style="color:var(--error);font-size:0.82rem;">Could not load members.</p>`;
            return;
        }
    }

    buildMemberPanel(orgId, panel);
}

function buildMemberPanel(orgId, panel) {
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
            body: JSON.stringify({ uid: targetUid, role: newRole })
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

// --- Update the org-switcher chip in the header ---
function updateOrgSwitcher() {
    const switcher = document.getElementById('btn-open-org-modal');
    const label = document.getElementById('org-switcher-label');
    if (!switcher || !label) return;
    if (userOrgs.length === 0) {
        label.textContent = 'My Orgs';
    } else if (userOrgs.length === 1) {
        label.textContent = userOrgs[0].name;
    } else {
        label.textContent = `${userOrgs.length} Orgs`;
    }
}

// --- Open / close modal ---
const orgModal = document.getElementById('org-modal');
const btnOpenOrg = document.getElementById('btn-open-org-modal');
const btnCloseOrg = document.getElementById('btn-close-org-modal');

function openOrgModal(defaultTab = 'my-orgs') {
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

// --- Auth state: show/hide org switcher and load orgs ---
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
        window._currentUid = null;
        createBtn?.classList.add('hidden');
        loginLink?.classList.remove('hidden');
        logoutBtn?.classList.add('hidden');
        orgSwitcher?.classList.add('hidden');
        userOrgs = [];
    }
});
