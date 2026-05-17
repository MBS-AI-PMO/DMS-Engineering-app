import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Services from './components/Services';
import Metals from './components/Metals';
import MetalDetail from './components/MetalDetail';
import Footer from './components/Footer';
import InstantPricing from './pages/InstantPricing';
import Quote from './pages/Quote';
import Contact from './pages/Contact';
import FAQ from './components/FAQ';
import FAQPage from './pages/FAQPage';
import MetalsPage from './pages/MetalsPage';
import Guidelines from './pages/Guidelines';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Settings from './pages/Settings';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import MetalsList from './pages/admin/MetalsList';
import MetalEdit from './pages/admin/MetalEdit';
import CategoriesList from './pages/admin/CategoriesList';
import FaqsList from './pages/admin/FaqsList';
import FaqCategoriesList from './pages/admin/FaqCategoriesList';
import ServicesList from './pages/admin/ServicesList';
import ServiceEdit from './pages/admin/ServiceEdit';
import ServiceDetail from './pages/ServiceDetail.jsx';
import ServicesPage from './pages/ServicesPage.jsx';
import AdminsList from './pages/admin/AdminsList';
import EmailConfig from './pages/admin/EmailConfig';
import SubscribersList from './pages/admin/SubscribersList';
import ContactSettings from './pages/admin/ContactSettings';
import AdminLayout from './components/admin/AdminLayout';
import GuidelinesList from './pages/admin/GuidelinesList';
import GuidelineEdit from './pages/admin/GuidelineEdit';
import ServiceMetalsConfig from './pages/admin/ServiceMetalsConfig';
import Customers from './pages/admin/Customers';
import PricingManagement from './pages/admin/PricingManagement';
import PricingCalculator from './pages/admin/PricingCalculator';
import LaserRatesAdmin from './pages/admin/LaserRatesAdmin';
import SheetCostRatesAdmin from './pages/admin/SheetCostRatesAdmin';
import TermsAndPolicy from './pages/admin/TermsAndPolicy';
import HeroSections from './pages/admin/HeroSections';

import ProtectedRoute from './components/admin/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { AdminAuthProvider } from './context/AdminAuthContext';
import { ToastProvider } from './context/ToastContext';
import { CartProvider } from './context/CartProvider';

// New Pages
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Orders from './pages/Orders';
import OrdersList from './pages/admin/OrdersList';
import PaymentMethods from './pages/admin/PaymentMethods';

const PublicShell = ({ children }) => (
  <div className="app-container" style={{ backgroundColor: '#ffffff' }}>
    <Navbar />
    <main className="main-content">{children}</main>
    <Footer />
  </div>
);

