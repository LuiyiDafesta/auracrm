SELECT event_object_table AS table_name, trigger_name, event_manipulation AS event, action_statement AS definition, action_timing AS timing
FROM information_schema.triggers
WHERE event_object_table IN ('contacts', 'opportunities')
ORDER BY table_name, event_manipulation;
