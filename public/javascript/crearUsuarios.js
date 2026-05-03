// javascript/crearUsuarios.js

// 💡 CORRECCIÓN CLAVE: 
// 1. Importar la instancia 'functions' ya configurada desde firebaseConfig.js
// 2. Eliminar 'getFunctions' de las importaciones del SDK.
import { auth, functions } from './auth/firebaseConfig.js'; 
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js"; // Solo necesitamos httpsCallable

const handleAuthError = (error) => {
    let message = '';
    switch (error.code) {
        case 'auth/email-already-in-use':
            message = 'El correo ya está registrado.';
            break;
        case 'auth/invalid-email':
            message = 'Correo electrónico inválido.';
            break;
        case 'auth/weak-password':
            message = 'La contraseña debe tener al menos 6 caracteres.';
            break;
        default:
            message = `Error de registro: ${error.message}`;
    }
    return message;
};

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('userForm');
    const registrarBtn = document.getElementById('registrarBtn');
    const nombreInput = document.getElementById('nombre');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const formMessage = document.getElementById('formMessage');

    const nombreError = document.getElementById('nombreError');
    const emailError = document.getElementById('emailError');
    const passwordError = document.getElementById('passwordError');
    const cargoError = document.getElementById('cargoError');

    nombreError.classList.remove('show');
    emailError.classList.remove('show');
    passwordError.classList.remove('show');
    cargoError.classList.remove('show');

    let adminUid = null;

    onAuthStateChanged(auth, (user) => {
        if (user) {
            adminUid = user.uid;
            console.log("Admin logueado con UID:", adminUid);
        } else {
            console.warn("No hay administrador logueado. Redirigiendo.");
            window.location.href = '/adminLogin.html';
        }
    });

    // 💡 USAMOS LA INSTANCIA 'functions' IMPORTADA Y CONFIGURADA PARA EL EMULADOR
    const registrarEmpleado = httpsCallable(functions, 'registrarEmpleado_v2'); 

    registrarBtn.addEventListener('click', async function() {
        let isValid = true;
        formMessage.textContent = '';
        formMessage.style.color = '';

        if (nombreInput.value.trim() === '') {
            nombreInput.classList.add('input-error');
            nombreError.classList.add('show');
            isValid = false;
        } else {
            nombreInput.classList.remove('input-error');
            nombreError.classList.remove('show');
        }

        if (emailInput.value.trim() === '') {
            emailInput.classList.add('input-error');
            emailError.classList.add('show');
            isValid = false;
        } else {
            emailInput.classList.remove('input-error');
            emailError.classList.remove('show');
        }

        if (passwordInput.value.trim() === '') {
            passwordInput.classList.add('input-error');
            passwordError.classList.add('show');
            isValid = false;
        } else if (passwordInput.value.trim().length < 6) {
            passwordInput.classList.add('input-error');
            passwordError.textContent = 'La contraseña debe tener al menos 6 caracteres.';
            passwordError.classList.add('show');
            isValid = false;
        } else {
            passwordInput.classList.remove('input-error');
            passwordError.classList.remove('show');
            passwordError.textContent = 'Este campo es obligatorio';
        }

        const cargo = document.querySelector('input[name="cargo"]:checked');
        if (!cargo) {
            cargoError.classList.add('show');
            isValid = false;
        } else {
            cargoError.classList.remove('show');
        }

        if (isValid) {
            try {
                // Asegurarse de que adminUid tiene un valor antes de llamar
                if (!adminUid) {
                    throw new Error("El administrador no está autenticado. Intente de nuevo.");
                }

                const result = await registrarEmpleado({
                    email: emailInput.value,
                    password: passwordInput.value,
                    displayName: nombreInput.value,
                    role: cargo.value,
                    adminId: adminUid 
                });

                formMessage.textContent = result.data.message;
                formMessage.style.color = '#28a745';
                form.reset();
            } catch (error) {
                console.error("Error al registrar usuario:", error);
                
                let displayMessage = error.message.includes('internal')
                                                 ? 'Error interno. Verifique si la Cloud Function está corriendo en el emulador.'
                                                 : handleAuthError(error);

                formMessage.textContent = `Error: ${displayMessage}`;
                formMessage.style.color = '#dc3545';
            }
        }
    });
});