import { supabase } from "@/integrations/supabase/client";

// Session token is now generated server-side and stored in sessionStorage
const SESSION_TOKEN_KEY = 'roomSessionToken';
const ROOM_CODE_KEY = 'roomCode';

// Get stored session token for current room
export function getSessionToken(): string | null {
  return sessionStorage.getItem(SESSION_TOKEN_KEY);
}

// Store session token
export function setSessionToken(token: string): void {
  sessionStorage.setItem(SESSION_TOKEN_KEY, token);
}

// Clear session data
export function clearSession(): void {
  sessionStorage.removeItem(SESSION_TOKEN_KEY);
  sessionStorage.removeItem(ROOM_CODE_KEY);
}

// Get stored room code
export function getStoredRoomCode(): string | null {
  return sessionStorage.getItem(ROOM_CODE_KEY);
}

// Store room code
export function setStoredRoomCode(code: string): void {
  sessionStorage.setItem(ROOM_CODE_KEY, code);
}

// Create a new room via edge function
export async function createRoom(durationMinutes: number) {
  const { data, error } = await supabase.functions.invoke('room-operations', {
    body: {
      action: 'create',
      durationMinutes,
    },
  });

  if (error) {
    console.error('Error creating room:', error);
    throw error;
  }

  if (data.error) {
    throw new Error(data.error);
  }

  // Store the session token
  setSessionToken(data.sessionToken);
  setStoredRoomCode(data.room.code);

  return data.room;
}

// Join an existing room by code via edge function
export async function joinRoom(code: string) {
  const { data, error } = await supabase.functions.invoke('room-operations', {
    body: {
      action: 'join',
      code: code.toUpperCase(),
    },
  });

  if (error) {
    console.error('Error joining room:', error);
    return { error: error.message || 'Failed to join room' };
  }

  if (data.error) {
    return { error: data.error };
  }

  // Store the session token
  setSessionToken(data.sessionToken);
  setStoredRoomCode(data.room.code);

  return { room: data.room };
}

// Get room by code (requires valid session token)
export async function getRoomByCode(code: string) {
  const sessionToken = getSessionToken();
  
  if (!sessionToken) {
    return null;
  }

  const { data, error } = await supabase.functions.invoke('room-operations', {
    body: {
      action: 'get',
      code: code.toUpperCase(),
      sessionToken,
    },
  });

  if (error || data?.error) {
    return null;
  }

  return data.room;
}

// Send a message (sender_id is now the session token for RLS validation)
export async function sendMessage(roomId: string, content: string, senderId: string, type: 'text' | 'image' = 'text', imageUrl?: string) {
  const sessionToken = getSessionToken();
  
  if (!sessionToken) {
    throw new Error('No valid session. Please rejoin the room.');
  }

  const { data, error } = await supabase.functions.invoke('room-operations', {
    body: {
      action: 'sendMessage',
      roomId,
      sessionToken,
      content: type === 'text' ? content : null,
      messageType: type,
      imageUrl: type === 'image' ? imageUrl : null,
    },
  });

  if (error) {
    console.error('Error sending message:', error);
    throw error;
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data.message;
}

// Get messages via edge function (secure)
export async function getMessages(roomId: string) {
  const sessionToken = getSessionToken();
  
  if (!sessionToken) {
    return [];
  }

  const { data, error } = await supabase.functions.invoke('room-operations', {
    body: {
      action: 'getMessages',
      roomId,
      sessionToken,
    },
  });

  if (error || data?.error) {
    console.error('Error fetching messages:', error || data?.error);
    return [];
  }

  return data.messages || [];
}

// Subscribe to messages in a room (realtime still works for new messages)
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
  
  // Clear session on expiry
  clearSession();
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

// Legacy function for backwards compatibility - now returns session token
export function getParticipantId(): string {
  const token = getSessionToken();
  if (token) return token;
  
  // Fallback for edge cases (should not happen in normal flow)
  console.warn('No session token found, session may be invalid');
  return '';
}
