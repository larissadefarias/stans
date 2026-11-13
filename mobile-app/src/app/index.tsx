import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../auth';
import { colors } from '../theme';

export default function Index() {
  const { user, ready } = useAuth();
  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.violet} />
      </View>
    );
  }
  return <Redirect href={user ? '/feed' : '/login'} />;
}
