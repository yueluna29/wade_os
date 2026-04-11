import React, { useEffect, useState } from 'react';
import { Icons } from '../ui/Icons';
import {
  isPushSupported,
  isIos,
  isIosStandalone,
  getPermission,
  getCurrentSubscription,
  subscribeThisDevice,
  unsubscribeThisDevice,
  sendTestPush,
} from '../../services/pushService';

// Push Notifications card — lives in Settings → Control tab.
// Shows current state on this device, lets Luna enable/disable + send a test push.
export const PushNotificationsCard: React.FC = () => {
  const [supported, setSupported] = useState<boolean>(true);
  const [needsHomeScreen, setNeedsHomeScreen] = useState<boolean>(false);
  const [permission, setPermissionState] = useState<NotificationPermission>('default');
  const [subscribed, setSubscribed] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [status, setStatus] = useState<{ kind: 'idle' | 'ok' | 'error'; text: string }>({ kind: 'idle', text: '' });

  // Check current state on mount
  useEffect(() => {
    (async () => {
      const sup = isPushSupported();
      setSupported(sup);
      setNeedsHomeScreen(isIos() && !isIosStandalone());
      setPermissionState(getPermission());
      if (sup) {
        const sub = await getCurrentSubscription();
        setSubscribed(!!sub);
      }
    })();
  }, []);

  const handleEnable = async () => {
    setBusy(true);
    setStatus({ kind: 'idle', text: '' });
    const result = await subscribeThisDevice();
    setBusy(false);
    if (result.ok) {
      setSubscribed(true);
      setPermissionState(getPermission());
      setStatus({ kind: 'ok', text: 'Notifications enabled on this device.' });
    } else {
      setStatus({ kind: 'error', text: result.reason });
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    setStatus({ kind: 'idle', text: '' });
    const result = await unsubscribeThisDevice();
    setBusy(false);
    if (result.ok) {
      setSubscribed(false);
      setStatus({ kind: 'ok', text: 'Notifications disabled on this device.' });
    } else {
      setStatus({ kind: 'error', text: result.reason });
    }
  };

  const handleTest = async () => {
    setBusy(true);
    setStatus({ kind: 'idle', text: '' });
    const result = await sendTestPush();
    setBusy(false);
    if (result.ok) {
      setStatus({ kind: 'ok', text: 'Test push sent — should arrive in a moment.' });
    } else {
      setStatus({ kind: 'error', text: result.reason || 'Failed to send test push.' });
    }
  };

  return (
    <div className="bg-wade-bg-card rounded-2xl border border-wade-border p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-wade-accent-light flex items-center justify-center text-wade-accent">
          <Icons.Bell size={14} />
        </div>
        <div>
          <h3 className="text-xs font-bold text-wade-text-main">Push Notifications</h3>
          <p className="text-[10px] text-wade-text-muted">Wade can ping you on your lock screen</p>
        </div>
      </div>

      {!supported && (
        <div className="text-[10px] text-wade-text-muted bg-wade-bg-app rounded-xl p-3 leading-relaxed">
          Your browser doesn&apos;t support Web Push. Try Chrome, Edge, Firefox, or Safari 16.4+.
        </div>
      )}

      {supported && needsHomeScreen && (
        <div className="text-[10px] text-wade-text-muted bg-wade-bg-app rounded-xl p-3 leading-relaxed space-y-1">
          <p className="font-bold text-wade-text-main">iPhone needs one extra step:</p>
          <p>1. Tap the share button in Safari</p>
          <p>2. Choose <b>Add to Home Screen</b></p>
          <p>3. Open WadeOS from the home screen icon, then come back here</p>
        </div>
      )}

      {supported && !needsHomeScreen && (
        <div className="space-y-3">
          {/* State row */}
          <div className="flex items-center justify-between bg-wade-bg-app rounded-xl px-3 py-2.5">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${subscribed ? 'bg-green-400' : 'bg-wade-text-muted/40'}`} />
              <span className="text-[11px] font-bold text-wade-text-main">
                {subscribed ? 'Enabled on this device' : 'Not enabled'}
              </span>
            </div>
            {permission === 'denied' && (
              <span className="text-[9px] uppercase tracking-wider font-bold text-red-400">Blocked</span>
            )}
          </div>

          {permission === 'denied' && (
            <p className="text-[10px] text-wade-text-muted leading-relaxed">
              You blocked notifications in browser settings. Open browser site settings → Notifications → Allow, then come back.
            </p>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            {!subscribed ? (
              <button
                onClick={handleEnable}
                disabled={busy || permission === 'denied'}
                className="flex-1 bg-wade-accent text-white text-[11px] font-bold py-2.5 rounded-xl hover:bg-wade-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {busy ? 'Working...' : 'Enable notifications'}
              </button>
            ) : (
              <>
                <button
                  onClick={handleTest}
                  disabled={busy}
                  className="flex-1 bg-wade-accent text-white text-[11px] font-bold py-2.5 rounded-xl hover:bg-wade-accent-hover transition-colors disabled:opacity-40"
                >
                  {busy ? 'Working...' : 'Send test push'}
                </button>
                <button
                  onClick={handleDisable}
                  disabled={busy}
                  className="px-4 bg-wade-bg-app text-wade-text-muted text-[11px] font-bold py-2.5 rounded-xl border border-wade-border hover:text-wade-text-main transition-colors disabled:opacity-40"
                >
                  Disable
                </button>
              </>
            )}
          </div>

          {status.kind !== 'idle' && (
            <p className={`text-[10px] leading-relaxed ${status.kind === 'ok' ? 'text-green-500' : 'text-red-400'}`}>
              {status.text}
            </p>
          )}

          <p className="text-[9px] text-wade-text-muted leading-relaxed pt-1">
            Wade only pings you when he wakes up on his own (keepalive cycles, 21:21, autonomous moments). Normal chat replies don&apos;t push.
          </p>
        </div>
      )}
    </div>
  );
};
