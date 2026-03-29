import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _supabase: SupabaseClient | null = null;

function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _supabase;
}

export async function uploadFile(
  bucket: string,
  path: string,
  file: Buffer | Uint8Array,
  contentType: string,
) {
  const { error } = await getSupabase().storage
    .from(bucket)
    .upload(path, file, { contentType, upsert: true });

  if (error) throw new Error(`Upload failed: ${error.message}`);
  return path;
}

export async function getSignedUrl(bucket: string, path: string, expiresIn = 600) {
  const { data, error } = await getSupabase().storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) {
    throw new Error(`Signed URL failed: ${error?.message ?? "unknown"}`);
  }

  return data.signedUrl;
}

export async function getPublicUrl(bucket: string, path: string) {
  const { data } = getSupabase().storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteFile(bucket: string, paths: string[]) {
  const { error } = await getSupabase().storage.from(bucket).remove(paths);
  if (error) throw new Error(`Delete failed: ${error.message}`);
}
