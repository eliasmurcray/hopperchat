import React from "react";
import ReactDOM from "react-dom/client";
import LoginApp from "./login-app";

import { initializeApp } from "firebase/app";
import { browserLocalPersistence, indexedDBLocalPersistence, initializeAuth } from "firebase/auth";

import firebaseConfig from "../firebaseconfig.json";
import "../css/onboarding.css";

const app = initializeApp(firebaseConfig);
const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence]
});

class App extends React.Component {

  onSuccess() {
    window.open("/chats", "_self");
  }

  render() {
    return <div className="step-container"><LoginApp onSuccess={this.onSuccess} auth={auth} /></div>
  }
}

const root = ReactDOM.createRoot(document.body);
root.render(<App/>);