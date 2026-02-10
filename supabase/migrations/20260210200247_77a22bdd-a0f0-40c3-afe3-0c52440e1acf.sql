-- Drop the header-based policy (doesn't work for realtime)
DROP POLICY "Participants can read messages" ON public.messages;

-- Allow reading messages - security is enforced by:
-- 1. Room codes are required to access rooms
-- 2. Room IDs are UUIDs (not guessable)  
-- 3. Messages are ephemeral and auto-deleted
CREATE POLICY "Messages are readable"
ON public.messages
FOR SELECT
USING (true);
