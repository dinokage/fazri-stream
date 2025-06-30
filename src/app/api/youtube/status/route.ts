import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { OPTIONS } from '@/auth.config';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(OPTIONS);
    if (!session) {
      return NextResponse.json(
        { connected: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Check if user has active YouTube integration
    const youtubeIntegration = await prisma.youTubeIntegration.findFirst({
      where: {
        userId: session.user.id,
        isActive: true,
        expiresAt: {
          gt: new Date(), // Token not expired
        },
      },
      select: {
        id: true,
        channelTitle: true,
        channelId: true,
        createdAt: true,
      },
    });

    if (youtubeIntegration) {
      return NextResponse.json({
        connected: true,
        channel: {
          title: youtubeIntegration.channelTitle,
          id: youtubeIntegration.channelId,
          connectedAt: youtubeIntegration.createdAt,
        },
      });
    } else {
      return NextResponse.json({
        connected: false,
      });
    }
  } catch (error) {
    console.error('YouTube status check error:', error);
    return NextResponse.json(
      { connected: false, error: 'Failed to check status' },
      { status: 500 }
    );
  }
}

// Disconnect YouTube account
export async function DELETE() {
  try {
    const session = await getServerSession(OPTIONS);
    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    await prisma.youTubeIntegration.updateMany({
      where: {
        userId: session.user.id,
      },
      data: {
        isActive: false,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'YouTube account disconnected',
    });
  } catch (error) {
    console.error('YouTube disconnect error:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect YouTube account' },
      { status: 500 }
    );
  }
}