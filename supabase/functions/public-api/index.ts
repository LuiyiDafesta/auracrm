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

  // Update last_used_at
  await supabaseAdmin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyRecord.id);

  return { userId: keyRecord.user_id, permissions: keyRecord.permissions || [] };
}

function hasPermission(permissions: string[], required: string): boolean {
  return permissions.includes(required) || permissions.includes("contacts:all");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);
  // Path: /public-api/v1/contacts or /public-api/v1/contacts/:id
  const pathParts = url.pathname.split("/").filter(Boolean);
  // Expected: ["public-api", "v1", "contacts", optional_id]
  const resource = pathParts[2]; // "contacts"
  const resourceId = pathParts[3]; // optional UUID

  if (resource !== "contacts") {
    return jsonResponse({ error: "Unknown resource. Available: /v1/contacts" }, 404);
  }

  const auth = await authenticateRequest(req, supabaseAdmin);
  if (auth instanceof Response) return auth;
  const { userId, permissions } = auth;

  try {
    switch (req.method) {
      case "GET": {
        if (!hasPermission(permissions, "contacts:read")) {
          return jsonResponse({ error: "Insufficient permissions: contacts:read required" }, 403);
        }

        if (resourceId) {
          const { data, error } = await supabaseAdmin
            .from("contacts")
            .select("*, contact_tags(tag_id, tags(id, name, color))")
            .eq("user_id", userId)
            .eq("id", resourceId)
            .single();

          if (error || !data) return jsonResponse({ error: "Contact not found" }, 404);
          return jsonResponse({ data });
        }

        // List with pagination
        const page = parseInt(url.searchParams.get("page") || "1");
        const perPage = Math.min(parseInt(url.searchParams.get("per_page") || "50"), 100);
        const search = url.searchParams.get("search");
        const status = url.searchParams.get("status");

        let query = supabaseAdmin
          .from("contacts")
          .select("*, contact_tags(tag_id, tags(id, name, color))", { count: "exact" })
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .range((page - 1) * perPage, page * perPage - 1);

        if (search) {
          query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
        }
        if (status) {
          query = query.eq("status", status);
        }

        const { data, error, count } = await query;
        if (error) return jsonResponse({ error: error.message }, 500);

        return jsonResponse({
          data,
          pagination: {
            page,
            per_page: perPage,
            total: count || 0,
            total_pages: Math.ceil((count || 0) / perPage),
          },
        });
      }

      case "POST": {
        if (!hasPermission(permissions, "contacts:write")) {
          return jsonResponse({ error: "Insufficient permissions: contacts:write required" }, 403);
        }

        const body = await req.json();
        if (!body.first_name) {
          return jsonResponse({ error: "first_name is required" }, 400);
        }

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

        const { data, error } = await supabaseAdmin
          .from("contacts")
          .insert(contactData)
          .select()
          .single();

        if (error) return jsonResponse({ error: error.message }, 500);

        // Handle tags if provided
        if (body.tag_ids && Array.isArray(body.tag_ids) && data) {
          const tagInserts = body.tag_ids.map((tagId: string) => ({
            contact_id: data.id,
            tag_id: tagId,
          }));
          await supabaseAdmin.from("contact_tags").insert(tagInserts);
        }

        return jsonResponse({ data }, 201);
      }

      case "PUT": {
        if (!hasPermission(permissions, "contacts:write")) {
          return jsonResponse({ error: "Insufficient permissions: contacts:write required" }, 403);
        }
        if (!resourceId) return jsonResponse({ error: "Contact ID required in URL" }, 400);

        const body = await req.json();
        const allowedFields = [
          "first_name", "last_name", "email", "phone", "position",
          "status", "notes", "company_id", "lead_score",
        ];
        const updateData: Record<string, any> = {};
        for (const field of allowedFields) {
          if (body[field] !== undefined) updateData[field] = body[field];
        }

        if (Object.keys(updateData).length === 0) {
          return jsonResponse({ error: "No valid fields to update" }, 400);
        }

        const { data, error } = await supabaseAdmin
          .from("contacts")
          .update(updateData)
          .eq("id", resourceId)
          .eq("user_id", userId)
          .select()
          .single();

        if (error) return jsonResponse({ error: error.message }, 500);
        if (!data) return jsonResponse({ error: "Contact not found" }, 404);

        return jsonResponse({ data });
      }

      case "DELETE": {
        if (!hasPermission(permissions, "contacts:delete")) {
          return jsonResponse({ error: "Insufficient permissions: contacts:delete required" }, 403);
        }
        if (!resourceId) return jsonResponse({ error: "Contact ID required in URL" }, 400);

        const { error } = await supabaseAdmin
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
  } catch (err) {
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
