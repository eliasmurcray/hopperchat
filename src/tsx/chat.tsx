import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getDatabase, limitToLast, onValue, orderByChild, push, query, ref, set } from "firebase/database";
import React, { Component, createRef, MouseEvent, TouchEvent } from "react";
import ReactDOM from "react-dom/client";
import firebaseConfig from "../firebaseconfig.json";
import "../css/chat.css";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

type ChatBrowse = {
  author: string;
  description: string;
  isPinned: boolean;
  name: string;
  members: {
    [uid: string]: {
      role: string;
      should_notify: string;
    }
  }
};

type Message = {
  author: string;
  created: number;
  content: string;
  is_edited: boolean;
};

type User = {
  display_name: string;
  date_joined: number;
  ekey_n: string;
  role: string;
  skey_x: string;
  skey_y: string;
};

const chatKey = window.location.href.split("/chat/")[1];
const userKeys: { [key:string]: boolean } = {};
const cache_author_data = {};

function getAuthorData(uid: string): Promise<User> {
  return new Promise((resolve) => {
    // If the data already exists, return it
    if(cache_author_data[uid] !== undefined) return resolve(cache_author_data[uid]);

    // Or else load it from db
    onValue(ref(database, "public_users/" + uid),
    (snapshot) => {
      if(!snapshot.exists()) return resolve(null);
      cache_author_data[uid] = snapshot.val();
      resolve(snapshot.val());
    },
    { onlyOnce: true });
  });
}

class MessageElement extends Component<{ messageData: Message; authorData: User; messageKey: string; useHeader: boolean }> {

  constructor(props: { messageData: Message; authorData: User; messageKey: string; useHeader: boolean; } | Readonly<{ messageData: Message; authorData: User; messageKey: string; useHeader: boolean; }>) {
    super(props);
  }

  render() {
    return <li>
      <div>
        <img src={"https://storage.googleapis.com/hopperchat-cloud.appspot.com/profile_pictures/"+this.props.messageData.author} />
        <h3>{this.props.authorData.display_name}</h3>
      </div>
      <div>{this.props.messageData.content}</div>
    </li>
  }
}

class App extends Component {

  constructor(props: {} | Readonly<{}>) {
    super(props);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.trackKeys = this.trackKeys.bind(this);
    this.postMessage = this.postMessage.bind(this);
    this.initChat = this.initChat.bind(this);
  }

  state = {
    userCount: null,
    chatName: "",
    uid: null,
    messages: []
  }

  messageTextareaRef = createRef<HTMLTextAreaElement>();

  async componentDidMount() {
    const component = this;

    onValue(ref(database, "chats_browse/" + chatKey),
    (snapshot) => {
      const chatInfo = snapshot.val() as ChatBrowse;
      component.setState({
        userCount: Object.keys(chatInfo.members).length,
        chatName: chatInfo.name
      });
      document.title = chatInfo.name + " | Hopperchat";
    });

    new Promise((resolve) => {
      onAuthStateChanged(auth, (user) => {
        component.setState({
          uid: user.uid
        });
        resolve(0);
      });
    })
    .then(() => {
      this.initChat();
    });
  }

  initChat() {
    const component = this;
    const messageLoadAmount = ~~(window.innerHeight * 2 / 32);

    let lastKey: number, lastAuthor: string, lastMillis = 0;
    onValue(query(ref(database, "messages/" + chatKey), orderByChild("created"), limitToLast(messageLoadAmount)),
    async (snapshot) => {
      if(!snapshot.exists()) return;
      const messages = snapshot.val();
      const keys = Object.keys(messages);
      keys.sort((a, b) => messages[a].created - messages[b].created);
      lastKey = messages[keys[0]].created - 1;
      for await (const key of keys) {
        const message = messages[key];
        console.log(message);
        const author = await getAuthorData(message.author);
        const useHeader = (message.created - lastMillis) < 1000 * 60 * 15;
        component.setState({
          messages: [...component.state.messages,
            <MessageElement
              messageData={message}
              messageKey={key}
              authorData={author}
              useHeader={useHeader} />]
        });

        lastMillis = messages[key].created;
        lastAuthor = author.display_name;
      }
    }, {
      onlyOnce: true
    })
  }

  handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  postMessage(message: string) {
    const { key } = push(ref(database, "messages/" + chatKey));
    set(ref(database, `messages/${chatKey}/${key}`), {
      content: message,
      author: this.state.uid,
      created: Date.now(),
      is_edited: false
    });
  }

  trackKeys(event: any) {
    const textarea = event.target as HTMLTextAreaElement;
    userKeys[event.key] = event.type === "keydown";
    if(userKeys.Enter && !userKeys.Shift) {
      event.preventDefault();
      this.postMessage(textarea.value);
      textarea.value = "";
      textarea.style.height = "48px";
    }
  }

  render() {
    return <div className="app">
      <div className="top-bar">
        <div className="user-count">
          {this.state.userCount !== null && this.state.userCount + (this.state.userCount === 1 ? " Member" : " Members")}
        </div>
        <svg width="40" height="10" fill="#19d263"><path d="M5 0L10 10L 0 10M30 0L40 0L40 10L30 10M 20 5m -5 0a 5 5 0 1 0 10 0a 5 5 0 1 0 -10 0"></path></svg>
      </div>
      <header>
        <button className="circle-button"
          onClick={(e: MouseEvent | TouchEvent)=>ripple(e as MouseEvent & TouchEvent)}
          onAnimationEnd={()=>{
            window.open("/chats", "_self");
          }}>
        <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" fill="#000000"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19 11H7.83l4.88-4.88c.39-.39.39-1.03 0-1.42-.39-.39-1.02-.39-1.41 0l-6.59 6.59c-.39.39-.39 1.02 0 1.41l6.59 6.59c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L7.83 13H19c.55 0 1-.45 1-1s-.45-1-1-1z" fill="#efefff"/></svg>
        </button>
        {this.state.chatName && <h1>{this.state.chatName}</h1>}
      </header>
      <div className="messages-group">
        <div id="messages-overflow-container" style={{
          flex: "1"
        }}>
          <div id="loading-container">
            <div className="loading-spinner"><div className="loading-icon"></div></div>
          </div>
          <ul id="messages-container">
            {this.state.messages}
          </ul>
        </div>
        <form style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          padding: "0 15px 15px 15px",
          boxSizing: "border-box"
        }}
        onSubmit={this.handleSubmit}>
          <div className="input-container" style={{
            marginTop: 0
          }}>
            <textarea ref={this.messageTextareaRef}
              spellCheck="false"
              placeholder=" "
              onKeyUp={this.trackKeys}
              onInput={(event) => {
                const textarea = event.target as HTMLTextAreaElement;
                const parent = textarea.parentElement;
                textarea.style.height = "";
                parent.style.height = "";
                parent.style.height = `${textarea.scrollHeight}px`;
              }}
              onKeyDown={this.trackKeys}
              required></textarea>
            <label htmlFor="message-input">Enter message</label>
          </div>
          <button className="send-button" type="submit">
            <img src="data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' height='24' width='24' viewBox='0 0 45 45'%3E%3Cpath fill='%23efefef' d='M6 40V8l38 16Zm3-4.65L36.2 24 9 12.5v8.4L21.1 24 9 27Zm0 0V12.5 27Z'/%3E%3C/svg%3E" title="Send message" alt="Send message" />
          </button>
        </form>
      </div>
    </div>;
  }
}

function ripple(a: TouchEvent & MouseEvent) {
  const b = a.currentTarget as HTMLElement,
    c = Math.max(b.clientWidth, b.clientHeight),
    d = c / 2,
    e = b.getBoundingClientRect(),
    f = b.getElementsByClassName("ripple")[0],
    g = a.changedTouches?a.changedTouches[a.changedTouches.length-1]:a;
    f && f.remove(), b.innerHTML += `<span class="ripple" style="width:${c}px;height:${c}px;top:${g.clientY-e.top-d}px;left:${g.clientX-e.left-d}px"></span>`
}

const root = ReactDOM.createRoot(document.body);
root.render(<App />);