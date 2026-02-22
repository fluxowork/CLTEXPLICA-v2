const SUPABASE_URL = 'https://hwhroyriokxluoyowcvx.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3aHJveXJpb2t4bHVveW93Y3Z4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MTYzNzMsImV4cCI6MjA4NzA5MjM3M30.SxCAkKWWHUyDgqPTmf49cc28HlSbvqOQDSE9x5o7Z70'
const { createClient } = supabase
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
window.sb = sb
