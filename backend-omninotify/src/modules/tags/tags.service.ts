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
  // src/modules/tags/tags.service.ts - ACTUALIZAR método findAllByCompany
async findAllByCompany(companyId: string): Promise<any[]> {
  const tags = await this.tagsRepository
    .createQueryBuilder('tag')
    .leftJoinAndSelect('tag.contacts', 'contact')
    .where('tag.company_id = :companyId', { companyId })
    .orderBy('tag.name', 'ASC')
    .getMany();

  // Agregar información adicional
  return tags.map(tag => ({
    ...tag,
    contacts_count: tag.contacts?.length || 0,
    // Si quieres mostrar solo algunos datos de los contactos
    contacts_preview: tag.contacts?.slice(0, 5).map(contact => ({
      id: contact.id,
      name: contact.name,
      email: contact.email,
      phone: contact.phone
    })) || []
  }));
}

// Método para obtener tag con todos sus contactos
async findTagWithContacts(id: string, companyId: string): Promise<any> {
  const tag = await this.tagsRepository
    .createQueryBuilder('tag')
    .leftJoinAndSelect('tag.contacts', 'contact')
    .where('tag.id = :id', { id })
    .andWhere('tag.company_id = :companyId', { companyId })
    .getOne();

  if (!tag) {
    throw new NotFoundException(`Tag con ID ${id} no encontrada`);
  }

  return {
    ...tag,
    contacts_count: tag.contacts?.length || 0,
    contacts: tag.contacts?.map(contact => ({
      id: contact.id,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      created_at: contact.created_at
    })) || []
  };
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