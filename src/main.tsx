import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './ui/App.tsx';
import './styles/app.css';

const container = document.getElementById('root');
if (!container) throw new Error('找不到 #root');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
