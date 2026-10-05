import React from 'react';
import {installTooltips} from './tooltips';
import { createRoot } from 'react-dom/client';
import App from './App';
import Learn from './Learn';
import {installNativePlatform} from './native-platform';
import './style.css';
import './v2.css';
import './v3.css';
import './v4.css';
import './v5.css';
installNativePlatform();
installTooltips();

createRoot(document.getElementById('root')!).render(new URLSearchParams(location.search).get('learn') === '1' ? <Learn /> : <App />);

import './v6.css';
import './v7.css';

import './v8.css';
import './v1.css';

import './v12.css';
import './v14.css';

import './v141.css';
import './v142.css';
