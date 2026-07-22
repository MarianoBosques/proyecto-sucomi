// javascript/utils/uiHelpers.js

import { signOut, getIdTokenResult } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * Verifica el rol del usuario utilizando sessionStorage y/o Claims de Firebase Auth.
 * Redirige al login correspondiente si la autenticación falla o el rol no coincide.
 */
export async function checkUserRole(auth, db, expectedRole, redirectLoginUrl = '/login.html') {
    return new Promise((resolve, reject) => {
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            unsubscribe();
            if (!user) {
                sessionStorage.removeItem('user');
                window.location.href = redirectLoginUrl;
                return reject(new Error("Usuario no autenticado"));
            }

            try {
                // 💡 MEJORA SEGURIDAD: Validar el token de sesión (Custom Claims) en tiempo real con Firebase Auth
                // Refrescamos proactivamente el token para asegurar la validez de los roles.
                const tokenResult = await getIdTokenResult(user, true);
                const claims = tokenResult.claims;
                
                let adminId = user.uid;
                let role = claims.role;
                let displayName = user.displayName || user.email;

                if (expectedRole === 'administrador') {
                    // Obtener datos del administrador directamente de Firestore para reconstruir el displayName y rol si es necesario
                    const userDocRef = doc(db, 'users', user.uid);
                    const userDocSnap = await getDoc(userDocRef);
                    if (userDocSnap.exists()) {
                        const data = userDocSnap.data();
                        if (data.role === 'administrador') {
                            role = 'administrador';
                        }
                        if (data.displayName) {
                            displayName = data.displayName;
                        }
                    } else if (role !== 'administrador') {
                        throw new Error('Acceso denegado. No tienes permisos de administrador.');
                    }
                } else {
                    if (role !== expectedRole || !claims.adminId) {
                        throw new Error(`Acceso denegado. Se requiere rol de '${expectedRole}' y vinculación de administrador.`);
                    }
                    adminId = claims.adminId;

                    // Obtener el displayName real del empleado desde Firestore
                    const employeeDocRef = doc(db, 'users', adminId, 'empleados', user.uid);
                    const employeeDocSnap = await getDoc(employeeDocRef);
                    if (employeeDocSnap.exists()) {
                        const data = employeeDocSnap.data();
                        if (data.displayName) {
                            displayName = data.displayName;
                        }
                    }
                }

                // Sincronizar sessionStorage para uso cosmético en la interfaz (nombre, correo)
                const updatedUser = {
                    uid: user.uid,
                    email: user.email,
                    name: displayName,
                    role: role,
                    adminId: adminId
                };
                sessionStorage.setItem('user', JSON.stringify(updatedUser));

                resolve({ user, adminId, role });
            } catch (error) {
                console.error("Error al verificar el rol del usuario:", error);
                alert(error.message);
                sessionStorage.removeItem('user');
                await signOut(auth);
                window.location.href = redirectLoginUrl;
                reject(error);
            }
        });
    });
}

/**
 * Inicializa el menú del usuario en la parte superior derecha de las interfaces.
 */
