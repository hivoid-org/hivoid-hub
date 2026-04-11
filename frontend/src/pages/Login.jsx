import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, ShieldCheck, AlertCircle, Smartphone, Send, Lock } from 'lucide-react';
import API from '../services/api';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [showOtp, setShowOtp] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [tgPending, setTgPending] = useState(false);
  const [txId, setTxId] = useState('');
  const [loginMode, setLoginMode] = useState('normal'); // 'normal' or 'telegram'
  const [publicInfo, setPublicInfo] = useState({ login_path: 'login', telegram_login_auth: false });

  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const logoSrc = theme === 'light' ? '/logo-dark.png' : '/logo-light.png';

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    const fetchInfo = async () => {
      try {
        const info = await API.getPublicInfo();
        setPublicInfo(info);
      } catch (e) { }
    };
    fetchInfo();
  }, [theme]);

  // Telegram Polling
  useEffect(() => {
    let pollTimer;
    if (tgPending && txId) {
      pollTimer = setInterval(async () => {
        try {
          const data = await API.checkTelegramApproval(txId);
          if (data.status === 'success') {
            clearInterval(pollTimer);
            setTgPending(false);
            localStorage.setItem('hivoid_token', data.access_token);
            localStorage.setItem('hivoid_user', data.username);
            onLoginSuccess(data.username);
          } else if (data.status !== 'PENDING') {
            // This case shouldn't happen based on API design but for safety:
            throw new Error('Verification failed');
          }
        } catch (err) {
          clearInterval(pollTimer);
          setTgPending(false);
          setError(err.response?.data?.detail === 'LOGIN_DENIED' ? 'Login denied from Telegram.' : 'Telegram request expired or failed.');
          setLoading(false);
        }
      }, 2000);
    }
    return () => pollTimer && clearInterval(pollTimer);
  }, [tgPending, txId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please fill in all fields.');
      return;
    }
    if (showOtp && !otpCode) {
      setError('Please enter the 2FA code.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const data = loginMode === 'telegram'
        ? await API.loginTelegramOnly(username)
        : await API.login(username, password, otpCode);

      if (data.status === 'TELEGRAM_APPROVAL_PENDING') {
        setTxId(data.tx_id);
        setTgPending(true);
        setLoading(true);
        setError('');
        return;
      }
      localStorage.setItem('hivoid_token', data.access_token);
      localStorage.setItem('hivoid_user', data.username);
      onLoginSuccess(data.username);
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (detail === '2FA_REQUIRED') {
        setShowOtp(true);
        setError('');
      } else {
        const errorMap = {
          'IP_NOT_ALLOWED': 'Access Denied: Your IP is not whitelisted.',
          'GEO_NOT_ALLOWED': 'Access Denied: Your country is not allowed.',
          'TOO_MANY_ATTEMPTS': 'Security Lockout: Too many failed attempts.',
          'TELEGRAM_LOGIN_DISABLED': 'Telegram Login is currently disabled by administrator.',
          'Invalid 2FA code': 'Invalid 2FA code.',
        };
        setError(errorMap[detail] || (typeof detail === 'string' ? detail : 'Invalid credentials.'));
      }
    }
    if (!tgPending) setLoading(false);
  };

  const handlePasskeyLogin = async () => {
    if (!username) {
      setError('Please enter your username first.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const options = await API.webauthnLoginOptions(username);
      // Map buffers
      options.allowCredentials = options.allowCredentials.map(c => ({
        ...c,
        id: base64URLToBuffer(c.id)
      }));
      options.challenge = base64URLToBuffer(options.challenge);

      const assertion = await navigator.credentials.get({ publicKey: options });

      const response = {
        id: assertion.id,
        rawId: bufferToBase64URLString(assertion.rawId),
        type: assertion.type,
        response: {
          authenticatorData: bufferToBase64URLString(assertion.response.authenticatorData),
          clientDataJSON: bufferToBase64URLString(assertion.response.clientDataJSON),
          signature: bufferToBase64URLString(assertion.response.signature),
          userHandle: assertion.response.userHandle ? bufferToBase64URLString(assertion.response.userHandle) : null,
        },
      };

      const data = await API.webauthnLoginVerify(username, response);
      localStorage.setItem('hivoid_token', data.access_token);
      localStorage.setItem('hivoid_user', data.username);
      onLoginSuccess(data.username);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(detail || 'Passkey authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const bufferToBase64URLString = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let str = "";
    for (const charCode of bytes) str += String.fromCharCode(charCode);
    return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  };

  const base64URLToBuffer = (base64URL) => {
    const base64 = base64URL.replace(/-/g, "+").replace(/_/g, "/");
    const padLen = (4 - (base64.length % 4)) % 4;
    const padded = base64 + "=".repeat(padLen);
    const binary = atob(padded);
    const buffer = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i);
    return buffer.buffer;
  };

  return (
    <div className="login-page">
      <div className="login-grid-bg" />
      <div className="login-wrapper animate-fade-slide">

        {/* Brand */}
        <div className="login-brand">
          <img src={logoSrc} alt="HiVoid" className="login-brand-logo" />
          <h1 className="login-brand-title">HiVoid Hub</h1>
          <p className="login-brand-sub">Sign in to continue</p>
        </div>

        {/* Card */}
        <div className="login-card">
          <form onSubmit={handleSubmit} className="login-form">

            {error && (
              <div className="login-error">
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
            )}


            {loginMode === 'normal' ? (
              <>
                <div className="login-field">
                  <label>Username</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="admin"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={showOtp || tgPending}
                  />
                </div>

                <div className="login-field">
                  <label>Password</label>
                  <div className="login-pass-wrap">
                    <input
                      type={showPass ? 'text' : 'password'}
                      className="input-field"
                      placeholder="••••••••"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={showOtp || tgPending}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="login-pass-toggle"
                      disabled={showOtp || tgPending}
                    >
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {showOtp && (
                  <div className="login-field animate-fade-slide">
                    <label>2FA OTP Code</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="000000"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      autoFocus
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="login-field animate-fade-slide">
                <label>Telegram Admin Username</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Enter username..."
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={tgPending}
                  autoFocus
                />
              </div>
            )}

            {tgPending && (
              <div className="login-field animate-fade-slide tg-pending-box">
                <div className="tg-pending-content">
                  <Send className="tg-fly-icon" size={24} color="#0088cc" />
                  <div className="tg-pending-text">
                    <strong>Waiting for Approval</strong>
                    <p>A notification has been sent to your Telegram. Please approve to continue.</p>
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary login-submit"
              disabled={loading}
            >
              {loading ? (
                <span className="login-loading">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    className="spin">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  {tgPending ? 'Confirming Approval...' : 'Authenticating...'}
                </span>
              ) : (
                <span className="login-loading">
                  <ShieldCheck size={16} />
                  {loginMode === 'telegram' ? 'Request Telegram Approval' : (showOtp ? 'Verify & Sign In' : 'Sign In')}
                </span>
              )}
            </button>

            <div className="login-divider">
              <span>OTHER OPTIONS</span>
            </div>

            <div className="login-extras">
              {loginMode === 'normal' && publicInfo.telegram_login_auth && (
                <button
                  type="button"
                  className="btn btn-secondary w-full"
                  onClick={() => { setLoginMode('telegram'); setError(''); setShowOtp(false); }}
                  disabled={loading}
                >
                  <Send size={16} color="#0088cc" /> Sign in via Telegram
                </button>
              )}

              {loginMode === 'telegram' && (
                <button
                  type="button"
                  className="btn btn-secondary w-full"
                  onClick={() => { setLoginMode('normal'); setError(''); }}
                  disabled={loading}
                >
                  <Lock size={16} /> Standard Username & Password
                </button>
              )}

              <button
                type="button"
                className="btn btn-secondary w-full"
                onClick={handlePasskeyLogin}
                disabled={loading || showOtp || tgPending}
              >
                <Smartphone size={16} /> Sign in with Passkey
              </button>
            </div>
          </form>
        </div>

        <p className="login-footer">HiVoid Hub v1.0.2</p>
      </div>
    </div>
  );
}
