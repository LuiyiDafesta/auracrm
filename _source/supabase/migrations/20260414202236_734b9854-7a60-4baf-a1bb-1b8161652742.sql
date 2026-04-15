
CREATE TABLE public.smtp_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  host TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 587,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  from_email TEXT NOT NULL,
  from_name TEXT NOT NULL DEFAULT '',
  encryption TEXT NOT NULL DEFAULT 'tls',
  is_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.smtp_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own smtp_config"
  ON public.smtp_config FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_smtp_config_updated_at
  BEFORE UPDATE ON public.smtp_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
