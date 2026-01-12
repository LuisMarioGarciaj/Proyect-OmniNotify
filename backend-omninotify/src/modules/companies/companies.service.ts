import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company, CompanyStatus } from './entities/company.entity';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private companiesRepository: Repository<Company>,
  ) {}

  async create(createCompanyDto: CreateCompanyDto): Promise<Company> {
    const company = this.companiesRepository.create({
      name: createCompanyDto.name,
      status: CompanyStatus.ACTIVE,
      api_keys_config: createCompanyDto.api_keys_config || {},
    });
    return await this.companiesRepository.save(company);
  }

  async findAll(): Promise<Company[]> {
    return await this.companiesRepository.find();
  }

  async findOne(id: string): Promise<Company> {
    const company = await this.companiesRepository.findOne({ where: { id } });
    if (!company) {
      throw new BadRequestException(`Empresa con ID ${id} no encontrada`);
    }
    return company;
  }

  async update(id: string, updateCompanyDto: UpdateCompanyDto): Promise<Company> {
    await this.companiesRepository.update(id, updateCompanyDto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.companiesRepository.delete(id);
  }

  async getConfig(companyId: string) {
    const company = await this.findOne(companyId);
    return company.api_keys_config;
  }
}