# 🌌 HiVoid Hub

<p align="center">
  <img src="logo/hi-logo-white-transparent.png" alt="Hi Void Logo" width="200" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-v2.0.0--stable-blue.svg" />
  <img src="https://img.shields.io/badge/license-MPL--2.0-green.svg" />
  <img src="https://img.shields.io/badge/platform-linux-blue.svg" />
  <img src="https://img.shields.io/badge/python-3.10+-00ADD8?logo=python" />
  <img src="https://img.shields.io/badge/react-00ADD8?logo=react" />
  <img src="https://img.shields.io/badge/status-stable-blue.svg" />
</p>

Professional Node Management & Subscription Billing Interface.

## ✨ Features (v2.0.0)
- **VoidReach Obfuscation**: Comprehensive UI and API parameters to deploy direct, CDN, fronting, and relay WebSocket configs.
- **Nested Core Configs**: Fully supports nested schema and zero-downtime hot reloads for port and certificate configuration.
- **Advanced User Policies**: Granular concurrent IP limits, bandwidth throttling (KB/s), and strict data limits.
- **Compatibility Sync**: Synchronizes with edge nodes using `is_active` and `expire_at_unix` format options.

## 🚀 One-Line Installation
Run the following curl command as root to automatically download and install the latest release:
```bash
curl -fsSL https://raw.githubusercontent.com/hivoid-org/hivoid-hub/main/install.sh | sudo bash
```


## 🛠 Management Terminal
HiVoid Hub includes a powerful TUI (Terminal User Interface) for system diagnostics and administrative tasks. You can access it from anywhere by typing:
```bash
hihub
```
*Alternatively, use `hivoid-hub` or `HiVoid-hub`.*

## 🔒 Security First
1. Login to the dashboard and navigate to **Settings -> 2FA**.
2. Enable 2FA.
3. You can also enable login via Telegram Bot.

## License

This project is licensed under the **Mozilla Public License 2.0 (MPL-2.0)**.  
See the `LICENSE` file for details.
