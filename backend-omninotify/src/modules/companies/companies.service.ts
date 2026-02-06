import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from './entities/company.entity';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
  ) {}

  async findOne(id: string) {
    const company = await this.companyRepo.findOne({ where: { id } });
    if (!company) throw new NotFoundException(`Compañía con ID ${id} no encontrada`);
    return company;
  }

  async update(id: string, updateCompanyDto: UpdateCompanyDto) {
    // Verificamos que exista
    const company = await this.findOne(id);
    
    // Fusionamos los cambios
    const updatedCompany = this.companyRepo.merge(company, updateCompanyDto);
    
    // Guardamos
    return await this.companyRepo.save(updatedCompany);
  }
}