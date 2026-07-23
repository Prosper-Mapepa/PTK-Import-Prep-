import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { RequireAuth } from './auth/RequireAuth'
import AppilyGreenlightPrep from './pages/AppilyGreenlightPrep'
import AppilyPrep from './pages/AppilyPrep'
import AppilyTransferPrep from './pages/AppilyTransferPrep'
import AppilyTransferProspectsPrep from './pages/AppilyTransferProspectsPrep'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import NicheFreshmanPrep from './pages/NicheFreshmanPrep'
import NicheFreshmanProspectsPrep from './pages/NicheFreshmanProspectsPrep'
import NicheTransferPrep from './pages/NicheTransferPrep'
import NicheTransferProspectsPrep from './pages/NicheTransferProspectsPrep'
import PtkPrep from './pages/PtkPrep'

function Protected({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <Protected>
                <LandingPage />
              </Protected>
            }
          />
          <Route
            path="/ptk"
            element={
              <Protected>
                <PtkPrep />
              </Protected>
            }
          />
          <Route
            path="/appily"
            element={
              <Protected>
                <AppilyPrep />
              </Protected>
            }
          />
          <Route
            path="/appily-transfer"
            element={
              <Protected>
                <AppilyTransferPrep />
              </Protected>
            }
          />
          <Route
            path="/appily-greenlight"
            element={
              <Protected>
                <AppilyGreenlightPrep />
              </Protected>
            }
          />
          <Route
            path="/appily-prospects"
            element={
              <Protected>
                <AppilyTransferProspectsPrep />
              </Protected>
            }
          />
          <Route
            path="/niche-freshman"
            element={
              <Protected>
                <NicheFreshmanPrep />
              </Protected>
            }
          />
          <Route
            path="/niche-transfer"
            element={
              <Protected>
                <NicheTransferPrep />
              </Protected>
            }
          />
          <Route
            path="/niche-prospects"
            element={
              <Protected>
                <NicheFreshmanProspectsPrep />
              </Protected>
            }
          />
          <Route
            path="/niche-transfer-prospects"
            element={
              <Protected>
                <NicheTransferProspectsPrep />
              </Protected>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
