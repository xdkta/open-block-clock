#!/usr/bin/env bash
# Opens Open Block Clock full-screen in Chromium kiosk mode.
PORT="${OBC_PORT:-8021}"
URL="http://127.0.0.1:${PORT}/${OBC_QUERY:+?${OBC_QUERY}}"

# Wait (up to 60 s) for the local server to come up.
for _ in $(seq 1 60); do
  curl -fs "http://127.0.0.1:${PORT}/" >/dev/null && break
  sleep 1
done

BROWSER="$(command -v chromium || command -v chromium-browser)"
if [[ -z "$BROWSER" ]]; then
  echo "Chromium not found. Run kiosk/install.sh first." >&2
  exit 1
fi

exec "$BROWSER" \
  --kiosk \
  --incognito \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-features=Translate \
  --no-first-run \
  --password-store=basic \
  --check-for-update-interval=31536000 \
  --ozone-platform-hint=auto \
  "$URL"
