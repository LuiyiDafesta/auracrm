
-- Create user-configurable stages table
CREATE TABLE public.opportunity_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.opportunity_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own opportunity_stages"
  ON public.opportunity_stages FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_opportunity_stages_updated_at
  BEFORE UPDATE ON public.opportunity_stages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Change opportunities.stage from enum to text
ALTER TABLE public.opportunities ALTER COLUMN stage DROP DEFAULT;
ALTER TABLE public.opportunities ALTER COLUMN stage TYPE TEXT USING stage::TEXT;
ALTER TABLE public.opportunities ALTER COLUMN stage SET DEFAULT 'prospecto';
