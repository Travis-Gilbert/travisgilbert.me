import { NextResponse } from 'next/server';

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

export async function POST() {
  if (!DEEPGRAM_API_KEY) {
    return NextResponse.json({ error: 'Deepgram not configured' }, { status: 500 });
  }

  // Request a temporary API key from Deepgram
  const response = await fetch('https://api.deepgram.com/v1/manage/keys', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Token ${DEEPGRAM_API_KEY}`,
    },
    body: JSON.stringify({
      comment: 'Theseus STT temporary key',
      time_to_live_in_seconds: 300,
      scopes: ['usage:write'],
    }),
  });

  if (!response.ok) {
    return NextResponse.json({ error: 'Failed to create Deepgram key' }, { status: 502 });
  }

  const data = await response.json();
  return NextResponse.json({ key: data.key, expires_at: data.expires_at });
}
