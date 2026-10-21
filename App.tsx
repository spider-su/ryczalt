import { createNavigationContainerRef, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { Alert, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useEffect } from 'react';
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
import { AppErrorBoundary } from './src/components/AppErrorBoundary';
import { LoadingState } from './src/components/LoadingState';

const Tabs = createBottomTabNavigator();
const PulpitFlow = createBottomTabNavigator();
const navigationRef = createNavigationContainerRef<any>();

function PulpitFlowScreen() {
  return <PulpitFlow.Navigator
    initialRouteName="Przegląd"
    backBehavior="history"
    screenOptions={{ headerShown: false, tabBarStyle: { display: "none" } }}
  >
    <PulpitFlow.Screen name="Przegląd" component={PulpitScreen} />
    <PulpitFlow.Screen name="Wpłaty" component={IncomeScreen} />
  </PulpitFlow.Navigator>;
}
function RentalApp() {
  const { mode } = useTheme();
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
  if (!document) return <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background }} edges={appSafeAreaEdges}><StatusBar style={mode === 'dark' ? 'light' : 'dark'} /><LoadingState state="loading" color={theme.colors.primary} /></SafeAreaView>;
  return <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={appSafeAreaEdges}><StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
    {isDemoMode ? <View accessibilityLabel="Tryb demo — przykładowe dane. Zmiany w demo nie są zapisywane." style={{ minHeight: 42, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: mode === 'dark' ? '#28252A' : '#F5F2F3', borderBottomWidth: 1, borderBottomColor: theme.colors.borderSubtle }}>
      <View style={{ flex: 1, paddingRight: 8 }}><Text style={{ color: theme.colors.textPrimary, fontSize: 12, fontWeight: '700' }}>Tryb demo — przykładowe dane</Text><Text style={{ color: theme.colors.textSecondary, fontSize: 10 }}>Zmiany w demo nie są zapisywane</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Wyjdź z demo" onPress={exitDemoMode} hitSlop={8}><Text style={{ color: theme.colors.primary, fontSize: 12, fontWeight: '700' }}>Wyjdź z demo</Text></Pressable>
    </View> : null}
    <NavigationContainer ref={navigationRef}><View style={{ flex: 1 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, minHeight: 52 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Wróć na Pulpit" onPress={() => navigationRef.isReady() && navigationRef.navigate('Pulpit' as never)}><Text style={{ color: theme.colors.textPrimary, fontWeight: '700', fontSize: 21 }}>Ryczałt</Text></Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {([{ icon: 'calculator-outline', label: 'Podatek', route: 'Podatek' }, { icon: 'business-outline', label: 'Mieszkania', route: 'Ustawienia', params: { settingsSection: 'properties' } }, { icon: 'settings-outline', label: 'Ustawienia', route: 'Ustawienia' }] as const).map((item) => <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={item.label} hitSlop={4} onPress={() => navigationRef.isReady() && (navigationRef as any).navigate(item.route, 'params' in item ? item.params : undefined)} style={{ width: 46, height: 48, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={item.icon} size={22} color={theme.colors.textPrimary} /></Pressable>)}
      </View>
    </View>
    <Tabs.Navigator screenOptions={{ headerShown: false, tabBarStyle: { display: "none" } }}>
      <Tabs.Screen name="Pulpit" component={PulpitFlowScreen} />
      <Tabs.Screen name="Podatek" component={TaxScreen} />
      <Tabs.Screen name="Ustawienia" component={SettingsScreen} />
    </Tabs.Navigator>
  </View></NavigationContainer></SafeAreaView>;
}
export default function App() { return <SafeAreaProvider><ThemeProvider><AppErrorBoundary><RentalDataProvider><ReminderProvider><RentalApp /></ReminderProvider></RentalDataProvider></AppErrorBoundary></ThemeProvider></SafeAreaProvider>; }
