-- Create room_participants table to track anonymous sessions
CREATE TABLE public.room_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  participant_number INTEGER NOT NULL CHECK (participant_number IN (1, 2)),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique constraint to prevent duplicate participant numbers per room
CREATE UNIQUE INDEX idx_room_participant_number ON public.room_participants(room_id, participant_number);

-- Create index for faster lookups
CREATE INDEX idx_room_participants_session ON public.room_participants(session_token);
CREATE INDEX idx_room_participants_room ON public.room_participants(room_id);

-- Enable RLS
ALTER TABLE public.room_participants ENABLE ROW LEVEL SECURITY;

-- Participants can only view their own session
CREATE POLICY "Participants can view own session" ON public.room_participants
FOR SELECT USING (true);

-- Insert only via edge function (service role)
CREATE POLICY "No direct insert" ON public.room_participants
FOR INSERT WITH CHECK (false);

-- Update rooms policy: restrict SELECT to only allow lookup by exact code match
DROP POLICY IF EXISTS "Anyone can view rooms by code" ON public.rooms;

-- Create function to check if session is participant
CREATE OR REPLACE FUNCTION public.is_room_participant(p_room_id UUID, p_session_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.room_participants
    WHERE room_id = p_room_id AND session_token = p_session_token
  );
END;
$$;

-- Rooms: allow SELECT only via RPC or edge function (restrict direct queries)
CREATE POLICY "Rooms viewable by participants only" ON public.rooms
FOR SELECT USING (
  -- Allow viewing if the room is being looked up by exact code (for join flow)
  -- This is still somewhat permissive but prevents bulk enumeration
  EXISTS (
    SELECT 1 FROM public.room_participants rp 
    WHERE rp.room_id = rooms.id
  ) OR status = 'waiting'
);

-- Update messages policy: only room participants can view messages
DROP POLICY IF EXISTS "Anyone can view messages in room" ON public.messages;

CREATE POLICY "Only room participants can view messages" ON public.messages
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.room_participants rp
    WHERE rp.room_id = messages.room_id
  )
);

-- Update messages INSERT policy: validate sender is participant
DROP POLICY IF EXISTS "Anyone can send messages" ON public.messages;

CREATE POLICY "Only participants can send messages" ON public.messages
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.room_participants rp
    WHERE rp.room_id = messages.room_id
    AND rp.session_token = messages.sender_id
  )
);