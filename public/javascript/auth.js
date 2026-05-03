import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Inicialización de Firebase (configuración desde firebase-config.js)
const auth = getAuth();
const db = getFirestore();
const googleProvider = new GoogleAuthProvider();
const facebookProvider = new FacebookAuthProvider();

// Función para registro con email/contraseña
window.registrarUsuario = async (email, password, nombre, rol) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "users", userCredential.user.uid), {
      email: email,
      displayName: nombre,
      role: rol,
      createdAt: new Date()
    });
    alert("Usuario creado exitosamente");
  } catch (error) {
    alert(`Error: ${error.message}`);
  }
};

// Función para inicio de sesión
window.iniciarSesion = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));
    sessionStorage.setItem('user', JSON.stringify({
      uid: userCredential.user.uid,
      email: userCredential.user.email,
      role: userDoc.data().role
    }));
    window.location.href = "inicio.html";
  } catch (error) {
    alert(`Error: ${error.message}`);
  }
};

// Autenticación con Google
window.iniciarConGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const userDoc = await getDoc(doc(db, "users", result.user.uid));
    if (!userDoc.exists()) {
      await setDoc(doc(db, "users", result.user.uid), {
        email: result.user.email,
        displayName: result.user.displayName,
        role: "mesero", // Rol por defecto
        createdAt: new Date()
      });
    }
    window.location.href = "inicio.html";
  } catch (error) {
    alert(`Error: ${error.message}`);
  }
};

// Cerrar sesión
window.cerrarSesion = async () => {
  await signOut(auth);
  sessionStorage.removeItem('user');
  window.location.href = "login.html";
};

// Verificar estado de autenticación
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
      sessionStorage.setItem('user', JSON.stringify({
        uid: user.uid,
        email: user.email,
        role: userDoc.data().role
      }));
    }
  }
});