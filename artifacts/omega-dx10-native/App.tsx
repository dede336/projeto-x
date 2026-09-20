import React from 'react';
import {
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/context/AuthContext';
import { LanguageProvider } from '@/context/LanguageContext';
import LanguageSelectNative from '@/screens/LanguageSelectNative';
import LoginNative from '@/screens/LoginNative';

const Stack = createNativeStackNavigator();

function GamePlaceholder() {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.title}>LOGIN CONCLUÍDO</Text>
      <Text style={styles.text}>
        O aplicativo conectou ao servidor.
      </Text>
      <Text style={styles.text}>
        Próxima etapa: migrar a introdução e o jogo.
      </Text>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <AuthProvider>
          <StatusBar
            barStyle="light-content"
            backgroundColor="#0a0a0f"
          />

          <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
              <Stack.Screen
                name="LanguageSelect"
                component={LanguageSelectNative}
              />
              <Stack.Screen
                name="Login"
                component={LoginNative}
              />
              <Stack.Screen
                name="Game"
                component={GamePlaceholder}
              />
            </Stack.Navigator>
          </NavigationContainer>
        </AuthProvider>
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
    color: '#22c55e',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
  },
  text: {
    color: '#ffffff',
    fontSize: 16,
    textAlign: 'center',
  },
})});