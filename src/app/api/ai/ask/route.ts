import { NextRequest, NextResponse } from 'next/server';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const SYSTEM_PROMPT = `You are the Theseus knowledge engine answering questions from a personal knowledge graph.
You have been given a set of retrieved objects and claims. Ground every statement in this retrieval set.
Reference objects using {{obj:ID}} syntax where ID is the object's numeric ID.
Never invent information not present in the retrieval set.
If the retrieval set does not contain enough information to answer, say so honestly.
Keep answers to 2-4 paragraphs. Be specific and concrete.
When objects are tasks or events, mention their due dates, priorities, and status.
Never use em dashes.`;

interface RetrievalObject {
  id: number;
  title: string;
  object_type_slug: string;
  body_preview: string;
  priority?: string;
  due_date?: string;
  done?: boolean;
  author?: string;
  year?: string;
  confidence?: string;
}

interface RetrievalClaim {
  id: number;
  text: string;
  status: string;
  source_object_id: number;
}

export async function POST(request: NextRequest) {
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  const { question, retrieval } = await request.json();
  if (!question || !retrieval) {
    return NextResponse.json({ error: 'Missing question or retrieval' }, { status: 400 });
  }

  const objectContext = (retrieval.objects ?? [])
    .map((obj: RetrievalObject) => {
      const meta: string[] = [];
      if (obj.object_type_slug) meta.push(`type: ${obj.object_type_slug}`);
      if (obj.priority) meta.push(`priority: ${obj.priority}`);
      if (obj.due_date) meta.push(`due: ${obj.due_date}`);
      if (obj.done !== undefined) meta.push(`done: ${obj.done}`);
      if (obj.author) meta.push(`author: ${obj.author}`);
      if (obj.year) meta.push(`year: ${obj.year}`);
      if (obj.confidence) meta.push(`confidence: ${obj.confidence}`);
      return `[Object ${obj.id}] ${obj.title} (${meta.join(', ')})\n${obj.body_preview}`;
    })
    .join('\n\n');

  const claimContext = (retrieval.claims ?? [])
    .map((c: RetrievalClaim) =>
      `[Claim ${c.id}, from Object ${c.source_object_id}, status: ${c.status}] ${c.text}`,
    )
    .join('\n');

  const userMessage = `Question: ${question}

Retrieved Objects:
${objectContext || '(none)'}

Retrieved Claims:
${claimContext || '(none)'}

Answer the question using only the information above.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    return NextResponse.json({ error: 'Anthropic API error' }, { status: 502 });
  }

  const data = await response.json();
  const answerText: string = data.content?.[0]?.text || '';

  const refPattern = /\{\{obj:(\d+)\}\}/g;
  const referencedIds: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = refPattern.exec(answerText)) !== null) {
    const id = parseInt(match[1], 10);
    if (!referencedIds.includes(id)) {
      referencedIds.push(id);
    }
  }

  return NextResponse.json({
    answer: answerText,
    referenced_object_ids: referencedIds,
  });
}
