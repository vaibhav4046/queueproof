import { headers } from "next/headers";
import { runtimeEnv } from "./runtime";

export type RequestActor = {
  id: string;
  email: string;
  displayName: string;
  localDevelopment: boolean;
};

export async function getRequestActor(): Promise<RequestActor | null> {
  const requestHeaders = await headers();
  const email = requestHeaders.get("oai-authenticated-user-email");
  if (email) {
    const encodedName = requestHeaders.get("oai-authenticated-user-full-name");
    const encoding = requestHeaders.get("oai-authenticated-user-full-name-encoding");
    let displayName = email;
    if (encodedName && encoding === "percent-encoded-utf-8") {
      try {
        displayName = decodeURIComponent(encodedName);
      } catch {
        displayName = email;
      }
    }
    return { id: `user:${email.toLowerCase()}`, email, displayName, localDevelopment: false };
  }

  const allowLocal =
    runtimeEnv().QUEUEPROOF_ALLOW_LOCAL_IDENTITY === "true" ||
    requestHeaders.get("host")?.startsWith("localhost") ||
    requestHeaders.get("host")?.startsWith("127.0.0.1");
  if (!allowLocal) return null;
  return {
    id: "user:local-development",
    email: "local@queueproof.invalid",
    displayName: "Local workspace",
    localDevelopment: true,
  };
}

export async function requireRequestActor(): Promise<RequestActor> {
  const actor = await getRequestActor();
  if (!actor) throw new Response("Authentication required.", { status: 401 });
  return actor;
}

