// Firebase Configuration - Passed from Flask via index.html
const firebaseConfig = window.firebaseConfig;

// Import Firebase SDK (Modular v10+)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut, getIdToken } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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
    const canEditEvents = isOrgMember();

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
                     <div style="font-size:0.75rem;color:#94a3b8;margin-top:0.25rem;">${e.org_id ? `Org: ${(userOrgs.find(o => o.id === e.org_id) || {}).name || e.org_id}` : ''}</div>
                     ${canEditEvents && userOrgs.some(o => o.id === e.org_id) ? `
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

    // Populate org select — only orgs where user is admin or owner
    const orgSelect = document.getElementById('event-org');
    const editableOrgs = userOrgs.filter(o => o.role === 'admin' || o.role === 'owner');
    orgSelect.innerHTML = editableOrgs.map(o => `<option value="${o.id}" ${o.id === event.org_id ? 'selected' : ''}>${o.name}</option>`).join('');

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
    // Populate org select — only orgs where user is admin or owner
    const editableOrgs = userOrgs.filter(o => o.role === 'admin' || o.role === 'owner');
    document.getElementById('event-org').innerHTML = editableOrgs.map(o => `<option value="${o.id}">${o.name}</option>`).join('');
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
            const res = await fetch(`/api/events/${eventId}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to delete event');
            adminModal.classList.add('hidden');
        } catch (error) {
            console.error("Error deleting event:", error);
            alert(error.message || 'Failed to delete event.');
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

    if (!isOrgMember()) {
        alert('You must belong to an organization to create or edit events.');
        return;
    }

    const eventId = document.getElementById('event-id').value;
    const orgId = document.getElementById('event-org').value;
    const startTimeValue = document.getElementById('event-start').value;
    const endTimeValue = document.getElementById('event-end').value;

    const startDate = new Date();
    const [startH, startM] = startTimeValue.split(':');
    startDate.setHours(parseInt(startH), parseInt(startM), 0, 0);

    const endDate = new Date();
    const [endH, endM] = endTimeValue.split(':');
    endDate.setHours(parseInt(endH), parseInt(endM), 0, 0);

    const payload = {
        org_id: orgId,
        room_id: document.getElementById('event-room').value,
        title: document.getElementById('event-title').value,
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        type: 'general',
    };

    try {
        let res;
        if (eventId) {
            // Update via Flask API
            res = await fetch(`/api/events/${eventId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } else {
            // Create via Flask API
            res = await fetch('/api/events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to save event');
        adminModal.classList.add('hidden');
    } catch (error) {
        console.error('Error saving event:', error);
        alert(error.message || 'Failed to save event.');
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

        // Show/hide the Create Event button based on org membership
        const createBtn = document.getElementById('btn-create-event');
        if (createBtn) {
            createBtn.classList.toggle('hidden', userOrgs.length === 0);
        }
        // Refresh side panel so edit buttons reflect new org state
        if (selectedRoomId) updateSidePanel();
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
            <div class="org-card-header" ${isPending ? '' : `onclick="toggleOrgCard('${org.id}')"`} style="${isPending ? 'cursor:default;' : ''}">
                <div class="org-avatar" style="background:${color};">${initial}</div>
                <div class="org-card-info">
                    <div class="org-card-name">${org.name}${codeChip}</div>
                    <div class="org-card-role" id="org-member-count-${org.id}">
                        ${subtitle}
                    </div>
                </div>
                <span class="role-badge ${role}" style="${isPending ? 'background:#fef3c7;color:#92400e;border-color:#fde68a;' : ''}">${role}</span>
                ${role === 'owner' ? `
                <button class="btn-delete-org" title="Delete Organization"
                    onclick="event.stopPropagation(); deleteOrg('${org.id}', '${org.name.replace(/'/g, "&#39;")}')"
                    style="background:none;border:none;cursor:pointer;color:#ef4444;padding:0.25rem;border-radius:6px;display:flex;align-items:center;transition:background 0.15s;" 
                    onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='none'">
                    <i data-lucide="trash-2" style="width:16px;height:16px;"></i>
                </button>` : ''}
                ${!isPending ? `<i data-lucide="chevron-down" class="org-card-expand-icon" style="width:16px;height:16px;"></i>` : ''}
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
    const allMembers = _memberCache[orgId] || [];

    const pendingMembers = allMembers.filter(m => m.role === 'pending');
    const activeMembers = allMembers.filter(m => m.role !== 'pending');

    // Update subtitle count
    const subtitle = document.getElementById(`org-member-count-${orgId}`);
    if (subtitle) subtitle.textContent = `${activeMembers.length} member${activeMembers.length !== 1 ? 's' : ''}${pendingMembers.length ? ` · ${pendingMembers.length} pending` : ''}`;

    if (allMembers.length === 0) {
        panel.innerHTML = `<p style="color:#94a3b8;font-size:0.82rem;text-align:center;padding:0.5rem;">No members yet.</p>`;
        return;
    }

    // ---- ADMIN / OWNER VIEW ----
    if (canEdit) {
        const renderActiveMember = (m) => {
            const initial = (m.email || '?')[0].toUpperCase();
            const color = orgColor(m.email || m.uid);
            const role = m.role || 'viewer';
            const isOwner = role === 'owner';
            const isAdmin = role === 'admin';
            const isMe = m.uid === (window._currentUid || '');

            const adminReqBadge = m.admin_requested
                ? `<span style="font-size:0.7rem;font-weight:700;color:#92400e;background:#fef3c7;border:1px solid #fde68a;border-radius:5px;padding:0.1rem 0.45rem;margin-right:0.3rem;white-space:nowrap;">★ Wants Admin</span>`
                : '';

            let roleControls;
            if (isOwner) {
                // Owner badge — never editable
                roleControls = `<span class="role-pill active owner" style="pointer-events:none;">Owner</span>`;
            } else if (isAdmin && myRole !== 'owner') {
                // Admins cannot touch other admins — read-only badge
                roleControls = `<span class="role-pill active" style="pointer-events:none;" title="Only the owner can change admin roles">Admin</span>`;
            } else {
                // Single Admin toggle: ON = admin (active/blue), OFF = viewer (inactive)
                // Clicking toggles between the two states
                const nextRole = isAdmin ? 'viewer' : 'admin';
                const isActive = isAdmin ? 'active' : '';
                const isDisabled = isMe ? 'disabled' : '';
                const label = isAdmin ? 'Admin' : 'Grant Admin';
                roleControls = `
                    <button class="role-pill ${isActive}" ${isDisabled}
                            title="${isAdmin ? 'Click to remove admin access (reverts to Viewer)' : 'Click to grant Admin access'}"
                            onclick="setMemberRole('${orgId}','${m.uid}','${nextRole}',this)">
                        ${label}
                    </button>`;

            }

            return `
            <div class="member-row" id="member-row-${orgId}-${m.uid}" ${m.admin_requested ? 'style="border-left:3px solid #f59e0b;padding-left:0.65rem;"' : ''}>
                <div class="member-avatar-sm" style="background:${color};">${initial}</div>
                <div class="member-email" title="${m.email}" style="flex:1;">
                    ${m.email}${isMe ? ' <span style="color:#94a3b8;">(you)</span>' : ''}
                    ${adminReqBadge}
                </div>
                <div class="member-role-controls">${roleControls}</div>
            </div>`;
        };



        // Pending section
        const pendingSection = pendingMembers.length > 0 ? `
            <div style="background:#fefce8;border:1px solid #fde047;border-radius:10px;padding:0.75rem 1rem;margin-bottom:0.75rem;">
                <div style="font-size:0.75rem;font-weight:700;color:#854d0e;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.5rem;display:flex;align-items:center;gap:0.4rem;">
                    <i data-lucide="clock" style="width:13px;height:13px;"></i>
                    Pending Approval
                </div>
                ${pendingMembers.map(m => {
            const initial = (m.email || '?')[0].toUpperCase();
            const color = orgColor(m.email || m.uid);
            return `
                    <div class="member-row" id="member-row-${orgId}-${m.uid}" style="background:transparent;border:none;padding:0.35rem 0;">
                        <div class="member-avatar-sm" style="background:${color};">${initial}</div>
                        <div class="member-email" title="${m.email}" style="flex:1;">${m.email}</div>
                        <div style="display:flex;gap:0.35rem;">
                            <button onclick="approveMember('${orgId}','${m.uid}')"
                                style="background:#16a34a;color:#fff;border:none;border-radius:6px;padding:0.25rem 0.65rem;font-size:0.75rem;font-weight:600;cursor:pointer;">
                                Approve
                            </button>
                            <button onclick="rejectMember('${orgId}','${m.uid}')"
                                style="background:#ef4444;color:#fff;border:none;border-radius:6px;padding:0.25rem 0.65rem;font-size:0.75rem;font-weight:600;cursor:pointer;">
                                Reject
                            </button>
                        </div>
                    </div>`;
        }).join('')}
            </div>` : '';

        panel.innerHTML = pendingSection + activeMembers.map(renderActiveMember).join('');
        lucide.createIcons();
        return;
    }

    // ---- REGULAR MEMBER / VIEWER VIEW ----
    const meEntry = allMembers.find(m => m.uid === (window._currentUid || ''));
    const ownersList = activeMembers.filter(m => m.role === 'owner');
    const alreadyRequested = meEntry?.admin_requested || false;

    const renderSimpleRow = (m, isHighlighted = false) => {
        const initial = (m.email || '?')[0].toUpperCase();
        const color = orgColor(m.email || m.uid);
        const rolePill = m.role === 'owner'
            ? `<span class="role-pill active owner" style="pointer-events:none;font-size:0.7rem;">Owner</span>`
            : `<span class="role-pill" style="pointer-events:none;font-size:0.7rem;opacity:0.7;">${m.role}</span>`;
        return `
        <div class="member-row" style="${isHighlighted ? 'border-left:3px solid var(--secondary);padding-left:0.65rem;' : ''}">
            <div class="member-avatar-sm" style="background:${color};">${initial}</div>
            <div class="member-email" title="${m.email}" style="flex:1;${isHighlighted ? 'font-weight:700;color:var(--primary);' : ''}">
                ${m.email}${isHighlighted ? ' <span style="color:#94a3b8;">(you)</span>' : ''}
            </div>
            <div class="member-role-controls">${rolePill}</div>
        </div>`;
    };

    const myRow = meEntry ? renderSimpleRow(meEntry, true) : '';
    const ownerRows = ownersList
        .filter(m => m.uid !== meEntry?.uid)
        .map(m => renderSimpleRow(m))
        .join('');

    const requestBtn = `
        <div style="margin-top:1rem;padding-top:0.75rem;border-top:1px solid #e2e8f0;">
            <button id="btn-request-admin-${orgId}"
                onclick="requestAdminAccess('${orgId}')"
                ${alreadyRequested ? 'disabled' : ''}
                style="width:100%;display:flex;align-items:center;justify-content:center;gap:0.5rem;
                       padding:0.55rem 1rem;border-radius:8px;font-size:0.82rem;font-weight:600;
                       cursor:${alreadyRequested ? 'default' : 'pointer'};
                       border:1px solid ${alreadyRequested ? '#d1fae5' : 'var(--secondary)'};
                       background:${alreadyRequested ? '#f0fdf4' : 'transparent'};
                       color:${alreadyRequested ? '#16a34a' : 'var(--secondary)'};
                       transition:all 0.15s;">
                <i data-lucide="${alreadyRequested ? 'check-circle' : 'shield-plus'}" style="width:15px;height:15px;"></i>
                ${alreadyRequested ? 'Admin Access Requested ✓' : 'Request Admin Access'}
            </button>
        </div>`;

    panel.innerHTML = myRow
        + (ownerRows ? `<div style="font-size:0.7rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;margin:0.65rem 0 0.35rem;">Organization Owner</div>` + ownerRows : '')
        + requestBtn;
    lucide.createIcons();
}

async function setMemberRole(orgId, targetUid, newRole, clickedBtn) {
    const originalHTML = clickedBtn?.innerHTML;
    if (clickedBtn) {
        clickedBtn.disabled = true;
        clickedBtn.innerHTML = '…';
    }

    try {
        const res = await fetch(`/api/orgs/${orgId}/members`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: targetUid, role: newRole })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Role update failed');

        showToast(`Role updated to ${newRole}`, 'success');

        // 1. Update local member cache — set role and clear any admin request flag
        if (_memberCache[orgId]) {
            const member = _memberCache[orgId].find(m => m.uid === targetUid);
            if (member) {
                member.role = newRole;
                member.admin_requested = false;  // role resolved, badge should disappear
            }
        }

        // 2. If changing own role, sync the global userOrgs state so Create Event
        //    button and org select get updated immediately
        if (targetUid === window._currentUid) {
            const orgIndex = userOrgs.findIndex(o => o.id === orgId);
            if (orgIndex !== -1) {
                userOrgs[orgIndex].role = newRole;
                updateOrgSwitcher();
                // Re-evaluate Create Event button visibility
                const createBtn = document.getElementById('btn-create-event');
                if (createBtn) {
                    createBtn.classList.toggle('hidden', !isOrgMember());
                }
            }
        }

    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        // Always restore the button — re-render will replace it anyway
        if (clickedBtn) {
            clickedBtn.disabled = false;
            clickedBtn.innerHTML = originalHTML;
        }
    }

    // Re-render the panel immediately from the updated local cache
    const panel = document.getElementById(`org-member-panel-${orgId}`);
    if (panel) buildMemberPanel(orgId, panel);
}


// --- Delete Org ---
async function deleteOrg(orgId, orgName) {
    if (!confirm(`Are you sure you want to permanently delete "${orgName}"?\n\nThis cannot be undone and will remove all members.`)) return;

    try {
        const res = await fetch(`/api/orgs/${orgId}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to delete organization');

        // Remove from local state and re-render
        userOrgs = userOrgs.filter(o => o.id !== orgId);
        delete _memberCache[orgId];
        renderMyOrgsPanel();
        updateOrgSwitcher();
        showToast(`"${orgName}" has been deleted.`, 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// --- Approve / Reject pending org members ---
async function approveMember(orgId, targetUid) {
    try {
        const res = await fetch(`/api/orgs/${orgId}/approve/${targetUid}`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to approve member');

        showToast('Member approved!', 'success');

        // Invalidate and re-fetch
        delete _memberCache[orgId];
        const membersRes = await fetch(`/api/orgs/${orgId}/members`);
        if (membersRes.ok) {
            _memberCache[orgId] = (await membersRes.json()).members || [];
        }
    } catch (err) {
        showToast(err.message, 'error');
    }

    const panel = document.getElementById(`org-member-panel-${orgId}`);
    if (panel) buildMemberPanel(orgId, panel);
}

async function rejectMember(orgId, targetUid) {
    if (!confirm('Remove this pending member from the organization?')) return;
    try {
        const res = await fetch(`/api/orgs/${orgId}/reject/${targetUid}`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to reject member');

        showToast('Member rejected and removed.', 'success');

        // Invalidate and re-fetch
        delete _memberCache[orgId];
        const membersRes = await fetch(`/api/orgs/${orgId}/members`);
        if (membersRes.ok) {
            _memberCache[orgId] = (await membersRes.json()).members || [];
        }
    } catch (err) {
        showToast(err.message, 'error');
    }

    const panel = document.getElementById(`org-member-panel-${orgId}`);
    if (panel) buildMemberPanel(orgId, panel);
}


// --- Request Admin Access ---
async function requestAdminAccess(orgId) {
    const btn = document.getElementById(`btn-request-admin-${orgId}`);
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader-2" style="width:15px;height:15px;"></i> Sending…';
        lucide.createIcons();
    }
    try {
        const res = await fetch(`/api/orgs/${orgId}/request-admin`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Request failed');

        // Mark in cache so re-opens show correct state
        const members = _memberCache[orgId];
        if (members) {
            const me = members.find(m => m.uid === (window._currentUid || ''));
            if (me) me.admin_requested = true;
        }

        showToast('Admin access request sent to the org owner!', 'success');

        // Update button to confirmed state
        if (btn) {
            btn.innerHTML = '<i data-lucide="check-circle" style="width:15px;height:15px;"></i> Admin Access Requested ✓';
            btn.style.background = '#f0fdf4';
            btn.style.color = '#16a34a';
            btn.style.border = '1px solid #d1fae5';
            btn.style.cursor = 'default';
            lucide.createIcons();
        }
    } catch (err) {
        showToast(err.message, 'error');
        if (btn) btn.disabled = false;
    }
}

// Expose to global scope (called from inline onclick)
window.toggleOrgCard = toggleOrgCard;
window.setMemberRole = setMemberRole;
window.deleteOrg = deleteOrg;
window.approveMember = approveMember;
window.rejectMember = rejectMember;
window.requestAdminAccess = requestAdminAccess;

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
            } else if (data.status === 'pending') {
                // Add to local org list as pending so user sees it in My Orgs
                userOrgs.push({ id: data.org_id, name: data.name, role: 'pending' });
                renderMyOrgsPanel();
                updateOrgSwitcher();
                showToast(`Request sent! Waiting for an admin to approve you in "${data.name}".`, 'success');
                document.getElementById('org-invite-code-input').value = '';
                switchOrgTab('my-orgs');
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
        // Keep create button hidden until we confirm org membership below
        createBtn?.classList.add('hidden');
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
        // Refresh side panel so edit buttons disappear
        if (selectedRoomId) updateSidePanel();
    }
});
