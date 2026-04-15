-- Database triggers that automatically fire the execute-automation edge function
-- when CRM events occur (tag_added, contact_created, status_changed, etc.)

CREATE OR REPLACE FUNCTION public.fire_automation_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _event_type text;
  _contact_id uuid;
  _user_id uuid;
  _event_data jsonb := '{}';
  _url text := 'https://lkbfmygkcmvkqkvhuduk.supabase.co/functions/v1/execute-automation';
BEGIN
  -- Determine event type based on which table triggered us
  IF TG_TABLE_NAME = 'contacts' AND TG_OP = 'INSERT' THEN
    _event_type := 'contact_created';
    _contact_id := NEW.id;
    _user_id := NEW.user_id;
  ELSIF TG_TABLE_NAME = 'contacts' AND TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      _event_type := 'status_changed';
      _event_data := jsonb_build_object('old_value', OLD.status, 'new_value', NEW.status);
    ELSIF OLD.lead_score IS DISTINCT FROM NEW.lead_score THEN
      _event_type := 'lead_score_reached';
      _event_data := jsonb_build_object('value', NEW.lead_score, 'old_value', OLD.lead_score);
    ELSE
      RETURN COALESCE(NEW, OLD); -- No relevant change, skip
    END IF;
    _contact_id := NEW.id;
    _user_id := NEW.user_id;
  ELSIF TG_TABLE_NAME = 'contact_tags' AND TG_OP = 'INSERT' THEN
    _event_type := 'tag_added';
    _contact_id := NEW.contact_id;
    _event_data := jsonb_build_object('tag_id', NEW.tag_id);
    SELECT user_id INTO _user_id FROM public.contacts WHERE id = NEW.contact_id;
  ELSIF TG_TABLE_NAME = 'contact_tags' AND TG_OP = 'DELETE' THEN
    _event_type := 'tag_removed';
    _contact_id := OLD.contact_id;
    _event_data := jsonb_build_object('tag_id', OLD.tag_id);
    SELECT user_id INTO _user_id FROM public.contacts WHERE id = OLD.contact_id;
  ELSIF TG_TABLE_NAME = 'segment_contacts' AND TG_OP = 'INSERT' THEN
    _event_type := 'segment_entered';
    _contact_id := NEW.contact_id;
    _event_data := jsonb_build_object('segment_id', NEW.segment_id);
    SELECT user_id INTO _user_id FROM public.contacts WHERE id = NEW.contact_id;
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF _user_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Fire the edge function via pg_net
  PERFORM net.http_post(
    url := _url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrYmZteWdrY212a3Frdmh1ZHVrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjIyMDE0MiwiZXhwIjoyMDkxNzk2MTQyfQ.mYDh63EIfG6lIOluXo_3ncl2DuTh9RH1uI9_3pC1cUE'
    ),
    body := jsonb_build_object(
      'event_type', _event_type,
      'contact_id', _contact_id,
      'user_id', _user_id,
      'event_data', _event_data
    )
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger on contacts INSERT (contact_created)
CREATE TRIGGER trg_automation_contact_created
  AFTER INSERT ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.fire_automation_event();

-- Trigger on contacts UPDATE (status_changed, lead_score_reached)
CREATE TRIGGER trg_automation_contact_updated
  AFTER UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.fire_automation_event();

-- Trigger on contact_tags INSERT (tag_added)
CREATE TRIGGER trg_automation_tag_added
  AFTER INSERT ON public.contact_tags
  FOR EACH ROW
  EXECUTE FUNCTION public.fire_automation_event();

-- Trigger on contact_tags DELETE (tag_removed)
CREATE TRIGGER trg_automation_tag_removed
  AFTER DELETE ON public.contact_tags
  FOR EACH ROW
  EXECUTE FUNCTION public.fire_automation_event();

-- Trigger on segment_contacts INSERT (segment_entered)
CREATE TRIGGER trg_automation_segment_entered
  AFTER INSERT ON public.segment_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.fire_automation_event();
