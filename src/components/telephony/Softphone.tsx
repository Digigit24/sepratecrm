// src/components/telephony/Softphone.tsx
// Global floating in-browser softphone. Mounted once in the layout.
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Phone,
  PhoneOff,
  PhoneIncoming,
  PhoneCall,
  X,
  Mic,
  MicOff,
  Pause,
  Play,
  Grid3x3,
  ArrowRightLeft,
  Loader2,
  LogOut,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTelephonyPhone, type PhoneStatus } from '@/context/TelephonyProvider';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

const DIAL_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

const launcherColor = (status: PhoneStatus): string => {
  switch (status) {
    case 'ready':
      return 'bg-green-600 hover:bg-green-700';
    case 'active':
    case 'on-hold':
    case 'dialling':
    case 'ringing-outbound':
      return 'bg-blue-600 hover:bg-blue-700 animate-pulse';
    case 'ringing-inbound':
      return 'bg-red-600 hover:bg-red-700 animate-pulse';
    case 'needs-password':
    case 'connecting':
      return 'bg-amber-500 hover:bg-amber-600';
    default:
      return 'bg-muted-foreground hover:bg-muted-foreground/90';
  }
};

export const Softphone: React.FC = () => {
  const navigate = useNavigate();
  const phone = useTelephonyPhone();
  const { status, panelOpen, setPanelOpen } = phone;

  return (
    <>
      {/* Launcher */}
      <button
        type="button"
        onClick={() => setPanelOpen(!panelOpen)}
        aria-label="Open softphone"
        className={cn(
          'fixed bottom-5 right-5 z-[60] h-12 w-12 rounded-full shadow-lg text-white flex items-center justify-center transition-colors',
          launcherColor(status),
        )}
      >
        {status === 'ringing-inbound' ? (
          <PhoneIncoming className="h-5 w-5" />
        ) : status === 'active' || status === 'on-hold' ? (
          <PhoneCall className="h-5 w-5" />
        ) : (
          <Phone className="h-5 w-5" />
        )}
      </button>

      {/* Panel */}
      {panelOpen && (
        <div className="fixed bottom-20 right-5 z-[60] w-[calc(100vw-2.5rem)] sm:w-[320px] max-w-[360px] rounded-xl border bg-card shadow-2xl max-h-[calc(100vh-7rem)] overflow-y-auto overflow-x-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/40">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Softphone</span>
              {/* Dev-only live-channel indicator (hidden in production builds) */}
              {import.meta.env.DEV && (
                <span
                  className={cn(
                    'inline-block h-2 w-2 rounded-full',
                    phone.liveConnected ? 'bg-green-500' : 'bg-muted-foreground/40',
                  )}
                  title={`Live: ${phone.liveConnected ? 'connected' : 'disconnected'}`}
                />
              )}
            </div>
            <div className="flex items-center gap-1">
              {status === 'ready' && (
                <Button variant="ghost" size="icon" className="h-6 w-6" title="Log out" onClick={phone.logout}>
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPanelOpen(false)} aria-label="Close">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="p-3">
            <SoftphoneBody navigate={navigate} />
          </div>
        </div>
      )}
    </>
  );
};

const SoftphoneBody: React.FC<{ navigate: (to: string) => void }> = ({ navigate }) => {
  const phone = useTelephonyPhone();
  const { status } = phone;

  if (status === 'loading') {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === 'not-configured') {
    return (
      <div className="text-center py-4 space-y-2">
        <p className="text-sm text-muted-foreground">Telephony isn't set up for your account.</p>
        <Button size="sm" onClick={() => navigate('/admin/settings')}>
          <Settings className="h-3.5 w-3.5 mr-2" />
          Open Settings
        </Button>
      </div>
    );
  }

  if (status === 'needs-password' || status === 'connecting') {
    return <LoginForm />;
  }

  if (status === 'ringing-inbound') {
    return <IncomingCall />;
  }

  if (status === 'dialling' || status === 'ringing-outbound') {
    return <OutgoingCall />;
  }

  if (status === 'active' || status === 'on-hold') {
    return <ActiveCall />;
  }

  // ready
  return <Dialpad />;
};

const LoginForm: React.FC = () => {
  const phone = useTelephonyPhone();
  const [password, setPassword] = useState('');
  const connecting = phone.status === 'connecting';

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs">TeleCMI User ID</Label>
        <Input value={phone.telecmiUserId ?? ''} readOnly className="h-8 text-xs font-mono bg-muted" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="sp-password" className="text-xs">Password</Label>
        <Input
          id="sp-password"
          type="password"
          autoComplete="off"
          placeholder="SBC password (this session only)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && password && phone.login(password)}
        />
      </div>
      <Button className="w-full" disabled={!password || connecting} onClick={() => phone.login(password)}>
        {connecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Phone className="h-4 w-4 mr-2" />}
        Connect
      </Button>
      <p className="text-[11px] text-muted-foreground text-center">
        Password is kept in memory only — re-enter after a reload.
      </p>
    </div>
  );
};

