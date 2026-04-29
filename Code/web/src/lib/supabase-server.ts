import { createClient } from "@supabase/supabase-js";

export function createSupabaseServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function uploadBase64Image(
  bucket: string,
  path: string,
  base64DataUrl: string
): Promise<string> {
  const supabase = createSupabaseServerClient();

  // Strip the data URL prefix (e.g. "data:image/png;base64,")
  const matches = base64DataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) throw new Error("Invalid base64 data URL");
  const mimeType = matches[1];
  const base64 = matches[2];
  const buffer = Buffer.from(base64, "base64");

  const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
    contentType: mimeType,
    upsert: true,
  });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function resolveStorageUrl(
  bucket: string,
  publicUrl: string,
  expiresIn = 60 * 60
): Promise<string> {
  const path = getStoragePathFromPublicUrl(bucket, publicUrl);
  if (!path) {
    return publicUrl;
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) {
    return publicUrl;
  }

  return data.signedUrl;
}

export function getStoragePathFromPublicUrl(bucket: string, publicUrl: string): string | null {
  try {
    const url = new URL(publicUrl);
    const marker = `/storage/v1/object/public/${bucket}/`;
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) return null;
    const path = url.pathname.slice(markerIndex + marker.length);
    return path ? decodeURIComponent(path) : null;
  } catch {
    return null;
  }
}

export async function deleteStorageObjects(bucket: string, paths: string[]): Promise<void> {
  const uniquePaths = [...new Set(paths.filter(Boolean))];
  if (uniquePaths.length === 0) return;

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.storage.from(bucket).remove(uniquePaths);
  if (error) {
    throw new Error(`Storage delete failed: ${error.message}`);
  }
}
