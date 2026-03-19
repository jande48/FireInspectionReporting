import React, { useState } from 'react';
import { TouchableOpacity, Modal, View, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { ThemedText } from './themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

export function AppMenuButton() {
  const [menuVisible, setMenuVisible] = useState(false);
  const { logout } = useAuth();
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({ light: '#ddd', dark: '#333' }, 'icon');

  const openProfile = () => {
    setMenuVisible(false);
    router.push('/(app)/profile');
  };

  const handleLogout = async () => {
    setMenuVisible(false);
    await logout();
  };

  return (
    <>
      <TouchableOpacity
        onPress={() => setMenuVisible(true)}
        style={styles.trigger}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons name="menu" size={26} color={textColor} />
      </TouchableOpacity>
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuVisible(false)} />
          <View style={[styles.menu, { backgroundColor, borderColor }]}>
            <TouchableOpacity style={styles.menuItem} onPress={openProfile}>
              <Ionicons name="person-outline" size={22} color={textColor} />
              <ThemedText style={styles.menuItemText}>Profile</ThemedText>
            </TouchableOpacity>
            <View style={[styles.divider, { backgroundColor: borderColor }]} />
            <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={22} color={textColor} />
              <ThemedText style={styles.menuItemText}>Log out</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    marginLeft: 12,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingTop: 56,
    paddingLeft: 16,
    alignItems: 'flex-start',
  },
  menu: {
    minWidth: 180,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  menuItemText: {
    fontSize: 16,
  },
  divider: {
    height: 1,
    marginVertical: 4,
    marginHorizontal: 12,
  },
});
