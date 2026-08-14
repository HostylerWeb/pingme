import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { TAB_BAR_CONTENT_HEIGHT, useBottomInset } from '../../src/hooks/use-tab-bar-insets';
import { colors, typography } from '../../src/theme';

type TabIconName = ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, color, focused }: { name: TabIconName; color: string; focused: boolean }) {
  const iconName: TabIconName = focused ? name : (`${name}-outline` as TabIconName);
  return <Ionicons name={iconName} size={22} color={color} />;
}

export default function TabLayout() {
  const bottomInset = useBottomInset();
  const tabBarHeight = TAB_BAR_CONTENT_HEIGHT + bottomInset + 12;

  return (
    <Tabs
      safeAreaInsets={{ top: 0, right: 0, bottom: bottomInset, left: 0 }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.onSurfaceVariant,
        tabBarStyle: {
          backgroundColor: colors.surfaceBright,
          borderTopColor: colors.cardBorder,
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingTop: 8,
          paddingBottom: bottomInset + 8,
        },
        tabBarLabelStyle: {
          ...typography.labelSm,
          fontSize: 11,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Wall',
          tabBarIcon: ({ color, focused }) => <TabIcon name="grid" color={String(color)} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="icebreaker"
        options={{
          title: 'Icebreaker',
          tabBarIcon: ({ color, focused }) => <TabIcon name="flash" color={String(color)} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Chats',
          tabBarIcon: ({ color, focused }) => <TabIcon name="chatbubbles" color={String(color)} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => <TabIcon name="settings" color={String(color)} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => <TabIcon name="person" color={String(color)} focused={focused} />,
        }}
      />
    </Tabs>
  );
}
