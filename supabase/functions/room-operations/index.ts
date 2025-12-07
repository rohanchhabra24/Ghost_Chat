import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateRoomRequest {
  action: 'create';
  durationMinutes: number;
}

interface JoinRoomRequest {
  action: 'join';
  code: string;
}

interface GetRoomRequest {
  action: 'get';
  code: string;
  sessionToken: string;
}

interface GetMessagesRequest {
  action: 'getMessages';
  roomId: string;
  sessionToken: string;
}

type RoomRequest = CreateRoomRequest | JoinRoomRequest | GetRoomRequest | GetMessagesRequest;

// Generate a random 6-character room code
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Generate a secure session token
function generateSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Use service role to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: RoomRequest = await req.json();
    console.log('Room operation request:', body.action);

    if (body.action === 'create') {
      const { durationMinutes } = body as CreateRoomRequest;
      
      if (!durationMinutes || durationMinutes < 1 || durationMinutes > 120) {
        return new Response(
          JSON.stringify({ error: 'Invalid duration. Must be between 1 and 120 minutes.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const code = generateRoomCode();
      const sessionToken = generateSessionToken();
      const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

      // Create the room
      const { data: room, error: roomError } = await supabase
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

      if (roomError) {
        console.error('Error creating room:', roomError);
        return new Response(
          JSON.stringify({ error: 'Failed to create room' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Register the creator as participant 1
      const { error: participantError } = await supabase
        .from('room_participants')
        .insert({
          room_id: room.id,
          session_token: sessionToken,
          participant_number: 1,
        });

      if (participantError) {
        console.error('Error registering participant:', participantError);
        // Clean up the room
        await supabase.from('rooms').delete().eq('id', room.id);
        return new Response(
          JSON.stringify({ error: 'Failed to register as participant' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Room created successfully:', room.code);
      return new Response(
        JSON.stringify({ 
          room, 
          sessionToken,
          participantNumber: 1
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (body.action === 'join') {
      const { code } = body as JoinRoomRequest;
      console.log('Join request for code:', code);
      
      if (!code || code.length !== 6) {
        console.log('Invalid code length:', code?.length);
        return new Response(
          JSON.stringify({ error: 'Invalid room code' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Find the room - use maybeSingle to handle no results gracefully
      const { data: room, error: findError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', code.toUpperCase())
        .maybeSingle();

      console.log('Room lookup result:', { room: room?.code, findError: findError?.message });

      if (findError) {
        console.error('Database error finding room:', findError);
        return new Response(
          JSON.stringify({ error: 'Database error' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!room) {
        console.log('Room not found for code:', code.toUpperCase());
        return new Response(
          JSON.stringify({ error: 'Room not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if room is expired
      if (new Date(room.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: 'This room has expired' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check room status
      if (room.status === 'expired') {
        return new Response(
          JSON.stringify({ error: 'This room is no longer available' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (room.status === 'active' && room.participant_count >= 2) {
        return new Response(
          JSON.stringify({ error: 'This room is already full' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const sessionToken = generateSessionToken();

      // Register as participant 2
      const { error: participantError } = await supabase
        .from('room_participants')
        .insert({
          room_id: room.id,
          session_token: sessionToken,
          participant_number: 2,
        });

      if (participantError) {
        console.error('Error registering participant:', participantError);
        return new Response(
          JSON.stringify({ error: 'Failed to join room. It may be full.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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
        console.error('Error updating room:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to join room' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Joined room successfully:', room.code);
      return new Response(
        JSON.stringify({ 
          room: updatedRoom, 
          sessionToken,
          participantNumber: 2
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (body.action === 'get') {
      const { code, sessionToken } = body as GetRoomRequest;
      
      if (!code || !sessionToken) {
        return new Response(
          JSON.stringify({ error: 'Missing code or session token' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Find the room
      const { data: room, error: findError } = await supabase
        .from('rooms')
        .select()
        .eq('code', code.toUpperCase())
        .single();

      if (findError || !room) {
        return new Response(
          JSON.stringify({ error: 'Room not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify the session token is a participant
      const { data: participant, error: participantError } = await supabase
        .from('room_participants')
        .select()
        .eq('room_id', room.id)
        .eq('session_token', sessionToken)
        .single();

      if (participantError || !participant) {
        return new Response(
          JSON.stringify({ error: 'Not authorized to access this room' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          room,
          participantNumber: participant.participant_number
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET MESSAGES - secure message retrieval with session validation
    if (body.action === 'getMessages') {
      const { roomId, sessionToken } = body;
      
      if (!roomId || !sessionToken) {
        return new Response(
          JSON.stringify({ error: 'Missing roomId or session token' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify the session token is a participant of this room
      const { data: participant, error: participantError } = await supabase
        .from('room_participants')
        .select()
        .eq('room_id', roomId)
        .eq('session_token', sessionToken)
        .single();

      if (participantError || !participant) {
        console.log('Unauthorized message access attempt');
        return new Response(
          JSON.stringify({ error: 'Not authorized to access this room' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch messages for the room
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      if (messagesError) {
        console.error('Error fetching messages:', messagesError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch messages' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ messages: messages || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in room-operations:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
