import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';

const logoSource = require('../assets/images/logo.webp');

type Mode = 'login' | 'register';

export default function LoginNative() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { login, register } = useAuth();

  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Preencha o usuário e a senha.');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'login') {
        await login(username.trim(), password);
      } else {
        await register(
          username.trim(),
          password,
          email.trim() || undefined,
        );
      }

      navigation.replace('Game');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível conectar ao servidor.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 24,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Image
          source={logoSource}
          style={styles.logo}
          resizeMode="contain"
        />

        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[
              styles.modeButton,
              mode === 'login' && styles.modeButtonActive,
            ]}
            onPress={() => {
              setMode('login');
              setError('');
            }}
          >
            <Text
              style={[
                styles.modeText,
                mode === 'login' && styles.modeTextActive,
              ]}
            >
              ENTRAR
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modeButton,
              mode === 'register' && styles.modeButtonActive,
            ]}
            onPress={() => {
              setMode('register');
              setError('');
            }}
          >
            <Text
              style={[
                styles.modeText,
                mode === 'register' && styles.modeTextActive,
              ]}
            >
              CRIAR CONTA
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>USUÁRIO OU E-MAIL</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            style={styles.input}
            placeholder="Digite seu usuário"
            placeholderTextColor="#6b7280"
            autoCapitalize="none"
          />

          {mode === 'register' && (
            <>
              <Text style={styles.label}>E-MAIL (OPCIONAL)</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                style={styles.input}
                placeholder="Digite seu e-mail"
                placeholderTextColor="#6b7280"
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </>
          )}

          <Text style={styles.label}>SENHA</Text>
          <View style={styles.passwordRow}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              style={styles.passwordInput}
              placeholder="Digite sua senha"
              placeholderTextColor="#6b7280"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={styles.showButton}
              onPress={() => setShowPassword(value => !value)}
            >
              <Text style={styles.showText}>
                {showPassword ? 'OCULTAR' : 'MOSTRAR'}
              </Text>
            </TouchableOpacity>
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[
              styles.submitButton,
              loading && styles.disabledButton,
            ]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#0a0a0f" />
            ) : (
              <Text style={styles.submitText}>
                {mode === 'login' ? 'ENTRAR' : 'CRIAR CONTA'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logo: {
    width: 220,
    height: 110,
    alignSelf: 'center',
    marginBottom: 24,
  },
  modeRow: {
    flexDirection: 'row',
    marginBottom: 22,
    borderWidth: 1,
    borderColor: '#2b2b35',
    backgroundColor: '#14141b',
  },
  modeButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
  },
  modeButtonActive: {
    backgroundColor: '#f97316',
  },
  modeText: {
    color: '#9ca3af',
    fontWeight: '900',
  },
  modeTextActive: {
    color: '#0a0a0f',
  },
  form: {
    gap: 10,
  },
  label: {
    color: '#d1d5db',
    fontSize: 12,
    fontWeight: '800',
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#343441',
    backgroundColor: '#181820',
    color: '#ffffff',
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  passwordRow: {
    minHeight: 52,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#343441',
    backgroundColor: '#181820',
  },
  passwordInput: {
    flex: 1,
    color: '#ffffff',
    paddingHorizontal: 14,
  },
  showButton: {
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  showText: {
    color: '#f97316',
    fontSize: 10,
    fontWeight: '900',
  },
  error: {
    color: '#ef4444',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  submitButton: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f97316',
    marginTop: 12,
  },
  disabledButton: {
    opacity: 0.6,
  },
  submitText: {
    color: '#0a0a0f',
    fontSize: 15,
    fontWeight: '900',
  },
});