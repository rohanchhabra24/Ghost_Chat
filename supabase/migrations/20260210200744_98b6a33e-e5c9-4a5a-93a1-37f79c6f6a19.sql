-- Grant necessary permissions to anon and authenticated roles for messages table
GRANT SELECT, INSERT ON public.messages TO anon;
GRANT SELECT, INSERT ON public.messages TO authenticated;
