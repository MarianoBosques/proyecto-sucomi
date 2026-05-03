// Función para cambiar entre pestañas
        function openTab(tabName) {
            const tabs = document.querySelectorAll('.tab');
            tabs.forEach(tab => {
                tab.classList.remove('active');
            });
            
            const tabButtons = document.querySelectorAll('.tab-btn');
            tabButtons.forEach(btn => {
                btn.classList.remove('active');
            });
            
            document.getElementById(tabName).classList.add('active');
            event.currentTarget.classList.add('active');
        }
        
        // Función para actualizar el preview de color y el valor hexadecimal
        function updateColorPreview(inputId, previewId, hexId) {
            const input = document.getElementById(inputId);
            const preview = document.getElementById(previewId);
            const hexSpan = document.getElementById(hexId);
            
            input.addEventListener('input', function() {
                preview.style.backgroundColor = this.value;
                hexSpan.textContent = this.value;
                
                // Actualizar la variable CSS correspondiente
                if(inputId === 'bg-color') {
                    document.documentElement.style.setProperty('--bg-color', this.value);
                } else if(inputId === 'text-color') {
                    document.documentElement.style.setProperty('--text-color', this.value);
                } else if(inputId === 'container-bg') {
                    document.documentElement.style.setProperty('--container-bg', this.value);
                } else if(inputId === 'button-bg') {
                    document.documentElement.style.setProperty('--button-bg', this.value);
                } else if(inputId === 'button-text') {
                    document.documentElement.style.setProperty('--button-text', this.value);
                } else if(inputId === 'icon-color') {
                    document.documentElement.style.setProperty('--icon-color', this.value);
                    document.querySelectorAll('.icon-preview i').forEach(icon => {
                        icon.style.color = this.value;
                    });
                } else if(inputId === 'h1-color') {
                    document.querySelectorAll('h1').forEach(h1 => {
                        h1.style.color = this.value;
                    });
                } else if(inputId === 'h2-color') {
                    document.querySelectorAll('h2').forEach(h2 => {
                        h2.style.color = this.value;
                    });
                } else if(inputId === 'p-color') {
                    document.querySelectorAll('p').forEach(p => {
                        p.style.color = this.value;
                    });
                }
            });
        }
        
        // Función para actualizar el preview de imágenes
        function updateImagePreview(previewId, imageUrl) {
            const preview = document.getElementById(previewId);
            if(imageUrl) {
                preview.style.backgroundImage = `url('${imageUrl}')`;
                preview.classList.add('has-image');
                preview.textContent = '';
            } else {
                preview.style.backgroundImage = '';
                preview.classList.remove('has-image');
                preview.textContent = 'Previsualización';
            }
        }
        
        // Inicializar los controles de color
        updateColorPreview('bg-color', 'bg-preview', 'bg-hex');
        updateColorPreview('text-color', 'text-preview', 'text-hex');
        updateColorPreview('container-bg', 'container-preview', 'container-hex');
        updateColorPreview('button-bg', 'button-bg-preview', 'button-bg-hex');
        updateColorPreview('button-text', 'button-text-preview', 'button-text-hex');
        updateColorPreview('icon-color', 'icon-preview', 'icon-hex');
        updateColorPreview('h1-color', 'h1-preview', 'h1-hex');
        updateColorPreview('h2-color', 'h2-preview', 'h2-hex');
        updateColorPreview('p-color', 'p-preview', 'p-hex');
        
        // Controladores para las imágenes
        document.getElementById('header-image').addEventListener('input', function() {
            updateImagePreview('header-preview', this.value);
        });
        
        document.getElementById('main-image').addEventListener('input', function() {
            updateImagePreview('main-preview', this.value);
        });
        
        document.getElementById('footer-image').addEventListener('input', function() {
            updateImagePreview('footer-preview', this.value);
        });

        // Función para manejo de imágenes
        function showUrlInput(type) {
            document.getElementById(`${type}-url-input`).style.display = 'flex';
        }
        
        function updateImageFromUrl(inputId, previewId) {
            const url = document.getElementById(inputId).value;
            if(url) {
                updateImagePreview(previewId, url);
                showNotification('Imagen actualizada desde URL', 'success');
            } else {
                showNotification('Por favor ingresa una URL válida', 'error');
            }
        }
        
        function handleImageUpload(input, previewId) {
            const file = input.files[0];
            if(file) {
                if(file.type.match('image.*')) {
                    const reader = new FileReader();
                    
                    reader.onload = function(e) {
                        updateImagePreview(previewId, e.target.result);
                        showNotification('Imagen cargada correctamente', 'success');
                    }
                    
                    reader.readAsDataURL(file);
                } else {
                    showNotification('Por favor selecciona un archivo de imagen', 'error');
                    input.value = '';
                }
            }
        }
        
        function clearImage(previewId, inputId, uploadId) {
            document.getElementById(previewId).style.backgroundImage = '';
            document.getElementById(previewId).classList.remove('has-image');
            document.getElementById(previewId).textContent = 'Previsualización';
            
            if(inputId) document.getElementById(inputId).value = '';
            if(uploadId) document.getElementById(uploadId).value = '';
            
            showNotification('Imagen eliminada', 'info');
        }
        
        function updateImagePreview(previewId, imageSource) {
            const preview = document.getElementById(previewId);
            if(imageSource) {
                preview.style.backgroundImage = `url('${imageSource}')`;
                preview.classList.add('has-image');
                preview.textContent = '';
            } else {
                preview.style.backgroundImage = '';
                preview.classList.remove('has-image');
                preview.textContent = 'Previsualización';
            }
        }
        
        
        // Función para guardar los cambios
        function saveChanges() {
            const config = {
                bgColor: document.getElementById('bg-color').value,
                textColor: document.getElementById('text-color').value,
                containerBg: document.getElementById('container-bg').value,
                buttonBg: document.getElementById('button-bg').value,
                buttonText: document.getElementById('button-text').value,
                iconColor: document.getElementById('icon-color').value,
                h1Color: document.getElementById('h1-color').value,
                h2Color: document.getElementById('h2-color').value,
                pColor: document.getElementById('p-color').value,
                headerImage: document.getElementById('header-image').value,
                mainImage: document.getElementById('main-image').value,
                footerImage: document.getElementById('footer-image').value
            };
            
            // Guardar en localStorage
            localStorage.setItem('webCustomization', JSON.stringify(config));
            
            // Mostrar notificación
            showNotification('Configuración guardada correctamente!', 'success');
            
            // Para implementación real, aquí enviarías la configuración al servidor
            console.log('Configuración para aplicar en otra página:', config);
        }
        
        // Función para restablecer los valores por defecto
        function resetSettings() {
            if(confirm('¿Estás seguro de que deseas restablecer todos los valores a los predeterminados?')) {
                // Valores por defecto
                const defaultValues = {
                    bgColor: '#f5f5f5',
                    textColor: '#333333',
                    containerBg: '#ffffff',
                    buttonBg: '#4CAF50',
                    buttonText: '#ffffff',
                    iconColor: '#555555',
                    h1Color: '#333333',
                    h2Color: '#333333',
                    pColor: '#333333',
                    headerImage: '',
                    mainImage: '',
                    footerImage: ''
                };
                
                // Aplicar valores por defecto a los inputs
                document.getElementById('bg-color').value = defaultValues.bgColor;
                document.getElementById('text-color').value = defaultValues.textColor;
                document.getElementById('container-bg').value = defaultValues.containerBg;
                document.getElementById('button-bg').value = defaultValues.buttonBg;
                document.getElementById('button-text').value = defaultValues.buttonText;
                document.getElementById('icon-color').value = defaultValues.iconColor;
                document.getElementById('h1-color').value = defaultValues.h1Color;
                document.getElementById('h2-color').value = defaultValues.h2Color;
                document.getElementById('p-color').value = defaultValues.pColor;
                document.getElementById('header-image').value = defaultValues.headerImage;
                document.getElementById('main-image').value = defaultValues.mainImage;
                document.getElementById('footer-image').value = defaultValues.footerImage;
                
                // Disparar eventos para actualizar la vista
                document.getElementById('bg-color').dispatchEvent(new Event('input'));
                document.getElementById('text-color').dispatchEvent(new Event('input'));
                document.getElementById('container-bg').dispatchEvent(new Event('input'));
                document.getElementById('button-bg').dispatchEvent(new Event('input'));
                document.getElementById('button-text').dispatchEvent(new Event('input'));
                document.getElementById('icon-color').dispatchEvent(new Event('input'));
                document.getElementById('h1-color').dispatchEvent(new Event('input'));
                document.getElementById('h2-color').dispatchEvent(new Event('input'));
                document.getElementById('p-color').dispatchEvent(new Event('input'));
                document.getElementById('header-image').dispatchEvent(new Event('input'));
                document.getElementById('main-image').dispatchEvent(new Event('input'));
                document.getElementById('footer-image').dispatchEvent(new Event('input'));
                
                // Eliminar configuración guardada
                localStorage.removeItem('webCustomization');
                
                showNotification('Configuración restablecida', 'info');
            }
        }
        
        // Función para mostrar notificaciones
        function showNotification(message, type) {
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            notification.textContent = message;
            document.body.appendChild(notification);
            
            // Forzamos un reflow para que la animación funcione
            void notification.offsetWidth;
            
            // Mostramos la notificación
            notification.classList.add('show');
            
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => {
                    notification.remove();
                }, 300);
            }, 3000);
        }
        
        // Cargar configuración guardada al iniciar
        window.addEventListener('DOMContentLoaded', function() {
            const savedConfig = localStorage.getItem('webCustomization');
            if (savedConfig) {
                const config = JSON.parse(savedConfig);
                
                // Aplicar configuración a los controles
                document.getElementById('bg-color').value = config.bgColor;
                document.getElementById('text-color').value = config.textColor;
                document.getElementById('container-bg').value = config.containerBg;
                document.getElementById('button-bg').value = config.buttonBg;
                document.getElementById('button-text').value = config.buttonText;
                document.getElementById('icon-color').value = config.iconColor;
                document.getElementById('h1-color').value = config.h1Color;
                document.getElementById('h2-color').value = config.h2Color;
                document.getElementById('p-color').value = config.pColor;
                document.getElementById('header-image').value = config.headerImage;
                document.getElementById('main-image').value = config.mainImage;
                document.getElementById('footer-image').value = config.footerImage;
                
                // Disparar eventos para aplicar los cambios
                document.getElementById('bg-color').dispatchEvent(new Event('input'));
                document.getElementById('text-color').dispatchEvent(new Event('input'));
                document.getElementById('container-bg').dispatchEvent(new Event('input'));
                document.getElementById('button-bg').dispatchEvent(new Event('input'));
                document.getElementById('button-text').dispatchEvent(new Event('input'));
                document.getElementById('icon-color').dispatchEvent(new Event('input'));
                document.getElementById('h1-color').dispatchEvent(new Event('input'));
                document.getElementById('h2-color').dispatchEvent(new Event('input'));
                document.getElementById('p-color').dispatchEvent(new Event('input'));
                document.getElementById('header-image').dispatchEvent(new Event('input'));
                document.getElementById('main-image').dispatchEvent(new Event('input'));
                document.getElementById('footer-image').dispatchEvent(new Event('input'));
            }
        });
        
        // Función para alternar el panel en dispositivos móviles
        function togglePanel() {
            const panel = document.getElementById('panelControl');
            panel.classList.toggle('collapsed');
            
            const btn = document.getElementById('togglePanelBtn');
            if(panel.classList.contains('collapsed')) {
                btn.innerHTML = '<i class="fas fa-cog"></i>';
            } else {
                btn.innerHTML = '<i class="fas fa-times"></i>';
            }
        }
        
        // Cerrar panel si se hace clic fuera de él en móviles
        document.addEventListener('click', function(event) {
            const panel = document.getElementById('panelControl');
            const toggleBtn = document.getElementById('togglePanelBtn');
            
            if(window.innerWidth <= 768 && 
               !panel.contains(event.target) && 
               event.target !== toggleBtn && 
               !panel.classList.contains('collapsed')) {
                panel.classList.add('collapsed');
                toggleBtn.innerHTML = '<i class="fas fa-cog"></i>';
            }
        });