export function initializeUserMenu(auth, redirectLoginUrl = '/login.html', alertFn = alert) {
    const userIcon = document.getElementById('userIcon');
    const userSubmenu = document.getElementById('userSubmenu');
    const userNameSpan = document.getElementById('userName');
    const userEmailSpan = document.getElementById('userEmail');
    const configButton = document.getElementById('configButton');
    const logoutButton = document.getElementById('logoutButton');
    const confirmLogoutDialog = document.getElementById('confirmLogoutDialog');
    const confirmLogoutYes = document.getElementById('confirmLogoutYes');
    const confirmLogoutNo = document.getElementById('confirmLogoutNo');

    if (!userIcon || !userSubmenu) return;

    // Rellenar datos del usuario desde sessionStorage
    const userDataString = sessionStorage.getItem('user');
    if (userDataString && userNameSpan && userEmailSpan) {
        const userData = JSON.parse(userDataString);
        userNameSpan.textContent = userData.name || 'Usuario';
        userEmailSpan.textContent = userData.email || 'No disponible';
    }

    // Mostrar/ocultar submenú
    userIcon.addEventListener('click', (event) => {
        userSubmenu.classList.toggle('show');
        event.stopPropagation();
    });

    // Ocultar al hacer clic fuera
    document.addEventListener('click', (event) => {
        if (!userSubmenu.contains(event.target) && !userIcon.contains(event.target)) {
            userSubmenu.classList.remove('show');
        }
    });

    // Configuración de redirección
    if (configButton) {
        configButton.addEventListener('click', () => {
            window.location.href = '/pages/perfil.html';
        });
    }

    if (logoutButton && confirmLogoutDialog) {
        logoutButton.addEventListener('click', () => {
            userSubmenu.classList.remove('show');
            confirmLogoutDialog.style.display = 'flex';
        });
    }

    if (confirmLogoutYes && confirmLogoutDialog) {
        confirmLogoutYes.addEventListener('click', async () => {
            try {
                await signOut(auth);
                sessionStorage.removeItem('user');
                window.location.href = redirectLoginUrl;
            } catch (error) {
                console.error("Error al cerrar sesión:", error);
                alertFn("Ocurrió un error al cerrar sesión.");
            }
        });
    }

    if (confirmLogoutNo && confirmLogoutDialog) {
        confirmLogoutNo.addEventListener('click', () => {
            confirmLogoutDialog.style.display = 'none';
        });
    }
}

/**
 * Carga los ajustes de apariencia del administrador y los aplica en la cabecera.
 */
export async function loadAdminAppearanceSettings(db, adminId) {
    const headerTextElement = document.getElementById('header-text');
    const restaurantLogoImg = document.getElementById('restaurant-logo');
    if (!headerTextElement && !restaurantLogoImg) return;

    try {
        const adminDocRef = doc(db, 'users', adminId);
        const adminDocSnap = await getDoc(adminDocRef);

        if (adminDocSnap.exists() && adminDocSnap.data().appearanceSettings) {
            const settings = adminDocSnap.data().appearanceSettings;
            if (settings.headerText && headerTextElement) {
                headerTextElement.textContent = settings.headerText;
            }
            if (settings.logoUrl && restaurantLogoImg) {
                restaurantLogoImg.src = settings.logoUrl;
                restaurantLogoImg.style.display = 'block';
            }
        }
    } catch (error) {
        console.error("Error al cargar los ajustes de apariencia:", error);
    }
}

/**
 * Imprime una orden clonando el elemento HTML del cliente.
 */
export function printOrder(orderCardElement) {
    if (!orderCardElement) return;
    const contentToPrint = orderCardElement.cloneNode(true);

    // Eliminar botones o elementos que no deban imprimirse
    const actionsDiv = contentToPrint.querySelector('.order-actions');
    if (actionsDiv) {
        actionsDiv.remove();
    }

    const printWindow = window.open('', '_blank');
    printWindow.document.write('<html><head><title>Imprimir Orden</title>');
    printWindow.document.write('<style>');
    printWindow.document.write(`
        body { font-family: Arial, sans-serif; margin: 20px; }
        h4 { font-size: 1.4em; text-align: center; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 10px; margin-bottom: 15px; }
        p { margin: 5px 0; }
        .waiter-name { font-style: italic; color: #555; }
        pre { white-space: pre-wrap; font-family: 'Courier New', Courier, monospace; background-color: #f9f9f9; padding: 10px; border: 1px solid #ddd; border-radius: 5px; }
        .total-price { font-weight: bold; font-size: 1.2em; text-align: right; margin-top: 15px; padding-top: 10px; border-top: 1px dashed #ccc; }
        .timestamp { font-size: 0.8em; color: #777; text-align: right; }
    `);
    printWindow.document.write('</style></head><body>');
    printWindow.document.write(contentToPrint.innerHTML);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.print();
}
