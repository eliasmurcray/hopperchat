import React from "react";
import { Auth, signInWithEmailAndPassword, RecaptchaVerifier, PhoneAuthProvider, PhoneMultiFactorGenerator, getMultiFactorResolver } from "firebase/auth";

class LoginForm extends React.Component<{ auth: Auth, onSuccess: any, onError: (value: Error) => any }> {
  private emailRef: React.RefObject<HTMLInputElement>;
  private passwordRef: React.RefObject<HTMLInputElement>;
  
  constructor(props: { auth: Auth; onSuccess: any; onError: (value: Error) => any; } | Readonly<{ auth: Auth; onSuccess: any; onError: (value: Error) => any; }>) {
    super(props);
    this.emailRef = React.createRef();
    this.passwordRef = React.createRef();
    this.handleInput = this.handleInput.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }
  
  state = {
    errors: {
      "email": "",
      "password": "" 
    }
  };

  async handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(this.state.errors.email || this.state.errors.password) return console.warn("There are errors in your form.");
    const email = this.emailRef.current.value;
    const password = this.passwordRef.current.value;
    const component = this;
    signInWithEmailAndPassword(this.props.auth, email, password)
    .then(() => {
      console.log("Login success!");
      component.props.onSuccess();
    })
    .catch(component.props.onError);
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
          this.setState({ errors: { "password": "Password must be at least 8 characters" }});
    }
  }

  render() {
    return <form action="#" autoComplete="off" onSubmit={this.handleSubmit}>
        <div className={`input-container${this.state.errors.email?" error":""}`}>
          <input type="email" ref={this.emailRef} id="email" name="email" spellCheck="false" placeholder=" " pattern="^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$" onInput={this.handleInput} required />
          <label htmlFor="email">Email</label>
        </div>
        <div className="error-message">{this.state.errors.email}</div>
        <div className={`input-container${this.state.errors.password?" error":""}`}>
          <input type="password" ref={this.passwordRef} id="password" name="password" autoComplete="password" pattern="^.{8,}$" placeholder=" " onInput={this.handleInput} required />
          <label htmlFor="password">Password</label>
        </div>
        <div className="error-message">{this.state.errors["password"]}</div>
        <button type="submit">Continue</button>
      </form>;
  }
};

class SMSLogin extends React.Component<{ onSuccess: () => void }> {
  private smsRef: React.RefObject<HTMLInputElement>;

  constructor(props: { onSuccess: () => void; } | Readonly<{ onSuccess: () => void; }>) {
    super(props);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.smsRef = React.createRef();
  }

  state = {
    smsError: ""
  }

  async handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const verificationCode = this.smsRef.current.value;
    const component = this;
    if(verificationCode.length !== 6) return this.setState({ smsError: "oh no!" });

    const cred = PhoneAuthProvider.credential(window["verificationId"], verificationCode);
    const multiFactorAssertion = PhoneMultiFactorGenerator.assertion(cred);

    window["resolver"].resolveSignIn(multiFactorAssertion)
    .then(() => {
      component.props.onSuccess();
    })
    .catch((error) => {
      this.setState({ smsError: error.code });
      console.info(error);
    });
  }

  handleInput(event: { target: any }) {
    event.target.value = event.target.value.replace(/[^\d]/g, '');
  }

  render() {
    return <form action="#" autoComplete="off" onSubmit={this.handleSubmit}>
      <div className="input-container">
      <input ref={this.smsRef} id="code" name="code" autoComplete="off" maxLength={6} placeholder=" " onInput={this.handleInput} required />
        <label htmlFor="sms-code">SMS Code</label>
      </div>
      { this.state.smsError !== "" &&
      <div className="error-message">{this.state.smsError}</div> }
      <button type="submit">Submit</button>
    </form>
  }
}

class LoginApp extends React.Component<{ auth: Auth, onSuccess: any, className?: any, onAnimationEnd?: any }> {
  constructor(props: { auth: Auth; onSuccess: any; className: any } | Readonly<{ auth: Auth; onSuccess: any; className: any }>) {
    super(props);
    this.handleError = this.handleError.bind(this);
    this.updateStep = this.updateStep.bind(this);
    this.recaptchaContainerRef = React.createRef();
    this.recaptchaVerifier = null;
  }

  private recaptchaContainerRef: React.RefObject<HTMLDivElement>;
  private recaptchaVerifier: RecaptchaVerifier;

  state = {
    currentStep: 0,
    elements: [
      <div>
        <h2>Log In</h2>
        <div className="small">For your security, please log in.</div>
        <LoginForm auth={this.props.auth} onSuccess={this.props.onSuccess} onError={(error: any) => this.handleError(error)}/>
      </div>,
      <div className="step-container">
        <h2>Verify SMS Login Code</h2>
        <div className="small">We sent a message to your linked phone number. Please nter the code.</div>
        <SMSLogin onSuccess={this.props.onSuccess}/>
      </div>
    ]
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

  async handleError(error: any) {
    if(error.code === "auth/multi-factor-auth-required") {
      const component = this;
      await new Promise((resolve) => {
        component.recaptchaVerifier = new RecaptchaVerifier(component.recaptchaContainerRef.current, {
          size: "invisible",
          callback: async () => {
            resolve(0);
          }
        }, component.props.auth);
        component.recaptchaVerifier.verify();
      });

      const auth = this.props.auth;
      const resolver = getMultiFactorResolver(auth, error);
      window["resolver"] = resolver;

      if(resolver.hints[0].factorId === PhoneMultiFactorGenerator.FACTOR_ID) {
        const phoneInfoOptions = {
          multiFactorHint: resolver.hints[0],
          session: resolver.session
        };
        const phoneAuthProvider = new PhoneAuthProvider(auth);
        phoneAuthProvider.verifyPhoneNumber(phoneInfoOptions, component.recaptchaVerifier)
        .then((verificationId) => {
          window["verificationId"] = verificationId;
          component.updateStep(1);
        })
        .catch(console.error);
      } else {
        this.setState({ errors: { email: "Mulitfactor option is not supported" }});
      }
    } else {
      this.setState({ errors: { email: error.code }});
    }
  }

  render() {
    return <div className={this.props.className} onAnimationEnd={this.props.onAnimationEnd}>{this.state.elements[this.state.currentStep]}<div ref={this.recaptchaContainerRef}></div></div>
  }
};

export default LoginApp;