import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const started = Number(searchParams.get('started') || Date.now() - 1000);
  const elapsed = Math.max(0, Date.now() - started);
  const progress = Math.min(100, Math.round((elapsed / 8000) * 100));
  const state = progress >= 100 ? 'succeeded' : 'running';
  return NextResponse.json({ state, progress, log: `progress ${progress}%` });
}