function App() {
  return (
    <AdminAuthProvider>
      <AuthProvider>
        <ToastProvider>
          <CartProvider>
            <Router>
              <ScrollToTop />
              <Routes>
                {/* Public site */}
                <Route path="/" element={
                  <PublicShell>
                    <Hero />
                    <Services />
                    <Metals />
                    <FAQ />
                  </PublicShell>
                } />
                <Route path="/metal/:slug" element={<PublicShell><MetalDetail /></PublicShell>} />
                <Route path="/metal-by-id/:id" element={<PublicShell><MetalDetail /></PublicShell>} />
                <Route path="/get-instant-pricing" element={<PublicShell><InstantPricing /></PublicShell>} />
                <Route path="/quote" element={<PublicShell><Quote /></PublicShell>} />
                <Route path="/contact" element={<PublicShell><Contact /></PublicShell>} />
                <Route path="/faq" element={<PublicShell><FAQPage /></PublicShell>} />
                <Route path="/metals" element={<PublicShell><MetalsPage /></PublicShell>} />
                <Route path="/guidelines" element={<PublicShell><Guidelines /></PublicShell>} />
                <Route path="/service/:slug" element={<PublicShell><ServiceDetail /></PublicShell>} />
                <Route path="/services" element={<PublicShell><ServicesPage /></PublicShell>} />
                <Route path="/privacy-policy" element={<PublicShell><PrivacyPolicy /></PublicShell>} />
                <Route path="/terms-of-service" element={<PublicShell><TermsOfService /></PublicShell>} />

                {/* Auth */}
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/settings" element={<PublicShell><Settings /></PublicShell>} />
                <Route path="/cart" element={<PublicShell><Cart /></PublicShell>} />
                <Route path="/checkout" element={<PublicShell><Checkout /></PublicShell>} />
                <Route path="/orders" element={<PublicShell><Orders /></PublicShell>} />

                {/* Admin */}
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/admin" element={
                  <ProtectedRoute><AdminLayout><div className="px-desktop"><AdminDashboard /></div></AdminLayout></ProtectedRoute>
                } />
                <Route path="/admin/metals" element={
                  <ProtectedRoute><AdminLayout><div className="px-desktop"><MetalsList /></div></AdminLayout></ProtectedRoute>
                } />
                <Route path="/admin/metals/new" element={
                  <ProtectedRoute><AdminLayout><div className="px-desktop"><MetalEdit /></div></AdminLayout></ProtectedRoute>
                } />
                <Route path="/admin/metals/:slug" element={
                  <ProtectedRoute><AdminLayout><div className="px-desktop"><MetalEdit /></div></AdminLayout></ProtectedRoute>
                } />
                <Route path="/admin/categories" element={
                  <ProtectedRoute><AdminLayout><div className="px-desktop"><CategoriesList /></div></AdminLayout></ProtectedRoute>
                } />
                <Route path="/admin/faqs" element={
                  <ProtectedRoute><AdminLayout><div className="px-desktop"><FaqsList /></div></AdminLayout></ProtectedRoute>
                } />
                <Route path="/admin/faq-categories" element={
                  <ProtectedRoute><AdminLayout><div className="px-desktop"><FaqCategoriesList /></div></AdminLayout></ProtectedRoute>
                } />
                <Route path="/admin/services" element={
                  <ProtectedRoute><AdminLayout><div className="px-desktop"><ServicesList /></div></AdminLayout></ProtectedRoute>
                } />
                <Route path="/admin/hero-sections" element={
  <ProtectedRoute>
    <AdminLayout>
      <div className="px-desktop">
        <HeroSections />
      </div>
    </AdminLayout>
  </ProtectedRoute>
} />
                <Route path="/admin/services/new" element={
                  <ProtectedRoute><AdminLayout><div className="px-desktop"><ServiceEdit /></div></AdminLayout></ProtectedRoute>
                } />
                <Route path="/admin/services/:id" element={
                  <ProtectedRoute><AdminLayout><div className="px-desktop"><ServiceEdit /></div></AdminLayout></ProtectedRoute>
                } />
                <Route path="/admin/services/:id/metals" element={
                  <ProtectedRoute><AdminLayout><div className="px-desktop"><ServiceMetalsConfig /></div></AdminLayout></ProtectedRoute>
                } />
                <Route path="/admin/admins" element={
                  <ProtectedRoute><AdminLayout><div className="px-desktop"><AdminsList /></div></AdminLayout></ProtectedRoute>
                } />
                <Route path="/admin/email" element={
                  <ProtectedRoute><AdminLayout><div className="px-desktop"><EmailConfig /></div></AdminLayout></ProtectedRoute>
                } />
                <Route path="/admin/payment" element={
                  <ProtectedRoute><AdminLayout><div className="px-desktop"><PaymentMethods /></div></AdminLayout></ProtectedRoute>
                } />
                <Route path="/admin/subscribers" element={
                  <ProtectedRoute><AdminLayout><div className="px-desktop"><SubscribersList /></div></AdminLayout></ProtectedRoute>
                } />
                <Route path="/admin/contact" element={
                  <ProtectedRoute><AdminLayout><div className="px-desktop"><ContactSettings /></div></AdminLayout></ProtectedRoute>
                } />
                <Route path="/admin/guidelines" element={
                  <ProtectedRoute><AdminLayout><div className="px-desktop"><GuidelinesList /></div></AdminLayout></ProtectedRoute>
                } />
                <Route path="/admin/guidelines/:serviceId" element={
                  <ProtectedRoute><AdminLayout><div className="px-desktop"><GuidelineEdit /></div></AdminLayout></ProtectedRoute>
                } />
                <Route path="/admin/customers" element={
                  <ProtectedRoute><AdminLayout><div className="px-desktop"><Customers /></div></AdminLayout></ProtectedRoute>
                } />
                <Route path="/admin/pricing" element={
                  <ProtectedRoute><AdminLayout><div className="px-desktop"><PricingManagement /></div></AdminLayout></ProtectedRoute>
                } />
                <Route path="/admin/pricing-calculator" element={
                  <ProtectedRoute><AdminLayout><div className="px-desktop"><PricingCalculator /></div></AdminLayout></ProtectedRoute>
                } />
                <Route path="/admin/laser-rates" element={
                  <ProtectedRoute><AdminLayout><div className="px-desktop"><LaserRatesAdmin /></div></AdminLayout></ProtectedRoute>
                } />
                <Route path="/admin/sheet-cost-rates" element={
                  <ProtectedRoute><AdminLayout><div className="px-desktop"><SheetCostRatesAdmin /></div></AdminLayout></ProtectedRoute>
                } />
                <Route path="/admin/legal" element={
                  <ProtectedRoute><AdminLayout><div className="px-desktop"><TermsAndPolicy /></div></AdminLayout></ProtectedRoute>
                } />
                <Route path="/admin/orders" element={
                  <ProtectedRoute><AdminLayout><div className="px-desktop"><OrdersList /></div></AdminLayout></ProtectedRoute>
                } />

              </Routes>
            </Router>
          </CartProvider>
        </ToastProvider>
      </AuthProvider>
    </AdminAuthProvider>
  );
}

export default App;
