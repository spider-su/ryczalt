import { createNavigationContainerRef, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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

const Tabs = createBottomTabNavigator();
const navigationRef = createNavigationContainerRef<any>();
function RentalApp() {
  const { mode } = useTheme();
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const openTarget = (response: Notifications.NotificationResponse, retry = 0) => {
      const data = response.notification.request.content.data;
      if (!data) return;
      const category = data.category;
      if (!navigationRef.isReady()) {
        if (retry < 10) setTimeout(() => openTarget(response, retry + 1), 150);
        return;
      }
      const navigator = navigationRef as any;
      if (category === 'tax') navigator.navigate('Podatek', { period: data.period });
      else if (category === 'rent') navigator.navigate('Przychód', { quickAdd: true, propertyId: data.propertyId, rentalMonth: data.period, expectedAmount: data.expectedAmount });
      else if (category === 'custom') navigator.navigate('Pulpit', { taskId: data.taskId });
      else navigator.navigate('Ustawienia', { propertyId: data.propertyId, billId: data.billId });
      void Notifications.clearLastNotificationResponseAsync();
    };
    const subscription = Notifications.addNotificationResponseReceivedListener(openTarget);
    void Notifications.getLastNotificationResponseAsync().then((response) => { if (response) openTarget(response); });
    return () => subscription.remove();
  }, []);
  return <NavigationContainer ref={navigationRef}><StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
    <Tabs.Navigator screenOptions={({ route }) => ({
      headerStyle: { backgroundColor: theme.colors.background },
      headerTintColor: theme.colors.textPrimary,
      tabBarActiveTintColor: theme.colors.primary,
      tabBarStyle: { backgroundColor: theme.colors.surface },
      tabBarIcon: ({ color, size }) => <Ionicons name={route.name === 'Pulpit' ? 'home-outline' : route.name === 'Przychód' ? 'wallet-outline' : route.name === 'Podatek' ? 'calculator-outline' : 'settings-outline'} size={size} color={color} />
    })}>
      <Tabs.Screen name="Pulpit" component={PulpitScreen} />
      <Tabs.Screen name="Przychód" component={IncomeScreen} />
      <Tabs.Screen name="Podatek" component={TaxScreen} />
      <Tabs.Screen name="Ustawienia" component={SettingsScreen} />
    </Tabs.Navigator>
  </NavigationContainer>;
}
export default function App() { return <SafeAreaProvider><ThemeProvider><RentalDataProvider><ReminderProvider><RentalApp /></ReminderProvider></RentalDataProvider></ThemeProvider></SafeAreaProvider>; }
