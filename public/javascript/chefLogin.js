// javascript/chefLogin.js

import { loginUser, logoutUser } from './auth/authFunctions.js'; 

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
                // Capturamos la sesión previa antes de intentar el login
                const previousSession = JSON.parse(sessionStorage.getItem('user'));
                const inputEmail = usernameInput.value.trim().toLowerCase();

                // --- VALIDACIÓN PREVIA: Denegar si es otro empleado (Permitir si es Administrador) ---
                if (previousSession && previousSession.role !== 'administrador') {
                    const sessionEmail = (previousSession.email || '').toLowerCase().trim();
                    if (sessionEmail !== inputEmail) {
                        formMessage.textContent = 'Usted no puede iniciar sesion a mesero.html, chef.html y admin.html con varias cuentas a la vez o cuentas que no te corresponden, favor de ingresar a este sitio con tu cuenta';
                        formMessage.style.color = '#dc3545';
                        submitBtn.disabled = false;
                        return;
                    }
                }

                // 1. INICIAR SESIÓN usando la función centralizada.
                const userLoginData = await loginUser(usernameInput.value, passwordInput.value); 
                const userRole = userLoginData.role; 
                
                const currentEmail = userLoginData.email ? userLoginData.email.toLowerCase() : '';

                // --- NUEVA LÓGICA: Denegar acceso por conflicto de cuentas o falta de pertenencia ---
                if (previousSession) {
                    const sessionEmail = previousSession.email ? previousSession.email.toLowerCase() : '';
                    // Caso A: Ya hay un empleado logueado y se intenta usar otra cuenta de empleado
                    if (previousSession.role !== 'administrador' && sessionEmail !== currentEmail) {
                        formMessage.textContent = 'Usted no puede iniciar sesion a mesero.html, chef.html y admin.html con varias cuentas a la vez o cuentas que no te corresponden, favor de ingresar a este sitio con tu cuenta';
                        formMessage.style.color = '#dc3545';
                        await logoutUser();
                        sessionStorage.removeItem('user');
                        submitBtn.disabled = false;
                        return;
                    }
                    // Caso B: Hay un administrador logueado pero el empleado no pertenece a su restaurante
                    if (previousSession.role === 'administrador' && userLoginData.adminId !== previousSession.uid) {
                        formMessage.textContent = 'Usted no puede iniciar sesion a mesero.html, chef.html y admin.html con varias cuentas a la vez o cuentas que no te corresponden, favor de ingresar a este sitio con tu cuenta';
                        formMessage.style.color = '#dc3545';
                        await logoutUser();
                        sessionStorage.removeItem('user');
                        submitBtn.disabled = false;
                        return;
                    }
                }

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