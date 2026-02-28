import { db, auth, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, onAuthStateChanged, signOut } from './firebase-config.js';
import { fetchUserOrgs, setMemberRoleAPI, createOrgAPI, joinOrgAPI, fetchOrgMembersAPI, updateOrgMetadataAPI, deleteOrgAPI, ensureAuthSynced } from './api.js';
import { renderDashboard, updateOrgSwitcher, renderMyOrgsPanel, buildMemberPanel, showToast } from './ui-render.js';
import { openCalendarModal } from './calendar.js';
import { editEventModal, createEventModal } from './admin.js';

// Global State
export let state = {
    rooms: [],
    events: [],
    allOrganizations: [],
    userOrgs: [],
    expandedOrgId: null,
    currentTime: new Date(),
    selectedDate: new Date()
};

function updateCreateButtonVisibility() {
    const createBtn = document.getElementById('btn-create-event');
    if (!createBtn) return;
    const canCreate = state.userOrgs.some(o => ['admin', 'owner'].includes(o.role));
    if (canCreate && auth?.currentUser) {
        createBtn.classList.remove('hidden');
    } else {
        createBtn.classList.add('hidden');
    }
}

// Start clock
const displayTimeElement = document.getElementById('display-time');
const datePickerElement = document.getElementById('dashboard-date-picker');
const timeDisplayContainer = document.getElementById('current-time-display');

function updateTimeDisplay() {
    if (displayTimeElement) {
        displayTimeElement.textContent = state.selectedDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    }
}
updateTimeDisplay();

if (datePickerElement) {
    const yyyy = state.selectedDate.getFullYear();
    const mm = String(state.selectedDate.getMonth() + 1).padStart(2, '0');
    const dd = String(state.selectedDate.getDate()).padStart(2, '0');
    datePickerElement.value = `${yyyy}-${mm}-${dd}`;

    datePickerElement.addEventListener('change', (e) => {
        if (e.target.value) {
            const [y, m, d] = e.target.value.split('-');
            state.selectedDate = new Date(y, m - 1, d);
            updateTimeDisplay();
            renderDashboard(state);
        }
    });

    if (timeDisplayContainer) {
        timeDisplayContainer.addEventListener('click', () => {
            try {
                if (typeof datePickerElement.showPicker === 'function') {
                    datePickerElement.showPicker();
                } else {
                    datePickerElement.focus();
                    datePickerElement.click();
                }
            } catch (error) {
                console.error("Date picker could not be opened:", error);
            }
        });
    }
}

// Initialize UI
if (window.lucide) window.lucide.createIcons();

// Export globals for inline HTML handlers
window.toggleOrgExpansion = (orgId) => {
    state.expandedOrgId = state.expandedOrgId === orgId ? null : orgId;
    renderDashboard(state);
};

window.openOrgCalendar = (orgId) => {
    openCalendarModal(orgId, state);
};

window.editEvent = (eventId) => {
    editEventModal(eventId, state);
};

window.createEvent = (orgId = null, start = '', end = '') => {
    createEventModal(state, orgId, start, end);
};

// Organization Modal Global Behaviors
const _memberCache = {};
window.toggleOrgCard = async (orgId) => {
    const card = document.getElementById(`org-card-${orgId}`);
    const panel = document.getElementById(`org-member-panel-${orgId}`);
    if (!card || !panel) return;

    const isOpen = card.classList.contains('open');
    
    // Close all other cards first
    document.querySelectorAll('.org-card-expandable.open').forEach(otherCard => {
        if (otherCard.id !== `org-card-${orgId}`) {
            otherCard.classList.remove('open');
            const otherPanel = otherCard.querySelector('.org-member-panel');
            if (otherPanel) otherPanel.style.display = 'none';
        }
    });

    if (!isOpen) {
        card.classList.add('open');
        panel.style.display = 'block';
        
        const listContainer = document.getElementById(`member-list-${orgId}`);
        if (!_memberCache[orgId]) {
            const res = await fetchOrgMembersAPI(orgId);
            if (res.ok) {
                const data = await res.json();
                _memberCache[orgId] = data.members;
            }
        }
        buildMemberPanel(orgId, listContainer, _memberCache[orgId] || [], state.userOrgs);
    } else {
        card.classList.remove('open');
        panel.style.display = 'none';
    }
};

window.setMemberRole = async (orgId, uid, role) => {
    try {
        const res = await setMemberRoleAPI(orgId, uid, role);
        if (res.ok) {
            _memberCache[orgId] = null; // force reload
            
            // Re-open to refresh content
            const card = document.getElementById(`org-card-${orgId}`);
            if (card) card.classList.remove('open');
            window.toggleOrgCard(orgId);

            const orgData = await fetchUserOrgs();
            state.userOrgs = orgData.orgs || [];
            renderDashboard(state);

            showToast("Role updated");
        }
    } catch (e) { console.error(e); }
};

