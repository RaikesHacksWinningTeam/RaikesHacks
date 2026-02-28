export function openCalendarModal(eventId, state) {
    const event = state.events.find(e => e.id === eventId);
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

    const calendarModal = document.getElementById('calendar-modal');
    const calendarLinkInput = document.getElementById('calendar-link-input');

    if (calendarLinkInput) calendarLinkInput.value = url;
    if (calendarModal) {
        calendarModal.classList.remove('hidden');
    }

    if (window.lucide) {
        window.lucide.createIcons();
    }
}
