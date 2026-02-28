import React from 'react';
import { Room, Event } from '../types';

interface FloorMapProps {
  rooms: Room[];
  events: Event[];
  selectedRoomId: string | null;
  onRoomClick: (roomId: string) => void;
  currentTime: Date;
}

const FloorMap: React.FC<FloorMapProps> = ({ rooms, events, selectedRoomId, onRoomClick, currentTime }) => {
  
  const getRoomColor = (roomId: string) => {
    const activeEvents = events.filter(e => 
      e.room_id === roomId && 
      new Date(e.start) <= currentTime && 
      new Date(e.end) >= currentTime
    );
    
    if (activeEvents.length === 0) return '#f1f5f9';
    if (activeEvents.some(e => e.type === 'fire_drill')) return '#ef4444';
    if (activeEvents.some(e => e.type === 'maintenance')) return '#f59e0b';
    if (activeEvents.length > 2) return 'var(--heatmap-high)';
    return 'var(--heatmap-mid)';
  };

  return (
    <div className="floor-plan-container">
      <svg width="800" height="500" viewBox="0 0 800 500">
        {rooms.map(room => {
          const color = getRoomColor(room.id);
          const isActive = selectedRoomId === room.id;
          
          return (
            <g key={room.id} className={`room ${isActive ? 'active' : ''}`} onClick={() => onRoomClick(room.id)}>
              <rect
                x={room.x}
                y={room.y}
                width={room.width}
                height={room.height}
                fill={color}
                stroke={isActive ? 'var(--accent)' : '#cbd5e1'}
                strokeWidth={isActive ? '3' : '1'}
                rx="8"
              />
              <text
                x={room.x + room.width / 2}
                y={room.y + room.height / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="13"
                fill={color === '#f1f5f9' ? '#475569' : 'white'}
                pointerEvents="none"
                fontWeight="600"
              >
                {room.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default FloorMap;