window.updateOrgColor = async (orgId, color) => {
    try {
        const res = await updateOrgMetadataAPI(orgId, { color });
        if (res.ok) {
            const orgData = await fetchUserOrgs();
            state.userOrgs = orgData.orgs || [];
            
            // Re-render dashboard and panel
            renderDashboard(state);
            renderMyOrgsPanel(state.userOrgs);
            
            // Re-open this specific card immediately so it doesn't "flicker" closed
            window.toggleOrgCard(orgId);
            
            showToast("Brand color updated");
        }
    } catch (e) { console.error(e); }
};

window.deleteOrganization = async (orgId, orgName) => {
    if (!confirm(`Are you sure you want to delete "${orgName}"? All data will be lost.`)) return;
    try {
        const res = await deleteOrgAPI(orgId);
        if (res.ok) {
            const orgData = await fetchUserOrgs();
            state.userOrgs = orgData.orgs || [];
            renderDashboard(state);
            renderMyOrgsPanel(state.userOrgs);
            showToast("Organization deleted");
        }
    } catch (e) { console.error(e); }
};

// DOM Event Listeners
document.addEventListener("DOMContentLoaded", () => {
    // --- Logout Logic ---
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.onclick = () => {
            signOut(auth).then(() => {
                window.location.href = '/logout'; // Clear Flask session too
            }).catch(e => console.error("Sign out error:", e));
        };
    }

    // --- Calendar Handlers ---
    const btnCopyCalendarLink = document.getElementById('btn-copy-calendar-link');
    const calendarLinkInput = document.getElementById('calendar-link-input');
    const calendarModal = document.getElementById('calendar-modal');

    if (document.getElementById('btn-close-calendar-modal')) {
        document.getElementById('btn-close-calendar-modal').onclick = () => calendarModal?.classList.add('hidden');
    }
    if (document.getElementById('btn-close-calendar-modal-footer')) {
        document.getElementById('btn-close-calendar-modal-footer').onclick = () => calendarModal?.classList.add('hidden');
    }
    if (btnCopyCalendarLink) {
        btnCopyCalendarLink.onclick = () => {
            if (calendarLinkInput) {
                calendarLinkInput.select();
                navigator.clipboard.writeText(calendarLinkInput.value).then(() => {
                    const originalHtml = btnCopyCalendarLink.innerHTML;
                    btnCopyCalendarLink.innerHTML = '<i data-lucide="check" style="width: 18px; height: 18px;"></i> Copied!';
                    if (window.lucide) window.lucide.createIcons();
                    setTimeout(() => {
                        btnCopyCalendarLink.innerHTML = originalHtml;
                        if (window.lucide) window.lucide.createIcons();
                    }, 2000);
                });
            }
        };
    }

    // --- Admin Event Modals ---
    const adminModal = document.getElementById('admin-modal');
    if (document.getElementById('btn-create-event')) {
        document.getElementById('btn-create-event').onclick = () => createEventModal(state);
    }
    if (document.getElementById('btn-close-modal')) {
        document.getElementById('btn-close-modal').onclick = () => adminModal?.classList.add('hidden');
    }
    if (document.getElementById('btn-cancel-modal')) {
        document.getElementById('btn-cancel-modal').onclick = () => adminModal?.classList.add('hidden');
    }

    if (document.getElementById('btn-delete-event')) {
        document.getElementById('btn-delete-event').onclick = async () => {
            const eventId = document.getElementById('event-id').value;
            const event = state.events.find(e => e.id === eventId);
            if (!event) return;

            const myOrg = state.userOrgs.find(o => o.id === event.org_id);
            const myRole = myOrg?.role || 'viewer';
            if (!['admin', 'owner'].includes(myRole)) {
                showToast("You do not have permission to delete this event.", "error");
                return;
            }

            if (confirm('Are you sure?')) {
                await deleteDoc(doc(db, "events", eventId));
                adminModal?.classList.add('hidden');
                showToast("Event deleted.");
            }
        };
    }

    const eventForm = document.getElementById('event-form');
    if (eventForm) {
        eventForm.onsubmit = async (e) => {
            e.preventDefault();
            const eventId = document.getElementById('event-id').value;
            const eventOrgSelect = document.getElementById('event-org');
            const eventRoomSelect = document.getElementById('event-room');
            const eventDateValue = document.getElementById('event-date').value;

            const [year, month, day] = eventDateValue.split('-').map(Number);

            const startDate = new Date(year, month - 1, day);
            const [sH, sM] = document.getElementById('event-start').value.split(':');
            startDate.setHours(parseInt(sH), parseInt(sM), 0, 0);

            const endDate = new Date(year, month - 1, day);
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
                const event = state.events.find(e => e.id === eventId);
                const myOrg = state.userOrgs.find(o => o.id === event?.org_id);
                const myRole = myOrg?.role || 'viewer';
                if (!['admin', 'owner'].includes(myRole)) {
                    showToast("You do not have permission to edit this event.", "error");
                    return;
                }
                await updateDoc(doc(db, "events", eventId), data);
                showToast("Event updated");
            } else {
                data.createdAt = serverTimestamp();
                await addDoc(collection(db, "events"), data);
                showToast("Event created");
            }
            adminModal?.classList.add('hidden');
        };
    }

    // --- Organization Modal Handlers ---
    function switchOrgTab(tabId) {
        document.querySelectorAll('.org-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
        document.querySelectorAll('.org-tab-panel').forEach(p => p.classList.toggle('active', p.id === `panel-${tabId}`));
    }
    document.querySelectorAll('.org-tab').forEach(tab => tab.onclick = () => switchOrgTab(tab.dataset.tab));

    const orgModal = document.getElementById('org-modal');
    if (document.getElementById('btn-open-org-modal')) {
        document.getElementById('btn-open-org-modal').onclick = () => {
            orgModal?.classList.remove('hidden');
            switchOrgTab('my-orgs');
        };
    }
    if (document.getElementById('btn-close-org-modal')) {
        document.getElementById('btn-close-org-modal').onclick = () => orgModal?.classList.add('hidden');
    }
    if (orgModal) {
        orgModal.onclick = (e) => { if (e.target === orgModal) orgModal.classList.add('hidden'); };
    }

    const createOrgForm = document.getElementById('create-org-form');
    if (createOrgForm) {
        createOrgForm.onsubmit = async (e) => {
            e.preventDefault();
            const name = document.getElementById('org-name-input').value;
            const res = await createOrgAPI(name);
            if (res.ok) {
                const data = await res.json();
                document.getElementById('new-org-code').textContent = data.invite_code;
                document.getElementById('new-org-invite-box').classList.remove('hidden');

                const orgData = await fetchUserOrgs();
                state.userOrgs = orgData.orgs || [];
                updateOrgSwitcher(state.userOrgs);
                renderMyOrgsPanel(state.userOrgs);
                updateCreateButtonVisibility();
                renderDashboard(state);

                showToast("Organization created");
            }
        };
    }

    const joinOrgForm = document.getElementById('join-org-form');
    if (joinOrgForm) {
        joinOrgForm.onsubmit = async (e) => {
            e.preventDefault();
            const code = document.getElementById('org-invite-code-input').value;
            const res = await joinOrgAPI(code);
            if (res.ok) {
                const orgData = await fetchUserOrgs();
                state.userOrgs = orgData.orgs || [];
                updateOrgSwitcher(state.userOrgs);
                renderMyOrgsPanel(state.userOrgs);
                updateCreateButtonVisibility();
                renderDashboard(state);

                switchOrgTab('my-orgs');
                showToast("Joined organization");
            } else {
                showToast("Invalid code", "error");
            }
        };
    }

    // --- Sync Calendar Handlers ---
    const btnSyncCalendar = document.getElementById('btn-sync-calendar');
    const syncModal = document.getElementById('sync-modal');
    const syncOrgList = document.getElementById('sync-org-list');
    const btnGenerateSync = document.getElementById('btn-generate-sync');
    const syncLinkContainer = document.getElementById('sync-link-container');
    const syncCalendarLinkInput = document.getElementById('sync-calendar-link-input');
    const btnCopySyncLink = document.getElementById('btn-copy-sync-link');

    if (btnSyncCalendar) {
        btnSyncCalendar.onclick = () => {
            if (!state.allOrganizations || state.allOrganizations.length === 0) {
                showToast("No organizations available to sync.", "error");
                return;
            }

            syncOrgList.innerHTML = '';
            syncLinkContainer.classList.add('hidden');
            syncCalendarLinkInput.value = '';

            // Add Select All checkbox
            const selectAllLabel = document.createElement('label');
            selectAllLabel.style.display = 'flex';
            selectAllLabel.style.alignItems = 'center';
            selectAllLabel.style.gap = '0.5rem';
            selectAllLabel.style.cursor = 'pointer';
            selectAllLabel.style.paddingBottom = '0.5rem';
            selectAllLabel.style.marginBottom = '0.5rem';
            selectAllLabel.style.borderBottom = '1px solid #e2e8f0';
            selectAllLabel.style.fontWeight = 'bold';

            const selectAllCheckbox = document.createElement('input');
            selectAllCheckbox.type = 'checkbox';
            selectAllCheckbox.id = 'sync-select-all';

            const selectAllSpan = document.createElement('span');
            selectAllSpan.textContent = 'Select All Organizations';

            selectAllLabel.appendChild(selectAllCheckbox);
            selectAllLabel.appendChild(selectAllSpan);
            syncOrgList.appendChild(selectAllLabel);

            state.allOrganizations.forEach(org => {
                const label = document.createElement('label');
                label.style.display = 'flex';
                label.style.alignItems = 'center';
                label.style.gap = '0.5rem';
                label.style.cursor = 'pointer';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = org.id;
                checkbox.className = 'sync-org-checkbox';

                // Add change listener to "Select All" checkbox instead of all individual
                checkbox.addEventListener('change', () => {
                    const allChecked = Array.from(document.querySelectorAll('.sync-org-checkbox')).every(cb => cb.checked);
                    const someChecked = Array.from(document.querySelectorAll('.sync-org-checkbox')).some(cb => cb.checked);
                    selectAllCheckbox.checked = allChecked;
                    selectAllCheckbox.indeterminate = someChecked && !allChecked;
                });

                const span = document.createElement('span');
                span.textContent = org.name;

                label.appendChild(checkbox);
                label.appendChild(span);
                syncOrgList.appendChild(label);
            });

            selectAllCheckbox.addEventListener('change', (e) => {
                document.querySelectorAll('.sync-org-checkbox').forEach(cb => {
                    cb.checked = e.target.checked;
                });
            });

            syncModal?.classList.remove('hidden');
        };
    }

    if (document.getElementById('btn-close-sync-modal')) {
        document.getElementById('btn-close-sync-modal').onclick = () => syncModal?.classList.add('hidden');
    }
    if (document.getElementById('btn-close-sync-modal-footer')) {
        document.getElementById('btn-close-sync-modal-footer').onclick = () => syncModal?.classList.add('hidden');
    }

    if (btnGenerateSync) {
        btnGenerateSync.onclick = () => {
            const checkboxes = document.querySelectorAll('.sync-org-checkbox:checked');
            if (checkboxes.length === 0) {
                showToast("Please select at least one organization.", "error");
                return;
            }
            const selectedOrgIds = Array.from(checkboxes).map(cb => cb.value);

            if (selectedOrgIds.length === 1) {
                const link = `${window.location.origin}/api/orgs/${selectedOrgIds[0]}/calendar.ics`;
                syncCalendarLinkInput.value = link;
            } else {
                const link = `${window.location.origin}/api/calendar/multi.ics?orgs=${selectedOrgIds.join(',')}`;
                syncCalendarLinkInput.value = link;
            }
            syncLinkContainer.classList.remove('hidden');
        };
    }

    if (btnCopySyncLink) {
        btnCopySyncLink.onclick = () => {
            if (syncCalendarLinkInput) {
                syncCalendarLinkInput.select();
                navigator.clipboard.writeText(syncCalendarLinkInput.value).then(() => {
                    const originalHtml = btnCopySyncLink.innerHTML;
                    btnCopySyncLink.innerHTML = '<i data-lucide="check" style="width: 18px; height: 18px;"></i> Copied!';
                    if (window.lucide) window.lucide.createIcons();
                    setTimeout(() => {
                        btnCopySyncLink.innerHTML = originalHtml;
                        if (window.lucide) window.lucide.createIcons();
                    }, 2000);
                });
            }
        };
    }
});

