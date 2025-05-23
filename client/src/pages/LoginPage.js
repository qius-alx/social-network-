import React, { useState } from 'react';
// import { useNavigate } from 'react-router-dom'; // For redirection after login

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    // API call logic will be added later
    console.log('Login attempt with:', email, password);
    // On success:
    // localStorage.setItem('token', data.token);
    // localStorage.setItem('userId', data.userId);
    // navigate('/chat'); // or to homepage
  };

  return (
    <div>
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Email:</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label>Password:</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button type="submit">Login</button>
      </form>
    </div>
  );
};

export default LoginPage;
