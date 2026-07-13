import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { tokenStore } from '@/lib/api';

/** Acilis: SecureStore'da token varsa ana ekrana, yoksa girise. */
export default function Index() {
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    void tokenStore.getAccess().then((token) => setHasSession(Boolean(token)));
  }, []);

  if (hasSession === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <Redirect href={hasSession ? '/ana-sayfa' : '/giris'} />;
}
