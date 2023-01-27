import React from "react";
import ReactDOM from "react-dom/client";
import firebaseConfig from "../firebaseconfig.json";
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import "../css/index.css";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

async function signupWithEmail(email: string, password: string): Promise<any> {
  localStorage.setItem("email", email);
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  window["user"] = user;
  return await sendEmailVerification(user, {
    url: window.location.origin + "/onboarding"
  });
}

class EmailPasswordForm extends React.Component<{ onSuccess: () => void }> {
  private emailRef: React.RefObject<HTMLInputElement>;
  private passwordRef: React.RefObject<HTMLInputElement>;
  
  constructor(props: { onSuccess: () => void; } | Readonly<{ onSuccess: () => void; }>) {
    super(props);
    this.emailRef = React.createRef();
    this.passwordRef = React.createRef();
    this.handleInput = this.handleInput.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }
  
  state = {
    errors: {
      "email": "",
      "new-password": "" 
    }
  };

  handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = this.emailRef.current.value;
    const password = this.passwordRef.current.value;
    localStorage.setItem("email", email);

    signupWithEmail(email, password)
    .then(() => {
      this.props.onSuccess();
    })
    .catch((error) => {
      switch(error.code) {
        case "auth/email-already-in-use":
          this.setState({ errors: { email: "Email already in use." } });
          break;
        default:
          this.setState({ errors: { email: "", "new-password": error } });
      }
    });
  }

  handleInput(event: { target: any; }) {
    const element = event.target;
    const name = element.name;
    const value = element.value;
    this.setState({ errors: {} });
    switch(name) {
      case "email":
        if(value.length !== 0 && !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value))
          this.setState({ errors: { "email": "Invalid format" }});
        break;
      case "new-password":
        if(value.length !== 0 && value.length < 8)
          this.setState({ errors: { "new-password": "Password must be at least 8 characters" }});
    }
  }

  render() {
    return <form action="#" autoComplete="off" onSubmit={this.handleSubmit}>
      <div className={`input-container${this.state.errors.email?" error":""}`}>
        <input type="email" ref={this.emailRef} id="email" name="email" spellCheck="false" placeholder=" " pattern="^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$" onInput={this.handleInput} required />
        <label htmlFor="email">Email</label>
      </div>
      <div className="error-message">{this.state.errors.email}</div>
      <div className={`input-container${this.state.errors["new-password"]?" error":""}`}>
        <input type="password" ref={this.passwordRef} id="password" name="new-password" autoComplete="new-password" pattern="^.{8,}$" placeholder=" " onInput={this.handleInput} required />
        <label htmlFor="password">Password</label>
      </div>
      <div className="error-message">{this.state.errors["new-password"]}</div>
      <button type="submit">Continue</button>
    </form>
  }
};

const EmailResendButton = () => {
  const [emailResent, setEmailResent] = React.useState(false);
  const [isLoading, setLoading] = React.useState(false);
  const resendEmail = () => {
      if(emailResent) return;
      setLoading(true);
      sendEmailVerification(window["user"], {
        url: window.location.origin + "/onboarding"
      })
      .then(() => setEmailResent(true))
      .catch(console.error);
    };
  return emailResent === true ? (<div>Email Sent</div>) : isLoading ? (<button className="button-link">Sending</button>) : (<button className="button-link" onClick={resendEmail}>Resend email</button>);
};

const App = () => {
  const [currentIndex, setCurrentIndex] = React.useState(0);

  const updateStep = (index: number) => {
    setElements(elements.map((element, i) => 
    i === index ? React.cloneElement(element, {
    className: "step-container fade-out",
    onAnimationEnd() {
      setCurrentIndex(index + 1);
    }
    }) : element));
  };

  const [elements, setElements] = React.useState([
    <div className="step-container">
      <h1>Create Your Account</h1>
      <div className="small">Enter your email</div>
      <EmailPasswordForm onSuccess={() => updateStep(0)} />
      <div className="small">Have an account? <a href="/login">Log In</a></div>
    </div>,
    <div className="step-container">
      <h2>Verify Your Email</h2>
      <div className="small">For your security</div>
      <div style={{ textAlign: "center", marginBottom: "16px" }}>We sent an email to {localStorage.getItem("email")}.<br/>Click the link inside to get started.</div>
      <EmailResendButton />
    </div>
  ]);
  
  return elements[currentIndex];
}

const root = ReactDOM.createRoot(document.body);
root.render(<App/>);