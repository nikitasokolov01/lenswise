export function safeLocationReturnPath(value: unknown): string {
  const path = typeof value === "string" ? value : "";
  if (!path.startsWith("/") || path.startsWith("//") || /[\r\n]/.test(path)) {
    return "/app";
  }
  return path;
}
