import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contact } from './entities/contact.entity';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { Tag } from '../tags/entities/tag.entity';

import { DEV_COMPANY_ID } from '../../common/constants/dev.constants';

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

    contact.company_id = DEV_COMPANY_ID;

    if (dto.tagIds?.length) {
      contact.tags = await this.tagRepository.findBy({
        id: dto.tagIds as any,
      });
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
      contact.tags = await this.tagRepository.findBy({
        id: dto.tagIds as any,
      });
    }

    return this.contactRepository.save(contact);
  }

  async remove(id: string): Promise<void> {
    const contact = await this.findOne(id);
    await this.contactRepository.remove(contact);
  }
}
