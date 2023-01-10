import React, { useReducer } from "react";
import ReactDOM from "react-dom/client";
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, RecaptchaVerifier, multiFactor, PhoneAuthProvider, PhoneMultiFactorGenerator } from "firebase/auth";
import { getDatabase, ref, onValue, query, orderByChild, equalTo, set, update } from "firebase/database";
import { getStorage, uploadBytes, ref as _ref } from "firebase/storage";
import firebaseConfig from "../firebaseconfig.json";
import AvatarForm from "./avatar-form";
import LoginApp from "./login-app";

// Dependencies
import PhoneInput from "react-phone-input-2";
import { isValidPhoneNumber } from "react-phone-number-input";
import "react-phone-input-2/lib/style.css";
import Filter from "bad-words";
import "../css/onboarding.css";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);
const storage = getStorage(app);
const filter = new Filter();

// Retrieve user id and multifactor session
// If user is not logged in, return multifactor password
const [uid, session] = await new Promise<Array<any>>((resolve) => {
  onAuthStateChanged(auth, (user) => {
    if(user === null) {
      const root = ReactDOM.createRoot(document.body);
      root.render(<LoginApp auth={auth} className="" onSuccess={resolve}/>);
      return;
    }
    multiFactor(user)
      .getSession()
      .then((session) => {
        resolve([user.uid, session]);
      })
      .catch(console.error);
  });
});

function createAccount(profilePicture: File) {
  const imagePath = _ref(storage, "profile_pictures/" + uid);
  uploadBytes(imagePath, profilePicture)
  .then(async () => {
    // Generate assymetric key pairs
    const ekeys = await createEncryptionKeyPair();
    const epublic_key = await exportKey(ekeys.publicKey);
    const eprivate_key = await exportKey(ekeys.privateKey);
    const skeys = await createSigningKeyPair();
    const spublic_key = await exportKey(skeys.publicKey);
    const sprivate_key = await exportKey(skeys.privateKey);
    const hasPublicProfile = await new Promise((resolve) => {
      onValue(ref(database, "public_users/" + uid), (snapshot) => resolve(snapshot.exists()));
    });
    const hasPrivateProfile = await new Promise((resolve) => {
      onValue(ref(database, "private_users/" + uid), (snapshot) => resolve(snapshot.exists()));
    })

    new Promise((resolve, reject) => {
      if(hasPublicProfile) resolve(void 0);
      update(ref(database, "public_users/" + uid), {
        ekey_n: epublic_key.n,
        skey_x: spublic_key.x,
        skey_y: spublic_key.y,
        role: "basic"
      })
      .then(resolve)
      .catch(reject);
    })
    .then(() => new Promise((resolve, reject) => {
      if(hasPrivateProfile) resolve(void 0)
      set(ref(database, "private_users/" + uid), {
        skey_d: sprivate_key.d,
        skey_x: sprivate_key.x,
        skey_y: sprivate_key.y,
        ekey_d: eprivate_key.d,
        ekey_dp: eprivate_key.dp,
        ekey_dq: eprivate_key.dq,
        ekey_n: eprivate_key.n,
        ekey_p: eprivate_key.p,
        ekey_q: eprivate_key.q,
        ekey_qi: eprivate_key.qi
      })
      .then(resolve)
      .catch(reject);
    }))
    .then(() => {
      window.open("/", "_self");
    })
    .catch((error) => {
      console.error(error?.code ?? error);
    });
  })
  .catch(console.error);
}

class TwoFactorAuthenticationForm extends React.Component<{ onUse: () => void, onSkip: () => void }> {
  private useTwoFactorRef: React.RefObject<HTMLButtonElement>;
  private skipTwoFactorRef: React.RefObject<HTMLButtonElement>;

  constructor(props: { onUse: () => void; onSkip: () => void; } | Readonly<{ onUse: () => void; onSkip: () => void; }>) {
    super(props);
    this.useTwoFactorRef = React.createRef();
    this.skipTwoFactorRef = React.createRef();
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const useTwoFactor = this.useTwoFactorRef.current;
    const skipTwoFactor = this.skipTwoFactorRef.current;
    const submitter = event.nativeEvent["submitter"];

    if(Object.is(useTwoFactor, submitter)) {
      this.props.onUse();
    } else if(Object.is(skipTwoFactor, submitter)) {
      this.props.onSkip();
    }
  }

