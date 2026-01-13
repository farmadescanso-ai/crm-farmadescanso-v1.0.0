document.addEventListener('DOMContentLoaded', () => {
  const payloadNode = document.getElementById('actionsPayload');
  const basePayload = payloadNode ? JSON.parse(payloadNode.textContent || '{}') : null;

  const holdedButton = document.getElementById('holdedButton');
  const emailButton = document.getElementById('emailButton');
  const pedidoId = (basePayload && basePayload.pedidoId) || (emailButton && emailButton.dataset.pedidoId);

  if (holdedButton && basePayload) {
    holdedButton.addEventListener('click', async () => {
      if (holdedButton.dataset.loading === 'true') {
        return;
      }

      const originalText = holdedButton.innerHTML;
      holdedButton.dataset.loading = 'true';
      holdedButton.disabled = true;
      holdedButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Enviando...';

      try {
        // El servidor obtendrá todos los datos del pedido automáticamente
        const response = await fetch(`/dashboard/pedidos/${basePayload.pedidoId}/holded`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(basePayload)
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) {
          throw new Error(result.error || `Error HTTP ${response.status}`);
        }
        alert('✅ Se ha realizado la transferencia a Holded correctamente');
        window.location.href = `/dashboard/pedidos/${basePayload.pedidoId}?success=pedido_cerrado`;
      } catch (error) {
        console.error('Error enviando pedido a Holded:', error);
        alert(`❌ No se pudo completar la transferencia a Holded: ${error.message || error}`);
      } finally {
        holdedButton.dataset.loading = 'false';
        holdedButton.disabled = false;
        holdedButton.innerHTML = originalText;
      }
    });
  }

  if (emailButton && pedidoId) {
    emailButton.addEventListener('click', async () => {
      if (emailButton.dataset.loading === 'true') {
        return;
      }

      const originalText = emailButton.textContent;
      emailButton.dataset.loading = 'true';
      emailButton.disabled = true;
      emailButton.textContent = 'Enviando...';

      try {
        const response = await fetch(`/dashboard/pedidos/${pedidoId}/email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) {
          throw new Error(result.error || `Error HTTP ${response.status}`);
        }

        const destinatarios = Array.isArray(result.recipients) && result.recipients.length
          ? result.recipients.join(', ')
          : 'los destinatarios configurados';
        alert(`Correo enviado correctamente a ${destinatarios}.`);
      } catch (error) {
        console.error('Error enviando email:', error);
        alert(`No se pudo enviar el correo: ${error.message || error}`);
      } finally {
        emailButton.dataset.loading = 'false';
        emailButton.disabled = false;
        emailButton.textContent = originalText;
      }
    });
  }
});

