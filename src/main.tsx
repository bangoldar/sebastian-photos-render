import React from 'react';
import {createRoot} from 'react-dom/client';
import Portfolio from './Portfolio';
import Dashboard from './Dashboard';
import {defaultPhotos,defaults,defaultPageCopy} from './content';
import './style.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode>{location.pathname.replace(/\/+$/, '')==='/admin'?<Dashboard/>:<Portfolio initial={{photos:defaultPhotos,packages:defaults,pageCopy:defaultPageCopy}}/>}</React.StrictMode>);
