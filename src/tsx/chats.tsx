import React, { Component, createRef } from "react";
import ReactDOM from "react-dom/client";
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getDatabase, ref, onValue } from "firebase/database";
import firebaseConfig from "../firebaseconfig.json";

// storage url: https://storage.googleapis.com/hopperchat-cloud.appspot.com

type User =  {
  display_name: string;
  role: string;
  ekey_n: string;
  skey_x: string;
  skey_y: string;
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

const uid = await new Promise((resolve) => {
  onAuthStateChanged(auth, (user) => {
    if(user === null) return;
    resolve(user.uid);
  });
});

const user: User = await new Promise((resolve) => {
  onValue(ref(database, "public_users/" + uid),
  (snapshot) => {
    if(snapshot.exists() === false) return;
    resolve(snapshot.val());
  }, { onlyOnce: true });
});

class App extends Component {
  chatsContainerRef = createRef<HTMLDivElement>();

  componentDidMount() {
    if (this.chatsContainerRef.current) {
      this.chatsContainerRef.current.addEventListener("scroll", this.handleScroll);
    }
  }

  componentWillUnmount() {
    if (this.chatsContainerRef.current) {
      this.chatsContainerRef.current.removeEventListener("scroll", this.handleScroll);
    }
  }

  handleScroll = (event: UIEvent) => {
    console.log(event);
  }

  render() {
    return <div className="chats-container" ref={this.chatsContainerRef}>
      <h1>Profile</h1>
      <h2>{user.display_name}</h2>
      <img src={"https://storage.googleapis.com/hopperchat-cloud.appspot.com/profile_pictures/" + uid} alt={user.display_name + "'s profile picture"} title={user.display_name + "'s profile picture"} />
      <h6>Role: {user.role}</h6>
    </div>
  }
}

const root = ReactDOM.createRoot(document.body);
root.render(<App/>);