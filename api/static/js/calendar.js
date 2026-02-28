// Example logic to update in calendar.js
export function openCalendarModal(orgId, state) {
    const org = state.userOrgs.find(o => o.id === orgId);
    if (!org) return;

    // The feed URL from your Flask server
    const baseUrl = `${window.location.host}/api/orgs/${orgId}/calendar.ics`;
    const httpsUrl = `https://${baseUrl}`;
    const webcalUrl = `webcal://${baseUrl}`;

    document.getElementById('calendar-modal-title').textContent = `Sync ${org.name}`;

    // Set the direct link
    const subscribeBtn = document.getElementById('btn-subscribe-calendar');
    subscribeBtn.href = webcalUrl;

    // Set the manual copy link
    const calendarLinkInput = document.getElementById('calendar-link-input');
    calendarLinkInput.value = httpsUrl;

    document.getElementById('calendar-modal').classList.remove('hidden');
}