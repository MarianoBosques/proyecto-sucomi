// javascript/control.js

import { auth, db, functions } from './auth/firebaseConfig.js'; // 💡 functions se importa pero no se usaba, ahora sí.
import { checkUserRole } from './utils/uiHelpers.js';
import { onAuthStateChanged, signOut, getIdTokenResult } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    updateDoc,
    query,
    orderBy,
    where,
    writeBatch, // 💡 Importación necesaria para la nueva función de archivado
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
// 💡 SOLUCIÓN: Importar httpsCallable para poder llamar a las Cloud Functions.
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";

document.addEventListener('DOMContentLoaded', () => {

    // 💡 --- INICIO: LÓGICA DEL MODAL PERSONALIZADO ---
    const modal = document.getElementById('customModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const modalInput = document.getElementById('modalInput');
    const modalSelect = document.getElementById('modalSelect'); // 💡 NUEVO
    const modalBtnConfirm = document.getElementById('modalBtnConfirm');
    const modalBtnCancel = document.getElementById('modalBtnCancel');

    const showModal = (config) => {
        return new Promise((resolve) => {
            modalTitle.textContent = config.title;
            modalMessage.textContent = config.message;
            
            // 💡 Lógica para mostrar un campo de input en el modal
            modalInput.style.display = config.showInput ? 'block' : 'none';
            modalInput.value = ''; // Limpiar el input
            modalInput.placeholder = config.inputPlaceholder || 'Escribe aquí...';

            // 💡 Lógica para el selector
            modalSelect.style.display = config.showSelect ? 'block' : 'none';
            if (config.showSelect && config.selectOptions) {
                modalSelect.innerHTML = '<option value="">-- Selecciona un reporte existente --</option>';
                config.selectOptions.forEach(opt => modalSelect.innerHTML += `<option value="${opt.id}">${opt.name}</option>`);
            }


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

            // 💡 Devolver el valor del input si es un prompt
            modalBtnConfirm.onclick = () => {
                const value = {
                    confirmed: true,
                    inputValue: config.showInput ? modalInput.value : null,
                    selectValue: config.showSelect ? modalSelect.value : null
                };
                closeModal(value);
            };
            modalBtnCancel.onclick = () => closeModal(false);
        });
    };

    const customAlert = (message, title = "Aviso") => {
        return showModal({ type: 'alert', title, message });
    };

    const customConfirm = (message, title = "Confirmación", confirmText = "Sí", cancelText = "No") => {
        return showModal({ type: 'confirm', title, message, confirmText, cancelText });
    };

    // 💡 NUEVA FUNCIÓN: customPrompt para pedir datos al usuario
    const customPrompt = (config) => {
        return showModal({ type: 'prompt', ...config });
    };

    // 💡 --- FIN: LÓGICA DEL MODAL PERSONALIZADO ---


    // 💡 Verificación de autenticación y rol reactiva mediante middleware
    checkUserRole(auth, db, 'administrador', '/login.html')
        .then(({ user, adminId }) => {
            console.log('Acceso concedido (middleware). Usuario es administrador.');
            initializeControlPanel(adminId); 
            initializeUserMenu();
            initializeArchiveFunctionality(adminId);
        })
        .catch((error) => {
            console.error("Fallo de enrutamiento en panel de control:", error);
        });

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

    function initializeControlPanel(adminId) {
        const controlOrdersList = document.getElementById('controlOrdersList');
        // 💡 NUEVO: Referencia al nuevo botón de imprimir todo
        const printAllOrdersBtn = document.getElementById('printAllOrdersBtn');
        const headerTextElement = document.getElementById('header-text');
        const restaurantLogoImg = document.getElementById('restaurant-logo');
        if (printAllOrdersBtn) {
            printAllOrdersBtn.addEventListener('click', printAllOrders);
        }

        const clearAllOrdersBtn = document.getElementById('clearAllOrdersBtn');
        const archiveOrdersBtn = document.getElementById('archiveOrdersBtn'); // 💡 Nuevo botón
        const totalPaidAmountElement = document.getElementById('totalPaidAmount');

        // Cargar los ajustes de apariencia del administrador
        loadAdminAppearanceSettings(adminId);

        const mainHeader = document.getElementById('main-header');

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

        function buildTicketMarkup(contentHtml, title = 'Orden') {
            const restaurantName = headerTextElement?.textContent?.trim() || 'SUCOMI';
            const logoUrl = restaurantLogoImg && restaurantLogoImg.src && restaurantLogoImg.style.display !== 'none'
                ? restaurantLogoImg.src
                : '';

            return `
                <div class="ticket-wrapper">
                    <div class="ticket-header">
                        ${logoUrl ? `<img src="${logoUrl}" alt="${restaurantName}" class="ticket-logo">` : ''}
                        <h1 class="ticket-restaurant-name">${restaurantName}</h1>
                        <p class="ticket-subtitle">${title}</p>
                    </div>
                    ${contentHtml}
                </div>
            `;
        }

        // --- Firebase Firestore Order Display Logic ---
        const ordersCollection = collection(db, 'users', adminId, 'orders');

        // Use onSnapshot to get real-time updates for orders
        const q = query(ordersCollection, orderBy('createdAt', 'desc'));
        onSnapshot(q, (snapshot) => {
            const allOrders = [];
            snapshot.forEach(doc => {
                allOrders.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            renderAllOrders(allOrders);
            calculateAndDisplayTotalPaid(allOrders);
        }, (error) => {
            console.error("Error al escuchar las órdenes de Firestore:", error);
            controlOrdersList.innerHTML = `<p class="no-orders-message" style="color: #dc3545;">Error al cargar las órdenes: ${error.message}</p>`;
        });


        function getOrderStatusClass(status) {
            if (status === 'pending') return 'pending';
            if (status === 'completed') return 'completed';
            if (status === 'paid') return 'paid';
            return '';
        }

        /**
         * Renders all sent orders in the control panel.
         * @param {Array} orders - The array of order objects from Firestore.
         */
        function renderAllOrders(orders) {
            controlOrdersList.innerHTML = '';

            if (orders.length === 0) {
                const noOrdersMessage = document.createElement('p');
                noOrdersMessage.classList.add('no-orders-message');
                noOrdersMessage.textContent = 'No hay órdenes registradas aún.';
                controlOrdersList.appendChild(noOrdersMessage);
                return;
            }

            orders.forEach(order => {
                const orderCard = document.createElement('div');
                orderCard.classList.add('order-card-control');
                const statusClass = getOrderStatusClass(order.status);
                if (statusClass) {
                    orderCard.classList.add(statusClass);
                }
                orderCard.dataset.orderId = order.id;

                // 💡 CORRECCIÓN: Mostrar las notas del mesero (orderDetails)
                const orderContent = order.orderDetails || (order.items && Array.isArray(order.items)
                    ? order.items.map(item => `${item.quantity}x ${item.name}`).join('\n')
                    : 'Detalles no disponibles');

                const timestamp = order.createdAt ? new Date(order.createdAt.toDate()).toLocaleString() : 'N/A';
                const completedTimestamp = order.completedAt ? new Date(order.completedAt.toDate()).toLocaleString() : 'N/A';
                const chefName = order.completedByChef || 'N/A'; // 💡 CORRECCIÓN: Obtener el nombre del chef

                orderCard.innerHTML = `
                    <h4>Mesa: ${order.clientName || 'Sin Mesa'}</h4>
                    <pre>${orderContent}</pre>
                    <div class="users-roles-info">
                        <p class="user-info-row"><strong>Rol:</strong> Mesero | <strong>Nombre:</strong> ${order.waiterName || 'Desconocido'} | <strong>Fecha:</strong> ${timestamp}</p>
                        <p class="user-info-row"><strong>Rol:</strong> Chef | <strong>Nombre:</strong> ${chefName} | <strong>Fecha:</strong> ${order.status === 'completed' || order.status === 'paid' ? completedTimestamp : 'Pendiente'}</p>
                    </div>
                    <div>
                        <p class="total-price">Total: $${parseFloat(order.total).toFixed(2)}</p>
                    </div>
                    <div class="order-actions">
                        ${order.status !== 'paid' ? `<button class="paid-button" data-order-id="${order.id}">Pagado</button>` : ''}
                        <button class="print-button" data-order-id="${order.id}">Imprimir</button>
                        <button class="save-button" data-order-id="${order.id}"><i class="fas fa-save"></i> Guardar en...</button>
                    </div>
                `;
                controlOrdersList.appendChild(orderCard);
            });
            addOrderButtonListeners();
        }

        function addOrderButtonListeners() {
            document.querySelectorAll('.paid-button').forEach(button => {
                button.addEventListener('click', async (event) => {
                    const orderId = event.target.dataset.orderId;
                    await markOrderAsPaid(adminId, orderId);
                });
            });

            document.querySelectorAll('.print-button').forEach(button => {
                button.addEventListener('click', (event) => {
                    const orderId = event.target.dataset.orderId;
                    // Find the order data from the current rendered list
                    const orderToPrint = [...document.querySelectorAll('.order-card-control')].find(card => card.dataset.orderId === orderId);
                    if (orderToPrint) {
                        printOrder(orderToPrint); // 💡 CORRECCIÓN: Pasamos el elemento completo, no solo su HTML.
                    } else {
                        customAlert('No se encontró la orden para imprimir.', 'Error');
                    }
                });
            });

            // 💡 NUEVO: Listener para el botón de guardar individual
            document.querySelectorAll('.save-button').forEach(button => {
                button.addEventListener('click', (event) => archiveSingleOrder(adminId, event.currentTarget.dataset.orderId));
            });
        }

        /**
         * Marks an order as paid in Firestore.
         * @param {string} adminId - The UID of the administrator.
         * @param {string} orderId - The ID of the order to mark as paid.
         */
        async function markOrderAsPaid(adminId, orderId) {
            const confirmed = await customConfirm('¿Estás seguro de que quieres marcar esta orden como pagada?', 'Confirmar Pago', 'Sí, Pagada', 'No');
            if (confirmed) {
                try {
                    const orderDocRef = doc(db, 'users', adminId, 'orders', orderId);
                    await updateDoc(orderDocRef, {
                        status: 'paid',
                        paidAt: serverTimestamp()
                    });
                    await customAlert('La orden ha sido marcada como pagada.', 'Éxito');
                } catch (error) {
                    console.error("Error al marcar la orden como pagada:", error);
                    await customAlert("Hubo un error al marcar la orden como pagada.", "Error");
                }
            }
        }


        function printOrder(orderCardElement) {
            const contentToPrint = orderCardElement.cloneNode(true);
            const actionsDiv = contentToPrint.querySelector('.order-actions');
            if (actionsDiv) {
                actionsDiv.remove();
            }

            const printWindow = window.open('', '_blank');
            if (!printWindow) {
                alert('Tu navegador bloqueó la ventana de impresión.');
                return;
            }

            printWindow.document.write('<html><head><meta charset="utf-8"><title>Imprimir Orden</title>');
            printWindow.document.write('<style>');
            printWindow.document.write(`
                @page { size: 80mm auto; margin: 0; }
                body {
                    width: 80mm;
                    max-width: 80mm;
                    margin: 0;
                    padding: 3mm;
                    box-sizing: border-box;
                    font-family: Arial, sans-serif;
                    font-size: 10px;
                    line-height: 1.25;
                    color: #111;
                }
                .ticket-wrapper {
                    width: 100%;
                    box-sizing: border-box;
                }
                .ticket-header {
                    text-align: center;
                    border-bottom: 1px dashed #000;
                    padding-bottom: 3mm;
                    margin-bottom: 3mm;
                }
                .ticket-logo {
                    max-width: 36mm;
                    max-height: 14mm;
                    object-fit: contain;
                    display: block;
                    margin: 0 auto 1mm auto;
                }
                .ticket-restaurant-name {
                    font-size: 11px;
                    font-weight: 700;
                    margin: 0;
                }
                .ticket-subtitle {
                    font-size: 9px;
                    margin: 1mm 0 0;
                }
                h4 {
                    font-size: 10px;
                    text-align: center;
                    color: #333;
                    border-bottom: 1px solid #ccc;
                    padding-bottom: 2px;
                    margin: 0 0 2mm 0;
                }
                p { margin: 1mm 0; font-size: 9px; }
                pre {
                    white-space: pre-wrap;
                    word-break: break-word;
                    font-family: 'Courier New', Courier, monospace;
                    background-color: #f9f9f9;
                    padding: 2mm;
                    border: 1px solid #ddd;
                    border-radius: 2px;
                    font-size: 8.5px;
                    margin: 0 0 2mm 0;
                }
                .total-price {
                    font-weight: bold;
                    font-size: 10px;
                    text-align: right;
                    margin-top: 2mm;
                    padding-top: 2mm;
                    border-top: 1px dashed #ccc;
                }
                .users-roles-info { margin-top: 1mm; }
                .user-info-row { font-size: 8px; }
                .timestamp, .completed-timestamp { font-size: 7.5px; color: #777; text-align: right; }
            `);
            printWindow.document.write('</style></head><body>');
            printWindow.document.write(buildTicketMarkup(contentToPrint.innerHTML, 'Orden'));
            printWindow.document.write('</body></html>');
            printWindow.document.close();
            printWindow.print();
        }

        /**
         * 💡 NUEVO: Genera una vista de impresión con todas las órdenes visibles y el total general.
         */
        function printAllOrders() {
            const orderCards = document.querySelectorAll('.order-card-control');
            const grandTotalText = document.getElementById('totalPaidAmount').textContent;

            if (orderCards.length === 0) {
                customAlert('No hay órdenes en pantalla para imprimir.', 'Aviso');
                return;
            }

            const printWindow = window.open('', '_blank');
            if (!printWindow) {
                alert('Tu navegador bloqueó la ventana de impresión.');
                return;
            }

            const ordersMarkup = Array.from(orderCards).map(card => {
                const cardClone = card.cloneNode(true);
                const actionsDiv = cardClone.querySelector('.order-actions');
                if (actionsDiv) actionsDiv.remove();

                const printCard = document.createElement('div');
                printCard.className = `order-card-print ${card.classList.contains('paid') ? 'paid' : ''}`;
                printCard.innerHTML = cardClone.innerHTML;
                return `<div class="print-card-wrapper">${printCard.outerHTML}</div>`;
            }).join('');

            const reportContent = `
                <div class="report-print-content">
                    <p class="report-print-date">Reporte de Órdenes - ${new Date().toLocaleString()}</p>
                    <div class="orders-grid">${ordersMarkup}</div>
                    <div class="grand-total-section">
                        <h2>Total General (Pagadas)</h2>
                        <p>${grandTotalText}</p>
                    </div>
                </div>
            `;

            printWindow.document.write('<html><head><meta charset="utf-8"><title>Reporte de Órdenes</title>');
            printWindow.document.write('<style>');
            printWindow.document.write(`
                @page { size: 80mm auto; margin: 0; }
                body {
                    width: 80mm;
                    max-width: 80mm;
                    margin: 0;
                    padding: 3mm;
                    box-sizing: border-box;
                    font-family: Arial, sans-serif;
                    font-size: 10px;
                    line-height: 1.25;
                    color: #111;
                }
                .ticket-wrapper {
                    width: 100%;
                    box-sizing: border-box;
                }
                .ticket-header {
                    text-align: center;
                    border-bottom: 1px dashed #000;
                    padding-bottom: 3mm;
                    margin-bottom: 3mm;
                }
                .ticket-logo {
                    max-width: 36mm;
                    max-height: 14mm;
                    object-fit: contain;
                    display: block;
                    margin: 0 auto 1mm auto;
                }
                .ticket-restaurant-name {
                    font-size: 11px;
                    font-weight: 700;
                    margin: 0;
                }
                .ticket-subtitle {
                    font-size: 9px;
                    margin: 1mm 0 0;
                }
                .report-print-content { width: 100%; }
                .report-print-date { font-size: 8px; text-align: center; margin: 0 0 3mm 0; color: #555; }
                .orders-grid { display: flex; flex-direction: column; gap: 3mm; }
                .print-card-wrapper { width: 100%; }
                .order-card-print { border: 1px solid #ccc; border-radius: 3px; padding: 2mm; page-break-inside: avoid; }
                .order-card-print.paid { border-left: 3px solid #28a745; }
                .order-card-print h4 { font-size: 10px; text-align: center; color: #333; border-bottom: 1px solid #eee; padding-bottom: 2px; margin-top: 0; }
                .order-card-print p { margin: 1mm 0; font-size: 8.5px; }
                .order-card-print pre {
                    white-space: pre-wrap;
                    word-break: break-word;
                    font-family: 'Courier New', Courier, monospace;
                    background-color: #f9f9f9;
                    padding: 2mm;
                    border: 1px solid #ddd;
                    border-radius: 2px;
                    font-size: 8px;
                    margin: 0 0 2mm 0;
                }
                .order-card-print .total-price { font-weight: bold; font-size: 9px; text-align: right; margin-top: 2mm; padding-top: 2mm; border-top: 1px dashed #ccc; }
                .grand-total-section { margin-top: 4mm; padding-top: 3mm; border-top: 1px dashed #000; text-align: center; }
                .grand-total-section h2 { font-size: 10px; margin: 0 0 1mm 0; }
                .grand-total-section p { font-size: 11px; font-weight: bold; margin: 0; }
            `);
            printWindow.document.write('</style></head><body>');
            printWindow.document.write(buildTicketMarkup(reportContent, 'Reporte de Órdenes'));
            printWindow.document.write('</body></html>');
            printWindow.document.close();
            printWindow.print();
        }

        /**
         * Calculates the total sum of all paid orders and displays it.
         * @param {Array} orders - The array of order objects.
         */
        function calculateAndDisplayTotalPaid(orders) {
            let totalPaid = 0;
            orders.forEach(order => {
                if (order.status === 'paid') {
                    totalPaid += parseFloat(order.total);
                }
            });
            totalPaidAmountElement.textContent = `$${totalPaid.toFixed(2)}`;
        }

        // --- Clear All Orders functionality (To be implemented with care on Firestore) ---
        // Clearing orders on Firestore for an entire restaurant would require a server-side function
        // to avoid performance issues and security risks on the client side.
        // It's not recommended to implement this with a single client-side call.
        if (clearAllOrdersBtn) {
            clearAllOrdersBtn.style.display = 'none';
        }
    }

    // 💡 --- INICIO: LÓGICA PARA ARCHIVAR ÓRDENES (REESTRUCTURADA Y MOVIDA PARA ACCESIBILIDAD) ---

    /**
     * Obtiene la lista de reportes existentes para un administrador.
     * @param {string} adminId - El UID del administrador.
     * @returns {Promise<Array<{id: string, name: string}>>}
     */
    async function getExistingReports(adminId) {
        const reportsRef = collection(db, 'users', adminId, 'reports');
        const q = query(reportsRef, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().reportName }));
    }

    /**
     * Inicia el flujo para archivar una única orden.
     * @param {string} adminId - El UID del administrador.
     * @param {string} orderId - El ID de la orden a archivar.
     */
    async function archiveSingleOrder(adminId, orderId) {
        const existingReports = await getExistingReports(adminId);

        const promptResult = await customPrompt({
            title: 'Guardar Orden en Reporte',
            message: 'Crea un nuevo reporte o selecciona uno existente para guardar esta orden.',
            showInput: true,
            inputPlaceholder: 'Nombre del nuevo reporte (ej. Especiales)',
            showSelect: true,
            selectOptions: existingReports,
            confirmText: 'Guardar Orden'
        });

        if (!promptResult || !promptResult.confirmed) return;

        const { inputValue, selectValue } = promptResult;
        let reportName = inputValue ? inputValue.trim() : '';
        let reportId = selectValue;

        if (!reportName && !reportId) {
            await customAlert('Debes escribir un nombre para un nuevo reporte o seleccionar uno existente.', 'Operación Cancelada');
            return;
        }
        if (reportName && reportId) {
            await customAlert('Por favor, elige entre crear un reporte nuevo O seleccionar uno existente, no ambos.', 'Operación Cancelada');
            return;
        }

        try {
            await customAlert('Guardando orden...', 'Procesando');
            const archiveOrdersCallable = httpsCallable(functions, 'archiveOrders');
            const result = await archiveOrdersCallable({ reportName, reportId, orderId });
            await customAlert(result.data.message, 'Éxito');

            const deleteConfirmation = await customConfirm('La orden ha sido guardada. ¿Deseas eliminarla de esta vista principal?', 'Limpiar Orden', 'Sí, eliminar', 'No, mantener');
            if (deleteConfirmation && deleteConfirmation.confirmed) {
                const orderDocRef = doc(db, 'users', adminId, 'orders', orderId);
                const batch = writeBatch(db);
                batch.delete(orderDocRef);
                await batch.commit();
                await customAlert('Orden eliminada de la vista principal.', 'Limpieza Completa');
            }
        } catch (error) {
            console.error("Error al guardar la orden:", error);
            await customAlert(`Error: ${error.message}`, 'Error al Guardar');
        }
    }

    /**
     * Inicializa la funcionalidad del botón "Archivar y Limpiar Órdenes".
     * @param {string} adminId - El UID del administrador.
     */
    // 💡 --- INICIO: NUEVA LÓGICA PARA ARCHIVAR ÓRDENES ---
    function initializeArchiveFunctionality(adminId) {
        const archiveBtn = document.getElementById('archiveOrdersBtn');
        if (!archiveBtn) return;

        archiveBtn.addEventListener('click', async () => {
            // 💡 CORRECCIÓN: Se ajusta el texto de la confirmación según lo solicitado.
            const confirmation = await customConfirm(
                'Esto archivará TODAS las órdenes actuales y limpiará esta vista. Las órdenes se moverán a la página de "Reportes Guardados". ¿Continuar?',
                'Archivar y Limpiar Todo',
                'Sí', 'No'
            );

            if (!confirmation || !confirmation.confirmed) return;

            // 💡 SOLUCIÓN: Se actualiza esta sección para manejar el objeto de customPrompt.
            const existingReports = await getExistingReports(adminId);

            const promptResult = await customPrompt({
                title: 'Guardar en Reporte',
                message: 'Puedes crear un nuevo reporte o agregarlas a uno existente.',
                showInput: true,
                inputPlaceholder: 'Nombre del nuevo reporte (ej. Cierre Nov 2023)',
                showSelect: true,
                selectOptions: existingReports,
                confirmText: 'Archivar Todo'
            });

            if (!promptResult || !promptResult.confirmed) return;

            const { inputValue, selectValue } = promptResult;
            let reportName = inputValue ? inputValue.trim() : '';
            let reportId = selectValue;

            if (!reportName && !reportId) {
                await customAlert('Debes escribir un nombre para un nuevo reporte o seleccionar uno existente.', 'Operación Cancelada');
                return;
            }
            if (reportName && reportId) {
                await customAlert('Por favor, elige entre crear un reporte nuevo O seleccionar uno existente, no ambos.', 'Operación Cancelada');
                return;
            }

            try {
                await customAlert('Iniciando proceso de archivado masivo...', 'Procesando');
                const archiveOrdersCallable = httpsCallable(functions, 'archiveOrders');
                const result = await archiveOrdersCallable({ reportName, reportId });
                await customAlert(result.data.message, 'Éxito');

            } catch (error) {
                console.error("Error al archivar las órdenes:", error);
                await customAlert(`Error: ${error.message}`, 'Error de Archivado');
            }
        });
    }
    // 💡 --- FIN: NUEVA LÓGICA PARA ARCHIVAR ÓRDENES ---


});