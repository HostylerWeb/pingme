import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { useChatsUnreadCount } from '../../src/hooks/use-chats-unread';
import { TAB_BAR_CONTENT_HEIGHT, TAB_BAR_VERTICAL_PADDING, useBottomInset } from '../../src/hooks/use-tab-bar-insets';
import { AppIcon, type AppIconName } from '../../src/components/ui/app-icon';
import { typography, useTheme, useThemedStyles } from '../../src/theme';

function TabIcon({
  name,
  color,
  focused,
}: {
  name: AppIconName;
  color: string;
  focused: boolean;
}) {
  const styles = useThemedStyles(() => ({
    iconWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 32,
    },
  }));

  return (
    <View style={styles.iconWrap}>
      <AppIcon name={name} size={focused ? 28 : 26} color={color} />
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
        tabBarActiveTintColor: colors.tabBarIconActive,
        tabBarInactiveTintColor: colors.tabBarIconInactive,
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
            <TabIcon name="wall-filled" color={String(color)} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="icebreaker"
        options={{
          title: 'Break the ice',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="icebreaker-filled" color={String(color)} focused={focused} />
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
            <TabIcon name="chats-filled" color={String(color)} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'You',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="profile-filled" color={String(color)} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
