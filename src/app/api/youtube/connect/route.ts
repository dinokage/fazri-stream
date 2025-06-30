import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { OPTIONS } from '@/auth.config';
import { getYouTubeAuthUrl } from '@/lib/youtube-oauth';

export async function GET() {
  try {
    const session = await getServerSession(OPTIONS);
    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const authUrl = getYouTubeAuthUrl(session.user.id);
    
    return NextResponse.json({
      success: true,
      authUrl
    });
  } catch (error) {
    console.error('YouTube connect error:', error);
    return NextResponse.json(
      { error: 'Failed to generate YouTube auth URL' },
      { status: 500 }
    );
  }
}
