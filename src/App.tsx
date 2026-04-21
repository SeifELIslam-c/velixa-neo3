import { Routes, Route, useNavigate } from 'react-router-dom';
import { HomePage } from './components/HomePage';
import { CheckoutPage } from './components/CheckoutPage';
import { AdminPage } from './components/AdminPage';
import { AuthPage } from './components/AuthPage';
import { AccountPage } from './components/AccountPage';
import { InteractiveCart } from './components/ui/interactive-cart';
import { Navbar } from './components/Navbar';
import { useStore } from './store';
import { EntranceScreen } from './components/EntranceScreen';
import { AddToCartAnimation } from './components/ui/cart-animation';
import { useEffect, useState } from 'react';
import { authApi } from './lib/auth';
import { subscribeToProducts } from './lib/realtime';

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
    return window.location.pathname.startsWith('/admin') || window.location.pathname.startsWith('/login');
  });

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
    navigate('/');
  };

  return (
    <>
      <AddToCartAnimation />
      {!hasEntered ? (
        <EntranceScreen onEnter={() => setHasEntered(true)} />
      ) : (
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/cart" element={<NewCartWrapper />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/login" element={<AuthPage onSuccess={handleLoginSuccess} />} />
          <Route path="/admin/login" element={<AuthPage onSuccess={handleLoginSuccess} />} />
        </Routes>
      )}
    </>
  );
}
