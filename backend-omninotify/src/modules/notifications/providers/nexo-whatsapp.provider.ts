import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';

@Injectable()
export class NexoWhatsappProvider {
  constructor(private httpService: HttpService) {}
  async send(token: string, data: { para: string; mensaje: string; b64?: any }) {
    const url = 'https://nexo-api.nexoss.pro/api/messages/send';

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };

    const cleanNumber = data.para.replace(/\D/g, '');

    const payload = {
      para: cleanNumber,
      mensaje: data.mensaje,
      ...(data.b64 && { b64: data.b64 })
    };

    try {
      // 1. Hacemos la petición
      const response = await this.httpService.post(url, payload, { headers }).toPromise();

      // 2. Verificamos si existe (esto quita el error ts(18048))
      if (!response) {
        throw new Error('Nexo API no devolvió ninguna respuesta');
      }

      // 3. Ahora TypeScript sabe que 'response' NO es undefined
      return response.data;

    } catch (error: any) {
      if (error.response) {
        console.error('❌ Nexo respondió detalle:', JSON.stringify(error.response.data));
      }
      throw new Error(`Error en Nexo API: ${error.message}`);
    }
  }
}