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
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import MetalsList from './pages/admin/MetalsList';
import MetalEdit from './pages/admin/MetalEdit';
import CategoriesList from './pages/admin/CategoriesList';
import FaqsList from './pages/admin/FaqsList';
import FaqCategoriesList from './pages/admin/FaqCategoriesList';
import ServicesList from './pages/admin/ServicesList';
import AdminsList from './pages/admin/AdminsList';
import EmailConfig from './pages/admin/EmailConfig';
import SubscribersList from './pages/admin/SubscribersList';
import ContactSettings from './pages/admin/ContactSettings';
import AdminLayout from './components/admin/AdminLayout';
import ProtectedRoute from './components/admin/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';

const PublicShell = ({ children }) => (
  <div className="app-container">
    <Navbar />
    <main className="main-content">{children}</main>
    <Footer />
  </div>
);

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
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

            {/* Admin */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={
              <ProtectedRoute><AdminLayout><AdminDashboard /></AdminLayout></ProtectedRoute>
            } />
            <Route path="/admin/metals" element={
              <ProtectedRoute><AdminLayout><MetalsList /></AdminLayout></ProtectedRoute>
            } />
            <Route path="/admin/metals/new" element={
              <ProtectedRoute><AdminLayout><MetalEdit /></AdminLayout></ProtectedRoute>
            } />
            <Route path="/admin/metals/:slug" element={
              <ProtectedRoute><AdminLayout><MetalEdit /></AdminLayout></ProtectedRoute>
            } />
            <Route path="/admin/categories" element={
              <ProtectedRoute><AdminLayout><CategoriesList /></AdminLayout></ProtectedRoute>
            } />
            <Route path="/admin/faqs" element={
              <ProtectedRoute><AdminLayout><FaqsList /></AdminLayout></ProtectedRoute>
            } />
            <Route path="/admin/faq-categories" element={
              <ProtectedRoute><AdminLayout><FaqCategoriesList /></AdminLayout></ProtectedRoute>
            } />
            <Route path="/admin/services" element={
              <ProtectedRoute><AdminLayout><ServicesList /></AdminLayout></ProtectedRoute>
            } />
            <Route path="/admin/admins" element={
              <ProtectedRoute><AdminLayout><AdminsList /></AdminLayout></ProtectedRoute>
            } />
            <Route path="/admin/email" element={
              <ProtectedRoute><AdminLayout><EmailConfig /></AdminLayout></ProtectedRoute>
            } />
            <Route path="/admin/subscribers" element={
              <ProtectedRoute><AdminLayout><SubscribersList /></AdminLayout></ProtectedRoute>
            } />
            <Route path="/admin/contact" element={
              <ProtectedRoute><AdminLayout><ContactSettings /></AdminLayout></ProtectedRoute>
            } />
          </Routes>
        </Router>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
