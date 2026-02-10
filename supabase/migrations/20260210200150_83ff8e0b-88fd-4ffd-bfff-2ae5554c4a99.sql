-- Drop the incorrect SELECT policy and recreate with proper logic
DROP POLICY "Participants can read messages" ON public.messages;

-- Participants can read ALL messages in their room (not just their own)
CREATE POLICY "Participants can read messages"
ON public.messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM room_participants rp
    WHERE rp.room_id = messages.room_id
    AND rp.session_token = current_setting('request.headers', true)::json->>'x-session-token'
  )
);
