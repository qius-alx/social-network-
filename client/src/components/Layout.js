import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar'; // Assuming Navbar.js is in the same directory

const Layout = () => {
  return (
    <>
      <Navbar />
      <div className="container">
        <Outlet /> {/* Child routes will render here */}
      </div>
    </>
  );
};

export default Layout;
