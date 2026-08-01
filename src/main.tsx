/**
 * Entry point. Nothing but mounting — every decision the app makes lives further in.
 *
 * The ErrorBoundary sits *inside* StrictMode rather than around it so that the boundary
 * itself is subject to the same double-invoked-render checks as the rest of the tree.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@/App';
import { ErrorBoundary } from '@/components/ErrorBoundary';

import './index.css';

const host = document.getElementById('root');
if (!host) {
  // Only reachable if index.html and this file have drifted apart, which is a build
  // problem rather than a runtime one — fail loudly instead of silently doing nothing.
  throw new Error('Meridian: no #root element to mount into.');
}

createRoot(host).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
