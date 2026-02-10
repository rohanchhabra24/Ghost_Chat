-- Check what roles exist and grant properly
GRANT ALL ON public.messages TO anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
