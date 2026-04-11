import React, { useState, useEffect, useMemo } from 'react';
import { 
  User, 
  Lock, 
  Shield, 
  Globe, 
  Clock, 
  Bell, 
  Fingerprint, 
  Save, 
  RefreshCw, 
  Key, 
  Wand2, 
  Send, 
  CheckCircle2, 
  AlertTriangle,
  AlertCircle,
  MapPin,
  Smartphone,
  Copy,
  Plus,
  Trash2,
  Monitor,
  Cpu,
  Zap,
  Activity,
  UserPlus,
  UserCheck,
  Power,
  ZapOff
} from 'lucide-react';
import API from '../services/api';
import { useFeedback } from '../components/feedback/FeedbackProvider';
import Modal from '../components/common/Modal';
import QRCode from 'qrcode';

const SECTION = {
  PROFILE: 'profile',
  ENTRY: 'entry',
  NETWORK: 'network',
  TWOFA: 'twofa',
  PASSKEYS: 'passkeys',
  TELEGRAM: 'telegram',
};

const COMMON_COUNTRIES = [
  { code: 'AF', name: 'Afghanistan' }, { code: 'AX', name: 'Aland Islands' }, { code: 'AL', name: 'Albania' }, { code: 'DZ', name: 'Algeria' }, { code: 'AS', name: 'American Samoa' }, { code: 'AD', name: 'Andorra' }, { code: 'AO', name: 'Angola' }, { code: 'AI', name: 'Anguilla' }, { code: 'AQ', name: 'Antarctica' }, { code: 'AG', name: 'Antigua and Barbuda' }, { code: 'AR', name: 'Argentina' }, { code: 'AM', name: 'Armenia' }, { code: 'AW', name: 'Aruba' }, { code: 'AU', name: 'Australia' }, { code: 'AT', name: 'Austria' }, { code: 'AZ', name: 'Azerbaijan' }, { code: 'BS', name: 'Bahamas' }, { code: 'BH', name: 'Bahrain' }, { code: 'BD', name: 'Bangladesh' }, { code: 'BB', name: 'Barbados' }, { code: 'BY', name: 'Belarus' }, { code: 'BE', name: 'Belgium' }, { code: 'BZ', name: 'Belize' }, { code: 'BJ', name: 'Benin' }, { code: 'BM', name: 'Bermuda' }, { code: 'BT', name: 'Bhutan' }, { code: 'BO', name: 'Bolivia' }, { code: 'BQ', name: 'Bonaire, Sint Eustatius and Saba' }, { code: 'BA', name: 'Bosnia and Herzegovina' }, { code: 'BW', name: 'Botswana' }, { code: 'BV', name: 'Bouvet Island' }, { code: 'BR', name: 'Brazil' }, { code: 'IO', name: 'British Indian Ocean Territory' }, { code: 'BN', name: 'Brunei Darussalam' }, { code: 'BG', name: 'Bulgaria' }, { code: 'BF', name: 'Burkina Faso' }, { code: 'BI', name: 'Burundi' }, { code: 'KH', name: 'Cambodia' }, { code: 'CM', name: 'Cameroon' }, { code: 'CA', name: 'Canada' }, { code: 'CV', name: 'Cape Verde' }, { code: 'KY', name: 'Cayman Islands' }, { code: 'CF', name: 'Central African Republic' }, { code: 'TD', name: 'Chad' }, { code: 'CL', name: 'Chile' }, { code: 'CN', name: 'China' }, { code: 'CX', name: 'Christmas Island' }, { code: 'CC', name: 'Cocos (Keeling) Islands' }, { code: 'CO', name: 'Colombia' }, { code: 'KM', name: 'Comoros' }, { code: 'CG', name: 'Congo' }, { code: 'CD', name: 'Congo, Democratic Republic of the' }, { code: 'CK', name: 'Cook Islands' }, { code: 'CR', name: 'Costa Rica' }, { code: 'CI', name: "Cote d'Ivoire" }, { code: 'HR', name: 'Croatia' }, { code: 'CU', name: 'Cuba' }, { code: 'CW', name: 'Curacao' }, { code: 'CY', name: 'Cyprus' }, { code: 'CZ', name: 'Czech Republic' }, { code: 'DK', name: 'Denmark' }, { code: 'DJ', name: 'Djibouti' }, { code: 'DM', name: 'Dominica' }, { code: 'DO', name: 'Dominican Republic' }, { code: 'EC', name: 'Ecuador' }, { code: 'EG', name: 'Egypt' }, { code: 'SV', name: 'El Salvador' }, { code: 'GQ', name: 'Equatorial Guinea' }, { code: 'ER', name: 'Eritrea' }, { code: 'EE', name: 'Estonia' }, { code: 'ET', name: 'Ethiopia' }, { code: 'FK', name: 'Falkland Islands (Malvinas)' }, { code: 'FO', name: 'Faroe Islands' }, { code: 'FJ', name: 'Fiji' }, { code: 'FI', name: 'Finland' }, { code: 'FR', name: 'France' }, { code: 'GF', name: 'French Guiana' }, { code: 'PF', name: 'French Polynesia' }, { code: 'TF', name: 'French Southern Territories' }, { code: 'GA', name: 'Gabon' }, { code: 'GM', name: 'Gambia' }, { code: 'GE', name: 'Georgia' }, { code: 'DE', name: 'Germany' }, { code: 'GH', name: 'Ghana' }, { code: 'GI', name: 'Gibraltar' }, { code: 'GR', name: 'Greece' }, { code: 'GL', name: 'Greenland' }, { code: 'GD', name: 'Grenada' }, { code: 'GP', name: 'Guadeloupe' }, { code: 'GU', name: 'Guam' }, { code: 'GT', name: 'Guatemala' }, { code: 'GG', name: 'Guernsey' }, { code: 'GN', name: 'Guinea' }, { code: 'GW', name: 'Guinea-Bissau' }, { code: 'GY', name: 'Guyana' }, { code: 'HT', name: 'Haiti' }, { code: 'HM', name: 'Heard Island and McDonald Islands' }, { code: 'VA', name: 'Holy See (Vatican City State)' }, { code: 'HN', name: 'Honduras' }, { code: 'HK', name: 'Hong Kong' }, { code: 'HU', name: 'Hungary' }, { code: 'IS', name: 'Iceland' }, { code: 'IN', name: 'India' }, { code: 'ID', name: 'Indonesia' }, { code: 'IR', name: 'Iran, Islamic Republic of' }, { code: 'IQ', name: 'Iraq' }, { code: 'IE', name: 'Ireland' }, { code: 'IM', name: 'Isle of Man' }, { code: 'IL', name: 'Israel' }, { code: 'IT', name: 'Italy' }, { code: 'JM', name: 'Jamaica' }, { code: 'JP', name: 'Japan' }, { code: 'JE', name: 'Jersey' }, { code: 'JO', name: 'Jordan' }, { code: 'KZ', name: 'Kazakhstan' }, { code: 'KE', name: 'Kenya' }, { code: 'KI', name: 'Kiribati' }, { code: 'KP', name: "Korea, Democratic People's Republic of" }, { code: 'KR', name: 'Korea, Republic of' }, { code: 'KW', name: 'Kuwait' }, { code: 'KG', name: 'Kyrgyzstan' }, { code: 'LA', name: "Lao People's Democratic Republic" }, { code: 'LV', name: 'Latvia' }, { code: 'LB', name: 'Lebanon' }, { code: 'LS', name: 'Lesotho' }, { code: 'LR', name: 'Liberia' }, { code: 'LY', name: 'Libya' }, { code: 'LI', name: 'Liechtenstein' }, { code: 'LT', name: 'Lithuania' }, { code: 'LU', name: 'Luxembourg' }, { code: 'MO', name: 'Macao' }, { code: 'MK', name: 'Macedonia, the Former Yugoslav Republic of' }, { code: 'MG', name: 'Madagascar' }, { code: 'MW', name: 'Malawi' }, { code: 'MY', name: 'Malaysia' }, { code: 'MV', name: 'Maldives' }, { code: 'ML', name: 'Mali' }, { code: 'MT', name: 'Malta' }, { code: 'MH', name: 'Marshall Islands' }, { code: 'MQ', name: 'Martinique' }, { code: 'MR', name: 'Mauritania' }, { code: 'MU', name: 'Mauritius' }, { code: 'YT', name: 'Mayotte' }, { code: 'MX', name: 'Mexico' }, { code: 'FM', name: 'Micronesia, Federated States of' }, { code: 'MD', name: 'Moldova, Republic of' }, { code: 'MC', name: 'Monaco' }, { code: 'MN', name: 'Mongolia' }, { code: 'ME', name: 'Montenegro' }, { code: 'MS', name: 'Montserrat' }, { code: 'MA', name: 'Morocco' }, { code: 'MZ', name: 'Mozambique' }, { code: 'MM', name: 'Myanmar' }, { code: 'NA', name: 'Namibia' }, { code: 'NR', name: 'Nauru' }, { code: 'NP', name: 'Nepal' }, { code: 'NL', name: 'Netherlands' }, { code: 'NC', name: 'New Caledonia' }, { code: 'NZ', name: 'New Zealand' }, { code: 'NI', name: 'Nicaragua' }, { code: 'NE', name: 'Niger' }, { code: 'NG', name: 'Nigeria' }, { code: 'NU', name: 'Niue' }, { code: 'NF', name: 'Norfolk Island' }, { code: 'MP', name: 'Northern Mariana Islands' }, { code: 'NO', name: 'Norway' }, { code: 'OM', name: 'Oman' }, { code: 'PK', name: 'Pakistan' }, { code: 'PW', name: 'Palau' }, { code: 'PS', name: 'Palestine, State of' }, { code: 'PA', name: 'Panama' }, { code: 'PG', name: 'Papua New Guinea' }, { code: 'PY', name: 'Paraguay' }, { code: 'PE', name: 'Peru' }, { code: 'PH', name: 'Philippines' }, { code: 'PN', name: 'Pitcairn' }, { code: 'PL', name: 'Poland' }, { code: 'PT', name: 'Portugal' }, { code: 'PR', name: 'Puerto Rico' }, { code: 'QA', name: 'Qatar' }, { code: 'RE', name: 'Reunion' }, { code: 'RO', name: 'Romania' }, { code: 'RU', name: 'Russian Federation' }, { code: 'RW', name: 'Rwanda' }, { code: 'BL', name: 'Saint Barthelemy' }, { code: 'SH', name: 'Saint Helena' }, { code: 'KN', name: 'Saint Kitts and Nevis' }, { code: 'LC', name: 'Saint Lucia' }, { code: 'MF', name: 'Saint Martin (French part)' }, { code: 'PM', name: 'Saint Pierre and Miquelon' }, { code: 'VC', name: 'Saint Vincent and the Grenadines' }, { code: 'WS', name: 'Samoa' }, { code: 'SM', name: 'San Marino' }, { code: 'ST', name: 'Sao Tome and Principe' }, { code: 'SA', name: 'Saudi Arabia' }, { code: 'SN', name: 'Senegal' }, { code: 'RS', name: 'Serbia' }, { code: 'SC', name: 'Seychelles' }, { code: 'SL', name: 'Sierra Leone' }, { code: 'SG', name: 'Singapore' }, { code: 'SX', name: 'Sint Maarten (Dutch part)' }, { code: 'SK', name: 'Slovakia' }, { code: 'SI', name: 'Slovenia' }, { code: 'SB', name: 'Solomon Islands' }, { code: 'SO', name: 'Somalia' }, { code: 'ZA', name: 'South Africa' }, { code: 'GS', name: 'South Georgia and the South Sandwich Islands' }, { code: 'SS', name: 'South Sudan' }, { code: 'ES', name: 'Spain' }, { code: 'LK', name: 'Sri Lanka' }, { code: 'SD', name: 'Sudan' }, { code: 'SR', name: 'Suriname' }, { code: 'SJ', name: 'Svalbard and Jan Mayen' }, { code: 'SZ', name: 'Swaziland' }, { code: 'SE', name: 'Sweden' }, { code: 'CH', name: 'Switzerland' }, { code: 'SY', name: 'Syrian Arab Republic' }, { code: 'TW', name: 'Taiwan, Province of China' }, { code: 'TJ', name: 'Tajikistan' }, { code: 'TZ', name: 'Tanzania, United Republic of' }, { code: 'TH', name: 'Thailand' }, { code: 'TL', name: 'Timor-Leste' }, { code: 'TG', name: 'Togo' }, { code: 'TK', name: 'Tokelau' }, { code: 'TO', name: 'Tonga' }, { code: 'TT', name: 'Trinidad and Tobago' }, { code: 'TN', name: 'Tunisia' }, { code: 'TR', name: 'Turkey' }, { code: 'TM', name: 'Turkmenistan' }, { code: 'TC', name: 'Turks and Caicos Islands' }, { code: 'TV', name: 'Tuvalu' }, { code: 'UG', name: 'Uganda' }, { code: 'UA', name: 'Ukraine' }, { code: 'AE', name: 'United Arab Emirates' }, { code: 'GB', name: 'United Kingdom' }, { code: 'US', name: 'United States' }, { code: 'UM', name: 'United States Minor Outlying Islands' }, { code: 'UY', name: 'Uruguay' }, { code: 'UZ', name: 'Uzbekistan' }, { code: 'VU', name: 'Vanuatu' }, { code: 'VE', name: 'Venezuela' }, { code: 'VN', name: 'Viet Nam' }, { code: 'VG', name: 'Virgin Islands, British' }, { code: 'VI', name: 'Virgin Islands, U.S.' }, { code: 'WF', name: 'Wallis and Futuna' }, { code: 'EH', name: 'Western Sahara' }, { code: 'YE', name: 'Yemen' }, { code: 'ZM', name: 'Zambia' }, { code: 'ZW', name: 'Zimbabwe' },
];

