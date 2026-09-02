import { useAuth } from "../context/AuthContext";

export default function Profile() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Profile</h1>
      <div className="space-y-4 rounded-xl bg-white p-6 shadow-sm">
        <div>
          <p className="text-xs uppercase text-gray-400">Username</p>
          <p className="text-gray-800">{user.username}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-gray-400">Email</p>
          <p className="text-gray-800">{user.email}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-gray-400">Member since</p>
          <p className="text-gray-800">{new Date(user.createdAt).toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
}
