// src/modules/notifications/controllers/notifications.controller.ts
import { Controller, Post, Body, UseGuards, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CompanyId } from '../../common/decorators/company-id.decorator';
import { NotificationUnifiedService } from './notification-unified.service';
import { NotificationsService } from './notifications.service'; // ✅ Mantener servicio original
import { SendUnifiedNotificationDto } from './dto/send-unified.dto';
import { SendNotificationDto } from './dto/send-notification.dto'; // ✅ DTO original

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard) // ✅ CompanyId del JWT
export class NotificationsController {
  constructor(
    private readonly unifiedService: NotificationUnifiedService,  // ✅ Servicio NUEVO
    private readonly legacyService: NotificationsService,          // ✅ Servicio VIEJO (compatibilidad)
  ) {}

  /**
   * 📤 ENDPOINT UNIFICADO NUEVO (RECOMENDADO)
   * Soporta: EMAIL, SMS, WHATSAPP
   * Scheduling automático según el DTO
   */
  @Post('send')
  @ApiOperation({ 
    summary: '📤 Enviar notificación unificada (EMAIL | SMS | WHATSAPP)',
    description: `
      **✅ ENDPOINT NUEVO MEJORADO**
      
      **Scheduling automático:**
      - Si \`scheduling.is_scheduled = false\` → Envío inmediato
      - Si \`scheduling.is_scheduled = true\` → Guarda en SCHEDULED_NOTIFICATION
      
      **Template flexible:**
      - Usa \`templateAlias\` (ej: "WELCOME_EMAIL") - ✅ RECOMENDADO
      - O usa \`templateId\` (UUID) - Compatible con código antiguo
      
      **CompanyId automático:**
      - NO enviar en el body, se extrae del JWT
      
      **Ejemplos:**
      
      Envío inmediato:
      \`\`\`json
      {
        "channel": "EMAIL",
        "templateAlias": "WELCOME_EMAIL",
        "recipient": "user@example.com",
        "variables": { "name": "Juan" },
        "scheduling": { "is_scheduled": false }
      }
      \`\`\`
      
      Envío programado:
      \`\`\`json
      {
        "channel": "WHATSAPP",
        "templateAlias": "ORDER_CONFIRMATION",
        "recipient": "+59176131645",
        "variables": { "orderNumber": "123" },
        "scheduling": {
          "is_scheduled": true,
          "send_at": "2026-02-20T15:00:00Z"
        }
      }
      \`\`\`
    `
  })
  @ApiResponse({ status: 200, description: 'Notificación procesada exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async send(
    @CompanyId() companyId: string, // ✅ Del JWT
    @Body() dto: SendUnifiedNotificationDto,
  ) {
    return this.unifiedService.send(companyId, dto);
  }

  /**
   * 📊 ENDPOINT PARA OBTENER ESTADÍSTICAS
   * Compatible con código anterior
   */
  @Get('stats')
  @ApiOperation({ 
    summary: 'Obtener estadísticas de la cola',
    description: 'Retorna estadísticas de la cola de notificaciones'
  })
  async getStats(@CompanyId() companyId: string) {
    return this.legacyService.getStats(companyId);
  }

  // ============================================
  // ENDPOINTS LEGACY (Para migración gradual)
  // ============================================
  // Si todavía tienes código que usa el endpoint antiguo
  // sin el decorator @CompanyId, puedes mantenerlo aquí
  // pero marcarlo como deprecated
  
  // Ejemplo:
  // @Post('send-legacy')
  // @ApiOperation({ 
  //   summary: '⚠️ DEPRECATED - Usar POST /send en su lugar',
  //   deprecated: true
  // })
  // async sendLegacy(@Body() dto: SendNotificationDto) {
  //   return this.legacyService.enqueueNotification(dto);
  // }
}