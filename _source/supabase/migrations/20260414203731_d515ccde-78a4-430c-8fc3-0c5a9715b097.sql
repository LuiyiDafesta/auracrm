
CREATE TABLE public.email_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  queue_item_id UUID REFERENCES public.email_queue(id) ON DELETE SET NULL,
  campaign_send_id UUID NOT NULL REFERENCES public.campaign_sends(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('open', 'click')),
  link_url TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.email_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own email_tracking"
  ON public.email_tracking FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.campaign_sends cs
    WHERE cs.id = email_tracking.campaign_send_id AND cs.user_id = auth.uid()
  ));

CREATE INDEX idx_email_tracking_send ON public.email_tracking(campaign_send_id);
CREATE INDEX idx_email_tracking_queue ON public.email_tracking(queue_item_id);
CREATE INDEX idx_email_tracking_type ON public.email_tracking(campaign_send_id, event_type);

ALTER TABLE public.campaign_sends
  ADD COLUMN is_ab_test BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN ab_variant TEXT CHECK (ab_variant IN ('A', 'B')),
  ADD COLUMN ab_parent_id UUID REFERENCES public.campaign_sends(id) ON DELETE SET NULL,
  ADD COLUMN ab_test_percentage INTEGER DEFAULT 10,
  ADD COLUMN ab_wait_hours INTEGER DEFAULT 24,
  ADD COLUMN ab_winner_sent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN template_id_b UUID REFERENCES public.email_templates(id) ON DELETE SET NULL;

ALTER TABLE public.email_queue
  ADD COLUMN scheduled_date DATE,
  ADD COLUMN variant TEXT CHECK (variant IN ('A', 'B'));

CREATE INDEX idx_email_queue_scheduled ON public.email_queue(scheduled_date, status);
