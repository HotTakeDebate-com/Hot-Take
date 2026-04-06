import { Component } from 'react';

/**
 * Catches render errors so a single bug doesn’t blank the whole app.
 * Users can recover without losing their session (until refresh).
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[Hot Take] UI error', error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-card">
            <h1 className="error-boundary-title">Something went wrong</h1>
            <p className="error-boundary-text">
              The page hit an unexpected error. Try reloading. If it keeps happening, contact support with
              what you were doing when it appeared.
            </p>
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
