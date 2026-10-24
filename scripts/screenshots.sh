#!/bin/sh
# Renders the README screenshots with headless Chrome from a running local server (python3 -m http.server 8791).
# Each URL fast-forwards a fresh demo to a story step (?story=N) and opens a tab (&tab=...).
set -e
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
BASE="${BASE:-http://127.0.0.1:8791}"
OUT="$(cd "$(dirname "$0")/.." && pwd)/docs/img"
mkdir -p "$OUT"
shot() { # name  url  [height]
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --window-size=1280,"${3:-860}" --screenshot="$OUT/$1.png" "$BASE/$2" >/dev/null 2>&1
  echo "wrote $OUT/$1.png"
}
shot inbox    "?story=0&tab=inbox&bare=1"
shot deck     "?story=2&tab=deck&bare=1" 980
shot matches  "?story=3&tab=matches&bare=1" 900
shot letter   "?story=4&tab=outbox&bare=1" 900
shot market   "?story=7&tab=market&bare=1" 900
shot ledger   "?story=13&tab=ledger&bare=1" 980
shot story    "?story=8&tab=ledger" 700