  render() {
    return <form action="#" autoComplete="off" onSubmit={this.handleSubmit}>
      <button type="submit" ref={this.useTwoFactorRef}>Add Two Factor Authentication</button>
      <button type="submit" ref={this.skipTwoFactorRef} className="button-link" style={{ marginTop: "16px" }}>Skip</button>
    </form>
  }
};

class DisplayNameForm extends React.Component<{ onSuccess: () => void }> {
  private displayNameRef: React.RefObject<HTMLInputElement>;
  
  constructor(props: { onSuccess: () => void }) {
    super(props);
    this.handleInput = this.handleInput.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.displayNameRef = React.createRef();
  }

  state = {
    errors: {}
  }

  handleInput(event: { target: any }) {
    this.setState({ errors: {} });
    const displayName = event.target.value;
    if(displayName && ((!(/^[\w-_]+$/.test(displayName)) || filter.isProfane(displayName)))) {
      this.setState({ errors: { "display-name": "Invalid display name" }});
    }
    if(displayName && displayName.length > 32) {
      this.setState({ errors: {"display-name": "Display name must be no more than 32 characters" }});
    }
  }

  async handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const displayName = this.displayNameRef.current.value;
    if(!(/^[\w-_]+$/.test(displayName)) || filter.isProfane(displayName)) {
      return this.setState({ errors: { "display-name": "Invalid display name" }});
    }

    onValue(query(ref(database, "public_users"), orderByChild("display_name"), equalTo(displayName)),
    (snapshot) => {
      if(snapshot.exists()) {
        if(snapshot.val()[uid]) return this.props.onSuccess();
        return this.setState({ errors: { "display-name": "Display name already exists" }});
      } else {
        set(ref(database, `public_users/${uid}/display_name`), displayName)
        .then(() => {
          this.props.onSuccess();
        });
      }
    }, { onlyOnce: true });
  }

  render() {
    return <form action="#" autoComplete="off" onSubmit={this.handleSubmit}>
      <div className={`input-container${this.state.errors["display-name"]?" error":""}`}>
        <input ref={this.displayNameRef} id="display-name" name="display-name" autoComplete="off" pattern="^[\w\-_]+$" placeholder=" " onInput={this.handleInput} required />
        <label htmlFor="display-name">Display Name</label>
      </div>
      <div className="error-message">{this.state.errors["display-name"]}</div>
      <button type="submit">Continue</button>
    </form>
  }
};

class PhoneNumberForm extends React.Component<{ onSuccess: () => void, onError: () => void }> {
  private phoneInputRef: React.RefObject<HTMLInputElement>;
  private submitRef: React.RefObject<HTMLButtonElement>;
  private recaptchaVerifier: RecaptchaVerifier;
  private canUseRecaptcha: boolean;

  constructor(props) {
    super(props);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.componentDidMount = this.componentDidMount.bind(this);
    this.phoneInputRef = React.createRef();
    this.submitRef = React.createRef();
    this.recaptchaVerifier = null;
    this.canUseRecaptcha = false;
  }

  componentDidMount() {
    this.recaptchaVerifier = new RecaptchaVerifier(this.submitRef.current, {
      size: "invisible",
      callback: () => {
        this.canUseRecaptcha = true;
      }
    }, auth);
    this.recaptchaVerifier.verify();
  }

  handleSubmit(event: React.MouseEvent<HTMLButtonElement>) {
    const phoneNumber = this.phoneInputRef.current.value;
    if(!isValidPhoneNumber(phoneNumber)) {
      return this.setState({ errors: { phone: "Phone number invalid."}});
    }
    if(this.canUseRecaptcha === true) {
      const phoneInfoOptions = {
        phoneNumber,
        session 
      };
      const phoneAuthProvider = new PhoneAuthProvider(auth);
      phoneAuthProvider
      .verifyPhoneNumber(phoneInfoOptions, this.recaptchaVerifier)
      .then((verificationId) => {
        window["v"] = verificationId;
        this.props.onSuccess();
      })
      .catch(() => {
        this.props.onError();
      });
    }
  }

  state = {
    value: "",
    errors: {
      phone: ""
    }
  }

  render() {
    return <form action="#" autoComplete="off" onSubmit={e=>e.preventDefault()}>
      <PhoneInput
    inputProps={{ ref: this.phoneInputRef }}
    placeholder="Enter phone number"
    value={this.state.value}
    country="us"
    onChange={(value) => this.setState({ value, errors: { phone: "" } })}/>
      <div className="error-message">{this.state.errors.phone}</div>
      <button type="submit" onClick={this.handleSubmit} ref={this.submitRef}>Send SMS Message</button>
    </form>;
  }
};

