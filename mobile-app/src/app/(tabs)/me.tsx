import { useAuth } from '../../auth';
import { ProfileView } from '../../components/ProfileView';

export default function MyProfile() {
  const { user } = useAuth();
  return user ? <ProfileView username={user.username} /> : null;
}
