import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import Layout from './components/Layout'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Home from './pages/Home'
import Purchases from './pages/Purchases'
import NewPurchase from './pages/NewPurchase'
import PurchaseDetail from './pages/PurchaseDetail'
import Sales from './pages/Sales'
import NewSale from './pages/NewSale'
import SaleDetail from './pages/SaleDetail'
import Suppliers from './pages/Suppliers'
import SupplierDetail from './pages/SupplierDetail'
import Customers from './pages/Customers'
import Materials from './pages/Materials'
import Team from './pages/Team'

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
        <Route path="compras/:id" element={<PurchaseDetail />} />
        <Route path="vendas" element={<Sales />} />
        <Route path="vendas/nova" element={<NewSale />} />
        <Route path="vendas/:id" element={<SaleDetail />} />
        <Route path="fornecedores" element={<Suppliers />} />
        <Route path="fornecedores/:id" element={<SupplierDetail />} />
        <Route path="clientes" element={<Customers />} />
        <Route path="materiais" element={<Materials />} />
        {company.role !== 'operator' && <Route path="equipe" element={<Team />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}