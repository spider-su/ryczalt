import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme, theme } from './src/theme/theme';
import { IncomeScreen } from './src/screens/IncomeScreen';
import { TaxScreen } from './src/screens/TaxScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';

const Tabs = createBottomTabNavigator();
function RentalApp() {
  const { mode } = useTheme();
  return <NavigationContainer><StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
    <Tabs.Navigator screenOptions={({ route }) => ({
      headerStyle: { backgroundColor: theme.colors.background },
      headerTintColor: theme.colors.textPrimary,
      tabBarActiveTintColor: theme.colors.primary,
      tabBarStyle: { backgroundColor: theme.colors.surface },
      tabBarIcon: ({ color, size }) => <Ionicons name={route.name === 'Przychód' ? 'wallet-outline' : route.name === 'Podatek' ? 'calculator-outline' : 'settings-outline'} size={size} color={color} />
    })}>
      <Tabs.Screen name="Przychód" component={IncomeScreen} />
      <Tabs.Screen name="Podatek" component={TaxScreen} />
      <Tabs.Screen name="Ustawienia" component={SettingsScreen} />
    </Tabs.Navigator>
  </NavigationContainer>;
}
export default function App() { return <SafeAreaProvider><ThemeProvider><RentalApp /></ThemeProvider></SafeAreaProvider>; }
