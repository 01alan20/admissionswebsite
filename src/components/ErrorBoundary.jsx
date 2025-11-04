import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(p){ super(p); this.state = { hasError:false, error:null }; }
  static getDerivedStateFromError(error){ return { hasError:true, error }; }
  render(){
    if(this.state.hasError){
      return <div style={{padding:24}}>
        <h3>Failed to load this page.</h3>
        <pre style={{whiteSpace:"pre-wrap"}}>{String(this.state.error)}</pre>
      </div>;
    }
    return this.props.children;
  }
}
