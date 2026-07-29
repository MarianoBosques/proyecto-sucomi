// javascript/chefLogin.js

import { loginUser, logoutUser } from './auth/authFunctions.js'; 
import { auth } from './auth/firebaseConfig.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const usernameInput = document.getElementById('username'); 
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

        // Validaciones del lado del cliente (sin cambios)
        if (usernameInput.value.trim() === '') {
            usernameError.textContent = 'El correo electrónico es obligatorio.';
            isValid = false;
        } else if (!usernameInput.value.trim().includes('@')) {
            usernameError.textContent = 'Ingrese un correo electrónico válido.';
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
                const inputEmail = usernameInput.value.trim().toLowerCase();
                if (auth.currentUser && auth.currentUser.email && auth.currentUser.email.toLowerCase() !== inputEmail) {
                    await logoutUser();
                }

                // 1. INICIAR SESIÓN usando la función centralizada.
                const userLoginData = await loginUser(usernameInput.value, passwordInput.value);
                const userRole = userLoginData.role; 
                
                // 2. COMPROBACIÓN ESPECÍFICA DE ROL: Solo 'chef' puede ingresar.
                if (userRole !== 'chef') {
                    formMessage.textContent = `Solo los usuarios con el rol chef pueden ingresar, tu rol es: ${userRole || 'desconocido'}`;
                    formMessage.style.color = '#dc3545';
                    await logoutUser(); // Forzar el cierre de sesión si el rol es incorrecto
                    submitBtn.disabled = false;
                    return; // Detiene la ejecución
                }

                // 3. Almacenar datos y redirigir
                formMessage.textContent = '¡Inicio de sesión exitoso como chef! Redirigiendo...';
                formMessage.style.color = '#28a745';

                sessionStorage.setItem('user', JSON.stringify(userLoginData));

                window.location.href = '/pages/cheff.html';

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