import React from 'react';
import ReactDOM from 'react-dom/client';
import { applyThemeVars } from '@qzd/shared/ui/theme';
import App from './App';
import './styles.css';

applyThemeVars();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
