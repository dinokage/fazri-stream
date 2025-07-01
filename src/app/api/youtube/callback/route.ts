// app/api/youtube/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { OPTIONS } from '@/auth.config';
import { prisma } from '@/lib/prisma';
import { YouTubeClient } from '@/lib/youtube-oauth';
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;
const ALGORITHM = 'aes-256-cbc';

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      console.error('YouTube OAuth error:', error);
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/youtube/integration?error=oauth_error`);
    }

    if (!code || !state) {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/youtube/integration?error=missing_params`);
    }

    const session = await getServerSession(OPTIONS);
    if (!session || session.user.id !== state) {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/youtube/integration?error=unauthorized`);
    }

    try {
      // Exchange code for tokens using Google APIs
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          code,
          grant_type: 'authorization_code',
          redirect_uri: `${process.env.NEXTAUTH_URL}/api/youtube/callback`,
        }),
      });

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok) {
        console.error('Token exchange failed:', tokenData);
        return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/youtube/integration?error=token_exchange_failed`);
      }

      const { access_token, refresh_token, expires_in } = tokenData;

      // Get channel information
      const youtubeClient = new YouTubeClient(access_token);
      const channelInfo = await youtubeClient.getChannelInfo();

      if (!channelInfo || !channelInfo.id) {
        return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/youtube/integration?error=no_channel_found`);
      }

      // Deactivate any existing integrations for this user
      await prisma.youTubeIntegration.updateMany({
        where: {
          userId: session.user.id,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });

      // Create new integration
      const expiresAt = new Date(Date.now() + (expires_in * 1000));
      const encryptedAccessToken = encrypt(access_token);
      const encryptedRefreshToken = refresh_token ? encrypt(refresh_token) : '';

      await prisma.youTubeIntegration.create({
        data: {
          userId: session.user.id,
          channelId: channelInfo.id,
          channelTitle: channelInfo.snippet?.title || 'Unknown Channel',
          channelThumbnail: channelInfo.snippet?.thumbnails?.default?.url || null,
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          expiresAt,
          isActive: true,
        },
      });

      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/youtube/integration?success=connected`);
    } catch (error) {
      console.error('Error processing YouTube OAuth callback:', error);
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/youtube/integration?error=processing_failed`);
    }
  } catch (error) {
    console.error('Error in YouTube OAuth callback:', error);
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/youtube/integration?error=server_error`);
  }
}