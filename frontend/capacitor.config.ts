import { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.rescueiq.app',
  appName: 'RescueIQ',
  webDir: 'dist',

  server: {
    // Allow cleartext HTTP — required to call the local FastAPI backend
    androidScheme: 'http',
    cleartext: true,
    // Allow navigation to any IP (covers all LAN ranges + localhost)
    allowNavigation: ['*'],
  },

  android: {
    // Allow mixed HTTP/HTTPS content inside the WebView
    allowMixedContent: true,
    // Use the existing res/xml/network_security_config.xml if present
    // Gradle plugin picks this up automatically
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#0a0f1e',
      showSpinner: false,
    },
  },
}

export default config
