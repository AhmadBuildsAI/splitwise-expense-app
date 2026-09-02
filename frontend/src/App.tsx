import { Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { Navbar } from "./components/Navbar";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import CreateGroup from "./pages/CreateGroup";
import GroupDetails from "./pages/GroupDetails";
import AddExpense from "./pages/AddExpense";
import EditExpense from "./pages/EditExpense";
import RecordSettlement from "./pages/RecordSettlement";
import ActivityHistory from "./pages/ActivityHistory";
import Profile from "./pages/Profile";

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <>
                <Navbar />
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/groups/new" element={<CreateGroup />} />
                  <Route path="/groups/:groupId" element={<GroupDetails />} />
                  <Route path="/groups/:groupId/expenses/new" element={<AddExpense />} />
                  <Route path="/groups/:groupId/settlements/new" element={<RecordSettlement />} />
                  <Route path="/groups/:groupId/activity" element={<ActivityHistory />} />
                  <Route path="/expenses/:expenseId/edit" element={<EditExpense />} />
                  <Route path="/profile" element={<Profile />} />
                </Routes>
              </>
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  );
}
