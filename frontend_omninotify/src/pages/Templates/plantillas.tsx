export const getTemplatesByChannel = (channel: 'EMAIL' | 'SMS' | 'WHATSAPP') => {
  const templates = {
    EMAIL: [
      {
        id: 'welcome-email',
        name: 'Email de Bienvenida',
        content: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fa; border-radius: 10px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="margin: 0; font-size: 24px;">🎉 ¡Bienvenido {{nombre}}!</h1>
    <p style="margin: 10px 0 0 0; opacity: 0.9;">Te damos la bienvenida a {{empresa}}</p>
  </div>
  <div style="padding: 30px; background: white; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; line-height: 1.6; color: #333;">
      Estamos muy contentos de que te hayas unido. Tu cuenta ha sido creada exitosamente.
    </p>
    <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 6px;">
      <p style="margin: 0; color: #666;">
        📧 <strong>Email:</strong> {{email}}<br>
        📅 <strong>Fecha:</strong> {{fecha}}
      </p>
    </div>
    <div style="text-align: center; margin-top: 25px;">
      <a href="#" style="display: inline-block; padding: 10px 25px; background: #3b82f6; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
        Comenzar Ahora
      </a>
    </div>
  </div>
</div>`
      },
      {
        id: 'payment-reminder',
        name: 'Recordatorio de Pago',
        content: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fa; border-radius: 10px;">
  <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="margin: 0; font-size: 24px;">💰 Recordatorio de Pago</h1>
    <p style="margin: 10px 0 0 0; opacity: 0.9;">{{empresa}} - Estado de cuenta</p>
  </div>
  <div style="padding: 30px; background: white; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; line-height: 1.6; color: #333;">
      Hola {{nombre}},<br><br>
      Te recordamos que tienes un pago pendiente con {{empresa}}.
    </p>
    <div style="margin: 20px 0; padding: 20px; background: #fee2e2; border-radius: 8px; text-align: center;">
      <p style="margin: 0 0 10px 0; color: #991b1b; font-size: 14px;">MONTO A PAGAR</p>
      <p style="margin: 0; font-size: 32px; font-weight: bold; color: #dc2626;">{{monto}}</p>
      <p style="margin: 10px 0 0 0; color: #991b1b;">Vence: {{fechaLimite}}</p>
    </div>
    <div style="text-align: center;">
      <a href="#" style="display: inline-block; padding: 10px 25px; background: #10b981; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
        Pagar Ahora
      </a>
    </div>
  </div>
</div>`
      }
    ],
    SMS: [
      {
        id: 'welcome-sms',
        name: 'SMS de Bienvenida',
        content: `¡Bienvenido {{nombre}} a {{empresa}}!

Tu registro fue exitoso.
Email: {{email}}
Fecha: {{fecha}}

Para activar tu cuenta visita:
{{sitioWeb}}

Gracias por unirte.`
      },
      {
        id: 'payment-sms',
        name: 'SMS de Pago',
        content: `{{empresa}} - Recordatorio

Hola {{nombre}},

Tienes un pago pendiente de {{monto}}.
Vence: {{fechaLimite}}

Para pagar visita:
{{sitioWeb}}

Factura: {{numeroFactura}}`
      }
    ],
    WHATSAPP: [
      {
        id: 'welcome-whatsapp',
        name: 'WhatsApp de Bienvenida',
        content: `¡Hola {{nombre}}! 🎉

*Bienvenido a {{empresa}}*

✅ Tu registro fue exitoso
📧 Email: {{email}}
📅 Fecha: {{fecha}}

Visítanos: {{sitioWeb}}

¡Estamos aquí para ayudarte! 😊`
      },
      {
        id: 'notification-whatsapp',
        name: 'WhatsApp de Notificación',
        content: `🔔 *Notificación importante*
De: {{empresa}}

{{mensajeNotificacion}}

📅 Fecha: {{fecha}}
⏰ Hora: {{hora}}

Para más información:
{{sitioWeb}}`
      }
    ]
  };
  
  return templates[channel];
};

export const variableCategories = [
  {
    name: 'Cliente',
    icon: 'User',
    variables: [
      { id: 'nombre', name: 'Nombre', icon: '👤' },
      { id: 'email', name: 'Email', icon: '📧' },
      { id: 'telefono', name: 'Teléfono', icon: '📱' },
    ]
  },
  {
    name: 'Empresa',
    icon: 'Building',
    variables: [
      { id: 'empresa', name: 'Empresa', icon: '🏢' },
      { id: 'sitioWeb', name: 'Sitio Web', icon: '🌐' },
    ]
  },
  {
    name: 'Fechas',
    icon: 'Calendar',
    variables: [
      { id: 'fecha', name: 'Fecha', icon: '📅' },
      { id: 'hora', name: 'Hora', icon: '⏰' },
      { id: 'fechaLimite', name: 'Vencimiento', icon: '⏳' },
    ]
  },
  {
    name: 'Pagos',
    icon: 'CreditCard',
    variables: [
      { id: 'monto', name: 'Monto', icon: '💰' },
      { id: 'numeroFactura', name: 'Factura', icon: '🧾' },
    ]
  }
];