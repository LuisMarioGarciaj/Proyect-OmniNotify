import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tag } from './entities/tag.entity';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';

@Injectable()
export class TagsService {
  constructor(
    @InjectRepository(Tag)
    private tagsRepository: Repository<Tag>,
  ) {}

  // Crear una nueva etiqueta
  async create(createTagDto: CreateTagDto): Promise<Tag> {
    // Verificar si ya existe una etiqueta con el mismo nombre en la misma compañía
    const existingTag = await this.tagsRepository.findOne({
      where: {
        name: createTagDto.name,
        company_id: createTagDto.company_id,
      },
    });

    if (existingTag) {
      throw new ConflictException('Ya existe una etiqueta con este nombre en tu compañía');
    }

    const tag = this.tagsRepository.create(createTagDto);
    return await this.tagsRepository.save(tag);
  }

  // Obtener todas las etiquetas de una compañía
  async findAllByCompany(companyId: string): Promise<Tag[]> {
    return await this.tagsRepository.find({
      where: { company_id: companyId },
      order: { name: 'ASC' },
    });
  }

  // Buscar etiqueta por ID
  async findOne(id: string, companyId?: string): Promise<Tag> {
    const where: any = { id };
    
    if (companyId) {
      where.company_id = companyId;
    }

    const tag = await this.tagsRepository.findOne({ where });

    if (!tag) {
      throw new NotFoundException(`Etiqueta con ID ${id} no encontrada`);
    }

    return tag;
  }

  // Actualizar etiqueta
  async update(id: string, updateTagDto: UpdateTagDto, companyId?: string): Promise<Tag> {
    const tag = await this.findOne(id, companyId);
    
    // Si se está actualizando el nombre, verificar que no exista otro con el mismo nombre
    if (updateTagDto.name && updateTagDto.name !== tag.name) {
      const existingTag = await this.tagsRepository.findOne({
        where: {
          name: updateTagDto.name,
          company_id: companyId || tag.company_id,
        },
      });

      if (existingTag) {
        throw new ConflictException('Ya existe una etiqueta con este nombre en tu compañía');
      }
    }

    Object.assign(tag, updateTagDto);
    return await this.tagsRepository.save(tag);
  }

  // Eliminar etiqueta
  async remove(id: string, companyId?: string): Promise<void> {
    const tag = await this.findOne(id, companyId);
    await this.tagsRepository.remove(tag);
  }

  // Método para encontrar etiquetas por IDs
  async findByIds(ids: string[], companyId: string): Promise<Tag[]> {
    return await this.tagsRepository
      .createQueryBuilder('tag')
      .where('tag.id IN (:...ids)', { ids })
      .andWhere('tag.company_id = :companyId', { companyId })
      .getMany();
  }
}