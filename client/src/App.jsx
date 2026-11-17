import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Services from './components/Services';
import Metals from './components/Metals';
const MetalDetail = lazy(() => import('./components/MetalDetail'));
import Footer from './components/Footer';
const InstantPricing = lazy(() => import('./pages/InstantPricing'));
const Quote = lazy(() => import('./pages/Quote'));
const Contact = lazy(() => import('./pages/Contact'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
import FAQ from './components/FAQ';
const FAQPage = lazy(() => import('./pages/FAQPage'));
const MetalsPage = lazy(() => import('./pages/MetalsPage'));
const Guidelines = lazy(() => import('./pages/Guidelines'));
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const Settings = lazy(() => import('./pages/Settings'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const MetalsList = lazy(() => import('./pages/admin/MetalsList'));
const MetalEdit = lazy(() => import('./pages/admin/MetalEdit'));
const CategoriesList = lazy(() => import('./pages/admin/CategoriesList'));
const FaqsList = lazy(() => import('./pages/admin/FaqsList'));
const FaqCategoriesList = lazy(() => import('./pages/admin/FaqCategoriesList'));
const ServicesList = lazy(() => import('./pages/admin/ServicesList'));
const ServiceEdit = lazy(() => import('./pages/admin/ServiceEdit'));
const ServiceDetail = lazy(() => import('./pages/ServiceDetail.jsx'));
const ServicesPage = lazy(() => import('./pages/ServicesPage.jsx'));
const AdminsList = lazy(() => import('./pages/admin/AdminsList'));
const EmailConfig = lazy(() => import('./pages/admin/EmailConfig'));
const SubscribersList = lazy(() => import('./pages/admin/SubscribersList'));
const ContactSettings = lazy(() => import('./pages/admin/ContactSettings'));
const AdminLayout = lazy(() => import('./components/admin/AdminLayout'));
const GuidelinesList = lazy(() => import('./pages/admin/GuidelinesList'));
const GuidelineEdit = lazy(() => import('./pages/admin/GuidelineEdit'));
const ServiceMetalsConfig = lazy(() => import('./pages/admin/ServiceMetalsConfig'));
const Customers = lazy(() => import('./pages/admin/Customers'));
const PricingManagement = lazy(() => import('./pages/admin/PricingManagement'));
const CostingAdmin = lazy(() => import('./pages/admin/costing/CostingAdmin'));
const TermsAndPolicy = lazy(() => import('./pages/admin/TermsAndPolicy'));
const HeroSections = lazy(() => import('./pages/admin/HeroSections'));
const SeoTracking = lazy(() => import('./pages/admin/SeoTracking'));
import SeoTrackingManager from './components/SeoTrackingManager';

import ProtectedRoute from './components/admin/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { AdminAuthProvider } from './context/AdminAuthContext';
import { ToastProvider } from './context/ToastContext';
import { CartProvider } from './context/CartProvider';

// New Pages
const Cart = lazy(() => import('./pages/Cart'));
const Checkout = lazy(() => import('./pages/Checkout'));
const Orders = lazy(() => import('./pages/Orders'));
const OrdersList = lazy(() => import('./pages/admin/orders/OrdersList'));
const OrderDetail = lazy(() => import('./pages/admin/orders/OrderDetail'));
const QuotesList = lazy(() => import('./pages/admin/quotes/QuotesList'));
const QuoteDetail = lazy(() => import('./pages/admin/quotes/QuoteDetail'));
const PaymentMethods = lazy(() => import('./pages/admin/PaymentMethods'));

const PublicShell = ({ children }) => (
  <div className="app-container" style={{ backgroundColor: '#ffffff' }}>
    <Navbar />
    <main className="main-content"><Suspense fallback={<div style={{ minHeight: '100vh' }} />}>{children}</Suspense></main>
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
              <SeoTrackingManager />
              {/* Pages load on first visit; the home page ships with the app. */}
              <Suspense fallback={<div style={{ minHeight: '100vh' }} />}>
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
                <Route path="/about" element={<PublicShell><AboutPage /></PublicShell>} />
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
                <Route path="/admin/seo" element={
                  <ProtectedRoute><AdminLayout><div className="px-desktop"><SeoTracking /></div></AdminLayout></ProtectedRoute>
                } />
                <Route path="/admin/costing/:tab?" element={
                  <ProtectedRoute><AdminLayout><div className="px-desktop"><CostingAdmin /></div></AdminLayout></ProtectedRoute>
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
                {/* The old pricing pages now live under Admin > Costing. */}
                <Route path="/admin/pricing-calculator" element={<Navigate to="/admin/costing/markups" replace />} />
                <Route path="/admin/laser-rates" element={<Navigate to="/admin/costing/laser-rates" replace />} />
                <Route path="/admin/sheet-cost-rates" element={<Navigate to="/admin/costing/sheet-costs" replace />} />
                <Route path="/admin/legal" element={
                  <ProtectedRoute><AdminLayout><div className="px-desktop"><TermsAndPolicy /></div></AdminLayout></ProtectedRoute>
                } />
                <Route path="/admin/orders" element={
                  <ProtectedRoute><AdminLayout><div className="px-desktop"><OrdersList /></div></AdminLayout></ProtectedRoute>
                } />
                <Route path="/admin/orders/:id" element={
                  <ProtectedRoute><AdminLayout><div className="px-desktop"><OrderDetail /></div></AdminLayout></ProtectedRoute>
                } />
                <Route path="/admin/quotes" element={
                  <ProtectedRoute><AdminLayout><div className="px-desktop"><QuotesList /></div></AdminLayout></ProtectedRoute>
                } />
                <Route path="/admin/quotes/:id" element={
                  <ProtectedRoute><AdminLayout><div className="px-desktop"><QuoteDetail /></div></AdminLayout></ProtectedRoute>
                } />

              </Routes>
              </Suspense>
            </Router>
          </CartProvider>
        </ToastProvider>
      </AuthProvider>
    </AdminAuthProvider>
  );
}

export default App;
