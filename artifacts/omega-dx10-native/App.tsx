import React from 'react';
import {
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  NavigationContainer,
} from '@react-navigation/native';
import {
  createNativeStackNavigator,
} from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LanguageProvider } from '@/context/LanguageContext';
import LanguageSelectNative from '@/screens/LanguageSelectNative';

const Stack = createNativeStackNavigator();

function LoginPlaceholder() {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.title}>OMEGA DX10</Text>
      <Text style={styles.text}>
        Seleção de idioma concluída.
      </Text>
      <Text style={styles.text}>
        Próxima etapa: migrar o login.
      </Text>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <StatusBar barStyle="light-content" backgroundColor="#0a0a0f" />

        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen
              name="LanguageSelect"
              component={LanguageSelectNative}
            />
            <Stack.Screen
              name="Login"
              component={LoginPlaceholder}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    backgroundColor: '#0a0a0f',
  },
  title: {
    color: '#f97316',
    fontSize: 28,
    fontWeight: '900',
  },
  text: {
    color: '#ffffff',
    fontSize: 16,
    textAlign: 'center',
  },
});