// app/api/youtube/connect/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { OPTIONS } from '@/auth.config';

export async function GET() {
  try {
    const session = await getServerSession(OPTIONS);
    if (!session) {
      return NextResponse.redirect('/auth/signin');
    }

    // Generate OAuth URL for YouTube
    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/youtube/callback`;
    const scope = 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly';
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scope)}&` +
      `response_type=code&` +
      `access_type=offline&` +
      `prompt=consent&` +
      `state=${session.user.id}`;

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Error initiating YouTube OAuth:', error);
    return NextResponse.json(
      { error: 'Failed to initiate YouTube connection' },
      { status: 500 }
    );
  }
}