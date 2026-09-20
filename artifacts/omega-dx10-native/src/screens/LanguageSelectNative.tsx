import React, { useState } from 'react';
import {
  Image,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLanguage } from '@/context/LanguageContext';
import { Language } from '@/constants/i18n';

const logoSource = require('../assets/images/logo.webp');

const LANGUAGES: { code: Language; flag: any }[] = [
  { code: 'pt', flag: require('../assets/images/flag_pt.webp') },
  { code: 'en', flag: require('../assets/images/flag_en.webp') },
  { code: 'es', flag: require('../assets/images/flag_es.webp') },
];

export default function LanguageSelectNative() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { setLanguage } = useLanguage();
  const [loading, setLoading] = useState(false);

  async function handleSelect(lang: Language) {
    if (loading) return;

    setLoading(true);
    await setLanguage(lang);
    navigation.replace('Login');
  }

  const topPad = Platform.OS === 'web' ? 24 : insets.top + 24;
  const bottomPad = Platform.OS === 'web' ? 24 : insets.bottom + 24;

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: topPad,
          paddingBottom: bottomPad,
        },
      ]}
    >
      <View style={styles.logoArea}>
        <Image source={logoSource} style={styles.logo} resizeMode="contain" />
      </View>

      <View style={styles.flags}>
        {LANGUAGES.map(language => (
          <TouchableOpacity
            key={language.code}
            style={styles.flagButton}
            onPress={() => handleSelect(language.code)}
            activeOpacity={0.75}
            disabled={loading}
          >
            <Image
              source={language.flag}
              style={styles.flagImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 48,
  },
  logoArea: {
    alignItems: 'center',
  },
  logo: {
    width: 200,
    height: 100,
  },
  flags: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagButton: {
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 4,
    },
  },
  flagImage: {
    width: 80,
    height: 50,
  },
});