// javascript/ordenes.js

import { auth, db } from './auth/firebaseConfig.js';
import { onAuthStateChanged, signOut, getIdTokenResult } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            await checkUserRole(user);
        } else {
            window.location.href = '/login.html';
        }
    });

    async function checkUserRole(user) {
        try {
            const tokenResult = await getIdTokenResult(user, true);
            const userRole = tokenResult.claims.role;

            if (userRole === 'administrador') {
                initializeUserMenu();
                initializeReportsPage(user.uid);
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
    }

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
                        if (orderData.status === 'paid') {
                            orderCard.classList.add('paid');
                        }
                        // Asignamos un ID único a la tarjeta para la función de impresión
                        orderCard.id = `order-${orderDoc.id}`;

                        const orderContent = orderData.orderDetails || 'Detalles no disponibles';
                        const timestamp = orderData.createdAt ? new Date(orderData.createdAt.toDate()).toLocaleString() : 'N/A';

                        orderCard.innerHTML = `
                            <h4>Mesa: ${orderData.clientName || 'Sin Mesa'}</h4>
                            <p class="waiter-name">Mesero: ${orderData.waiterName || 'Desconocido'}</p>
                            <pre>${orderContent}</pre>
                            <p class="total-price">Total: $${parseFloat(orderData.total).toFixed(2)}</p>
                            <p class="timestamp">Enviado: ${timestamp}</p>
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

        // Eliminar el contenedor de botones de acción en el clon
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
});