import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
            <div className="text-center">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Algo salió mal
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Recargá la página o intentá de nuevo más tarde.
              </p>
              <button
                onClick={() => {
                  this.setState({ hasError: false });
                  window.location.reload();
                }}
                className="rounded-xl bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700"
              >
                Recargar
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
