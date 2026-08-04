import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';

  let targetId: string | null = null;
  try {
    const body = await request.json();
    targetId = typeof body?.target_id === 'string' ? body.target_id : null;
  } catch {
    // empty body = prove all unproved targets
  }

  try {
    const response = await fetch(`${backendUrl}/api/prove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_id: targetId }),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
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
