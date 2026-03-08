// backend-omninotify/src/modules/credits/credits.controller.ts
import { Controller, Get, Post, Body, Param, Query, UseGuards, Request, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
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
  ChannelCostResponseDto 
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
   */
  @Get('balance')
  @ApiOperation({ summary: 'Obtener saldo actual de créditos' })
  @ApiResponse({ status: 200, description: 'Saldo obtenido correctamente', type: BalanceResponseDto })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 404, description: 'Empresa no encontrada' })
  async getBalance(@Request() req, @Query('companyId') companyId?: string): Promise<BalanceResponseDto> {
    // 🔥 Prioridad: usar companyId del query param o del usuario autenticado
    const finalCompanyId = companyId || req.user?.company_id;
    
    console.log('📡 GET /credits/balance - companyId:', finalCompanyId);
    console.log('👤 Usuario autenticado:', req.user);
    
    if (!finalCompanyId) {
      throw new BadRequestException('No se pudo determinar el ID de la empresa');
    }
    
    const result = await this.creditsService.getBalance(finalCompanyId);
    console.log('📡 Respuesta enviada:', result);
    return result;
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
    @Body() purchaseDto: PurchaseCreditsDto
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
      ...generateQrDto
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
      ...generateUrlDto
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
    @Body() verifyQrDto: VerifyQrDto
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
    @Body() verifyDto: VerifyTransactionDto
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
   * Obtener costo por canal
   */
  @Get('channel-cost/:channel')
  @ApiOperation({ summary: 'Obtener costo por canal' })
  @ApiResponse({ status: 200, description: 'Costo obtenido correctamente', type: ChannelCostResponseDto })
  async getChannelCost(@Param('channel') channel: string): Promise<ChannelCostResponseDto> {
    const cost = await this.creditsService.getChannelCost(channel as any);
    return {
      channel,
      cost,
    };
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
}