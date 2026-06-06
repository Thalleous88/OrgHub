import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const BUCKET = "orghub-documents";
const FUNCTION_SECRET = Deno.env.get("ORGHUB_STORAGE_KEY");

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (request.headers.get("x-orghub-storage-key") !== FUNCTION_SECRET) {
    return json({ error: "Unauthorized" }, 401);
  }

  const body = await request.json();
  const action = body.action;
  const path = body.path;

  if (
    typeof path !== "string" ||
    path.length === 0 ||
    path.startsWith("/") ||
    path.split("/").includes("..")
  ) {
    return json({ error: "Invalid object path" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const storage = supabase.storage.from(BUCKET);

  if (action === "create_upload") {
    const { data, error } = await storage.createSignedUploadUrl(path);
    if (error) return json({ error: error.message }, 400);
    return json({ signed_url: data.signedUrl });
  }

  if (action === "create_download") {
    const filename =
      typeof body.filename === "string" && body.filename.length > 0
        ? body.filename
        : true;
    const { data, error } = await storage.createSignedUrl(path, 60, {
      download: filename,
    });
    if (error) return json({ error: error.message }, 404);
    return json({ signed_url: data.signedUrl });
  }

  if (action === "delete") {
    const { error } = await storage.remove([path]);
    if (error) return json({ error: error.message }, 400);
    return json({ deleted: true });
  }

  if (action === "exists") {
    const { data, error } = await storage.exists(path);
    if (error && data !== false) return json({ error: error.message }, 400);
    return json({ exists: data });
  }

  if (action === "info") {
    const { data, error } = await storage.info(path);
    if (error) return json({ error: error.message }, 404);
    return json({ size: data.size });
  }

  return json({ error: "Unsupported action" }, 400);
});
