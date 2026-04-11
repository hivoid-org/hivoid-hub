import React, { useState, useEffect, useRef } from 'react';
import { Lock, Unlock } from 'lucide-react';
import API from '../../services/api';

export default function AutoLock({ children }) {
  // 1. Recover state immediately on mount (synchronous)
  const [isLocked, setIsLocked] = useState(() => {
    if (localStorage.getItem('hub_locked') === 'true') return true;
    
    const lastActivity = localStorage.getItem('hub_last_activity');
    const savedTimeout = localStorage.getItem('hub_timeout_current');
    if (lastActivity && savedTimeout) {
        const elapsed = (Date.now() - parseInt(lastActivity)) / (60 * 1000);
        if (elapsed > parseFloat(savedTimeout)) {
            localStorage.setItem('hub_locked', 'true');
            return true;
        }
    }
    return false;
  });

  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [timeoutMinutes, setTimeoutMinutes] = useState(() => {
    return parseFloat(localStorage.getItem('hub_timeout_current')) || 5;
  });
  
  const timerRef = useRef(null);

  // Sync isLocked to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('hub_locked', isLocked ? 'true' : 'false');
    if (isLocked) {
        if (timerRef.current) clearTimeout(timerRef.current);
    }
  }, [isLocked]);

  const resetTimer = () => {
    if (isLocked || timeoutMinutes <= 0) return;
    
    localStorage.setItem('hub_last_activity', Date.now().toString());
    
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
        setIsLocked(true);
    }, timeoutMinutes * 60 * 1000);
  };

  useEffect(() => {
    const fetchConfig = async () => {
        try {
            const cfg = await API.getHubConfig();
            if (cfg.auto_lock_timeout) {
                setTimeoutMinutes(cfg.auto_lock_timeout);
                localStorage.setItem('hub_timeout_current', cfg.auto_lock_timeout.toString());
            }
        } catch (e) {}
    };
    fetchConfig();
  }, []);

  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart'];
    const handler = () => resetTimer();
    
    events.forEach(e => window.addEventListener(e, handler));
    resetTimer();
    
    return () => {
        events.forEach(e => window.removeEventListener(e, handler));
        if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isLocked, timeoutMinutes]);

  const handleUnlock = async (e) => {
    if (e) e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError('');
    try {
        await API.unlock(password);
        setIsLocked(false);
        setPassword('');
        resetTimer();
    } catch (err) {
        setError('Incorrect password');
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className={`lock-shell ${isLocked ? 'locked' : ''}`}>
        <div className="content-wrap">
            {children}
        </div>
        
        {isLocked && (
            <div className="lock-overlay animate-fade-in">
                <div className="lock-card animate-zoom-in">
                    <div className="lock-icon">
                        <Lock size={32} />
                    </div>
                    <h2>Session Locked</h2>
                    <p>Inactivity detected. Enter your password to continue.</p>
                    
                    <form onSubmit={handleUnlock} className="lock-form">
                        <input 
                            type="password" 
                            className="input-field" 
                            placeholder="Password" 
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            autoFocus
                        />
                        {error && <span className="lock-error">{error}</span>}
                        <button className="btn btn-primary w-full" disabled={loading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            {loading ? 'Unlocking...' : <><Unlock size={16} /> Unlock Panel</>}
                        </button>
                    </form>
                </div>
            </div>
        )}

        <style>{`
            .lock-shell { position: relative; min-height: 100vh; width: 100%; }
            .content-wrap { 
                transition: filter 0.5s ease, transform 0.5s ease; 
                width: 100%; 
                min-height: 100vh;
            }
            .lock-shell.locked {
                height: 100vh;
                overflow: hidden;
            }
            .lock-shell.locked .content-wrap { 
                filter: blur(15px) grayscale(0.2) brightness(0.6); 
                pointer-events: none; 
                transform: scale(0.98); 
                height: 100vh;
                overflow: hidden;
            }
            
            .lock-overlay {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.2);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 99999;
                backdrop-filter: blur(3px);
            }
            .lock-card {
                background: #000;
                border: 1px solid rgba(255,255,255,0.1);
                border-radius: 28px;
                padding: 48px 40px;
                width: 100%;
                max-width: 400px;
                text-align: center;
                box-shadow: 0 40px 100px rgba(0,0,0,0.8);
            }
            .lock-icon {
                width: 72px; height: 72px;
                background: #fff;
                border-radius: 20px;
                display: flex;
                align-items: center; justify-content: center;
                margin: 0 auto 24px;
                color: #000;
                box-shadow: 0 8px 16px rgba(255,255,255,0.1);
            }
            .lock-card h2 { font-size: 1.75rem; margin-bottom: 8px; font-weight: 700; color: #fff; }
            .lock-card p { font-size: 0.95rem; color: #aaa; margin-bottom: 32px; line-height: 1.5; }
            .lock-form { display: flex; flex-direction: column; gap: 16px; }
            .lock-error { color: #f87171; font-size: 0.85rem; margin-top: -8px; font-weight: 500; }
            
            @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
            @keyframes zoom-in { from { transform: scale(0.9) translateY(20px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
            .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
            .animate-zoom-in { animation: zoom-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        `}</style>
    </div>
  );
}
