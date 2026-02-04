import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

// Entidades
import { NotificationLog } from '../notifications/entities/notification-log.entity';
import { ScheduledNotification, ScheduledNotificationStatus } from '../notifications/entities/scheduled-notification.entity';
import { Contact } from '../contacts/entities/contact.entity';
import { Template } from '../templates/entities/template.entity';

// Enums (Asegúrate de que las rutas sean correctas)
import { NotificationStatus } from '../notifications/dto/send-notification.dto';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(NotificationLog)
    private notificationLogRepo: Repository<NotificationLog>,

    @InjectRepository(ScheduledNotification)
    private scheduledNotificationRepo: Repository<ScheduledNotification>,

    @InjectRepository(Contact)
    private contactRepo: Repository<Contact>,

    @InjectRepository(Template)
    private templateRepo: Repository<Template>,
  ) {}

  /**
   * Estadísticas generales optimizadas
   */
  async getGeneralStats(companyId: string) {
    // Conteos de tablas independientes
    const totalContacts = await this.contactRepo.count({
      where: { companyId } as any, // 'as any' por si Contact usa snake_case aún
    });

    const totalTemplates = await this.templateRepo.count({
      where: { companyId } as any,
    });

    // Agrupamos los conteos de logs en una sola consulta para mejorar performance
    const logStats = await this.notificationLogRepo
      .createQueryBuilder('log')
      .select('log.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('log.companyId = :companyId', { companyId })
      .groupBy('log.status')
      .getRawMany();

    // Procesar resultados de los logs
    let totalSent = 0;
    let totalFailed = 0;
    let totalNotifications = 0;

    logStats.forEach((stat) => {
      const count = parseInt(stat.count);
      totalNotifications += count;
      if (stat.status === NotificationStatus.SENT) totalSent = count;
      if (stat.status === NotificationStatus.FAILED) totalFailed = count;
    });

    // Notificaciones programadas pendientes
    const scheduledPending = await this.scheduledNotificationRepo.count({
      where: {
        companyId,
        status: ScheduledNotificationStatus.SCHEDULED,
      },
    });

    // Tasa de éxito
    const successRate = totalNotifications > 0 
      ? parseFloat(((totalSent / totalNotifications) * 100).toFixed(1)) 
      : 0;

    return {
      totalContacts,
      totalTemplates,
      totalNotifications,
      totalSent,
      totalFailed,
      scheduledPending,
      successRate,
    };
  }

  /**
   * Mensajes por canal
   */
  async getMessagesByChannel(companyId: string) {
    const result = await this.notificationLogRepo
      .createQueryBuilder('log')
      .select('log.channel', 'channel')
      .addSelect('COUNT(*)', 'count')
      .where('log.companyId = :companyId', { companyId })
      .groupBy('log.channel')
      .getRawMany();

    return result.map((item) => ({
      channel: item.channel,
      count: parseInt(item.count),
    }));
  }

  /**
   * Actividad por día (últimos N días)
   */
  async getActivityByDay(companyId: string, days: number = 7) {
    const result = await this.notificationLogRepo
      .createQueryBuilder('log')
      .select('DATE(log.createdAt)', 'date')
      .addSelect('log.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('log.companyId = :companyId', { companyId })
      .andWhere('log.createdAt >= DATE_SUB(NOW(), INTERVAL :days DAY)', { days })
      .groupBy('DATE(log.createdAt)')
      .addGroupBy('log.status')
      .orderBy('date', 'ASC')
      .getRawMany();

    const formatted: Record<string, any> = {};

    result.forEach((item) => {
      const date = item.date;
      if (!formatted[date]) {
        formatted[date] = {
          date,
          SENT: 0,
          FAILED: 0,
          PENDING: 0,
          DELIVERED: 0,
        };
      }
      formatted[date][item.status] = parseInt(item.count);
    });

    return Object.values(formatted);
  }

  /**
   * Notificaciones recientes
   */
  async getRecentNotifications(companyId: string, limit: number = 10) {
    const notifications = await this.notificationLogRepo.find({
      where: { companyId },
      order: { createdAt: 'DESC' },
      take: limit,
    });

    return notifications.map((notif) => ({
      id: notif.id,
      channel: notif.channel,
      recipient: notif.recipient,
      status: notif.status,
      errorMessage: notif.errorMessage,
      createdAt: notif.createdAt,
    }));
  }

  /**
   * Notificaciones programadas pendientes
   */
  async getScheduledPending(companyId: string) {
    const scheduled = await this.scheduledNotificationRepo.find({
      where: {
        companyId,
        status: ScheduledNotificationStatus.SCHEDULED,
      },
      order: { scheduledAt: 'ASC' },
      take: 20,
    });

    return scheduled.map((notif) => ({
      id: notif.id,
      channel: notif.channel,
      recipient: notif.recipient,
      scheduledAt: notif.scheduledAt,
      status: notif.status,
    }));
  }

  /**
   * Tasa de éxito por canal
   */
  async getSuccessRate(companyId: string) {
    const result = await this.notificationLogRepo
      .createQueryBuilder('log')
      .select('log.channel', 'channel')
      .addSelect('log.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('log.companyId = :companyId', { companyId })
      .groupBy('log.channel')
      .addGroupBy('log.status')
      .getRawMany();

    const byChannel: Record<string, any> = {};

    result.forEach((item) => {
      const channel = item.channel;
      if (!byChannel[channel]) {
        byChannel[channel] = {
          channel,
          SENT: 0,
          FAILED: 0,
          total: 0,
          successRate: 0,
        };
      }

      const count = parseInt(item.count);
      if (item.status === NotificationStatus.SENT) byChannel[channel].SENT = count;
      if (item.status === NotificationStatus.FAILED) byChannel[channel].FAILED = count;
      
      byChannel[channel].total += count;
    });

    // Calcular tasas
    return Object.values(byChannel).map((channelData: any) => {
      if (channelData.total > 0) {
        channelData.successRate = parseFloat(
          ((channelData.SENT / channelData.total) * 100).toFixed(1),
        );
      }
      return channelData;
    });
  }
}