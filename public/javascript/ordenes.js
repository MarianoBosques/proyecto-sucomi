// javascript/ordenes.js

import { auth, db, functions } from './auth/firebaseConfig.js';
import { checkUserRole } from './utils/uiHelpers.js';
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";
import { onAuthStateChanged, signOut, getIdTokenResult } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    orderBy,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const headerTextElement = document.getElementById('header-text');
    const restaurantLogoImg = document.getElementById('restaurant-logo');

    // 💡 Verificación de autenticación y rol reactiva mediante middleware
    checkUserRole(auth, db, 'administrador', '/login.html')
        .then(({ user, adminId }) => {
            initializeUserMenu();
            initializeReportsPage(adminId);
        })
        .catch((error) => {
            console.error("Fallo de enrutamiento en panel de órdenes:", error);
        });

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

    async function initializeReportsPage(adminId) {
        await loadAdminAppearanceSettings(adminId);
        await loadAndRenderReports(adminId);
        setupDeleteAllButton(adminId);
    }

    async function loadAdminAppearanceSettings(adminId) {
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

    function getOrderStatusClass(status) {
        if (status === 'pending') return 'pending';
        if (status === 'completed') return 'completed';
        if (status === 'paid') return 'paid';
        return '';
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

    async function loadAndRenderReports(adminId) {
        const reportsContainer = document.getElementById('reportsContainer');
        const reportsRef = collection(db, 'users', adminId, 'reports');
        const q = query(reportsRef, orderBy('createdAt', 'desc'));

        try {
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) {
                reportsContainer.innerHTML = '<p class="no-reports-message">No hay reportes archivados aún.</p>';
                return;
            }

            reportsContainer.innerHTML = ''; // Limpiar contenedor

            for (const reportDoc of querySnapshot.docs) {
                const reportData = reportDoc.data();
                const reportId = reportDoc.id;

                const reportElement = document.createElement('div');
                reportElement.className = 'report-group';
                reportElement.innerHTML = `
                    <div class="report-header">
                        <h3>${reportData.reportName}</h3>
                        <div class="report-summary">
                            <span>Total Pagado: <strong>$${reportData.totalPaidAmount.toFixed(2)}</strong></span>
                            <span>Órdenes: <strong>${reportData.ordersCount}</strong></span>
                            <span>Fecha: ${new Date(reportData.createdAt.toDate()).toLocaleDateString()}</span>
                        </div>
                    </div>
                    <div class="orders-container" id="orders-for-${reportId}">
                        <p>Cargando órdenes...</p>
                    </div>
                `;
                reportsContainer.appendChild(reportElement);

                // Cargar las órdenes para este reporte
                const ordersContainer = document.getElementById(`orders-for-${reportId}`);
                const ordersRef = collection(db, 'users', adminId, 'reports', reportId, 'orders');
                const ordersQuery = query(ordersRef, orderBy('createdAt', 'desc'));
                const ordersSnapshot = await getDocs(ordersQuery);

                ordersContainer.innerHTML = '';
                if (ordersSnapshot.empty) {
                    ordersContainer.innerHTML = '<p>Este reporte no contiene órdenes.</p>';
                } else {
                    ordersSnapshot.forEach(orderDoc => {
                        const orderData = orderDoc.data();
                        const orderCard = document.createElement('div');
                        orderCard.className = 'order-card-control';
                        const statusClass = getOrderStatusClass(orderData.status);
                        if (statusClass) {
                            orderCard.classList.add(statusClass);
                        }
                        // Asignamos un ID único a la tarjeta para la función de impresión
                        orderCard.id = `order-${orderDoc.id}`;

                        const orderContent = orderData.orderDetails || 'Detalles no disponibles';
                        const timestamp = orderData.createdAt ? new Date(orderData.createdAt.toDate()).toLocaleString() : 'N/A';
                        const completedTimestamp = orderData.completedAt ? new Date(orderData.completedAt.toDate()).toLocaleString() : 'N/A';
                        const chefName = orderData.completedByChef || 'N/A';

                        orderCard.innerHTML = `
                            <h4>Mesa: ${orderData.clientName || 'Sin Mesa'}</h4>
                            <pre>${orderContent}</pre>
                            <div class="users-roles-info">
                                <p class="user-info-row"><strong>Rol:</strong> Mesero | <strong>Nombre:</strong> ${orderData.waiterName || 'Desconocido'} | <strong>Fecha:</strong> ${timestamp}</p>
                                <p class="user-info-row"><strong>Rol:</strong> Chef | <strong>Nombre:</strong> ${chefName} | <strong>Fecha:</strong> ${orderData.status === 'completed' || orderData.status === 'paid' ? completedTimestamp : 'Pendiente'}</p>
                            </div>
                            <p class="total-price">Total: $${parseFloat(orderData.total).toFixed(2)}</p>
                            <div class="order-actions">
                                <button class="print-button" data-order-id="${orderDoc.id}"><i class="fas fa-print"></i> Imprimir</button>
                            </div>
                        `;
                        ordersContainer.appendChild(orderCard);
                    });
                }
            }

            // Añadir listeners a los nuevos botones de imprimir
            addPrintButtonListeners();

        } catch (error) {
            console.error("Error al cargar los reportes:", error);
            reportsContainer.innerHTML = `<p class="no-reports-message" style="color: #dc3545;">Error al cargar los reportes: ${error.message}</p>`;
        }
    }

    function addPrintButtonListeners() {
        document.querySelectorAll('.print-button').forEach(button => {
            button.addEventListener('click', (event) => {
                const orderId = event.currentTarget.dataset.orderId;
                const orderCardElement = document.getElementById(`order-${orderId}`);
                if (orderCardElement) {
                    printOrder(orderCardElement);
                } else {
                    alert('No se encontró la orden para imprimir.');
                }
            });
        });
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
            .timestamp { font-size: 7.5px; color: #777; text-align: right; }
        `);
        printWindow.document.write('</style></head><body>');
        printWindow.document.write(buildTicketMarkup(contentToPrint.innerHTML, 'Orden'));
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.print();
    }

    function setupDeleteAllButton(adminId) {
        const deleteBtn = document.getElementById('delete-orders-btn');
        if (!deleteBtn) return;

        const originalContent = deleteBtn.innerHTML;

        deleteBtn.addEventListener('click', async () => {
            const confirmed = confirm("¿Deseas eliminar permanentemente TODOS los reportes y órdenes ARCHIVADAS? Las órdenes activas en Control no se verán afectadas.");
            if (!confirmed) return;

            try {
                deleteBtn.disabled = true;
                deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Eliminando...';

                // Llamamos a la Cloud Function para saltar restricciones de permisos locales
                const eliminarHistorial = httpsCallable(functions, 'eliminarHistorial_v2');
                const result = await eliminarHistorial();

                alert(result.data.message);
                await loadAndRenderReports(adminId); // Recargar la vista
            } catch (error) {
                console.error("Error crítico al borrar historial:", error);
                alert("Error de permisos o conexión: " + error.message);
            } finally {
                deleteBtn.disabled = false;
                deleteBtn.innerHTML = originalContent;
            }
        });
    }
});