import { lazy, Suspense, useEffect, useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { InteractiveCart } from './components/ui/interactive-cart';
import { Navbar } from './components/Navbar';
import { useStore } from './store';
import { EntranceScreen } from './components/EntranceScreen';
import { AddToCartAnimation } from './components/ui/cart-animation';
import { authApi } from './lib/auth';
import { subscribeToProducts } from './lib/realtime';

const shouldBypassEntrance = (pathname: string) => pathname !== '/';
const HomePage = lazy(() => import('./components/HomePage').then((module) => ({ default: module.HomePage })));
const CheckoutPage = lazy(() => import('./components/CheckoutPage').then((module) => ({ default: module.CheckoutPage })));
const AdminPage = lazy(() => import('./components/AdminPage').then((module) => ({ default: module.AdminPage })));
const AuthPage = lazy(() => import('./components/AuthPage').then((module) => ({ default: module.AuthPage })));
const AccountPage = lazy(() => import('./components/AccountPage').then((module) => ({ default: module.AccountPage })));

const NewCartWrapper = () => {
  return (
    <div className="bg-bg-luxe min-h-screen text-white font-sans overflow-hidden">
      <Navbar />
      <InteractiveCart />
    </div>
  )
}

export default function App() {
  const navigate = useNavigate();
  const { setProducts, setUser } = useStore();
  const [hasEntered, setHasEntered] = useState(() => {
    if (typeof window === 'undefined') return true;

    return shouldBypassEntrance(window.location.pathname) || window.sessionStorage.getItem('velixa-entered') === 'true';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hasEntered) {
      window.sessionStorage.setItem('velixa-entered', 'true');
    }
  }, [hasEntered]);

  useEffect(() => {
    const unsubscribeProducts = subscribeToProducts(setProducts);
    const unsubscribeAuth = authApi.onAuthStateChanged(async (user) => {
      if (!user) {
        setUser(null);
        return;
      }

      try {
        const profile = await authApi.getProfile();
        setUser(profile);
      } catch {
        setUser({
          uid: user.uid,
          email: user.email,
          name: user.displayName,
          isAdmin: false,
        });
      }
    });

    return () => {
      unsubscribeProducts();
      unsubscribeAuth();
    };
  }, [setProducts, setUser]);

  const handleLoginSuccess = () => {
    if (typeof window !== 'undefined' && window.sessionStorage.getItem('velixa-post-order-created') === 'true') {
      navigate('/account');
      return;
    }

    navigate('/');
  };

  const renderRoutes = () => (
    <Suspense fallback={<div className="min-h-screen bg-bg-luxe" />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/cart" element={<NewCartWrapper />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/login" element={<AuthPage onSuccess={handleLoginSuccess} />} />
        <Route path="/admin/login" element={<AuthPage onSuccess={handleLoginSuccess} />} />
      </Routes>
    </Suspense>
  );

  return (
    <>
      <AddToCartAnimation />
      {!hasEntered && !shouldBypassEntrance(window.location.pathname) ? (
        <EntranceScreen onEnter={() => setHasEntered(true)} />
      ) : (
        renderRoutes()
      )}
    </>
  );
}
