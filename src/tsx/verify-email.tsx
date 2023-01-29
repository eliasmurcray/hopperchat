import React, { Component } from "react";
import ReactDOM from "react-dom/client";
import LoginApp from "./login-app";
import firebaseConfig from "../firebaseconfig.json";
import { initializeApp } from "firebase/app";
import { browserLocalPersistence, indexedDBLocalPersistence, initializeAuth, onAuthStateChanged, sendEmailVerification } from "firebase/auth";
import "../css/index.css";

const app = initializeApp(firebaseConfig);
const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence]
});

onAuthStateChanged(auth, (user) => {
  window["user"] = user;
  window["email"] = user?.email;
});

const EmailResendButton = () => {
  const [emailResent, setEmailResent] = React.useState(false);
  const [isLoading, setLoading] = React.useState(false);
  const resendEmail = () => {
      if(emailResent) return;
      setLoading(true);
      sendEmailVerification(window["user"], {
        url: window.location.origin + "/onboarding"
      })
      .then(() => {
        setEmailResent(true)
      })
      .catch(console.error);
    };
  return emailResent === true ? (<div>Email Sent</div>) : isLoading ? (<button className="button-link">Sending</button>) : (<button className="button-link" onClick={resendEmail}>Resend email</button>);
};

class App extends Component {

  state = {
    elements: [
      <div className="step-container">
        <LoginApp
          auth={auth}
          onSuccess={() => {
            this.updateStep(1);
          }}/>
      </div>,
      <div className="step-container">
        <h2>Verify Your Email</h2>
        <div className="small">For your security</div>
        <div style={{ textAlign: "center", marginBottom: "16px" }}>We sent an email to {window["email"]}.<br/>Click the link inside to get started.</div>
        <EmailResendButton/>
      </div>
    ],
    currentStep: 0
  }

  updateStep(stepNum: number) {
    const component = this;
    return new Promise((resolve) => {
      const initialStep = component.state.currentStep;
      component.setState({
        elements: (component.state.elements.map((element, i) => 
      i === initialStep ? (console.log(element, i), React.cloneElement(element, {
      className: "step-container fade-out",
      onAnimationEnd() {
        component.setState({
          currentStep: stepNum,
          elements: (component.state.elements.map((element) => React.cloneElement(element, { className: "step-container", onAnimationEnd(){} })))
        });
      }
      })) : element))});
      resolve(0);
    });
  }

  render() {
    return this.state.elements[this.state.currentStep];
  }
}

const root = ReactDOM.createRoot(document.body);
root.render(<App />);