document.addEventListener('DOMContentLoaded', () => {
  const holdedButton = document.getElementById('holdedButton');
  if (!holdedButton) return;

  holdedButton.addEventListener('click', async () => {
    try {
      const payload = JSON.parse(holdedButton.dataset.payload || '{}');
      if (!payload || !payload.pedidoId) {
        alert('No se pudo preparar la información del pedido.');
        return;
      }

      const response = await fetch(`/dashboard/pedidos/${payload.pedidoId}/holded`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Error HTTP ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Respuesta inválida del servidor');
      }

      alert('Se ha realizado la transferencia a Holded');
      window.location.href = `/dashboard/pedidos/${payload.pedidoId}?success=pedido_cerrado`;
    } catch (error) {
      console.error('Error enviando pedido a Holded:', error);
      alert('No se pudo completar la transferencia a Holded. Inténtalo nuevamente.');
    }
  });
});

