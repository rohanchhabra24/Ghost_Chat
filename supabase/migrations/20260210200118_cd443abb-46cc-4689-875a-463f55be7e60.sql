-- Add SELECT policy so realtime subscriptions work for room participants
CREATE POLICY "Participants can read messages"
ON public.messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM room_participants rp
    WHERE rp.room_id = messages.room_id
    AND rp.session_token = messages.sender_id
  )
);
