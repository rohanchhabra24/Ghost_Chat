import { supabase } from "@/integrations/supabase/client";

// Generate a random 6-character room code
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars like 0, O, 1, I
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Generate a unique participant ID for this session
export function generateParticipantId(): string {
  return crypto.randomUUID();
}

// Get or create participant ID from session storage
export function getParticipantId(): string {
  const stored = sessionStorage.getItem('participantId');
  if (stored) return stored;
  
  const newId = generateParticipantId();
  sessionStorage.setItem('participantId', newId);
  return newId;
}

// Create a new room
export async function createRoom(durationMinutes: number) {
  const code = generateRoomCode();
  const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

  const { data, error } = await supabase
    .from('rooms')
    .insert({
      code,
      duration_minutes: durationMinutes,
      expires_at: expiresAt.toISOString(),
      status: 'waiting',
      participant_count: 1,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating room:', error);
    throw error;
  }

  return data;
}

// Join an existing room by code
export async function joinRoom(code: string) {
  // First, find the room
  const { data: room, error: findError } = await supabase
    .from('rooms')
    .select()
    .eq('code', code.toUpperCase())
    .single();

  if (findError || !room) {
    return { error: 'Room not found' };
  }

  // Check if room is expired
  if (new Date(room.expires_at) < new Date()) {
    return { error: 'This room has expired' };
  }

  // Check room status
  if (room.status === 'expired') {
    return { error: 'This room is no longer available' };
  }

  if (room.status === 'active' && room.participant_count >= 2) {
    return { error: 'This room is already full' };
  }

  // Update room to active status with 2 participants
  const { data: updatedRoom, error: updateError } = await supabase
    .from('rooms')
    .update({
      status: 'active',
      participant_count: 2,
    })
    .eq('id', room.id)
    .select()
    .single();

  if (updateError) {
    console.error('Error joining room:', updateError);
    return { error: 'Failed to join room' };
  }

  return { room: updatedRoom };
}

// Get room by code
export async function getRoomByCode(code: string) {
  const { data, error } = await supabase
    .from('rooms')
    .select()
    .eq('code', code.toUpperCase())
    .single();

  if (error) {
    return null;
  }

  return data;
}

// Send a message
export async function sendMessage(roomId: string, content: string, senderId: string, type: 'text' | 'image' = 'text', imageUrl?: string) {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      room_id: roomId,
      sender_id: senderId,
      content: type === 'text' ? content : null,
      image_url: type === 'image' ? imageUrl : null,
      message_type: type,
    })
    .select()
    .single();

  if (error) {
    console.error('Error sending message:', error);
    throw error;
  }

  return data;
}

// Subscribe to messages in a room
export function subscribeToMessages(roomId: string, onMessage: (message: any) => void) {
  const channel = supabase
    .channel(`room-messages-${roomId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => {
        onMessage(payload.new);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// Subscribe to room status changes
export function subscribeToRoom(roomId: string, onUpdate: (room: any) => void) {
  const channel = supabase
    .channel(`room-status-${roomId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'rooms',
        filter: `id=eq.${roomId}`,
      },
      (payload) => {
        onUpdate(payload.new);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// Mark room as expired
export async function expireRoom(roomId: string) {
  const { error } = await supabase
    .from('rooms')
    .update({ status: 'expired' })
    .eq('id', roomId);

  if (error) {
    console.error('Error expiring room:', error);
  }
}

// Format time remaining
export function formatTimeRemaining(expiresAt: string): string {
  const now = new Date();
  const expires = new Date(expiresAt);
  const diff = expires.getTime() - now.getTime();

  if (diff <= 0) return '00:00';

  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Check if time is running low (less than 1 minute)
export function isTimeUrgent(expiresAt: string): boolean {
  const now = new Date();
  const expires = new Date(expiresAt);
  const diff = expires.getTime() - now.getTime();
  return diff <= 60000 && diff > 0;
}