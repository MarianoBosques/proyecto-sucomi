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
            const submitBtn = loginForm.querySelector('input[type="submit"]');
            submitBtn.disabled = true; // Deshabilitar para evitar múltiples clics

            try {
                const previousSession = JSON.parse(sessionStorage.getItem('user'));
                const inputEmail = usernameInput.value.trim().toLowerCase();

                // --- VALIDACIÓN PREVIA: Denegar si ya hay una sesión con otro correo ---
                if (previousSession) {
                    const sessionEmail = (previousSession.email || '').toLowerCase().trim();
                    if (sessionEmail !== inputEmail) {
                        formMessage.textContent = 'Usted no puede iniciar sesion a mesero.html, chef.html y admin.html con varias cuentas a la vez o cuentas que no te corresponden, favor de ingresar a este sitio con tu cuenta';
                        formMessage.style.color = '#dc3545';
                        submitBtn.disabled = false;
                        return;
                    }
                }

                // Primero, inicia sesión con email/password usando authFunctions.js
                // loginUser retornará la credencial de usuario
                const userLoginData = await loginUser(usernameInput.value, passwordInput.value);
                const userRole = userLoginData.role;
                const currentEmail = userLoginData.email ? userLoginData.email.toLowerCase() : '';

                // Ahora, verifica el rol obtenido de Firestore
                if (userRole === 'administrador') {
                    
                    // --- NUEVA LÓGICA: Denegar acceso por conflicto de cuentas ---
                    if (previousSession) {
                        const sessionEmail = previousSession.email ? previousSession.email.toLowerCase() : '';
                        if (sessionEmail !== currentEmail) {
                            formMessage.textContent = 'Usted no puede iniciar sesion a mesero.html, chef.html y admin.html con varias cuentas a la vez o cuentas que no te corresponden, favor de ingresar a este sitio con tu cuenta';
                            formMessage.style.color = '#dc3545';
                            await logoutUser();
                            sessionStorage.removeItem('user');
                            submitBtn.disabled = false;
                            return;
                        }
                    }

                    formMessage.textContent = '¡Inicio de sesión exitoso! Redirigiendo...';
                    formMessage.style.color = '#28a745';

                    // Opcional: Guardar la información del usuario en sessionStorage
                    sessionStorage.setItem('user', JSON.stringify(userLoginData));

                    window.location.href = '/pages/admin.html'; // Redirigir a la página de administrador
                } else {
                    formMessage.textContent = `Acceso denegado: Solo los administradores pueden iniciar sesión aquí. Tu rol es: ${userRole || 'desconocido'}`;
                    formMessage.style.color = '#dc3545';
                    await logoutUser();
                    submitBtn.disabled = false;
                }
            } catch (error) {
                console.error('Error durante el inicio de sesión:', error.message);
                formMessage.textContent = `Error de inicio de sesión: ${error.message}`;
                formMessage.style.color = '#dc3545';
            } finally {
                submitBtn.disabled = false; // Rehabilitar si hay error o termina
            }
        } else {
            formMessage.textContent = 'Por favor, corrige los errores en el formulario.';
            formMessage.style.color = '#dc3545';
        }
    });
    
});