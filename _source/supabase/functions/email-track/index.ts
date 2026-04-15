import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// This function handles both open tracking (pixel) and click tracking (redirect)
// URLs:
//   /email-track?t=open&q=<queue_item_id>&s=<campaign_send_id>
//   /email-track?t=click&q=<queue_item_id>&s=<campaign_send_id>&url=<encoded_url>

const TRANSPARENT_PIXEL = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00,
  0x80, 0x00, 0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21,
  0xf9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00,
  0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
  0x01, 0x00, 0x3b,
]);

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const type = url.searchParams.get("t"); // "open" or "click"
  const queueItemId = url.searchParams.get("q");
  const campaignSendId = url.searchParams.get("s");
  const linkUrl = url.searchParams.get("url");

  if (!type || !campaignSendId) {
    return new Response("Bad request", { status: 400 });
  }

  // Record tracking event (fire and forget - don't block response)
  const trackingData: any = {
    campaign_send_id: campaignSendId,
    event_type: type === "click" ? "click" : "open",
    ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "",
    user_agent: req.headers.get("user-agent") || "",
  };

  if (queueItemId) trackingData.queue_item_id = queueItemId;
  if (linkUrl) trackingData.link_url = linkUrl;

  // Insert tracking record (don't await - respond fast)
  supabase.from("email_tracking").insert(trackingData).then(() => {});

  if (type === "click" && linkUrl) {
    // Redirect to the actual URL
    return new Response(null, {
      status: 302,
      headers: { Location: linkUrl },
    });
  }

  // Return transparent pixel for opens
  return new Response(TRANSPARENT_PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Pragma": "no-cache",
    },
  });
});
