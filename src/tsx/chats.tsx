import React, { Component, createRef, FormEvent, MouseEvent, TouchEvent } from "react";
import ReactDOM from "react-dom/client";
import { initializeApp } from "firebase/app";
import { browserLocalPersistence, indexedDBLocalPersistence, initializeAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { getDatabase, ref, onValue, query, startAt, limitToFirst, push, set } from "firebase/database";
import firebaseConfig from "../firebaseconfig.json";
import "../css/chats.css";

// Creates a ripple when passing an click event
function ripple(a: TouchEvent & MouseEvent) {
  const b = a.currentTarget as HTMLElement,
    c = Math.max(b.clientWidth, b.clientHeight),
    d = c / 2,
    e = b.getBoundingClientRect(),
    f = b.getElementsByClassName("ripple")[0],
    g = a.changedTouches?a.changedTouches[a.changedTouches.length-1]:a;
    f && f.remove(), b.innerHTML += `<span class="ripple" style="width:${c}px;height:${c}px;top:${g.clientY-e.top-d}px;left:${g.clientX-e.left-d}px"></span>`
}

// storage url: https://storage.googleapis.com/hopperchat-cloud.appspot.com

type User =  {
  display_name: string;
  role: string;
  ekey_n: string;
  skey_x: string;
  skey_y: string;
  date_joined: string;
};

type ChatBrowse = {
  name: string;
  author: string;
  description: string;
  members: {
    role: string;
    should_notify: boolean;
  }
};

type ChatCollection = {
  [key: string]: ChatBrowse;
};

const app = initializeApp(firebaseConfig);
const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence]
});
const database = getDatabase(app);

localStorage.setItem("firebase:previous_websocket_failure", "false");

const cache_author_data = {};
function getAuthorInfo(uid: string): Promise<User> {
  return new Promise((resolve) => {
    if(cache_author_data[uid] !== undefined) return resolve(cache_author_data[uid]);
    onValue(ref(database, "public_users/" + uid),
    (snapshot) => {
      if(!snapshot.exists()) return resolve(null);
      cache_author_data[uid] = snapshot.val();
      resolve(snapshot.val());
    }, {
      onlyOnce: true
    });
  });
}

type ChatDisplay = {
  chatName: string;
  authorName: string;
  description: string;
  chatKey: string;
  chatAuthorId: string;
  numUsers: number;
  uid: string;
}

class ChatElement extends Component<ChatDisplay> {
  constructor(props: ChatDisplay | Readonly<ChatDisplay>) {
    super(props);
    this.deleteChat = this.deleteChat.bind(this);
    this.handleClick = this.handleClick.bind(this);
  }

  deleteChat(event: MouseEvent | TouchEvent) {
    event.stopPropagation();
    if(confirm("Are you sure you want to delete chat " + this.props.chatName + "?")) {
      set(ref(database, "chats_browse/" + this.props.chatKey), null)
      .then(() => set(ref(database, "chats_view/" + this.props.chatKey), null));
    }
  }

  handleClick(event: MouseEvent | TouchEvent) {
    const element = event.target as HTMLButtonElement;
    element.onanimationend = () => {
      window.open(`/chat/${this.props.chatKey}`, "_self");
      element.onanimationend = () => {};
    };
    ripple(event as MouseEvent & TouchEvent);
  }

  render() {
    return <button className="chat-card" onClick={this.handleClick}>
        <div style={{
          display: "flex",
          flexFlow: "column",
          alignItems: "flex-start"
        }}>
        <h3>{this.props.chatName}</h3>
        <div style={{
          display: "flex",
          alignItems: "center",
          columnGap: "12px"
        }}>
          <img className="author-picture" src={"https://storage.googleapis.com/hopperchat-cloud.appspot.com/profile_pictures/"+this.props.chatAuthorId} width="30" height="30" />
          <h4>{this.props.authorName}</h4>
        </div>
      </div>
      <div style={{
        display: "flex",
        alignItems: "center",
        columnGap: "4px",
        fontSize: "14px"
      }}>
        <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" viewBox="0 0 1024 1024" fill="#efefff"><path d="M512 597.994667q108.010667 0 225.002667 46.997333t116.992 123.008l0 85.994667-684.010667 0 0-85.994667q0-76.010667 116.992-123.008t225.002667-46.997333zM512 512q-69.994667 0-120-50.005333t-50.005333-120 50.005333-121.002667 120-51.008 120 51.008 50.005333 121.002667-50.005333 120-120 50.005333z"/></svg>
        {this.props.numUsers + (window.innerWidth >= 720 ? (this.props.numUsers === 1 ? " Member" : " Members") : "")}
        {this.props.chatAuthorId === this.props.uid &&
        <button className="circle-button" onClick={this.deleteChat}>
          <svg xmlns="http://www.w3.org/2000/svg" height="24" width="24" viewBox="0 0 48 48"><path d="M13.05 42q-1.25 0-2.125-.875T10.05 39V10.5H8v-3h9.4V6h13.2v1.5H40v3h-2.05V39q0 1.2-.9 2.1-.9.9-2.1.9Zm21.9-31.5h-21.9V39h21.9Zm-16.6 24.2h3V14.75h-3Zm8.3 0h3V14.75h-3Zm-13.6-24.2V39Z"/></svg>
        </button>}
      </div>
    </button>
  }
};

