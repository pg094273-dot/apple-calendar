import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryState {
  error: Error | null;
}

class ErrorBoundary extends React.Component<
  {children: React.ReactNode},
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {error: null};

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {error};
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: '24px',
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            color: '#1d1d1f',
          }}
        >
          <h2 style={{margin: '0 0 8px'}}>Error al cargar la aplicación</h2>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              background: '#f5f5f7',
              padding: '12px',
              borderRadius: '12px',
              fontSize: '13px',
            }}
          >
            {this.state.error.message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
