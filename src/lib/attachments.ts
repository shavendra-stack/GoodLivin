import { createServerSupabaseClient } from "@/lib/supabase/server";

type ServerSupabase = NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>;

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const SUPPORTED_ATTACHMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

const supportedExtensions = new Set(["pdf", "jpg", "jpeg", "png", "webp", "heic", "heif", "doc", "docx"]);

function extensionFor(value: string) {
  const match = /\.([a-zA-Z0-9]+)$/.exec(value);
  return match?.[1]?.toLowerCase() ?? "";
}

function isSupportedAttachment(file: File) {
  return SUPPORTED_ATTACHMENT_TYPES.includes(file.type as (typeof SUPPORTED_ATTACHMENT_TYPES)[number])
    || supportedExtensions.has(extensionFor(file.name));
}

export function attachmentErrorCode(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() ?? "";
  if (message.includes("storage") || message.includes("bucket") || message.includes("attachment") || message.includes("mime") || message.includes("file")) return "attachment";
  if (message.includes("exceeded") || message.includes("too large") || message.includes("payload")) return "attachment";
  if (error.code === "42501" || message.includes("permission") || message.includes("row-level")) return "not-authorized";
  return "server";
}

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "document";
}

export async function createAttachmentFromForm(supabase: ServerSupabase, formData: FormData, recordType: string, recordId: string) {
  const value = formData.get("attachmentFile");
  if (!(value instanceof File) || value.size === 0) return { id: null as string | null, error: null as string | null };

  if (value.size > MAX_ATTACHMENT_BYTES || !isSupportedAttachment(value)) {
    return { id: null, error: "attachment" };
  }

  const storageBucket = "goodlivin-attachments";
  const storagePath = `${recordType}/${recordId}/${crypto.randomUUID()}-${safeFileName(value.name)}`;
  const upload = await supabase.storage.from(storageBucket).upload(storagePath, value, {
    contentType: value.type || "application/octet-stream",
    upsert: false,
  });
  if (upload.error) return { id: null, error: attachmentErrorCode(upload.error) };

  const inserted = await supabase
    .from("attachments")
    .insert({
      storage_bucket: storageBucket,
      storage_path: storagePath,
      file_name: value.name || "Document",
      mime_type: value.type || "application/octet-stream",
      byte_size: value.size,
      record_type: recordType,
      record_id: recordId,
      uploaded_by: (await supabase.auth.getUser()).data.user?.id,
    })
    .select("id")
    .single();

  if (inserted.error) return { id: null, error: attachmentErrorCode(inserted.error) };
  return { id: String(inserted.data.id), error: null };
}
