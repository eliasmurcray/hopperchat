import React from "react";
import ReactDOM from "react-dom/client";
import firebaseConfig from "../firebaseconfig.json";
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { Formik, Form, Field, ErrorMessage } from "formik";
import "../css/index.css";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Create the new user with email and password
async function signupWithEmail(email: string, password: string): Promise<any> {
  localStorage.setItem("email", email);
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  window["user"] = user;
  return await sendEmailVerification(user, {
    url: window.location.origin + "/onboarding"
  });
}

// Form signup component
const EmailPasswordForm = (props: { onSuccess: () => void; }) => {
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
      setSubmitting(true);
      signupWithEmail(email, password)
      .then(() => {
        setSubmitting(false);
        props.onSuccess();
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
          <Field type="email" name="email" spellcheck="false" placeholder=" " pattern="^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$" required />
          <label htmlFor="email">Email</label>
        </div>
        <ErrorMessage name="email" component="div" className="error-message"/>
        <div className={"input-container"+(errors["new-password"]?" error":"")}>
          <Field type="password" name="new-password" autocomplete="new-password" pattern="^.{8,}$" placeholder=" " required />
          <label htmlFor="password">Password</label>
        </div>
        <ErrorMessage name="new-password" component="div" className="error-message" />
        <button type="submit" disabled={isSubmitting}>Continue</button>
      </Form>
    )}
  </Formik>);
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
      <EmailPasswordForm onSuccess={() => updateStep(0)}></EmailPasswordForm>
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