class CloseModalButton extends Component {
  constructor(props: {} | Readonly<{}>) {
    super(props);
    this.handleClick = this.handleClick.bind(this);
  }

  handleClick(event: MouseEvent) {
    const button = event.target as HTMLElement;
    const modal = button.parentElement;
    modal.onanimationend = () => {
      modal.style.display = "none";
      modal.style.animation = "none";
      modal.onanimationend = () => {};
    };
    modal.style.animation = "fade-out .3s ease-in-out";
  }

  render() {
    return <button className="close-modal-button" onClick={this.handleClick}>x</button>
  }
}

class App extends Component {

  constructor(props: {} | Readonly<{}>) {
    super(props);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.onTextareaInput = this.onTextareaInput.bind(this);
    this.openCreateChatModal = this.openCreateChatModal.bind(this);
    this.toggleProfileModal = this.toggleProfileModal.bind(this);
  }

  chatsContainerRef = createRef<HTMLDivElement>();
  chatNameInputRef = createRef<HTMLInputElement>();
  chatDescriptionTextareaRef = createRef<HTMLTextAreaElement>();
  createChatModalRef = createRef<HTMLDivElement>();
  profileModalRef = createRef<HTMLDivElement>();

  state = {
    chats: [],
    allLoaded: false,
    userCount: "",
    uid: undefined,
    myInfo: undefined
  }

  async *getChats(): AsyncGenerator<ChatCollection, boolean, ChatCollection> {
    let last_key: string;
    while(true) {
      const items: ChatCollection | null = await new Promise((resolve) => {
        // Retrieve the current chat query, just the first 10 chats if initial load
        const chatQuery = typeof last_key === "undefined" ? query(ref(database, "chats_browse"), limitToFirst(10)) : 
        query(ref(database, "chats_browse"), limitToFirst(10), startAt(null, last_key));
        onValue(chatQuery,
        (snapshot) => {
          if(!snapshot.exists()) return resolve(null);
          // Create a cursor for the next return of items
          const returnedItems = snapshot.val();
          const keys = Object.keys(returnedItems);
          last_key = returnedItems[keys[keys.length]];
          resolve(snapshot.val());
        }, {
          onlyOnce: true
        });
      });
      if(items === null) break;
      yield items;
    }
    return true;
  }

  componentDidMount() {
    const component = this;

    onAuthStateChanged(auth, async (user) => {
      if(user === null) return;
      this.setState({
        uid: user.uid,
        myInfo: await getAuthorInfo(user.uid)
      });
    });

    // Load user count
    onValue(ref(database, "user_count"),
    (snapshot) => {
      this.setState({
        userCount: Object.keys(snapshot.val()).length
      });
    }, {
      onlyOnce: true
    })

    // Initial load chats
    if(this.state.chats.length === 0) {
      this.getChats()
      .next()
      .then(async ({ value, done }) => {
        if(done === true) {
          this.state.allLoaded = true;
          console.log("All chats have been loaded.");
          return;
        }

        const keys = Object.keys(value);
        const loadedChats = [];
        for (const key of keys) {
          const chatInfo = value[key];
          const authorInfo = await getAuthorInfo(chatInfo.author);
          loadedChats.push(<ChatElement
            chatName={chatInfo.name}
            authorName={authorInfo["display_name"]}
            description={chatInfo.description}
            chatKey={key}
            chatAuthorId={chatInfo.author}
            numUsers={Object.keys(chatInfo.members).length}
            uid={this.state.uid} />);
        }
        component.setState({
          chats: [
          ...component.state.chats,
          ... loadedChats
          ]
        });
      });
    }
    if (this.chatsContainerRef.current && !this.state.allLoaded) {
      this.chatsContainerRef.current.addEventListener("scroll", this.handleScroll);
    }
  }

