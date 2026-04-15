
CREATE TABLE public.segment_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  segment_id uuid NOT NULL REFERENCES public.segments(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(segment_id, contact_id)
);

ALTER TABLE public.segment_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own segment_contacts" ON public.segment_contacts FOR ALL
  USING (EXISTS (SELECT 1 FROM segments WHERE segments.id = segment_contacts.segment_id AND segments.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM segments WHERE segments.id = segment_contacts.segment_id AND segments.user_id = auth.uid()));
