import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/contexts/AuthContext';
import { apiService, ProfileUpdateRequest, ChangePasswordRequest } from '@/lib/api';

export default function ProfileScreen() {
  const { user, refreshUser } = useAuth();
  const [first_name, setFirst_name] = useState('');
  const [last_name, setLast_name] = useState('');
  const [phone_number, setPhone_number] = useState('');
  const [address, setAddress] = useState('');
  const [website, setWebsite] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({ light: '#ddd', dark: '#333' }, 'icon');
  const placeholderColor = useThemeColor({ light: '#999', dark: '#666' }, 'icon');

  useEffect(() => {
    if (user) {
      setFirst_name(user.first_name ?? '');
      setLast_name(user.last_name ?? '');
      setPhone_number(user.phone_number ?? '');
      setAddress(user.address ?? '');
      setWebsite(user.website ?? '');
    }
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const payload: ProfileUpdateRequest = {
        first_name: first_name.trim() || undefined,
        last_name: last_name.trim() || undefined,
        phone_number: phone_number.trim() ? phone_number.trim() : undefined,
        address: address.trim() ? address.trim() : null,
        website: website.trim() ? website.trim() : null,
      };
      const response = await apiService.updateProfile(payload);
      if (response.success) {
        await refreshUser();
        Alert.alert('Success', 'Profile updated successfully');
      } else {
        const msg = response.errors
          ? Object.values(response.errors).flat().join('\n')
          : response.message ?? 'Update failed';
        Alert.alert('Error', msg);
      }
    } catch {
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== newPassword2) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Error', 'New password must be at least 8 characters');
      return;
    }
    setChangingPassword(true);
    try {
      const payload: ChangePasswordRequest = {
        current_password: currentPassword,
        new_password: newPassword,
        new_password2: newPassword2,
      };
      const response = await apiService.changePassword(payload);
      if (response.success) {
        setCurrentPassword('');
        setNewPassword('');
        setNewPassword2('');
        Alert.alert('Success', 'Password changed successfully');
      } else {
        const msg = response.errors
          ? Object.values(response.errors).flat().join('\n')
          : response.message ?? 'Password change failed';
        Alert.alert('Error', msg);
      }
    } catch {
      Alert.alert('Error', 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to photos to set a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;

    setUploadingAvatar(true);
    try {
      const asset = result.assets[0];
      const filename = asset.uri.split('/').pop() ?? `avatar_${Date.now()}.jpg`;
      const ext = filename.split('.').pop()?.toLowerCase();
      let contentType = 'image/jpeg';
      if (ext === 'png') contentType = 'image/png';
      if (ext === 'webp') contentType = 'image/webp';

      const urlRes = await apiService.getProfileAvatarUploadUrl(filename, contentType);
      if (!urlRes.success || !urlRes.data) {
        Alert.alert('Error', urlRes.message ?? 'Could not get upload URL');
        return;
      }

      const { upload_url, file_key } = urlRes.data;
      const blob = await (await fetch(asset.uri)).blob();
      const uploadRes = await fetch(upload_url, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': contentType },
      });
      if (!uploadRes.ok) {
        Alert.alert('Error', 'Upload failed');
        return;
      }

      const updateRes = await apiService.updateProfile({ profile_photo_key: file_key });
      if (updateRes.success) {
        await refreshUser();
        Alert.alert('Success', 'Profile picture updated');
      } else {
        Alert.alert('Error', updateRes.message ?? 'Failed to save profile picture');
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to upload picture');
    } finally {
      setUploadingAvatar(false);
    }
  };

  if (!user) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" />
        <ThemedText style={styles.loadingText}>Loading profile…</ThemedText>
      </ThemedView>
    );
  }

  const avatarUrl = user.avatar_url ?? null;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Profile picture
          </ThemedText>
          <TouchableOpacity
            style={styles.avatarRow}
            onPress={handlePickAvatar}
            disabled={uploadingAvatar}
          >
            <ThemedView style={[styles.avatarCircle, { borderColor }]}>
              {uploadingAvatar ? (
                <ActivityIndicator color={textColor} />
              ) : avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="person" size={48} color={placeholderColor} />
              )}
            </ThemedView>
            <ThemedText style={styles.avatarHint}>
              {uploadingAvatar ? 'Uploading…' : 'Tap to change'}
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>

        {/* Name */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Name
          </ThemedText>
          <ThemedView style={styles.inputGroup}>
            <ThemedText style={styles.label}>First name</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor, color: textColor, borderColor }]}
              placeholder="First name"
              placeholderTextColor={placeholderColor}
              value={first_name}
              onChangeText={setFirst_name}
              autoCapitalize="words"
            />
            <ThemedText style={styles.label}>Last name</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor, color: textColor, borderColor }]}
              placeholder="Last name"
              placeholderTextColor={placeholderColor}
              value={last_name}
              onChangeText={setLast_name}
              autoCapitalize="words"
            />
            <ThemedText style={styles.label}>Phone number</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor, color: textColor, borderColor }]}
              placeholder="+1 234 567 8900"
              placeholderTextColor={placeholderColor}
              value={phone_number}
              onChangeText={setPhone_number}
              keyboardType="phone-pad"
              autoCapitalize="none"
            />
            <ThemedText style={styles.label}>Address</ThemedText>
            <TextInput
              style={[styles.textArea, { backgroundColor, color: textColor, borderColor }]}
              placeholder="Street, city, state, ZIP…"
              placeholderTextColor={placeholderColor}
              value={address}
              onChangeText={setAddress}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <ThemedText style={styles.label}>Website</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor, color: textColor, borderColor }]}
              placeholder="https://example.com"
              placeholderTextColor={placeholderColor}
              value={website}
              onChangeText={setWebsite}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </ThemedView>
          <TouchableOpacity
            style={[styles.primaryButton, saving && styles.buttonDisabled]}
            onPress={handleSaveProfile}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <ThemedText style={styles.primaryButtonText}>Save profile</ThemedText>
            )}
          </TouchableOpacity>
        </ThemedView>

        {/* Email (read-only) */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Email
          </ThemedText>
          <TextInput
            style={[styles.input, styles.inputReadOnly, { backgroundColor, color: textColor, borderColor }]}
            value={user.email}
            editable={false}
          />
        </ThemedView>

        {/* Password */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Change password
          </ThemedText>
          <ThemedView style={styles.inputGroup}>
            <ThemedText style={styles.label}>Current password</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor, color: textColor, borderColor }]}
              placeholder="Current password"
              placeholderTextColor={placeholderColor}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
              autoCapitalize="none"
            />
            <ThemedText style={styles.label}>New password</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor, color: textColor, borderColor }]}
              placeholder="New password"
              placeholderTextColor={placeholderColor}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoCapitalize="none"
            />
            <ThemedText style={styles.label}>Confirm new password</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor, color: textColor, borderColor }]}
              placeholder="Confirm new password"
              placeholderTextColor={placeholderColor}
              value={newPassword2}
              onChangeText={setNewPassword2}
              secureTextEntry
              autoCapitalize="none"
            />
          </ThemedView>
          <TouchableOpacity
            style={[styles.primaryButton, changingPassword && styles.buttonDisabled]}
            onPress={handleChangePassword}
            disabled={changingPassword}
          >
            {changingPassword ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <ThemedText style={styles.primaryButtonText}>Change password</ThemedText>
            )}
          </TouchableOpacity>
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    marginBottom: 12,
  },
  avatarRow: {
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarHint: {
    marginTop: 8,
    opacity: 0.7,
    fontSize: 14,
  },
  inputGroup: {
    marginBottom: 12,
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 48,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 88,
  },
  inputReadOnly: {
    opacity: 0.8,
  },
  primaryButton: {
    backgroundColor: '#0a7ea4',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
