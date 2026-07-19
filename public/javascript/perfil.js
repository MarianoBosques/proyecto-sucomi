import { 
    auth, 
    db
} from './auth/firebaseConfig.js'; 
import { 
    doc, 
    getDoc, 
    setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { updateProfile, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js"; 
import { resetPassword } from './auth/authFunctions.js';

/**
 * Cambia la sección visible del perfil (Mi perfil o Configuración).
 * @param {string} opcion - 'perfil' para la sección de edición de perfil, 'config' para la de configuración.
 */
function irA(opcion) {
    const perfilSection = document.getElementById("perfil-section");
    const configSection = document.getElementById("config-section");
    // Ya no es necesario, solo hay una sección. Dejamos la función por si se reutiliza.
}

function volverInicio() {
    // Regresa a la página anterior en el historial del navegador.
    window.history.back();
}

async function cerrarSesion() {
    const confirmed = await showModal({
        title: 'Cerrar Sesión',
        message: '¿Deseas cerrar sesión?',
        confirmText: 'Sí',
        cancelText: 'No'
    });

    if (confirmed) {
        try {
            await signOut(auth);
            sessionStorage.removeItem('user');
            window.location.href = "/login.html";
        } catch (error) {
            console.error("Error al cerrar sesión:", error);
            alert("No se pudo cerrar la sesión: " + error.message);
        }
    }
}

/**
 * Obtiene la referencia al documento del usuario en Firestore, sin importar su rol.
 * @param {object} user - El objeto de usuario de Firebase Auth.
 * @returns {Promise<DocumentReference|null>} - La referencia al documento o null si hay error.
 */
async function getUserDocRef(user) {
    if (!user) return null;
    try {
        const tokenResult = await user.getIdTokenResult(true); // Forzar recarga de claims
        const claims = tokenResult.claims;
        const userRole = claims.role;
        const adminId = claims.adminId;

        if (userRole === 'administrador') {
            return doc(db, 'users', user.uid);
        } else if ((userRole === 'chef' || userRole === 'mesero') && adminId) {
            return doc(db, 'users', adminId, 'empleados', user.uid);
        } else {
            console.error("Rol de usuario desconocido o falta adminId para empleado:", userRole);
            return null;
        }
    } catch (error) {
        console.error("Error obteniendo el token o los claims del usuario:", error);
        return null;
    }
}

async function loadUserProfile() {
    const user = auth.currentUser; // Obtiene el usuario actualmente autenticado
    if (user) {
        const usernameDisplay = document.getElementById("usernameDisplay");
        const usernameInput = document.getElementById("usernameInput");

        if (usernameDisplay) {
            usernameDisplay.textContent = user.displayName || user.email || "Usuario sin nombre"; 
        }

        if (usernameInput) {
            usernameInput.value = user.displayName || ""; 
        }

        // La lógica de descripción y avatar se ha eliminado.

    } else {
        console.log("No hay usuario autenticado. Redirigiendo a login.");
        window.location.href = "/pages/login.html"; 
    }
}

async function guardarPerfil() {
    const user = auth.currentUser;
    if (!user) {
        alert("No hay usuario autenticado para guardar el perfil.");
        window.location.href = "/login.html"; 
        return;
    }

    const usernameInput = document.getElementById("usernameInput");
    const newDisplayName = usernameInput ? usernameInput.value.trim() : user.displayName;

    try {
        // 1. Actualizar el perfil de Firebase Authentication (esto es global)
        if (newDisplayName && newDisplayName !== user.displayName) {
            await updateProfile(user, {
                displayName: newDisplayName
            });
            // Actualizar la UI inmediatamente
            const usernameDisplay = document.getElementById("usernameDisplay");
            if (usernameDisplay) {
                usernameDisplay.textContent = newDisplayName;
            }
            console.log("Nombre de usuario actualizado en Firebase Authentication.");
        }

        // 2. Actualizar el documento en Firestore (admin o empleado)
        const userDocRef = await getUserDocRef(user);
        if (userDocRef) {
            await setDoc(userDocRef, {
                displayName: newDisplayName,
            }, { merge: true });
            console.log("Nombre de usuario actualizado en el documento de Firestore.");
        } else {
            throw new Error("No se pudo obtener la referencia al documento del usuario.");
        }

        alert(`Perfil guardado exitosamente.`);

    } catch (error) {
        console.error('Error al guardar el perfil:', error);
        alert("Error al guardar el perfil: " + error.message);
    }
}

function irARestaurarContrasena() {
    window.location.href = "/pages/restContrasenia.html";
}

// --- Lógica del Modal Personalizado ---
const showModal = (config) => {
    const modal = document.getElementById('customModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const modalBtnConfirm = document.getElementById('modalBtnConfirm');
    const modalBtnCancel = document.getElementById('modalBtnCancel');

    return new Promise((resolve) => {
        modalTitle.textContent = config.title;
        modalMessage.textContent = config.message;

        modalBtnConfirm.textContent = config.confirmText || 'Aceptar';
        modalBtnCancel.textContent = config.cancelText || 'Cancelar';

        modal.style.display = 'flex';
        modal.classList.remove('closing');
        modal.querySelector('.modal-content').classList.remove('closing');

        const closeModal = (value) => {
            modal.classList.add('closing');
            modal.querySelector('.modal-content').classList.add('closing');
            // Espera a que la animación de salida termine para ocultar el modal
            const onAnimationEnd = () => {
                modal.style.display = 'none';
                modal.removeEventListener('animationend', onAnimationEnd);
                resolve(value);
            };
            modal.addEventListener('animationend', onAnimationEnd);
        };

        modalBtnConfirm.onclick = () => closeModal(true);
        modalBtnCancel.onclick = () => closeModal(false);
    });
};

auth.onAuthStateChanged(user => {
    if (user) {
        console.log("Usuario autenticado en perfil.js:", user.uid, "Email:", user.email, "Nombre:", user.displayName);
        loadUserProfile();
    } else {
        console.log("No hay usuario autenticado. Redirigiendo a login.");
        window.location.href = "/login.html";
    }
});

/**
 * Asigna los event listeners a los botones de la página.
 * Esta es la forma moderna y recomendada de manejar eventos con módulos.
 */
document.addEventListener('DOMContentLoaded', () => {
    // Botones del menú lateral (ahora barra superior en móvil)
    const btnVolver = document.querySelector('button[onclick="volverInicio()"]');
    if (btnVolver) btnVolver.addEventListener('click', volverInicio);

    const btnCerrarSesion = document.querySelector('button[onclick="cerrarSesion()"]');
    if (btnCerrarSesion) btnCerrarSesion.addEventListener('click', cerrarSesion);

    // Botones del contenido principal
    const btnCambiarPass = document.querySelector('button[onclick="irARestaurarContrasena()"]');
    if (btnCambiarPass) btnCambiarPass.addEventListener('click', irARestaurarContrasena);

    const btnGuardar = document.querySelector('button[onclick="guardarPerfil()"]');
    if (btnGuardar) btnGuardar.addEventListener('click', guardarPerfil);
});