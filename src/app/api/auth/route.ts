import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/storage/database/db';
import { users } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';

// Get current user from cookie
export async function GET(request: NextRequest) {
  try {
    const userId = request.cookies.get('user_id')?.value;

    if (!userId) {
      return NextResponse.json({ user: null });
    }

    const db = await getDb();
    const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (result.length === 0) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({ user: result[0] });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json({ user: null });
  }
}

// Login or register
export async function POST(request: NextRequest) {
  try {
    const { nickname } = await request.json();

    if (!nickname || nickname.trim().length === 0) {
      return NextResponse.json({ error: '请输入昵称' }, { status: 400 });
    }

    const trimmedNickname = nickname.trim();
    const db = await getDb();

    // Check if user exists with this nickname
    const existing = await db.select().from(users).where(eq(users.nickname, trimmedNickname)).limit(1);

    if (existing.length > 0) {
      const existingUser = existing[0];
      const response = NextResponse.json({ user: existingUser });
      response.cookies.set('user_id', existingUser.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
      });
      return response;
    }

    // Create new user
    const newUsers = await db.insert(users).values({ nickname: trimmedNickname }).returning();

    if (newUsers.length === 0) {
      return NextResponse.json({ error: '创建用户失败' }, { status: 500 });
    }

    const newUser = newUsers[0];
    const response = NextResponse.json({ user: newUser });
    response.cookies.set('user_id', newUser.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });
    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: '登录失败' }, { status: 500 });
  }
}

// Logout
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete('user_id');
  return response;
}
