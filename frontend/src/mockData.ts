import { Room, Event, DutyShift, Person } from './types';

export const mockRooms: Room[] = [
  { id: '101', name: 'Study Lounge', capacity: 20, tags: ['study', 'quiet'], x: 50, y: 50, width: 120, height: 80, floor: 1 },
  { id: '102', name: 'Conference Room A', capacity: 10, tags: ['meeting', 'media'], x: 180, y: 50, width: 100, height: 80, floor: 1 },
  { id: '103', name: 'Open Workspace', capacity: 40, tags: ['collab'], x: 290, y: 50, width: 200, height: 150, floor: 1 },
  { id: '104', name: 'Storage', capacity: 0, tags: ['storage'], x: 50, y: 140, width: 80, height: 60, floor: 1 },
  { id: '105', name: 'Kitchenette', capacity: 5, tags: ['food'], x: 140, y: 140, width: 60, height: 60, floor: 1 },
  { id: '106', name: 'Security Office', capacity: 3, tags: ['staff'], x: 210, y: 140, width: 70, height: 60, floor: 1 },
];

const now = new Date();
const nextHour = new Date(now.getTime() + 3600000);

export const mockEvents: Event[] = [
  {
    id: 'e1',
    room_id: '101',
    title: 'Finals Prep Session',
    start: now.toISOString(),
    end: nextHour.toISOString(),
    type: 'general',
    organizer: 'Student Council',
    status: 'active',
  },
  {
    id: 'e2',
    room_id: '102',
    title: 'Admissions Tour',
    start: now.toISOString(),
    end: nextHour.toISOString(),
    type: 'tour',
    organizer: 'Admissions Office',
    status: 'scheduled',
  },
];

export const mockPeople: Person[] = [
  { id: 'p1', name: 'Alex Smith', role: 'RA', contact_info: '555-0101' },
  { id: 'p2', name: 'Casey Jones', role: 'Security', contact_info: '555-0102' },
];

export const mockDutyShifts: DutyShift[] = [
  {
    id: 's1',
    person_id: 'p1',
    role: 'RA',
    room_scope: ['101', '102', '103'],
    start: now.toISOString(),
    end: nextHour.toISOString(),
    contact: '555-0101',
  },
];
