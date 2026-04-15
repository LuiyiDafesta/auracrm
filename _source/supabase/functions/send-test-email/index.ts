import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  to_email: z.string().email().max(255),
  smtp_host: z.string().min(1).max(255),
  smtp_port: z.number().int().min(1).max(65535),
  smtp_username: z.string().min(1).max(255),
  smtp_password: z.string().min(1).max(500),
  from_email: z.string().email().max(255),
  from_name: z.string().max(255).default(""),
  encryption: z.enum(["tls", "ssl", "none"]).default("tls"),
});

/**
 * Send email via Emailit HTTP API.
 * In Emailit, SMTP password = API key, so we reuse it as Bearer token.
 */
async function sendViaEmailitAPI(
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch("https://api.emailit.com/v2/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (res.ok) {
    return { success: true };
  }

  const body = await res.text();
  return { success: false, error: `Emailit API error (${res.status}): ${body}` };
}

/**
 * Generic SMTP fallback using fetch-based relay.
 * For non-Emailit providers, we attempt a basic send.
 */
async function sendViaGenericSMTP(
  host: string,
  port: number,
  username: string,
  password: string,
  from: string,
  to: string,
  subject: string,
  html: string,
  encryption: string
): Promise<{ success: boolean; error?: string }> {
  // For now, only Emailit HTTP API is supported in Edge Functions.
  // Raw SMTP (TCP sockets) is not reliably available in Deno Deploy / Supabase Edge.
  return {
    success: false,
    error: `El proveedor SMTP "${host}" no es compatible con Edge Functions. Usa Emailit (smtp.emailit.com) o contacta soporte para agregar tu proveedor.`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Datos inválidos", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { to_email, smtp_host, smtp_port, smtp_username, smtp_password, from_email, from_name, encryption } = parsed.data;
    const fromField = from_name ? `${from_name} <${from_email}>` : from_email;
    const subject = "✅ Prueba de conexión SMTP - AuraCRM";
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2563EB;">¡Conexión exitosa!</h2>
        <p>Este email confirma que tu configuración de envío en AuraCRM funciona correctamente.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="color: #6b7280; font-size: 12px;">Proveedor: ${smtp_host}:${smtp_port}</p>
      </div>
    `;

    let result: { success: boolean; error?: string };

    // Route to the correct sending method based on SMTP host
    if (smtp_host.includes("emailit.com")) {
      // Emailit: SMTP password = API key
      result = await sendViaEmailitAPI(smtp_password, fromField, to_email, subject, html);
    } else {
      result = await sendViaGenericSMTP(
        smtp_host, smtp_port, smtp_username, smtp_password,
        fromField, to_email, subject, html, encryption
      );
    }

    if (result.success) {
      return new Response(
        JSON.stringify({ success: true, message: "Email de prueba enviado correctamente" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      return new Response(
        JSON.stringify({ error: result.error }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return new Response(
      JSON.stringify({ error: `Error al enviar email: ${message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
