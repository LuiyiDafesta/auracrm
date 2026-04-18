-- Fix activity logging triggers to prevent foreign key violations when a contact is deleted
-- When a contact is deleted, ON DELETE CASCADE automatically deletes segment_contacts and contact_tags.
-- The BEFORE/AFTER DELETE triggers for these tables were trying to insert into "activities" referencing the 
-- contact that is already being deleted, causing an internal foreign key constraint error.

CREATE OR REPLACE FUNCTION public.log_segment_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_segment_name TEXT;
  v_user_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT name, user_id INTO v_segment_name, v_user_id FROM public.segments WHERE id = NEW.segment_id;
    INSERT INTO public.activities (user_id, contact_id, type, description)
    VALUES (v_user_id, NEW.contact_id, 'segment_added', 'Se añadió el contacto al segmento: ' || COALESCE(v_segment_name, '??'));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Prevent logging if the contact itself is being deleted (avoids foreign key violations)
    IF EXISTS (SELECT 1 FROM public.contacts WHERE id = OLD.contact_id) THEN
      SELECT name, user_id INTO v_segment_name, v_user_id FROM public.segments WHERE id = OLD.segment_id;
      INSERT INTO public.activities (user_id, contact_id, type, description)
      VALUES (v_user_id, OLD.contact_id, 'segment_removed', 'Se removió el contacto del segmento: ' || COALESCE(v_segment_name, '??'));
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.log_tag_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_tag_name TEXT;
  v_user_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT name, user_id INTO v_tag_name, v_user_id FROM public.tags WHERE id = NEW.tag_id;
    INSERT INTO public.activities (user_id, contact_id, type, description)
    VALUES (v_user_id, NEW.contact_id, 'tag_added', 'Se asignó la etiqueta: ' || COALESCE(v_tag_name, '??'));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Prevent logging if the contact itself is being deleted
    IF EXISTS (SELECT 1 FROM public.contacts WHERE id = OLD.contact_id) THEN
      SELECT name, user_id INTO v_tag_name, v_user_id FROM public.tags WHERE id = OLD.tag_id;
      INSERT INTO public.activities (user_id, contact_id, type, description)
      VALUES (v_user_id, OLD.contact_id, 'tag_removed', 'Se removió la etiqueta: ' || COALESCE(v_tag_name, '??'));
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
