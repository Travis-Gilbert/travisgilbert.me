import { NextRequest, NextResponse } from 'next/server';

const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY;
const CARTESIA_VOICE_ID = process.env.CARTESIA_VOICE_ID ?? 'a0e99841-438c-4a64-b679-ae501e7d6091';

export async function POST(request: NextRequest) {
  if (!CARTESIA_API_KEY) {
    return NextResponse.json({ error: 'Cartesia not configured' }, { status: 500 });
  }

  const { text, voice } = await request.json();
  if (!text) {
    return NextResponse.json({ error: 'Missing text' }, { status: 400 });
  }

  const response = await fetch('https://api.cartesia.ai/tts/bytes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': CARTESIA_API_KEY,
      'Cartesia-Version': '2024-06-10',
    },
    body: JSON.stringify({
      transcript: text,
      model_id: 'sonic-2',
      voice: { mode: 'id', id: voice ?? CARTESIA_VOICE_ID },
      output_format: { container: 'mp3', sample_rate: 44100, encoding: 'mp3' },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    return NextResponse.json({ error: 'Cartesia error: ' + err }, { status: 502 });
  }

  return new NextResponse(response.body, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-cache',
    },
  });
}
