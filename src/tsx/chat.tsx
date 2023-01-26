import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { endAt, getDatabase, limitToLast, onChildAdded, onChildRemoved, onValue, orderByChild, push, query, ref, set, startAt, update } from "firebase/database";
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

var ua = window.navigator.userAgent;
var iOS = !!ua.match(/iPad/i) || !!ua.match(/iPhone/i);
var webkit = !!ua.match(/WebKit/i);
var iOSSafari = iOS && webkit && !ua.match(/CriOS/i);

const fileNames = [
  "bobert",
  "high-bobert",
  "hacker-bobert",
  "troll-bobert",
  "wide-bobert",
  "flexing-bobert",
  "hopperchat-logo",
  "smile",
  "thumbs-up",
  "skull",
  "joy",
  "thinking",
  "partying-face",
  "thinking-eyes",
  "thinking-smart",
  "heart"
];

const whitelistedDomains = [
  "upload.wikimedia.org"
];

const patterns = [
  {
    reg: /`{3}(.+?)`{3}/,
    hasNestedParsing: false,
    string: '<div class="block-code">$</div>'
  },
  {
    reg: /`([^\n]+?)`/,
    hasNestedParsing: false,
    string: '<span class="inline-code">$</span>'
  },
  {
    reg: /\*{2}(.+?)\*{2}/,
    hasNestedParsing: true,
    string: '<b>$</b>'
  },
  {
    reg: /\_\_(.+?)\_\_/,
    hasNestedParsing: true,
    string: '<u>$</u>'
  },
  {
    reg: /\*([^\n]+?)\*/,
    hasNestedParsing: true,
    string: '<i>$</i>'
  },
  {
    reg: /_([^\n"]+?)_/,
    hasNestedParsing: true,
    string: '<i>$</i>'
  },
  {
    reg: /~~([^\n]+?)~~/,
    hasNestedParsing: true,
    string: '<s>$</s>'
  },
  {
    reg: /&lt;((?:@).+?)&gt;/,
    hasNestedParsing: false,
    string: '<a href="/user/$" target="_blank">$</a>'
  },
  {
    reg: /(?:^|[^"])((?:http|https):\/\/[\w-]+\.[\w\S]+)/,
    hasNestedParsing: false,
    string: '<a href="$" target="_blank">$</a>'
  }
];

const escape = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };

function initParsing () {
  const regexp = new RegExp(patterns.map((i) => i.reg.source).join("|"), "gm");
  return function parse (content: string) {
    return content
      .replace(/[&<>]/g, (t) => escape[t] || "")
      .replace(/((?:http|https):\/\/[\w-]+\.[\w\S]+\.(?:gif|jpg|jpeg|tiff|png|webp))/, (match) => {
        const domain = new URL(match).hostname;
        if(whitelistedDomains.includes(domain)) {
          return `<img src="${match}" alt="${match}" width="100%" style="max-width:200px;max-height:200px;" />`;
        } else
          return match;
      })
      .replace(regexp, (m, ...args) => {
        const i = args.findIndex(Boolean);
        const j = patterns[i];
        if(j === undefined) return m;
        if (j.hasNestedParsing) {
          return j.string.replace(/\$/g, parse(args[i]));
        }
        return j.string.replace(/\$/g, args[i]);
      })
      .replace(/:([\w-]+):/gm, (match: string, p1: string) => {
        if(!fileNames.includes(p1)) return match;
        return `<div class="emoji-container"><img src="../${p1}.webp" alt=":${match}:" width="auto" height="18"></div>`;
      });
  }
}

const parse = initParsing();

type MessageType = {
  messageData: Message;
  authorData: User;
  messageKey: string;
  useHeader: boolean;
  uid: string;
};

class MessageElement extends Component<MessageType> {

  constructor(props: MessageType | Readonly<MessageType>) {
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
          <span>{this.props.authorData.display_name + " "}</span>
          <span>{new Date(this.props.messageData.created).toLocaleString()}</span>
        </header>}
        <p className="message-content" dangerouslySetInnerHTML={{ __html: parse(this.props.messageData.content)
          + (this.props.messageData.is_edited ? <span>{"(edited)"}</span> : "") }} />
      </div>
      <div className="message-tools">
        {this.props.uid === this.props.messageData.author && <button className="delete-message" onClick={() => {
          if(confirm("Delete message?"))
            set(ref(database, `messages/${chatKey}/${this.props.messageKey}`), null);
        }}></button>}
      </div>
    </li>
  }
}

type AppState = {
  userCount: number;
  chatName: string;
  uid: string;
  messages: [];
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
    uid: undefined,
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
          uid: user?.uid
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

    let lastAuthor: string, lastMillis = 0, scrollMillis: number;
    onValue(query(ref(database, "messages/" + chatKey), orderByChild("created"), limitToLast(messageLoadAmount)),
    async (snapshot) => {
      if(snapshot.exists()) {
        const messages = snapshot.val();
        const keys = Object.keys(messages);
        keys.sort((a, b) => messages[a].created - messages[b].created);
        scrollMillis = messages[keys[0]].created - 1;
        const loadedMessages = [];
        for await (const key of keys) {
          const message = messages[key];
          const author = await getAuthorData(message.author);
          const useHeader = (message.created - lastMillis) > 1000 * 60 * 15 || author.display_name !== lastAuthor;
          loadedMessages.push(<MessageElement
            key={key}
            messageData={message}
            messageKey={key}
            authorData={author}
            useHeader={useHeader} 
            uid={this.state.uid} />);
          lastAuthor = author.display_name;
          lastMillis = message.created;
        }

        this.setState({
          messages: loadedMessages
        }, () => {
          const container = this.scrollingContainerRef.current;
          const messagesContainer = container.getElementsByClassName("messages-container")[0];
          messagesContainer.lastElementChild.scrollIntoView({
            behavior: "smooth",
            block: "end"
          });
          function callback() {
            if(container.scrollHeight - container.scrollTop - container.clientHeight < window.innerHeight) {
              container.removeEventListener("scroll", callback);
              container.addEventListener("scroll", loadOnScroll, { passive: true });
            }
          }
          this.scrollingContainerRef.current.addEventListener("scroll", callback);
        });

        lastMillis ++;

        if(keys.length < messageLoadAmount) {
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
          ...appState.messages,
          <MessageElement
            key={snapshot.key}
            messageData={message}
            messageKey={snapshot.key}
            authorData={author}
            useHeader={useHeader}
            uid={this.state.uid} />
        ]
      }), () => {
        const scrollContainer = this.scrollingContainerRef.current;
        const messagesContainer = scrollContainer.getElementsByClassName("messages-container")[0];
        if(scrollContainer.scrollTop > scrollContainer.scrollHeight - 300)
          // scrollContainer.scrollTop = scrollContainer.scrollHeight;
          messagesContainer.lastElementChild.scrollIntoView({
            behavior: "smooth",
            block: "end"
          });
      });

      lastAuthor = author.display_name;
      lastMillis = message.created;
    });
    }, {
      onlyOnce: true
    });

    onChildRemoved(ref(database, "messages/" + chatKey), (snapshot) => {
      this.setState((appState: AppState) => {
        const newState = appState.messages.filter((message: any) => message.key !== snapshot.key);
        return { messages: newState };
      });
    });

    const loadOnScroll = () => {
      const scrollingContainer = this.scrollingContainerRef.current as HTMLDivElement;
      if(scrollingContainer.scrollTop >= window.innerHeight || (iOSSafari && scrollingContainer.scrollTop !== 0)) return;
      const offset = scrollingContainer.scrollHeight - scrollingContainer.scrollTop - scrollingContainer.clientHeight;
      scrollingContainer.removeEventListener("scroll", loadOnScroll);
      const scrollQuery = query(ref(database, "messages/" + chatKey), orderByChild("created"), endAt(scrollMillis), limitToLast(messageLoadAmount));
      console.time("Messages load");
      onValue(scrollQuery,
      async (snapshot) => {
        const messages = snapshot.val();
        if(!messages) return this.loadingContainerRef.current.remove();

        let miniMillis = 0, miniAuthor = "";

        const keys = Object.keys(messages);
        keys.sort((a, b) => messages[a].created - messages[b].created);
        scrollMillis = messages[keys[0]].created - 1;
        const loadedMessages = [];
        for await (const key of keys) {
          const message = messages[key];
          const author = await getAuthorData(message.author);
          const useHeader = (message.created - miniMillis) > 1000 * 60 * 15 || author.display_name !== miniAuthor;
          loadedMessages.push(<MessageElement
            key={key}
            messageData={message}
            messageKey={key}
            authorData={author}
            useHeader={useHeader}
            uid={this.state.uid} />);
          miniAuthor = author.display_name;
          miniMillis = message.created;
        }

        this.setState((appState: AppState) => ({
          messages: [
            ...loadedMessages,
            appState.messages
          ]
        }), () => {
          console.timeEnd("Messages load");
          scrollingContainer.style.scrollBehavior = "auto";
          console.log(scrollingContainer.scrollHeight - scrollingContainer.clientHeight - offset);
          scrollingContainer.scrollTop = scrollingContainer.scrollHeight - scrollingContainer.clientHeight - offset;
          console.log(scrollingContainer.scrollTop);
          scrollingContainer.style.scrollBehavior = "smooth";
          scrollingContainer.addEventListener("scroll", loadOnScroll, { passive: true });
        });
      }, {
        onlyOnce: true
      });
    };
  }

  handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(this.state.uid === undefined) return;
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
    if(this.state.uid === undefined) return;
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
          aria-label="Return To Chats"
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
              disabled={this.state.uid === undefined}
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
              id="message-input"
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