#!/usr/bin/env bash
# Open Block Clock — Raspberry Pi kiosk installer.
# Tested target: Raspberry Pi OS (Bookworm / Trixie) with desktop, auto-login enabled.
# Run as your normal desktop user:  ./kiosk/install.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${OBC_PORT:-8021}"
USER_NAME="$(id -un)"

if [[ $EUID -eq 0 ]]; then
  echo "Run this as your normal desktop user, not root (sudo is used where needed)." >&2
  exit 1
fi

echo "==> Installing packages"
sudo apt-get update
sudo apt-get install -y python3 curl
if ! command -v chromium >/dev/null && ! command -v chromium-browser >/dev/null; then
  sudo apt-get install -y chromium || sudo apt-get install -y chromium-browser
fi

echo "==> Creating local web server service on 127.0.0.1:${PORT}"
sudo tee /etc/systemd/system/open-block-clock.service >/dev/null <<EOF
[Unit]
Description=Open Block Clock web server
After=network.target

[Service]
User=${USER_NAME}
WorkingDirectory=${APP_DIR}
ExecStart=/usr/bin/python3 -m http.server ${PORT} --bind 127.0.0.1
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now open-block-clock.service

echo "==> Adding desktop autostart entry"
chmod +x "${APP_DIR}/kiosk/launch.sh"
mkdir -p "${HOME}/.config/autostart"
cat > "${HOME}/.config/autostart/open-block-clock.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Open Block Clock
Exec=env OBC_PORT=${PORT} ${APP_DIR}/kiosk/launch.sh
X-GNOME-Autostart-enabled=true
EOF

if command -v raspi-config >/dev/null; then
  echo "==> Disabling screen blanking and enabling desktop auto-login"
  sudo raspi-config nonint do_blanking 1 || true
  sudo raspi-config nonint do_boot_behaviour B4 || true
fi

echo
echo "Done. Reboot to start the kiosk:  sudo reboot"
echo "Preview now from the Pi desktop:   ${APP_DIR}/kiosk/launch.sh"
