export interface Room {
  id: string;
  name: string;
  capacity: number;
  tags: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  floor: number;
}

export interface Event {
  id: string;
  room_id: string;
  title: string;
  start: string;
  end: string;
  type: 'maintenance' | 'tour' | 'private' | 'fire_drill' | 'general';
  organizer: string;
  status: 'scheduled' | 'active' | 'cancelled';
  occupancy_estimate?: number;
  notes?: string;
}

export interface DutyShift {
  id: string;
  person_id: string;
  role: 'security' | 'RA' | 'staff';
  room_scope: string[]; // array of room IDs
  start: string;
  end: string;
  contact: string;
}

export interface Person {
  id: string;
  name: string;
  role: string;
  contact_info: string;
  photo?: string;
}
