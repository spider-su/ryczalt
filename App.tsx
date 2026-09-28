import { createNavigationContainerRef, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { ThemeProvider, useTheme, theme } from './src/theme/theme';
import { IncomeScreen } from './src/screens/IncomeScreen';
import { TaxScreen } from './src/screens/TaxScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { PulpitScreen } from './src/screens/PulpitScreen';
import { RentalDataProvider } from './src/data/RentalDataProvider';
import { ReminderProvider } from './src/notifications/ReminderProvider';
import { notificationDataToIntent } from './src/navigation/notificationIntent';
import { useRentalData } from './src/data/RentalDataProvider';
import { LocalDataRecoveryScreen } from './src/screens/LocalDataRecoveryScreen';
import { appSafeAreaEdges, tabBarSafeAreaStyle } from './src/navigation/safeAreaLayout';

const Tabs = createBottomTabNavigator();
const navigationRef = createNavigationContainerRef<any>();
function RentalApp() {
  const { mode } = useTheme();
  const insets = useSafeAreaInsets();
  const { document, isDemoMode, exitDemoMode, loadError, recoveredFromBackup, dismissRecoveryNotice, retryLoad, copyRawData, resetLocalData } = useRentalData();
  useEffect(() => {
    if (!recoveredFromBackup || Platform.OS === 'web') return;
    Alert.alert('Odzyskano lokalne dane', 'Głównego zapisu nie można było odczytać. Otworzono ostatnią poprawną kopię danych.', [
      { text: 'Rozumiem', onPress: dismissRecoveryNotice },
    ]);
  }, [dismissRecoveryNotice, recoveredFromBackup]);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const openTarget = (response: Notifications.NotificationResponse, retry = 0) => {
      const data = response.notification.request.content.data;
      if (!data) {
        void Notifications.clearLastNotificationResponseAsync();
        return;
      }
      if (!navigationRef.isReady()) {
        if (retry < 10) setTimeout(() => openTarget(response, retry + 1), 150);
        return;
      }
      const navigator = navigationRef as any;
      const intent = notificationDataToIntent(data);
      if (!intent) {
        void Notifications.clearLastNotificationResponseAsync();
        return;
      }
      navigator.navigate(intent.screen, intent.params);
      void Notifications.clearLastNotificationResponseAsync();
    };
    const subscription = Notifications.addNotificationResponseReceivedListener(openTarget);
    void Notifications.getLastNotificationResponseAsync().then((response) => { if (response) openTarget(response); });
    return () => subscription.remove();
  }, []);
  if (loadError) return <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={appSafeAreaEdges}><StatusBar style={mode === 'dark' ? 'light' : 'dark'} /><LocalDataRecoveryScreen error={loadError} retryLoad={retryLoad} copyRawData={copyRawData} resetLocalData={resetLocalData} /></SafeAreaView>;
  if (!document) return <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background }} edges={appSafeAreaEdges}><StatusBar style={mode === 'dark' ? 'light' : 'dark'} /><ActivityIndicator color={theme.colors.primary} /></SafeAreaView>;
  return <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={appSafeAreaEdges}><StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
    {isDemoMode ? <View accessibilityLabel="Tryb demo — przykładowe dane. Zmiany w demo nie są zapisywane." style={{ minHeight: 42, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: mode === 'dark' ? '#28252A' : '#F5F2F3', borderBottomWidth: 1, borderBottomColor: theme.colors.borderSubtle }}>
      <View style={{ flex: 1, paddingRight: 8 }}><Text style={{ color: theme.colors.textPrimary, fontSize: 12, fontWeight: '700' }}>Tryb demo — przykładowe dane</Text><Text style={{ color: theme.colors.textSecondary, fontSize: 10 }}>Zmiany w demo nie są zapisywane</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Wyjdź z demo" onPress={exitDemoMode} hitSlop={8}><Text style={{ color: theme.colors.primary, fontSize: 12, fontWeight: '700' }}>Wyjdź z demo</Text></Pressable>
    </View> : null}
    <NavigationContainer ref={navigationRef}><View style={{ flex: 1 }}>
    <Tabs.Navigator screenOptions={({ route }) => ({
      headerShown: false,
      headerStyle: { backgroundColor: theme.colors.background },
      headerTintColor: theme.colors.textPrimary,
      tabBarActiveTintColor: theme.colors.selectedNavigation,
      tabBarInactiveTintColor: theme.colors.inactiveNavigation,
      tabBarStyle: { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.borderSubtle, borderTopWidth: 1, paddingTop: 6, ...tabBarSafeAreaStyle(insets.bottom), elevation: 0 },
      tabBarLabel: ({ focused, color }) => <Text style={{ color, fontSize: 11, fontWeight: focused ? '700' : '500', marginTop: 1 }}>{route.name}</Text>,
      tabBarIcon: ({ color, size }) => <Ionicons name={route.name === 'Pulpit' ? 'home-outline' : route.name === 'Przychód' ? 'wallet-outline' : route.name === 'Podatek' ? 'calculator-outline' : 'settings-outline'} size={size} color={color} />
    })}>
      <Tabs.Screen name="Pulpit" component={PulpitScreen} />
      <Tabs.Screen name="Przychód" component={IncomeScreen} />
      <Tabs.Screen name="Podatek" component={TaxScreen} />
      <Tabs.Screen name="Ustawienia" component={SettingsScreen} />
    </Tabs.Navigator>
  </View></NavigationContainer></SafeAreaView>;
}
export default function App() { return <SafeAreaProvider><ThemeProvider><RentalDataProvider><ReminderProvider><RentalApp /></ReminderProvider></RentalDataProvider></ThemeProvider></SafeAreaProvider>; }
