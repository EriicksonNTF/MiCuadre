# iOS Configuration — Remote URL Loading

## What was done
- Installed Capacitor 7.x packages (`@capacitor/core`, `@capacitor/ios`, `@capacitor/cli` + 6 plugins)
- Created `capacitor.config.json` with `server.url` pointing to `https://micuadre-five.vercel.app`
- Initialized iOS native project via `npx cap add ios`
- Synced plugins with `npx cap sync ios`

## How to open and run in Xcode
```bash
# Set Xcode path (required for this machine)
export DEVELOPER_DIR=/Users/papolo/Downloads/Xcode.app/Contents/Developer

# Open Xcode project
npx cap open ios
```

### In Xcode:
1. Select the `App` target
2. Go to **Signing & Capabilities**
3. Select your **Team** (Apple Developer account)
4. Choose a simulator or connected device
5. Press **Run** (Cmd+R)

## What the app does
- The WKWebView loads `https://micuadre-five.vercel.app` directly
- Supabase auth works via the `micuadre://` custom scheme (configured in `allowNavigation`)
- 6 plugins available: App, Camera, Haptics, Network, SplashScreen, StatusBar

## Things to verify
- [ ] CORS: the domain returns `access-control-allow-origin: *` ✓
- [ ] Info.plist permissions: camera, microphone, location if used
- [ ] Service worker offline behavior (the remote domain serves SW)
- [ ] Auth redirects work with `micuadre://` scheme

## To switch to local loading (offline)
1. Build the Next.js app: `pnpm build`
2. Export static files (if supported): requires `output: "export"` in Next config
3. Copy to iOS: `npx cap copy ios`
4. Remove `server.url` from `capacitor.config.json`
5. Run `npx cap sync ios`
