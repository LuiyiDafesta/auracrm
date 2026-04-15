
-- Add avatar_url and lead_score to contacts
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS lead_score integer NOT NULL DEFAULT 0;

-- Custom fields definition table
CREATE TABLE public.custom_fields (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  field_type text NOT NULL DEFAULT 'text', -- text, number, date, select, checkbox, textarea, url, email, phone
  options jsonb DEFAULT '[]'::jsonb, -- for select type: list of options
  is_required boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true, -- default visibility in contact cards
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own custom_fields" ON public.custom_fields FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_custom_fields_updated_at BEFORE UPDATE ON public.custom_fields
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Custom field values per contact
CREATE TABLE public.contact_custom_values (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  custom_field_id uuid NOT NULL REFERENCES public.custom_fields(id) ON DELETE CASCADE,
  value text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(contact_id, custom_field_id)
);

ALTER TABLE public.contact_custom_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own contact_custom_values" ON public.contact_custom_values FOR ALL
  USING (EXISTS (SELECT 1 FROM contacts WHERE contacts.id = contact_custom_values.contact_id AND contacts.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM contacts WHERE contacts.id = contact_custom_values.contact_id AND contacts.user_id = auth.uid()));

CREATE TRIGGER update_contact_custom_values_updated_at BEFORE UPDATE ON public.contact_custom_values
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for contact avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

CREATE POLICY "Anyone can view avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Authenticated users can upload avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
CREATE POLICY "Users can update own avatars" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');
CREATE POLICY "Users can delete own avatars" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');
