
CREATE TYPE public.campaign_send_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
CREATE TYPE public.email_queue_status AS ENUM ('pending', 'sending', 'sent', 'failed');

CREATE TABLE public.campaign_sends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  segment_id UUID NOT NULL REFERENCES public.segments(id) ON DELETE RESTRICT,
  template_id UUID NOT NULL REFERENCES public.email_templates(id) ON DELETE RESTRICT,
  status campaign_send_status NOT NULL DEFAULT 'pending',
  emails_per_second INTEGER NOT NULL DEFAULT 1,
  total_emails INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  from_email TEXT,
  from_name TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own campaign_sends"
  ON public.campaign_sends FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_campaign_sends_updated_at
  BEFORE UPDATE ON public.campaign_sends
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE public.email_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_send_id UUID NOT NULL REFERENCES public.campaign_sends(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  to_email TEXT NOT NULL,
  to_name TEXT NOT NULL DEFAULT '',
  status email_queue_status NOT NULL DEFAULT 'pending',
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own email_queue"
  ON public.email_queue FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.campaign_sends cs
    WHERE cs.id = email_queue.campaign_send_id AND cs.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.campaign_sends cs
    WHERE cs.id = email_queue.campaign_send_id AND cs.user_id = auth.uid()
  ));

CREATE INDEX idx_email_queue_send_status ON public.email_queue(campaign_send_id, status);
CREATE INDEX idx_email_queue_pending ON public.email_queue(status) WHERE status = 'pending';

ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_sends;
