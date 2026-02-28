import React from 'react';
import { Room, Event, DutyShift, Person } from '../types';
import { Clock, Users, Shield, MapPin, Tag, Phone, Calendar as CalendarIcon, X } from 'lucide-react';
import { format } from 'date-fns';

interface RoomPanelProps {
  room: Room | null;
  events: Event[];
  dutyShifts: DutyShift[];
  people: Person[];
  onClose: () => void;
}

const RoomPanel: React.FC<RoomPanelProps> = ({ room, events, dutyShifts, people, onClose }) => {
  if (!room) return (
    <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
      <CalendarIcon size={48} strokeWidth={1} style={{ marginBottom: '1rem' }} />
      <p>Select a room to see details</p>
    </aside>
  );

  const roomEvents = events.filter(e => e.room_id === room.id);
  const currentDuty = dutyShifts.filter(s => s.room_scope.includes(room.id));

  return (
    <aside className="sidebar">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>{room.name}</h2>
        <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', padding: '0.4rem', borderRadius: '50%', color: '#64748b', display: 'flex' }}>
          <X size={20} />
        </button>
      </div>

      <div style={{ marginBottom: '2rem', fontSize: '0.9rem', color: '#64748b' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <MapPin size={18} color="#94a3b8" /> Floor {room.floor}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <Users size={18} color="#94a3b8" /> Capacity: {room.capacity}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
          {room.tags.map(tag => (
            <span key={tag} style={{ background: '#f1f5f9', color: '#475569', padding: '0.25rem 0.75rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Tag size={12} /> {tag}
            </span>
          ))}
        </div>
      </div>

      <section style={{ marginBottom: '2.5rem' }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', marginBottom: '1rem' }}>
          Events
        </h3>
        {roomEvents.length === 0 ? (
          <div style={{ padding: '1.5rem', background: '#f8fafc', borderRadius: '12px', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
            No events scheduled
          </div>
        ) : (
          roomEvents.map(event => (
            <div key={event.id} style={{ padding: '1rem', background: '#ffffff', borderRadius: '12px', marginBottom: '1rem', border: '1px solid #e2e8f0', borderLeft: '4px solid var(--secondary)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <div style={{ fontWeight: '700', color: 'var(--text-dark)', marginBottom: '0.4rem' }}>{event.title}</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Clock size={14} /> {format(new Date(event.start), 'HH:mm')} - {format(new Date(event.end), 'HH:mm')}
              </div>
              <div style={{ fontSize: '0.8rem', marginTop: '0.5rem', color: '#475569' }}>
                Organized by <span style={{ fontWeight: '600' }}>{event.organizer}</span>
              </div>
            </div>
          ))
        )}
      </section>

      <section>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', marginBottom: '1rem' }}>
          Staff on duty
        </h3>
        {currentDuty.length === 0 ? (
          <div style={{ padding: '1.5rem', background: '#f8fafc', borderRadius: '12px', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
            No staff assigned
          </div>
        ) : (
          currentDuty.map(shift => {
            const person = people.find(p => p.id === shift.person_id);
            return (
              <div key={shift.id} style={{ padding: '1rem', background: '#f0f9ff', borderRadius: '12px', marginBottom: '1rem', border: '1px solid #bae6fd' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div style={{ width: '40px', height: '40px', background: 'var(--accent)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                    <Shield size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--primary)' }}>{person?.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#0ea5e9', fontWeight: '700' }}>{shift.role.toUpperCase()}</div>
                  </div>
                </div>
                <button className="btn btn-primary" style={{ width: '100%', fontSize: '0.85rem', background: '#0ea5e9', borderRadius: '8px' }}>
                  <Phone size={14} /> Contact Staff
                </button>
              </div>
            );
          })
        )}
      </section>
    </aside>
  );
};

export default RoomPanel;
