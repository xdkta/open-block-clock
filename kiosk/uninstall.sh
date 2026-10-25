#!/usr/bin/env bash
# Removes the Open Block Clock service and autostart entry (leaves the files in place).
set -euo pipefail
sudo systemctl disable --now open-block-clock.service 2>/dev/null || true
sudo rm -f /etc/systemd/system/open-block-clock.service
sudo systemctl daemon-reload
rm -f "${HOME}/.config/autostart/open-block-clock.desktop"
echo "Open Block Clock kiosk removed."
