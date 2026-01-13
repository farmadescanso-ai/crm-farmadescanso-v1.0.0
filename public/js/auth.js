// Funcionalidad del formulario de login
document.addEventListener('DOMContentLoaded', function() {
    // Toggle password visibility
    const togglePasswordBtn = document.getElementById('togglePassword');
    if (togglePasswordBtn) {
        togglePasswordBtn.addEventListener('click', function() {
            const password = document.getElementById('password');
            const icon = this.querySelector('i');
            
            if (password.type === 'password') {
                password.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
                this.setAttribute('title', 'Ocultar contraseña');
            } else {
                password.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
                this.setAttribute('title', 'Mostrar contraseña');
            }
        });
    }

    // Auto-focus en el campo de email si está vacío
    const emailField = document.getElementById('email');
    if (emailField && !emailField.value) {
        emailField.focus();
    }

    // Validación en tiempo real
    const form = document.querySelector('.auth-form');
    if (form) {
        form.addEventListener('submit', function(e) {
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            if (!email || !password) {
                e.preventDefault();
                alert('Por favor, completa todos los campos');
                return false;
            }
            
            // Mostrar loading en el botón
            const submitBtn = this.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Iniciando sesión...';
            submitBtn.disabled = true;
            
            // Re-enable button after 5 seconds (in case of error)
            setTimeout(() => {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }, 5000);
        });
    }

    // Limpiar mensajes de error al escribir
    const errorAlert = document.querySelector('.alert-danger');
    if (errorAlert) {
        const inputs = document.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener('input', function() {
                if (errorAlert) {
                    errorAlert.style.opacity = '0.7';
                }
            });
        });
    }
});























