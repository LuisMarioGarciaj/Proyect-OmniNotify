import { Controller, Post, Body, UseGuards, Get, Query, Param, Delete, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CompanyId } from '../../common/decorators/company-id.decorator';
import { NotificationUnifiedService } from './notification-unified.service';
import { NotificationsService } from './notifications.service';
import { SendUnifiedNotificationDto } from './dto/send-unified.dto';
import { SendNotificationResponseDto } from './dto/send-notification.dto';

// Definir interfaces de respuesta locales
interface StatsResponse {
  success: boolean;
  companyId: string;
  queueStats: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    scheduled: number;
    total: number;
  };
  timestamp: string;
}

interface LogsResponse {
  success: boolean;
  data: any[];
  total: number;
  limit: number;
  offset: number;
  timestamp: string;
}

interface ScheduledItem {
  id: string;
  recipient: string;
  companyId: string;
  templateId: string;
  channel: string;
  variables: Record<string, any> | null;
  scheduledAt: string;
  status: string;
}

interface ScheduledResponse {
  success: boolean;
  data: ScheduledItem[];
  count: number;
  timestamp: string;
}

interface CancelResponse {
  success: boolean;
  message: string;
  data: {
    id: string;
    status: string;
  };
}

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly unifiedService: NotificationUnifiedService,
    private readonly notificationsService: NotificationsService,
  ) { }

  /**
   * 📤 ENDPOINT UNIFICADO NUEVO (RECOMENDADO)
   * Soporta: EMAIL, SMS, WHATSAPP
   * Scheduling automático según el DTO
   */
  @Post('send')
  @HttpCode(HttpStatus.OK)
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
    `
  })
  @ApiResponse({ status: 200, description: 'Notificación procesada exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async send(
    @CompanyId() companyId: string,
    @Body() dto: SendUnifiedNotificationDto,
  ): Promise<SendNotificationResponseDto> {
    return this.unifiedService.send(companyId, dto);
  }

  /**
   * 📊 ENDPOINT PARA OBTENER ESTADÍSTICAS
   */
  @Get('stats')
  @ApiOperation({
    summary: 'Obtener estadísticas de la cola',
    description: 'Retorna estadísticas de la cola de notificaciones'
  })
  async getStats(@CompanyId() companyId: string): Promise<StatsResponse> {
    return this.notificationsService.getStats(companyId);
  }

  /**
   * 📋 Obtener logs de notificaciones
   */
  @Get('logs')
  @ApiOperation({ summary: 'Obtener logs de notificaciones' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async getLogs(
    @CompanyId() companyId: string,
    @Query('limit') limit: number = 50,
    @Query('offset') offset: number = 0,
  ): Promise<LogsResponse> {
    return this.notificationsService.getLogs(companyId, limit, offset);
  }

  /**
   * 📅 Obtener notificaciones programadas
   */
  @Get('scheduled')
  @ApiOperation({ summary: 'Obtener notificaciones programadas' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async getScheduled(
    @CompanyId() companyId: string,
    @Query('limit') limit: number = 50,
    @Query('offset') offset: number = 0,
  ): Promise<ScheduledResponse> {
    return this.notificationsService.getScheduledNotifications(companyId, limit, offset);
  }

  /**
   * ❌ Cancelar notificación programada
   */
  @Delete('scheduled/:id')
  @ApiOperation({ summary: 'Cancelar notificación programada' })
  async cancelScheduled(
    @CompanyId() companyId: string,
    @Param('id') id: string,
  ): Promise<CancelResponse> {
    return this.notificationsService.cancelScheduledNotification(companyId, id);
  }

  /**
   * GET /notifications/status?jobId=38
   *
   * Verifica el estado de un envío. El jobId viene en la respuesta del POST /send.
   * Mismo header Authorization: Bearer <token> que el /send.
   *
   * Respuesta:
   * - status: QUEUED | PENDING | SENDING | WAITING_RETRY | SENT | FAILED
   * - log.attemptsMade: cuántos intentos se hicieron (1 = primer intento)
   * - queue.state: estado en BullMQ (si el job aún no fue limpiado de Redis)
   */
  @Get('status')
  @ApiOperation({ summary: '📊 Verificar estado de un envío por jobId' })
  @ApiQuery({ name: 'jobId', required: true, description: 'Job ID del campo data.jobId en la respuesta del /send' })
  async getStatus(
    @CompanyId() companyId: string,
    @Query('jobId') jobId: string,
  ) {
    return this.unifiedService.getStatus(companyId, jobId);
  }

  /**
   * GET /notifications/templates
   * GET /notifications/templates?channel=WHATSAPP
   *
   * Lista todos los templates disponibles con su templateAlias listo para copiar.
   * Usar el valor de templateAlias en el campo templateAlias del POST /send.
   */
  @Get('templates')
  @ApiOperation({ summary: '📋 Listar templates disponibles de la empresa' })
  @ApiQuery({ name: 'channel', required: false, description: 'Filtrar: EMAIL | SMS | WHATSAPP' })
  async listTemplates(
    @CompanyId() companyId: string,
    @Query('channel') channel?: string,
  ) {
    return this.unifiedService.listTemplates(companyId, channel);
  }

}