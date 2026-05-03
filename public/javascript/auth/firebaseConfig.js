// javascript/auth/firebaseConfig.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
  getAuth, 
  GoogleAuthProvider,
  FacebookAuthProvider,
  connectAuthEmulator 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
  getFirestore,
  connectFirestoreEmulator 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
    getFunctions, 
    connectFunctionsEmulator 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";


// Tu configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCQx4hIxn7x_U_wMmoBnN2M4Mgiop6FRyk",
  authDomain: "sucomi-4752c.firebaseapp.com",
  projectId: "sucomi-4752c",
  storageBucket: "sucomi-4752c.firebasestorage.app",
  messagingSenderId: "1073776025772",
  appId: "1:1073776025772:web:4c21bd289b478e270e3f09"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);

// ----------------------------------------------------
// 💡 CONFIGURACIÓN DEL EMULADOR (SOLO PARA DESARROLLO)
//    - Se verifica si el hostname es 'localhost' o '127.0.0.1'
// ----------------------------------------------------
if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
  console.log("Conectando a emuladores locales...");
  
  // Conectar Auth al emulador local
  connectAuthEmulator(auth, "http://localhost:9099"); 
  
  // Conectar Firestore al emulador local
  connectFirestoreEmulator(db, "localhost", 8080);
  
  // 💡 Conectar Functions al emulador local
  // La conexión a 'localhost:5001' es la que redirigirá las llamadas a la función local.
  connectFunctionsEmulator(functions, "localhost", 5001); 
}
// ----------------------------------------------------


// Proveedores de autenticación
const googleProvider = new GoogleAuthProvider();
const facebookProvider = new FacebookAuthProvider();

// Exportar solo las instancias de los servicios y proveedores
export {
  app, 
  auth,
  db,
  functions, // <--- Importante: Exportar la instancia 'functions'
  googleProvider,
  facebookProvider
};