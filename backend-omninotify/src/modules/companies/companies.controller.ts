import { 
  Controller, 
  Get, 
  Patch, 
  Body, 
  Param, 
  UseGuards,
  Request 
} from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('companies')
@UseGuards(JwtAuthGuard) // 🔒 Protege todas las rutas con JWT
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get(':id')
  async getCompany(@Param('id') id: string, @Request() req) {
    // Opcional: Verificar que el usuario pertenece a esta compañía
    const userCompanyId = req.user.companyId;
    
    // Si quieres que solo puedan ver su propia compañía:
    if (id !== userCompanyId) {
      throw new Error('No tienes permiso para ver esta compañía');
    }
    
    return this.companiesService.findOne(id);
  }

  @Patch(':id')
  async updateCompany(
    @Param('id') id: string, 
    @Body() updateCompanyDto: UpdateCompanyDto,
    @Request() req
  ) {
    // Verificar que el usuario pertenece a esta compañía
    const userCompanyId = req.user.companyId;
    
    if (id !== userCompanyId) {
      throw new Error('No tienes permiso para modificar esta compañía');
    }
    
    return this.companiesService.update(id, updateCompanyDto);
  }
}