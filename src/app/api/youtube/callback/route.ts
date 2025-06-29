import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';
import { YOUTUBE_OAUTH_CONFIG } from '@/lib/youtube-oauth';
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!; // 32-byte key
const ALGORITHM = 'aes-256-cbc';

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher(ALGORITHM, ENCRYPTION_KEY);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // userId
    const error = searchParams.get('error');

    if (error) {
      console.error('YouTube OAuth error:', error);
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard?youtube_error=${error}`
      );
    }

    if (!code || !state) {
      console.error('Missing code or state parameters');
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard?youtube_error=missing_params`
      );
    }

    // Exchange code for tokens
    const oauth2Client = new google.auth.OAuth2(
      YOUTUBE_OAUTH_CONFIG.clientId,
      YOUTUBE_OAUTH_CONFIG.clientSecret,
      YOUTUBE_OAUTH_CONFIG.redirectUri
    );

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get YouTube channel info
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    const channelResponse = await youtube.channels.list({
      part: ['snippet', 'statistics'],
      mine: true,
    });

    const channel = channelResponse.data.items?.[0];
    if (!channel) {
      console.error('No YouTube channel found for user');
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard?youtube_error=no_channel`
      );
    }

    // Store encrypted tokens in database
    const expiresAt = new Date(Date.now() + (tokens.expiry_date || 3600000));
    
    try {
      await prisma.youTubeIntegration.upsert({
        where: {
          channelId: channel.id!,
        },
        update: {
          channelTitle: channel.snippet?.title || '',
          accessToken: encrypt(tokens.access_token!),
          refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : '',
          expiresAt,
          isActive: true,
          updatedAt: new Date(),
        },
        create: {
          userId: state,
          channelId: channel.id!,
          channelTitle: channel.snippet?.title || '',
          accessToken: encrypt(tokens.access_token!),
          refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : '',
          expiresAt,
          isActive: true,
        },
      });

      console.log('YouTube integration saved successfully for user:', state);
      
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard?youtube_success=true&channel=${encodeURIComponent(channel.snippet?.title || 'Unknown')}`
      );
    } catch (dbError) {
      console.error('Database error saving YouTube integration:', dbError);
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard?youtube_error=database_error`
      );
    }
  } catch (error) {
    console.error('YouTube callback error:', error);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard?youtube_error=callback_failed`
    );
  }
}