import { NextResponse } from 'next/server';

export async function GET() {
  const BASE_ID = process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID;
  const TABLE_NAME = process.env.NEXT_PUBLIC_AIRTABLE_TABLE;
  const API_KEY = process.env.NEXT_PUBLIC_AIRTABLE_API_KEY;

  return NextResponse.json({
    BASE_ID: BASE_ID || 'undefined',
    TABLE_NAME: TABLE_NAME || 'undefined',
    API_KEY_LENGTH: API_KEY ? API_KEY.length : 0,
    HAS_API_KEY: !!API_KEY,
  });
}
