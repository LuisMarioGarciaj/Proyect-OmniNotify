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
    const contact = this.contactRepository.create(dto);

    if (dto.tagIds && dto.tagIds.length > 0) {
      contact.tags = await this.tagRepository.find({
        where: {
          id: In(dto.tagIds),
        },
      });
    } else {
      contact.tags = [];
    }

    return this.contactRepository.save(contact);
  }

  findAll(companyId: string): Promise<Contact[]> {
    return this.contactRepository.find({
      where: { company_id: companyId },
      relations: ['tags'],
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

    Object.assign(contact, dto);

    if (dto.tagIds) {
      if (dto.tagIds.length > 0) {
        contact.tags = await this.tagRepository.find({
          where: {
            id: In(dto.tagIds),
          },
        });
      } else {
        // Si mandan array vacío → quitar todas las tags
        contact.tags = [];
      }
    }

    return this.contactRepository.save(contact);
  }

  async remove(id: string): Promise<void> {
    const contact = await this.findOne(id);
    await this.contactRepository.remove(contact);
  }
}
