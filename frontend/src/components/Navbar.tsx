import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <nav className="border-b bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link to="/" className="text-lg font-bold text-brand-600">
          SplitEase
        </Link>
        {user && (
          <div className="flex items-center gap-4 text-sm">
            <Link to="/" className="text-gray-600 hover:text-gray-900">
              Dashboard
            </Link>
            <Link to="/groups/new" className="text-gray-600 hover:text-gray-900">
              New Group
            </Link>
            <Link to="/profile" className="text-gray-600 hover:text-gray-900">
              {user.username}
            </Link>
            <button
              onClick={handleLogout}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-100"
            >
              Log out
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
