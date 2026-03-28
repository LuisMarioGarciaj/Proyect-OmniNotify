// src/modules/credits/credits.controller.ts

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CreditsService } from './credits.service';
import { GenerateQrDto } from './dto/generate-qr.dto';
import { GenerateUrlDto } from './dto/generate-url.dto';
import { VerifyQrDto } from './dto/verify-qr.dto';
import { VerifyTransactionDto } from './dto/verify-transaction.dto';
import { PurchaseCreditsDto, PurchaseMethod } from './dto/purchase-credits.dto';
import {
  BalanceResponseDto,
  RechargeResponseDto,
  VerifyResponseDto,
  RechargeHistoryDto,
  ChannelCostResponseDto,
} from './dto/credit-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('créditos')
@Controller('credits')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CreditsController {
  constructor(private readonly creditsService: CreditsService) {}

  /**
   * Obtener saldo actual de créditos
   * GET /api/credits/balance?companyId=xxx
   */
  @Get('balance')
  @ApiOperation({ summary: 'Obtener saldo actual de créditos' })
  @ApiResponse({ status: 200, description: 'Saldo obtenido correctamente', type: BalanceResponseDto })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 404, description: 'Empresa no encontrada' })
  async getBalance(
    @Request() req,
    @Query('companyId') companyId?: string,
  ): Promise<BalanceResponseDto> {
    console.log('📡 GET /credits/balance');
    console.log('  - Query companyId:', companyId);
    console.log('  - User from token:', req.user);
    
    // 🔥 Prioridad: companyId del query param o del usuario autenticado
    const finalCompanyId = companyId || req.user?.company_id;
    
    if (!finalCompanyId) {
      console.error('❌ No se pudo determinar companyId');
      throw new BadRequestException(
        'No se pudo determinar el ID de la empresa. Por favor, proporciona companyId en la URL o asegúrate de estar autenticado.',
      );
    }
    
    console.log('✅ Usando companyId:', finalCompanyId);
    
    try {
      const result = await this.creditsService.getBalance(finalCompanyId);
      console.log('📡 Respuesta:', result);
      return result;
    } catch (error) {
      console.error('❌ Error en getBalance:', error.message);
      throw error;
    }
  }

  /**
   * Crear una nueva recarga de créditos (QR o URL)
   */
  @Post('purchase')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear una nueva recarga de créditos' })
  @ApiResponse({ status: 201, description: 'Recarga creada correctamente', type: RechargeResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 500, description: 'Error al comunicarse con Yopago' })
  async purchaseCredits(
    @Request() req,
    @Body() purchaseDto: PurchaseCreditsDto,
  ): Promise<RechargeResponseDto> {
    const companyId = req.user?.company_id;
    console.log('📡 POST /credits/purchase - companyId:', companyId);
    console.log('👤 Usuario:', req.user);
    console.log('📦 Datos de compra:', purchaseDto);
    
    if (!companyId) {
      throw new BadRequestException('Usuario no tiene empresa asociada');
    }
    
    return this.creditsService.createRecharge(companyId, purchaseDto);
  }

  /**
   * Generar QR de pago (mantenido por compatibilidad)
   */
  @Post('generate-qr')
  @ApiOperation({ summary: 'Generar QR de pago' })
  async generateQr(@Request() req, @Body() generateQrDto: GenerateQrDto) {
    const purchaseDto: PurchaseCreditsDto = {
      method: PurchaseMethod.QR,
      ...generateQrDto,
    };
    return this.purchaseCredits(req, purchaseDto);
  }

  /**
   * Generar URL de pago con tarjeta (mantenido por compatibilidad)
   */
  @Post('generate-url')
  @ApiOperation({ summary: 'Generar URL de pago con tarjeta' })
  async generateUrl(@Request() req, @Body() generateUrlDto: GenerateUrlDto) {
    const purchaseDto: PurchaseCreditsDto = {
      method: PurchaseMethod.CARD,
      ...generateUrlDto,
    };
    return this.purchaseCredits(req, purchaseDto);
  }

  /**
   * Verificar estado de un pago por QR
   */
  @Post('verify-qr')
  @ApiOperation({ summary: 'Verificar estado de un pago por QR' })
  @ApiResponse({ status: 200, description: 'Estado verificado correctamente', type: VerifyResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 404, description: 'Recarga no encontrada' })
  async verifyQr(
    @Request() req,
    @Body() verifyQrDto: VerifyQrDto,
  ): Promise<VerifyResponseDto> {
    const companyId = req.user?.company_id;
    console.log('📡 POST /credits/verify-qr - companyId:', companyId);
    console.log('📦 Datos de verificación:', verifyQrDto);
    
    if (!companyId) {
      throw new BadRequestException('Usuario no tiene empresa asociada');
    }
    
    return this.creditsService.verifyQrRecharge(companyId, verifyQrDto);
  }

  /**
   * Verificar estado de una transferencia/pago con tarjeta
   */
  @Post('verify-transaction')
  @ApiOperation({ summary: 'Verificar estado de un pago con tarjeta/transferencia' })
  @ApiResponse({ status: 200, description: 'Estado verificado correctamente', type: VerifyResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 404, description: 'Recarga no encontrada' })
  async verifyTransaction(
    @Request() req,
    @Body() verifyDto: VerifyTransactionDto,
  ): Promise<VerifyResponseDto> {
    const companyId = req.user?.company_id;
    console.log('📡 POST /credits/verify-transaction - companyId:', companyId);
    console.log('📦 Datos de verificación:', verifyDto);
    
    if (!companyId) {
      throw new BadRequestException('Usuario no tiene empresa asociada');
    }
    
    return this.creditsService.verifyTransferRecharge(companyId, verifyDto);
  }

  /**
   * Obtener historial de recargas
   */
  @Get('history')
  @ApiOperation({ summary: 'Obtener historial de recargas' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Registros por página (default: 20)' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Desplazamiento (default: 0)' })
  @ApiResponse({ status: 200, description: 'Historial obtenido correctamente', type: RechargeHistoryDto })
  async getRechargeHistory(
    @Request() req,
    @Query('limit') limit: number = 20,
    @Query('offset') offset: number = 0,
  ): Promise<RechargeHistoryDto> {
    const companyId = req.user?.company_id;
    console.log('📡 GET /credits/history - companyId:', companyId);
    
    if (!companyId) {
      throw new BadRequestException('Usuario no tiene empresa asociada');
    }
    
    return this.creditsService.getRechargeHistory(companyId, limit, offset);
  }

  /**
   * Obtener imagen de QR por ID de recarga
   */
  @Get('qr/:rechargeId')
  @ApiOperation({ summary: 'Obtener imagen de QR por ID de recarga' })
  async getQrImage(
    @Request() req,
    @Param('rechargeId') rechargeId: string,
  ): Promise<{ qrImage: string; expiresAt: Date; amount: number; credits: number }> {
    const companyId = req.user?.company_id;
    console.log('📡 GET /credits/qr/:rechargeId - companyId:', companyId, 'rechargeId:', rechargeId);
    
    if (!companyId) {
      throw new BadRequestException('Usuario no tiene empresa asociada');
    }
    
    return this.creditsService.getQrImage(companyId, rechargeId);
  }

  /**
   * Obtener costo por canal
   */
  @Get('channel-cost/:channel')
  @ApiOperation({ summary: 'Obtener costo por canal' })
  @ApiResponse({ status: 200, description: 'Costo obtenido correctamente', type: ChannelCostResponseDto })
  async getChannelCost(
    @Param('channel') channel: string,
    @Request() req,
  ): Promise<ChannelCostResponseDto> {
    console.log('📡 GET /credits/channel-cost/:channel');
    console.log('  - Channel:', channel);
    console.log('  - User:', req.user?.email || 'unknown');
    
    try {
      const cost = await this.creditsService.getChannelCost(channel as any);
      console.log('✅ Costo obtenido:', { channel, cost });
      return {
        channel: channel as any,
        cost,
      };
    } catch (error) {
      console.error('❌ Error en getChannelCost:', error.message);
      // En caso de error, retornar valor por defecto
      const defaultCost = channel === 'SMS' ? 2 : 1;
      return {
        channel: channel as any,
        cost: defaultCost,
      };
    }
  }

  /**
   * Webhook para notificaciones de Yopago
   */
  @Post('yopago-webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook para notificaciones de Yopago' })
  @ApiResponse({ status: 200, description: 'Webhook procesado correctamente' })
  async yopagoWebhook(@Body() body: any) {
    console.log('📡 POST /credits/yopago-webhook - body:', body);
    await this.creditsService.handleYopagoWebhook(body);
    return { received: true };
  }

  /**
   * Callback de Yopago - Confirma pago exitoso
   */
  @Post('yopago-callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Callback de Yopago - Confirma pago exitoso' })
  async yopagoCallback(@Body() body: any) {
    console.log('📡 [YOPAGO CALLBACK] Recibida confirmación de pago:');
    console.log('📦 Body completo:', JSON.stringify(body, null, 2));
    
    if (!body.transactionId && !body.transaction_id) {
      console.error('❌ [YOPAGO CALLBACK] Faltan datos requeridos');
      return {
        success: false,
        message: 'Faltan datos requeridos: transactionId',
      };
    }

    const result = await this.creditsService.processPaymentConfirmation(body);
    
    return {
      success: true,
      message: 'Pago procesado correctamente',
      data: result,
    };
  }
}
