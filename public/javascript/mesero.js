// javascript/mesero.js

//1. Importaciones de archivos de Firebase
import { auth, db, functions } from './auth/firebaseConfig.js';
import { checkUserRole } from './utils/uiHelpers.js';
import {
    collection,
    doc,
    deleteDoc,
    getDoc,
    onSnapshot,
    query,
    orderBy,
    serverTimestamp,
    addDoc,
    where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut, getIdTokenResult } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";


document.addEventListener('DOMContentLoaded', () => {

    // 💡 Verificación de autenticación y rol reactiva mediante middleware
    checkUserRole(auth, db, 'mesero', '/waiterLogin.html')
        .then(({ user, adminId }) => {
            console.log(`Acceso concedido (middleware). Rol: mesero, Admin: ${adminId}`);
            initializeWaiterPanel(adminId);
            initializeUserMenu();
        })
        .catch((error) => {
            console.error("Fallo de enrutamiento de mesero:", error);
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

    function initializeWaiterPanel(adminId) {
        // *** CORRECCIÓN CLAVE: El ID del contenedor del menú en el HTML es 'menuProductsGrid' ***
        const menuGrid = document.getElementById('menuProductsGrid');
        const orderTextArea = document.getElementById('orderTextArea');
        const orderTotalSpan = document.getElementById('orderTotal');
        const sendOrderBtn = document.getElementById('sendOrderBtn');
        const clearOrderBtn = document.getElementById('clearOrderBtn');
        const clientNameInput = document.getElementById('clientNameInput');
        // --- NUEVOS ELEMENTOS PARA GESTIÓN DE CLIENTES ---
        const clientSelector = document.getElementById('clientSelector');
        const addClientBtn = document.getElementById('addClientBtn');
        const deleteClientBtn = document.getElementById('deleteClientBtn');
        // --- NUEVOS ELEMENTOS PARA HISTORIAL Y TOTALES ---
        const sentOrdersList = document.getElementById('sentOrdersList');
        const globalSalesTotalSpan = document.getElementById('globalSalesTotal');

        // 💡 --- INICIO: LÓGICA DEL MODAL PERSONALIZADO ---
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

                // Configurar input para 'prompt'
                modalInput.style.display = config.type === 'prompt' ? 'block' : 'none';
                modalInput.value = '';

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

                modalBtnConfirm.onclick = () => closeModal(config.type === 'prompt' ? modalInput.value : true);
                modalBtnCancel.onclick = () => closeModal(config.type === 'prompt' ? null : false);
            });
        };

        const customAlert = (message, title = "Aviso") => {
            return showModal({ type: 'alert', title, message });
        };

        const customConfirm = (message, title = "Confirmación") => {
            return showModal({ type: 'confirm', title, message, confirmText: 'Confirmar' });
        };

        const customPrompt = (message, title = "Entrada Requerida") => {
            return showModal({ type: 'prompt', title, message });
        };

        // 💡 --- FIN: LÓGICA DEL MODAL PERSONALIZADO ---


        // Cargar los ajustes de apariencia del administrador
        loadAdminAppearanceSettings(adminId);

        // --- CAMBIOS CLAVE: Referencias dinámicas de Firestore ---
        // Referencia a la subcolección de menuItems del administrador
        const menuCollection = collection(db, 'users', adminId, 'menuItems');
        // Referencia a la subcolección de orders del administrador
        const ordersCollection = collection(db, 'users', adminId, 'orders');

        // Objeto para almacenar los pedidos. La clave es el nombre del cliente.
        let ordersByClient = {};
        let clients = []; // Array para almacenar la lista de clientes

        // Escucha el menú en tiempo real del administrador
        onSnapshot(query(menuCollection, orderBy('name')), (snapshot) => {
            menuGrid.innerHTML = ''; // Limpiar la grid
            if (snapshot.empty) {
                const noItemsMessage = document.createElement('p');
                noItemsMessage.textContent = 'Aún no hay elementos en el menú.';
                noItemsMessage.className = 'no-items-message';
                menuGrid.appendChild(noItemsMessage);
                return;
            }

            // 1. Convertir snapshot a array para manipularlo
            const items = [];
            snapshot.forEach(doc => {
                items.push({ id: doc.id, ...doc.data() });
            });

            // 2. Agrupar items por categoría
            const groupedItems = items.reduce((acc, item) => {
                const category = item.category || 'General'; // Categoría por defecto
                if (!acc[category]) acc[category] = [];
                acc[category].push(item);
                return acc;
            }, {});

            // 3. Obtener categorías y ordenarlas alfabéticamente
            const sortedCategories = Object.keys(groupedItems).sort((a, b) => a.localeCompare(b));

            // 4. Renderizar por categoría
            sortedCategories.forEach(category => {
                // Crear encabezado de sección
                const sectionHeader = document.createElement('div');
                sectionHeader.className = 'menu-section-header';
                sectionHeader.textContent = category;
                menuGrid.appendChild(sectionHeader);

                // Ordenar productos dentro de la categoría alfabéticamente
                const categoryItems = groupedItems[category].sort((a, b) => a.name.localeCompare(b.name));

                categoryItems.forEach(item => {
                    const button = document.createElement('button');
                    button.className = 'product-button';
                    button.dataset.id = item.id;
                    button.dataset.name = item.name;
                    button.dataset.price = item.price;
                    button.innerHTML = `
                        ${item.name}
                        <span class="price">$${item.price.toFixed(2)}</span>
                    `;
                    menuGrid.appendChild(button);
                });
            });
        });

        // === Handler: agregar productos desde botones ===
        menuGrid.addEventListener('click', (e) => {
            const productButton = e.target.closest('.product-button');
            if (productButton) {
                const clientName = clientNameInput.value.trim();
                
                if (!clientName) {
                    customAlert("Favor de seleccionar o agregar una mesa primero.", "Aviso");
                    return;
                }

                if (!ordersByClient[clientName]) ordersByClient[clientName] = { items: [], text: '' };
                const currentOrder = ordersByClient[clientName].items;

                const id = productButton.dataset.id;
                const name = productButton.dataset.name;
                const price = parseFloat(productButton.dataset.price);

                // Buscar una entrada existente SIN nota para incrementarla; si no existe, crear nueva entrada con note:''
                let unnotedItem = currentOrder.find(item => item.id === id && (!item.note || item.note.trim() === ''));
                if (unnotedItem) {
                    unnotedItem.quantity = Number(unnotedItem.quantity || 0) + 1;
                } else {
                    currentOrder.push({ id, name, price, quantity: 1, note: '' });
                }

                // Actualiza la vista (la nueva función sincroniza notas manuales)
                updateOrderDisplay(clientName);
            }
        });

        // === Función mejorada: actualiza el textarea sin perder notas manuales y permite separar items con nota ===
        function updateOrderDisplay(clientName) {
            const order = ordersByClient[clientName];
            if (!order) return;

            const currentOrder = order.items || [];
            // Texto actual que el mesero haya escrito o guardado previamente
            const rawText = (orderTextArea.value && orderTextArea.value.trim() !== '') ? orderTextArea.value : (order.text || '');
            const oldLines = rawText.split('\n').map(l => l.trim()).filter(l => l !== '');

            // Construir mapa de producto desde currentOrder (id -> {name, price, totalQty})
            const productInfo = {};
            currentOrder.forEach(it => {
                if (!productInfo[it.id]) productInfo[it.id] = { name: it.name, price: it.price, totalQty: 0 };
                productInfo[it.id].totalQty += Number(it.quantity || 0);
            });

            const processedDisplayLines = [];
            const leftoverManualLines = [];

            // Copia de cantidades que iremos restando al detectar líneas manuales
            const remainingQty = {};
            Object.keys(productInfo).forEach(pid => remainingQty[pid] = productInfo[pid].totalQty);

            // Auxiliar: buscar producto por prefijo de nombre (case-insensitive)
            const findProductByNamePrefix = (text) => {
                const t = text.toLowerCase();
                return Object.entries(productInfo).find(([pid, info]) => t.startsWith(info.name.toLowerCase()));
            };

            // Procesar líneas existentes en textarea para detectar líneas manuales del tipo "1 x nombre ... "
            oldLines.forEach(line => {
                // Regex: captura cantidad y el resto (nombre + notas). Permite "1x producto", "1 x producto"
                const m = line.match(/^\s*(\d+)\s*[xX]\s*(.+?)\s*(?:-?\s*\$?[\d.,]+)?\s*$/);
                if (m) {
                    const qty = parseInt(m[1], 10);
                    const nameAndNotes = m[2].trim();
                    const found = findProductByNamePrefix(nameAndNotes);
                    if (found) {
                        const [foundId, info] = found;
                        // Usar exactamente el texto que escribió el mesero (preserva notas)
                        const totalPrice = (info.price * qty).toFixed(2);
                        processedDisplayLines.push(`${qty} x ${nameAndNotes} - $${totalPrice}`);
                        remainingQty[foundId] = Math.max(0, (remainingQty[foundId] || 0) - qty);
                        return;
                    }
                }
                // Si no coincide con patrón o no se asigna a producto conocido, conservarla como línea manual
                leftoverManualLines.push(line);
            });

            // Agregar las cantidades restantes (productos sin nota) como líneas combinadas
            Object.entries(productInfo).forEach(([pid, info]) => {
                const qtyLeft = remainingQty[pid] || 0;
                if (qtyLeft > 0) {
                    const totalPrice = (info.price * qtyLeft).toFixed(2);
                    processedDisplayLines.push(`${qtyLeft} x ${info.name} - $${totalPrice}`);
                }
            });

            // Añadir al final las líneas manuales que no correspondían con ningún producto
            leftoverManualLines.forEach(l => processedDisplayLines.push(l));

            // Reconstruir order.items: crear newItems basados en processedDisplayLines (solo para productos conocidos)
            const newItems = [];
            processedDisplayLines.forEach(line => {
                const m = line.match(/^\s*(\d+)\s*[xX]\s*(.+?)\s*-\s*\$?([\d.,]+)\s*$/);
                if (m) {
                    const qty = parseInt(m[1], 10);
                    const nameAndNotes = m[2].trim();
                    // Buscar producto conocido por prefijo
                    const found = Object.entries(productInfo).find(([pid, info]) => nameAndNotes.toLowerCase().startsWith(info.name.toLowerCase()));
                    if (found) {
                        const [foundId, info] = found;
                        // note = lo que quede tras el nombre real
                        let note = '';
                        const nameLower = info.name.toLowerCase();
                        if (nameAndNotes.toLowerCase().startsWith(nameLower)) {
                            note = nameAndNotes.slice(info.name.length).trim();
                        }
                        newItems.push({
                            id: foundId,
                            name: info.name,
                            price: info.price,
                            quantity: qty,
                            note: note
                        });
                        return;
                    }
                }
                // Si no corresponde a producto conocido, no lo convertimos en item (se mantiene en textarea)
            });

            // Guardar nuevo estado y mostrar textArea
            ordersByClient[clientName].items = newItems;
            const finalText = processedDisplayLines.join('\n').trim();
            ordersByClient[clientName].text = finalText;
            orderTextArea.value = finalText;

            // Calcular total a partir de newItems
            let total = 0;
            newItems.forEach(it => {
                total += (Number(it.price || 0) * Number(it.quantity || 0));
            });

            orderTotalSpan.textContent = total.toFixed(2);
            sendOrderBtn.disabled = newItems.length === 0;
            clearOrderBtn.disabled = finalText === '';
        }

        // Guardar notas manuales cada vez que el mesero escribe en el textarea.
        orderTextArea.addEventListener('input', () => {
            const clientName = clientNameInput.value.trim() || "Mesa General";
            if (!ordersByClient[clientName]) ordersByClient[clientName] = { items: [], text: '' };
            ordersByClient[clientName].text = orderTextArea.value;
            // NOTA: no llamamos a updateOrderDisplay automáticamente al escribir,
            // porque queremos que el mesero pueda escribir libremente (y solo al
            // cambiar cliente o al agregar producto se reorganiza).
            // Si prefieres que el textarea se parsee en vivo, descomenta la línea:
            // updateOrderDisplay(clientName);
        });


        // La lógica para eliminar ítems del pedido se gestiona ahora con el botón "ELIMINAR TODO"
        // No hay botones individuales por ítem en el textarea.

        sendOrderBtn.addEventListener('click', async () => {
            const orderDetails = orderTextArea.value.trim();
            const clientName = clientNameInput.value.trim();

            // Validación: Si no hay cliente o no hay pedido (textarea vacío)
            if (!clientName || !orderDetails) {
                await customAlert("Favor de llenar los campos que le solicita.", "Aviso");
                return;
            }

            const currentOrder = ordersByClient[clientName].items;
            const waiterName = auth.currentUser.displayName || "Mesero Desconocido";

            try {
                await addDoc(ordersCollection, {
                    items: currentOrder, 
                    orderDetails: orderDetails,
                    total: parseFloat(orderTotalSpan.textContent),
                    status: 'pending',
                    createdAt: serverTimestamp(),
                    waiterId: auth.currentUser.uid,
                    waiterName: waiterName,
                    clientName: clientName
                });
                await customAlert('Orden enviada a cocina con éxito!', 'Éxito');
                // Limpiar el pedido solo para ese cliente
                ordersByClient[clientName] = { items: [], text: '' };
                orderTextArea.value = ''; // Limpiar el campo visualmente
                updateOrderDisplay(clientName);

            } catch (error) {
                console.error("Error al enviar la orden: ", error);
                await customAlert("No se pudo enviar la orden. Por favor, intenta de nuevo.", "Error");
            }
        });

        clearOrderBtn.addEventListener('click', async () => {
            const clientName = clientNameInput.value.trim() || "Mesa General";
            if (ordersByClient[clientName] && (ordersByClient[clientName].items.length > 0 || orderTextArea.value.trim() !== '')) {
                const confirmed = await customConfirm(`¿Estás seguro de que quieres limpiar el pedido para "${clientName}"?`);
                if (confirmed) {
                    ordersByClient[clientName] = { items: [], text: '' };
                    orderTextArea.value = ''; // Limpiar el campo visualmente
                    updateOrderDisplay(clientName);
                }
            }
        });

        // --- LÓGICA COMPLETA PARA LA GESTIÓN DE CLIENTES ---

        const CLIENTS_STORAGE_KEY = `sucomi_clients_${auth.currentUser.uid}`;

        // Carga los clientes desde localStorage al iniciar
        function loadClients() {
            const storedClients = localStorage.getItem(CLIENTS_STORAGE_KEY);
            if (storedClients) {
                clients = JSON.parse(storedClients);
                clients.forEach(client => {
                    if (!ordersByClient[client]) ordersByClient[client] = { items: [], text: '' };
                });
            }
            updateClientSelector();
        }

        // Guarda los clientes en localStorage
        function saveClients() {
            localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(clients));
        }

        // Actualiza el menú desplegable <select> con la lista de clientes
        function updateClientSelector() {
            clientSelector.innerHTML = '<option value="">Agrega una mesa</option>';
            clients.forEach(client => {
                const option = document.createElement('option');
                option.value = client;
                option.textContent = client;
                clientSelector.appendChild(option);
            });
        }

        // Evento para el botón "Agregar Cliente"
        addClientBtn.addEventListener('click', async () => {
            const newClientName = await customPrompt("Ingrese el nombre del nuevo cliente:", "Nuevo Cliente");
            if (newClientName && newClientName.trim() !== '') {
                const trimmedName = newClientName.trim();
                if (clients.includes(trimmedName)) {
                    await customAlert("Este cliente ya existe en la lista.");
                } else {
                    clients.push(trimmedName);
                    ordersByClient[trimmedName] = { items: [], text: '' }; // Inicializar pedido para el nuevo cliente
                    saveClients();
                    updateClientSelector();
                    clientSelector.value = trimmedName; // Selecciona el nuevo cliente
                    clientNameInput.value = trimmedName; // Muestra el nombre en el input
                    await customAlert(`Cliente "${trimmedName}" agregado con éxito.`, "Éxito");
                }
            }
        });

        // Evento para el botón "Eliminar Cliente"
        deleteClientBtn.addEventListener('click', async () => {
            const selectedClient = clientSelector.value;
            if (selectedClient) {
                const confirmed = await customConfirm(`¿Está seguro de que desea eliminar al cliente "${selectedClient}"?`);
                if (confirmed) {
                    clients = clients.filter(client => client !== selectedClient);
                    saveClients();
                    delete ordersByClient[selectedClient]; // Eliminar el pedido asociado
                    updateClientSelector();
                    // Cambiar al cliente por defecto
                    clientSelector.value = '';
                    clientSelector.dispatchEvent(new Event('change'));
                }
            } else {
                await customAlert("Por favor, seleccione un cliente de la lista para eliminar.");
            }
        });

        // --- LÓGICA PARA EL HISTORIAL DE ÓRDENES ENVIADAS Y TOTAL DE VENTAS ---

        // Consulta para obtener solo las órdenes del mesero actual, ordenadas por fecha descendente
        const waiterOrdersQuery = query(
            ordersCollection,
            where('waiterId', '==', auth.currentUser.uid),
            orderBy('createdAt', 'desc')
        );

        onSnapshot(waiterOrdersQuery, (snapshot) => {
            if (snapshot.empty) {
                sentOrdersList.innerHTML = '<p class="no-sent-orders-message">No has enviado ninguna orden aún.</p>';
                globalSalesTotalSpan.textContent = '0.00';
                return;
            }

            let totalSales = 0;
            sentOrdersList.innerHTML = ''; // Limpiar la lista

            snapshot.docs.forEach(doc => {
                const order = doc.data();
                totalSales += order.total;

                const orderCard = document.createElement('div');
                orderCard.className = 'order-card';
                orderCard.dataset.orderId = doc.id;

                // 💡 CORRECCIÓN: Mostrar el contenido del textarea (orderDetails) que se guardó.
                // Si no existe (para órdenes antiguas), se usa el array 'items' como respaldo.
                const orderContent = order.orderDetails || (order.items && Array.isArray(order.items)
                    ? order.items.map(item => `${item.quantity}x ${item.name}${item.note ? ' ' + item.note : ''}`).join('\n')
                    : 'Detalles no disponibles');

                orderCard.innerHTML = `
                    <button class="delete-history-order-btn" title="Eliminar del historial">&times;</button>
                    <p class="client-name-history">Cliente: ${order.clientName}</p>
                    <p class="waiter-name-history">Mesero: ${order.waiterName || 'Desconocido'}</p>
                    <pre class="order-items-history">${orderContent}</pre>
                    <p class="order-total-history">Total: $${order.total.toFixed(2)}</p>
                    <!-- 💡 CORRECCIÓN: Se verifica si createdAt existe antes de usarlo -->
                    <p class="order-timestamp">${order.createdAt ? new Date(order.createdAt.toDate()).toLocaleString() : 'Procesando...'}</p>
                `;
                sentOrdersList.appendChild(orderCard);
            });

            globalSalesTotalSpan.textContent = totalSales.toFixed(2);

            // --- LÓGICA PARA ELIMINAR ÓRDENES DEL HISTORIAL ---
            // ADVERTENCIA: Esto elimina la orden de la base de datos para TODOS (chef, admin).
            // Una mejor alternativa sería añadir un campo "hidden_for_waiter: true".
            document.querySelectorAll('.delete-history-order-btn').forEach(button => {
                button.addEventListener('click', async (e) => {
                    // Prevenir que otros eventos se disparen
                    e.stopPropagation(); 
                    const orderId = e.target.closest('.order-card').dataset.orderId;
                    const confirmed = await customConfirm("¿Estás seguro de que quieres eliminar esta orden del historial? Esta acción no se puede deshacer.");
                    if (confirmed) {
                        try {
                            // La referencia al documento debe ser completa
                            await deleteDoc(doc(db, 'users', adminId, 'orders', orderId));
                        } catch (error) {
                            console.error("Error al eliminar la orden:", error);
                            await customAlert("No se pudo eliminar la orden.", "Error");
                        }
                    }
                });
            });
        });

        // Evento para cuando se selecciona un cliente del menú desplegable
        clientSelector.addEventListener('change', () => {
            // 💡 CORRECCIÓN: Se implementa la lógica para guardar y cargar el estado de cada cliente.
            const selectedClient = clientSelector.value;
            clientNameInput.value = selectedClient;
            
            // Cargar el pedido y las notas del cliente seleccionado
            const order = ordersByClient[selectedClient];
            if (order) {
                // Si el cliente tiene productos, regeneramos el texto.
                // Si no, simplemente cargamos sus notas guardadas (que podrían ser un pedido a medio escribir).
                orderTextArea.value = order.text || '';
                updateOrderDisplay(selectedClient);
            }
        });

        loadClients(); // Carga inicial de clientes
        clientNameInput.value = ""; // Establecer valor inicial vacío
    }

    async function loadAdminAppearanceSettings(adminId) {
        try {
            const adminDocRef = doc(db, 'users', adminId);
            const adminDocSnap = await getDoc(adminDocRef);

            if (adminDocSnap.exists() && adminDocSnap.data().appearanceSettings) {
                const settings = adminDocSnap.data().appearanceSettings;
                const mainHeader = document.getElementById('main-header');
                const headerTextElement = document.getElementById('header-text');
                const restaurantLogoImg = document.getElementById('restaurant-logo');

                if (settings.headerText && headerTextElement) {
                    headerTextElement.textContent = settings.headerText;
                }
                if (settings.logoUrl && restaurantLogoImg) {
                    restaurantLogoImg.src = settings.logoUrl;
                    restaurantLogoImg.style.display = 'block';
                }
            }
        } catch (error) {
            console.error("Error al cargar los ajustes de apariencia del admin:", error);
        }
    }
});