  componentWillUnmount() {
    if (this.chatsContainerRef.current) {
      this.chatsContainerRef.current.removeEventListener("scroll", this.handleScroll);
    }
  }

  openCreateChatModal() {
    const modal = this.createChatModalRef.current;
    modal.style.display = "flex";
    modal.style.animation = "fade-in .3s ease-in-out";
  }

  onTextareaInput(event: FormEvent<HTMLTextAreaElement>) {
    const textarea = event.target as HTMLTextAreaElement;
    const parent = textarea.parentElement;
    textarea.style.height = "";
    parent.style.height = "";
    parent.style.height = `${textarea.scrollHeight}px`;
  }

  handleScroll = (event: UIEvent) => {
    const element = event.target as HTMLElement;
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    if(distanceFromBottom <= 15 && distanceFromBottom >= 0) {
      this.getChats()
        .next()
        .then((result) => {
          if(result.done === true) {
            this.state.allLoaded = true;
            console.log("All chats have been loaded.");
            return;
          }
        });
    }
  }

  handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const chatName = this.chatNameInputRef.current.value;
    const chatDescription = this.chatDescriptionTextareaRef.current.value;
    if(!chatName) return;
    const { key } = push(ref(database, "chats_browse"));
    set(ref(database, "chats_browse/" + key), {
      name: chatName,
      author: this.state.uid,
      isPinned: false,
      description: chatDescription || "No description",
      members: {
        [this.state.uid]: {
          role: this.state.myInfo.role,
          should_notify: true
        }
      }
    })
    .then(() => {
      const modal = this.createChatModalRef.current;

      modal.onanimationend = () => {
        modal.style.display = "none";
        modal.style.animation = "none";
        modal.onanimationend = () => {};
      };
      modal.style.animation = "fade-out .3s ease-in-out";
    })
    .catch(console.error);
  }

  toggleProfileModal() {
    const modal = this.profileModalRef.current;
    if (getComputedStyle(modal).getPropertyValue("display") === "flex") { 
      modal.onanimationend = () => {
        modal.style.display = "none";
        modal.style.animation = "none";
        modal.onanimationend = () => {};
      };
      modal.style.animation = "fade-out .3s ease-in-out";
    } else {
      modal.style.display = "flex";
      modal.style.animation = "fade-in .3s ease-in-out";
    }
  }

  logout() {
    if(confirm("Are you sure you want to sign out of this session?"))
      signOut(auth)
        .then(() =>
          window.open("/login", "_self"));
  }

  render() {
    return <div className="app">
      <div className="top-bar">
        {this.state.userCount !== "" && <div className="user-count">
          {this.state.userCount} Users
        </div>}
        <svg width="40" height="10" fill="#19d263"><path d="M5 0L10 10L 0 10M30 0L40 0L40 10L30 10M 20 5m -5 0a 5 5 0 1 0 10 0a 5 5 0 1 0 -10 0"></path></svg>
      </div>
      <header>
        {this.state.uid === null && <button className="circle-button" style={{ animation: "fade-in .3s ease-in" }} onClick={(event: TouchEvent | MouseEvent) => {
          const element = event.target as HTMLButtonElement;
          element.onanimationend = () => {
            window.open("/login", "_self");
            element.onanimationend = () => {};
          };
          ripple(event as any);
        }}>
          Log In
          <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px"><g><rect fill="none" height="24" width="24"/></g><g><path d="M11,7L9.6,8.4l2.6,2.6H2v2h10.2l-2.6,2.6L11,17l5-5L11,7z M20,19h-8v2h8c1.1,0,2-0.9,2-2V5c0-1.1-0.9-2-2-2h-8v2h8V19z"/></g></svg>
        </button>}
        {this.state.myInfo !== undefined && this.state.myInfo !== null && <button className="circle-button" style={{ animation: "fade-in .3s ease-in" }} onClick={this.openCreateChatModal}>
          Create Chat 
          <svg xmlns="http://www.w3.org/2000/svg" height="24" width="24" viewBox="0 0 48 48"><path d="m2 46 3.6-12.75q-1-2.15-1.45-4.425-.45-2.275-.45-4.675 0-4.2 1.575-7.85Q6.85 12.65 9.6 9.9q2.75-2.75 6.4-4.325Q19.65 4 23.85 4q4.2 0 7.85 1.575Q35.35 7.15 38.1 9.9q2.75 2.75 4.325 6.4Q44 19.95 44 24.15q0 4.2-1.575 7.85-1.575 3.65-4.325 6.4-2.75 2.75-6.4 4.325-3.65 1.575-7.85 1.575-2.4 0-4.675-.45T14.75 42.4Zm4.55-4.55 6.9-1.9q.8-.25 1.5-.175.7.075 1.45.375 1.8.7 3.675 1.125 1.875.425 3.775.425 7.15 0 12.15-5t5-12.15Q41 17 36 12T23.85 7Q16.7 7 11.7 12t-5 12.15q0 1.95.275 3.85.275 1.9 1.275 3.6.35.7.375 1.45.025.75-.175 1.5Zm15.8-9.25h3v-6.35h6.4v-3h-6.4v-6.4h-3v6.4h-6.4v3h6.4Zm1.45-8Z"/></svg>
        </button>}
        {this.state.myInfo !== undefined && this.state.myInfo !== null && 
        <button className="circle-button" style={{ animation: "fade-in .3s ease-in" }} onClick={this.toggleProfileModal}>
          Profile
          <img src={"https://storage.googleapis.com/hopperchat-cloud.appspot.com/profile_pictures/" + this.state.uid} />
        </button>}
        {this.state.myInfo !== undefined && this.state.myInfo !== null &&
        <div className="profile-modal" ref={this.profileModalRef} style={{ animation: "fade-in .3s ease-in" }}>
          <div style={{
            lineHeight: "1.25" }}>
            <img src={"https://storage.googleapis.com/hopperchat-cloud.appspot.com/profile_pictures/" + this.state.uid} />
            <div style={{
              marginTop: "5px",
              fontWeight: 600
            }}>
              {this.state.myInfo.display_name} 
            </div>
            <div style={{
              color: "#00BFFF"
              }}>
              {this.state.myInfo.role}
            </div>
            <div style={{
              display: "flex",
              alignItems: "center",
              columnGap: "4px",
              marginTop: "4px",
              fontSize: "14px"
            }}>
              <img src="./hopperchat-logo.png" width="18" height="18" />
              {new Date(this.state.myInfo.date_joined).toLocaleDateString()}
            </div>
            </div>
            <button onClick={this.logout} className="circle-button" style={{
              marginTop: "5px",
              justifySelf: "flex-end",
              marginLeft: "auto"
              }}>
              Log Out
              <svg xmlns="http://www.w3.org/2000/svg" height="24" width="24" viewBox="0 0 48 48"><path d="M9 42q-1.2 0-2.1-.9Q6 40.2 6 39V9q0-1.2.9-2.1Q7.8 6 9 6h14.55v3H9v30h14.55v3Zm24.3-9.25-2.15-2.15 5.1-5.1h-17.5v-3h17.4l-5.1-5.1 2.15-2.15 8.8 8.8Z"/></svg>
            </button>
        </div>}
      </header>
      <div className="chats-overflow-container">
        <div className="chats-container" ref={this.chatsContainerRef}>
          {this.state.chats}
        </div>
      </div>
      {this.state.myInfo === null && <div className="modal" style={{ display: "flex" }}>
        <h3>Complete Your Profile</h3>
        <div className="small">You are almost there!</div>
        <CloseModalButton />
        <div style={{ maxWidth: "320px" }}>
          Our systems have detected that you have not completed your profile. Be sure to complete your profile to enjoy the full features of our site!
          <br />
          <br />
          <a href="/onboarding">https://www.hopperchat.com/onboarding</a>
        </div>
      </div>}
      <div className="modal" ref={this.createChatModalRef}>
        <h3>Create Your Chat</h3>
        <div className="small">The world is your oyster</div>
        <CloseModalButton />
        <form action="#" onSubmit={this.handleSubmit}>
          <div className="input-container">
            <input ref={this.chatNameInputRef} name="chat-name" autoComplete="off" className="input" placeholder=" " required />
            <label htmlFor="display-name">Chat Name</label>
          </div>
          <div className="input-container">
            <textarea name="chat-description" ref={this.chatDescriptionTextareaRef} placeholder=" " onInput={this.onTextareaInput}
            onBlur={(event) => {
              const textarea = event.target;
              const parent = textarea.parentElement;
              event.target.value = textarea.value.trim();
              textarea.style.height = "";
              parent.style.height = "";
              parent.style.height = `${textarea.scrollHeight}px`;
            }}
            required />
            <label htmlFor="chat-description">Chat Description</label>
          </div>
          <button type="submit">Create Chat</button>
        </form>
      </div>
    </div>
  }
}

const root = ReactDOM.createRoot(document.body);
root.render(<App/>);