class SMSCodeForm extends React.Component<{ onSuccess: () => void, onError: () => void }> {
  private smsRef: React.RefObject<HTMLInputElement>;

  constructor(props: { onSuccess: () => void; onError: () => void; } | Readonly<{ onSuccess: () => void; onError: () => void; }>) {
    super(props);
    this.handleInput = this.handleInput.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.smsRef = React.createRef();
  }

  handleInput(event: { target: any }) {
    event.target.value = event.target.value.replace(/[^\d]/g, '');
  }

  handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = this.smsRef.current.value;
    const cred = PhoneAuthProvider.credential(window["v"], code);
    const multiFactorAssertion = PhoneMultiFactorGenerator.assertion(cred);
    console.log(window["v"]);
    multiFactor(auth.currentUser)
    .enroll(multiFactorAssertion)
    .then(this.props.onSuccess)
    .catch((error) => {
      console.error(error);
      this.props.onError();
    });
  }

  render() {
    return <form action="#" autoComplete="off" onSubmit={this.handleSubmit}>
      <div className="input-container">
        <input ref={this.smsRef} id="code" name="code" autoComplete="off" maxLength={6} placeholder=" " onInput={this.handleInput} required />
        <label htmlFor="code">SMS Code</label>
      </div>
      <button type="submit">Link Phone To Account</button>
    </form>;
  }
};

class App extends React.Component {
  constructor(props: {} | Readonly<{}>) {
    super(props);
    this.updateStep = this.updateStep.bind(this);
  }

  state = {
    currentStep: 1,
    elements: [
      <div className="step-container">
        <h1>Two Factor Authentication</h1>
        <div className="small">Maximize Your Account Security</div>
        <TwoFactorAuthenticationForm
          onUse={() => this.updateStep(1)}
          onSkip={() => this.updateStep(4)}/>
      </div>,
      <div className="step-container">
        <LoginApp auth={auth} onSuccess={() => this.updateStep(2)}/>
      </div>,
      <div className="step-container">
        <h2>Verify Your Phone Number</h2>
        <div className="small">Enter Your Phone Number</div>
        <PhoneNumberForm onSuccess={() => this.updateStep(3)} onError={() => this.updateStep(1)} />
      </div>,
      <div className="step-container">
        <h2>Verify the SMS Code</h2>
        <div className="small">Enter the code!!1</div>
        <SMSCodeForm onSuccess={() => this.updateStep(4)} onError={() => this.updateStep(1)} />
      </div>,
      <div className="step-container">
        <h2>Create Your Display Name</h2>
        <div className="small">You can change this later</div>
        <DisplayNameForm onSuccess={() => this.updateStep(5)} />
      </div>,
      <div className="step-container">
        <h2>Create Your Avatar</h2>
        <div className="small">Upload an image that represents you!</div>
        <AvatarForm onSuccess={(file)=> createAccount(file)}/>
      </div>
    ]
  };

  updateStep(stepNum: number) {
    const component = this;
    const initialStep = this.state.currentStep;
    this.setState({
      elements: (this.state.elements.map((element, i) => 
    i === initialStep ? (console.log(element, i), React.cloneElement(element, {
    className: "step-container fade-out",
    onAnimationEnd() {
      component.setState({
        currentStep: stepNum,
        elements: (component.state.elements.map((element) => React.cloneElement(element, { className: "step-container", onAnimationEnd(){} })))
      });
    }
    })) : element))});
  }

  render() {
    return this.state.elements[this.state.currentStep];
  }
}

if(uid && session) {
  const root = ReactDOM.createRoot(document.body);
  root.render(<App/>);
}

function createEncryptionKeyPair() {
  return window.crypto.subtle.generateKey({
    name: "RSA-OAEP",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: "SHA-256"} as RsaHashedKeyGenParams,
    true, ["encrypt", "decrypt"]);
}

function createSigningKeyPair() {
  return window.crypto.subtle.generateKey({
    name: "ECDSA",
    namedCurve: "P-384"} as EcKeyGenParams,
    true, ["sign", "verify"]);
}

function exportKey(key: CryptoKey) {
  return window.crypto.subtle.exportKey("jwk", key);
}