// admin.js

// --- 1. Importaciones de tus archivos locales (INSTANCIAS de Firebase) ---
import { auth, db } from './auth/firebaseConfig.js';
import { checkUserRole } from './utils/uiHelpers.js';
// Importamos las funciones de Firestore para la gestión del menú
import {
    collection,
    addDoc,
    doc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    query,
    orderBy,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
// Importamos funciones de autenticación
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";


document.addEventListener('DOMContentLoaded', () => {

    // 💡 Lógica de autenticación y verificación de rol reactiva mediante middleware
    checkUserRole(auth, db, 'administrador', '/login.html')
        .then(({ user, adminId }) => {
            console.log('Acceso concedido (middleware). Usuario es administrador.');
            initializeAdminPanel();
            initializeUserMenu();
            initializeMenuManagement();
        })
        .catch((error) => {
            console.error("Fallo de enrutamiento de administrador:", error);
        });

    // --- LÓGICA PARA EL MENÚ DE USUARIO (COPIADA DE principal.js) ---
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
                alert("Ocurrió un error al cerrar sesión.");
            }
        });

        confirmLogoutNo.addEventListener('click', () => {
            confirmLogoutDialog.style.display = 'none';
        });
    }


    function initializeAdminPanel() {
        // --- Elementos del Panel de Ajustes (lógica existente, sin cambios) ---
        const toggleSettingsButton = document.getElementById('toggleSettingsPanel');
        const settingsPanel = document.getElementById('settingsPanel');
        const closeSettingsButton = document.getElementById('closeSettingsPanel');
        const headerTextInput = document.getElementById('headerTextInput');
        const logoInput = document.getElementById('logoInput');
        const mainHeader = document.getElementById('main-header');
        const headerTextElement = document.getElementById('header-text');
        const restaurantLogoImg = document.getElementById('restaurant-logo');
        const logoPreview = document.getElementById('logoPreview');

        // --- Debounce para no saturar Firestore con escrituras ---
        let debounceTimer;
        function debounce(func, delay) {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(func, delay);
        }

        // Función para redimensionar y optimizar la imagen antes de subirla
        async function processLogo(file) {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = (event) => {
                    const img = new Image();
                    img.src = event.target.result;
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const MAX_HEIGHT = 80; // Altura optimizada para el header
                        const scale = MAX_HEIGHT / img.height;
                        canvas.height = MAX_HEIGHT;
                        canvas.width = img.width * scale;
                        
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        // Convertimos a WebP para máxima compresión
                        resolve(canvas.toDataURL('image/webp', 0.8));
                    };
                };
            });
        }

        async function saveSettingsToFirestore(settings) {
            const user = auth.currentUser;
            if (user) {
                const userDocRef = doc(db, 'users', user.uid);
                await updateDoc(userDocRef, { appearanceSettings: settings }, { merge: true });
            }
        }

        async function applySettings(e) {
            const headerText = headerTextInput.value;
            let logoUrl = restaurantLogoImg.src && restaurantLogoImg.style.display !== 'none' ? restaurantLogoImg.src : null;

            if (e && e.target.id === 'logoInput' && e.target.files[0]) {
                logoUrl = await processLogo(e.target.files[0]);
                restaurantLogoImg.src = logoUrl;
                restaurantLogoImg.style.display = 'block';
                
                if (logoPreview) {
                    logoPreview.src = logoUrl;
                    logoPreview.style.display = 'block';
                }
            }

            const settings = {
                headerText,
                logoUrl
            };

            if (headerTextElement) {
                headerTextElement.textContent = headerText;
            }

            // Guardar en Firestore con un retraso para no hacer demasiadas escrituras
            debounce(() => saveSettingsToFirestore(settings), 1000);
        }

        async function loadSavedSettings() {
            const user = auth.currentUser;
            if (!user) return;

            const userDocRef = doc(db, 'users', user.uid);
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists() && userDocSnap.data().appearanceSettings) {
                const settings = userDocSnap.data().appearanceSettings;
                
                if (settings.headerText && headerTextElement) {
                    headerTextElement.textContent = settings.headerText;
                    if (headerTextInput) headerTextInput.value = settings.headerText;
                }
                if (settings.logoUrl && restaurantLogoImg) {
                    restaurantLogoImg.src = settings.logoUrl;
                    restaurantLogoImg.style.display = 'block';
                }
                if (settings.logoUrl && logoPreview) {
                    logoPreview.src = settings.logoUrl;
                    logoPreview.style.display = 'block';
                }
            } else if (headerTextElement && headerTextInput) {
                headerTextInput.value = headerTextElement.textContent;
                // Si no hay ajustes guardados, asegúrate de que el logo esté oculto
                if (restaurantLogoImg) {
                    restaurantLogoImg.src = '';
                    restaurantLogoImg.style.display = 'none';
                }
                if (logoPreview) {
                    logoPreview.src = '';
                    logoPreview.style.display = 'none';
                }
            }
        }
        
        if (toggleSettingsButton) toggleSettingsButton.addEventListener('click', () => settingsPanel.classList.add('open'));
        if (closeSettingsButton) closeSettingsButton.addEventListener('click', () => settingsPanel.classList.remove('open'));
        // Todos los inputs llaman a la misma función que ahora guarda en Firestore
        document.querySelectorAll('#settingsPanel input').forEach(input => {
            if (input.type === 'file') {
                input.addEventListener('change', applySettings); // Usar 'change' para inputs de tipo file
            } else {
                input.addEventListener('input', applySettings);
            }
        });
        
        loadSavedSettings();
    }


    // --- FUNCIÓN PRINCIPAL DE GESTIÓN DEL MENÚ ---
    // Se llama solo si el usuario es un administrador
    function initializeMenuManagement() {
        const productNameInput = document.getElementById('productNameInput');
        const productPriceInput = document.getElementById('productPriceInput');
        const productCategoryInput = document.getElementById('productCategoryInput'); // Nuevo input
        const customCategoryList = document.getElementById('customCategoryList'); // Lista personalizada
        const addProductBtn = document.getElementById('addProductBtn');
        const menuList = document.getElementById('menuList');
        
        // --- CAMBIO CLAVE AQUÍ: La referencia a la colección ahora incluye el UID del usuario ---
        // Esto crea un menú único para cada administrador
        const menuItemsCollection = collection(db, 'users', auth.currentUser.uid, 'menuItems');

        // --- LÓGICA DEL DROPDOWN PERSONALIZADO ---
        let availableCategories = new Set(['Entradas', 'Platos Fuertes', 'Bebidas', 'Postres']); // Valores por defecto

        function updateCategoryDropdownSource(items) {
            // Agregar categorías existentes en la base de datos al Set
            items.forEach(item => {
                if (item.category) {
                    availableCategories.add(item.category.trim());
                }
            });
        }

        function renderCategoryDropdown(filterText = '') {
            customCategoryList.innerHTML = '';
            const categoriesArray = Array.from(availableCategories).sort();
            
            const filtered = categoriesArray.filter(cat => 
                cat.toLowerCase().includes(filterText.toLowerCase())
            );

            if (filtered.length === 0) {
                customCategoryList.style.display = 'none';
                return;
            }

            filtered.forEach(cat => {
                const li = document.createElement('li');
                li.textContent = cat;
                li.addEventListener('click', () => {
                    productCategoryInput.value = cat;
                    customCategoryList.style.display = 'none';
                });
                customCategoryList.appendChild(li);
            });

            customCategoryList.style.display = 'block';
        }

        // Eventos del input de categoría
        if (productCategoryInput) {
            productCategoryInput.addEventListener('input', (e) => {
                renderCategoryDropdown(e.target.value);
            });

            productCategoryInput.addEventListener('focus', () => {
                renderCategoryDropdown(productCategoryInput.value);
            });

            // Cerrar lista al hacer clic fuera
            document.addEventListener('click', (e) => {
                if (!productCategoryInput.contains(e.target) && !customCategoryList.contains(e.target)) {
                    customCategoryList.style.display = 'none';
                }
            });
        }
        // --- FIN LÓGICA DROPDOWN ---

        // --- LÓGICA MODAL DE ALERTA ---
        const customAlertModal = document.getElementById('customAlertModal');
        const modalBtnAccept = document.getElementById('modalBtnAccept');

        function showCustomAlert() {
            if (customAlertModal) customAlertModal.style.display = 'flex';
        }

        if (modalBtnAccept) {
            modalBtnAccept.addEventListener('click', () => {
                if (customAlertModal) customAlertModal.style.display = 'none';
            });
        }

        function renderMenu(items) {
            menuList.innerHTML = '';
            
            // Actualizar las opciones del dropdown con los datos actuales
            updateCategoryDropdownSource(items);

            if (items.length === 0) {
                menuList.innerHTML = '<p style="color:#aaa; text-align: center; margin-top: 20px;">Aún no hay productos en el menú. ¡Agrega uno!</p>';
                return;
            }

            // 1. Agrupar items por categoría
            const groupedItems = items.reduce((acc, item) => {
                const category = item.category || 'General'; // Categoría por defecto
                if (!acc[category]) acc[category] = [];
                acc[category].push(item);
                return acc;
            }, {});

            // 2. Obtener categorías y ordenarlas alfabéticamente
            const sortedCategories = Object.keys(groupedItems).sort((a, b) => a.localeCompare(b));

            // 3. Renderizar por categoría
            sortedCategories.forEach(category => {
                // Crear encabezado de sección
                const sectionHeader = document.createElement('li');
                sectionHeader.classList.add('menu-section-header');
                sectionHeader.textContent = category;
                menuList.appendChild(sectionHeader);

                // Ordenar productos dentro de la categoría alfabéticamente
                const categoryItems = groupedItems[category].sort((a, b) => a.name.localeCompare(b.name));

                categoryItems.forEach(item => {
                    const listItem = document.createElement('li');
                    listItem.classList.add('menu-item');
                    listItem.dataset.id = item.id; 

                    const itemDetails = document.createElement('div');
                    itemDetails.classList.add('item-details');

                    const itemName = document.createElement('span');
                    itemName.classList.add('item-name');
                    itemName.textContent = item.name;

                    const itemPrice = document.createElement('span');
                    itemPrice.classList.add('item-price');
                    itemPrice.textContent = `$${item.price.toFixed(2)}`;

                    itemDetails.appendChild(itemName);
                    itemDetails.appendChild(itemPrice);
                    listItem.appendChild(itemDetails);

                    const controlsDiv = document.createElement('div');

                    const priceInput = document.createElement('input');
                    priceInput.type = 'number';
                    priceInput.min = '0.01';
                    priceInput.step = '0.01';
                    priceInput.value = item.price.toFixed(2);
                    priceInput.classList.add('edit-price-input');
                    priceInput.title = 'Haz clic fuera o presiona Enter para guardar el precio';
                    priceInput.addEventListener('change', (e) => {
                        updateMenuItemPrice(item.id, parseFloat(e.target.value));
                    });
                    controlsDiv.appendChild(priceInput);

                    const deleteButton = document.createElement('button');
                    deleteButton.textContent = 'Eliminar';
                    deleteButton.classList.add('delete-item-btn');
                    deleteButton.addEventListener('click', () => {
                        deleteMenuItem(item.id);
                    });
                    controlsDiv.appendChild(deleteButton);

                    listItem.appendChild(controlsDiv);
                    menuList.appendChild(listItem);
                });
            });
        }

        async function addMenuItem() {
            const name = productNameInput.value.trim();
            const price = parseFloat(productPriceInput.value);
            const category = productCategoryInput.value.trim() || 'General'; // Obtener categoría

            if (name !== '' && !isNaN(price) && price > 0) {
                try {
                    await addDoc(menuItemsCollection, {
                        name: name,
                        price: price,
                        category: category // Guardar categoría
                    });
                    console.log("Producto agregado con éxito a Firestore.");
                    productNameInput.value = '';
                    productPriceInput.value = '0.00';
                    // No limpiamos la categoría para facilitar agregar varios items a la misma sección
                    productNameInput.focus();
                } catch (e) {
                    console.error("Error al agregar el producto:", e);
                    alert("Hubo un error al agregar el producto.");
                }
            } else {
                showCustomAlert(); // Mostrar alerta personalizada
            }
        }

        async function deleteMenuItem(docId) {
            if (confirm(`¿Estás seguro de que quieres eliminar este producto del menú?`)) {
                try {
                    // --- La referencia al documento ahora incluye el UID del usuario ---
                    const docRef = doc(db, 'users', auth.currentUser.uid, 'menuItems', docId);
                    await deleteDoc(docRef);
                    console.log("Producto eliminado con éxito de Firestore.");
                } catch (e) {
                    console.error("Error al eliminar el producto:", e);
                    alert("Hubo un error al eliminar el producto.");
                }
            }
        }

        async function updateMenuItemPrice(docId, newPrice) {
            if (!isNaN(newPrice) && newPrice > 0) {
                try {
                    // --- La referencia al documento ahora incluye el UID del usuario ---
                    const docRef = doc(db, 'users', auth.currentUser.uid, 'menuItems', docId);
                    await updateDoc(docRef, {
                        price: newPrice
                    });
                    console.log("Precio actualizado con éxito en Firestore.");
                } catch (e) {
                    console.error("Error al actualizar el precio:", e);
                    alert("Hubo un error al actualizar el precio.");
                }
            } else {
                alert('El precio ingresado no es válido. Debe ser un número mayor a cero.');
            }
        }
        
        // --- El listener ahora escucha la subcolección del usuario actual ---
        const menuQuery = query(menuItemsCollection, orderBy('name'));
        onSnapshot(menuQuery, (snapshot) => {
            const items = [];
            snapshot.forEach(doc => {
                items.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            console.log("Menú actualizado desde Firestore.");
            renderMenu(items);
        }, (error) => {
            console.error("Error al escuchar el menú de Firestore:", error);
            menuList.innerHTML = '<p style="color:#dc3545; text-align: center; margin-top: 20px;">Error al cargar el menú. Por favor, recargue la página.</p>';
        });

        if (addProductBtn) {
            addProductBtn.addEventListener('click', addMenuItem);
        }
        if (productNameInput) {
            productNameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    productPriceInput.focus();
                }
            });
        }
        if (productPriceInput) {
            productPriceInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    addProductBtn.click();
                }
            });
        }
    }
});