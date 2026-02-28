export function editEventModal(eventId, state) {
    const event = state.events.find(e => e.id === eventId);
    if (!event) return;

    document.getElementById('modal-title').textContent = 'Edit Event';
    document.getElementById('event-id').value = event.id;
    document.getElementById('event-title').value = event.title;

    const eventOrgSelect = document.getElementById('event-org');
    const eventRoomSelect = document.getElementById('event-room');

    if (eventOrgSelect) eventOrgSelect.innerHTML = state.allOrganizations.map(o => `<option value="${o.id}" ${o.id === event.org_id ? 'selected' : ''}>${o.name}</option>`).join('');
    if (eventRoomSelect) eventRoomSelect.innerHTML = state.rooms.map(r => `<option value="${r.id}" ${r.id === event.room_id ? 'selected' : ''}>${r.name}</option>`).join('');

    const startStr = new Date(event.start).toTimeString().slice(0, 5);
    const endStr = new Date(event.end).toTimeString().slice(0, 5);
    document.getElementById('event-start').value = startStr;
    document.getElementById('event-end').value = endStr;

    const btnDelete = document.getElementById('btn-delete-event');
    if (btnDelete) btnDelete.classList.remove('hidden');

    const adminModal = document.getElementById('admin-modal');
    if (adminModal) adminModal.classList.remove('hidden');
}

export function createEventModal(state) {
    const eventOrgSelect = document.getElementById('event-org');
    const eventRoomSelect = document.getElementById('event-room');

    document.getElementById('modal-title').textContent = 'Create New Event';
    document.getElementById('event-id').value = '';
    document.getElementById('event-title').value = '';
    document.getElementById('event-start').value = '';
    document.getElementById('event-end').value = '';

    const btnDelete = document.getElementById('btn-delete-event');
    if (btnDelete) btnDelete.classList.add('hidden');

    if (eventOrgSelect) eventOrgSelect.innerHTML = state.allOrganizations.map(o => `<option value="${o.id}">${o.name}</option>`).join('');
    if (eventRoomSelect) eventRoomSelect.innerHTML = state.rooms.map(r => `<option value="${r.id}">${r.name}</option>`).join('');

    const adminModal = document.getElementById('admin-modal');
    if (adminModal) adminModal.classList.remove('hidden');
}
