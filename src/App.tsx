import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import ManageLoans from "./pages/ManageLoans";
import ManageBorrowers from "./pages/ManageBorrowers";
import GenerateInterest from "./pages/GenerateInterest";
import History from "./pages/History";
import Login from "./pages/Login";
import { useAuth } from "./lib/AuthContext";
import { supabase } from "./lib/supabase";

function App() {
  const { session, loading } = useAuth();

  // If Supabase is configured but user is not authenticated, show login
  if (supabase && loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (supabase && !session) {
    return <Login />;
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="loans" element={<ManageLoans />} />
        <Route path="borrowers" element={<ManageBorrowers />} />
        <Route path="interest" element={<GenerateInterest />} />
        <Route path="history" element={<History />} />
      </Route>
    </Routes>
  );
}

export default App;
