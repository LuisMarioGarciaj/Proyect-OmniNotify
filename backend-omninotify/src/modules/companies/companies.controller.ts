import { Controller, Get, Patch, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get(':id')
  async getCompany(@Param('id') id: string) {
    return this.companiesService.findOne(id);
  }

  @Patch(':id')
  async updateCompany(
    @Param('id') id: string, 
    @Body() updateCompanyDto: UpdateCompanyDto
  ) {
    return this.companiesService.update(id, updateCompanyDto);
  }
}