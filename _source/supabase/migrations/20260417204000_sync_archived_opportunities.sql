-- Migration to ensure ALL opportunities (even archived ones) strictly sync with lead_score.

-- 1. Synchronize from Contacts to Opportunities (ALL opportunities)
CREATE OR REPLACE FUNCTION public.sync_lead_score_to_probability()
RETURNS TRIGGER AS $$
BEGIN
    -- Only act if the lead_score ACTUALLY changed
    IF NEW.lead_score IS DISTINCT FROM OLD.lead_score THEN
        -- Update ALL opportunities (including archived ones) to match the new lead_score
        -- The "probability IS DISTINCT FROM NEW.lead_score" clause prevents infinite recursion
        UPDATE public.opportunities
        SET probability = NEW.lead_score
        WHERE contact_id = NEW.id 
          AND probability IS DISTINCT FROM NEW.lead_score;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Synchronize from Opportunities to Contacts (Consider ALL opportunities)
CREATE OR REPLACE FUNCTION public.sync_probability_to_lead_score()
RETURNS TRIGGER AS $$
DECLARE
    max_prob INT;
    target_contact UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        target_contact := OLD.contact_id;
    ELSE
        target_contact := NEW.contact_id;
    END IF;

    -- Calculate the maximum probability across ALL opportunities for the contact
    SELECT COALESCE(MAX(probability), 0) INTO max_prob
    FROM public.opportunities
    WHERE contact_id = target_contact;

    -- Update the contact's lead score ONLY if it differs from the max probability
    -- The "(lead_score IS DISTINCT FROM max_prob)" clause prevents infinite recursion
    UPDATE public.contacts
    SET lead_score = max_prob
    WHERE id = target_contact 
      AND (lead_score IS DISTINCT FROM max_prob);

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
