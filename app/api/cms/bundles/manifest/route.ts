import { NextResponse } from 'next/server';

export async function GET() {
  const manifest = { version: Date.now(), files: [{ path: 'regions.geojson', bytes: 2048, sha256: 'mock' }], playback: { dwellSecDefault: 4, crossfadeMs: 600 } };
  const inline = 'data:application/json;base64,' + Buffer.from(JSON.stringify(manifest)).toString('base64');
  return NextResponse.json({ version: manifest.version, url: inline });
}