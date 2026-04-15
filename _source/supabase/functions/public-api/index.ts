import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function authenticateRequest(
  req: Request,
  supabaseAdmin: any
): Promise<{ userId: string; permissions: string[] } | Response> {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    return jsonResponse({ error: "Missing x-api-key header" }, 401);
  }

  const keyHash = await hashKey(apiKey);
  const { data: keyRecord, error } = await supabaseAdmin
    .from("api_keys")
    .select("*")
    .eq("key_hash", keyHash)
    .eq("is_active", true)
    .single();

  if (error || !keyRecord) {
    return jsonResponse({ error: "Invalid API key" }, 401);
  }

  if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
    return jsonResponse({ error: "API key expired" }, 401);
  }

  await supabaseAdmin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyRecord.id);

  return { userId: keyRecord.user_id, permissions: keyRecord.permissions || [] };
}

function hasPerm(permissions: string[], required: string): boolean {
  const [resource, action] = required.split(":");
  return (
    permissions.includes(required) ||
    permissions.includes(`${resource}:all`) ||
    permissions.includes("*")
  );
}

// ── Helpers: custom fields, tags, segments ──────────────────────────

async function getUserCfDefs(db: any, userId: string) {
  const { data } = await db
    .from("custom_fields")
    .select("id, name, field_type")
    .eq("user_id", userId);
  return data || [];
}

async function enrichContacts(
  db: any,
  contacts: any[],
  cfDefs: any[]
): Promise<any[]> {
  if (!contacts.length) return contacts;

  const ids = contacts.map((c: any) => c.id);

  // Fetch custom-field values for all contacts in one query
  const { data: cfVals } = await db
    .from("contact_custom_values")
    .select("contact_id, custom_field_id, value")
    .in("contact_id", ids);

  const nameMap = new Map(cfDefs.map((f: any) => [f.id, f.name]));
  const grouped = new Map<string, Record<string, string>>();
  for (const v of cfVals || []) {
    if (!grouped.has(v.contact_id)) grouped.set(v.contact_id, {});
    const fname = nameMap.get(v.custom_field_id);
    if (fname) grouped.get(v.contact_id)![fname] = v.value;
  }

  return contacts.map((c: any) => {
    // Flatten tags
    const tags =
      c.contact_tags?.map((ct: any) => ct.tags).filter(Boolean) || [];
    // Flatten segments
    const segments =
      c.segment_contacts?.map((sc: any) => sc.segments).filter(Boolean) || [];

    const out = { ...c, tags, segments, custom_fields: grouped.get(c.id) || {} };
    delete out.contact_tags;
    delete out.segment_contacts;
    return out;
  });
}

/**
 * Save custom_fields for a contact.
 * Accepts EITHER:
 *   - Object  { "Industria": "Tech", "Ciudad": "BA" }   (new format, by name)
 *   - Array   [{ custom_field_id: "uuid", value: "..." }] (legacy format, by id)
 */
async function saveCustomFields(
  db: any,
  contactId: string,
  input: Record<string, any> | any[],
  cfDefs: any[]
) {
  // Normalise to entries [fieldId, value]
  let entries: [string, string][] = [];

  if (Array.isArray(input)) {
    // Legacy array format
    entries = input
      .filter((v: any) => v.custom_field_id && v.value !== undefined)
      .map((v: any) => [v.custom_field_id, String(v.value)]);
  } else if (typeof input === "object" && input !== null) {
    // New object format — resolve names to IDs
    const nameToId = new Map(
      cfDefs.map((f: any) => [f.name.toLowerCase().trim(), f.id])
    );
    for (const [name, value] of Object.entries(input)) {
      const fid = nameToId.get(name.toLowerCase().trim());
      if (fid && value !== undefined) entries.push([fid, String(value)]);
    }
  }

  for (const [fieldId, value] of entries) {
    const { data: existing } = await db
      .from("contact_custom_values")
      .select("id")
      .eq("contact_id", contactId)
      .eq("custom_field_id", fieldId)
      .single();

    if (existing) {
      await db
        .from("contact_custom_values")
        .update({ value })
        .eq("id", existing.id);
    } else {
      await db.from("contact_custom_values").insert({
        contact_id: contactId,
        custom_field_id: fieldId,
        value,
      });
    }
  }
}

