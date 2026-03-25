export default {
  expo: {
    name: 'MezaOC',
    slug: 'fire-inspection-reporting',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/fire-icon.png',
    scheme: 'MezaOC',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.mezaoc.fireinspectionreporting',
      buildNumber: '1',
      infoPlist: {
        NSCameraUsageDescription: 'Allow camera access so you can take photos and attach them to inspection reports.',
        NSPhotoLibraryUsageDescription: 'Allow access to your photo library so you can attach photos to inspection reports.',
        NSPhotoLibraryAddUsageDescription: 'Allow saving exported report photos and PDFs to your photo library.',
      },
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
    },
    web: {
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/images/fire-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#ffffff',
          dark: {
            backgroundColor: '#000000',
          },
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      API_URL: process.env.API_URL || process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:8000',
      eas: {
        projectId: '9ce247a5-0fb4-42a2-9d2c-7e8337207651',
      },
    },
  },
};
