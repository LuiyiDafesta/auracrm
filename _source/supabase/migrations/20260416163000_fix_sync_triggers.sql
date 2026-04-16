-- Fix the sync trigger from opportunity to contact
-- Execute when probability, stage, or is_archived changes, or on insert/delete.
CREATE OR REPLACE FUNCTION public.sync_probability_to_lead_score()
RETURNS TRIGGER AS $$
DECLARE
    max_prob INT;
    target_contact UUID;
BEGIN
    -- Determinar el contacto afectado (puede ser DELETE o el resto)
    IF TG_OP = 'DELETE' THEN
        target_contact := OLD.contact_id;
    ELSE
        target_contact := NEW.contact_id;
    END IF;

    -- Calcular la máxima probabilidad de las oportunidades activas de este contacto
    SELECT COALESCE(MAX(probability), 0) INTO max_prob
    FROM public.opportunities
    WHERE contact_id = target_contact AND is_archived = false;

    -- Actualizar el contacto si el score actual es diferente a la maxima probabildad encontrada
    UPDATE public.contacts
    SET lead_score = max_prob
    WHERE id = target_contact AND (lead_score IS DISTINCT FROM max_prob);

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recrear el trigger para Oportunidades: Insert, Update y Delete
DROP TRIGGER IF EXISTS trg_sync_probability_to_lead_score ON public.opportunities;
CREATE TRIGGER trg_sync_probability_to_lead_score
AFTER INSERT OR UPDATE OF probability, stage, is_archived OR DELETE ON public.opportunities
FOR EACH ROW EXECUTE FUNCTION public.sync_probability_to_lead_score();
