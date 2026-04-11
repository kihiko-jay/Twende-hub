import React from "react";
import { Link } from "react-router-dom";

interface AppErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  info?: React.ErrorInfo;
  showDetails: boolean;
}

export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  AppErrorBoundaryState
> {
  declare props: Readonly<{ children: React.ReactNode }>;

  declare setState: (
    state:
      | Partial<AppErrorBoundaryState>
      | ((
          prevState: Readonly<AppErrorBoundaryState>,
        ) => Partial<AppErrorBoundaryState>),
    callback?: () => void,
  ) => void;

  state: AppErrorBoundaryState = { hasError: false, showDetails: false };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error, showDetails: false };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("Uncaught error in React tree", { error, errorInfo });
    this.setState({ info: errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  toggleDetails = () => {
    this.setState((prev) => ({ ...prev, showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      const isDev = import.meta.env.DEV;

      return (
        <div className="min-h-screen flex items-center justify-center bg-warm-off-white px-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-md border border-stone-200 p-8 space-y-4 text-center">
            <h1 className="text-2xl font-serif font-bold text-stone-900">
              Something went wrong
            </h1>
            <p className="text-sm text-stone-600">
              The page crashed unexpectedly. You can try again or return to the home page.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="px-5 py-2 rounded-full bg-olive-drab text-white text-sm font-medium hover:bg-olive-drab/90"
              >
                Try Again
              </button>
              <Link
                to="/"
                className="px-5 py-2 rounded-full border border-stone-300 text-sm font-medium text-stone-700 hover:bg-stone-50"
              >
                Go Home
              </Link>
            </div>
            {isDev && (
              <div className="pt-4 text-left">
                <button
                  type="button"
                  onClick={this.toggleDetails}
                  className="text-xs text-stone-500 hover:text-stone-800 underline"
                >
                  {this.state.showDetails ? "Hide error details" : "Show error details"}
                </button>
                {this.state.showDetails && this.state.error && (
                  <pre className="mt-2 max-h-48 overflow-auto text-xs bg-stone-50 border border-stone-200 rounded-xl p-3 text-left whitespace-pre-wrap">
                    {this.state.error?.message}
                    {"\n"}
                    {this.state.info?.componentStack}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

