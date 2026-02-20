# Health check – SECURITY ERROR

Health check failed: **SECURITY ERROR**: Gateway URL `ws://192.99.69.127:18789` uses plaintext `ws://` to a non-loopback address. Both credentials and chat data would be exposed to network interception.

- **Source:** local LAN `192.99.69.127`
- **Config:** `/home/ubuntu/.openclaw/openclaw.json`

**Fix:** Use `wss://` for the gateway URL, or connect via SSH tunnel to localhost.
