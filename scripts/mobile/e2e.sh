#!/usr/bin/env bash
# Runs the offline-first Maestro flow against the ephemeral test container.
# Usage: ANDROID_SERIAL=emulator-5554 scripts/mobile/e2e.sh
# Never touches the stable container (port 3993): only manga-reader-monorepo-test.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NAME=manga-reader-monorepo-test
IMAGE=manga-reader:monorepo-test
PORT=3994
CONTROL_PORT=3995
SERVER_ID_DIR=/mnt/d/manga-reader-tests/server-id
REPORT_DIR=${REPORT_DIR:-/mnt/d/manga-reader-tests/M4-19}
export PATH="$PATH:$HOME/.maestro/bin:$HOME/Android/Sdk/platform-tools"

CONTROL_PID=""
cleanup() {
  [ -n "$CONTROL_PID" ] && kill "$CONTROL_PID" 2>/dev/null || true
  docker stop "$NAME" >/dev/null 2>&1 || true
  docker rm "$NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

[ -d "$SERVER_ID_DIR" ] || { echo "missing $SERVER_ID_DIR (keeps the test serverId stable)" >&2; exit 1; }
docker image inspect "$IMAGE" >/dev/null 2>&1 || docker build -t "$IMAGE" "$ROOT"

# Optional: install the APK first (APK=/path/app.apk).
if [ -n "${APK:-}" ]; then adb ${ANDROID_SERIAL:+-s "$ANDROID_SERIAL"} install -r "$APK"; fi

docker rm "$NAME" >/dev/null 2>&1 || true
start_server() {
  docker start "$NAME" >/dev/null 2>&1 || docker run -d --name "$NAME" -p "$PORT:3993" \
    -v /mnt/d/manga:/mnt/d/manga:ro -v /mnt/d/manga-xl:/mnt/d/manga-xl:ro \
    -v "$SERVER_ID_DIR:/var/lib/manga-test" \
    -e SERVER_ID_PATH=/var/lib/manga-test/.server-id "$IMAGE" >/dev/null
  for _ in $(seq 1 60); do
    curl -fs "http://localhost:$PORT/api/health" >/dev/null && return 0
    sleep 1
  done
  echo "test server did not become healthy" >&2; return 1
}
start_server

# Maestro's JS sandbox cannot run shell, so the flow asks this tiny HTTP server
# (localhost only, two fixed actions on the test container) to stop/start it.
export NAME PORT CONTROL_PORT
python3 - >/dev/null 2>&1 <<'PY' &
import http.server, os, subprocess, time, urllib.request
NAME, PORT = os.environ["NAME"], os.environ["PORT"]
def healthy():
    for _ in range(60):
        try:
            urllib.request.urlopen(f"http://localhost:{PORT}/api/health", timeout=2); return True
        except Exception: time.sleep(1)
    return False
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        ok = True
        if self.path == "/stop": subprocess.run(["docker", "stop", NAME], check=False)
        elif self.path == "/start":
            subprocess.run(["docker", "start", NAME], check=False); ok = healthy()
        else: ok = False
        self.send_response(200 if ok else 400); self.end_headers(); self.wfile.write(b"ok" if ok else b"no")
    def log_message(self, *a): pass
http.server.HTTPServer(("127.0.0.1", int(os.environ["CONTROL_PORT"])), H).serve_forever()
PY
CONTROL_PID=$!
sleep 1

mkdir -p "$REPORT_DIR"
cd "$ROOT"
maestro ${ANDROID_SERIAL:+--device "$ANDROID_SERIAL"} test \
  --format junit --output "$REPORT_DIR/report-${ANDROID_SERIAL:-device}.xml" \
  -e CONTROL_PORT="$CONTROL_PORT" \
  apps/mobile/.maestro/offline-first.yaml
