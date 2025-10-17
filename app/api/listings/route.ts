import { NextRequest, NextResponse } from "next/server";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const TARGET_ID =
  process.env.NEXT_PUBLIC_CHATKIT_WORKFLOW_ID || process.env.AGENT_ID || ""; // wf_* or agt_*
const OPENAI_BASE = process.env.OPENAI_BASE || "https://api.openai.com/v1";
const OPENAI_PROJECT = process.env.OPENAI_PROJECT || "";    // optional
const OPENAI_ORG = process.env.OPENAI_ORG || "";            // optional

function runsUrlFor(id: string) {
  if (!id) throw new Error("No TARGET_ID configured.");
  if (id.startsWith("wf_")) return `${OPENAI_BASE}/workflows/${id}/runs`;
  if (id.startsWith("agt_")) return `${OPENAI_BASE}/agents/${id}/runs`;
  // default: assume agent
  return `${OPENAI_BASE}/agents/${id}/runs`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // expecting { conversation_id, limit, criteria: {...} }
    const limit = body?.limit ?? 6;
    const criteria = body?.criteria ?? {};
    const queryText = `Find up to ${limit} listings based on: ${JSON.stringify(criteria)}`;

    const url = runsUrlFor(TARGET_ID);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
      // both betas are safe to include
      "OpenAI-Beta": "agents=v1,workflows=v1",
    };
    if (OPENAI_PROJECT) headers["OpenAI-Project"] = OPENAI_PROJECT;
    if (OPENAI_ORG) headers["OpenAI-Organization"] = OPENAI_ORG;

    const openaiResp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        input_as_text: queryText,
        input_variables: criteria,
      }),
    });

    const text = await openaiResp.text();
    if (!openaiResp.ok) {
      // bubble up exact OpenAI error text for debugging in Bubble
      return new NextResponse(text, { status: openaiResp.status });
    }

    const data = JSON.parse(text);
    return NextResponse.json({
      conversation_id: body?.conversation_id ?? "bubble-run",
      criteria,
      agent_output: data,
    });
  } catch (err: any) {
    return NextResponse.json(
      { detail: `Proxy error: ${err?.message || "unknown"}` },
      { status: 500 }
    );
  }
}
