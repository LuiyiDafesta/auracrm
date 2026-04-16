import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { event_type, contact_id, user_id, event_data } = body;

    if (!event_type || !contact_id || !user_id) {
      // Also process waiting runs
      await processWaitingRuns();
      return new Response(JSON.stringify({ message: "Processed waiting runs" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find active automations matching this trigger
    const { data: automations } = await supabase
      .from("automations")
      .select("*")
      .eq("user_id", user_id)
      .eq("status", "active")
      .eq("trigger_type", event_type);

    if (!automations || automations.length === 0) {
      return new Response(JSON.stringify({ message: "No matching automations" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    for (const automation of automations) {
      // Check if trigger config matches
      if (!(await matchesTrigger(automation.trigger_config, event_data, user_id))) continue;

      // Check if this contact already has a running instance
      const { data: existingRun } = await supabase
        .from("automation_runs")
        .select("id")
        .eq("automation_id", automation.id)
        .eq("contact_id", contact_id)
        .in("status", ["running", "waiting"])
        .limit(1)
        .single();

      if (existingRun) continue; // Already running

      // Count how many runs are already queued (to stagger) - 1.5s apart
      const { count: queuedCount } = await supabase
        .from("automation_runs")
        .select("id", { count: "exact", head: true })
        .eq("automation_id", automation.id)
        .eq("status", "waiting")
        .gt("wait_until", new Date().toISOString());

      const delayMs = (queuedCount || 0) * 1500; // 1.5 seconds apart per queued run
      const waitUntil = new Date(Date.now() + delayMs).toISOString();

      // Queue the run (don't execute immediately — cron will pick it up)
      const { data: run, error: runErr } = await supabase
        .from("automation_runs")
        .insert({
          automation_id: automation.id,
          user_id,
          contact_id,
          status: "waiting",
          wait_until: waitUntil,
          current_step_id: "__trigger__",
          context: { event_data: event_data || {} },
        })
        .select()
        .single();

      if (runErr) {
        results.push({ automation_id: automation.id, error: runErr.message });
        continue;
      }

      // Increment run count
      await supabase
        .from("automations")
        .update({ run_count: (automation.run_count || 0) + 1, last_run_at: new Date().toISOString() })
        .eq("id", automation.id);

      results.push({ automation_id: automation.id, run_id: run.id, status: "queued", execute_at: waitUntil });
    }

    return new Response(JSON.stringify({ results }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function matchesTrigger(config: any, eventData: any, userId: string): Promise<boolean> {
  if (!config || Object.keys(config).length === 0) return true;

  // Resolve tag: config may have tag_id or tag_name
  if (config.tag_id || config.tag_name) {
    let tagId = config.tag_id;
    if (!tagId && config.tag_name) {
      const { data: tag } = await supabase.from("tags").select("id").eq("name", config.tag_name).eq("user_id", userId).single();
      tagId = tag?.id;
    }
    if (tagId && eventData?.tag_id && tagId !== eventData.tag_id) return false;
  }

  // Resolve segment: config may have segment_id or segment_name
  if (config.segment_id || config.segment_name) {
    let segId = config.segment_id;
    if (!segId && config.segment_name) {
      const { data: seg } = await supabase.from("segments").select("id").eq("name", config.segment_name).eq("user_id", userId).single();
      segId = seg?.id;
    }
    if (segId && eventData?.segment_id && segId !== eventData.segment_id) return false;
  }

  if (config.field_name && eventData?.field_name && config.field_name !== eventData.field_name) return false;
  if (config.value !== undefined && eventData?.value !== undefined) {
    if (String(config.value) !== String(eventData.value)) return false;
  }
  return true;
}

async function executeFromNode(automation: any, run: any, workflow: any, nodeId: string, contactId: string, userId: string) {
  const node = workflow.nodes.find((n: any) => n.id === nodeId);
  if (!node) {
    await supabase.from("automation_runs").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", run.id);
    return;
  }

  // Find next nodes via edges
  const outEdges = workflow.edges.filter((e: any) => e.source === nodeId);

  if (node.type === "trigger") {
    // Just go to next
    for (const edge of outEdges) {
      await executeFromNode(automation, run, workflow, edge.target, contactId, userId);
    }
    return;
  }

  if (node.type === "condition") {
    const result = await evaluateCondition(node.data, contactId, userId);
    await logStep(run.id, node.id, "condition", node.data.nodeType, { result });

    const nextEdge = outEdges.find((e: any) => e.sourceHandle === (result ? "yes" : "no"));
    if (nextEdge) {
      await executeFromNode(automation, run, workflow, nextEdge.target, contactId, userId);
    } else {
      await supabase.from("automation_runs").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", run.id);
    }
    return;
  }

  if (node.type === "action") {
    const actionType = node.data.nodeType;

    if (actionType === "wait") {
      const hours = node.data.config?.wait_unit === "hours"
        ? (node.data.config?.wait_value || 1)
        : (node.data.config?.wait_value || 1) * 24;
      const waitUntil = new Date(Date.now() + hours * 3600000).toISOString();

      await supabase.from("automation_runs").update({
        status: "waiting",
        current_step_id: nodeId,
        wait_until: waitUntil,
      }).eq("id", run.id);

      await logStep(run.id, node.id, "action", "wait", { wait_until: waitUntil });
      return; // Stop here, cron will resume
    }

    try {
      const result = await executeAction(node.data, contactId, userId);
      await logStep(run.id, node.id, "action", actionType, result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await logStep(run.id, node.id, "action", actionType, null, msg);
      await supabase.from("automation_runs").update({ status: "failed", completed_at: new Date().toISOString() }).eq("id", run.id);
      return;
    }

    // Continue to next nodes
    if (outEdges.length > 0) {
      for (const edge of outEdges) {
        await executeFromNode(automation, run, workflow, edge.target, contactId, userId);
      }
    } else {
      await supabase.from("automation_runs").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", run.id);
    }
  }
}

async function evaluateCondition(data: any, contactId: string, userId: string): Promise<boolean> {
  const { nodeType, config } = data;

  if (nodeType === "has_tag" || nodeType === "not_has_tag") {
    let tagId = config?.tag_id;
    if (!tagId && config?.tag_name) {
      const { data: tag } = await supabase.from("tags").select("id").eq("name", config.tag_name).eq("user_id", userId).single();
      tagId = tag?.id;
    }
    if (!tagId) return nodeType === "not_has_tag"; // Tag doesn't exist = "not has tag" is true
    const { data: ct } = await supabase
      .from("contact_tags").select("id").eq("contact_id", contactId).eq("tag_id", tagId).limit(1).single();
    return nodeType === "has_tag" ? !!ct : !ct;
  }

  if (nodeType === "lead_score_gt" || nodeType === "lead_score_lt") {
    const { data: contact } = await supabase.from("contacts").select("lead_score").eq("id", contactId).single();
    if (!contact) return false;
    return nodeType === "lead_score_gt" ? contact.lead_score > (config?.value || 0) : contact.lead_score < (config?.value || 0);
  }

  if (nodeType === "status_is") {
    const { data: contact } = await supabase.from("contacts").select("status").eq("id", contactId).single();
    return contact?.status === config?.value;
  }

  if (nodeType === "in_segment" || nodeType === "not_in_segment") {
    let segId = config?.segment_id;
    if (!segId && config?.segment_name) {
      const { data: seg } = await supabase.from("segments").select("id").eq("name", config.segment_name).eq("user_id", userId).single();
      segId = seg?.id;
    }
    if (!segId) return nodeType === "not_in_segment"; // Segment doesn't exist = "not in segment" is true
    const { data: sc } = await supabase
      .from("segment_contacts").select("id").eq("contact_id", contactId).eq("segment_id", segId).limit(1).single();
    return nodeType === "in_segment" ? !!sc : !sc;
  }

  if (nodeType === "field_equals") {
    const { data: contact } = await supabase.from("contacts").select("*").eq("id", contactId).single();
    if (!contact) return false;
    const fieldName = config?.field_name;
    const fieldValue = config?.value;
    if (fieldName && contact[fieldName] !== undefined) {
      return String(contact[fieldName]) === String(fieldValue);
    }
    // Check custom fields
    const { data: cfVal } = await supabase
      .from("contact_custom_values")
      .select("value, custom_fields(name)")
      .eq("contact_id", contactId);
    const match = (cfVal || []).find((cf: any) => (cf as any).custom_fields?.name === fieldName);
    return match ? String(match.value) === String(fieldValue) : false;
  }

  return true;
}

async function executeAction(data: any, contactId: string, userId: string): Promise<any> {
  const { nodeType, config } = data;

  if (nodeType === "send_email") {
    // Resolve template by id or name
    let tmplQuery;
    if (config?.template_id) {
      tmplQuery = supabase.from("email_templates").select("*").eq("id", config.template_id).single();
    } else if (config?.template_name) {
      tmplQuery = supabase.from("email_templates").select("*").eq("name", config.template_name).eq("user_id", userId).single();
    } else {
      throw new Error("No template_id or template_name specified");
    }

    const [smtpRes, tmplRes, contactRes] = await Promise.all([
      supabase.from("smtp_config").select("*").eq("user_id", userId).single(),
      tmplQuery,
      supabase.from("contacts").select("*").eq("id", contactId).single(),
    ]);

    if (!smtpRes.data) throw new Error("No SMTP config");
    if (!tmplRes.data) throw new Error(`Template not found: ${config?.template_id || config?.template_name}`);
    if (!contactRes.data?.email) throw new Error("Contact has no email");

    const smtp = smtpRes.data;
    const template = tmplRes.data;
    const contact = contactRes.data;

    let html = template.html_content || "<p>Sin contenido</p>";

    // Replace standard variables
    html = html.replace(/\{\{nombre\}\}/gi, contact.first_name || "");
    html = html.replace(/\{\{apellido\}\}/gi, contact.last_name || "");
    html = html.replace(/\{\{email\}\}/gi, contact.email || "");
    html = html.replace(/\{\{telefono\}\}/gi, contact.phone || "");
    html = html.replace(/\{\{empresa\}\}/gi, "");
    html = html.replace(/\{\{cargo\}\}/gi, contact.position || "");
    html = html.replace(/\{\{puntuacion\}\}/gi, String(contact.lead_score || 0));

    // Replace custom field variables
    const { data: cfVals } = await supabase
      .from("contact_custom_values")
      .select("value, custom_fields(name)")
      .eq("contact_id", contactId);
    for (const cf of cfVals || []) {
      if ((cf as any).custom_fields?.name) {
        const re = new RegExp(`\\{\\{${(cf as any).custom_fields.name}\\}\\}`, "gi");
        html = html.replace(re, cf.value || "");
      }
    }

    let subj = template.subject || "(Sin asunto)";
    subj = subj.replace(/\{\{nombre\}\}/gi, contact.first_name || "");
    subj = subj.replace(/\{\{apellido\}\}/gi, contact.last_name || "");
    subj = subj.replace(/\{\{email\}\}/gi, contact.email || "");

    // Use custom sender from action config, or fall back to SMTP defaults
    const senderEmail = config?.from_email || smtp.from_email;
    const senderName = config?.from_name || smtp.from_name;
    const from = senderName ? `${senderName} <${senderEmail}>` : senderEmail;

    // Send via Emailit HTTP API (SMTP password = API key for Emailit)
    if (smtp.host.includes("emailit.com")) {
      const res = await fetch("https://api.emailit.com/v2/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${smtp.password}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from, to: contact.email, subject: subj, html }),
      });
      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Emailit API error (${res.status}): ${errBody}`);
      }
    } else {
      throw new Error(`SMTP provider "${smtp.host}" not supported in Edge Functions. Use Emailit.`);
    }

    return { sent_to: contact.email, template: template.name };
  }

  if (nodeType === "add_tag" || nodeType === "remove_tag") {
    let tagId = config?.tag_id;
    if (!tagId && config?.tag_name) {
      const { data: tag } = await supabase.from("tags").select("id").eq("name", config.tag_name).eq("user_id", userId).single();
      tagId = tag?.id;
    }
    if (!tagId) throw new Error(`Tag not found: ${config?.tag_name || config?.tag_id}`);

    if (nodeType === "add_tag") {
      await supabase.from("contact_tags").upsert({ contact_id: contactId, tag_id: tagId }, { onConflict: "contact_id,tag_id", ignoreDuplicates: true });
    } else {
      await supabase.from("contact_tags").delete().eq("contact_id", contactId).eq("tag_id", tagId);
    }
    return { tag_id: tagId };
  }

  if (nodeType === "update_status") {
    await supabase.from("contacts").update({ status: config?.new_status }).eq("id", contactId);
    return { new_status: config?.new_status };
  }

  if (nodeType === "update_lead_score") {
    const { data: contact } = await supabase.from("contacts").select("lead_score").eq("id", contactId).single();
    let newScore = contact?.lead_score || 0;
    if (config?.operation === "add") newScore += (config?.value || 0);
    else if (config?.operation === "subtract") newScore -= (config?.value || 0);
    else if (config?.operation === "set") newScore = config?.value || 0;
    await supabase.from("contacts").update({ lead_score: Math.max(0, newScore) }).eq("id", contactId);
    return { new_score: Math.max(0, newScore) };
  }

  if (nodeType === "update_field") {
    const field = config?.field_name;
    if (field && ["notes", "phone", "position", "status"].includes(field)) {
      await supabase.from("contacts").update({ [field]: config?.value }).eq("id", contactId);
    }
    return { field, value: config?.value };
  }

  if (nodeType === "add_to_segment" || nodeType === "remove_from_segment") {
    let segmentId = config?.segment_id;
    if (!segmentId && config?.segment_name) {
      const { data: seg } = await supabase.from("segments").select("id").eq("name", config.segment_name).eq("user_id", userId).single();
      segmentId = seg?.id;
    }
    if (!segmentId) throw new Error(`Segment not found: ${config?.segment_name || config?.segment_id}`);

    if (nodeType === "add_to_segment") {
      await supabase.from("segment_contacts").upsert({ contact_id: contactId, segment_id: segmentId }, { onConflict: "contact_id,segment_id", ignoreDuplicates: true });
    } else {
      await supabase.from("segment_contacts").delete().eq("contact_id", contactId).eq("segment_id", segmentId);
    }
    return { segment_id: segmentId };
  }

  if (nodeType === "create_opportunity") {
    const oppData = {
      name: config?.opp_name || "Oportunidad Automática",
      value: config?.opp_value || 0,
      stage: config?.opp_stage || "Prospecto",
      probability: config?.opp_probability || 0,
      contact_id: contactId,
      user_id: userId,
    };
    const { data: opp, error } = await supabase.from("opportunities").insert(oppData).select().single();
    if (error) throw new Error(`Error creando oportunidad: ${error.message}`);
    return { created_opportunity_id: opp.id, stage: opp.stage };
  }

  return {};
}

async function logStep(runId: string, stepId: string, stepType: string, action: string, result?: any, errorMessage?: string) {
  await supabase.from("automation_run_logs").insert({
    run_id: runId, step_id: stepId, step_type: stepType,
    action, result: result || {}, error_message: errorMessage || null,
  });
}

async function processWaitingRuns() {
  const now = new Date().toISOString();
  const { data: waitingRuns } = await supabase
    .from("automation_runs")
    .select("*, automations(*)")
    .eq("status", "waiting")
    .lte("wait_until", now)
    .order("wait_until", { ascending: true })
    .limit(30);

  if (!waitingRuns || waitingRuns.length === 0) return;

  for (let i = 0; i < waitingRuns.length; i++) {
    const run = waitingRuns[i];
    const automation = (run as any).automations;
    if (!automation) continue;

    const workflow = automation.workflow || { nodes: [], edges: [] };
    const currentStepId = run.current_step_id;

    // Mark as running
    await supabase.from("automation_runs").update({ status: "running" }).eq("id", run.id);

    try {
      if (currentStepId === "__trigger__") {
        // This is a freshly queued run from a trigger — execute from the beginning
        const triggerNode = workflow.nodes.find((n: any) => n.type === "trigger");
        if (triggerNode) {
          await executeFromNode(automation, run, workflow, triggerNode.id, run.contact_id, run.user_id);
        } else {
          await supabase.from("automation_runs").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", run.id);
        }
      } else {
        // This is a run resuming after a "wait" step
        const outEdges = workflow.edges.filter((e: any) => e.source === currentStepId);
        if (outEdges.length > 0) {
          for (const edge of outEdges) {
            await executeFromNode(automation, run, workflow, edge.target, run.contact_id, run.user_id);
          }
        } else {
          await supabase.from("automation_runs").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", run.id);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabase.from("automation_runs").update({ status: "failed", completed_at: new Date().toISOString() }).eq("id", run.id);
      await logStep(run.id, currentStepId || "unknown", "system", "error", null, msg);
    }

    // Rate limit: wait 1.5s between executions to avoid spam/API limits
    if (i < waitingRuns.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
}
