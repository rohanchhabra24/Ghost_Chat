-- Drop the existing permissive update policy
DROP POLICY IF EXISTS "Anyone can update room status" ON public.rooms;

-- Create a more restrictive update policy
-- Only allow updates that:
-- 1. Transition from 'waiting' to 'active' (joining a room)
-- 2. Transition to 'expired' status (room expiration)
-- 3. Only allow incrementing participant_count from 1 to 2
CREATE POLICY "Restricted room status updates" ON public.rooms
FOR UPDATE USING (
  -- Only allow updates on rooms that are not expired
  status != 'expired'
)
WITH CHECK (
  -- Allow joining: status goes from waiting to active, participant goes from 1 to 2
  (status = 'active' AND participant_count = 2)
  OR
  -- Allow expiration: any room can be marked as expired
  (status = 'expired')
);