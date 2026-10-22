import React from 'react';
import {installTooltips} from './tooltips';
import { createRoot } from 'react-dom/client';
import App from './App';
import Learn from './Learn';
import {switchStorageScope} from './storage';
import {account} from './account';
import {installLibraryPolicy} from './library-access';
import {installNativePlatform} from './native-platform';
import {installNativeAccount} from './native-account';
import './style.css';
import './v2.css';
import './v3.css';
import './v4.css';
import './v5.css';
installNativePlatform();
installNativeAccount();
installTooltips();

const root=createRoot(document.getElementById('root')!);
if(new URLSearchParams(location.search).get('learn')==='1'){void(async()=>{const scope=new URLSearchParams(location.search).get('scope')||'';await switchStorageScope(scope);await account.restore();if(scope&&account.session?.user.id!==scope)throw Error('Sign in to this account in the main window.');installLibraryPolicy();root.render(<Learn/>);})().catch(e=>root.render(<p role="alert">{String(e)}</p>));}else root.render(<App/>);

import './v6.css';
import './v7.css';

import './v8.css';
import './v1.css';

import './v12.css';
import './v14.css';

import './v141.css';
import './v142.css';
import './v15.css';
