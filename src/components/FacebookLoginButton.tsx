// src/components/FacebookLoginButton.tsx
import { useState } from 'react';
import { useFacebookSDK } from '@/hooks/useFacebookSDK';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Facebook } from 'lucide-react';

interface FacebookLoginButtonProps {
  appId: string;
  configId?: string;
  onSuccess?: (response: any) => void;
  onError?: (error: any) => void;
  buttonText?: string;
  variant?: 'default' | 'outline' | 'secondary';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}

export function FacebookLoginButton({
  appId,
  configId,
  onSuccess,
  onError,
  buttonText = 'Login with Facebook',
  variant = 'default',
  size = 'default',
  className = '',
}: FacebookLoginButtonProps) {
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleStatusChange = (response: any) => {
    console.log('Facebook login status:', response);

    if (response.status === 'connected') {
      toast.success('Successfully connected to Facebook!');
      if (onSuccess) {
        onSuccess(response);
      }
    } else if (response.status === 'not_authorized') {
      toast.error('Please authorize the app to continue');
      if (onError) {
        onError({ message: 'User did not authorize the app' });
      }
    } else {
      console.log('User is not logged into Facebook');
    }
  };

  const { isSDKLoaded, isLoading, login } = useFacebookSDK({
    appId,
    configId,
    version: 'v18.0',
    onStatusChange: handleStatusChange,
  });

  const handleLoginClick = () => {
    if (!isSDKLoaded) {
      toast.error('Facebook SDK is still loading. Please wait...');
      return;
    }

    setIsLoggingIn(true);

    // Call login with callback
    // The login options are already configured in useFacebookSDK
    login((response) => {
      setIsLoggingIn(false);

      console.log('Facebook Embedded Signup response:', response);

      if (response.status === 'connected') {
        console.log('Login successful!');
        console.log('Auth Response:', response.authResponse);

        // Check if we got an authorization code (for token exchange)
        if (response.authResponse?.code) {
          console.log('Authorization Code:', response.authResponse.code);
          toast.success('Authorization code received! Exchange it for a long-lived token.');
        }
        // Or if we got an access token directly
        else if (response.authResponse?.accessToken) {
          console.log('Access Token:', response.authResponse.accessToken);
          toast.success('Access token received!');
        }

        if (onSuccess) {
          onSuccess(response);
        }
      } else if (response.status === 'not_authorized') {
        console.log('User did not authorize the app');
        const errorMessage = 'Please authorize the app to continue';
        toast.error(errorMessage);
        if (onError) {
          onError({ message: errorMessage });
        }
      } else {
        console.log('Login cancelled or failed:', response);
        const errorMessage = 'Login was cancelled or failed';
        toast.error(errorMessage);
        if (onError) {
          onError({ message: errorMessage });
        }
      }
    });
  };

  return (
    <Button
      onClick={handleLoginClick}
      disabled={isLoading || !isSDKLoaded || isLoggingIn}
      variant={variant}
      size={size}
      className={`${className} bg-[#1877F2] hover:bg-[#166FE5] text-white`}
    >
      <Facebook className="h-4 w-4 mr-2" />
      {isLoading
        ? 'Loading SDK...'
        : isLoggingIn
        ? 'Logging in...'
        : buttonText}
    </Button>
  );
}
