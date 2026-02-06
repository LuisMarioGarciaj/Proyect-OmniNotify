import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationLog, NotificationLogStatus } from '../notifications/entities/notification-log.entity';
import { ScheduledNotification, ScheduledNotificationStatus } from '../notifications/entities/scheduled-notification.entity';
import { Contact } from '../contacts/entities/contact.entity';
import { Template } from '../templates/entities/template.entity';

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
   * Estadísticas generales
   */
  async getGeneralStats(companyId: string) {
    try {
      console.log('📊 [Dashboard] Obteniendo estadísticas para company:', companyId);

      // Total de contactos - NOTA: Contact usa company_id (snake_case)
      const totalContacts = await this.contactRepo.count({
        where: { company_id: companyId } as any,
      });
      console.log('✅ Total contactos:', totalContacts);

      // Total de templates - NOTA: Template usa company_id (snake_case)
      const totalTemplates = await this.templateRepo.count({
        where: { company_id: companyId } as any,
      });
      console.log('✅ Total templates:', totalTemplates);

      // NOTA: NotificationLog usa companyId (camelCase)
      const totalSent = await this.notificationLogRepo.count({
        where: { 
          companyId,
          status: NotificationLogStatus.SENT
        },
      });
      console.log('✅ Total enviados:', totalSent);

      const totalFailed = await this.notificationLogRepo.count({
        where: { 
          companyId,
          status: NotificationLogStatus.FAILED
        },
      });
      console.log('✅ Total fallidos:', totalFailed);

      const totalNotifications = await this.notificationLogRepo.count({
        where: { companyId },
      });
      console.log('✅ Total notificaciones:', totalNotifications);

      // NOTA: ScheduledNotification usa companyId (camelCase)
      const scheduledPending = await this.scheduledNotificationRepo.count({
        where: { 
          companyId,
          status: ScheduledNotificationStatus.SCHEDULED,
        },
      });
      console.log('✅ Programadas pendientes:', scheduledPending);

      const successRate = totalNotifications > 0 
        ? parseFloat(((totalSent / totalNotifications) * 100).toFixed(1))
        : 0;

      const result = {
        totalContacts,
        totalTemplates,
        totalNotifications,
        totalSent,
        totalFailed,
        scheduledPending,
        successRate,
      };

      console.log('✅ [Dashboard] Estadísticas completas:', result);
      return result;

    } catch (error) {
      console.error('❌ [Dashboard] Error en getGeneralStats:', error);
      console.error('Stack:', error.stack);
      throw error;
    }
  }

  /**
   * Mensajes por canal
   */
  async getMessagesByChannel(companyId: string) {
    try {
      console.log('📊 [Dashboard] Obteniendo mensajes por canal');

      const result = await this.notificationLogRepo
        .createQueryBuilder('log')
        .select('log.channel', 'channel')
        .addSelect('COUNT(*)', 'count')
        .where('log.companyId = :companyId', { companyId })
        .groupBy('log.channel')
        .getRawMany();

      const formatted = result.map(item => ({
        channel: item.channel,
        count: parseInt(item.count)
      }));

      console.log('✅ Mensajes por canal:', formatted);
      return formatted;

    } catch (error) {
      console.error('❌ [Dashboard] Error en getMessagesByChannel:', error);
      return [];
    }
  }

  /**
   * Actividad por día (últimos N días)
   */
  async getActivityByDay(companyId: string, days: number = 7) {
    try {
      console.log(`📊 [Dashboard] Obteniendo actividad de últimos ${days} días`);

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
      
      result.forEach(item => {
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

      console.log('✅ Actividad por día:', Object.values(formatted).length, 'días');
      return Object.values(formatted);

    } catch (error) {
      console.error('❌ [Dashboard] Error en getActivityByDay:', error);
      return [];
    }
  }

  /**
   * Notificaciones recientes
   */
  async getRecentNotifications(companyId: string, limit: number = 10) {
    try {
      console.log(`📊 [Dashboard] Obteniendo últimas ${limit} notificaciones`);

      const notifications = await this.notificationLogRepo.find({
        where: { companyId },
        order: { createdAt: 'DESC' },
        take: limit,
      });

      const formatted = notifications.map(notif => ({
        id: notif.id,
        channel: notif.channel,
        recipient: notif.recipient,
        status: notif.status,
        error_message: notif.errorMessage,
        created_at: notif.createdAt,
      }));

      console.log('✅ Notificaciones recientes:', formatted.length);
      return formatted;

    } catch (error) {
      console.error('❌ [Dashboard] Error en getRecentNotifications:', error);
      return [];
    }
  }

  /**
   * Notificaciones programadas pendientes
   */
  async getScheduledPending(companyId: string) {
    try {
      console.log('📊 [Dashboard] Obteniendo programadas pendientes');

      const scheduled = await this.scheduledNotificationRepo.find({
        where: {
          companyId,
          status: ScheduledNotificationStatus.SCHEDULED,
        },
        order: { scheduledAt: 'ASC' },
        take: 20,
      });

      const formatted = scheduled.map(notif => ({
        id: notif.id,
        channel: notif.channel,
        recipient: notif.recipient,
        scheduled_at: notif.scheduledAt,
        status: notif.status,
      }));

      console.log('✅ Programadas pendientes:', formatted.length);
      return formatted;

    } catch (error) {
      console.error('❌ [Dashboard] Error en getScheduledPending:', error);
      return [];
    }
  }

  /**
   * Tasa de éxito por canal
   */
  async getSuccessRate(companyId: string) {
    try {
      console.log('📊 [Dashboard] Calculando tasa de éxito por canal');

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
      
      result.forEach(item => {
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
        byChannel[channel][item.status] = count;
        byChannel[channel].total += count;
      });

      // Calcular tasas de éxito
      Object.values(byChannel).forEach((channelData: any) => {
        if (channelData.total > 0) {
          channelData.successRate = parseFloat(
            ((channelData.SENT / channelData.total) * 100).toFixed(1)
          );
        }
      });

      const finalResult = Object.values(byChannel);
      console.log('✅ Tasa de éxito por canal:', finalResult);
      return finalResult;

    } catch (error) {
      console.error('❌ [Dashboard] Error en getSuccessRate:', error);
      return [];
    }
  }
}