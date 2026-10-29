import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorState } from '@/components/ui/ErrorState';

interface Props {
  children: ReactNode;
  /** Changing this value (e.g. the pathname) clears a caught error. */
  resetKey?: string;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
  resetKey?: string;
}

/** Catches rendering errors so one broken section never blanks the whole app. */
export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKey !== state.resetKey) return { error: null, resetKey: props.resetKey };
    return null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log for developers; users only see the friendly fallback below.
    console.error('HomeHub view error', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <ErrorState
            description="This view hit an unexpected problem. Your saved data is safe — try again, or go to another section."
            onRetry={() => this.setState({ error: null })}
          />
        )
      );
    }
    return this.props.children;
  }
}
