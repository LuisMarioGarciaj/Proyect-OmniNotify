import { Injectable, Logger } from '@nestjs/common';
import * as Handlebars from 'handlebars';

@Injectable()
export class TemplateProcessorService {
  private readonly logger = new Logger(TemplateProcessorService.name);

  /**
   * Procesa el contenido de una plantilla reemplazando {{variable}} con datos reales.
   * @param content El texto de la tabla TEMPLATE.content
   * @param variables El JSON de SCHEDULED_NOTIFICATION.variables
   */
  process(content: string, variables: Record<string, any>): string {
    try {
      // Compilamos el contenido (Ej: "Hola {{nombre}}")
      const template = Handlebars.compile(content);
      
      // Retornamos el string final (Ej: "Hola Juan")
      return template(variables);
    } catch (error) {
      this.logger.error(`Error procesando variables: ${error.message}`);
      // Si falla la compilación, devolvemos el contenido original para evitar pérdida de datos
      return content;
    }
  }
}