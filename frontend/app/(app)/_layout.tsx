import { Stack } from 'expo-router';
import { AppMenuButton } from '@/components/app-menu-button';

export default function AppLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="home"
        options={{
          headerShown: true,
          title: 'MezaOC',
          headerLeft: () => <AppMenuButton />,
        }}
      />
      <Stack.Screen
        name="explore"
        options={{
          title: 'Explore',
          headerLeft: () => <AppMenuButton />,
        }}
      />
      <Stack.Screen
        name="profile"
        options={{
          title: 'Profile',
          headerBackTitle: 'Back',
        }}
      />
    </Stack>
  );
}