const Dialpad: React.FC = () => {
  const phone = useTelephonyPhone();
  const [number, setNumber] = useState('');

  return (
    <div className="space-y-3">
      <Input
        value={number}
        onChange={(e) => setNumber(e.target.value)}
        placeholder="Enter number"
        className="text-center font-mono"
        onKeyDown={(e) => e.key === 'Enter' && number && phone.dial({ toNumber: number })}
      />
      <div className="grid grid-cols-3 gap-2">
        {DIAL_KEYS.map((k) => (
          <Button key={k} variant="outline" className="h-10 text-base font-medium" onClick={() => setNumber((n) => n + k)}>
            {k}
          </Button>
        ))}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" disabled={!number} onClick={() => setNumber((n) => n.slice(0, -1))}>
          ⌫
        </Button>
        <Button className="flex-1 bg-green-600 hover:bg-green-700" disabled={!number} onClick={() => phone.dial({ toNumber: number })}>
          <Phone className="h-4 w-4 mr-2" />
          Call
        </Button>
      </div>
    </div>
  );
};

const IncomingCall: React.FC = () => {
  const phone = useTelephonyPhone();
  return (
    <div className="text-center space-y-3 py-2">
      <PhoneIncoming className="h-8 w-8 mx-auto text-red-600 animate-pulse" />
      <div>
        <p className="text-xs text-muted-foreground">Incoming call</p>
        <p className="text-base font-semibold font-mono">{phone.currentCall?.number || 'Unknown'}</p>
      </div>
      <div className="flex gap-2">
        <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={phone.answer}>
          <Phone className="h-4 w-4 mr-2" />
          Accept
        </Button>
        <Button variant="destructive" className="flex-1" onClick={phone.reject}>
          <PhoneOff className="h-4 w-4 mr-2" />
          Decline
        </Button>
      </div>
    </div>
  );
};

const OutgoingCall: React.FC = () => {
  const phone = useTelephonyPhone();
  return (
    <div className="text-center space-y-3 py-2">
      <PhoneCall className="h-8 w-8 mx-auto text-blue-600 animate-pulse" />
      <div>
        <p className="text-xs text-muted-foreground">
          {phone.status === 'ringing-outbound' ? 'Ringing…' : 'Calling…'}
        </p>
        <p className="text-base font-semibold font-mono">{phone.currentCall?.number}</p>
      </div>
      <Button variant="destructive" className="w-full" onClick={phone.hangUp}>
        <PhoneOff className="h-4 w-4 mr-2" />
        Cancel
      </Button>
    </div>
  );
};

const ActiveCall: React.FC = () => {
  const phone = useTelephonyPhone();
  const [showDtmf, setShowDtmf] = useState(false);
  const [transferTo, setTransferTo] = useState('');
  const [showTransfer, setShowTransfer] = useState(false);

  return (
    <div className="space-y-3">
      <div className="text-center">
        <p className="text-base font-semibold font-mono">{phone.currentCall?.number}</p>
        <p className="text-xs text-muted-foreground">
          {phone.isOnHold ? 'On hold · ' : ''}
          {fmt(phone.durationSec)}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Button variant={phone.isMuted ? 'default' : 'outline'} className="h-12 flex-col gap-1" onClick={phone.isMuted ? phone.unmute : phone.mute}>
          {phone.isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          <span className="text-[10px]">{phone.isMuted ? 'Unmute' : 'Mute'}</span>
        </Button>
        <Button variant={phone.isOnHold ? 'default' : 'outline'} className="h-12 flex-col gap-1" onClick={phone.isOnHold ? phone.unhold : phone.hold}>
          {phone.isOnHold ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          <span className="text-[10px]">{phone.isOnHold ? 'Resume' : 'Hold'}</span>
        </Button>
        <Button variant={showDtmf ? 'default' : 'outline'} className="h-12 flex-col gap-1" onClick={() => setShowDtmf((v) => !v)}>
          <Grid3x3 className="h-4 w-4" />
          <span className="text-[10px]">Keypad</span>
        </Button>
      </div>

      {showDtmf && (
        <div className="grid grid-cols-3 gap-1.5">
          {DIAL_KEYS.map((k) => (
            <Button key={k} variant="outline" size="sm" className="h-8" onClick={() => phone.sendDtmf(k)}>
              {k}
            </Button>
          ))}
        </div>
      )}

      {showTransfer ? (
        <div className="flex gap-1.5">
          <Input
            value={transferTo}
            onChange={(e) => setTransferTo(e.target.value)}
            placeholder="Transfer to…"
            className="h-8 text-xs"
          />
          <Button size="sm" className="h-8" disabled={!transferTo} onClick={() => phone.transfer(transferTo)}>
            Transfer
          </Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="w-full" onClick={() => setShowTransfer(true)}>
          <ArrowRightLeft className="h-3.5 w-3.5 mr-2" />
          Transfer
        </Button>
      )}

      {phone.transferInitiated && (
        <Button variant="outline" size="sm" className="w-full" onClick={phone.merge}>
          Merge calls
        </Button>
      )}

      <Button variant="destructive" className="w-full" onClick={phone.hangUp}>
        <PhoneOff className="h-4 w-4 mr-2" />
        Hang up
      </Button>
    </div>
  );
};

export default Softphone;
