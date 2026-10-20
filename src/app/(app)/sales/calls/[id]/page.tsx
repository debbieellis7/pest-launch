import { notFound } from "next/navigation";
import { CallView } from "@/components/call/CallView";
import { getCall } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function CallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const call = await getCall(id);
  if (!call) notFound();
  return <CallView call={call} />;
}
