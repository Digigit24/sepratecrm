// src/hooks/useFacebookSDK.ts
import { useEffect, useState, useCallback } from 'react';

interface FacebookAuthResponse {
  accessToken?: string;
  code?: string; // Authorization code for token exchange
  expiresIn?: string;
  signedRequest?: string;
  userID?: string;
  grantedScopes?: string;
}

interface FacebookLoginStatusResponse {
  status: 'connected' | 'not_authorized' | 'unknown';
  authResponse?: FacebookAuthResponse;
}

interface FacebookLoginOptions {
  config_id?: string;
  scope?: string;
  response_type: 'code';
  override_default_response_type?: boolean;
  extras?: {
    sessionInfoVersion?: number;
    setup?: Record<string, any>;
  };
}

declare global {
  interface Window {
    fbAsyncInit?: () => void;
    FB?: {
      init: (params: {
        appId: string;
        cookie: boolean;
        xfbml: boolean;
        version: string;
      }) => void;
      login: (
        callback: (response: FacebookLoginStatusResponse) => void,
        options?: FacebookLoginOptions
      ) => void;
      getLoginStatus: (
        callback: (response: FacebookLoginStatusResponse) => void
      ) => void;
      AppEvents: {
        logPageView: () => void;
      };
    };
  }
}

interface UseFacebookSDKOptions {
  appId: string;
  configId?: string;
  version?: string;
  onStatusChange?: (response: FacebookLoginStatusResponse) => void;
}

export function useFacebookSDK({
  appId,
  configId,
  version = 'v18.0',
  onStatusChange,
}: UseFacebookSDKOptions) {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [loginStatus, setLoginStatus] = useState<FacebookLoginStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if SDK is already loaded
    if (window.FB) {
      setIsSDKLoaded(true);
      setIsLoading(false);
      return;
    }

    // Initialize Facebook SDK
    window.fbAsyncInit = function () {
      window.FB!.init({
        appId: appId,
        cookie: true,
        xfbml: true,
        version: version,
      });

      window.FB!.AppEvents.logPageView();
      setIsSDKLoaded(true);
      setIsLoading(false);

      // Check initial login status
      window.FB!.getLoginStatus((response) => {
        setLoginStatus(response);
        if (onStatusChange) {
          onStatusChange(response);
        }
      });
    };

    // Load the SDK asynchronously
    const loadSDK = () => {
      const id = 'facebook-jssdk';
      if (document.getElementById(id)) {
        return;
      }

      const js = document.createElement('script');
      js.id = id;
      js.src = 'https://connect.facebook.net/en_US/sdk.js';

      const fjs = document.getElementsByTagName('script')[0];
      if (fjs && fjs.parentNode) {
        fjs.parentNode.insertBefore(js, fjs);
      }
    };

    loadSDK();
  }, [appId, version, onStatusChange]);

  const checkLoginState = useCallback(() => {
    if (!window.FB) {
      console.warn('Facebook SDK not loaded yet');
      return;
    }

    window.FB.getLoginStatus((response) => {
      setLoginStatus(response);
      if (onStatusChange) {
        onStatusChange(response);
      }
    });
  }, [onStatusChange]);

  const login = useCallback(
    (
      callback?: (response: FacebookLoginStatusResponse) => void,
      customOptions?: Partial<FacebookLoginOptions>
    ) => {
      if (!window.FB) {
        console.error('Facebook SDK not loaded');
        return;
      }

      // Build login options for Embedded Signup with Authorization Code Flow
      const loginOptions: FacebookLoginOptions = {
        // Required: WhatsApp Business permissions
        scope: 'whatsapp_business_management,business_management',

        // CRITICAL: Forces Authorization Code Flow (for System User tokens)
        response_type: 'code',

        // Mandatory for System User tokens/Embedded Signup
        override_default_response_type: true,

        // Include config_id for Embedded Signup
        config_id: configId,

        // Recommended: Returns sessionInfoVersion: 2 with WABA/Phone ID
        extras: {
          sessionInfoVersion: 2,
        },

        // Allow custom options to override defaults
        ...customOptions,
      };

      console.log('FB.login called with options:', loginOptions);

      window.FB.login(
        (response) => {
          console.log('FB.login response:', response);
          setLoginStatus(response);
          if (onStatusChange) {
            onStatusChange(response);
          }
          if (callback) {
            callback(response);
          }
        },
        loginOptions
      );
    },
    [configId, onStatusChange]
  );

  return {
    isSDKLoaded,
    isLoading,
    loginStatus,
    checkLoginState,
    login,
  };
}
