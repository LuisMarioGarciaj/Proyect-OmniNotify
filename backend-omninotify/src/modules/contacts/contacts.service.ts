// src/modules/contacts/contacts.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Contact } from './entities/contact.entity';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { Tag } from '../tags/entities/tag.entity';

@Injectable()
export class ContactsService {
  constructor(
    @InjectRepository(Contact)
    private readonly contactRepository: Repository<Contact>,

    @InjectRepository(Tag)
    private readonly tagRepository: Repository<Tag>,
  ) {}

  async create(dto: CreateContactDto): Promise<Contact> {
    // Crear el contacto sin tags primero
    const contact = this.contactRepository.create({
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      company_id: dto.company_id,
      metadata: dto.metadata || {},
    });

    // Guardar el contacto primero
    const savedContact = await this.contactRepository.save(contact);

    // Si hay tags, buscarlas y asignarlas
    if (dto.tagIds && dto.tagIds.length > 0) {
      const tags = await this.tagRepository.find({
        where: {
          id: In(dto.tagIds),
        },
      });
      
      // Asignar las tags al contacto
      savedContact.tags = tags;
      await this.contactRepository.save(savedContact);
    }

    // Retornar el contacto con las relaciones cargadas
    return this.findOne(savedContact.id);
  }

  async findAll(companyId: string): Promise<Contact[]> {
    return this.contactRepository.find({
      where: { company_id: companyId },
      relations: ['tags'],
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Contact> {
    const contact = await this.contactRepository.findOne({
      where: { id },
      relations: ['tags'],
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    return contact;
  }

  async update(id: string, dto: UpdateContactDto): Promise<Contact> {
    const contact = await this.findOne(id);

    // Actualizar campos básicos
    if (dto.name !== undefined) contact.name = dto.name;
    if (dto.email !== undefined) contact.email = dto.email;
    if (dto.phone !== undefined) contact.phone = dto.phone;
    if (dto.metadata !== undefined) contact.metadata = dto.metadata;
    if (dto.company_id !== undefined) contact.company_id = dto.company_id;

    // Si se proporcionan tagIds, actualizar las tags
    if (dto.tagIds !== undefined) {
      if (dto.tagIds.length > 0) {
        // Buscar las tags existentes
        const tags = await this.tagRepository.find({
          where: {
            id: In(dto.tagIds),
          },
        });
        contact.tags = tags;
      } else {
        // Array vacío = quitar todas las tags
        contact.tags = [];
      }
    }

    // Guardar cambios
    await this.contactRepository.save(contact);

    // Retornar el contacto actualizado con relaciones
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const contact = await this.findOne(id);
    await this.contactRepository.remove(contact);
  }
}