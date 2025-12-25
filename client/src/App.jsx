import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import CompanySetup from "./pages/CompanySetup";
import EmployeeOnboarding from "./pages/EmployeeOnboarding";
import ProductList from "./pages/ProductList";
import ProductCreate from "./pages/ProductCreate";
import ProductCustomFields from "./pages/ProductCustomFields";
import ProductExport from "./pages/ProductExport";
import ProductImport from "./pages/ProductImport";
import BrandsPage from "./pages/BrandsPage";
import CategoriesPage from "./pages/CategoriesPage";
import UnitsPage from "./pages/UnitsPage";
import WarehousesPage from "./pages/WarehousesPage";
import WarehouseAddStock from "./pages/WarehouseAddStock";
import InventoryPage from "./pages/InventoryPage";
import StockDetails from "./pages/StockDetails";
import PriceListsPage from "./pages/PriceListsPage";
import PromotionCreate from "./pages/PromotionCreate";
import PromotionsPage from "./pages/PromotionsPage";
import TaxRatesPage from "./pages/TaxRatesPage";
import CustomersPage from "./pages/CustomersPage";
import CustomerDetail from "./pages/CustomerDetail";
import CustomerFormPage from "./pages/CustomerFormPage";
import SuppliersPage from "./pages/SuppliersPage";
import RolesPage from "./pages/RolesPage";
import Dashboard from "./pages/Dashboard";
import Pos from "./pages/Pos";
import CustomerScreen from "./pages/CustomerScreen";
import ReceiptSettings from "./pages/ReceiptSettings";
import AccessoriesSettings from "./pages/AccessoriesSettings";
import PublicLayout from "./layouts/PublicLayout";
import DashboardLayout from "./layouts/DashboardLayout";
import PosLayout from "./layouts/PosLayout";
import RequireAuth from "./components/RequireAuth";
import PurchaseOrdersPage from "./pages/PurchaseOrdersPage";
import DirectPurchasesPage from "./pages/DirectPurchasesPage";
import { AuthProvider } from "./context/AuthContext";
import { ConfigProvider } from "./context/ConfigContext";
import { LanguageProvider } from "./context/LanguageContext";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LanguageProvider>
          <ConfigProvider>
            <Routes>
              <Route path="/customer-screen" element={<CustomerScreen />} />
              <Route element={<PublicLayout />}>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
              </Route>
              <Route element={<RequireAuth />}>
                <Route element={<DashboardLayout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/company/setup" element={<CompanySetup />} />
                  <Route
                    path="/employees/onboarding"
                    element={<EmployeeOnboarding />}
                  />
                  <Route path="/products" element={<ProductList />} />
                  <Route path="/products/new" element={<ProductCreate />} />
                  <Route path="/products/import" element={<ProductImport />} />
                  <Route
                    path="/products/custom-fields"
                    element={<ProductCustomFields />}
                  />
                  <Route path="/products/export" element={<ProductExport />} />
                  <Route path="/products/:id" element={<ProductCreate />} />
                  <Route path="/customers" element={<CustomersPage />} />
                  <Route path="/customers/:id" element={<CustomerDetail />} />
                  <Route path="/customers/new" element={<CustomerFormPage />} />
                  <Route
                    path="/customers/:id/edit"
                    element={<CustomerFormPage />}
                  />
                  <Route path="/suppliers" element={<SuppliersPage />} />
                  <Route path="/roles" element={<RolesPage />} />
                  <Route path="/brands" element={<BrandsPage />} />
                  <Route path="/categories" element={<CategoriesPage />} />
                  <Route path="/units" element={<UnitsPage />} />
                  <Route path="/warehouses" element={<WarehousesPage />} />
                  <Route
                    path="/warehouses/add-stock"
                    element={<WarehouseAddStock />}
                  />
                  <Route path="/inventory" element={<InventoryPage />} />
                  <Route
                    path="/inventory/:productId/:warehouseId/details"
                    element={<StockDetails />}
                  />
                  <Route
                    path="/purchase-orders"
                    element={<PurchaseOrdersPage />}
                  />
                  <Route
                    path="/direct-purchases"
                    element={<DirectPurchasesPage />}
                  />
                  <Route path="/price-lists" element={<PriceListsPage />} />
                  <Route path="/promotions/new" element={<PromotionCreate />} />
                  <Route path="/promotions" element={<PromotionsPage />} />
                  <Route path="/tax-rates" element={<TaxRatesPage />} />
                  <Route
                    path="/settings/receipts"
                    element={<ReceiptSettings />}
                  />
                  <Route
                    path="/settings/accessories"
                    element={<AccessoriesSettings />}
                  />
                </Route>
                <Route element={<PosLayout />}>
                  <Route path="/pos" element={<Pos />} />
                </Route>
              </Route>
            </Routes>
          </ConfigProvider>
        </LanguageProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
