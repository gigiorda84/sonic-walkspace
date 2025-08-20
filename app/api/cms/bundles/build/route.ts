import { NextResponse } from 'next/server';

export async function POST() {
  const jobId = `job_${Date.now()}`;
  return NextResponse.json({ jobId });
}