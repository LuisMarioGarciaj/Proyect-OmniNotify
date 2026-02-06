import { 
  Controller, 
  Get, 
  UseGuards, 
  Request,
  Query 
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * Obtener estadísticas generales del dashboard
   */
  @Get('stats')
  async getStats(@Request() req) {
    const companyId = req.user.companyId;
    return this.dashboardService.getGeneralStats(companyId);
  }

  /**
   * Obtener mensajes enviados por canal
   */
  @Get('messages-by-channel')
  async getMessagesByChannel(@Request() req) {
    const companyId = req.user.companyId;
    return this.dashboardService.getMessagesByChannel(companyId);
  }

  /**
   * Obtener actividad de los últimos N días
   */
  @Get('activity')
  async getActivity(
    @Request() req,
    @Query('days') days?: string
  ) {
    const companyId = req.user.companyId;
    const numDays = days ? parseInt(days) : 7;
    return this.dashboardService.getActivityByDay(companyId, numDays);
  }

  /**
   * Obtener notificaciones recientes
   */
  @Get('recent-notifications')
  async getRecentNotifications(
    @Request() req,
    @Query('limit') limit?: string
  ) {
    const companyId = req.user.companyId;
    const numLimit = limit ? parseInt(limit) : 10;
    return this.dashboardService.getRecentNotifications(companyId, numLimit);
  }

  /**
   * Obtener notificaciones programadas pendientes
   */
  @Get('scheduled-pending')
  async getScheduledPending(@Request() req) {
    const companyId = req.user.companyId;
    return this.dashboardService.getScheduledPending(companyId);
  }

  /**
   * Obtener tasa de éxito vs fallos
   */
  @Get('success-rate')
  async getSuccessRate(@Request() req) {
    const companyId = req.user.companyId;
    return this.dashboardService.getSuccessRate(companyId);
  }
}