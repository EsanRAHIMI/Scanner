import { NextResponse } from 'next/server';

function disabled() {
  return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
}

export async function PATCH() {
  return disabled();
}

export async function DELETE() {
  return disabled();
}
