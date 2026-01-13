// Go to Top Button - Funcionalidad reutilizable
(function() {
    'use strict';
    
    // Esperar a que el DOM esté listo
    document.addEventListener('DOMContentLoaded', function() {
        const goToTopButton = document.getElementById('goToTop');
        
        if (!goToTopButton) {
            return; // Si no existe el botón, salir
        }
        
        // Función para mostrar/ocultar el botón según el scroll
        function toggleGoToTopButton() {
            const navbar = document.querySelector('.navbar');
            const navbarHeight = navbar ? navbar.offsetHeight : 56;
            
            if (window.pageYOffset > navbarHeight) {
                goToTopButton.classList.add('show');
            } else {
                goToTopButton.classList.remove('show');
            }
        }
        
        // Función para hacer scroll suave hacia arriba
        function scrollToTop() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }
        
        // Event listeners
        window.addEventListener('scroll', toggleGoToTopButton);
        goToTopButton.addEventListener('click', scrollToTop);
        
        // Verificar estado inicial (por si la página ya está scrolleada)
        toggleGoToTopButton();
    });
})();

