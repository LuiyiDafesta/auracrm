
-- Tags table
CREATE TABLE public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own tags" ON public.tags FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE UNIQUE INDEX idx_tags_user_name ON public.tags(user_id, name);

-- Contact-Tags junction
CREATE TABLE public.contact_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(contact_id, tag_id)
);
ALTER TABLE public.contact_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own contact_tags" ON public.contact_tags FOR ALL
  USING (EXISTS (SELECT 1 FROM public.contacts WHERE contacts.id = contact_tags.contact_id AND contacts.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.contacts WHERE contacts.id = contact_tags.contact_id AND contacts.user_id = auth.uid()));

-- Segments table
CREATE TABLE public.segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own segments" ON public.segments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_segments_updated_at BEFORE UPDATE ON public.segments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
