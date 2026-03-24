import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/storage/database/db';
import { users } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';

interface FeishuTokenResponse {
  code: number;
  msg: string;
  data?: {
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token: string;
    refresh_expires_in: number;
  };
}

interface FeishuUserInfoResponse {
  code: number;
  msg: string;
  data?: {
    name: string;
    avatar_url: string;
    avatar_thumb: string;
    avatar_middle: string;
    avatar_big: string;
    open_id: string;
    union_id: string;
    email: string;
    mobile: string;
    user_id: string;
  };
}

interface FeishuAppTokenResponse {
  code: number;
  msg: string;
  tenant_access_token?: string;
  app_access_token?: string;
  expire?: number;
}

async function getAppAccessToken(): Promise<string | null> {
  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;

  if (!appId || !appSecret) {
    console.error('Feishu credentials not configured');
    return null;
  }

  try {
    const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    });

    const data: FeishuAppTokenResponse = await response.json();

    if (data.code !== 0 || !data.app_access_token) {
      console.error('Failed to get app access token:', data);
      return null;
    }

    return data.app_access_token;
  } catch (error) {
    console.error('Error getting app access token:', error);
    return null;
  }
}

async function getUserAccessToken(code: string, appAccessToken: string): Promise<string | null> {
  try {
    const response = await fetch('https://open.feishu.cn/open-apis/authen/v1/oidc/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${appAccessToken}`,
      },
      body: JSON.stringify({ grant_type: 'authorization_code', code }),
    });

    const data: FeishuTokenResponse = await response.json();

    if (data.code !== 0 || !data.data?.access_token) {
      console.error('Failed to get user access token:', data);
      return null;
    }

    return data.data.access_token;
  } catch (error) {
    console.error('Error getting user access token:', error);
    return null;
  }
}

async function getUserInfo(userAccessToken: string): Promise<FeishuUserInfoResponse['data'] | null> {
  try {
    const response = await fetch('https://open.feishu.cn/open-apis/authen/v1/user_info', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${userAccessToken}` },
    });

    const data: FeishuUserInfoResponse = await response.json();

    if (data.code !== 0 || !data.data) {
      console.error('Failed to get user info:', data);
      return null;
    }

    return data.data;
  } catch (error) {
    console.error('Error getting user info:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const storedState = request.cookies.get('feishu_auth_state')?.value;

  // Get base URL for redirects
  const appUrl = process.env.APP_URL;
  let baseUrl: string;

  if (appUrl) {
    baseUrl = appUrl.startsWith('http') ? appUrl : `https://${appUrl}`;
  } else {
    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    const host = request.headers.get('host') || 'localhost:5000';
    baseUrl = `${protocol}://${host}`;
  }

  // Verify state for CSRF protection
  if (!state || state !== storedState) {
    return NextResponse.redirect(new URL('/?error=invalid_state', baseUrl));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/?error=no_code', baseUrl));
  }

  // Step 1: Get app access token
  const appAccessToken = await getAppAccessToken();
  if (!appAccessToken) {
    return NextResponse.redirect(new URL('/?error=app_token_failed', baseUrl));
  }

  // Step 2: Get user access token
  const userAccessToken = await getUserAccessToken(code, appAccessToken);
  if (!userAccessToken) {
    return NextResponse.redirect(new URL('/?error=user_token_failed', baseUrl));
  }

  // Step 3: Get user info
  const userInfo = await getUserInfo(userAccessToken);
  if (!userInfo) {
    return NextResponse.redirect(new URL('/?error=user_info_failed', baseUrl));
  }

  // Step 4: Create or update user in database
  const db = getDb();

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.nickname, `feishu_${userInfo.open_id}`))
    .limit(1);

  let user;

  if (existing.length > 0) {
    // Update existing user
    const updated = await db
      .update(users)
      .set({
        avatarUrl: userInfo.avatar_url || userInfo.avatar_thumb,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, existing[0].id))
      .returning();

    user = updated[0] || existing[0];
  } else {
    // Create new user
    const created = await db
      .insert(users)
      .values({
        nickname: userInfo.name || `飞书用户_${userInfo.open_id.slice(0, 6)}`,
        avatarUrl: userInfo.avatar_url || userInfo.avatar_thumb,
      })
      .returning();

    if (created.length === 0) {
      return NextResponse.redirect(new URL('/?error=create_user_failed', baseUrl));
    }
    user = created[0];
  }

  console.log('[Feishu Callback] Redirecting to:', `${baseUrl}/?login=success`);

  const response = NextResponse.redirect(new URL('/?login=success', baseUrl));
  response.cookies.delete('feishu_auth_state');
  response.cookies.set('user_id', user.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });

  return response;
}
