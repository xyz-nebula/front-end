import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { ActivationRoute, GuestRoute, ProtectedRoute } from '@/components/auth/RouteGate'

const ActivatePage = lazy(() => import('@/pages/ActivatePage').then((module) => ({ default: module.ActivatePage })))
const ArenaPage = lazy(() => import('@/pages/ArenaPage').then((module) => ({ default: module.ArenaPage })))
const HomePage = lazy(() => import('@/pages/HomePage').then((module) => ({ default: module.HomePage })))
const LandingPage = lazy(() => import('@/pages/LandingPage').then((module) => ({ default: module.LandingPage })))
const LoginPage = lazy(() => import('@/pages/LoginPage').then((module) => ({ default: module.LoginPage })))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })))
const PreparationPage = lazy(() => import('@/pages/PreparationPage').then((module) => ({ default: module.PreparationPage })))
const ProtectedProductShell = lazy(() => import('@/pages/ProtectedProductShell').then((module) => ({ default: module.ProtectedProductShell })))
const RegisterPage = lazy(() => import('@/pages/RegisterPage').then((module) => ({ default: module.RegisterPage })))
const ResultPage = lazy(() => import('@/pages/ResultPage').then((module) => ({ default: module.ResultPage })))

function ScrollToLocation() {
  const { hash, pathname } = useLocation()

  useEffect(() => {
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView()
      return
    }

    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [hash, pathname])

  return null
}

export function App() {
  return (
    <>
      <ScrollToLocation />
      <Suspense fallback={<main className="route-loading" role="status" aria-label="Загружаем страницу"><span /></main>}>
        <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
        <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
        <Route path="/activate" element={<ActivationRoute><ActivatePage /></ActivationRoute>} />
        <Route element={<ProtectedRoute><ProtectedProductShell /></ProtectedRoute>}>
          <Route path="/home" element={<HomePage />} />
          <Route path="/cases/:caseId/preparation" element={<PreparationPage />} />
          <Route path="/arena/:sessionId" element={<ArenaPage />} />
          <Route path="/result/:sessionId" element={<ResultPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </>
  )
}
