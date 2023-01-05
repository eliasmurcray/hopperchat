import React from "react";
import ReactDOM from "react-dom";
import config from "../firebaseconfig.json";
import { initializeApp } from "firebase/app";
import { getAuth, applyActionCode, Auth } from "firebase/auth";
import "../css/auth.css";

const params = new URLSearchParams(window.location.search);
const mode = params.get("mode");
const actionCode = params.get("oobCode");
const continueUrl = params.get("continueUrl");
const lang = params.get("lang") || "en";

const app = initializeApp(config);
const auth = getAuth(app);

switch(mode) {
  case "verifyEmail":
    handleVerifyEmail(auth, actionCode, continueUrl, lang);
}

function handleVerifyEmail(auth: Auth, actionCode: string, continueUrl: string, lang: string) {
  // Localize the UI to the selected language as determined by the lang
  // parameter.
  // Try to apply the email verification code.
  applyActionCode(auth, actionCode).then((resp: any) => {
    // Email address has been verified.

    // TODO: Display a confirmation message to the user.
    // You could also provide the user with a link back to the app.

    // TODO: If a continue URL is available, display a button which on
    // click redirects the user back to the app via continueUrl with
    // additional state determined from that URL's parameters.
  }).catch((error: any) => {
    // Code is invalid or expired. Ask the user to verify their email address
    // again.
  });
}