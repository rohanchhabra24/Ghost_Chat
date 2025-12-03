-- Create rooms table for ephemeral chat rooms
CREATE TABLE public.rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR(8) NOT NULL UNIQUE,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'expired')),
  participant_count INTEGER NOT NULL DEFAULT 1
);

-- Create messages table for ephemeral messages
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  sender_id VARCHAR(36) NOT NULL,
  content TEXT,
  image_url TEXT,
  message_type VARCHAR(10) NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Public policies for rooms (no auth required for ephemeral chat)
CREATE POLICY "Anyone can create rooms" ON public.rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view rooms by code" ON public.rooms FOR SELECT USING (true);
CREATE POLICY "Anyone can update room status" ON public.rooms FOR UPDATE USING (true);

-- Public policies for messages
CREATE POLICY "Anyone can send messages" ON public.messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view messages in room" ON public.messages FOR SELECT USING (true);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;

-- Index for faster room lookups
CREATE INDEX idx_rooms_code ON public.rooms(code);
CREATE INDEX idx_rooms_status ON public.rooms(status);
CREATE INDEX idx_messages_room_id ON public.messages(room_id);

-- Function to clean up expired rooms
CREATE OR REPLACE FUNCTION public.cleanup_expired_rooms()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.rooms SET status = 'expired' WHERE expires_at < now() AND status != 'expired';
  DELETE FROM public.rooms WHERE status = 'expired' AND expires_at < now() - INTERVAL '1 hour';
END;
$$;