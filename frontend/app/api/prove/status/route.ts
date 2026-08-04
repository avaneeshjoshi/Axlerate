import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';

  try {
    const response = await fetch(`${backendUrl}/api/prove/status`, { cache: 'no-store' });
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to get prove status from backend' },
        { status: response.status }
      );
    }
    return NextResponse.json(await response.json());
  } catch {
    return NextResponse.json(
      {
        error: 'Backend server is not running',
        details: `Could not connect to ${backendUrl}. Please ensure the FastAPI backend is running on port 8000.`,
      },
      { status: 503 }
    );
  }
}
