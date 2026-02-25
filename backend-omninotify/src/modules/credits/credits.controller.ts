// src/modules/credits/credits.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { CreditsService } from './credits.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CompanyId } from '../../common/decorators/company-id.decorator';
import { PurchaseCreditsDto } from './dto/purchase-credits.dto';
import { SimulatePurchaseDto } from './dto/simulate-purchase.dto';
import { SimulateDeductionDto } from './dto/simulate-deduction.dto';
import { GenerateQrDto } from './dto/generate-qr.dto';
import { GenerateUrlDto } from './dto/generate-url.dto';
import { VerifyQrDto } from './dto/verify-qr.dto';
import { VerifyTransactionDto } from './dto/verify-transaction.dto';
import {
  CreditBalanceResponseDto,
  CreditHistoryResponseDto,
  PurchaseCreditsResponseDto,
} from './dto/credit-response.dto';

@ApiTags('Credits')
@ApiBearerAuth()
@Controller('credits')
@UseGuards(JwtAuthGuard)
export class CreditsController {
  constructor(private readonly creditsService: CreditsService) {}

  /**
   * 💰 Obtener balance actual de créditos
   */
  @Get('balance')
  @ApiOperation({ summary: 'Obtener balance actual de créditos' })
  @ApiResponse({ status: 200, type: CreditBalanceResponseDto })
  async getBalance(
    @CompanyId() companyId: string,
  ): Promise<CreditBalanceResponseDto> {
    return this.creditsService.getBalance(companyId);
  }

  /**
   * 📜 Obtener historial de transacciones
   */
  @Get('history')
  @ApiOperation({ summary: 'Obtener historial de transacciones' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'perPage', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, type: CreditHistoryResponseDto })
  async getHistory(
    @CompanyId() companyId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('perPage', new DefaultValuePipe(20), ParseIntPipe) perPage: number,
  ): Promise<CreditHistoryResponseDto> {
    return this.creditsService.getHistory(companyId, page, perPage);
  }

  /**
   * 💳 Comprar créditos (con validación de pago real)
   */
  @Post('purchase')
  @ApiOperation({ summary: 'Comprar créditos (requiere paymentMethod)' })
  @ApiResponse({ status: 200, type: PurchaseCreditsResponseDto })
  async purchaseCredits(
    @CompanyId() companyId: string,
    @Body() dto: PurchaseCreditsDto,
  ): Promise<PurchaseCreditsResponseDto> {
    return this.creditsService.purchaseCredits(companyId, dto);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 🪙 PAGOS CON QR (INTEGRACIÓN YOPAGO)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 🪙 Generar código QR para pago
   */
  @Post('qr/generate')
  @ApiOperation({ summary: 'Generar código QR para pago' })
  async generateQr(
    @CompanyId() companyId: string,
    @Body() dto: GenerateQrDto,
  ) {
    return this.creditsService.generateQr(companyId, dto);
  }

  /**
   * 🔗 Generar URL de pago (alternativa al QR)
   */
  @Post('url/generate')
  @ApiOperation({ summary: 'Generar URL de pago' })
  async generateUrl(
    @CompanyId() companyId: string,
    @Body() dto: GenerateUrlDto,
  ) {
    return this.creditsService.generateUrl(companyId, dto);
  }

  /**
   * 🔍 Verificar pago por QR
   */
  @Post('qr/verify')
  @ApiOperation({ summary: 'Verificar pago por QR' })
  async verifyQr(
    @CompanyId() companyId: string,
    @Body() dto: VerifyQrDto,
  ) {
    return this.creditsService.verifyQr(companyId, dto);
  }

  /**
   * 🔍 Verificar transacción por URL
   */
  @Post('transaction/verify')
  @ApiOperation({ summary: 'Verificar transacción' })
  async verifyTransaction(
    @CompanyId() companyId: string,
    @Body() dto: VerifyTransactionDto,
  ) {
    return this.creditsService.verifyTransaction(companyId, dto.transactionId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 🧪 ENDPOINTS DE SIMULACIÓN (solo para testing)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 🧪 Simular compra de créditos (sin pago real)
   */
  @Post('simulate-purchase')
  @ApiOperation({
    summary: '🧪 [TEST] Simular compra de créditos sin pago real',
  })
  @ApiResponse({ status: 200, type: PurchaseCreditsResponseDto })
  async simulatePurchase(
    @CompanyId() companyId: string,
    @Body() dto: SimulatePurchaseDto,
  ): Promise<PurchaseCreditsResponseDto> {
    return this.creditsService.simulatePurchase(companyId, dto);
  }

  /**
   * 🧪 Simular descuento de créditos (sin enviar notificación real)
   */
  @Post('simulate-deduction')
  @ApiOperation({
    summary: '🧪 [TEST] Simular descuento de créditos sin envío real',
  })
  @ApiResponse({ status: 200, type: PurchaseCreditsResponseDto })
  async simulateDeduction(
    @CompanyId() companyId: string,
    @Body() dto: SimulateDeductionDto,
  ): Promise<PurchaseCreditsResponseDto> {
    return this.creditsService.simulateDeduction(
      companyId,
      dto.channel,
      dto.recipient,
    );
  }
}