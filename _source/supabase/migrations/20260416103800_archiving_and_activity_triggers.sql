-- Migration: Add is_archived to opportunities
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

-- Trigger to log activity when contact is added/removed from a segment
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
    SELECT name, user_id INTO v_segment_name, v_user_id FROM public.segments WHERE id = OLD.segment_id;
    INSERT INTO public.activities (user_id, contact_id, type, description)
    VALUES (v_user_id, OLD.contact_id, 'segment_removed', 'Se removió el contacto del segmento: ' || COALESCE(v_segment_name, '??'));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_log_segment_activity ON public.segment_contacts;
CREATE TRIGGER trg_log_segment_activity
AFTER INSERT OR DELETE ON public.segment_contacts
FOR EACH ROW EXECUTE FUNCTION public.log_segment_activity();

-- Trigger to log activity when contact is added/removed from a tag
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
    SELECT name, user_id INTO v_tag_name, v_user_id FROM public.tags WHERE id = OLD.tag_id;
    INSERT INTO public.activities (user_id, contact_id, type, description)
    VALUES (v_user_id, OLD.contact_id, 'tag_removed', 'Se removió la etiqueta: ' || COALESCE(v_tag_name, '??'));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_log_tag_activity ON public.contact_tags;
CREATE TRIGGER trg_log_tag_activity
AFTER INSERT OR DELETE ON public.contact_tags
FOR EACH ROW EXECUTE FUNCTION public.log_tag_activity();

-- Trigger to log contact status changes
CREATE OR REPLACE FUNCTION public.log_contact_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.activities (user_id, contact_id, type, description)
    VALUES (NEW.user_id, NEW.id, 'status_changed', 'El estado del contacto cambió de ' || COALESCE(OLD.status, 'nulo') || ' a ' || COALESCE(NEW.status, 'nulo'));
  END IF;
  IF OLD.lead_score IS DISTINCT FROM NEW.lead_score THEN
    INSERT INTO public.activities (user_id, contact_id, type, description)
    VALUES (NEW.user_id, NEW.id, 'lead_score_changed', 'El lead score se actualizó a: ' || COALESCE(NEW.lead_score::TEXT, '0'));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_log_contact_status_change ON public.contacts;
CREATE TRIGGER trg_log_contact_status_change
AFTER UPDATE ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.log_contact_status_change();
