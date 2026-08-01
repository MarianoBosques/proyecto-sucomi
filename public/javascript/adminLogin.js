// javascript/adminLogin.js

import { loginUser, logoutUser, validateSessionForLogin } from './auth/authFunctions.js';
import { auth } from './auth/firebaseConfig.js';

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
                // Primero, inicia sesión con email/password usando authFunctions.js
                // loginUser retornará la credencial de usuario
                const userLoginData = await loginUser(usernameInput.value, passwordInput.value);
                const userRole = userLoginData.role;

                await validateSessionForLogin(auth, userLoginData);

                // Ahora, verifica el rol obtenido de Firestore
                if (userRole === 'administrador') {
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