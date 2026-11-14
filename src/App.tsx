import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import Layout from './components/Layout'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Home from './pages/Home'
import Suppliers from './pages/Suppliers'
import Materials from './pages/Materials'
import Purchases from './pages/Purchases'
import NewPurchase from './pages/NewPurchase'
import PurchaseDetail from './pages/PurchaseDetail'
import SupplierDetail from './pages/SupplierDetail'

export default function App() {
  const { session, company, loading } = useAuth()

  if (loading) return <p style={{ padding: 24 }}>Carregando...</p>
  if (!session) return <Login />
  if (!company) return <Onboarding />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="compras" element={<Purchases />} />
        <Route path="compras/nova" element={<NewPurchase />} />
        <Route path="fornecedores" element={<Suppliers />} />
        <Route path="materiais" element={<Materials />} />
        <Route path="*" element={<Navigate to="/" replace />} />
        <Route path="compras/:id" element={<PurchaseDetail />} />
        <Route path="fornecedores/:id" element={<SupplierDetail />} />
      </Route>
    </Routes>
  )
}