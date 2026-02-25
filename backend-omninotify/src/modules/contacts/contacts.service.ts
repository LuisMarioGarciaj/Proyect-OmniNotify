// src/modules/contacts/contacts.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
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

  // ─── helpers ────────────────────────────────────────────────────────────────

  /**
   * Checks whether a given email is already used by another contact
   * inside the same company. Pass `excludeId` when editing to skip
   * the contact being updated.
   */
  private async assertEmailUnique(
    email: string,
    companyId: string,
    excludeId?: string,
  ): Promise<void> {
    if (!email) return;

    const existing = await this.contactRepository.findOne({
      where: { email, company_id: companyId },
    });

    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        `A contact with the email "${email}" is already registered in this company.`,
      );
    }
  }

  // ─── create ──────────────────────────────────────────────────────────────────

  async create(dto: CreateContactDto): Promise<Contact> {
    // 1. Duplicate-email guard
    if (dto.email) {
      await this.assertEmailUnique(dto.email, dto.company_id);
    }

    // 2. Persist the contact WITHOUT tags first so the row exists in the DB
    const contact = this.contactRepository.create({
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      company_id: dto.company_id,
      metadata: dto.metadata || {},
    });

    const saved = await this.contactRepository.save(contact);

    // 3. Associate tags using the relation builder.
    //    This runs a plain INSERT INTO Contact_Tags AFTER the parent row
    //    is committed, which prevents the FK constraint violation.
    if (dto.tagIds && dto.tagIds.length > 0) {
      await this.contactRepository
        .createQueryBuilder()
        .relation(Contact, 'tags')
        .of(saved.id)
        .add(dto.tagIds);
    }

    return this.findOne(saved.id);
  }

  // ─── read ────────────────────────────────────────────────────────────────────

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

    if (!contact) throw new NotFoundException('Contact not found');

    return contact;
  }

  // ─── update ──────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateContactDto): Promise<Contact> {
    const contact = await this.findOne(id);

    // Duplicate-email guard (skip the contact itself)
    const targetCompanyId = dto.company_id ?? contact.company_id;
    if (dto.email && dto.email !== contact.email) {
      await this.assertEmailUnique(dto.email, targetCompanyId, id);
    }

    // Update scalar fields
    if (dto.name !== undefined) contact.name = dto.name;
    if (dto.email !== undefined) contact.email = dto.email;
    if (dto.phone !== undefined) contact.phone = dto.phone;
    if (dto.metadata !== undefined) contact.metadata = dto.metadata;
    if (dto.company_id !== undefined) contact.company_id = dto.company_id;

    await this.contactRepository.save(contact);

    // Update the tag junction table
    if (dto.tagIds !== undefined) {
      const relation = this.contactRepository
        .createQueryBuilder()
        .relation(Contact, 'tags')
        .of(id);

      if (dto.tagIds.length === 0) {
        // Remove all existing tags
        const current = await relation.loadMany<Tag>();
        if (current.length > 0) await relation.remove(current.map((t) => t.id));
      } else {
        const tags = await this.tagRepository.find({
          where: { id: In(dto.tagIds) },
        });

        const current = await relation.loadMany<Tag>();
        const currentIds = current.map((t) => t.id);
        const newIds = tags.map((t) => t.id);

        const toAdd = newIds.filter((tid) => !currentIds.includes(tid));
        const toRemove = currentIds.filter((tid) => !newIds.includes(tid));

        if (toAdd.length > 0) await relation.add(toAdd);
        if (toRemove.length > 0) await relation.remove(toRemove);
      }
    }

    return this.findOne(id);
  }

  // ─── delete ──────────────────────────────────────────────────────────────────

  async remove(id: string): Promise<void> {
    const contact = await this.findOne(id);
    await this.contactRepository.remove(contact);
  }
}