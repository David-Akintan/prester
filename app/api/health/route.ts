import { NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * Health check endpoint for monitoring service availability
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'healthy',
      service: 'prester-frontend',
      version: process.env.npm_package_version ?? 'unknown',
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}