// ── Contacts handlers ───────────────────────────────────────────────

async function handleContacts(
  req: Request,
  url: URL,
  resourceId: string | undefined,
  subResource: string | undefined,
  userId: string,
  permissions: string[],
  db: any
) {
  // Pre-fetch custom field definitions (used by most operations)
  const cfDefs = await getUserCfDefs(db, userId);

  switch (req.method) {
    case "GET": {
      if (!hasPerm(permissions, "contacts:read")) {
        return jsonResponse(
          { error: "Insufficient permissions: contacts:read required" },
          403
        );
      }

      // ── Sub-resources ──────────────────────────────────────
      if (resourceId && subResource === "custom-fields") {
        const { data, error } = await db
          .from("contact_custom_values")
          .select("value, custom_fields(id, name, field_type)")
          .eq("contact_id", resourceId);
        if (error) return jsonResponse({ error: error.message }, 500);
        // Return as object
        const obj: Record<string, string> = {};
        for (const v of data || []) {
          if (v.custom_fields?.name) obj[v.custom_fields.name] = v.value;
        }
        return jsonResponse({ data: obj });
      }

      if (resourceId && subResource === "tags") {
        const { data, error } = await db
          .from("contact_tags")
          .select("tag_id, tags(id, name, color)")
          .eq("contact_id", resourceId);
        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ data: data?.map((ct: any) => ct.tags) || [] });
      }

      if (resourceId && subResource === "segments") {
        const { data, error } = await db
          .from("segment_contacts")
          .select("segment_id, segments(id, name, description)")
          .eq("contact_id", resourceId);
        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({
          data: data?.map((sc: any) => sc.segments) || [],
        });
      }

      // ── Single contact ────────────────────────────────────
      if (resourceId) {
        const { data, error } = await db
          .from("contacts")
          .select(
            "*, contact_tags(tag_id, tags(id, name, color)), segment_contacts(segment_id, segments(id, name))"
          )
          .eq("user_id", userId)
          .eq("id", resourceId)
          .single();

        if (error || !data)
          return jsonResponse({ error: "Contact not found" }, 404);

        const [enriched] = await enrichContacts(db, [data], cfDefs);
        return jsonResponse({ data: enriched });
      }

      // ── List with pagination ──────────────────────────────
      const page = parseInt(url.searchParams.get("page") || "1");
      const perPage = Math.min(
        parseInt(url.searchParams.get("per_page") || "50"),
        100
      );
      const search = url.searchParams.get("search");
      const status = url.searchParams.get("status");
      const tagId = url.searchParams.get("tag_id");
      const segmentId = url.searchParams.get("segment_id");

      // Tag / segment pre-filter
      let contactIdFilter: string[] | null = null;

      if (tagId) {
        const { data: tagContacts } = await db
          .from("contact_tags")
          .select("contact_id")
          .eq("tag_id", tagId);
        contactIdFilter = (tagContacts || []).map(
          (tc: any) => tc.contact_id
        );
        if (contactIdFilter!.length === 0) {
          return jsonResponse({
            data: [],
            pagination: {
              page,
              per_page: perPage,
              total: 0,
              total_pages: 0,
            },
          });
        }
      }

      if (segmentId) {
        const { data: segContacts } = await db
          .from("segment_contacts")
          .select("contact_id")
          .eq("segment_id", segmentId);
        const segIds = (segContacts || []).map((sc: any) => sc.contact_id);
        if (contactIdFilter) {
          contactIdFilter = contactIdFilter.filter((id) =>
            segIds.includes(id)
          );
        } else {
          contactIdFilter = segIds;
        }
        if (contactIdFilter!.length === 0) {
          return jsonResponse({
            data: [],
            pagination: {
              page,
              per_page: perPage,
              total: 0,
              total_pages: 0,
            },
          });
        }
      }

      let query = db
        .from("contacts")
        .select(
          "*, contact_tags(tag_id, tags(id, name, color)), segment_contacts(segment_id, segments(id, name))",
          { count: "exact" }
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .range((page - 1) * perPage, page * perPage - 1);

      if (search) {
        query = query.or(
          `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`
        );
      }
      if (status) query = query.eq("status", status);
      if (contactIdFilter) query = query.in("id", contactIdFilter);

      const { data, error, count } = await query;
      if (error) return jsonResponse({ error: error.message }, 500);

      const enriched = await enrichContacts(db, data || [], cfDefs);

      return jsonResponse({
        data: enriched,
        pagination: {
          page,
          per_page: perPage,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / perPage),
        },
      });
    }

    case "POST": {
      if (!hasPerm(permissions, "contacts:write")) {
        return jsonResponse(
          { error: "Insufficient permissions: contacts:write required" },
          403
        );
      }

      // POST /v1/contacts/:id/tags
      if (resourceId && subResource === "tags") {
        const body = await req.json();
        if (!body.tag_id)
          return jsonResponse({ error: "tag_id is required" }, 400);
        const { error } = await db
          .from("contact_tags")
          .insert({ contact_id: resourceId, tag_id: body.tag_id });
        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ success: true }, 201);
      }

      // POST /v1/contacts/:id/segments
      if (resourceId && subResource === "segments") {
        const body = await req.json();
        if (!body.segment_id)
          return jsonResponse({ error: "segment_id is required" }, 400);
        const { error } = await db
          .from("segment_contacts")
          .insert({ contact_id: resourceId, segment_id: body.segment_id });
        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ success: true }, 201);
      }

      // POST /v1/contacts/:id/custom-fields
      if (resourceId && subResource === "custom-fields") {
        const body = await req.json();
        // Accept object { "FieldName": "val" } or legacy { custom_field_id, value }
        if (
          typeof body === "object" &&
          !body.custom_field_id &&
          !Array.isArray(body)
        ) {
          // Object format — save all keys
          await saveCustomFields(db, resourceId, body, cfDefs);
          return jsonResponse({ success: true }, 201);
        }
        // Legacy single-value format
        if (!body.custom_field_id || body.value === undefined) {
          return jsonResponse(
            { error: "custom_field_id and value are required" },
            400
          );
        }
        await saveCustomFields(
          db,
          resourceId,
          [{ custom_field_id: body.custom_field_id, value: body.value }],
          cfDefs
        );
        return jsonResponse({ success: true }, 201);
      }

      // ── POST /v1/contacts — create contact ────────────────
      const body = await req.json();
      if (!body.first_name)
        return jsonResponse({ error: "first_name is required" }, 400);

      const contactData = {
        user_id: userId,
        first_name: body.first_name,
        last_name: body.last_name || null,
        email: body.email || null,
        phone: body.phone || null,
        position: body.position || null,
        status: body.status || "activo",
        notes: body.notes || null,
        company_id: body.company_id || null,
        lead_score: body.lead_score || 0,
      };

      const { data, error } = await db
        .from("contacts")
        .insert(contactData)
        .select()
        .single();
      if (error) return jsonResponse({ error: error.message }, 500);

      // Tags (accept array of UUIDs)
      if (body.tag_ids && Array.isArray(body.tag_ids) && data) {
        await db
          .from("contact_tags")
          .insert(
            body.tag_ids.map((tid: string) => ({
              contact_id: data.id,
              tag_id: tid,
            }))
          );
      }

      // Segments (accept array of UUIDs)
      if (body.segment_ids && Array.isArray(body.segment_ids) && data) {
        await db
          .from("segment_contacts")
          .insert(
            body.segment_ids.map((sid: string) => ({
              contact_id: data.id,
              segment_id: sid,
            }))
          );
      }

      // Custom fields — object { "FieldName": "val" } or legacy array
      if (body.custom_fields && data) {
        await saveCustomFields(db, data.id, body.custom_fields, cfDefs);
      }

      // Return the full enriched contact
      const { data: created } = await db
        .from("contacts")
        .select(
          "*, contact_tags(tag_id, tags(id, name, color)), segment_contacts(segment_id, segments(id, name))"
        )
        .eq("id", data.id)
        .single();

      const [enrichedCreated] = await enrichContacts(
        db,
        [created || data],
        cfDefs
      );
      return jsonResponse({ data: enrichedCreated }, 201);
    }

    case "PUT": {
      if (!hasPerm(permissions, "contacts:write")) {
        return jsonResponse(
          { error: "Insufficient permissions: contacts:write required" },
          403
        );
      }
      if (!resourceId)
        return jsonResponse({ error: "Contact ID required in URL" }, 400);

      const body = await req.json();
      const allowedFields = [
        "first_name",
        "last_name",
        "email",
        "phone",
        "position",
        "status",
        "notes",
        "company_id",
        "lead_score",
      ];
      const updateData: Record<string, any> = {};
      for (const field of allowedFields) {
        if (body[field] !== undefined) updateData[field] = body[field];
      }

      if (
        Object.keys(updateData).length === 0 &&
        !body.tag_ids &&
        !body.segment_ids &&
        !body.custom_fields
      ) {
        return jsonResponse({ error: "No valid fields to update" }, 400);
      }

      if (Object.keys(updateData).length > 0) {
        const { data, error } = await db
          .from("contacts")
          .update(updateData)
          .eq("id", resourceId)
          .eq("user_id", userId)
          .select()
          .single();
        if (error) return jsonResponse({ error: error.message }, 500);
        if (!data) return jsonResponse({ error: "Contact not found" }, 404);
      }

      // Replace tags if provided
      if (body.tag_ids && Array.isArray(body.tag_ids)) {
        await db
          .from("contact_tags")
          .delete()
          .eq("contact_id", resourceId);
        if (body.tag_ids.length > 0) {
          await db
            .from("contact_tags")
            .insert(
              body.tag_ids.map((tid: string) => ({
                contact_id: resourceId,
                tag_id: tid,
              }))
            );
        }
      }

      // Replace segments if provided
      if (body.segment_ids && Array.isArray(body.segment_ids)) {
        await db
          .from("segment_contacts")
          .delete()
          .eq("contact_id", resourceId);
        if (body.segment_ids.length > 0) {
          await db
            .from("segment_contacts")
            .insert(
              body.segment_ids.map((sid: string) => ({
                contact_id: resourceId,
                segment_id: sid,
              }))
            );
        }
      }

      // Upsert custom fields — object or legacy array
      if (body.custom_fields) {
        await saveCustomFields(db, resourceId, body.custom_fields, cfDefs);
      }

      // Return the full enriched contact
      const { data: updated } = await db
        .from("contacts")
        .select(
          "*, contact_tags(tag_id, tags(id, name, color)), segment_contacts(segment_id, segments(id, name))"
        )
        .eq("id", resourceId)
        .single();

      if (!updated)
        return jsonResponse({ error: "Contact not found" }, 404);

      const [enrichedUpdated] = await enrichContacts(
        db,
        [updated],
        cfDefs
      );
      return jsonResponse({ data: enrichedUpdated });
    }

    case "DELETE": {
      if (!hasPerm(permissions, "contacts:delete")) {
        return jsonResponse(
          { error: "Insufficient permissions: contacts:delete required" },
          403
        );
      }
      if (!resourceId)
        return jsonResponse({ error: "Contact ID required in URL" }, 400);

      // Delete sub-resource
      if (subResource === "tags") {
        const tagId = url.searchParams.get("tag_id");
        if (!tagId)
          return jsonResponse({ error: "tag_id query param required" }, 400);
        await db
          .from("contact_tags")
          .delete()
          .eq("contact_id", resourceId)
          .eq("tag_id", tagId);
        return jsonResponse({ success: true });
      }
      if (subResource === "segments") {
        const segId = url.searchParams.get("segment_id");
        if (!segId)
          return jsonResponse(
            { error: "segment_id query param required" },
            400
          );
        await db
          .from("segment_contacts")
          .delete()
          .eq("contact_id", resourceId)
          .eq("segment_id", segId);
        return jsonResponse({ success: true });
      }

      const { error } = await db
        .from("contacts")
        .delete()
        .eq("id", resourceId)
        .eq("user_id", userId);
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ success: true, message: "Contact deleted" });
    }

    default:
      return jsonResponse({ error: "Method not allowed" }, 405);
  }
}

