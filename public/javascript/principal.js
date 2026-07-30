import { auth } from './auth/firebaseConfig.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const userIcon = document.getElementById('userIcon');
const userSubmenu = document.getElementById('userSubmenu');
const userNameSpan = document.getElementById('userName');
const userEmailSpan = document.getElementById('userEmail');
const configButton = document.getElementById('configButton');
const logoutButton = document.getElementById('logoutButton');
const confirmLogoutDialog = document.getElementById('confirmLogoutDialog');
const confirmLogoutYes = document.getElementById('confirmLogoutYes');
const confirmLogoutNo = document.getElementById('confirmLogoutNo');
const userMenu = document.getElementById('userMenu');

function toggleSubmenu(event) {
    userSubmenu.classList.toggle('show');
    event.stopPropagation(); // Evita que el clic se propague al documento
}

// Inicialmente, el icono está visible pero no es funcional.
// El listener se añadirá solo si el usuario está autenticado.
userIcon.style.pointerEvents = 'none';
userIcon.style.opacity = '0.5';

// Ocultar el submenú si se hace clic fuera de él
document.addEventListener('click', (event) => {
    if (!userSubmenu.contains(event.target) && !userIcon.contains(event.target)) {
        userSubmenu.classList.remove('show');
    }
});

// --- Lógica de Autenticación Firebase para el Menú de Usuario ---
onAuthStateChanged(auth, (user) => {
    if (user) { // Si hay un usuario autenticado en Firebase...
        // Usar sessionStorage solo como datos de presentación opcionales.
        const userDataString = sessionStorage.getItem('user');
        let name = user.displayName || user.email || 'Usuario';
        let email = user.email || 'No disponible';

        if (userDataString) {
            try {
                const userData = JSON.parse(userDataString);
                name = userData.name || name;
                email = userData.email || email;
            } catch (error) {
                console.warn('No se pudo leer sessionStorage:', error);
            }
        }

        userNameSpan.textContent = name;
        userEmailSpan.textContent = email;

        // Mantener una copia de los datos para garantizar consistencia si faltan.
        sessionStorage.setItem('user', JSON.stringify({
            uid: user.uid,
            email: user.email,
            name: user.displayName || user.email,
        }));

        // Habilitamos la funcionalidad del icono
        userIcon.style.pointerEvents = 'auto';
        userIcon.style.opacity = '1';
        userIcon.addEventListener('click', toggleSubmenu);
    } else {
    } else {
        // No hay usuario logueado: el icono permanece inactivo y el listener no se añade.
        // Podrías redirigir a login.html aquí si esta página siempre debe ser privada.
    }
});

// --- Lógica de Botones del Submenú ---
configButton.addEventListener('click', () => {
    userSubmenu.classList.remove('show');
    window.location.href = '/pages/perfil.html';
});

logoutButton.addEventListener('click', () => {
    userSubmenu.classList.remove('show');
    confirmLogoutDialog.style.display = 'flex';
});

confirmLogoutYes.addEventListener('click', async () => {
    try {
        await signOut(auth);
        sessionStorage.removeItem('user'); // Limpiamos la sesión del navegador
        console.log("Sesión cerrada exitosamente.");
        window.location.href = '/login.html';
    } catch (error) {
        console.error("Error al cerrar sesión:", error);
        // Usar un alert simple como fallback si el modal falla.
        alert("Ocurrió un error al cerrar sesión. Por favor, inténtalo de nuevo.");
    } finally {
        confirmLogoutDialog.style.display = 'none';
    }
});

confirmLogoutNo.addEventListener('click', () => {
    confirmLogoutDialog.style.display = 'none';
});

// Permite cerrar el diálogo haciendo clic en el fondo oscuro
confirmLogoutDialog.addEventListener('click', (event) => {
    if (event.target === confirmLogoutDialog) {
        confirmLogoutDialog.style.display = 'none';
    }
});