import { Component } from "react";
import AppErrorFallback from "./AppErrorFallback";

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("AppErrorBoundary:", error, info);
  }

  render() {
    if (this.state.error) {
      return <AppErrorFallback message={String(this.state.error?.message || this.state.error || "Erro desconhecido")} />;
    }

    return this.props.children;
  }
}
