-- Add ab_winning_metric to campaign_sends
ALTER TABLE public.campaign_sends ADD COLUMN IF NOT EXISTS ab_winning_metric TEXT CHECK (ab_winning_metric IN ('opens', 'clicks')) DEFAULT 'opens';
