import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout'; // Using the separated Layout component
import HomePage from './pages/HomePage';
import ChatPage from './pages/ChatPage';
import QnAPage from './pages/QnAPage';
import ProfilePage from './pages/ProfilePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import './App.css';

function App() {
  // Basic auth state simulation (replace with actual context/state management later)
  // const [isAuthenticated, setIsAuthenticated] = React.useState(!!localStorage.getItem('token'));

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}> {/* Layout wraps these routes */}
          <Route index element={<HomePage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="qna" element={<QnAPage />} />
          <Route path="profile/:userId" element={<ProfilePage />} />
        </Route>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        {/* Add other routes that don't need the main Navbar, or handle auth redirection */}
      </Routes>
    </Router>
  );
}

export default App;
