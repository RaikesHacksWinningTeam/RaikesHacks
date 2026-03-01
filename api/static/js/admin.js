export function editEventModal(eventId, state) {
    const event = state.events.find(e => e.id === eventId);
    if (!event) return;

    const myRole = state.userOrgs.find(o => o.id === event.org_id)?.role || 'viewer';
    const canEdit = ['admin', 'owner'].includes(myRole);

    document.getElementById('modal-title').textContent = canEdit ? 'Edit Event' : 'Event Details';
    document.getElementById('event-id').value = event.id;
    document.getElementById('event-title').value = event.title;

    const eventOrgSelect = document.getElementById('event-org');
    const eventRoomSelect = document.getElementById('event-room');
    const eventDateInput = document.getElementById('event-date');

    const manageableOrgs = state.userOrgs.filter(o => ['admin', 'owner'].includes(o.role));

    // In read-only mode, the organization might not be in manageableOrgs
    const options = manageableOrgs.slice();
    if (!options.find(o => o.id === event.org_id)) {
        const viewOnlyOrg = state.allOrganizations.find(o => o.id === event.org_id);
        if (viewOnlyOrg) {
            options.push(viewOnlyOrg);
        }
    }

    if (eventOrgSelect) eventOrgSelect.innerHTML = options.map(o => `<option value="${o.id}" ${o.id === event.org_id ? 'selected' : ''}>${o.name}</option>`).join('');
    if (eventRoomSelect) eventRoomSelect.innerHTML = state.rooms.map(r => `<option value="${r.id}" ${r.id === event.room_id ? 'selected' : ''}>${r.name}</option>`).join('');

    const eventStartDate = new Date(event.start);
    const yyyy = eventStartDate.getFullYear();
    const mm = String(eventStartDate.getMonth() + 1).padStart(2, '0');
    const dd = String(eventStartDate.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const startStr = eventStartDate.toTimeString().slice(0, 5);
    const endStr = new Date(event.end).toTimeString().slice(0, 5);

    if (eventDateInput) eventDateInput.value = dateStr;
    document.getElementById('event-start').value = startStr;
    document.getElementById('event-end').value = endStr;

    // myRole and canEdit already evaluated above

    const btnDelete = document.getElementById('btn-delete-event');
    const btnSave = document.querySelector('#event-form button[type="submit"]');

    if (canEdit) {
        if (btnDelete) btnDelete.classList.remove('hidden');
        if (btnSave) btnSave.disabled = false;
        if (eventOrgSelect) eventOrgSelect.disabled = false;
        if (eventRoomSelect) eventRoomSelect.disabled = false;
        if (eventDateInput) eventDateInput.disabled = false;
        document.getElementById('event-title').disabled = false;
        document.getElementById('event-start').disabled = false;
        document.getElementById('event-end').disabled = false;
    } else {
        if (btnDelete) btnDelete.classList.add('hidden');
        if (btnSave) btnSave.disabled = true;
        if (eventOrgSelect) eventOrgSelect.disabled = true;
        if (eventRoomSelect) eventRoomSelect.disabled = true;
        if (eventDateInput) eventDateInput.disabled = true;
        document.getElementById('event-title').disabled = true;
        document.getElementById('event-start').disabled = true;
        document.getElementById('event-end').disabled = true;
    }

    const adminModal = document.getElementById('admin-modal');
    if (adminModal) adminModal.classList.remove('hidden');
}

export function createEventModal(state, defaultOrgId = null, defaultStart = '', defaultEnd = '') {
    const eventOrgSelect = document.getElementById('event-org');
    const eventRoomSelect = document.getElementById('event-room');
    const eventDateInput = document.getElementById('event-date');

    document.getElementById('modal-title').textContent = 'Create New Event';
    document.getElementById('event-id').value = '';
    document.getElementById('event-title').value = '';
    document.getElementById('event-start').value = defaultStart;
    document.getElementById('event-end').value = defaultEnd;

    const targetDate = state.selectedDate || new Date();
    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const dd = String(targetDate.getDate()).padStart(2, '0');
    const today = `${yyyy}-${mm}-${dd}`;

    if (eventDateInput) {
        eventDateInput.value = today;
        eventDateInput.disabled = false;
    }

    const btnDelete = document.getElementById('btn-delete-event');
    if (btnDelete) btnDelete.classList.add('hidden');

    const manageableOrgs = state.userOrgs.filter(o => ['admin', 'owner'].includes(o.role));

    if (eventOrgSelect) {
        eventOrgSelect.innerHTML = manageableOrgs.map(o => `<option value="${o.id}">${o.name}</option>`).join('');
        if (defaultOrgId && manageableOrgs.some(o => o.id === defaultOrgId)) {
            eventOrgSelect.value = defaultOrgId;
        }
    }
    if (eventRoomSelect) eventRoomSelect.innerHTML = state.rooms.map(r => `<option value="${r.id}">${r.name}</option>`).join('');

    const btnSave = document.querySelector('#event-form button[type="submit"]');
    if (btnSave) btnSave.disabled = false;
    if (eventOrgSelect) eventOrgSelect.disabled = false;
    if (eventRoomSelect) eventRoomSelect.disabled = false;
    document.getElementById('event-title').disabled = false;
    document.getElementById('event-start').disabled = false;
    document.getElementById('event-end').disabled = false;

    const adminModal = document.getElementById('admin-modal');
    if (adminModal) adminModal.classList.remove('hidden');
}
