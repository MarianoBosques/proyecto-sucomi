// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCQx4hIxn7x_U_wMmoBnN2M4Mgiop6FRyk",
  authDomain: "sucomi-4752c.firebaseapp.com",
  projectId: "sucomi-4752c",
  storageBucket: "sucomi-4752c.firebasestorage.app",
  messagingSenderId: "1073776025772",
  appId: "1:1073776025772:web:4c21bd289b478e270e3f09"
};

// Initializar Firebase
const app = initializeApp(firebaseConfig);



const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();