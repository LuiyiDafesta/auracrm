
CREATE UNIQUE INDEX IF NOT EXISTS contacts_user_id_email_unique ON public.contacts (user_id, email);
CREATE UNIQUE INDEX IF NOT EXISTS contact_tags_contact_tag_unique ON public.contact_tags (contact_id, tag_id);
CREATE UNIQUE INDEX IF NOT EXISTS segment_contacts_contact_segment_unique ON public.segment_contacts (contact_id, segment_id);
CREATE UNIQUE INDEX IF NOT EXISTS contact_custom_values_contact_field_unique ON public.contact_custom_values (contact_id, custom_field_id);