// ── Tags handlers ───────────────────────────────────────────────────

async function handleTags(
  req: Request,
  resourceId: string | undefined,
  userId: string,
  permissions: string[],
  db: any
) {
  if (!hasPerm(permissions, "tags:read") && req.method === "GET") {
    return jsonResponse({ error: "Insufficient permissions: tags:read required" }, 403);
  }
  if (req.method !== "GET" && !hasPerm(permissions, "tags:write")) {
    return jsonResponse({ error: "Insufficient permissions: tags:write required" }, 403);
  }

  switch (req.method) {
    case "GET": {
      if (resourceId) {
        const { data, error } = await db.from("tags").select("*").eq("user_id", userId).eq("id", resourceId).single();
        if (error || !data) return jsonResponse({ error: "Tag not found" }, 404);
        return jsonResponse({ data });
      }
      const { data, error } = await db.from("tags").select("*").eq("user_id", userId).order("name");
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ data });
    }
    case "POST": {
      const body = await req.json();
      if (!body.name) return jsonResponse({ error: "name is required" }, 400);
      const { data, error } = await db.from("tags").insert({ user_id: userId, name: body.name, color: body.color || "#3B82F6" }).select().single();
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ data }, 201);
    }
    case "PUT": {
      if (!resourceId) return jsonResponse({ error: "Tag ID required" }, 400);
      const body = await req.json();
      const upd: Record<string, any> = {};
      if (body.name !== undefined) upd.name = body.name;
      if (body.color !== undefined) upd.color = body.color;
      const { data, error } = await db.from("tags").update(upd).eq("id", resourceId).eq("user_id", userId).select().single();
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ data });
    }
    case "DELETE": {
      if (!resourceId) return jsonResponse({ error: "Tag ID required" }, 400);
      const { error } = await db.from("tags").delete().eq("id", resourceId).eq("user_id", userId);
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ success: true });
    }
    default:
      return jsonResponse({ error: "Method not allowed" }, 405);
  }
}