export default function AdminSettings() {
  const { notify, confirm } = useFeedback();
  const [activeTab, setActiveTab] = useState(SECTION.PROFILE);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // States
  const [currentUser, setCurrentUser] = useState(null);
  const [newUsername, setNewUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const [hubConfig, setHubConfig] = useState({
    login_path: 'login',
    admin_ip_whitelist: '',
    session_timeout: 120,
    telegram_bot_token: '',
    telegram_chat_id: '',
    telegram_alerts: {
        admin_login: true,
        failed_login: true,
        ip_ban: true,
        node_alert: true,
        audit_alert: false,
        user_created: false,
        user_deleted: false,
        config_changed: false,
        backup_success: false
    },
    telegram_login_auth: false,
    telegram_2fa_approval: false,
    admin_geo_whitelist: []
  });

  // 2FA states
  const [twofaSetup, setTwofaSetup] = useState(null);
  const [twofaQr, setTwofaQr] = useState('');
  const [twofaCode, setTwofaCode] = useState('');
  const [twofaRecoveryCodes, setTwofaRecoveryCodes] = useState(null);
  const [twofaLoading, setTwofaLoading] = useState(false);
  const [passkeys, setPasskeys] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);


  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [me, cfg, sess] = await Promise.all([API.getMe(), API.getHubConfig(), API.getSessions()]);
      setCurrentUser(me);
      setNewUsername(me.username || '');
      setHubConfig({
        login_path: cfg.login_path || 'login',
        admin_ip_whitelist: (cfg.admin_ip_whitelist || []).join(', '),
        session_timeout: cfg.session_timeout ?? 120,
        telegram_bot_token: cfg.telegram_bot_token || '',
        telegram_chat_id: cfg.telegram_chat_id || '',
        telegram_alerts: cfg.telegram_alerts || {
            admin_login: true,
            failed_login: true,
            ip_ban: true,
            node_alert: true,
            audit_alert: false,
            user_created: false,
            user_deleted: false,
            config_changed: false,
            backup_success: false
        },
        telegram_login_auth: cfg.telegram_login_auth || false,
        telegram_2fa_approval: cfg.telegram_2fa_approval || false,
        admin_geo_whitelist: cfg.admin_geo_whitelist || []
      });
      setPasskeys(me.webauthn_credentials || []);
      setActiveSessions(sess || []);
    } catch (err) {
      notify('Failed to load settings.', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!newUsername.trim()) return notify('Username required', { type: 'warning' });
    setSaving(true);
    try {
      await API.updateProfile(newUsername);
      notify('Username updated.', { type: 'success' });
      setCurrentUser(prev => ({ ...prev, username: newUsername }));
    } catch (err) {
      notify(err.response?.data?.detail || 'Failed to update username', { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword) return notify('Fill all fields', { type: 'warning' });
    setSaving(true);
    try {
      await API.updatePassword(currentPassword, newPassword);
      notify('Password updated.', { type: 'success' });
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      notify(err.response?.data?.detail || 'Failed to update password', { type: 'error' });
    } finally {
        setSaving(false);
    }
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      await API.updateHubConfig({
        login_path: hubConfig.login_path || 'login',
        admin_ip_whitelist: hubConfig.admin_ip_whitelist
          ? hubConfig.admin_ip_whitelist.split(',').map(s => s.trim()).filter(Boolean)
          : [],
        session_timeout: Number(hubConfig.session_timeout) || 120,
        telegram_bot_token: hubConfig.telegram_bot_token,
        telegram_chat_id: hubConfig.telegram_chat_id,
        telegram_alerts: hubConfig.telegram_alerts,
        telegram_login_auth: hubConfig.telegram_login_auth,
        telegram_2fa_approval: hubConfig.telegram_2fa_approval,
        admin_geo_whitelist: hubConfig.admin_geo_whitelist
      });
      notify('Settings saved successfully.', { type: 'success' });
    } catch (err) {
      notify('Failed to save settings.', { type: 'error' });
    } finally {
      setSaving(false);
    }
  };


  const generateRandomPath = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 12; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    setHubConfig({ ...hubConfig, login_path: result });
  };

  const handleSetup2FA = async () => {
    setTwofaLoading(true);
    try {
      const data = await API.setup2FA();
      setTwofaSetup(data);
      const qr = await QRCode.toDataURL(data.uri);
      setTwofaQr(qr);
    } catch (err) {
      notify('Failed to setup 2FA', { type: 'error' });
    } finally {
      setTwofaLoading(false);
    }
  };

  const handleTestTelegram = async () => {
    if (!hubConfig.telegram_bot_token || !hubConfig.telegram_chat_id) {
        notify('Please enter both Bot Token and Chat ID first.', { type: 'warning' });
        return;
    }
    try {
        await API.updateHubConfig({
            telegram_bot_token: hubConfig.telegram_bot_token,
            telegram_chat_id: hubConfig.telegram_chat_id
        });
        const res = await API.testTelegram();
        if (res.status === 'success') {
            notify('Test message sent! Check your Telegram.', { type: 'success' });
        } else {
            throw new Error(res.detail || 'Test failed');
        }
    } catch (err) {
        notify('Telegram Test Failed: Check your Token/ChatID and try again.', { type: 'error' });
    }
  };

  const handleEnable2FA = async () => {
    if (!twofaCode) return;
    setTwofaLoading(true);
    try {
      const data = await API.enable2FA(twofaCode, twofaSetup.secret);
      setTwofaRecoveryCodes(data.recovery_codes);
      notify('2FA enabled successfully', { type: 'success' });
      setCurrentUser(prev => ({ ...prev, totp_enabled: true }));
      setTwofaSetup(null);
      setTwofaQr('');
      setTwofaCode('');
    } catch (err) {
      notify(err.response?.data?.detail || 'Invalid code', { type: 'error' });
    } finally {
      setTwofaLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    const approved = await confirm({
      title: 'Disable 2FA?',
      message: 'This reduces security. Are you sure?',
      danger: true
    });
    if (!approved) return;
    setTwofaLoading(true);
    try {
      await API.disable2FA();
      notify('2FA disabled.', { type: 'success' });
      setCurrentUser(prev => ({ ...prev, totp_enabled: false }));
    } catch (err) {
      notify('Failed to disable 2FA', { type: 'error' });
    } finally {
      setTwofaLoading(false);
    }
  };

  const handleRegisterPasskey = async () => {
    if (!window.isSecureContext || !navigator.credentials) {
      notify('Passkeys require a secure connection (HTTPS). Please setup SSL for your domain.', { type: 'error', duration: 5000 });
      return;
    }
    try {
      const options = await API.webauthnRegisterOptions();
      // Minimal manual WebAuthn handling
      options.challenge = base64URLToBuffer(options.challenge);
      options.user.id = new TextEncoder().encode(options.user.id);
      
      const credential = await navigator.credentials.create({ publicKey: options });
      
      const response = {
        id: credential.id,
        rawId: bufferToBase64URLString(credential.rawId),
        type: credential.type,
        response: {
          attestationObject: bufferToBase64URLString(credential.response.attestationObject),
          clientDataJSON: bufferToBase64URLString(credential.response.clientDataJSON),
        },
      };

      await API.webauthnRegisterVerify(response);
      notify('Passkey registered successfully!', { type: 'success' });
      fetchData();
    } catch (err) {
      notify(err.message || 'Passkey registration failed', { type: 'error' });
    }
  };

  const handleDeletePasskey = async (cred_id) => {
    const approved = await confirm({ title: 'Delete Passkey?', message: 'This device will no longer be able to login via Passkey.', danger: true });
    if (!approved) return;
    try {
        await API.deletePasskey(cred_id);
        setPasskeys(prev => prev.filter(c => c.credential_id !== cred_id));
        notify('Passkey removed.', { type: 'success' });
    } catch (err) { 
        notify('Failed to delete passkey', { type: 'error' }); 
    }
  };

  const handleRevokeSession = async (sid) => {
    try {
        await API.revokeSession(sid);
        setActiveSessions(prev => prev.filter(s => s.sid !== sid));
        notify('Session revoked.', { type: 'success' });
    } catch (err) {
        notify(err.response?.data?.detail || 'Failed to revoke session', { type: 'error' });
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

  const navItems = [
    { key: SECTION.PROFILE, label: 'Admin Profile', icon: User },
    { key: SECTION.ENTRY, label: 'Entry Point', icon: Key },
    { key: SECTION.NETWORK, label: 'Network Security', icon: Shield },
    { key: SECTION.TWOFA, label: '2FA Auth', icon: Fingerprint },
    { key: SECTION.PASSKEYS, label: 'Passkeys', icon: Smartphone },
    { key: SECTION.TELEGRAM, label: 'Telegram Security', icon: Send },
  ];

  const renderContent = () => {
    if (activeTab === SECTION.PROFILE) {
        return (
            <div className="admin-settings-panel animate-fade-slide">
                <div className="settings-group">
                    <label><User size={14} /> Admin Username</label>
                    <div className="input-group">
                        <input 
                            className="input-field" 
                            value={newUsername} 
                            onChange={e => setNewUsername(e.target.value)} 
                        />
                        <button className="btn btn-secondary" onClick={handleUpdateProfile} disabled={saving}>Update</button>
                    </div>
                </div>
                <div className="settings-divider" />
                <div className="settings-group">
                    <label><Lock size={14} /> Password Rotation</label>
                    <input 
                        className="input-field" 
                        type="password" 
                        placeholder="Current Password" 
                        value={currentPassword}
                        onChange={e => setCurrentPassword(e.target.value)}
                        style={{ marginBottom: '12px' }}
                    />
                    <div className="input-group">
                        <input 
                            className="input-field" 
                            type="password" 
                            placeholder="New Password" 
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                        />
                        <button className="btn btn-secondary" onClick={handleUpdatePassword} disabled={saving}>Change</button>
                    </div>
                </div>
            </div>
        );
    }

    if (activeTab === SECTION.ENTRY) {
        return (
            <div className="admin-settings-panel animate-fade-slide">
                <div className="settings-group">
                    <label>Login Path Obfuscation</label>
                    <p className="settings-desc">Keep your entry point secret. Type any path you like (e.g. "secret-door" or "admin/login"). Unauthorized access to any other path will return a 404.</p>
                    <div className="input-group">
                        <input 
                            className="input-field" 
                            placeholder="e.g. my-secret-path"
                            value={hubConfig.login_path} 
                            onChange={e => setHubConfig({...hubConfig, login_path: e.target.value})}
                        />
                        <button className="btn btn-secondary" title="Randomize" onClick={generateRandomPath}>
                            <Wand2 size={16} />
                        </button>
                        <button className="btn btn-secondary" title="Reset to Default" onClick={() => setHubConfig({...hubConfig, login_path: 'login'})}>
                            <RefreshCw size={16} />
                        </button>
                    </div>
                    <div className="login-preview-card">
                       <span className="preview-label">Live Login URL:</span>
                       <code className="preview-url">
                          {window.location.protocol}//{window.location.host}/<span className="accent">{hubConfig.login_path || 'login'}</span>
                       </code>
                    </div>
                </div>
                <div className="admin-actions-footer">
                   <button className="btn btn-primary" onClick={handleSaveConfig} disabled={saving}>
                      <Save size={16} /> Save Admin Settings
                   </button>
                </div>
            </div>
        );
    }

    if (activeTab === SECTION.NETWORK) {
        return (
            <div className="admin-settings-panel animate-fade-slide">
                <div className="settings-group">
                    <label><Globe size={14} /> Admin IP Whitelist</label>
                    <p className="settings-desc">Restricts access to specific IPs or networks. Supports CIDR ranges (e.g. 1.1.1.1/24).</p>
                    
                    <div className="tag-input-container">
                        <div className="tag-list">
                            {(hubConfig.admin_ip_whitelist || '').split(',').map(s => s.trim()).filter(Boolean).map(ip => (
                                <div key={ip} className="tag-item">
                                    <span>{ip}</span>
                                    <button onClick={() => {
                                        const next = hubConfig.admin_ip_whitelist.split(',').map(s => s.trim()).filter(x => x !== ip).join(', ');
                                        setHubConfig({...hubConfig, admin_ip_whitelist: next});
                                    }}><RefreshCw size={10} /></button>
                                </div>
                            ))}
                        </div>
                        <div className="input-group">
                            <input 
                                className="input-field" 
                                placeholder="Add IP or CIDR (e.g. 12.34.56.78/24)"
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && e.target.value.trim()) {
                                        const val = e.target.value.trim();
                                        const current = hubConfig.admin_ip_whitelist ? hubConfig.admin_ip_whitelist + ', ' : '';
                                        setHubConfig({...hubConfig, admin_ip_whitelist: current + val});
                                        e.target.value = '';
                                    }
                                }}
                            />
                        </div>
                    </div>

                    <div className="warning-note-box">
                       <AlertTriangle size={16} />
                       <span>CAUTION: Whitelisting incorrectly can lock you out. Ensure your current IP is included.</span>
                    </div>
                </div>

                <div className="settings-divider" />
                
                <div className="settings-group">
                    <label><MapPin size={14} /> Admin Geo-Fencing</label>
                    <p className="settings-desc">Only allow logins from specific countries. Leave empty to allow all.</p>
                    
                    <div className="tag-input-container">
                        <div className="tag-list">
                            {hubConfig.admin_geo_whitelist.map(code => {
                                const country = COMMON_COUNTRIES.find(c => c.code === code);
                                return (
                                    <div key={code} className="tag-item geo">
                                        <span>{country ? country.name : code}</span>
                                        <button onClick={() => {
                                            const next = hubConfig.admin_geo_whitelist.filter(x => x !== code);
                                            setHubConfig({...hubConfig, admin_geo_whitelist: next});
                                        }}><RefreshCw size={10} /></button>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="input-group">
                            <select 
                                className="input-field"
                                value=""
                                onChange={e => {
                                    if (e.target.value && !hubConfig.admin_geo_whitelist.includes(e.target.value)) {
                                        setHubConfig({
                                            ...hubConfig, 
                                            admin_geo_whitelist: [...hubConfig.admin_geo_whitelist, e.target.value]
                                        });
                                    }
                                }}
                            >
                                <option value="">Select a country to add...</option>
                                {COMMON_COUNTRIES
                                  .filter(c => !hubConfig.admin_geo_whitelist.includes(c.code))
                                  .map(c => <option key={c.code} value={c.code}>{c.name} ({c.code})</option>)
                                }
                            </select>
                        </div>
                    </div>
                </div>

                <div className="settings-divider" />
                
                <div className="settings-group">
                    <label><Clock size={14} /> Session Timeout (Minutes)</label>
                    <input 
                        className="input-field" 
                        type="number"
                        value={hubConfig.session_timeout}
                        onChange={e => setHubConfig({...hubConfig, session_timeout: e.target.value})}
                        style={{ width: '120px' }}
                    />
                </div>
                
                <div className="admin-actions-footer">
                   <button className="btn btn-primary" onClick={handleSaveConfig} disabled={saving}>
                      <Save size={16} /> Save Network Settings
                   </button>
                </div>
            </div>
        );
    }

    if (activeTab === SECTION.TWOFA) {
        return (
            <div className="admin-settings-panel animate-fade-slide">
                <div className="twofa-status-card">
                    <div className={`status-icon ${currentUser?.totp_enabled ? 'enabled' : ''}`}>
                        <Fingerprint size={32} />
                    </div>
                    <div className="status-info">
                        <h3>Two-Factor Authentication</h3>
                        <p>{currentUser?.totp_enabled ? 'Your account is protected with 2FA.' : 'Add an extra layer of security to your account.'}</p>
                    </div>
                    {currentUser?.totp_enabled ? (
                        <button className="btn btn-danger-ghost" onClick={handleDisable2FA} disabled={twofaLoading}>Disable 2FA</button>
                    ) : !twofaSetup ? (
                        <button className="btn btn-primary" onClick={handleSetup2FA} disabled={twofaLoading}>Setup 2FA</button>
                    ) : null}
                </div>

                <Modal
                    isOpen={!!twofaSetup}
                    onClose={() => { setTwofaSetup(null); setTwofaQr(''); setTwofaCode(''); }}
                    title="Two-Factor Setup"
                >
                    <div className="twofa-modal-body">
                        <div className="qr-container">
                            <img src={twofaQr} alt="2FA QR" className="qr-code" />
                        </div>
                        <div className="qr-instructions">
                            <p>1. Scan this QR code with your Authenticator app (e.g., Google Authenticator, Authy).</p>
                            <p>2. Enter the 6-digit verification code below to confirm.</p>
                            <div className="twofa-verify-form">
                                <input 
                                    className="input-field" 
                                    placeholder="000000" 
                                    maxLength={6}
                                    value={twofaCode}
                                    onChange={e => setTwofaCode(e.target.value)}
                                    autoFocus
                                />
                                <button className="btn btn-primary w-full" onClick={handleEnable2FA} disabled={twofaLoading || !twofaCode}>
                                    {twofaLoading ? <RefreshCw className="spin" size={16} /> : <CheckCircle2 size={16} />}
                                    <span>Verify & Enable</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </Modal>

                <Modal
                    isOpen={!!twofaRecoveryCodes}
                    onClose={() => setTwofaRecoveryCodes(null)}
                    title="2FA Recovery Codes"
                >
                    <div className="recovery-codes-modal">
                        <div className="security-notice">
                            <AlertCircle size={20} />
                            <span>Save these codes in a safe place. They allow you to login if you lose access to your Authenticator app. Each code can be used once.</span>
                        </div>
                        <div className="codes-grid">
                            {twofaRecoveryCodes?.map(code => (
                                <div key={code} className="recovery-code mono">
                                    {code}
                                </div>
                            ))}
                        </div>
                        <button className="btn btn-secondary w-full" style={{ marginTop: '20px' }} onClick={() => {
                            navigator.clipboard.writeText(twofaRecoveryCodes.join('\n'));
                            notify('Codes copied to clipboard.', { type: 'success' });
                        }}>
                            <Copy size={16} /> Copy All Codes
                        </button>
                    </div>
                </Modal>
            </div>
        );
    }

    if (activeTab === SECTION.PASSKEYS) {
        return (
            <div className="admin-settings-panel animate-fade-slide">
                <div className="passkeys-header">
                    <div className="header-info">
                        <h3>Passkeys (WebAuthn)</h3>
                        <p>Login securely using your fingerprint, FaceID, or hardware security keys (e.g. YubiKey).</p>
                    </div>
                    <button className="btn btn-primary" onClick={handleRegisterPasskey}>
                        <Plus size={16} /> Add New Passkey
                    </button>
                </div>
                
                <div className="passkeys-list">
                    {passkeys.length === 0 ? (
                        <div className="empty-passkeys">
                            <Smartphone size={32} />
                            <p>No passkeys registered yet.</p>
                        </div>
                    ) : (
                        passkeys.map((pk, idx) => (
                            <div key={idx} className="passkey-item">
                                <div className="pk-icon"><Smartphone size={20} /></div>
                                <div className="pk-meta">
                                    <span className="pk-name">Security Key #{idx + 1}</span>
                                    <span className="pk-date">
                                        Logins: {pk.login_count ?? 0} • {pk.last_used_at ? `Last used: ${new Date(pk.last_used_at).toLocaleDateString()}` : `Added on: ${new Date(pk.created_at || Date.now()).toLocaleDateString()}`}
                                    </span>
                                </div>
                                <button className="btn btn-danger-ghost btn-icon-only" onClick={() => handleDeletePasskey(pk.credential_id)}>
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        );
    }


    if (activeTab === SECTION.TELEGRAM) {
        return (
            <div className="admin-settings-panel animate-fade-slide">
                <div className="settings-group">
                    <label><Send size={14} /> Bot Integration</label>
                    <p className="settings-desc">Connect your Hub to a Telegram bot for real-time security alerts.</p>
                    <div className="input-group">
                        <input 
                            className="input-field mono-font" 
                            placeholder="Bot API Token (123456789:ABC...)"
                            type="password"
                            value={hubConfig.telegram_bot_token}
                            onChange={e => setHubConfig({...hubConfig, telegram_bot_token: e.target.value})}
                        />
                    </div>
                    <div className="input-group" style={{ marginTop: '12px' }}>
                        <input 
                            className="input-field mono-font" 
                            placeholder="Admin Chat ID (987654321)"
                            value={hubConfig.telegram_chat_id}
                            onChange={e => setHubConfig({...hubConfig, telegram_chat_id: e.target.value})}
                        />
                        <button className="btn btn-secondary" onClick={handleTestTelegram}>
                            <Zap size={16} /> Test Bot
                        </button>
                    </div>
                </div>

                <div className="settings-divider" />
                <label className="section-label">Authentication Governance</label>
                <div className="alert-toggles">
                    <div className="alert-toggle-item" onClick={() => setHubConfig({...hubConfig, telegram_login_auth: !hubConfig.telegram_login_auth})}>
                        <div className={`toggle-box ${hubConfig.telegram_login_auth ? 'active' : ''}`}>
                            {hubConfig.telegram_login_auth && <CheckCircle2 size={12} strokeWidth={3} />}
                        </div>
                        <span className="toggle-label primary">TELEGRAM PASSWORDLESS LOGIN</span>
                        <p className="settings-desc" style={{ marginTop: '4px', marginLeft: '28px' }}>Login with only username + Telegram approval.</p>
                    </div>

                    <div className="alert-toggle-item" onClick={() => setHubConfig({...hubConfig, telegram_2fa_approval: !hubConfig.telegram_2fa_approval})}>
                        <div className={`toggle-box ${hubConfig.telegram_2fa_approval ? 'active' : ''}`}>
                            {hubConfig.telegram_2fa_approval && <CheckCircle2 size={12} strokeWidth={3} />}
                        </div>
                        <span className="toggle-label primary">TELEGRAM 2FA APPROVAL</span>
                        <p className="settings-desc" style={{ marginTop: '4px', marginLeft: '28px' }}>Password then Telegram approval.</p>
                    </div>
                </div>

                <div className="settings-divider" />
                <label className="section-label">Automated System Alerts</label>
                <div className="alert-toggles grid-2">
                    {Object.entries(hubConfig.telegram_alerts).map(([key, value]) => (
                        <div key={key} className="alert-toggle-item" onClick={() => {
                            const next = {...hubConfig.telegram_alerts, [key]: !value};
                            setHubConfig({...hubConfig, telegram_alerts: next});
                        }}>
                            <div className={`toggle-box ${value ? 'active' : ''}`}>
                                {value && <CheckCircle2 size={12} strokeWidth={3} />}
                            </div>
                            <span className="toggle-label">{key.replace('_', ' ').toUpperCase()}</span>
                        </div>
                    ))}
                </div>

                <div className="admin-actions-footer">
                   <button className="btn btn-primary" onClick={handleSaveConfig} disabled={saving}>
                      <Save size={16} /> Save Security Settings
                   </button>
                </div>
            </div>
        );
    }
  };

  return (
    <div className="page-shell animate-fade-slide">
        <div className="page-topline">Admin</div>

        <div className="page-card">
            <div className="page-card-header">
                <div>
                    <h1 className="page-card-title">Admin Settings</h1>
                    <p className="page-card-desc">Secure your dashboard and configure administrative notifications.</p>
                </div>
            </div>

            <div className="admin-layout">
                <aside className="admin-sidebar">
                    {navItems.map(item => {
                        const Icon = item.icon;
                        return (
                            <button 
                                key={item.key} 
                                className={`admin-nav-item ${activeTab === item.key ? 'active' : ''}`}
                                onClick={() => setActiveTab(item.key)}
                            >
                                <Icon size={18} />
                                <span>{item.label}</span>
                            </button>
                        );
                    })}
                </aside>
                <main className="admin-main">
                    {renderContent()}
                </main>
            </div>
        </div>

      <style jsx>{`
            .admin-layout {
                display: flex;
                gap: 24px;
                min-height: 500px;
                padding: 0 20px 20px;
            }
            .admin-sidebar {
                width: 240px;
                display: flex;
                flex-direction: column;
                gap: 4px;
                flex-shrink: 0;
            }
            .admin-nav-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 16px;
                border-radius: 10px;
                background: transparent;
                color: #fff;
                transition: all 0.2s;
                font-weight: 500;
                text-align: left;
                border: 1px solid rgba(255,255,255,0.8);
                margin-bottom: 8px;
                opacity: 0.8;
            }
            .admin-nav-item:hover {
                background: rgba(255,255,255,0.1);
                border-color: #fff;
                opacity: 1;
            }
            .admin-nav-item.active {
                background: #fff;
                color: #000;
                border-color: #fff;
                font-weight: 700;
                opacity: 1;
                box-shadow: 0 4px 12px rgba(255,255,255,0.2);
            }
            [data-theme='light'] .admin-nav-item {
                color: #171717;
                border-color: #e5e5e5;
            }
            [data-theme='light'] .admin-nav-item.active {
                background: #000;
                color: #fff;
                border-color: #000;
            }
            .admin-main {
                flex: 1;
                position: relative;
                min-width: 0;
            }
            .settings-group {
                margin-bottom: 24px;
            }
            .settings-group label {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 0.85rem;
                font-weight: 600;
                color: var(--text-primary);
                margin-bottom: 8px;
            }
            .settings-desc {
                font-size: 0.8rem;
                color: var(--text-secondary);
                margin-bottom: 12px;
            }
            .input-group {
                display: flex;
                gap: 8px;
            }
            .settings-divider {
                height: 1px;
                background: var(--border-color);
                margin: 24px 0;
                opacity: 0.5;
            }
            .warning-note-box {
                font-size: 0.8rem;
                color: #ef4444;
                margin-top: 12px;
                line-height: 1.4;
                display: flex;
                gap: 10px;
                align-items: center;
                padding: 12px;
                background: rgba(239, 68, 68, 0.05);
                border-radius: 8px;
                border: 1px solid rgba(239, 68, 68, 0.1);
            }
            .login-preview-card {
                margin-top: 16px;
                padding: 16px;
                background: rgba(255,255,255,0.02);
                border-radius: 12px;
                border: 1px dashed var(--border-color);
            }
            .preview-label { font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 6px; }
            .preview-url { font-size: 0.9rem; color: var(--text-secondary); word-break: break-all; }
            .preview-url .accent { color: var(--accent-primary); font-weight: 700; }
            
            .twofa-modal-body { display: flex; flex-direction: column; gap: 24px; padding: 10px 0; }
            .qr-container { display: flex; justify-content: center; background: #fff; padding: 16px; border-radius: 12px; width: fit-content; margin: 0 auto; }
            .twofa-verify-form { display: grid; gap: 12px; margin-top: 20px; }
            .w-full { width: 100%; }
            
            .admin-actions-footer {
                margin-top: 32px;
                padding-top: 24px;
                border-top: 1px solid var(--border-color);
                display: flex;
                justify-content: flex-end;
            }
            
            .twofa-status-card {
                display: flex;
                align-items: center;
                gap: 20px;
                padding: 24px;
                background: rgba(255,255,255,0.02);
                border-radius: 16px;
                border: 1px solid var(--border-color);
                width: fit-content;
                min-width: 450px;
            }
            .status-icon {
                width: 60px;
                height: 60px;
                border-radius: 15px;
                background: rgba(255,255,255,0.05);
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--text-secondary);
            }
            .status-icon.enabled {
                color: #22c55e;
                background: rgba(34, 197, 94, 0.1);
            }
            .status-info h3 { font-size: 1.1rem; margin-bottom: 4px; }
            .status-info p { font-size: 0.85rem; color: var(--text-secondary); }
            
            .twofa-setup-flow {
                margin-top: 24px;
                padding-top: 24px;
                border-top: 1px solid var(--border-color);
            }
            .qr-section {
                display: flex;
                gap: 24px;
                align-items: center;
            }
            .qr-code {
                width: 160px;
                height: 160px;
                padding: 8px;
                background: #fff;
                border-radius: 8px;
            }
            .qr-instructions {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            .qr-instructions p { font-size: 0.9rem; color: var(--text-secondary); }

            .section-label {
                font-size: 0.75rem;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 1px;
                color: var(--text-secondary);
                margin-bottom: 16px;
                display: block;
            }
            .alert-toggles {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 12px;
                margin-bottom: 40px;
            }
            .alert-toggle-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px;
                background: rgba(255,255,255,0.02);
                border: 1px solid var(--border-color);
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s;
            }
            .alert-toggle-item:hover {
                background: rgba(255,255,255,0.04);
            }
            .toggle-box {
                width: 20px;
                height: 20px;
                border-radius: 4px;
                border: 2px solid var(--border-color);
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
            }
            .toggle-box.active {
                background: var(--accent-primary);
                border-color: var(--accent-primary);
                color: var(--accent-text);
            }
            .toggle-label {
                font-size: 0.85rem;
                font-weight: 500;
                color: var(--text-primary);
            }

            .w-full { width: 100%; }

            .recovery-codes-modal { padding: 10px 0; }
            .security-notice {
                display: flex;
                gap: 12px;
                padding: 16px;
                background: rgba(245, 158, 11, 0.1);
                border: 1px solid rgba(245, 158, 11, 0.2);
                border-radius: 12px;
                color: #f59e0b;
                font-size: 0.85rem;
                margin-bottom: 24px;
                line-height: 1.5;
            }
            .codes-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 10px;
            }
            .recovery-code {
                padding: 12px;
                background: rgba(255,255,255,0.03);
                border: 1px solid var(--border-color);
                border-radius: 8px;
                text-align: center;
                letter-spacing: 2px;
                font-weight: 700;
                font-size: 1.1rem;
            }

            .passkeys-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 24px;
                padding-bottom: 20px;
                border-bottom: 1px solid var(--border-color);
            }
            .header-info h3 { font-size: 1.1rem; margin-bottom: 4px; }
            .header-info p { font-size: 0.85rem; color: var(--text-secondary); }
            
            .passkeys-list { display: grid; gap: 12px; }
            .passkey-item {
                display: flex;
                align-items: center;
                gap: 16px;
                padding: 16px;
                background: rgba(255,255,255,0.02);
                border: 1px solid var(--border-color);
                border-radius: 12px;
            }
            .pk-icon { width: 40px; height: 40px; border-radius: 10px; background: rgba(255,255,255,0.03); display: flex; align-items: center; justify-content: center; color: var(--text-secondary); }
            .pk-meta { flex: 1; display: flex; flex-direction: column; gap: 2px; }
            .pk-name { font-weight: 600; font-size: 0.95rem; }
            .pk-date { font-size: 0.75rem; color: var(--text-muted); }
            
            .empty-passkeys {
                padding: 60px 0;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 16px;
                color: var(--text-muted);
                text-align: center;
            }

            @media (max-width: 900px) {
                .admin-layout { flex-direction: column; }
                .admin-sidebar { width: 100%; flex-direction: row; overflow-x: auto; padding-bottom: 8px; }
                .admin-nav-item { white-space: nowrap; }
                .save-pinned { position: static; margin-top: 24px; width: 100%; }
            }

            .tag-input-container {
                background: rgba(255,255,255,0.01);
                border: 1px solid var(--border-color);
                border-radius: 12px;
                padding: 12px;
                display: flex;
                flex-direction: column;
                gap: 12px;
                margin-bottom: 8px;
            }
            .tag-list {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
            }
            .tag-item {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 6px 12px;
                background: rgba(255,255,255,0.05);
                border: 1px solid var(--border-color);
                border-radius: 8px;
                font-size: 0.8rem;
                font-weight: 500;
            }
            .tag-item.geo {
                background: rgba(59, 130, 246, 0.1);
                border-color: rgba(59, 130, 246, 0.2);
                color: #60a5fa;
            }
            .tag-item button {
                background: transparent;
                border: none;
                color: var(--text-muted);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 2px;
                border-radius: 4px;
            }
            .tag-item button:hover {
                background: rgba(255,255,255,0.1);
                color: #ef4444;
            }

            .unlock-modal-body,
            .unlock-header,
            .unlock-icon-box,
            .unlock-content h3,
            .unlock-content p,
            .unlock-form {
                display: none;
            }
        `}</style>
    </div>
  );
}
