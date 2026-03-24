import { NextRequest, NextResponse } from 'next/server';

// Redirect to Feishu authorization page
export async function GET(request: NextRequest) {
  const appId = process.env.FEISHU_APP_ID;
  
  if (!appId) {
    return NextResponse.json({ error: '飞书登录未配置' }, { status: 500 });
  }

  // Get the base URL for redirect
  let baseUrl: string;
  const appUrl = process.env.APP_URL;

  if (appUrl) {
    baseUrl = appUrl.startsWith('http') ? appUrl : `https://${appUrl}`;
  } else {
    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    const host = request.headers.get('host') || 'localhost:5000';
    baseUrl = `${protocol}://${host}`;
  }
  
  // Construct redirect URI
  const redirectUri = `${baseUrl}/api/auth/feishu/callback`;
  const encodedRedirectUri = encodeURIComponent(redirectUri);
  
  // Debug log
  console.log('[Feishu Auth] Redirect URI:', redirectUri);
  
  // Generate a random state for CSRF protection
  const state = Math.random().toString(36).substring(2, 15);
  
  // Feishu authorization URL
  // Using OIDC flow for user info
  const authUrl = `https://open.feishu.cn/open-apis/authen/v1/authorize?app_id=${appId}&redirect_uri=${encodedRedirectUri}&state=${state}`;
  console.log('[Feishu Auth] Auth URL:', authUrl);

  const response = NextResponse.redirect(authUrl);
  
  // Store state in cookie for verification
  response.cookies.set('feishu_auth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 5, // 5 minutes
    path: '/',
  });

  return response;
}
