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
  // 🧪 ENDPOINTS DE SIMULACIÓN (solo para testing — desactivar en producción)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 🧪 Simular compra de créditos (sin pago real)
   * Body: { "amount": 1000 }
   */
  @Post('simulate-purchase')
  @ApiOperation({
    summary: '🧪 [TEST] Simular compra de créditos sin pago real',
    description: 'Solo para desarrollo y testing. Enviar: { "amount": 1000 }',
  })
  @ApiResponse({ status: 200, type: PurchaseCreditsResponseDto })
  async simulatePurchase(
    @CompanyId() companyId: string,
    @Body() dto: SimulatePurchaseDto,
  ): Promise<PurchaseCreditsResponseDto> {
    return this.creditsService.simulatePurchase(companyId, dto.amount);
  }

  /**
   * 🧪 Simular descuento de créditos (sin enviar notificación real)
   * Body: { "channel": "WHATSAPP", "recipient": "+591XXXXXXXX" }
   */
  @Post('simulate-deduction')
  @ApiOperation({
    summary: '🧪 [TEST] Simular descuento de créditos sin envío real',
    description:
      'Solo para desarrollo y testing. Enviar: { "channel": "WHATSAPP", "recipient": "+591..." }',
  })
  async simulateDeduction(
    @CompanyId() companyId: string,
    @Body() dto: SimulateDeductionDto,
  ) {
    return this.creditsService.simulateDeduction(
      companyId,
      dto.channel,
      dto.recipient,
    );
  }
}