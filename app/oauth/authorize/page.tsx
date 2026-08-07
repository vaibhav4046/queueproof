import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createQueueProofServerClient, supabaseWebEnabled } from "../../../lib/server/supabase";
import { ConsentClient } from "./ConsentClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Authorize AI client",
  description: "Review a request to connect an AI client to your QueueProof workspace.",
  robots: { index: false, follow: false },
};

type PageProps = { searchParams: Promise<{ authorization_id?: string | string[] }> };

export default async function OAuthAuthorizePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const authorizationId = Array.isArray(params.authorization_id)
    ? params.authorization_id[0]
    : params.authorization_id;
  if (!supabaseWebEnabled() || !authorizationId || authorizationId.length > 500) {
    redirect("/developer?oauth=unavailable");
  }
  const client = await createQueueProofServerClient();
  const claims = client ? await client.auth.getClaims() : null;
  if (!claims?.data?.claims?.sub) {
    const next = `/oauth/authorize?authorization_id=${encodeURIComponent(authorizationId)}`;
    redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  }
  return <ConsentClient authorizationId={authorizationId} />;
}
