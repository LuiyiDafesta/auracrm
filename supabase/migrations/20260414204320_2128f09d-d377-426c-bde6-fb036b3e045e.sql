
CREATE TYPE public.automation_status AS ENUM ('draft', 'active', 'paused');
CREATE TYPE public.automation_run_status AS ENUM ('running', 'waiting', 'completed', 'failed', 'cancelled');

CREATE TABLE public.automations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status automation_status NOT NULL DEFAULT 'draft',
  trigger_type TEXT NOT NULL,
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  workflow JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[]}'::jsonb,
  run_count INTEGER NOT NULL DEFAULT 0,
  last_run_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own automations"
  ON public.automations FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_automations_updated_at
  BEFORE UPDATE ON public.automations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE public.automation_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  automation_id UUID NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  status automation_run_status NOT NULL DEFAULT 'running',
  current_step_id TEXT,
  wait_until TIMESTAMP WITH TIME ZONE,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own automation_runs"
  ON public.automation_runs FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_automation_runs_updated_at
  BEFORE UPDATE ON public.automation_runs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_automation_runs_status ON public.automation_runs(status);
CREATE INDEX idx_automation_runs_wait ON public.automation_runs(status, wait_until) WHERE status = 'waiting';

CREATE TABLE public.automation_run_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES public.automation_runs(id) ON DELETE CASCADE,
  step_id TEXT NOT NULL,
  step_type TEXT NOT NULL,
  action TEXT NOT NULL,
  result JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_run_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own automation_run_logs"
  ON public.automation_run_logs FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.automation_runs ar
    WHERE ar.id = automation_run_logs.run_id AND ar.user_id = auth.uid()
  ));

CREATE INDEX idx_automation_run_logs_run ON public.automation_run_logs(run_id);
