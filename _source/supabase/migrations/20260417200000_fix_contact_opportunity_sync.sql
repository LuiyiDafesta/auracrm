-- Fix the synchronization logic between Contact lead_score and Opportunity probability safely.

-- 1. Synchronize from Contacts to Opportunities
CREATE OR REPLACE FUNCTION public.sync_lead_score_to_probability()
RETURNS TRIGGER AS $$
BEGIN
    -- Only act if the lead_score ACTUALLY changed
    IF NEW.lead_score IS DISTINCT FROM OLD.lead_score THEN
        -- Prevent infinite trigger loops safely
        IF pg_trigger_depth() > 1 THEN
            RETURN NEW;
        END IF;

        -- Update all active opportunities to match the new lead_score
        UPDATE public.opportunities
        SET probability = NEW.lead_score
        WHERE contact_id = NEW.id AND is_archived = false AND probability IS DISTINCT FROM NEW.lead_score;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Synchronize from Opportunities to Contacts
CREATE OR REPLACE FUNCTION public.sync_probability_to_lead_score()
RETURNS TRIGGER AS $$
DECLARE
    max_prob INT;
    target_contact UUID;
BEGIN
    -- Prevent infinite trigger loops safely
    IF pg_trigger_depth() > 1 THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        ELSE
            RETURN NEW;
        END IF;
    END IF;

    -- Determine which contact to check based on the operation
    IF TG_OP = 'DELETE' THEN
        target_contact := OLD.contact_id;
    ELSE
        target_contact := NEW.contact_id;
    END IF;

    -- Calculate the maximum probability across all active opportunities
    SELECT COALESCE(MAX(probability), 0) INTO max_prob
    FROM public.opportunities
    WHERE contact_id = target_contact AND is_archived = false;

    -- Update the contact's lead score ONLY if it differs from the max probability
    UPDATE public.contacts
    SET lead_score = max_prob
    WHERE id = target_contact AND (lead_score IS DISTINCT FROM max_prob);

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate both triggers to ensure they are up to date and correct
DROP TRIGGER IF EXISTS trg_sync_lead_score_to_probability ON public.contacts;
CREATE TRIGGER trg_sync_lead_score_to_probability
AFTER UPDATE OF lead_score ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.sync_lead_score_to_probability();

DROP TRIGGER IF EXISTS trg_sync_probability_to_lead_score ON public.opportunities;
CREATE TRIGGER trg_sync_probability_to_lead_score
AFTER INSERT OR UPDATE OF probability, stage, is_archived OR DELETE ON public.opportunities
FOR EACH ROW EXECUTE FUNCTION public.sync_probability_to_lead_score();
