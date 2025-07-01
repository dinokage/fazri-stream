// app/youtube/integration/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Youtube, CheckCircle, XCircle, ExternalLink, RefreshCw } from 'lucide-react';

interface YouTubeIntegration {
  id: string;
  channelId: string;
  channelTitle: string;
  channelThumbnail?: string;
  isActive: boolean;
  expiresAt: string;
  createdAt: string;
}

interface YouTubeStats {
  subscriberCount?: string;
  videoCount?: string;
  viewCount?: string;
}

export default function YouTubeIntegrationPage() {
  const { status } = useSession();
  const searchParams = useSearchParams();
  const [integration, setIntegration] = useState<YouTubeIntegration | null>(null);
  const [stats, setStats] = useState<YouTubeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchIntegration();
    }
  }, [status]);

  useEffect(() => {
    // Handle URL params for success/error messages
    const success = searchParams.get('success');
    const urlError = searchParams.get('error');

    if (success === 'connected') {
      setError(null);
      fetchIntegration(); // Refresh data after successful connection
    } else if (urlError) {
      setError(getErrorMessage(urlError));
    }
  }, [searchParams]);

  const getErrorMessage = (errorCode: string) => {
    switch (errorCode) {
      case 'oauth_error':
        return 'YouTube authentication failed. Please try again.';
      case 'missing_params':
        return 'Missing required parameters. Please try connecting again.';
      case 'unauthorized':
        return 'Unauthorized access. Please sign in and try again.';
      case 'token_exchange_failed':
        return 'Failed to exchange authorization code. Please try again.';
      case 'no_channel_found':
        return 'No YouTube channel found for your account.';
      case 'processing_failed':
        return 'Failed to process YouTube connection. Please try again.';
      case 'server_error':
        return 'Server error occurred. Please try again later.';
      default:
        return 'An unknown error occurred. Please try again.';
    }
  };

  const fetchIntegration = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/youtube/integration');
      const data = await response.json();
      
      if (response.ok) {
        setIntegration(data.integration);
        if (data.integration && data.stats) {
          setStats(data.stats);
        }
      } else {
        setError(data.error || 'Failed to fetch integration');
      }
    } catch (err) {
      setError('Failed to fetch integration');
      console.error('Error fetching integration:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      setError(null);
      
      // Redirect to YouTube OAuth
      window.location.href = '/api/youtube/connect';
    } catch (err) {
      setError('Failed to connect to YouTube');
      console.error('Error connecting to YouTube:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your YouTube account? This will remove access to upload videos.')) {
      return;
    }

    try {
      setIsDisconnecting(true);
      setError(null);
      
      const response = await fetch('/api/youtube/integration', {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setIntegration(null);
        setStats(null);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to disconnect');
      }
    } catch (err) {
      setError('Failed to disconnect YouTube account');
      console.error('Error disconnecting:', err);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      setError(null);
      
      const response = await fetch('/api/youtube/integration/refresh', {
        method: 'POST',
      });
      
      if (response.ok) {
        const data = await response.json();
        setIntegration(data.integration);
        if (data.stats) {
          setStats(data.stats);
        }
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to refresh integration');
      }
    } catch (err) {
      setError('Failed to refresh integration');
      console.error('Error refreshing integration:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const isTokenExpired = integration && new Date(integration.expiresAt) <= new Date();

  if (status === 'loading' || loading) {
    return (
      <div className="container mx-auto max-w-4xl p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="container mx-auto max-w-4xl p-6">
        <Alert>
          <AlertDescription>
            Please sign in to manage your YouTube integration.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">YouTube Integration</h1>
          <p className="text-muted-foreground mt-2">
            Manage your YouTube account connection for video uploads
          </p>
        </div>
        <Youtube className="h-8 w-8 text-red-600" />
      </div>

      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Connection Status
            {integration && !isTokenExpired ? (
              <Badge variant="default" className="bg-green-100 text-green-800">
                <CheckCircle className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            ) : (
              <Badge variant="destructive">
                <XCircle className="h-3 w-3 mr-1" />
                {isTokenExpired ? 'Expired' : 'Not Connected'}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            {integration && !isTokenExpired
              ? 'Your YouTube account is connected and ready for uploads'
              : isTokenExpired
              ? 'Your YouTube token has expired. Please reconnect your account'
              : 'Connect your YouTube account to enable video uploads'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {integration ? (
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 border rounded-lg">
                {integration.channelThumbnail && (
                  <Image
                    src={integration.channelThumbnail}
                    fill
                    alt={integration.channelTitle}
                    className="w-16 h-16 rounded-full"
                  />
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{integration.channelTitle}</h3>
                  <p className="text-sm text-muted-foreground">Channel ID: {integration.channelId}</p>
                  <p className="text-sm text-muted-foreground">
                    Connected: {new Date(integration.createdAt).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Expires: {new Date(integration.expiresAt).toLocaleDateString()}
                  </p>
                  {isTokenExpired && (
                    <p className="text-sm text-red-600 font-medium mt-1">
                      ⚠️ Token expired - reconnection required
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`https://youtube.com/channel/${integration.channelId}`, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  View Channel
                </Button>
              </div>

              {stats && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 border rounded-lg">
                    <div className="text-2xl font-bold">{stats.subscriberCount || 'N/A'}</div>
                    <div className="text-sm text-muted-foreground">Subscribers</div>
                  </div>
                  <div className="text-center p-3 border rounded-lg">
                    <div className="text-2xl font-bold">{stats.videoCount || 'N/A'}</div>
                    <div className="text-sm text-muted-foreground">Videos</div>
                  </div>
                  <div className="text-center p-3 border rounded-lg">
                    <div className="text-2xl font-bold">{stats.viewCount || 'N/A'}</div>
                    <div className="text-sm text-muted-foreground">Total Views</div>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  variant="outline"
                >
                  {isRefreshing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Refresh Info
                </Button>
                
                <Button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  variant={isTokenExpired ? "default" : "outline"}
                >
                  {isConnecting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Youtube className="h-4 w-4 mr-2" />
                  )}
                  {isTokenExpired ? 'Reconnect Account' : 'Connect Different Account'}
                </Button>
                
                <Button
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                  variant="destructive"
                >
                  {isDisconnecting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4 mr-2" />
                  )}
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Youtube className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No YouTube Account Connected</h3>
              <p className="text-muted-foreground mb-6">
                Connect your YouTube account to start uploading videos directly from our platform.
              </p>
              <Button
                onClick={handleConnect}
                disabled={isConnecting}
                size="lg"
              >
                {isConnecting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Youtube className="h-4 w-4 mr-2" />
                )}
                Connect YouTube Account
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Permissions & Features</CardTitle>
          <CardDescription>
            What you can do with your connected YouTube account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>Upload videos to your channel</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>Set video titles, descriptions, and tags</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>Upload custom thumbnails</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>Set privacy status (private, unlisted, public)</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              <span>We cannot delete or modify existing videos</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              <span>We cannot access your channel analytics</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}