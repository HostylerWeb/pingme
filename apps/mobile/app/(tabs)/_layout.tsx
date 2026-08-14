import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useChatsUnreadCount } from '../../src/hooks/use-chats-unread';
import { TAB_BAR_CONTENT_HEIGHT, TAB_BAR_VERTICAL_PADDING, useBottomInset } from '../../src/hooks/use-tab-bar-insets';
import { typography, useTheme, useThemedStyles } from '../../src/theme';

type TabIconName = ComponentProps<typeof Ionicons>['name'];

function TabIcon({
  name,
  color,
  focused,
}: {
  name: TabIconName;
  color: string;
  focused: boolean;
}) {
  const styles = useThemedStyles(() => ({
    iconWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 28,
    },
  }));

  return (
    <View style={styles.iconWrap}>
      <Ionicons name={name} size={focused ? 24 : 22} color={color} />
    </View>
  );
}

export default function TabLayout() {
  const bottomInset = useBottomInset();
  const tabBarHeight = TAB_BAR_CONTENT_HEIGHT + bottomInset + TAB_BAR_VERTICAL_PADDING;
  const { colors } = useTheme();
  const unreadChatCount = useChatsUnreadCount();
  const chatsTabBadge = unreadChatCount > 0 ? (unreadChatCount > 9 ? '9+' : unreadChatCount) : undefined;

  return (
    <Tabs
      safeAreaInsets={{ top: 0, right: 0, bottom: bottomInset, left: 0 }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: tabBarHeight,
          paddingTop: 6,
          paddingBottom: bottomInset + 6,
          ...Platform.select({
            ios: {
              shadowColor: colors.shadow,
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
            },
            android: { elevation: 8 },
          }),
        },
        tabBarLabelStyle: {
          ...typography.labelSm,
          fontSize: 10,
          marginTop: 2,
          letterSpacing: 0,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Wall',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'layers' : 'layers-outline'} color={String(color)} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="icebreaker"
        options={{
          title: 'Break the ice',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'radio' : 'radio-outline'} color={String(color)} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Chats',
          tabBarBadge: chatsTabBadge,
          tabBarBadgeStyle: { backgroundColor: colors.accent, color: colors.onAccent, fontSize: 10 },
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'}
              color={String(color)}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'You',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'person-circle' : 'person-circle-outline'} color={String(color)} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
