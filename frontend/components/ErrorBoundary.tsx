import React from "react";

type Props = {
  children: React.ReactNode;
};

type State = {
  error: Error | null;
};

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Unhandled UI error", error, info);
  }

  render() {
    if (this.state.error) {
      const message = this.state.error?.message || "Unknown error";
      return (
        <div className="p-6 sm:p-10">
          <div className="max-w-2xl mx-auto bg-white border border-red-200 rounded-xl shadow-sm p-6">
            <div className="text-sm font-semibold text-red-700">Something went wrong</div>
            <div className="mt-2 text-slate-700">
              This page failed to load. Please refresh, or try a different page from the sidebar.
            </div>
            <div className="mt-3 text-xs text-slate-500 break-all">
              Error details: {message}
            </div>
            <div className="mt-4">
              <button
                type="button"
                className="inline-flex items-center rounded-lg bg-brand-secondary px-4 py-2 text-white text-sm font-semibold shadow-sm hover:bg-brand-primary transition"
                onClick={() => window.location.reload()}
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
