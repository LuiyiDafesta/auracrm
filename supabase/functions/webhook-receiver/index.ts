import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, content-type",
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Only POST allowed" }, 405);
  }

  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    return jsonResponse({ error: "Missing x-api-key header" }, 401);
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const keyHash = await hashKey(apiKey);
  const { data: keyRecord } = await supabaseAdmin
    .from("api_keys")
    .select("*")
    .eq("key_hash", keyHash)
    .eq("is_active", true)
    .single();

  if (!keyRecord) {
    return jsonResponse({ error: "Invalid API key" }, 401);
  }

  if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
    return jsonResponse({ error: "API key expired" }, 401);
  }

  const permissions: string[] = keyRecord.permissions || [];
  if (!permissions.includes("contacts:write") && !permissions.includes("contacts:all")) {
    return jsonResponse({ error: "Insufficient permissions: contacts:write required" }, 403);
  }

  // Update last_used_at
  await supabaseAdmin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyRecord.id);

  try {
    const body = await req.json();
    const event = body.event || "contact.create";

    switch (event) {
      case "contact.create": {
        if (!body.data?.first_name) {
          return jsonResponse({ error: "data.first_name is required" }, 400);
        }

        const contactData = {
          user_id: keyRecord.user_id,
          first_name: body.data.first_name,
          last_name: body.data.last_name || null,
          email: body.data.email || null,
          phone: body.data.phone || null,
          position: body.data.position || null,
          status: body.data.status || "activo",
          notes: body.data.notes || null,
          company_id: body.data.company_id || null,
          lead_score: body.data.lead_score || 0,
        };

        const { data, error } = await supabaseAdmin
          .from("contacts")
          .insert(contactData)
          .select()
          .single();

        if (error) return jsonResponse({ error: error.message }, 500);

        if (body.data.tag_ids && Array.isArray(body.data.tag_ids) && data) {
          const tagInserts = body.data.tag_ids.map((tagId: string) => ({
            contact_id: data.id,
            tag_id: tagId,
          }));
          await supabaseAdmin.from("contact_tags").insert(tagInserts);
        }

        return jsonResponse({ success: true, data }, 201);
      }

      case "contact.update": {
        if (!body.data?.id) {
          return jsonResponse({ error: "data.id is required" }, 400);
        }

        const allowedFields = [
          "first_name", "last_name", "email", "phone", "position",
          "status", "notes", "company_id", "lead_score",
        ];
        const updateData: Record<string, any> = {};
        for (const field of allowedFields) {
          if (body.data[field] !== undefined) updateData[field] = body.data[field];
        }

        const { data, error } = await supabaseAdmin
          .from("contacts")
          .update(updateData)
          .eq("id", body.data.id)
          .eq("user_id", keyRecord.user_id)
          .select()
          .single();

        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ success: true, data });
      }

      case "contact.delete": {
        if (!body.data?.id) {
          return jsonResponse({ error: "data.id is required" }, 400);
        }

        const { error } = await supabaseAdmin
          .from("contacts")
          .delete()
          .eq("id", body.data.id)
          .eq("user_id", keyRecord.user_id);

        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ success: true, message: "Contact deleted" });
      }

      default:
        return jsonResponse({
          error: `Unknown event: ${event}. Available: contact.create, contact.update, contact.delete`,
        }, 400);
    }
  } catch (err) {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }
});
