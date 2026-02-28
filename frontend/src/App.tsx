import React, { useState } from 'react';
import { Clock, Filter, Plus, User as UserIcon, Calendar, Bell } from 'lucide-react';
import { format, addHours, startOfHour } from 'date-fns';
import { useFirestore } from './hooks/useFirestore';
import FloorMap from './components/FloorMap';
import RoomPanel from './components/RoomPanel';
import { Room, Event } from './types';
import { mockRooms, mockEvents, mockPeople, mockDutyShifts } from './mockData';

function App() {
  const { data: firestoreRooms, loading: roomsLoading, error: roomsError } = useFirestore<Room>('rooms');
  const { data: firestoreEvents, loading: eventsLoading, error: eventsError } = useFirestore<Event>('events');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<Date>(startOfHour(new Date()));
  const [showAdminModal, setShowAdminModal] = useState(false);

  // Fallback to mock data if Firestore is empty or still loading
  const rooms = firestoreRooms.length > 0 ? firestoreRooms : mockRooms;
  const events = firestoreEvents.length > 0 ? firestoreEvents : mockEvents;

  const selectedRoom = rooms.find(r => r.id === selectedRoomId) || null;

  const handleTimelineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hoursToAdd = parseInt(e.target.value);
    const newTime = addHours(startOfHour(new Date()), hoursToAdd);
    setCurrentTime(newTime);
  };

  if (roomsError || eventsError) {
    console.error("Firestore Error:", roomsError || eventsError);
  }

  return (
    <div className="dashboard-container">
      <main className="main-content">
        <header className="header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Calendar size={28} style={{ color: 'var(--secondary)' }} /> Building Events Dashboard
            </h1>
            <div style={{ padding: '0.5rem 1rem', background: '#eef2ff', color: 'var(--secondary)', borderRadius: '12px', fontSize: '0.9rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <Clock size={18} /> {format(currentTime, 'EEEE, MMM do • HH:mm')}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={() => setShowAdminModal(true)}>
              <Plus size={20} /> Create Event
            </button>
            <div style={{ width: '42px', height: '42px', background: '#f1f5f9', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px solid #e2e8f0', color: '#64748b' }}>
              <UserIcon size={22} />
            </div>
          </div>
        </header>

        <FloorMap 
          rooms={rooms} 
          events={events} 
          selectedRoomId={selectedRoomId} 
          onRoomClick={setSelectedRoomId}
          currentTime={currentTime}
        />

        <footer className="timeline-bar">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--primary)' }}>Timeline Explorer</span>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Drag to view upcoming shifts</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="24" 
            defaultValue="0" 
            onChange={handleTimelineChange}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', textAlign: 'right' }}>
            <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#64748b' }}>Next 24 Hours</span>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Real-time updates active</span>
          </div>
        </footer>
      </main>

      <RoomPanel 
        room={selectedRoom} 
        events={events} 
        dutyShifts={mockDutyShifts} 
        people={mockPeople} 
        onClose={() => setSelectedRoomId(null)}
      />

      {showAdminModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', padding: '2.5rem', borderRadius: '20px', width: '450px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)' }}>
            <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>Create New Event</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.5rem', color: '#64748b' }}>Event Title</label>
                <input placeholder="Finals Prep Session" style={{ width: '100%', padding: '0.8rem', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '1rem', outline: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.5rem', color: '#64748b' }}>Location</label>
                <select style={{ width: '100%', padding: '0.8rem', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '1rem', background: '#f8fafc' }}>
                  <option value="">Select Room</option>
                  {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.5rem', color: '#64748b' }}>Start</label>
                  <input type="time" style={{ width: '100%', padding: '0.8rem', border: '1px solid #e2e8f0', borderRadius: '10px' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.5rem', color: '#64748b' }}>End</label>
                  <input type="time" style={{ width: '100%', padding: '0.8rem', border: '1px solid #e2e8f0', borderRadius: '10px' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button className="btn" onClick={() => setShowAdminModal(false)} style={{ flex: 1, background: '#f1f5f9', color: '#64748b' }}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1, padding: '0.8rem' }}>Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
