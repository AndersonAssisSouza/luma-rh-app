import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'

import TrocarSenhaPage    from '@/pages/TrocarSenha'
import LoginPage          from '@/pages/Login'
import AppShell            from '@/components/layout/AppShell'
import DashboardPage       from '@/pages/Dashboard'
import ColaboradoresPage   from '@/pages/Colaboradores'
import ColaboradorFormPage from '@/pages/ColaboradorForm'
import AlertasPage         from '@/pages/Alertas'
import FeriasPage          from '@/pages/Ferias'
import SolicitarFeriasPage from '@/pages/SolicitarFerias'
import AprovarFeriasPage   from '@/pages/AprovarFerias'
import ExamesPage          from '@/pages/Exames'
import ContratosPJPage     from '@/pages/ContratosPJ'
import PeoplePage          from '@/pages/PeopleAnalytics'
import UsuariosPage        from '@/pages/Usuarios'
import OnboardingPage      from '@/pages/Onboarding'
import ConfigPage          from '@/pages/Configuracoes'

function RequireAuth({ children }) {
  const { user, loading } = useAuthStore()
  if (loading) return <FullScreenLoader />
  if (!user) return <Navigate to="/login" replace />
  return children
}

function FullScreenLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-luma-ink">
      <div className="flex flex-col items-center gap-4">
        <LumaLogo size={48} />
        <div className="flex gap-1.5">
          {[0,1,2].map(i => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-luma-purple animate-pulse-soft"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function LumaLogo({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="#9b66f4"/>
      <path d="M8 22 L14 10 L16 15 L18 10 L24 22" stroke="#ffd000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export default function App() {
  const init = useAuthStore(s => s.init)
  useEffect(() => { init() }, [init])

  return (
    <Routes>
      <Route path="/trocar-senha" element={<TrocarSenhaPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={
        <RequireAuth>
          <AppShell />
        </RequireAuth>
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"             element={<DashboardPage />} />
        <Route path="colaboradores"         element={<ColaboradoresPage />} />
        <Route path="colaboradores/novo"    element={<ColaboradorFormPage />} />
        <Route path="colaboradores/:id"     element={<ColaboradorFormPage />} />
        <Route path="alertas"               element={<AlertasPage />} />
        <Route path="ferias"                element={<FeriasPage />} />
        <Route path="ferias/solicitar"      element={<SolicitarFeriasPage />} />
        <Route path="ferias/aprovar"        element={<AprovarFeriasPage />} />
        <Route path="exames"                element={<ExamesPage />} />
        <Route path="contratos"             element={<ContratosPJPage />} />
        <Route path="analytics"             element={<PeoplePage />} />
        <Route path="usuarios"              element={<UsuariosPage />} />
        <Route path="onboarding"            element={<OnboardingPage />} />
        <Route path="configuracoes"         element={<ConfigPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

