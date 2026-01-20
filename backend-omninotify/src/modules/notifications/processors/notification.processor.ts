import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationLog, NotificationLogStatus } from '../entities/notification-log.entity';

@Processor('notification-queue')
export class NotificationProcessor extends WorkerHost {
  constructor(
    @InjectRepository(NotificationLog) 
    private readonly logRepo: Repository<NotificationLog>,
  ) { 
    super(); 
  }

  async process(job: Job): Promise<any> {
    // Extraemos los datos del job
    const { channel, logId, companyId, recipient, variables } = job.data;

    console.log(`[Worker] Iniciando proceso para Log: ${logId} | Canal: ${channel}`);

    try {
      // --- PASO A: Simulación de lógica que hará el equipo ---
      // Aquí el equipo hará: 
      // 1. const config = await this.getCompanyConfig(companyId);
      // 2. const content = await this.templateService.compile(..., variables);
      
      let result = null;
      
      // Simulamos latencia de red de una API externa
      await new Promise(resolve => setTimeout(resolve, 1500));

      switch (channel) {
        case 'EMAIL':
          console.log(`Simulando envío de Email a ${recipient}`);
          // result = await this.emailProvider.send(...);
          break;
        case 'SMS':
          console.log(`Simulando envío de SMS a ${recipient}`);
          // result = await this.smsProvider.send(...);
          break;
        case 'WHATSAPP':
          console.log(`Simulando envío de WhatsApp a ${recipient}`);
          // result = await this.whatsappProvider.send(...);
          break;
        default:
          throw new Error(`Canal ${channel} no soportado`);
      }

      // --- PASO B: Actualizar Log a éxito ---
      // CORRECCIÓN: Cambia NotificationStatus por NotificationLogStatus
      await this.logRepo.update(logId, { 
        status: NotificationLogStatus.SENT // ← CORREGIDO
      });

      return { status: 'success', logId };

    } catch (error: any) {
      console.error(`[Worker Error] LogID ${logId}: ${error.message}`);

      // --- PASO C: Actualizar Log a fallo ---
      // CORRECCIÓN: Cambia NotificationStatus por NotificationLogStatus
      await this.logRepo.update(logId, { 
        status: NotificationLogStatus.FAILED, // ← CORREGIDO
        error_message: error.message 
      });

      // Importante: relanzar el error para que BullMQ gestione el reintento
      throw error; 
    }
  }
}