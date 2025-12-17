import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';
import { allowedEmails } from '../utils/whitelist';
import { auth } from './(tabs)/config/firebase';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const allowedEmailSet = useMemo(() => {
    return new Set(allowedEmails.map((email) => email.toLowerCase()));
  }, []);

  useEffect(() => {
    let isMounted = true;

    // Firebase auth state listener
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (isMounted) {
        setUser(firebaseUser ?? null);
        setAuthLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const handleRestrictedLogout = async () => {
    setAuthLoading(true);
    try {
      await signOut(auth);
      setUser(null);
    } catch (signOutError) {
      console.error('[RootLayout] Unexpected sign-out error:', signOutError);
    } finally {
      setAuthLoading(false);
    }
  };

  const userEmail = (user as any)?.email || '';
  const normalizedEmail = userEmail.toLowerCase();
  const isUnauthorized = !!user && !allowedEmailSet.has(normalizedEmail);

  if (!loaded || authLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (isUnauthorized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ fontSize: 20, fontWeight: '600', marginBottom: 8 }}>Access Restricted</Text>
        <Text style={{ textAlign: 'center', color: '#4B5563' }}>
          This test build is invite-only. Please contact the administrator for access.
        </Text>
        <TouchableOpacity
          onPress={handleRestrictedLogout}
          style={{ marginTop: 24, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, backgroundColor: '#2563eb' }}
        >
          <Text style={{ color: 'white', fontWeight: '600' }}>Back to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
