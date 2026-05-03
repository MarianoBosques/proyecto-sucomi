// javascript/chef.js

// --- 1. Importaciones de tus archivos locales (INSTANCIAS de Firebase) ---
import { auth, db, functions } from './auth/firebaseConfig.js';

// --- 2. Importaciones de funciones del SDK de Firebase Authentication ---
import { onAuthStateChanged, signOut, getIdTokenResult } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- 3. Importaciones de funciones del SDK de Firebase Firestore ---
import {
    doc,
    updateDoc,
    deleteDoc,
    collection,
    query,
    onSnapshot,
    orderBy,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


document.addEventListener('DOMContentLoaded', () => {

    // 💡 --- INICIO: LÓGICA DEL MODAL PERSONALIZADO (copiada de mesero.js) ---
    const modal = document.getElementById('customModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const modalInput = document.getElementById('modalInput');
    const modalBtnConfirm = document.getElementById('modalBtnConfirm');
    const modalBtnCancel = document.getElementById('modalBtnCancel');

    const showModal = (config) => {
        return new Promise((resolve) => {
            modalTitle.textContent = config.title;
            modalMessage.textContent = config.message;

            // El input no se usa en la vista de chef, pero mantenemos la lógica por consistencia.
            modalInput.style.display = 'none';

            // Configurar botones
            modalBtnConfirm.textContent = config.confirmText || 'Aceptar';
            modalBtnCancel.style.display = config.type === 'alert' ? 'none' : 'inline-block';
            modalBtnCancel.textContent = config.cancelText || 'Cancelar';

            modal.style.display = 'flex';
            modal.classList.remove('closing');
            modal.querySelector('.modal-content').classList.remove('closing');

            const closeModal = (value) => {
                modal.classList.add('closing');
                modal.querySelector('.modal-content').classList.add('closing');
                modal.addEventListener('animationend', () => {
                    modal.style.display = 'none';
                    resolve(value);
                }, { once: true });
            };

            modalBtnConfirm.onclick = () => closeModal(true);
            modalBtnCancel.onclick = () => closeModal(false);
        });
    };

    const customAlert = (message, title = "Aviso") => {
        return showModal({ type: 'alert', title, message });
    };

    const customConfirm = (message, title = "Confirmación", confirmText = "Sí", cancelText = "No") => {
        return showModal({ type: 'confirm', title, message, confirmText, cancelText });
    };

    // 💡 --- FIN: LÓGICA DEL MODAL PERSONALIZADO ---


    // Se mantiene la lógica de autenticación y de verificación de rol
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            await checkUserRole(user);
        } else {
            // Redirige al login de empleados en caso de no estar autenticado
            window.location.href = '/waiterLogin.html';
        }
    });

    async function checkUserRole(user) {
        if (!user || !user.uid) {
            await customAlert("Error al verificar tu cuenta.", "Error de Autenticación");
            await signOut(auth);
            window.location.href = '/chefLogin.html';
            return;
        }

        try {
            // 1. Intenta obtener el rol desde sessionStorage (más rápido y estable)
            const userDataString = sessionStorage.getItem('user');
            if (userDataString) {
                const userData = JSON.parse(userDataString);
                if (userData.role === 'chef' && userData.adminId) {
                    console.log(`Acceso concedido (desde sessionStorage). Rol: ${userData.role}, Admin: ${userData.adminId}`);
                    initializeChefPanel(userData.adminId);
                    initializeUserMenu();
                    return; // Salimos de la función si el rol es correcto
                }
            }

            // 2. Si falla o no existe, verifica con el token como respaldo (más lento)
            const tokenResult = await getIdTokenResult(user, true); // Forzar solo si es necesario
            const claims = tokenResult.claims;

            if (claims.role === 'chef' && claims.adminId) {
                console.log(`Acceso concedido (desde token). Rol: ${claims.role}, Admin: ${claims.adminId}`);
                initializeChefPanel(claims.adminId);
                initializeUserMenu();
            } else {
                throw new Error(`Acceso denegado. Tu rol es '${claims.role || "desconocido"}' o falta información de administrador. Se requiere 'chef'.`);
            }
        } catch (error) {
            console.error("Error al verificar el rol del usuario:", error);
            await customAlert(error.message, "Error");
            await signOut(auth);
            window.location.href = '/login.html'; // Redirigir al login general
        }
    }

    // --- LÓGICA PARA EL MENÚ DE USUARIO (COPIADA DE admin.js) ---
    function initializeUserMenu() {
        const userIcon = document.getElementById('userIcon');
        const userSubmenu = document.getElementById('userSubmenu');
        const userNameSpan = document.getElementById('userName');
        const userEmailSpan = document.getElementById('userEmail');
        const configButton = document.getElementById('configButton');
        const logoutButton = document.getElementById('logoutButton');
        const confirmLogoutDialog = document.getElementById('confirmLogoutDialog');
        const confirmLogoutYes = document.getElementById('confirmLogoutYes');
        const confirmLogoutNo = document.getElementById('confirmLogoutNo');

        // Rellenar datos del usuario desde sessionStorage
        const userDataString = sessionStorage.getItem('user');
        if (userDataString) {
            const userData = JSON.parse(userDataString);
            userNameSpan.textContent = userData.name || 'Usuario';
            userEmailSpan.textContent = userData.email || 'No disponible';
        }

        // Función para mostrar/ocultar submenú
        function toggleSubmenu(event) {
            userSubmenu.classList.toggle('show');
            event.stopPropagation();
        }

        userIcon.addEventListener('click', toggleSubmenu);

        // Ocultar submenú al hacer clic fuera
        document.addEventListener('click', (event) => {
            if (!userSubmenu.contains(event.target) && !userIcon.contains(event.target)) {
                userSubmenu.classList.remove('show');
            }
        });

        // Lógica de botones del submenú
        configButton.addEventListener('click', () => {
            window.location.href = '/pages/perfil.html';
        });

        logoutButton.addEventListener('click', () => {
            userSubmenu.classList.remove('show');
            confirmLogoutDialog.style.display = 'flex';
        });

        // Lógica del diálogo de confirmación
        confirmLogoutYes.addEventListener('click', async () => {
            try {
                await signOut(auth);
                sessionStorage.removeItem('user');
                window.location.href = '/login.html';
            } catch (error) {
                console.error("Error al cerrar sesión:", error);
                await customAlert("Ocurrió un error al cerrar sesión.", "Error");
            }
        });

        confirmLogoutNo.addEventListener('click', () => {
            confirmLogoutDialog.style.display = 'none';
        });
    }


    // Esta función ahora es la única que inicializa el panel del chef
    function initializeChefPanel(adminId) {
        const chefOrdersList = document.getElementById('chefOrdersList');
        const mainHeader = document.getElementById('main-header');
        const headerTextElement = document.getElementById('header-text');
        
        // Cargar los ajustes de apariencia del administrador
        loadAdminAppearanceSettings(adminId);

        async function loadAdminAppearanceSettings(adminId) {
            try {
                const adminDocRef = doc(db, 'users', adminId);
                const adminDocSnap = await getDoc(adminDocRef);

                if (adminDocSnap.exists() && adminDocSnap.data().appearanceSettings) {
                    const settings = adminDocSnap.data().appearanceSettings;
                    const restaurantLogoImg = document.getElementById('restaurant-logo');

                    if (settings.headerText && headerTextElement) headerTextElement.textContent = settings.headerText;
                    if (settings.logoUrl && restaurantLogoImg) {
                        restaurantLogoImg.src = settings.logoUrl;
                        restaurantLogoImg.style.display = 'block';
                    }
                }
            } catch (error) {
                console.error("Error al cargar los ajustes de apariencia del admin:", error);
            }
        }

        // --- CAMBIO CLAVE: Referencia a la subcolección de órdenes del administrador ---
        const ordersCollection = collection(db, 'users', adminId, 'orders');
        const q = query(ordersCollection, orderBy('createdAt', 'asc'));

        onSnapshot(q, (querySnapshot) => {
            const pendingChefOrders = [];
            querySnapshot.forEach((doc) => {
                const orderData = doc.data();
                // Filtramos solo las órdenes pendientes
                if (orderData.status === 'pending') {
                    pendingChefOrders.push({
                        id: doc.id,
                        ...orderData
                    });
                }
            });
            renderPendingOrders(pendingChefOrders);
        }, (error) => {
            console.error("Error al escuchar órdenes:", error);
            chefOrdersList.innerHTML = `<p class="no-pending-orders-message" style="color: #dc3545;">Error al cargar las órdenes: ${error.message}</p>`;
        });

        function renderPendingOrders(orders) {
            chefOrdersList.innerHTML = '';

            if (orders.length === 0) {
                const noOrdersMessage = document.createElement('p');
                noOrdersMessage.classList.add('no-pending-orders-message');
                noOrdersMessage.textContent = 'No hay órdenes pendientes en este momento.';
                chefOrdersList.appendChild(noOrdersMessage);
                return;
            }

            orders.forEach(order => {
                const orderCard = document.createElement('div');
                orderCard.classList.add('order-card-chef');
                orderCard.dataset.orderId = order.id;

                // 💡 CORRECCIÓN: Mostramos el campo 'orderDetails' que contiene las notas del mesero.
                // Si no existe (para órdenes antiguas), mostramos el array 'items' como antes.
                const orderContent = order.orderDetails || (order.items && Array.isArray(order.items)
                    ? order.items.map(item => `${item.quantity}x ${item.name}`).join('\n')
                    : 'Error al cargar los ítems');

                orderCard.innerHTML = `
                    <h4>Mesa: ${order.clientName}</h4>
                    <pre>${orderContent}</pre>
                    <div>
                        <p class="total-price">Total: $${parseFloat(order.total).toFixed(2)}</p>
                        <p class="timestamp">Enviado: ${order.createdAt ? new Date(order.createdAt.toDate()).toLocaleString() : 'N/A'}</p>
                    </div>
                    <div class="order-actions-chef">
                        <button class="complete-order-btn" title="Marcar como lista para servir">Completar Orden</button>
                        <button class="delete-order-btn" title="Quitar de mi vista (no la elimina para el admin)">Eliminar</button>
                    </div>
                `;
                chefOrdersList.appendChild(orderCard);
            });

            attachOrderButtonListeners();
        }

        function attachOrderButtonListeners() {
            document.querySelectorAll('.complete-order-btn').forEach(button => {
                button.onclick = async (event) => {
                    const orderCard = event.target.closest('.order-card-chef');
                    const orderId = orderCard.dataset.orderId;

                    const confirmed = await customConfirm('¿Desea marcar esta orden como completada?', 'Completar Orden', 'Sí', 'No');
                    if (confirmed) {
                        try {
                            // --- CAMBIO CLAVE: Referencia a la subcolección de órdenes del administrador ---
                            const orderDocRef = doc(db, 'users', adminId, 'orders', orderId);
                            await updateDoc(orderDocRef, {
                                status: 'completed',
                                completedAt: new Date(), // Usamos new Date() para consistencia con Firestore
                                completedByChef: auth.currentUser.displayName || auth.currentUser.email
                            });
                            console.log(`Orden ${orderId} marcada como completada.`);
                        } catch (error) {
                            console.error("Error al completar la orden:", error);
                            await customAlert('Hubo un error al completar la orden. Por favor, inténtelo de nuevo.', 'Error');
                        }
                    }
                };
            });

            document.querySelectorAll('.delete-order-btn').forEach(button => {
                button.onclick = async (event) => {
                    const orderCard = event.target.closest('.order-card-chef');
                    const orderId = orderCard.dataset.orderId;

                    // 💡 CORRECCIÓN: Implementación del flujo de eliminación solicitado.
                    const confirmed = await customConfirm('¿Deseas eliminar la orden?', 'Eliminar Orden', 'Sí', 'No');
                    if (confirmed) {
                        try {
                            // En lugar de borrar, actualizamos un estado para que ya no le aparezca al chef
                            const orderDocRef = doc(db, 'users', adminId, 'orders', orderId);
                            await updateDoc(orderDocRef, {
                                status: 'closed_by_chef' // Un estado que el chef ya no consulta
                            });
                            await customAlert('Se ha eliminado la orden exitosamente.', 'Éxito');
                        } catch (error) {
                            console.error("Error al cerrar la orden:", error);
                            await customAlert('Hubo un error al cerrar la orden. Por favor, inténtelo de nuevo.', 'Error');
                        }
                    }
                };
            });
        }
    }
});