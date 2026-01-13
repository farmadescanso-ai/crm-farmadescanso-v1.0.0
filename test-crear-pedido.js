// Script de prueba para verificar la creación de pedido con datos específicos
const fetch = require('node-fetch');

const datosPedido = {
  cliente_id: "808",
  comercial_id: "2",
  cooperativa_nombre: "HEFAME",
  estado: "Pendiente",
  fecha_entrega: "2025-12-18",
  fecha_pedido: "2025-12-16",
  forma_pago: "1",
  lineas_payload: JSON.stringify({
    lineas: [{
      articuloId: "14",
      cantidad: 1,
      precio: 10.41,
      iva: 21,
      descuento: 5
    }],
    descuentoGeneral: 0
  }),
  numero_cooperativa: "10121509",
  numero_pedido: "P250001",
  observaciones: "",
  tipo_pedido: "Transfer Hefame"
};

// Convertir a URLSearchParams (formato que usa el cliente)
const formData = new URLSearchParams();
Object.keys(datosPedido).forEach(key => {
  formData.append(key, datosPedido[key]);
});

console.log('🧪 [TEST] Datos del pedido a enviar:');
console.log(JSON.stringify(datosPedido, null, 2));
console.log('\n🧪 [TEST] Enviando petición POST a http://localhost:3000/dashboard/pedidos...\n');

fetch('http://localhost:3000/dashboard/pedidos', {
  method: 'POST',
  body: formData.toString(),
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    'Cookie': 'farmadescaso_token=test' // Necesitarás un token válido
  }
})
.then(async response => {
  console.log('📥 [TEST] Respuesta recibida:', response.status, response.statusText);
  console.log('📥 [TEST] Content-Type:', response.headers.get('content-type'));
  
  const text = await response.text();
  console.log('📥 [TEST] Respuesta completa:', text);
  
  try {
    const json = JSON.parse(text);
    console.log('📥 [TEST] Respuesta JSON:', JSON.stringify(json, null, 2));
  } catch (e) {
    console.log('📥 [TEST] Respuesta no es JSON válido');
  }
})
.catch(error => {
  console.error('❌ [TEST] Error:', error.message);
  console.error('❌ [TEST] Stack:', error.stack);
});

