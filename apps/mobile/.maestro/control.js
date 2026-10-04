// Asks the host-side control server (started by scripts/mobile/e2e.sh) to stop
// or start the test container. Maestro's JS sandbox has no shell, only http.
var res = http.get('http://localhost:' + CONTROL_PORT + '/' + ACTION);
if (!res.ok) {
  throw new Error('control server refused ' + ACTION + ': ' + res.status);
}
