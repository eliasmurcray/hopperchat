import React from "react";
import ReactDOM from "react-dom/client";
import firebaseConfig from "../firebaseconfig.json";
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import "../css/index.css";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

class MyForm extends React.Component<{}, { [key:string]: any }> {
  constructor(props) {
    super(props);
    this.state = {
      errors: {
        "email": "",
        "new-password": "" 
      }
    };
    this.onInput = this.onInput.bind(this);
  }

  private async signupWithEmail(email: string, password: string): Promise<any> {
    localStorage.setItem("email", email);
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    window["user"] = user;
    return await sendEmailVerification(user, {
      url: window.location.origin + "/onboarding"
    });
  }

  onInput(event: { target: any; }) {
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
    return <form action="#" autoComplete="off">
      <div className={`input-container${this.state.errors.email?" error":""}`}>
        <input type="email" id="email" name="email" spellCheck="false" placeholder=" " pattern="^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$" onInput={this.onInput} required />
        <label htmlFor="email">Email</label>
      </div>
      <div className="error-message">{this.state.errors.email}</div>
      <div className={`input-container${this.state.errors["new-password"]?" error":""}`}>
        <input type="password" id="password" name="new-password" autoComplete="new-password" pattern="^.{8,}$" placeholder=" " onInput={this.onInput} required />
        <label htmlFor="password">Password</label>
      </div>
      <div className="error-message">{this.state.errors["new-password"]}</div>
      <button type="submit">Continue</button>
    </form>
  }
};
/*
class EmailPasswordForm extends React.Component<{ onSuccess: () => void }> {

  render() {
    return (<Formik
      initialValues={{ email: "", "new-password": ""}}
  
      validate={(values) => {
        const errors = {};
        if (values.email.length !== 0 && !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(values.email)) errors["email"] = "Invalid format";
        if (values["new-password"].length !== 0 && values["new-password"].length < 8) errors["new-password"] = "Password must be at least 8 characters";
        return errors;
      }}
  
      onSubmit={(values, { setSubmitting, setErrors }) => {
        const { email, "new-password": password } = values;
        this.signupWithEmail(email, password)
        .then(() => {
          setSubmitting(false);
          this.props.onSuccess();
        })
        .catch((error) => {
          switch(error.code) {
            case "auth/email-already-in-use":
              setErrors({ email: "Email already in use." });
              break;
            default:
              setErrors({ email: "", "new-password": error });
          }
          setSubmitting(false);
        });
      }}>
      {({isSubmitting, errors}) => (
        <Form autoComplete="off">
          <div className={"input-container"+(errors["email"]?" error":"")}>
            <Field type="email" id="email" name="email" spellcheck="false" placeholder=" " pattern="^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$" required />
            <label htmlFor="email">Email</label>
          </div>
          <ErrorMessage name="email" component="div" className="error-message"/>
          <div className={"input-container"+(errors["new-password"]?" error":"")}>
            <Field type="password" id="password" name="new-password" autocomplete="new-password" pattern="^.{8,}$" placeholder=" " required />
            <label htmlFor="password">Password</label>
          </div>
          <ErrorMessage name="new-password" component="div" className="error-message" />
          <button type="submit" disabled={isSubmitting}>Continue</button>
        </Form>
      )}
    </Formik>);
  }
};*/

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
      <MyForm></MyForm>
      {/* <EmailPasswordForm onSuccess={() => updateStep(0)}></EmailPasswordForm> */}
      <div className="small">Have an account? <a href="/login">Log In</a></div>
    </div>,
    <div className="step-container">
      <h2>Verify Your Email</h2>
      <div className="small">For your security</div>
      <div style={{ textAlign: "center", marginBottom: "16px" }}>We sent an email to {localStorage.getItem("email")}.<br/>Click the link inside to get started.</div>
      <EmailResendButton/>
    </div>
  ]);
  
  return elements[currentIndex];
}

const root = ReactDOM.createRoot(document.body);
root.render(<App/>);