// ── Segments handlers ───────────────────────────────────────────────

async function handleSegments(
  req: Request,
  url: URL,
  resourceId: string | undefined,
  subResource: string | undefined,
  userId: string,
  permissions: string[],
  db: any
) {
  if (!hasPerm(permissions, "segments:read") && req.method === "GET") {
    return jsonResponse({ error: "Insufficient permissions: segments:read required" }, 403);
  }
  if (req.method !== "GET" && !hasPerm(permissions, "segments:write")) {
    return jsonResponse({ error: "Insufficient permissions: segments:write required" }, 403);
  }

  switch (req.method) {
    case "GET": {
      if (resourceId && subResource === "contacts") {
        const { data, error } = await db
          .from("segment_contacts")
          .select("contact_id, contacts(id, first_name, last_name, email, status)")
          .eq("segment_id", resourceId);
        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ data: data?.map((sc: any) => sc.contacts) || [] });
      }
      if (resourceId) {
        const { data, error } = await db.from("segments").select("*").eq("user_id", userId).eq("id", resourceId).single();
        if (error || !data) return jsonResponse({ error: "Segment not found" }, 404);
        return jsonResponse({ data });
      }
      const { data, error } = await db.from("segments").select("*").eq("user_id", userId).order("name");
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ data });
    }
    case "POST": {
      if (resourceId && subResource === "contacts") {
        const body = await req.json();
        if (!body.contact_id) return jsonResponse({ error: "contact_id required" }, 400);
        const { error } = await db.from("segment_contacts").insert({ segment_id: resourceId, contact_id: body.contact_id });
        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ success: true }, 201);
      }
      const body = await req.json();
      if (!body.name) return jsonResponse({ error: "name is required" }, 400);
      const { data, error } = await db.from("segments").insert({ user_id: userId, name: body.name, description: body.description || null, rules: body.rules || [] }).select().single();
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ data }, 201);
    }
    case "DELETE": {
      if (resourceId && subResource === "contacts") {
        const contactId = url.searchParams.get("contact_id");
        if (!contactId) return jsonResponse({ error: "contact_id query param required" }, 400);
        await db.from("segment_contacts").delete().eq("segment_id", resourceId).eq("contact_id", contactId);
        return jsonResponse({ success: true });
      }
      if (!resourceId) return jsonResponse({ error: "Segment ID required" }, 400);
      const { error } = await db.from("segments").delete().eq("id", resourceId).eq("user_id", userId);
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ success: true });
    }
    default:
      return jsonResponse({ error: "Method not allowed" }, 405);
  }
}

