import { NextResponse, type NextRequest } from 'next/server'

// LAN-mode access control. The CLI sets CC_LENS_ACCESS_TOKEN whenever it binds
// to a non-loopback host; with no token configured (default loopback use) this
// is a no-op. /api/team/push keeps its own bearer-token check.
//
// Open once with http://host:port/?token=<token> — the token moves into an
// HttpOnly cookie and the URL is cleaned. API clients may send
// `Authorization: Bearer <token>`.

const COOKIE = 'cc_lens_token'

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export function proxy(req: NextRequest) {
  const token = process.env.CC_LENS_ACCESS_TOKEN
  if (!token) return NextResponse.next()

  const { pathname, searchParams } = req.nextUrl
  // Push has its own bearer check, but only when a team token is configured;
  // tokenless (insecure-local) pushes must still pass the access token.
  if (pathname === '/api/team/push' && process.env.CC_LENS_TEAM_TOKEN) return NextResponse.next()

  // CSRF defense for mutations: browsers send Origin on cross-site writes.
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origin = req.headers.get('origin')
    let originHost = ''
    try { originHost = origin ? new URL(origin).host : '' } catch { /* Origin: null */ }
    if (origin && originHost !== req.headers.get('host')) {
      return NextResponse.json({ error: 'cross-origin request rejected' }, { status: 403 })
    }
  }

  const bearer = req.headers.get('authorization')?.replace(/^Bearer /, '') ?? ''
  const cookie = req.cookies.get(COOKIE)?.value ?? ''
  if (safeEqual(bearer, token) || safeEqual(cookie, token)) return NextResponse.next()

  const qs = searchParams.get('token') ?? ''
  if (safeEqual(qs, token)) {
    const clean = new URLSearchParams(searchParams)
    clean.delete('token')
    const q = clean.toString()
    // Relative Location: nextUrl's origin can be 0.0.0.0 behind a standalone bind
    const res = new NextResponse(null, { status: 307, headers: { Location: pathname + (q ? `?${q}` : '') } })
    res.cookies.set(COOKIE, token, { httpOnly: true, sameSite: 'strict', path: '/' })
    return res
  }

  return pathname.startsWith('/api/')
    ? NextResponse.json({ error: 'unauthorized: open the URL printed by cc-lens (with ?token=)' }, { status: 401 })
    : new NextResponse('Unauthorized. Open the full URL printed by the cc-lens CLI (includes ?token=).', { status: 401 })
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }
