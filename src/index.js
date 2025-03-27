import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/global.css';
import './index.css';
import App from './App';

// Polyfill for react-native-web if missing
if (typeof window !== 'undefined' && !window.ReactNativeWebView) {
  window.ReactNativeWebView = {};
}

// Ensure Dimensions exists globally to prevent errors
if (typeof global !== 'undefined' && !global.Dimensions) {
  global.Dimensions = {
    get: (screen) => {
      return {
        width: window.innerWidth,
        height: window.innerHeight
      };
    }
  };
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);