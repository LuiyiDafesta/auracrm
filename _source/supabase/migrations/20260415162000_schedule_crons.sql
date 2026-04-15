-- Create cron jobs to execute Supabase automations and queue.

-- Ensure pg_cron and pg_net are created. 
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function to setup triggers (we'll just use inline selects)

-- 1. Automations CRON
SELECT cron.schedule(
    'execute-automation-cron',  
    '* * * * *',
    $$
    SELECT net.http_post(
        url := 'https://lkbfmygkcmvkqkvhuduk.supabase.co/functions/v1/execute-automation',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrYmZteWdrY212a3Frdmh1ZHVrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjIyMDE0MiwiZXhwIjoyMDkxNzk2MTQyfQ.mYDh63EIfG6lIOluXo_3ncl2DuTh9RH1uI9_3pC1cUE"}'::jsonb,
        body := '{}'::jsonb
    );
    $$
);

-- 2. Email Queue CRON
SELECT cron.schedule(
    'process-email-queue-cron',
    '* * * * *',
    $$
    SELECT net.http_post(
        url := 'https://lkbfmygkcmvkqkvhuduk.supabase.co/functions/v1/process-email-queue',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrYmZteWdrY212a3Frdmh1ZHVrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjIyMDE0MiwiZXhwIjoyMDkxNzk2MTQyfQ.mYDh63EIfG6lIOluXo_3ncl2DuTh9RH1uI9_3pC1cUE"}'::jsonb,
        body := '{}'::jsonb
    );
    $$
);
