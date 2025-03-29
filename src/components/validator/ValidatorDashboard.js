import React, { useState } from 'react';
import { db } from '../../firebase/config';
import Header from '../common/Header';
import './ValidatorDashboard.css';
import logo from '../../assets/images/logo.png';

function ValidatorDashboard() {
  // ... existing code ...

  return (
    <div className="validator-dashboard">
      <Header />
      <div className="logo-container">
        <img src={logo} alt="Wave Logo" className="logo" />
      </div>
      {/* ... rest of the JSX ... */}
    </div>
  );
}

export default ValidatorDashboard; 