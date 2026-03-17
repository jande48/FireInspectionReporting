import { useState } from 'react';
import { Link } from 'expo-router';
import { StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function RegisterScreen() {
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    password2: '',
    first_name: '',
    last_name: '',
    phone_number: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register } = useAuth();
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({ light: '#ddd', dark: '#333' }, 'icon');
  const placeholderColor = useThemeColor({ light: '#999', dark: '#666' }, 'icon');

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validateForm = (): boolean => {
    if (!formData.email.trim()) {
      Alert.alert('Error', 'Email is required');
      return false;
    }
    if (!formData.username.trim()) {
      Alert.alert('Error', 'Username is required');
      return false;
    }
    if (!formData.password.trim()) {
      Alert.alert('Error', 'Password is required');
      return false;
    }
    if (formData.password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return false;
    }
    if (formData.password !== formData.password2) {
      Alert.alert('Error', 'Passwords do not match');
      return false;
    }
    return true;
  };

  const handleRegister = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    const result = await register({
      email: formData.email.trim(),
      username: formData.username.trim(),
      password: formData.password,
      password2: formData.password2,
      first_name: formData.first_name.trim() || undefined,
      last_name: formData.last_name.trim() || undefined,
      phone_number: formData.phone_number.trim() || undefined,
    });
    setIsSubmitting(false);

    if (!result.success) {
      const errorMessage = result.errors
        ? Object.values(result.errors).flat().join('\n')
        : result.message || 'Registration failed';
      Alert.alert('Registration Failed', errorMessage);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <ThemedView style={styles.content}>
          <ThemedText type="title" style={styles.title}>
            Create Account
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Sign up to get started
          </ThemedText>

          <ThemedView style={styles.form}>
            <ThemedView style={styles.inputContainer}>
              <ThemedText style={styles.label}>Email *</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor, color: textColor, borderColor }]}
                placeholder="Enter your email"
                placeholderTextColor={placeholderColor}
                value={formData.email}
                onChangeText={(value) => updateField('email', value)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSubmitting}
              />
            </ThemedView>

            <ThemedView style={styles.inputContainer}>
              <ThemedText style={styles.label}>Username *</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor, color: textColor, borderColor }]}
                placeholder="Choose a username"
                placeholderTextColor={placeholderColor}
                value={formData.username}
                onChangeText={(value) => updateField('username', value)}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSubmitting}
              />
            </ThemedView>

            <ThemedView style={styles.inputContainer}>
              <ThemedText style={styles.label}>First Name</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor, color: textColor, borderColor }]}
                placeholder="Enter your first name"
                placeholderTextColor={placeholderColor}
                value={formData.first_name}
                onChangeText={(value) => updateField('first_name', value)}
                autoCapitalize="words"
                editable={!isSubmitting}
              />
            </ThemedView>

            <ThemedView style={styles.inputContainer}>
              <ThemedText style={styles.label}>Last Name</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor, color: textColor, borderColor }]}
                placeholder="Enter your last name"
                placeholderTextColor={placeholderColor}
                value={formData.last_name}
                onChangeText={(value) => updateField('last_name', value)}
                autoCapitalize="words"
                editable={!isSubmitting}
              />
            </ThemedView>

            <ThemedView style={styles.inputContainer}>
              <ThemedText style={styles.label}>Phone Number</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor, color: textColor, borderColor }]}
                placeholder="Enter your phone number"
                placeholderTextColor={placeholderColor}
                value={formData.phone_number}
                onChangeText={(value) => updateField('phone_number', value)}
                keyboardType="phone-pad"
                editable={!isSubmitting}
              />
            </ThemedView>

            <ThemedView style={styles.inputContainer}>
              <ThemedText style={styles.label}>Password *</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor, color: textColor, borderColor }]}
                placeholder="Enter your password (min 8 characters)"
                placeholderTextColor={placeholderColor}
                value={formData.password}
                onChangeText={(value) => updateField('password', value)}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSubmitting}
              />
            </ThemedView>

            <ThemedView style={styles.inputContainer}>
              <ThemedText style={styles.label}>Confirm Password *</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor, color: textColor, borderColor }]}
                placeholder="Confirm your password"
                placeholderTextColor={placeholderColor}
                value={formData.password2}
                onChangeText={(value) => updateField('password2', value)}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSubmitting}
              />
            </ThemedView>

            <TouchableOpacity
              style={[styles.button, isSubmitting && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.buttonText}>Sign Up</ThemedText>
              )}
            </TouchableOpacity>
          </ThemedView>

          <ThemedView style={styles.footer}>
            <ThemedText style={styles.footerText}>
              Already have an account?{' '}
            </ThemedText>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <ThemedText type="link" style={styles.linkText}>
                  Sign In
                </ThemedText>
              </TouchableOpacity>
            </Link>
          </ThemedView>
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    paddingTop: 40,
    gap: 24,
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: 8,
  },
  form: {
    gap: 16,
    width: '100%',
  },
  inputContainer: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 48,
  },
  button: {
    backgroundColor: '#0a7ea4',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 48,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  footerText: {
    fontSize: 14,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
