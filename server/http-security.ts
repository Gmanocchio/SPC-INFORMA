import type { Request } from "express";

export function isTrustedMutationOrigin(
  req: Pick<Request, "get" | "headers">,
) {
  const origin = req.get("origin");
  if (!origin) return !req.headers.cookie;
  try {
    const originUrl = new URL(origin);
    const expectedHost = (
      req.get("x-forwarded-host") ||
      req.get("host") ||
      ""
    )
      .split(",")[0]
      ?.trim();
    return (
      Boolean(expectedHost) &&
      originUrl.host === expectedHost &&
      ["http:", "https:"].includes(originUrl.protocol)
    );
  } catch {
    return false;
  }
}
