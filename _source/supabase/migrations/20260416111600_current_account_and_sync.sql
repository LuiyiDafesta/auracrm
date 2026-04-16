-- Migration: Contact Transactions and Lead Score <-> Probability Sync

-- 1. Create contact_transactions table
CREATE TABLE IF NOT EXISTS public.contact_transactions (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('ingreso', 'egreso')),
    amount NUMERIC NOT NULL CHECK (amount >= 0),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE public.contact_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own contact transactions"
    ON public.contact_transactions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own contact transactions"
    ON public.contact_transactions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contact transactions"
    ON public.contact_transactions FOR DELETE
    USING (auth.uid() = user_id);

-- 2. Sync Logic: lead_score -> opportunities.probability
CREATE OR REPLACE FUNCTION public.sync_lead_score_to_probability()
RETURNS TRIGGER AS $$
BEGIN
    -- Si el lead_score cambia, actualizar la probabilidad de todas sus oportunidades no terminadas (no archivadas o cerradas si aplicara)
    IF NEW.lead_score IS DISTINCT FROM OLD.lead_score THEN
        -- Asumiremos un update general en las oportunidades que no esten archivadas
        UPDATE public.opportunities
        SET probability = NEW.lead_score
        WHERE contact_id = NEW.id AND is_archived = false;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_lead_score_to_probability ON public.contacts;
CREATE TRIGGER trg_sync_lead_score_to_probability
AFTER UPDATE OF lead_score ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.sync_lead_score_to_probability();


-- 3. Sync Logic: opportunities.probability -> contacts.lead_score
-- Nota: limitamos para evitar updates innecesarios. Actualizamos el padre (contact)
CREATE OR REPLACE FUNCTION public.sync_probability_to_lead_score()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.probability IS DISTINCT FROM OLD.probability THEN
        -- Evitamos actualizar si ya es igual para cortar loop
        UPDATE public.contacts
        SET lead_score = NEW.probability
        WHERE id = NEW.contact_id AND lead_score IS DISTINCT FROM NEW.probability;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_probability_to_lead_score ON public.opportunities;
CREATE TRIGGER trg_sync_probability_to_lead_score
AFTER UPDATE OF probability ON public.opportunities
FOR EACH ROW EXECUTE FUNCTION public.sync_probability_to_lead_score();

-- 4. Set probability automatically on insert
CREATE OR REPLACE FUNCTION public.set_opportunity_default_probability()
RETURNS TRIGGER AS $$
DECLARE
    score INT;
BEGIN
    SELECT lead_score INTO score FROM public.contacts WHERE id = NEW.contact_id;
    IF score IS NOT NULL THEN
        NEW.probability := score;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_set_opportunity_default_probability ON public.opportunities;
CREATE TRIGGER trg_set_opportunity_default_probability
BEFORE INSERT ON public.opportunities
FOR EACH ROW
WHEN (NEW.probability IS NULL OR NEW.probability = 0)
EXECUTE FUNCTION public.set_opportunity_default_probability();
