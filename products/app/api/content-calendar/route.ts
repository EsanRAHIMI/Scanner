import { NextResponse } from 'next/server';

function disabled() {
  return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
}

export async function GET() {
  return disabled();
}

export async function POST() {
  return disabled();
}
