import React from "react";
import { Auth, signInWithEmailAndPassword, RecaptchaVerifier, PhoneAuthProvider, PhoneMultiFactorGenerator, getMultiFactorResolver } from "firebase/auth";

class LoginForm extends React.Component<{ auth: Auth, onSuccess: (value: any) => void, onError: (value: Error) => any }> {
  private emailRef: React.RefObject<HTMLInputElement>;
  private passwordRef: React.RefObject<HTMLInputElement>;
  
  constructor(props: { auth: Auth; onSuccess: (value: any) => void; onError: (value: Error) => void; } | Readonly<{ auth: Auth; onSuccess: (value: any) => void; onError: (value: Error) => void; }>) {
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
    if(this.state.errors.email || this.state.errors.password) return;
    const email = this.emailRef.current.value;
    const password = this.passwordRef.current.value;

    signInWithEmailAndPassword(this.props.auth, email, password)
    .then(this.props.onSuccess)
    .catch(this.props.onError);
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

class LoginApp extends React.Component<{ auth: Auth, onSuccess: (value: any) => void }> {
  private recaptchaContainerRef: React.RefObject<HTMLDivElement>;
  private recaptchaVerifier: RecaptchaVerifier;
  private canUseRecaptcha: boolean;

  constructor(props: { auth: Auth; onSuccess: (value: any) => void; } | Readonly<{ auth: Auth; onSuccess: (value: any) => void; }>) {
    super(props);
    this.updateStep = this.updateStep.bind(this);
    this.handleError = this.handleError.bind(this);
    this.recaptchaContainerRef = React.createRef();
    this.recaptchaVerifier = null;
    this.canUseRecaptcha = false;
  }

  componentDidMount(): void {
    this.recaptchaVerifier = new RecaptchaVerifier(this.recaptchaContainerRef.current, {
      size: "invisible",
      callback: () => {
        this.canUseRecaptcha = true;
      }
    }, this.props.auth);
    this.recaptchaVerifier.verify();
  }

  state = {
    currentStep: 0,
    elements: [
      <div className="step-container">
        <h2>Refresh Your Token</h2>
        <div className="small">For your security, please log in.</div>
        <LoginForm auth={this.props.auth} onSuccess={this.props.onSuccess} onError={(error: any) => this.handleError(error)}/>
      </div>
    ]
  }

  updateStep(stepNum: number) {
    const component = this;
    const initialStep = this.state.currentStep;
    this.setState({
      elements: (this.state.elements.map((element, i) => 
    i === initialStep ? React.cloneElement(element, {
    className: "step-container fade-out",
    onAnimationEnd() {
      component.setState({
        currentStep: stepNum,
        elements: (component.state.elements.map((element) => React.cloneElement(element, { className: "step-container", onAnimationEnd(){} })))
      });
    }
    }) : element))});
  }

  handleError(error: any) {
    console.log(this);
    if(error.code === "auth/multi-factor-auth-required") {
      const auth = this.props.auth;
      const resolver = getMultiFactorResolver(auth, error);
      if(resolver.hints[0].factorId === PhoneMultiFactorGenerator.FACTOR_ID) {
        const phoneInfoOptions = {
          multiFactorHint: resolver.hints[0],
          session: resolver.session
        };
        const phoneAuthProvider = new PhoneAuthProvider(auth);
        phoneAuthProvider.verifyPhoneNumber(phoneInfoOptions, this.recaptchaVerifier)
        .then((verificationId) => {
          let verificationCode = prompt("enter 6 digit code");
          const cred = PhoneAuthProvider.credential(verificationId, verificationCode);
          const multiFactorAssertion = PhoneMultiFactorGenerator.assertion(cred);
          return resolver.resolveSignIn(multiFactorAssertion);
        })
        .then(() => {
          this.props.onSuccess(0);
        })
        .catch(console.error);
      } else {
        console.error("Mulitfactor option is not supported");
      }
    } else {
      this.setState({ errors: { email: error.code }});
    }
  }

  render() {
    return <div style={{ width: "100%", height: "100%" }}>{this.state.elements[this.state.currentStep]}<div ref={this.recaptchaContainerRef}></div></div>
  }
};

export default LoginApp;