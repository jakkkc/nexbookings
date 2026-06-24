import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { PropertiesPage } from './pages/PropertiesPage'
import { PropertyDetailPage } from './pages/PropertyDetailPage'
import { PropertyEditPage } from './pages/PropertyEditPage'
import { BookingsPage } from './pages/BookingsPage'
import { NewBookingPage } from './pages/NewBookingPage'
import { BookingDetailPage } from './pages/BookingDetailPage'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route path="/dashboard" element={
              <ProtectedRoute><DashboardPage /></ProtectedRoute>
            } />

            <Route path="/properties" element={
              <ProtectedRoute><PropertiesPage /></ProtectedRoute>
            } />
            <Route path="/properties/:id" element={
              <ProtectedRoute><PropertyDetailPage /></ProtectedRoute>
            } />
            <Route path="/properties/:id/edit" element={
              <ProtectedRoute allowedRoles={['owner', 'super_admin']}>
                <PropertyEditPage />
              </ProtectedRoute>
            } />

            <Route path="/bookings" element={
              <ProtectedRoute><BookingsPage /></ProtectedRoute>
            } />
            <Route path="/bookings/new" element={
              <ProtectedRoute><NewBookingPage /></ProtectedRoute>
            } />
            <Route path="/bookings/:id" element={
              <ProtectedRoute><BookingDetailPage /></ProtectedRoute>
            } />

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}