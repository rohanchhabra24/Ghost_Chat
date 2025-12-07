-- Step 1: Drop the policy that depends on sender_id
DROP POLICY IF EXISTS "Only participants can send messages" ON public.messages;

-- Step 2: Alter the column to accommodate 64-character session tokens
ALTER TABLE public.messages 
ALTER COLUMN sender_id TYPE character varying(64);

-- Step 3: Recreate the policy
CREATE POLICY "Only participants can send messages" 
ON public.messages 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM room_participants rp 
    WHERE rp.room_id = messages.room_id 
    AND rp.session_token = messages.sender_id
  )
);