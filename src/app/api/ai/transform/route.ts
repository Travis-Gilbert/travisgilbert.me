import { NextRequest, NextResponse } from 'next/server';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const VOICE_RULES = `You are editing investigative documentary content.
Voice: curious, precise, never preachy. Audience: intelligent adults who want mechanisms.
Pacing: ~150 words per minute of VO. Economy of words.
Never use: "let's unpack," "here's where it gets interesting," "buckle up," "down the rabbit hole."
Never use em dashes.
Show before you explain. Ground abstract claims in concrete evidence.
Transitions must feel inevitable: consequence, contradiction, test, escalation, reversal, narrowing.`;

const MODE_PROMPTS: Record<string, string> = {
  expand: `${VOICE_RULES}\n\nExpand the following text. Add depth, evidence references, and investigative reasoning. Maintain the original voice. Do not add filler. Every new sentence must introduce a clue, ask a question, run a test, or update the mental model.`,
  simplify: `${VOICE_RULES}\n\nSimplify the following text. Use shorter sentences. Remove hedging. Cut any sentence that restates what the previous sentence already said. Preserve all factual claims and evidence references.`,
  summarize: `${VOICE_RULES}\n\nSummarize the following text in 1-3 sentences. Capture the core mechanism and the key evidence. Do not lose specificity.`,
};

export async function POST(request: NextRequest) {
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  const { mode, text } = await request.json();
  const systemPrompt = MODE_PROMPTS[mode];
  if (!systemPrompt) {
    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  }

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
      system: systemPrompt,
      messages: [{ role: 'user', content: text }],
    }),
  });

  if (!response.ok) {
    return NextResponse.json({ error: 'Anthropic API error' }, { status: 502 });
  }

  const data = await response.json();
  const resultText = data.content?.[0]?.text || '';

  return NextResponse.json({ result: resultText });
}
