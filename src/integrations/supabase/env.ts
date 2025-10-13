const url = import.meta.env.VITE_SUPABASE_URL ?? 'https://majfmrisrwhdsmrvyfzm.supabase.co';
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hamZtcmlzcndoZHNtcnZ5Znp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwNzc1MDAsImV4cCI6MjA3MjY1MzUwMH0.UqgJRN0-C5Quek9jxbyBL4vsgZvuQXjonTYRK91w9sU';

export const SUPABASE_URL = url;
export const SUPABASE_ANON_KEY = anon;
export const SUPABASE_FUNCTION_URL = `${url}/functions/v1`;
