// javascript/adminLogin.js

import { loginUser, logoutUser } from './auth/authFunctions.js';
import { auth, db } from './auth/firebaseConfig.js'; // <--- CAMBIO: Importar 'db' y 'auth'
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"; // <--- CAMBIO: Importar Firestore y funciones

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const usernameInput = document.getElementById('username'); // Esto es el email
    //const passwordInput = document = document.getElementById('password');
    const passwordInput = document.getElementById('password');
    const usernameError = document.getElementById('usernameError');
    const passwordError = document.getElementById('passwordError');
    const formMessage = document.getElementById('formMessage');

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        usernameError.textContent = '';
        passwordError.textContent = '';
        formMessage.textContent = '';
        formMessage.style.color = '#28a745';

        let isValid = true;

        if (usernameInput.value.trim() === '') {
            usernameError.textContent = 'El correo electrónico es obligatorio.';
            isValid = false;
        } else if (usernameInput.value.trim().length < 3) {
            usernameError.textContent = 'El correo debe tener al menos 3 caracteres.';
            isValid = false;
        }

        if (passwordInput.value.trim() === '') {
            passwordError.textContent = 'La contraseña es obligatoria.';
            isValid = false;
        } else if (passwordInput.value.trim().length < 6) {
            passwordError.textContent = 'La contraseña debe tener al menos 6 caracteres.';
            isValid = false;
        }

        if (isValid) {
            try {
                // Primero, inicia sesión con email/password usando authFunctions.js
                // loginUser retornará la credencial de usuario
                await loginUser(usernameInput.value, passwordInput.value);

                // Obtener el usuario autenticado actual de Firebase Auth
                const user = auth.currentUser;

                if (!user) {
                    formMessage.textContent = 'Error: No se pudo obtener el usuario autenticado.';
                    formMessage.style.color = '#dc3545';
                    return;
                }

                // *** CAMBIO CRUCIAL: Leer el rol directamente desde Firestore ***
                // Ya no confiamos en los Custom Claims del token para el rol,
                // porque los Custom Claims no se están estableciendo sin Cloud Functions.
                const userDocRef = doc(db, 'users', user.uid); // Referencia al documento del usuario en la colección 'users'
                const userDocSnap = await getDoc(userDocRef); // Obtener la instantánea del documento

                let userRole = null;
                if (userDocSnap.exists()) {
                    // Si el documento existe, obtenemos el rol de ahí
                    userRole = userDocSnap.data().role;
                } else {
                    // Esto no debería ocurrir si registerUser/loginUser/googleLogin
                    // ya crean el documento, pero es un fallback.
                    console.warn("Documento de usuario no encontrado en Firestore después de iniciar sesión. Asumiendo rol 'cliente' por defecto o manejando como error.");
                    userRole = 'cliente'; // O maneja esto como un error de acceso
                }

                // --- NUEVA LÓGICA: Denegar acceso por conflicto de cuentas ---
                const previousSession = JSON.parse(sessionStorage.getItem('user'));
                if (previousSession && previousSession.email !== user.email) {
                    formMessage.textContent = 'Usted no puede iniciar sesion a mesero.html, chef.html y admin.html con varias cuentas a la vez o cuentas que no te corresponden, favor de ingresar a este sitio con tu cuenta';
                    formMessage.style.color = '#dc3545';
                    await logoutUser();
                    sessionStorage.removeItem('user');
                    return;
                }

                // Ahora, verifica el rol obtenido de Firestore
                if (userRole === 'administrador') {
                    formMessage.textContent = '¡Inicio de sesión exitoso! Redirigiendo...';
                    formMessage.style.color = '#28a745';

                    // Opcional: Guardar la información del usuario en sessionStorage
                    sessionStorage.setItem('user', JSON.stringify({
                        uid: user.uid,
                        email: user.email,
                        name: user.displayName,
                        role: userRole // El rol obtenido de Firestore
                    }));

                    window.location.href = '/pages/admin.html'; // Redirigir a la página de administrador
                } else {
                    formMessage.textContent = 'Acceso denegado: Solo los administradores pueden iniciar sesión aquí.';
                    formMessage.style.color = '#dc3545';
                    // Opcional: Cerrar la sesión del usuario si no es un administrador
                    // await signOut(auth);
                }
            } catch (error) {
                console.error('Error durante el inicio de sesión:', error.message);
                formMessage.textContent = `Error de inicio de sesión: ${error.message}`;
                formMessage.style.color = '#dc3545';
            }
        } else {
            formMessage.textContent = 'Por favor, corrige los errores en el formulario.';
            formMessage.style.color = '#dc3545';
        }
    });
    
});