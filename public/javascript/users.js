// javascript/users.js

import { auth, db } from './auth/firebaseConfig.js';
import { onAuthStateChanged, signOut, getIdTokenResult } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    deleteDoc,
    updateDoc,
    arrayRemove
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    // Verificar autenticación y rol al cargar
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            await checkUserRole(user);
        } else {
            window.location.href = '/login.html';
        }
    });

    // Función para verificar si el usuario es administrador
    async function checkUserRole(user) {
        try {
            const tokenResult = await getIdTokenResult(user, true);
            const userRole = tokenResult.claims.role;

            if (userRole === 'administrador') {
                initializeUserMenu();
                initializeUsersPage(user.uid);
            } else {
                throw new Error(`Acceso denegado. Se requiere rol de 'administrador'.`);
            }
        } catch (error) {
            console.error("Error al verificar el rol del usuario:", error);
            alert(error.message);
            await signOut(auth);
            window.location.href = '/login.html';
        }
    }

    // Inicializar el menú de usuario (Copiado y adaptado de ordenes.js)
    function initializeUserMenu() {
        const userIcon = document.getElementById('userIcon');
        const userSubmenu = document.getElementById('userSubmenu');
        const userNameSpan = document.getElementById('userName');
        const userEmailSpan = document.getElementById('userEmail');
        const logoutButton = document.getElementById('logoutButton');
        const confirmLogoutDialog = document.getElementById('confirmLogoutDialog');
        const confirmLogoutYes = document.getElementById('confirmLogoutYes');
        const confirmLogoutNo = document.getElementById('confirmLogoutNo');

        const userDataString = sessionStorage.getItem('user');
        if (userDataString) {
            const userData = JSON.parse(userDataString);
            userNameSpan.textContent = userData.name || 'Usuario';
            userEmailSpan.textContent = userData.email || 'No disponible';
        }

        userIcon.addEventListener('click', (event) => {
            userSubmenu.classList.toggle('show');
            event.stopPropagation();
        });

        document.addEventListener('click', (event) => {
            if (!userSubmenu.contains(event.target) && !userIcon.contains(event.target)) {
                userSubmenu.classList.remove('show');
            }
        });

        logoutButton.addEventListener('click', () => {
            userSubmenu.classList.remove('show');
            confirmLogoutDialog.style.display = 'flex';
        });

        confirmLogoutYes.addEventListener('click', async () => {
            await signOut(auth);
            sessionStorage.removeItem('user');
            window.location.href = '/login.html';
        });

        confirmLogoutNo.addEventListener('click', () => {
            confirmLogoutDialog.style.display = 'none';
        });
    }

    // Inicializar la página de usuarios
    async function initializeUsersPage(adminId) {
        await loadAdminAppearanceSettings(adminId);
        await loadAndRenderUsers(adminId);
    }

    // Cargar ajustes de apariencia (Consistencia con ordenes.js)
    async function loadAdminAppearanceSettings(adminId) {
        const headerTextElement = document.getElementById('header-text');
        const restaurantLogoImg = document.getElementById('restaurant-logo');

        try {
            const adminDocRef = doc(db, 'users', adminId);
            const adminDocSnap = await getDoc(adminDocRef);

            if (adminDocSnap.exists() && adminDocSnap.data().appearanceSettings) {
                const settings = adminDocSnap.data().appearanceSettings;
                
                if (settings.headerText && headerTextElement) headerTextElement.textContent = settings.headerText;
                if (settings.logoUrl && restaurantLogoImg) {
                    restaurantLogoImg.src = settings.logoUrl;
                    restaurantLogoImg.style.display = 'block';
                }
            }
        } catch (error) {
            console.error("Error al cargar los ajustes de apariencia:", error);
        }
    }
    // Cargar y renderizar la lista de empleados
    async function loadAndRenderUsers(adminId) {
        const usersContainer = document.getElementById('usersContainer');
        const employeesRef = collection(db, 'users', adminId, 'empleados');

        try {
            const querySnapshot = await getDocs(employeesRef);

            usersContainer.innerHTML = ''; // Limpiar contenedor

            if (querySnapshot.empty) {
                usersContainer.innerHTML = '<p class="no-users-message">No hay empleados registrados aún.</p>';
                return;
            }

            // Crear un contenedor tipo grid
            const gridContainer = document.createElement('div');
            gridContainer.className = 'users-grid';

            querySnapshot.forEach(docSnap => {
                const employee = docSnap.data();
                const employeeId = docSnap.id;

                const userCard = document.createElement('div');
                userCard.className = 'user-card';

                // Contenido de la tarjeta del empleado
                userCard.innerHTML = `
                    <h4>${employee.displayName || 'Sin Nombre'}</h4>
                    <p style="text-align: center; margin-bottom: 5px;"><strong>Email:</strong> ${employee.email}</p>
                    <p style="text-align: center; margin-bottom: 15px; color: #28a745;"><strong>Rol:</strong> ${employee.role}</p>
                    <div class="user-actions">
                        <button class="delete-button" data-uid="${employeeId}" data-name="${employee.displayName}" style="background-color: #dc3545; color: white;">
                            <i class="fas fa-trash"></i> Eliminar
                        </button>
                    </div>
                `;
                gridContainer.appendChild(userCard);
            });

            usersContainer.appendChild(gridContainer);

            // Añadir listeners a los botones de eliminar
            document.querySelectorAll('.delete-button').forEach(button => {
                button.addEventListener('click', (event) => {
                    const uid = event.currentTarget.dataset.uid;
                    const name = event.currentTarget.dataset.name;
                    handleDeleteUser(adminId, uid, name);
                });
            });

        } catch (error) {
            console.error("Error al cargar empleados:", error);
            usersContainer.innerHTML = `<p class="no-users-message" style="color: #dc3545;">Error al cargar empleados: ${error.message}</p>`;
        }
    }

    // Manejar la eliminación de un usuario
    async function handleDeleteUser(adminId, employeeId, employeeName) {
        const confirmDelete = confirm(`¿Estás seguro de que deseas eliminar al empleado "${employeeName}"? Esta acción lo eliminará de la base de datos y no podrá acceder.`);

        if (confirmDelete) {
            try {
                // 1. Eliminar el documento de la subcolección 'empleados'
                await deleteDoc(doc(db, 'users', adminId, 'empleados', employeeId));

                // 2. Eliminar el ID del empleado del array 'empleados' en el documento del administrador
                await updateDoc(doc(db, 'users', adminId), {
                    empleados: arrayRemove(employeeId)
                });

                alert(`El empleado ${employeeName} ha sido eliminado correctamente.`);
                
                // Recargar la lista
                await loadAndRenderUsers(adminId);

            } catch (error) {
                console.error("Error al eliminar empleado:", error);
                alert("Hubo un error al eliminar al empleado: " + error.message);
            }
        }
    }
});
