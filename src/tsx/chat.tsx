import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getDatabase, limitToLast, onChildAdded, onValue, orderByChild, push, query, ref, set, startAt, update } from "firebase/database";
import React, { Component, createRef, MouseEvent, TouchEvent } from "react";
import ReactDOM from "react-dom/client";
import firebaseConfig from "../firebaseconfig.json";
import "../css/chat.css";

// Prevent long-polling infinite loop
localStorage.setItem("firebase:previous_websocket_failure", "false");

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

const fileNames = [
  "bobert",
  "high-bobert",
  "hacker-bobert",
  "troll-bobert",
  "wide-bobert",
  "flexing-bobert",
  "hopperchat-logo"
];

const tags = ['<b>$</b>', '<i>$</i>', '<u>$</u>', '<i>$</i>', '<div class="block-code">$</div>', '<span class="inline-code">$</span>', '<a href="$" target="_blank">$</a>', '<div class="mention">$</div>', '<s>$</s>', '<a href="/user/$" target="_blank">$</a>'];

const escape = {'&': '&amp;', '<': '&lt;', '>': '&gt;'};
function parse (txt: string) {
    return txt.replace(/[&<>]/g, (t) => escape[t] || '')
      .replace(
    /\*{2}([^\n]+?)\*{2}|\*([^\n]+?)\*|_{2}([^\n]+?)_{2}|_([^\n]+?)_|`{3}([\s\S]+)`{3}|`([^\n]+?)`|((?:http|ftp|https):\/\/[\w-]+\.[a-z]+\S+)|<((?:@|#).+?)>|~~([^\n]+?)~~|&lt;((?:@).+?)&gt;/g,
    (m, ...args) => {
        for (var i in args) {
          if (args[i]) {
            if (i !== "6" && i !== "4" && i !== "9") {
              return tags[i].replace(/\$/g, parse(args[i]));
          }
            return tags[i].replace(/\$/g, args[i]);
        }
      }
      return m;
    }
   )
   .replace(/:[\w-]+:/g, (match: string) => {
    match = match.replace(/:/g, "");
    if(!fileNames.includes(match)) return `:${match}:`;
    return `<div class="emoji-container"><img src="../${match}.png"></div>`
   })
}

class MessageElement extends Component<{ messageData: Message; authorData: User; messageKey: string; useHeader: boolean; }> {

  constructor(props: { messageData: Message; authorData: User; messageKey: string; useHeader: boolean; } | Readonly<{ messageData: Message; authorData: User; messageKey: string; useHeader: boolean; }>) {
    super(props);
  }

  render() {
    return <li className="message"
      style={{
        order: ~~((new Date(this.props.messageData.created).valueOf() - new Date("January 1 2023").valueOf()) / 10000)
      }}>
      <div className="message-pocket">
        {this.props.useHeader ? <img className="message-avatar"
          src={"https://storage.googleapis.com/hopperchat-cloud.appspot.com/profile_pictures/" + this.props.messageData.author}
          alt={this.props.authorData.display_name+"'s avatar"} /> : <span className="message-time">{new Date(this.props.messageData.created).toLocaleTimeString("default", { timeStyle: "short" })}</span>}
      </div>
      <div className="message-text">
        {this.props.useHeader && <header className="message-metadata">
          <span>{this.props.authorData.display_name}</span>
          <span>{new Date(this.props.messageData.created).toLocaleString()}</span>
        </header>}
        <p className="message-content" dangerouslySetInnerHTML={{ __html: parse(this.props.messageData.content)
          + (this.props.messageData.is_edited ? <span>{"(edited)"}</span> : "") }} />
      </div>
    </li>
  }
}

type AppState = {
  userCount: number;
  chatName: string;
  uid: string;
  messages: []
};

class App extends Component {

  constructor(props: {} | Readonly<{}>) {
    super(props);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.trackKeys = this.trackKeys.bind(this);
    this.postMessage = this.postMessage.bind(this);
    this.initChat = this.initChat.bind(this);
  }

  loadingContainerRef = createRef<HTMLDivElement>();
  scrollingContainerRef = createRef<HTMLDivElement>();

  state: AppState = {
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
    const messageLoadAmount = ~~(window.innerHeight * 2 / 32);

    let lastAuthor: string, lastMillis = 0;
    onValue(query(ref(database, "messages/" + chatKey), orderByChild("created"), limitToLast(messageLoadAmount)),
    async (snapshot) => {
      if(snapshot.exists()) {
        const messages = snapshot.val();
        const keys = Object.keys(messages);
        keys.sort((a, b) => messages[a].created - messages[b].created);
        for await (const key of keys) {
          const message = messages[key];
          const author = await getAuthorData(message.author);
          const useHeader = (message.created - lastMillis) > 1000 * 60 * 15 || author.display_name !== lastAuthor;

          this.setState((appState: AppState)  => ({
            messages: [
              appState.messages,
              <MessageElement
                messageData={message}
                messageKey={key}
                authorData={author}
                useHeader={useHeader} />
            ]
          }), () => {
            this.scrollingContainerRef.current.scrollTop = this.scrollingContainerRef.current.scrollHeight;
          });

          lastAuthor = author.display_name;
          lastMillis = message.created;
        }

        lastMillis ++;

        if(keys.length <= messageLoadAmount) {
          this.loadingContainerRef.current.remove();
        }
      } else {
        this.loadingContainerRef.current.remove();
      }

      onChildAdded(query(ref(database, "messages/" + chatKey), orderByChild("created"), startAt(lastMillis)),
      async (snapshot) => {
        const message = snapshot.val() as Message;
        const author = await getAuthorData(message.author);
        const useHeader = author.display_name !== lastAuthor || (message.created - lastMillis) > 1000 * 60 * 15;
        this.setState((appState: AppState)  => ({
          messages: [
            appState.messages,
            <MessageElement
              messageData={message}
              messageKey={snapshot.key}
              authorData={author}
              useHeader={useHeader} />
          ]
        }), () => {
          this.scrollingContainerRef.current.scrollTop = this.scrollingContainerRef.current.scrollHeight;
        });

        lastAuthor = author.display_name;
        lastMillis = message.created;
      });
    }, {
      onlyOnce: true
    });
  }

  handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const textarea = this.messageTextareaRef.current;
    this.postMessage(textarea.value);
    textarea.value = "";
    const parent = textarea.parentElement;
    textarea.style.height = "";
    parent.style.height = "";
    parent.style.height = `${textarea.scrollHeight}px`;
  }

  postMessage(message: string) {
    message = message.trim();
    if(message.length === 0) return;

    const { key } = push(ref(database, "messages/" + chatKey));

    set(ref(database, `messages/${chatKey}/${key}`), {
      content: message,
      author: this.state.uid,
      created: Date.now(),
      is_edited: false
    }).then(async () => 
    update(ref(database, `chats_browse/${chatKey}/members/${this.state.uid}`), {
      should_notify: true,
      role: (await getAuthorData(this.state.uid)).role
    }))
    .catch((error) => {
      console.error(error);
      console.log(message);
    });
  }

  trackKeys(event: any) {
    const textarea = event.target as HTMLTextAreaElement;
    userKeys[event.key] = event.type === "keydown";
    if(userKeys.Enter && !userKeys.Shift) {
      event.preventDefault();
      this.postMessage(textarea.value);
      textarea.value = "";
      const parent = textarea.parentElement;
      textarea.style.height = "";
      parent.style.height = "";
      parent.style.height = `${textarea.scrollHeight}px`;
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
      <header className="chat-header">
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
        <div className="messages-overflow-container" ref={this.scrollingContainerRef}>
          <div ref={this.loadingContainerRef}>
            <div className="loading-spinner"><div className="loading-icon"></div></div>
          </div>
          <ul className="messages-container">
            {this.state.messages}
          </ul>
        </div>
        <form noValidate className="message-form"
        onSubmit={this.handleSubmit}>
          <div className="input-container">
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
              title=""
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