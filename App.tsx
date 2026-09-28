import { createNavigationContainerRef, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Alert } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
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
import { appSafeAreaEdges } from './src/navigation/safeAreaLayout';

const Tabs = createBottomTabNavigator();
const navigationRef = createNavigationContainerRef<any>();
function RentalApp() {
  const { mode } = useTheme();
  const { document, loadError, recoveredFromBackup, dismissRecoveryNotice, retryLoad, copyRawData, resetLocalData } = useRentalData();
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
  return <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={appSafeAreaEdges}><NavigationContainer ref={navigationRef}><StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
    <Tabs.Navigator safeAreaInsets={{ bottom: 0 }} screenOptions={({ route }) => ({
      headerShown: false,
      headerStyle: { backgroundColor: theme.colors.background },
      headerTintColor: theme.colors.textPrimary,
      tabBarActiveTintColor: theme.colors.primary,
      tabBarInactiveTintColor: theme.colors.inactiveNavigation,
      tabBarStyle: { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.borderSubtle, borderTopWidth: 1, paddingTop: 6, elevation: 0 },
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 1 },
      tabBarIcon: ({ color, size }) => <Ionicons name={route.name === 'Pulpit' ? 'home-outline' : route.name === 'Przychód' ? 'wallet-outline' : route.name === 'Podatek' ? 'calculator-outline' : 'settings-outline'} size={size} color={color} />
    })}>
      <Tabs.Screen name="Pulpit" component={PulpitScreen} />
      <Tabs.Screen name="Przychód" component={IncomeScreen} />
      <Tabs.Screen name="Podatek" component={TaxScreen} />
      <Tabs.Screen name="Ustawienia" component={SettingsScreen} />
    </Tabs.Navigator>
  </NavigationContainer></SafeAreaView>;
}
export default function App() { return <SafeAreaProvider><ThemeProvider><RentalDataProvider><ReminderProvider><RentalApp /></ReminderProvider></RentalDataProvider></ThemeProvider></SafeAreaProvider>; }
