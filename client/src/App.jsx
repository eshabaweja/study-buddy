import { useEffect } from 'react';
// import { useState } from 'react';
// import LandingPage from './pages/LandingPage';
import { BaRoutes } from './BaRoutes';
import OsuNavbar from "./components/OsuNavbar"
import Header from "./components/Header"
import MenuDefault from "./components/MenuDefault"
import FooterDefault from './components/FooterDefault';
import { AuthProvider } from './contexts/AuthContext';
import { ToastContainer } from 'react-toastify';

function App() {
  // const [count, setCount] = useState(0)
  useEffect(() => {
    // Dynamically add <script> tag to load bux.js
    const script = document.createElement("script");
    script.src = "/js/bux.js";
    script.type = "text/javascript";
    script.async = true;

    document.body.appendChild(script);

    return () => {
      // Cleanup: Remove script on unmount
      document.body.removeChild(script);
    };
  }, []);
  
  return (
    <AuthProvider>
      <OsuNavbar/>
      <Header/>
      <MenuDefault/>
      <BaRoutes/>
      <FooterDefault/>
      <ToastContainer/>
    </AuthProvider>
  )
}

export default App 