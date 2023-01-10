import React from "react";
import ReactDOM from "react-dom/client";
import LoginApp from "./login-app";

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

import firebaseConfig from "../firebaseconfig.json";
import "../css/onboarding.css";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

class App extends React.Component {

  onSuccess() {
    window.open("/", "_self");
  }

  render() {
    return <div className="step-container"><LoginApp onSuccess={this.onSuccess} auth={auth} /></div>
  }
}

const root = ReactDOM.createRoot(document.body);
root.render(<App/>);