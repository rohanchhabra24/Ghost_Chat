-- Fix 1: Remove public SELECT from room_participants (session tokens exposed)
DROP POLICY IF EXISTS "Participants can view own session" ON room_participants;
-- No SELECT policy = client can't read session tokens directly
-- The edge function uses service role and doesn't need client access

-- Fix 2: Remove public visibility for waiting rooms
DROP POLICY IF EXISTS "Rooms viewable by participants only" ON rooms;
CREATE POLICY "Rooms viewable by participants only" ON rooms
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM room_participants rp WHERE rp.room_id = rooms.id)
  );

-- Fix 3: Remove public SELECT from messages (will use edge function)
DROP POLICY IF EXISTS "Only room participants can view messages" ON messages;
-- No SELECT policy = client can't read messages directly
-- Messages will be fetched via the edge function with session token validation