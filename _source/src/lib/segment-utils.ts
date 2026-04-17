import { supabase } from '@/integrations/supabase/client';

export interface SegmentRule {
  field: string;
  operator: string;
  value: string;
}

export const matchValue = (val: string, operator: string, target: string): boolean => {
  switch (operator) {
    case 'equals': return val === target;
    case 'not_equals': return val !== target;
    case 'contains': return val.toLowerCase().includes(target.toLowerCase());
    case 'not_contains': return !val.toLowerCase().includes(target.toLowerCase());
    case 'starts_with': return val.toLowerCase().startsWith(target.toLowerCase());
    case 'ends_with': return val.toLowerCase().endsWith(target.toLowerCase());
    case 'greater_than': return parseFloat(val) > parseFloat(target);
    case 'less_than': return parseFloat(val) < parseFloat(target);
    case 'greater_or_equal': return parseFloat(val) >= parseFloat(target);
    case 'less_or_equal': return parseFloat(val) <= parseFloat(target);
    case 'is_empty': return !val;
    case 'is_not_empty': return !!val;
    default: return true;
  }
};

const applyFilter = (query: any, rule: SegmentRule) => {
  const { field, operator, value } = rule;
  switch (operator) {
    case 'equals': return query.eq(field, value);
    case 'not_equals': return query.neq(field, value);
    case 'contains': return query.ilike(field, `%${value}%`);
    case 'not_contains': return query.not(field, 'ilike', `%${value}%`);
    case 'starts_with': return query.ilike(field, `${value}%`);
    case 'ends_with': return query.ilike(field, `%${value}`);
    case 'greater_than': return query.gt(field, value);
    case 'less_than': return query.lt(field, value);
    case 'greater_or_equal': return query.gte(field, value);
    case 'less_or_equal': return query.lte(field, value);
    case 'is_empty': return query.is(field, null);
    case 'is_not_empty': return query.not(field, 'is', null);
    default: return query;
  }
};

export const getContactsForRules = async (
  segRules: SegmentRule[],
  allSegments: any[] = [],
  visitedSegmentIds: Set<string> = new Set()
): Promise<any[]> => {
  // Step 1: apply standard field filters via Supabase query
  let query = supabase.from('contacts').select('id, first_name, last_name, email, lead_score, status');
  for (const rule of segRules || []) {
    if (rule.field === 'tag' || rule.field === 'segment' || rule.field.startsWith('cf_')) continue;
    query = applyFilter(query, rule);
  }
  const { data: dbContacts } = await query;
  let result: any[] = dbContacts || [];

  if (result.length === 0) return [];

  // Step 2: apply tag filters client-side
  const tagRules = (segRules || []).filter(r => r.field === 'tag');
  if (tagRules.length > 0) {
    const { data: allCT } = await supabase.from('contact_tags').select('contact_id, tag_id, tags(name)');
    const contactTagMap = new Map<string, string[]>();
    (allCT || []).forEach((ct: any) => {
      const name = ct.tags?.name;
      if (!name) return;
      const arr = contactTagMap.get(ct.contact_id) || [];
      arr.push(name);
      contactTagMap.set(ct.contact_id, arr);
    });

    for (const rule of tagRules) {
      result = result.filter(c => {
        const tags = contactTagMap.get(c.id) || [];
        switch (rule.operator) {
          case 'has_tag': return tags.includes(rule.value);
          case 'not_has_tag': return !tags.includes(rule.value);
          case 'has_any_tag': return tags.length > 0;
          case 'has_no_tags': return tags.length === 0;
          default: return true;
        }
      });
    }
  }

  if (result.length === 0) return [];

  // Step 3: apply custom field filters client-side
  const cfRules = (segRules || []).filter(r => r.field.startsWith('cf_'));
  if (cfRules.length > 0) {
    const contactIds = result.map(c => c.id);
    const { data: cfValues } = await supabase.from('contact_custom_values').select('contact_id, custom_field_id, value').in('contact_id', contactIds);
    const cfMap = new Map<string, Map<string, string>>();
    (cfValues || []).forEach((v: any) => {
      if (!cfMap.has(v.contact_id)) cfMap.set(v.contact_id, new Map());
      cfMap.get(v.contact_id)!.set(v.custom_field_id, v.value || '');
    });

    for (const rule of cfRules) {
      const fieldId = rule.field.replace('cf_', '');
      result = result.filter(c => {
        const val = cfMap.get(c.id)?.get(fieldId) || '';
        return matchValue(val, rule.operator, rule.value);
      });
    }
  }

  if (result.length === 0) return [];

  // Step 4: apply segment filters client-side
  const segmentRules = (segRules || []).filter(r => r.field === 'segment');
  if (segmentRules.length > 0) {
    for (const rule of segmentRules) {
      const targetSegId = rule.value;
      if (!targetSegId || visitedSegmentIds.has(targetSegId)) continue; // prevent infinite loops
      
      const targetSeg = allSegments.find(s => s.id === targetSegId);
      if (!targetSeg) continue;
      
      visitedSegmentIds.add(targetSegId);
      const targetContacts = await getContactsForRules(targetSeg.rules as SegmentRule[] || [], allSegments, visitedSegmentIds);
      visitedSegmentIds.delete(targetSegId);

      // also need manual contacts for target segment
      const { data: manualRows } = await supabase.from('segment_contacts').select('contact_id').eq('segment_id', targetSegId);
      const manualIds = (manualRows || []).map((r: any) => r.contact_id);
      const targetContactIds = new Set([...targetContacts.map(c => c.id), ...manualIds]);

      result = result.filter(c => {
        const inSegment = targetContactIds.has(c.id);
        if (rule.operator === 'in_segment') return inSegment;
        if (rule.operator === 'not_in_segment') return !inSegment;
        return true;
      });
    }
  }

  return result;
};
