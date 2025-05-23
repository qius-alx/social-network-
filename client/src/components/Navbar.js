import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

const Navbar = () => {
  const navigate = useNavigate();
  // Simulate auth state and user data, replace with actual context/logic later
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('userId'); // Assuming userId is stored on login

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    // Add logic to inform backend if necessary (e.g., invalidate session/token on server)
    navigate('/login');
    // Consider a page reload or state update to reflect logout
    window.location.reload(); // Simple way to refresh state
  };

  return (
    <nav style={{ padding: '1rem', background: '#eee', display: 'flex', justifyContent: 'space-between' }}>
      <div>
        <Link to="/" style={{ marginRight: '1rem' }}>Home</Link>
        {token && <Link to="/chat" style={{ marginRight: '1rem' }}>Chat</Link>}
        {token && <Link to="/qna" style={{ marginRight: '1rem' }}>Q&A</Link>}
      </div>
      <div>
        {token ? (
          <>
            {userId && <Link to={`/profile/${userId}`} style={{ marginRight: '1rem' }}>My Profile</Link>}
            <button onClick={handleLogout}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/login" style={{ marginRight: '1rem' }}>Login</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
