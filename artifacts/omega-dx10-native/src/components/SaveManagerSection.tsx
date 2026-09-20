import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  Modal, TextInput, ActivityIndicator, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

export default function SaveManagerSection() {
  const { token, user, getApiUrl } = useAuth();
  const colors = useColors();

  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [importPassword, setImportPassword] = useState('');
  const [pendingExportData, setPendingExportData] = useState<Record<string, unknown> | null>(null);
  const [pendingFilename, setPendingFilename] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ── Export ────────────────────────────────────────────────────────────────
  async function handleExport() {
    if (!token) return;
    setExporting(true);
    try {
      const res = await fetch(`${getApiUrl()}/saves/export`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) { Alert.alert('Erro', data.error ?? 'Erro ao exportar'); return; }

      const { exportData, filename } = data as { exportData: Record<string, unknown>; filename: string };
      const json = JSON.stringify(exportData, null, 2);

      if (Platform.OS === 'web') {
        // Web: trigger browser download
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        Alert.alert('✅ Save Exportado!', `Arquivo "${filename}" baixado com sucesso.`);
      } else {
        // Native: write file then share via React Native Share
        const FileSystem = (await import('expo-file-system')).default as any;
        const { Share } = await import('react-native');
        const path = FileSystem.documentDirectory + filename;
        await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });
        try {
          await Share.share(
            { title: filename, message: json },
            { dialogTitle: 'Salvar arquivo de save' }
          );
        } catch {
          Alert.alert('✅ Exportado!', `Save salvo em:\n${path}`);
        }
      }
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível exportar o save.');
    } finally {
      setExporting(false);
    }
  }

  // ── Import picker ─────────────────────────────────────────────────────────
  async function handlePickImport() {
    if (Platform.OS === 'web') {
      // Web: use hidden file input
      if (!fileInputRef.current) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.omgsave,.json,application/json';
        input.style.display = 'none';
        input.addEventListener('change', async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (!file) return;
          const text = await file.text();
          processImportText(text, file.name);
          document.body.removeChild(input);
          fileInputRef.current = null;
        });
        document.body.appendChild(input);
        fileInputRef.current = input;
        input.click();
      }
    } else {
      // Native: use expo-document-picker
      try {
        const DocumentPicker = await import('expo-document-picker');
          const FileSystem = await import('expo-file-system') as any;
        const result = await DocumentPicker.getDocumentAsync({
          type: ['application/json', '*/*'],
          copyToCacheDirectory: true,
        });
        if (result.canceled) return;
        const file = result.assets[0];
        let content: string;
        if (file.uri.startsWith('blob:') || file.uri.startsWith('http')) {
          const r = await fetch(file.uri);
          content = await r.text();
        } else {
          content = await FileSystem.readAsStringAsync(file.uri, {
            encoding: FileSystem.EncodingType.UTF8,
          });
        }
        processImportText(content, file.name ?? 'save.omgsave');
      } catch (_) {
        Alert.alert('Erro', 'Não foi possível ler o arquivo de save.');
      }
    }
  }

  function processImportText(text: string, name: string) {
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      if (!parsed.saveData || !parsed.username) {
        Alert.alert('Arquivo inválido', 'Este arquivo não é um save válido do OMEGA DX10.');
        return;
      }
      setPendingExportData(parsed);
      setPendingFilename(name);
      setImportPassword('');
      setImportModal(true);
    } catch {
      Alert.alert('Arquivo inválido', 'Não foi possível ler o arquivo. Verifique se é um .omgsave válido.');
    }
  }

  // ── Confirm import ─────────────────────────────────────────────────────────
  async function handleConfirmImport() {
    if (!pendingExportData || !importPassword.trim()) {
      Alert.alert('Atenção', 'Digite sua senha para confirmar a importação.');
      return;
    }
    setImporting(true);
    try {
      const res = await fetch(`${getApiUrl()}/saves/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exportData: pendingExportData, password: importPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        Alert.alert('Erro', data.error ?? 'Erro ao importar save');
        return;
      }
      setImportModal(false);
      setPendingExportData(null);
      setImportPassword('');
      Alert.alert(
        '✅ Save Importado!',
        'Progresso restaurado! Feche e reabra o app para ver as mudanças.',
        [{ text: 'OK' }]
      );
    } catch (_) {
      Alert.alert('Erro', 'Não foi possível importar o save.');
    } finally {
      setImporting(false);
    }
  }

  if (!user) return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Feather name="archive" size={16} color={colors.primary} />
        <Text style={[styles.title, { color: colors.foreground }]}>Gerenciar Save</Text>
      </View>
      <Text style={[styles.desc, { color: colors.mutedForeground }]}>
        Exporte seu progresso para um arquivo{' '}
        <Text style={{ fontWeight: '700' }}>.omgsave</Text> e importe em
        qualquer servidor do OMEGA DX10.
      </Text>

      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.primary + '22', borderColor: colors.primary }]}
          onPress={handleExport}
          disabled={exporting}
        >
          {exporting
            ? <ActivityIndicator size={14} color={colors.primary} />
            : <Feather name="download" size={14} color={colors.primary} />}
          <Text style={[styles.btnText, { color: colors.primary }]}>
            {exporting ? 'Exportando...' : 'Exportar Save'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: '#f59e0b22', borderColor: '#f59e0b' }]}
          onPress={handlePickImport}
          disabled={importing}
        >
          <Feather name="upload" size={14} color="#f59e0b" />
          <Text style={[styles.btnText, { color: '#f59e0b' }]}>Importar Save</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.hintBox, { backgroundColor: colors.border + '44', borderColor: colors.border }]}>
        <Feather name="info" size={11} color={colors.mutedForeground} />
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          {user.isAdmin || user.role === 'digimon_creator'
            ? 'Conta especial: precisa do usuário + senha para importar'
            : 'Conta normal: precisa do e-mail + senha para importar no servidor destino'}
        </Text>
      </View>

      <Modal visible={importModal} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.modal, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Confirmar Importação</Text>
            <View style={[styles.modalInfoBox, { backgroundColor: colors.border + '44', borderColor: colors.border }]}>
              <Text style={[styles.modalInfoText, { color: colors.mutedForeground }]}>
                Save de:{' '}
                <Text style={{ color: colors.foreground, fontWeight: '700' }}>
                  {String(pendingExportData?.username ?? '')}
                </Text>
              </Text>
              <Text style={[styles.modalInfoText, { color: colors.mutedForeground }]}>
                Arquivo: {pendingFilename}
              </Text>
            </View>
            <View style={[styles.warnBox, { backgroundColor: '#ef444422', borderColor: '#ef4444' }]}>
              <Feather name="alert-triangle" size={13} color="#ef4444" />
              <Text style={[styles.warnText, { color: '#ef4444' }]}>
                Isso vai sobrescrever seu progresso atual!
              </Text>
            </View>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              {pendingExportData?.isSystemAccount
                ? 'Sua senha (conta especial):'
                : 'Sua senha (conta com o mesmo e-mail):'}
            </Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              value={importPassword}
              onChangeText={setImportPassword}
              secureTextEntry
              placeholder="Digite sua senha"
              placeholderTextColor={colors.mutedForeground}
              autoFocus
            />
            <View style={styles.modalRow}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.border }]}
                onPress={() => { setImportModal(false); setPendingExportData(null); }}
              >
                <Text style={[styles.modalBtnText, { color: colors.foreground }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#f59e0b' }]}
                onPress={handleConfirmImport}
                disabled={importing}
              >
                {importing
                  ? <ActivityIndicator size={14} color="#fff" />
                  : <Text style={[styles.modalBtnText, { color: '#fff' }]}>Importar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16, borderWidth: 1.5, padding: 16, marginBottom: 20, gap: 10,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 14, fontWeight: '700' as const },
  desc: { fontSize: 12, lineHeight: 18 },
  row: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderRadius: 12, borderWidth: 1.5, paddingVertical: 10,
  },
  btnText: { fontSize: 12, fontWeight: '700' as const },
  hintBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    borderRadius: 8, borderWidth: 1, padding: 8,
  },
  hint: { fontSize: 11, lineHeight: 16, flex: 1 },
  overlay: {
    flex: 1, backgroundColor: '#00000088',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modal: {
    width: '100%', borderRadius: 20, borderWidth: 1.5, padding: 20, gap: 12,
  },
  modalTitle: { fontSize: 16, fontWeight: '800' as const, textAlign: 'center' as const },
  modalInfoBox: {
    borderRadius: 10, borderWidth: 1, padding: 10, gap: 4,
  },
  modalInfoText: { fontSize: 12, lineHeight: 18 },
  warnBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8,
  },
  warnText: { fontSize: 12, fontWeight: '600' as const, flex: 1 },
  label: { fontSize: 12, fontWeight: '600' as const },
  input: {
    borderWidth: 1.5, borderRadius: 12, padding: 12,
    fontSize: 14, fontWeight: '600' as const,
  },
  modalRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalBtn: {
    flex: 1, borderRadius: 12, paddingVertical: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  modalBtnText: { fontSize: 14, fontWeight: '700' as const },
});
