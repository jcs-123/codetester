/** Only allow same-origin relative paths as post-login destinations. */
export function safeNext(value: string | string[] | null | undefined): string {
  const v = Array.isArray(value) ? value[0] : value;
  if (!v) return "";
  if (!v.startsWith("/") || v.startsWith("//") || v.startsWith("/api") || v.startsWith("/login")) return "";
  return v;
}