// ── Custom Fields handlers ──────────────────────────────────────────

async function handleCustomFields(
  req: Request,
  resourceId: string | undefined,
  userId: string,
  permissions: string[],
  db: any
) {
  if (!hasPerm(permissions, "custom_fields:read") && req.method === "GET") {
    return jsonResponse({ error: "Insufficient permissions: custom_fields:read required" }, 403);
  }
  if (req.method !== "GET" && !hasPerm(permissions, "custom_fields:write")) {
    return jsonResponse({ error: "Insufficient permissions: custom_fields:write required" }, 403);
  }

  switch (req.method) {
    case "GET": {
      if (resourceId) {
        const { data, error } = await db.from("custom_fields").select("*").eq("user_id", userId).eq("id", resourceId).single();
        if (error || !data) return jsonResponse({ error: "Custom field not found" }, 404);
        return jsonResponse({ data });
      }
      const { data, error } = await db.from("custom_fields").select("*").eq("user_id", userId).order("sort_order");
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ data });
    }
    case "POST": {
      const body = await req.json();
      if (!body.name) return jsonResponse({ error: "name is required" }, 400);
      const { data, error } = await db.from("custom_fields").insert({
        user_id: userId,
        name: body.name,
        field_type: body.field_type || "text",
        is_required: body.is_required || false,
        is_visible: body.is_visible !== false,
        options: body.options || [],
      }).select().single();
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ data }, 201);
    }
    case "PUT": {
      if (!resourceId) return jsonResponse({ error: "Custom field ID required" }, 400);
      const body = await req.json();
      const upd: Record<string, any> = {};
      for (const f of ["name", "field_type", "is_required", "is_visible", "options", "sort_order"]) {
        if (body[f] !== undefined) upd[f] = body[f];
      }
      const { data, error } = await db.from("custom_fields").update(upd).eq("id", resourceId).eq("user_id", userId).select().single();
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ data });
    }
    case "DELETE": {
      if (!resourceId) return jsonResponse({ error: "Custom field ID required" }, 400);
      const { error } = await db.from("custom_fields").delete().eq("id", resourceId).eq("user_id", userId);
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ success: true });
    }
    default:
      return jsonResponse({ error: "Method not allowed" }, 405);
  }
}

// ── Main router ─────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  // ["public-api", "v1", resource, id?, sub-resource?]
  const resource = pathParts[2];
  const resourceId = pathParts[3];
  const subResource = pathParts[4];

  const auth = await authenticateRequest(req, db);
  if (auth instanceof Response) return auth;
  const { userId, permissions } = auth;

  try {
    switch (resource) {
      case "contacts":
        return await handleContacts(req, url, resourceId, subResource, userId, permissions, db);
      case "tags":
        return await handleTags(req, resourceId, userId, permissions, db);
      case "segments":
        return await handleSegments(req, url, resourceId, subResource, userId, permissions, db);
      case "custom-fields":
        return await handleCustomFields(req, resourceId, userId, permissions, db);
      default:
        return jsonResponse({
          error: "Unknown resource",
          available: ["/v1/contacts", "/v1/tags", "/v1/segments", "/v1/custom-fields"],
        }, 404);
    }
  } catch (err) {
    console.error("API Error:", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