// Initializers
onAuthStateChanged(auth, async (user) => {
    const createBtn = document.getElementById('btn-create-event');
    const loginLink = document.getElementById('btn-login-page');
    const logoutBtn = document.getElementById('btn-logout');
    const orgSwitcher = document.getElementById('btn-open-org-modal');

    if (user) {
        // Sync with backend session first to prevent race conditions
        await ensureAuthSynced();

        loginLink?.classList.add('hidden');
        logoutBtn?.classList.remove('hidden');
        orgSwitcher?.classList.remove('hidden');

        const data = await fetchUserOrgs();
        state.userOrgs = data.orgs || [];
        updateOrgSwitcher(state.userOrgs);
        renderMyOrgsPanel(state.userOrgs);
        updateCreateButtonVisibility();
        renderDashboard(state);
    } else {
        createBtn?.classList.add('hidden');
        loginLink?.classList.remove('hidden');
        logoutBtn?.classList.add('hidden');
        orgSwitcher?.classList.add('hidden');
        state.userOrgs = [];
    }
});

// Firestore Listeners
if (db) {
    onSnapshot(collection(db, "rooms"), (snapshot) => {
        state.rooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderDashboard(state);
    });

    onSnapshot(collection(db, "events"), (snapshot) => {
        state.events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderDashboard(state);
    });

    onSnapshot(collection(db, "organizations"), (snapshot) => {
        state.allOrganizations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderDashboard(state);
    });
}
