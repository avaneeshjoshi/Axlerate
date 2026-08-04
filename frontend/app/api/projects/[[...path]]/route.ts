import { NextRequest, NextResponse } from 'next/server'

const BACKEND = process.env.BACKEND_URL || 'http://localhost:8000'

async function forward(req: NextRequest, path: string[] | undefined) {
  const suffix = path?.length ? '/' + path.join('/') : ''
  const url = `${BACKEND}/api/projects${suffix}`

  const init: RequestInit = {
    method: req.method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (req.method !== 'GET' && req.method !== 'DELETE') {
    const text = await req.text()
    if (text) init.body = text
  }

  try {
    const res = await fetch(url, init)
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json(
      { error: 'Backend server is not running on port 8000' },
      { status: 503 },
    )
  }
}

type Ctx = { params: Promise<{ path?: string[] }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  return forward(req, (await ctx.params).path)
}
export async function POST(req: NextRequest, ctx: Ctx) {
  return forward(req, (await ctx.params).path)
}
export async function PATCH(req: NextRequest, ctx: Ctx) {
  return forward(req, (await ctx.params).path)
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  return forward(req, (await ctx.params).path)
}
