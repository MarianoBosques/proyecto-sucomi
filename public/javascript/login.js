// javascript/login.js 

import { loginUser, registerUser, googleLogin } from './auth/authFunctions.js';

const signUpButton = document.getElementById('sign-up-btn');
const signInButton = document.getElementById('sign-in-btn');
const container = document.querySelector('.container');

// Manejo de la transición de formularios (Registro/Inicio)
if (signUpButton && container) {
    signUpButton.addEventListener('click', () => {
        container.classList.add('sign-up-mode');
    });
}

if (signInButton && container) {
    signInButton.addEventListener('click', () => {
        container.classList.remove('sign-up-mode');
    });
}

//Inicio de Sesión de usuario
const signInForm = document.querySelector('.sign-in-form');
if (signInForm) {
    signInForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Aseguramos que las variables 'email' y 'password'
        // se definan antes de ser usadas por loginUser.
        // 1. Obtener los elementos input de forma robusta
        const emailInput = e.target.querySelector('input[placeholder="Correo Electronico"]');
        const passwordInput = e.target.querySelector('input[placeholder="Contraseña"]');
        
        // Comprobación de seguridad
        if (!emailInput || !passwordInput) {
            console.error('Error de formulario: No se encontraron los campos de Usuario o Contraseña.');
            if (typeof showModal === 'function') {
                showModal('Error interno de la aplicación. Por favor, contacte a soporte.');
            }
            return;
        }

        // 2. Declarar y asignar los valores para que estén definidos
        const email = emailInput.value;
        const password = passwordInput.value;
        
        try {
            // Ahora 'email' y 'password' están correctamente definidos aquí
            const user = await loginUser(email, password); 
            sessionStorage.setItem('user', JSON.stringify(user));
            
            window.location.href = '/principal.html';
        } catch (error) {
            console.error('Login error:', error);
            if (typeof showModal === 'function') {
                showModal(error.message);
            } else {
                alert(error.message);
            }
        }
    });
}


// Registro de Usuario
const signUpForm = document.querySelector('.sign-up-form');
if (signUpForm) {
    signUpForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Selectores para Registro
        const name = e.target.querySelector('input[placeholder="Usuario"]').value;
        const email = e.target.querySelector('input[placeholder="Correo Electronico"]').value;
        const password = e.target.querySelector('input[placeholder="Contraseña"]').value;

        try {
            await registerUser({ email, password, name });
            // Después del registro, mostramos el formulario de inicio de sesión
            showModal('¡Registro exitoso! Por favor, inicia sesión con tu nuevo usuario.', '¡Éxito!');
            container.classList.remove('sign-up-mode'); 
        } catch (error) {
            console.error('Registration error:', error);
            if (typeof showModal === 'function') {
                showModal(error.message);
            } else {
                alert(error.message);
            }
        }
    });
}


// LÓGICA DE INICIO DE SESIÓN CON GOOGLE

const googleLoginButton = document.getElementById('googleLogin');
if (googleLoginButton) {
    googleLoginButton.addEventListener('click', async (e) => {
        e.preventDefault(); 
        
        try {
            const user = await googleLogin();
            sessionStorage.setItem('user', JSON.stringify(user));

            
            window.location.href = '/principal.html';
        } catch (error) {
            console.error('Google login error:', error);
            if (typeof showModal === 'function') {
                showModal(error.message);
            } else {
                alert(error.message);
            }
        }
    });
}

// LÓGICA PARA EL MODAL DE TÉRMINOS Y CONDICIONES
const termsLinks = document.querySelectorAll('.terms-link-trigger');
const termsModal = document.getElementById('termsModal');
const closeButton = document.querySelector('.close-button');

if (termsLinks.length > 0 && termsModal && closeButton) {
    // Abrir el modal al hacer clic en cualquiera de los enlaces
    termsLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault(); // Evita que el enlace navegue
            termsModal.classList.add('show');
        });
    });

    // Cerrar el modal con el botón 'X'
    closeButton.addEventListener('click', () => {
        termsModal.classList.remove('show');
    });

    // Cerrar el modal al hacer clic fuera del contenido
    window.addEventListener('click', (e) => {
        // Si el clic fue sobre el fondo del modal
        if (e.target === termsModal) {
            termsModal.classList.remove('show');
        }
    });
}


function showError(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.style.display = 'block';
        setTimeout(() => element.style.display = 'none', 5000);
    }
}

function showModal(message, title = "Aviso") {
    const modal = document.getElementById('customErrorModal');
    if (modal) {
        const modalMessage = document.getElementById('errorMessageText');
        const modalTitle = document.getElementById('errorModalTitle');
        const modalContent = modal.querySelector('.modal-content');
        
        if (modalTitle) modalTitle.textContent = title;
        
        if (modalMessage) {
            modalMessage.textContent = message;
        }
        
        modal.style.display = 'flex';
        modal.classList.remove('closing');
        modalContent.classList.remove('closing');
        
        const closeModalButton = document.querySelector('.close-modal');
        if (closeModalButton) {
            closeModalButton.onclick = () => {
                modal.classList.add('closing');
                modalContent.classList.add('closing');
                setTimeout(() => {
                    modal.style.display = 'none';
                }, 300);
            };
        }
        
        window.onclick = (event) => {
            if (event.target === modal) {
                closeModalButton.click();
            }
        };
    } else {
        alert("Error: " + message);
    }
}





//MOSTRAR Y OCULTAR CONTRASEÑA

function setupPasswordToggle(inputId, iconId) {
    const passwordInput = document.getElementById(inputId);
    const toggleIcon = document.getElementById(iconId);

    // Solo activamos si ambos elementos existen en el HTML
    if (passwordInput && toggleIcon) {
        toggleIcon.addEventListener('click', () => {
            // 1. Alternar tipo de input
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);

            // 2. Alternar icono (Ojo normal <-> Ojo tachado)
            toggleIcon.classList.toggle('fa-eye-slash'); 
            // Nota: Asume que el icono inicial tiene la clase 'fa-eye'
        });
    }
}

// Inicializamos la función para ambos formularios (Login y Registro)
// Asegúrate de agregar estos IDs en tu HTML
document.addEventListener('DOMContentLoaded', () => {
    setupPasswordToggle('id_password_login', 'id_toggle_login');
    setupPasswordToggle('id_password_register', 'id_toggle_register');
});