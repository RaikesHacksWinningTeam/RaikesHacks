// Firebase Configuration - Passed from Flask via index.html
const firebaseConfig = window.firebaseConfig;

// Import Firebase SDK (Modular v10+)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, addDoc, query, orderBy, serverTimestamp, updateDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
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
        console.log("✅ Firebase initialized successfully.");
        
        // Track login status
        onAuthStateChanged(auth, (user) => {
            console.log("👤 Auth State Changed. User:", user ? user.email : "Logged Out");
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
            .attr('x', width/2)
            .attr('y', height/2)
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
        .each(function(d) {
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
                    <div style="font-size: 0.8rem; color: #64748b;">${new Date(e.start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - ${new Date(e.end).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
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
